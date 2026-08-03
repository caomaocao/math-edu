// 看见 —— 全站的眼睛。
//
// 孩子把手里做好的东西举到摄像头前，倒数三二一拍一张，照片交给后端的视觉模型，
// 模型看着照片说一句**具体的夸奖**（「哇，你用了蓝色的纸！」）。
//
// 三条铁律，别的讲复用时也别破：
//   1. **只夸不判**。识别翻车顶多夸错颜色，绝不能说孩子做错了 ——
//      提示词里明写禁令，回来的话还要再过一遍 收拾夸奖()，两道闸门。
//   2. **不能有坏按钮**。没摄像头、权限被拒、后端没配 key，这三种情况下
//      调用方拿 能看见() 一问就知道，按钮干脆不出现，而不是点了没反应。
//   3. **界面上不出现句子**。屏幕上只有倒数的那个数字和两个图标，话一律 说() 出来。
//
// 纯逻辑（尺寸换算、倒数、提示词、收拾夸奖）在文件上半截，node --test 盖着；
// 下半截是摄像头和 DOM，浏览器里手工验。整个模块 import 进 node 不碰 document。

import { 带超时取 } from './取.js';

export const 视觉接口 = '/api/vision';

// 视觉请求的前端超时：GET 探测和 POST 识别共用。只兜「后端/nginx 挂死、一个字节都不回」
// 这种连 503/502 都发不出的沉默。比后端(票06)识别上限 20s 略长 —— 正常的「慢但能成」该由
// 后端自己回，不能被这儿提前 abort 误杀。到点抛错 → 各自现有的 catch 接住：探测判「接口不可用」
// →不挂相机钮；识别落回保底夸奖，孩子照样听见一句夸奖，绝不冷场。
const 视觉超时 = 24_000;

// ---------------------------------------------------------------------------
// 纯逻辑
// ---------------------------------------------------------------------------

/**
 * 照片按长边缩到 最大边。
 *
 * 摄像头随手就给 1920×1080，原样转 base64 是几百 KB，孩子举着盒子干等；
 * 长边 768 对「什么颜色、贴没贴歪」这种问题已经绰绰有余。本来就小的不放大。
 */
export function 缩放尺寸(源宽, 源高, 最大边 = 768) {
  const 宽 = Math.max(1, Math.round(Number(源宽) || 0));
  const 高 = Math.max(1, Math.round(Number(源高) || 0));
  const 长边 = Math.max(宽, 高);
  if (长边 <= 最大边) return { 宽, 高 };
  const 比 = 最大边 / 长边;
  return { 宽: Math.max(1, Math.round(宽 * 比)), 高: Math.max(1, Math.round(高 * 比)) };
}

/** canvas 吐出来的 `data:image/jpeg;base64,xxx` 拆成 mime 和纯 base64；裸串当 jpeg 收下 */
export function 拆出base64(dataURL) {
  if (typeof dataURL !== 'string' || !dataURL) return { mime: 'image/jpeg', 数据: '' };
  const 配 = /^data:([^;,]+);base64,(.*)$/s.exec(dataURL);
  if (!配) return { mime: 'image/jpeg', 数据: dataURL };
  return { mime: 配[1], 数据: 配[2] };
}

const 数字 = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

/** 倒数念出来的那几个字：3 → 三、二、一。孩子跟着一起数，这是这一下最好玩的地方 */
export function 倒数词(秒 = 3) {
  const n = Math.min(10, Math.floor(Number(秒) || 0));
  if (n <= 0) return [];
  return Array.from({ length: n }, (_, i) => 数字[n - i]);
}

const 默认场景 = '一个小朋友自己动手做出来的东西';

/**
 * 交给视觉模型的提示词。**只夸不判那道闸门就在这几句话里。**
 *
 * 禁令写得死一点：不许评对错、不许提问、不许说「不过」这种转折 ——
 * 5 岁孩子举着自己糊了半天的盒子，听见一个「不过」就全塌了。
 */
export function 夸奖提示词({ 场景 = 默认场景, 补充 = '' } = {}) {
  return [
    `照片里是${场景}。`,
    '请用一句话夸他，要具体：说出你看见的颜色、形状、贴纸、材料。',
    '要求：只夸，不评价对错好坏；',
    '不许出现「对」「不对」「错」「正确」「可惜」「不过」「但是」「应该」这类词；',
    '不许提问；不超过 20 个字；像小朋友的好朋友那样说话，热情一点。',
    '只输出这一句话本身，不要引号，不要解释。',
    补充,
  ]
    .filter(Boolean)
    .join('');
}

/** 模型再怎么翻车也不能说出口的词。撞上一个，整句作废 */
const 判对错的词 = [
  '不对', '错', '正确', '可惜', '不过', '但是', '虽然', '应该',
  '遗憾', '失败', '差点', '歪', '不太', '其实', '如果', '再接再厉',
];

/** 模型没话说、说错话时兜底的那几句。每一句自己都过得了上面那道闸门 */
export const 保底夸奖表 = Object.freeze([
  '你做得真棒！',
  '哇，太好看啦！',
  '我看见啦，真漂亮！',
  '你的手好巧呀！',
  '这个我喜欢！',
]);

const 最多几个字 = 40;

/**
 * 把模型回来的那句话收拾干净，再决定要不要放它出口。
 *
 * 顺序：去引号换行 → 空的换保底 → 撞上判对错的词换保底 → 只留第一句 → 硬砍 40 字。
 */
export function 收拾夸奖(文本, { 挑 = () => Math.floor(Math.random() * 保底夸奖表.length) } = {}) {
  const 保底 = () => 保底夸奖表[Math.max(0, Math.min(保底夸奖表.length - 1, 挑() | 0))];
  if (typeof 文本 !== 'string') return 保底();

  const 干净 = 文本
    .replace(/[“”"'‘’`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!干净) return 保底();
  if (判对错的词.some((词) => 干净.includes(词))) return 保底();

  const 第一句 = /^[^。！？.!?\n]*[。！？.!?]?/.exec(干净)?.[0]?.trim() || 干净;
  return 第一句.slice(0, 最多几个字);
}

// ---------------------------------------------------------------------------
// 环境探测 —— 「按钮该不该出现」全靠这几个
// ---------------------------------------------------------------------------

const 被拒记号 = 'shared:看见:被拒';

function 记下被拒() {
  try {
    sessionStorage.setItem(被拒记号, '1');
  } catch {
    /* 无痕模式存不下，无所谓：这一局内存里那个 boolean 还在 */
  }
}

let 这一局被拒过 = false;

/** 家里到底有没有摄像头 */
export async function 有摄像头(媒体 = globalThis.navigator?.mediaDevices) {
  if (!媒体?.getUserMedia) return false;
  if (!媒体.enumerateDevices) return true; // 问不出来，就当有，真开的时候再说
  try {
    const 一堆 = await 媒体.enumerateDevices();
    return 一堆.some((一个) => 一个.kind === 'videoinput');
  } catch {
    return false;
  }
}

/** 爸妈是不是已经点过「不允许」。点过就别再摆那个按钮了 */
export async function 摄像头被拒过() {
  if (这一局被拒过) return true;
  try {
    if (sessionStorage.getItem(被拒记号) === '1') return true;
  } catch {
    /* 读不着就往下走 */
  }
  try {
    const 状态 = await globalThis.navigator?.permissions?.query?.({ name: 'camera' });
    return 状态?.state === 'denied';
  } catch {
    return false; // Firefox 之流不认 'camera' 这个名字，问不出来不等于被拒
  }
}

/** 后端视觉接口在不在（没配 key 的话它自己回 503） */
export async function 视觉接口可用(接口 = 视觉接口, 取 = globalThis.fetch?.bind(globalThis)) {
  if (!取) return false;
  try {
    // 探测也套上超时：连不上是 catch（返回 false，钮不挂），可「连上却不回」从前会把这一句
    // 挂死，能看见() 的 await 永不返回，相机钮既不出现也不报错。注入的 取 原样当底层 fetch 传下去。
    const 回 = await 带超时取(接口, { method: 'GET' }, 视觉超时, 取);
    return 回.ok;
  } catch {
    return false;
  }
}

/**
 * 相机按钮该不该出现 —— 三条全过才 true。
 * 调用方就问这一句，然后决定「挂上按钮」还是「压根不挂」。
 */
export async function 能看见({ 接口 = 视觉接口, 媒体, 取 } = {}) {
  if (!(await 有摄像头(媒体))) return false;
  if (await 摄像头被拒过()) return false;
  return 视觉接口可用(接口, 取);
}

// ---------------------------------------------------------------------------
// 样式（自己注入，不进任何一张 styles.css）
// ---------------------------------------------------------------------------

const 看见样式 = `
.看见幕 {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  gap: 22px;
  grid-auto-rows: min-content;
  align-content: center;
  background: rgba(18, 22, 40, 0.78);
  backdrop-filter: blur(3px);
}

.看见幕[hidden] { display: none; }

.看见框 {
  position: relative;
  /*
    第三个上限是给横屏手机的：这块幕铺满整个屏幕、不在基准舞台里，所以量的是真像素。
    横着的 iPhone 只有 390 上下的可视高，而 620 宽配 4:3 要 465 —— 加上底下那排钮
    就超出去将近两百，被切掉的正是快门。孩子举着纸盒子，看得见自己却按不到快门。
    所以宽度也受「高度减去钮排」的约束，取三者最小；aspect-ratio 仍旧完整，不压扁画面。
    用 dvh 不用 vh：Safari 的 vh 算的是工具栏底下那块也归你。
  */
  width: min(72vw, 620px, calc((100dvh - 150px) * 4 / 3));
  aspect-ratio: 4 / 3;
  border-radius: 26px;
  overflow: hidden;
  background: #0d1120;
  box-shadow: 0 26px 60px rgba(0, 0, 0, 0.45);
}

.看见镜头,
.看见照片 {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  /* 镜子一样，孩子举着盒子往哪边挪跟看见的一致 */
  transform: scaleX(-1);
}

.看见镜头[hidden],
.看见照片[hidden] { display: none; }

.看见倒数 {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 160px;
  font-weight: 800;
  color: #ffffff;
  text-shadow: 0 6px 26px rgba(0, 0, 0, 0.5);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.12s ease;
}

.看见倒数.在数 { opacity: 1; animation: 看见蹦 0.5s ease; }

@keyframes 看见蹦 {
  0% { transform: scale(0.55); }
  55% { transform: scale(1.12); }
  100% { transform: scale(1); }
}

.看见闪 {
  position: absolute;
  inset: 0;
  background: #ffffff;
  opacity: 0;
  pointer-events: none;
}

.看见闪.闪 { animation: 看见闪一下 0.42s ease-out; }

@keyframes 看见闪一下 {
  0% { opacity: 0.95; }
  100% { opacity: 0; }
}

.看见钮排 { display: flex; gap: 26px; }

.看见钮 {
  width: 108px;
  height: 88px;
  padding: 0;
  border: 3px solid transparent;
  border-radius: 26px;
  background: linear-gradient(160deg, #ffffff 0%, #dde6ff 100%);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.3);
  font-size: 44px;
  line-height: 1;
  cursor: pointer;
  transition: transform 0.14s ease, border-color 0.18s ease;
}

/* 装饰性的 hover 关进 hover: hover：触屏上点完快门，那圈蓝边和放大会一直粘着不散，
   看着像快门还按着没放开。108×88 这个尺寸本身够手指按，不用外扩热区。 */
@media (hover: hover) {
  .看见钮:hover:not(:disabled) { transform: scale(1.06); border-color: #4c6fff; }
}
.看见钮:focus-visible { outline: 3px solid #ffffff; outline-offset: 4px; }
.看见钮:disabled { opacity: 0.45; cursor: default; }
.看见钮.关 { background: linear-gradient(160deg, #ffffff 0%, #ffe0e0 100%); }
`;

let 样式装好了 = false;
function 装上样式() {
  if (样式装好了 || typeof document === 'undefined') return;
  样式装好了 = true;
  const 标签 = document.createElement('style');
  标签.dataset.来自 = '看见';
  标签.textContent = 看见样式;
  document.head.appendChild(标签);
}

// ---------------------------------------------------------------------------
// 控制器
// ---------------------------------------------------------------------------

const 等 = (毫秒) => new Promise((好) => setTimeout(好, 毫秒));

/**
 * 搭一个「举给我看看」的取景幕。
 *
 * @param {{
 *   说?: (话: string) => void,
 *   音效?: { 点一下?: () => void, 星星?: () => void },
 *   接口?: string,
 *   场景?: string,        // 进提示词，让夸奖贴着这一讲（「小朋友做的正方体纸盒子」）
 *   开口白?: string,
 *   倒数?: number,
 *   倒数间隔?: number,
 *   最大边?: number,
 *   挂点?: HTMLElement,
 * }} [选项]
 */
export function 创建看见({
  说 = () => {},
  音效 = null,
  接口 = 视觉接口,
  场景 = 默认场景,
  开口白 = '把你做的东西举起来，让我看看！',
  倒数 = 3,
  倒数间隔 = 850,
  最大边 = 768,
  挂点,
} = {}) {
  if (typeof document === 'undefined') return null;
  装上样式();

  const 幕 = document.createElement('div');
  幕.className = '看见幕';
  幕.hidden = true;

  const 框 = document.createElement('div');
  框.className = '看见框';
  const 镜头 = document.createElement('video');
  镜头.className = '看见镜头';
  镜头.autoplay = true;
  镜头.muted = true;
  镜头.playsInline = true;
  镜头.setAttribute('playsinline', '');
  const 照片 = document.createElement('img');
  照片.className = '看见照片';
  照片.hidden = true;
  照片.alt = '';
  const 数着 = document.createElement('div');
  数着.className = '看见倒数';
  const 闪 = document.createElement('div');
  闪.className = '看见闪';
  框.append(镜头, 照片, 数着, 闪);

  const 钮排 = document.createElement('div');
  钮排.className = '看见钮排';
  const 快门 = document.createElement('button');
  快门.type = 'button';
  快门.className = '看见钮 快门';
  快门.setAttribute('aria-label', '拍一张');
  快门.textContent = '📸';
  const 关钮 = document.createElement('button');
  关钮.type = 'button';
  关钮.className = '看见钮 关';
  关钮.setAttribute('aria-label', '不看了');
  关钮.textContent = '✕';
  钮排.append(快门, 关钮);

  幕.append(框, 钮排);
  (挂点 ?? document.body).appendChild(幕);

  let 流 = null;
  let 忙着 = false;
  let 这一次 = 0; // 关掉之后迟到的定时器靠它认出自己已经过期

  function 停流() {
    流?.getTracks?.().forEach((轨) => 轨.stop());
    流 = null;
    镜头.srcObject = null;
  }

  /**
   * 打开摄像头。
   * @returns {Promise<{ok: boolean, 原因?: '拒绝'|'没摄像头'|'开不了'|'过期'}>}
   */
  async function 开() {
    if (流) return { ok: true };
    const 媒体 = globalThis.navigator?.mediaDevices;
    if (!媒体?.getUserMedia) return { ok: false, 原因: '没摄像头' };
    // 记下这一次是第几轮开机。授权对话框可能挂着好一会儿（等爸妈点「允许」），
    // 这中间孩子要是切走了别的玩法，关() 会把 这一次 +1 —— 等下 resolve 回来一比就知道自己过期了。
    const 这一轮 = 这一次;
    let 拿到的;
    try {
      拿到的 = await 媒体.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    } catch (错) {
      const 名 = 错?.name ?? '';
      if (名 === 'NotAllowedError' || 名 === 'SecurityError') {
        这一局被拒过 = true;
        记下被拒();
        return { ok: false, 原因: '拒绝' };
      }
      if (名 === 'NotFoundError' || 名 === 'OverconstrainedError') {
        return { ok: false, 原因: '没摄像头' };
      }
      return { ok: false, 原因: '开不了' };
    }
    // 授权还没回来孩子就切去了别的玩法：关() 早把幕收了、这一次 +1（那会儿 流 还是 null，
    // 停不了这条还没 resolve 的流）。现在流才姗姗 resolve —— 再揭幕就盖到新活动上、还平白开口。
    // 当场把刚拿到的流关掉，不揭幕、不说话。
    if (这一轮 !== 这一次) {
      拿到的.getTracks?.().forEach((轨) => 轨.stop());
      return { ok: false, 原因: '过期' };
    }
    流 = 拿到的;
    镜头.srcObject = 流;
    镜头.hidden = false;
    照片.hidden = true;
    照片.removeAttribute('src');
    数着.classList.remove('在数');
    数着.textContent = '';
    快门.disabled = false;
    幕.hidden = false;
    try {
      await 镜头.play();
    } catch {
      /* 有些浏览器 autoplay 已经放起来了，play() 反倒抛 AbortError */
    }
    if (开口白) 说(开口白);
    return { ok: true };
  }

  function 关() {
    这一次 += 1;
    忙着 = false;
    停流();
    幕.hidden = true;
    数着.classList.remove('在数');
    数着.textContent = '';
    快门.disabled = false;
  }

  /** 抓一帧，缩好，转成 dataURL */
  function 抓一帧() {
    const { 宽, 高 } = 缩放尺寸(镜头.videoWidth, 镜头.videoHeight, 最大边);
    const 布 = document.createElement('canvas');
    布.width = 宽;
    布.height = 高;
    const 笔 = 布.getContext('2d');
    // 镜头是镜像显示的，存下来的照片要翻回正的 —— 模型看的是真东西，不是镜子
    笔.translate(宽, 0);
    笔.scale(-1, 1);
    笔.drawImage(镜头, 0, 0, 宽, 高);
    return 布.toDataURL('image/jpeg', 0.85);
  }

  /** 照片交给后端，拿回一句夸奖（已经过 收拾夸奖） */
  async function 拿去看(dataURL, { 提示 } = {}) {
    const { 数据, mime } = 拆出base64(dataURL);
    try {
      const 回 = await 带超时取(接口, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: 数据,
          mime,
          prompt: 提示 ?? 夸奖提示词({ 场景 }),
        }),
      }, 视觉超时);
      if (!回.ok) return 收拾夸奖('');
      const 果 = await 回.json();
      return 收拾夸奖(果?.praise ?? '');
    } catch {
      // 断网、后端挂了 —— 孩子照样得听见一句夸奖，绝不能冷场
      return 收拾夸奖('');
    }
  }

  /**
   * 倒数 → 拍 → 交给模型 → 说出那句夸奖。
   * @returns {Promise<{ok: boolean, 图片?: string, 夸奖?: string}>}
   */
  async function 拍并夸({ 提示 } = {}) {
    if (忙着 || !流) return { ok: false };
    忙着 = true;
    快门.disabled = true;
    const 这一轮 = 这一次;
    const 过期 = () => 这一轮 !== 这一次;

    for (const 词 of 倒数词(倒数)) {
      if (过期()) return { ok: false };
      数着.textContent = 词;
      数着.classList.remove('在数');
      void 数着.offsetWidth; // 重放一次蹦跳动画
      数着.classList.add('在数');
      说(词);
      音效?.点一下?.();
      await 等(倒数间隔);
    }
    if (过期()) return { ok: false };

    数着.classList.remove('在数');
    数着.textContent = '';
    闪.classList.remove('闪');
    void 闪.offsetWidth;
    闪.classList.add('闪');
    音效?.星星?.();

    const 图片 = 抓一帧();
    照片.src = 图片;
    照片.hidden = false;
    镜头.hidden = true;
    停流(); // 拍完就关灯，摄像头指示灯别一直亮着

    const 夸奖 = await 拿去看(图片, { 提示 });
    if (过期()) return { ok: false };
    说(夸奖);
    忙着 = false;
    return { ok: true, 图片, 夸奖 };
  }

  快门.addEventListener('click', () => {
    拍并夸();
  });
  关钮.addEventListener('click', 关);
  幕.addEventListener('click', (事) => {
    if (事.target === 幕) 关(); // 点幕布的空白处也收
  });

  return {
    元素: 幕,
    快门,
    关钮,
    get 开着() {
      return !幕.hidden;
    },
    开,
    关,
    拍并夸,
    拿去看,
    dispose() {
      关();
      幕.remove();
    },
  };
}
