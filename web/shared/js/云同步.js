// 云同步 —— 一处「拉→合并→推」的引擎，各讲只登记 {存储键, 合并, 收编} 就自动跨设备同步。
//
// 家规（共享 widget）：别让每讲手搓一份同步逻辑然后各自漂移。所以拉取、逐键合并调度、
// 推送节流、失败静默全收在这一个文件里；第二个讲想同步时只多写一行 登记(...)。
//
// 分工，和 说话.js / 预热.js 同一套「引擎在这、素材在各讲」的接缝：
//   · 怎么合并两份进度  —— 各讲的**纯函数** 合并(本地, 云端)（06/07 实现，有 node 测试），
//                          星星/图鉴取并集只增不减、作答冲突本地胜、重置戳更新的一侧整分区胜出；
//   · 合并后怎么落到内存态并刷界面 —— 各讲的回调 收编(合并后)（第2讲走 改()+广播，第3讲直写）；
//   · 什么时候拉、什么时候推、怎么防抖、失败怎么咽 —— 全是这个文件的事，各讲不用管。
//
// 失败哲学与 localStorage 写失败同款（CLAUDE.md 铁律）：AUTH_MODE=off、未登录、断网、
// 任何 fetch 卡死 —— 整个模块静默休眠或这一轮静默作罢，**绝不抛错、绝不打断课程**。
// 孩子照玩，只是这一局攒不到云上。localStorage 始终是「推什么」的唯一真相，这个模块
// 从不自己攒一份进度，只做字节的搬运工。
//
// 各讲接入的**三条硬约束**（违反哪条都是静默丢同步，不是报错）：
//   1. 记脏(存储键) 必须在 localStorage 落盘**之后同步**调 —— 推送现读 localStorage 原文，
//      写没落盘就推是空的；
//   2. 收编(合并后) 必须**同步**走本讲既有写路径 —— 引擎调 收编 期间置「正在收编」压住
//      记脏 防 ping-pong，异步广播会漏出这个 guard；
//   3. 重来：先把带新重置戳的空包写进 localStorage，**再**调 立即推(存储键)。
// （各函数的 JSDoc 里有展开；CLAUDE.md「Account system」指到这里。）
//
// 这是个网络模块，按家规不加 mock 测试、浏览器手验；可剥离的纯算术（逐键合并调度、
// 该不该回推的判断、深比较）拆成下面几个 export 的纯函数，进 web/shared/test/云同步.test.js。
// 全模块 import 时不碰 DOM/网络（监听器只在 启动同步() 里挂），所以 node --test 直接 import 得动。

import { 带超时取 } from './取.js';

// ── 常量 ──────────────────────────────────────────────────────────────────

const ME端点 = '/api/auth/me';
const 进度端点 = '/api/progress';

/** 探测与拉/推的前端超时：这几条都是快操作（一次 DB 往返），给个短上限，卡死也能撒手。
 *  和 取.js 的注释同理，只兜「连一个字节都不回」的彻底沉默，不误杀正常的慢。 */
const 探超时 = 8_000;
const 同步超时 = 8_000;

/** 本地改动后攒多久推一次。是**合并窗口**不是经典 debounce：一批里第一次改动就起表、
 *  不因后续改动重置，到点把这段时间里攒下的所有脏键一起推。这样推送延迟有上限
 *  （最多 防抖毫秒），一关连答几题的连环改动也只合成一次推送，不会被无限推迟。 */
const 防抖毫秒 = 3_000;

// ── 模块单例状态 ────────────────────────────────────────────────────────────

/** 存储键 → {存储键, 合并, 收编}。各讲 boot 时 登记() 填进来。 */
const 登记表 = new Map();

/** 只有 GET /api/auth/me 确认 {auth:"on"} 且已登录后才 true。false = 休眠，一切入口空转。 */
let 激活 = false;

/** 启动同步() 只真正跑一次，重复调用直接返回。 */
let 已启动 = false;

/** 应用云端合并结果（收编）期间置真：压住 记脏()。收编写 localStorage 会触发各讲写路径里
 *  的 记脏()，但那是「云来的写」不是「孩子玩出来的改动」，不该被当成脏键回推。 */
let 正在收编 = false;

/** 待推的存储键。推成从里面删，推失败留着等下次机会（下次改动 / 离开页面）。 */
const 脏键集 = new Set();

/** 合并窗口的定时器句柄；非 null 表示已有一次推送在排队。 */
let 防抖表 = null;

// ── 纯函数（可独立 import 测试，不碰 DOM/网络/存储）─────────────────────────

/**
 * 深比较两个 JSON 值是否等价。
 * 对象**不看键序**（合并函数产出的键序和云端存的键序未必一致，键序不同不算「不同」，
 * 免得每次开机都白推一遍）；数组**看顺序**（沙盒格子 [a,b] 和 [b,a] 是不同的进度）。
 * 进度整包是纯 JSON（无 NaN/函数/循环），不必处理那些边角。
 */
function 深等(甲, 乙) {
  if (甲 === 乙) return true;
  if (甲 === null || 乙 === null) return false;
  if (typeof 甲 !== 'object' || typeof 乙 !== 'object') return false;

  const 甲是数组 = Array.isArray(甲);
  const 乙是数组 = Array.isArray(乙);
  if (甲是数组 !== 乙是数组) return false;

  if (甲是数组) {
    if (甲.length !== 乙.length) return false;
    for (let i = 0; i < 甲.length; i += 1) {
      if (!深等(甲[i], 乙[i])) return false;
    }
    return true;
  }

  const 甲键 = Object.keys(甲);
  const 乙键 = Object.keys(乙);
  if (甲键.length !== 乙键.length) return false;
  for (const k of 甲键) {
    if (!Object.prototype.hasOwnProperty.call(乙, k)) return false;
    if (!深等(甲[k], 乙[k])) return false;
  }
  return true;
}

/** 两个 JSON 值是否不同 —— 「该不该回推 / 该不该收编」都用它判。 */
export function 不同(甲, 乙) {
  return !深等(甲, 乙);
}

/**
 * 从 GET /api/progress 的整份响应里取某个键的云端整包。
 * 响应形状是 {存储键: {payload, updated_at}}；这一层把 payload 剥出来，
 * 云端没这个键（另一台设备还没玩过这一讲）就给 null，正好喂给 合并(本地, null)。
 */
export function 取云端payload(云端全部, 存储键) {
  if (!云端全部 || typeof 云端全部 !== 'object') return null;
  const 项 = 云端全部[存储键];
  if (!项 || typeof 项 !== 'object') return null;
  return 'payload' in 项 ? 项.payload : null;
}

/**
 * 逐键合并调度 —— 引擎的算术核心，纯函数。
 *
 * 对每个已登记的键，取出本地整包和云端整包，交给该讲自己的 合并() 得到合并后整包，
 * 再算两件事：要不要写回本地（合并后 ≠ 本地）、要不要回推云端（合并后 ≠ 云端）。
 * 不碰存储、不碰网络：读本地 是注入的取数函数，合并 是各讲注入的纯函数，
 * 所以测试里拿假的 读本地 + 假的 合并 就能把「云有本无 / 本有云无 / 双方都有 / 该不该回推」全验。
 *
 * 某一讲的 合并() 抛了不连累别讲：这一键这一轮跳过，别的键照常。
 *
 * @param {Array<{存储键:string, 合并:Function}>} 登记项们
 * @param {(键:string)=>any} 读本地  存储键 → 本地整包 | null
 * @param {Record<string,{payload:any}>} 云端全部  GET /api/progress 的响应
 * @returns {Array<{存储键:string, 合并后:any, 该收编:boolean, 该推:boolean}>}
 */
export function 规划同步(登记项们, 读本地, 云端全部) {
  const 计划 = [];
  for (const 项 of 登记项们 ?? []) {
    if (!项 || typeof 项.存储键 !== 'string') continue;
    const 本地 = 读本地(项.存储键);
    const 云端 = 取云端payload(云端全部, 项.存储键);
    let 合并后;
    try {
      合并后 = typeof 项.合并 === 'function' ? 项.合并(本地, 云端) : 本地;
    } catch {
      continue; // 某讲合并炸了：跳过这一键，别让它掀翻整轮同步
    }
    计划.push({
      存储键: 项.存储键,
      合并后,
      该收编: 不同(合并后, 本地),
      该推: 不同(合并后, 云端),
    });
  }
  return 计划;
}

// ── localStorage 存取（内部，不导出）─────────────────────────────────────────

/** 读某键的本地整包（解析成对象）。读不了 / 坏 JSON 一律 null —— 存坏了也不许抛。 */
function 读本地payload(键) {
  try {
    const 文本 = globalThis.localStorage?.getItem(键);
    return 文本 ? JSON.parse(文本) : null;
  } catch {
    return null;
  }
}

/** 读某键的本地原文字符串（不解析）—— 推送直接把这份原样送出去，不重新序列化。 */
function 读本地原文(键) {
  try {
    return globalThis.localStorage?.getItem(键) ?? null;
  } catch {
    return null;
  }
}

/** 把一个 JS 值序列化成推送用的字符串；序列化失败给 null（推送方会跳过）。 */
function 安全序列化(值) {
  try {
    return JSON.stringify(值);
  } catch {
    return null;
  }
}

// ── 接缝：各讲 boot 时调这三个 ────────────────────────────────────────────

/**
 * 登记({存储键, 合并, 收编}) —— 各讲把自己的一个进度键交给同步引擎托管。
 *
 * @param {object} 项
 * @param {string} 项.存储键  这一讲进度在 localStorage 里的键（如 'cube-fold:进度:v2'）
 * @param {(本地:any, 云端:any) => any} 项.合并
 *        各讲导出的纯函数。本地/云端任一可能为 null（对方没有这个键）。返回合并后整包。
 *        并集只增不减、冲突本地胜、重置戳整分区胜出等语义都在这个函数里（06/07 实现+测试）。
 * @param {(合并后:any) => void} 项.收编
 *        把合并结果写回各讲自己的内存态并广播刷界面。**必须同步**地走各讲既有写路径
 *        （第2讲的 改()+广播 / 第3讲的直写）—— 引擎在调它期间会压住 记脏()，同步写才压得住。
 */
export function 登记(项) {
  if (!项 || typeof 项.存储键 !== 'string' || !项.存储键) return;
  登记表.set(项.存储键, {
    存储键: 项.存储键,
    合并: typeof 项.合并 === 'function' ? 项.合并 : (本地) => 本地,
    收编: typeof 项.收编 === 'function' ? 项.收编 : () => {},
  });
}

/**
 * 启动同步() —— 各讲 boot 调一次（登记() 之前之后都行：真正读登记表是在 await 之后）。
 *
 * 时序：
 *   1. GET /api/auth/me。非 {auth:"on"}（off / 401未登录 / 断网）→ 整个模块**永久休眠**，
 *      课程行为与没有账号体系时逐字节一致。
 *   2. on 且已登录 → 激活，挂 visibilitychange / pagehide 监听，跑开机首拉一轮。
 *
 * 只跑一次。任何一步失败都静默，绝不抛。
 */
export async function 启动同步() {
  if (已启动) return;
  已启动 = true;

  if (!(await 探账号是否登录())) return; // 休眠：这之后模块彻底不动

  激活 = true;
  挂页面监听();
  await 拉合并一轮(); // 开机首拉
}

/**
 * 记脏(存储键) —— 各讲在**每次本地进度写入后**同步调一次，通知引擎该键待推。
 * 攒进脏键集、开一个合并窗口，窗口到点把这段时间的脏键一起推。
 * 休眠期、或正在应用云端收编期间调用都直接忽略（后者避免把云来的写当本地改动回推）。
 */
export function 记脏(存储键) {
  if (!激活 || 正在收编) return;
  if (!登记表.has(存储键)) return;
  脏键集.add(存储键);
  安排一次推();
}

/**
 * 立即推(存储键) —— 不等合并窗口，马上把该键当前的本地整包推上去。
 * 「重来」专用：它清掉 localStorage 后写入一份带**新重置戳**的空包，再调这个，
 * 让重置立刻传播到云端和其他设备（等几秒防抖的话，孩子可能已经关页面了）。
 * 休眠期忽略。
 */
export function 立即推(存储键) {
  if (!激活) return;
  if (!登记表.has(存储键)) return;
  脏键集.delete(存储键); // 这就推，别让合并窗口再推一次
  推一键(存储键, 读本地原文(存储键));
}

// ── 内部：探测 / 拉 / 推 / 监听 ──────────────────────────────────────────────

/** GET /api/auth/me → 是否 {auth:"on"} 且已登录。off / 401 / 网络失败一律 false（→ 休眠）。 */
async function 探账号是否登录() {
  let 回;
  try {
    回 = await 带超时取(ME端点, { credentials: 'same-origin' }, 探超时);
  } catch {
    return false; // 断网 / 卡死
  }
  if (!回.ok) return false; // 401 未登录 / 5xx
  let 数;
  try {
    数 = await 回.json();
  } catch {
    return false;
  }
  return Boolean(数) && 数.auth === 'on'; // {auth:"off"} → false
}

/**
 * 拉一轮：GET /api/progress 一次拿全 → 逐键合并 → 该收编的落地、该推的回推。
 * 开机调一次；标签页重获焦点再调（堵「桌面长开标签页」吞掉另一台设备星星的口子）。
 * GET 失败只是这一轮作罢，不改 激活（不学「一次网络抖动就永久休眠」）—— 下次焦点/改动再试。
 */
async function 拉合并一轮() {
  if (!激活) return;

  let 云端全部;
  try {
    const 回 = await 带超时取(进度端点, { credentials: 'same-origin' }, 同步超时);
    if (!回.ok) return; // 401（会话刚过期）/ 5xx：这一轮静默作罢
    云端全部 = await 回.json();
  } catch {
    return; // 断网 / 卡死：静默作罢
  }

  const 计划 = 规划同步([...登记表.values()], 读本地payload, 云端全部);
  for (const { 存储键, 合并后, 该收编, 该推 } of 计划) {
    if (该收编) 应用收编(登记表.get(存储键), 合并后);
    if (该推) 推一键(存储键, 安全序列化(合并后));
  }
}

/** 调各讲的 收编 把合并结果落到内存态；期间压住 记脏（这是云来的写，不该回推）。 */
function 应用收编(项, 合并后) {
  if (!项) return;
  正在收编 = true;
  try {
    项.收编(合并后);
  } catch {
    // 某讲收编炸了不连累同步：它的内存态这次没更新，下次拉再来一遍
  } finally {
    正在收编 = false;
  }
}

/** 开一个合并窗口。已经有一个在排队就并进那一次，不重置计时（见 防抖毫秒 的注释）。 */
function 安排一次推() {
  if (防抖表 !== null) return;
  防抖表 = setTimeout(() => {
    防抖表 = null;
    冲一批();
  }, 防抖毫秒);
}

/** 把当前脏键各自读最新本地原文推上去。乐观清空脏集；窗口内又改的键会被 记脏 重新加回并重排一次。 */
function 冲一批() {
  if (!激活) return;
  const 键们 = [...脏键集];
  脏键集.clear();
  for (const 键 of 键们) {
    推一键(键, 读本地原文(键));
  }
}

/**
 * PUT 一个键的整包（fire-and-forget，永不抛）。
 * body 就是 localStorage 值的原样整包 JSON 字符串（后端不套 {payload}、忽略 content-type）。
 * 推失败（非 2xx / 断网 / 卡死）静默，把键重新标脏，留给下次改动或 pagehide 兜底再试 ——
 * 不自动重排定时器，免得后端持续挂掉时打出一串重试风暴。
 */
function 推一键(键, 原文) {
  if (原文 == null) return; // 没内容可推
  带超时取(键网址(键), { method: 'PUT', body: 原文, credentials: 'same-origin' }, 同步超时)
    .then((回) => {
      if (!回 || !回.ok) 脏键集.add(键);
    })
    .catch(() => {
      脏键集.add(键);
    });
}

function 键网址(键) {
  return `${进度端点}/${encodeURIComponent(键)}`;
}

/** 激活后挂一次：焦点回来→拉一轮；页面要走（pagehide / 转 hidden）→ sendBeacon 兜底把脏键推走。 */
function 挂页面监听() {
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') 拉合并一轮();
      else 兜底送脏();
    });
  }
  // pagehide 在移动端不总触发，visibilitychange→hidden 是更可靠的那一手，两个都挂。
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', 兜底送脏);
  }
}

/**
 * 页面即将卸载时，把还没推成的脏键用 sendBeacon 送出去 —— 普通 fetch 在卸载途中会被掐断，
 * sendBeacon 是浏览器保证发完的那条路。没有 sendBeacon 的环境退化成 keepalive fetch；
 * 再没有就认了这几颗星没上云（下次开机首拉会把它们并上来，不丢，只是晚一步）。
 */
function 兜底送脏() {
  if (!激活 || 脏键集.size === 0) return;

  const 能beacon = typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function';
  for (const 键 of [...脏键集]) {
    const 原文 = 读本地原文(键);
    if (原文 == null) continue;
    try {
      if (能beacon) {
        if (navigator.sendBeacon(键网址(键), 原文)) 脏键集.delete(键);
      } else {
        带超时取(键网址(键), { method: 'PUT', body: 原文, credentials: 'same-origin', keepalive: true }, 同步超时).catch(() => {});
      }
    } catch {
      // sendBeacon 偶尔抛（超尺寸等），认了 —— 卸载途中没有别的补救机会
    }
  }
}
