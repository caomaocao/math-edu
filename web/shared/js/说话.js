// 说话 —— 全站唯一的嘴巴。
//
// 正路：后端 /api/tts（龙杰力豆童声，磁盘缓存）。
// 备路：接口挂了/断网 → 浏览器 Web Speech API，孩子这一局照样玩得下去。
// 任何时刻只有一张嘴：新话开口，旧话闭嘴。
//
// 这张嘴说两种话。中文课英文课是同一门课的两张皮（见 语言.js），到了这儿的分工是：
//   · 说什么 —— 调用方按 `选()` 挑好了才递进来，这儿只管说；
//   · 用哪把嗓子 —— 后端按 `lang` 挑（默认那把龙杰力豆中英都会念，两语同一个方方）；
//   · 断网时 —— 系统嗓子得跟着换语种，不然英文课会听见一口中式英语。

import { 当前语言, 订阅语言 } from './语言.js';
import { 带超时取 } from './取.js';

// TTS 取音频的前端超时：只兜「后端/nginx 挂死、一个字节都不回」这种连 502 都发不出的沉默。
// 比后端(票06)合成上限 10s 略长 —— 正常的「慢但能成」（合成 9s）该由后端自己回，不能被这儿
// 提前 abort 误杀。到点抛错 → 说() 现有的 catch 接住 → 落回系统嗓子（降级中=true）。
const TTS超时 = 12_000;

const 音频池 = new Map(); // 语言|音色|文本 → objectURL（本页内存缓存，磁盘缓存在后端）
let 正在放 = null; // {音, 停}
let 降级中 = false;

/**
 * 孩子选的音色存在哪儿。
 *
 * 从前叫 `fangwei:音色` —— 那会儿只有第3讲，键就随手按那一讲起了名。可这个模块是
 * 全站唯一的嘴巴，第2讲一样在用它：孩子在试音页选好的声音，两讲听见的都得是同一个。
 * 名字不改的话，键在骗人（看着像第3讲私有的，实际全站共用），下一个人照着它的样子
 * 给第4讲又起一个 `xxx:音色`，就真的分家了。
 *
 * 旧键还在的就搬过来一次再删掉 —— 孩子不该因为我们改了个名字就得重选一遍声音。
 */
const 音色键 = '站点:音色';
const 旧音色键 = 'fangwei:音色';

// 搬家在模块装进来的这一刻做一次就够了。放进 音色() 的话，孩子每说一句话都要
// 白查一遍旧键，而且要等到第一次开口才搬 —— 那时候页面可能已经用旧值预热过一批 TTS 了。
try {
  const 旧的 = localStorage.getItem(旧音色键);
  if (旧的 !== null) {
    // 只在新键还空着时才搬：孩子改过新的就以新的为准，别让旧值盖回去
    if (localStorage.getItem(音色键) === null) localStorage.setItem(音色键, 旧的);
    localStorage.removeItem(旧音色键);
  }
} catch { /* 隐私模式 / 存储满了：搬不了就算了，下面自会退回默认嗓子 */ }

function 音色() {
  // 读不到就返回空串 —— 后端会用它默认的那把嗓子。绝不能因为存储出问题就说不出话
  try { return localStorage.getItem(音色键) || ''; } catch { return ''; }
}

/** 这一句发给后端的地址。语言只是「按哪种话挑默认嗓子」，音色给了就以音色为准。 */
function 网址(话, 语) {
  return `/api/tts?text=${encodeURIComponent(话)}`
    + `&voice=${encodeURIComponent(音色())}`
    + `&lang=${encodeURIComponent(语)}`;
}

async function 取音频(话, 语) {
  // 键里带上语言：默认两语同一把嗓子，可家长要是给英文单配了音色，
  // 同一串文本（"OK"、数字）在两种语言下就是两段不同的录音，不能互相冒名顶替。
  const 键 = `${语}|${音色()}|${话}`;
  if (音频池.has(键)) return 音频池.get(键);
  const 回 = await 带超时取(网址(话, 语), {}, TTS超时);
  if (!回.ok) throw new Error(`tts ${回.status}`);
  const url = URL.createObjectURL(await 回.blob());
  音频池.set(键, url);
  return url;
}

/**
 * 断网/接口挂了时的系统嗓子。
 *
 * 语种必须跟着课走：拿 `zh-CN` 去念 "Where is the north side?"，
 * 出来是一口中式英语拼读，孩子学的音就歪了 —— 宁可换成系统自带的英语嗓子，
 * 虽然不是童声，至少念的是英语。
 */
function 系统嗓子(话, 语) {
  return new Promise((好) => {
    // 这里是降级的最末端，后面再没有一张网了。部分精简 WebView 连 Web Speech 都没有，
    // `new SpeechSynthesisUtterance()` 会同步抛 ReferenceError，顺着 说() 的 await 把整条
    // 问答链点着。没有就认了这句没声，静静 resolve —— 绝不 reject 上抛。
    // （闭嘴() 里的 speechSynthesis.cancel() 早有 try/catch，唯独造句这行从前没守卫。）
    if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') {
      好();
      return;
    }
    const 稿 = new SpeechSynthesisUtterance(话);
    稿.lang = 语 === 'en' ? 'en-US' : 'zh-CN';
    稿.rate = 0.92;
    稿.pitch = 1.15;
    let 完 = false;
    const 收 = () => { if (!完) { 完 = true; 好(); } };
    稿.onend = 收;
    稿.onerror = 收;
    speechSynthesis.speak(稿);
    // Web Speech 偶尔既不 onend 也不 onerror；估个上限兜底，别卡住问答链。
    // 中文一个字约一拍，英文得按词数算 —— 一句英文的字符数是中文的四五倍，
    // 照字符算会把上限估到二十几秒，真掉进兜底时孩子就对着哑巴屏幕干等。
    const 拍数 = 语 === 'en' ? 话.trim().split(/\s+/).length * 3 : 话.length;
    setTimeout(收, Math.max(3000, 拍数 * 350));
  });
}

/**
 * 方方最后说的那句话。🔊 靠它「再听一遍」。
 *
 * 五岁孩子听漏一句是常事（他正忙着涂格子），而屏幕上一个字都没有 ——
 * 话说过就没了，他没有别的办法找回来。所以最后一句得留着。
 */
let 最后一句 = '';

/** 把刚才那句再说一遍。没说过话就什么也不做（🔊 这时候本来就不该露面） */
export function 再说一遍() {
  return 最后一句 ? 说(最后一句) : Promise.resolve();
}

/** 说过话没有 —— 调用方拿它决定要不要挂 🔊 */
export function 有话可重听() {
  return Boolean(最后一句);
}

export function 闭嘴() {
  if (正在放) { 正在放.停(); 正在放 = null; }
  try { speechSynthesis.cancel(); } catch { /* 没有也行 */ }
}

/** 说(话) → 播完才 resolve。被打断（别人开口）也 resolve，不悬着。 */
export async function 说(话) {
  话 = String(话 || '').trim();
  if (!话) return;
  const 语 = 当前语言();
  最后一句 = 话;
  闭嘴();
  if (!降级中) {
    try {
      const url = await 取音频(话, 语);
      await new Promise((好) => {
        const 音 = new Audio(url);
        let 完 = false;
        const 收 = () => { if (!完) { 完 = true; 好(); } };
        音.onended = 收;
        音.onerror = 收;
        正在放 = { 音, 停: () => { 音.pause(); 收(); } };
        音.play().catch(收);
      });
      return;
    } catch {
      降级中 = true; // 这一局都走系统嗓子，别每句话都白等一次网络
      setTimeout(() => { 降级中 = false; }, 60_000); // 一分钟后再给正路一次机会
    }
  }
  await 系统嗓子(话, 语);
}

// ── 预热 ──────────────────────────────────────────────────────────────────
//
// 「悄悄把接下来要说的话在后端备好」。孩子点进一个环节，第一句话得张口就来，
// 而现合成一句要一秒 —— 所以趁他还在看开场动画的时候，把台词一句一句灌进后端的
// 磁盘缓存里。只发不听，回来的 mp3 直接扔掉。

/** 已经递给后端备过的，别重复发 —— 后端有磁盘缓存，但一次往返也是往返 */
const 备过的 = new Set();

function 送一句(话, 语) {
  备过的.add(`${语}|${音色()}|${话}`);
  // 预热是只发不听：给它同一道超时，卡住的那句到点自己撒手，别攒着一条永不收场的请求；
  // 失败照旧静默（连音效都不出），不惊动正看开场动画的孩子。
  带超时取(网址(话, 语), {}, TTS超时).catch(() => {});
}

/**
 * 悄悄把这批话在后端备好（不出声），孩子点进环节就不用等。
 *
 * 递数组 = 就备这一批，按**当前**语言。递函数 = 备「这个函数按当前语言给出的那批」，
 * 并且**换语言时自动用新语言再备一遍** —— 中途切成英文的孩子，不该为此每句话都等一秒。
 *
 * @param {string[] | ((语: 'cn'|'en') => string[] | Promise<string[]>)} 话们或供话
 * @returns {(() => void) | undefined} 递函数时返回「不用再管我了」
 */
export function 备话(话们或供话) {
  if (typeof 话们或供话 === 'function') return 随语言备话(话们或供话);
  const 语 = 当前语言();
  for (const 话 of 话们或供话 ?? []) {
    if (话) 送一句(话, 语);
  }
  return undefined;
}

/** 一批发几句、隔多久发下一批 —— 和两讲台词表里的 `预热()` 同一套账，理由见那儿：
 * 后端一次只合成一句（上了锁），预热要是把队排满了，真要开口那一句就得在队尾等。 */
const 一批 = 1;
const 歇多久 = 700;

function 停一会(毫秒) {
  return new Promise((好) => setTimeout(好, 毫秒));
}

/** 换了几次语言。切走以后旧语言那趟补预热就该收摊，别跟新语言抢后端那把锁 */
let 语言代 = 0;

/** 谁要「换了语言也接着给我备着」。存的是取话的函数，不是话本身 —— 话是随语言变的 */
const 供话们 = new Set();

function 随语言备话(供话) {
  供话们.add(供话);
  慢慢备(供话, 当前语言(), 语言代);
  return () => 供话们.delete(供话);
}

/**
 * 一句一句地灌，永不抛错、永不挤占正要说的那句话。
 *
 * 「不挤占」有两道闸：批与批之间歇 700ms（后端那把锁一次只合成一句），
 * 以及嘴里正有话时就再等一轮 —— 孩子刚点了切换、方方正用新语言重读指令，
 * 那一句必须走在一百多句预热的前面。
 */
async function 慢慢备(供话, 语, 这代) {
  await 停一会(歇多久); // 让调用现场那句「当前指令」先开口
  let 话们;
  try {
    话们 = await 供话(语);
  } catch {
    return; // 取话的那头自己炸了，预热跟着算了 —— 大不了孩子多等一次合成
  }
  if (这代 !== 语言代) return; // 备到一半又切走了：这批已经没人要听了

  const 新的 = [];
  for (const 一句 of 话们 ?? []) {
    if (typeof 一句 !== 'string' || !一句.trim()) continue;
    if (备过的.has(`${语}|${音色()}|${一句}`)) continue;
    新的.push(一句);
  }

  for (let i = 0; i < 新的.length; i += 一批) {
    if (这代 !== 语言代) return;
    // 嘴里有话就让一让。让到底（几十秒还没停）就不让了 —— 万一有个音频卡在那儿
    // 没收场，预热不该从此再也不跑
    for (let 让 = 0; 正在放 && 让 < 40; 让 += 1) await 停一会(歇多久);
    if (这代 !== 语言代) return;
    for (const 一句 of 新的.slice(i, i + 一批)) 送一句(一句, 语);
    if (i + 一批 < 新的.length) await 停一会(歇多久);
  }
}

// 换语言这一下，这张嘴要做三件事。
// 排在最前面（本模块在任何面板之前被 import），所以顺序天然就是 spec 要的
// 「停当前语音 → 各面板重绘 → 用新语言重读指令」。
订阅语言((新语) => {
  语言代 += 1;
  // 1. 上一种语言那句话当场闭嘴：孩子按开关的那一刻就该听见课换了
  闭嘴();
  // 2. 忘掉「最后一句」。留着的话，孩子紧接着点 🔊 会拿英语嗓子念中文句子
  //    （断网时尤其难听）。反正调用方随即就用新语言重读当前指令，立刻又有得重听了
  最后一句 = '';
  // 3. 新语言那一百多句还一句没备过，趁孩子看重绘的这几秒开始灌
  for (const 供话 of [...供话们]) 慢慢备(供话, 新语, 语言代);
});
