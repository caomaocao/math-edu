import * as THREE from '/shared/vendor/three/three.module.js';

import { CELL_SIZE } from '../domain/net.js';
import { 对面色 } from '../domain/palette.js';
import {
  判数字,
  听出水果,
  居中摆,
  水果,
  水果名,
  水果词表,
  板列数,
  板行数,
  题库,
  题数,
} from '../data/fruitQuestions.js';
import { 台词, 模板 } from '../data/台词表.js';
import { 当前语言, 订阅语言, 选 } from '/shared/js/语言.js';
import { 画实体 } from '/shared/js/实体图.js';
import { 热词 } from '/shared/js/判对.js';
import { createScene } from '../render/scene.js';
import { FoldedNet } from '../render/foldedNet.js';
import { 画贴纸, 贴纸幅比, 造会补画的贴图 } from '../render/贴纸贴图.js';
import { 创建对面高亮 } from '../render/oppositeGlow.js';
import { 创建方方 } from '../render/fangfang.js';
import { 创建不复读的朗读 } from './nav.js';
import { 进度 as 默认进度 } from '../state/progress.js';
import { 说 as 默认朗读, 备话 } from '/shared/js/说话.js';
import { 借麦克风, 是被打断 } from '/shared/js/问答.js';
import { 音效 } from '/shared/js/音效.js';
import { 歇 } from '/shared/js/搭台.js';
import { 折纸声 } from '../audio/paperSound.js';

/**
 * 贴水果（对面关）—— 书里「对面」那三大块搬进网站。
 *
 * 摊平的衣服上有几格已经贴好了水果；孩子先挑一个水果（点它，或者对着麦克风说
 * 「苹果」），再点一个格子把它贴上去，任务是**给对面贴同一种水果**。
 * 贴齐了点那件小衣服，方方就当场穿上验证：贴对了，两个同款水果在方方身上碰头
 * ——正方体变半透明，那两个面一起发光，平面上对应的两格同时亮同一个颜色
 * （跟沙盒里「点面看对面」是同一套画面）；贴错了，它们折成了邻居，
 * 方方抖着说「它们见不着面呀」。
 *
 * 进阶两题玩数字（闯关三）：格子上印着数字，方方指着一格问「和它对面的是几？
 * 两个加起来是多少？」孩子喊出来，听不清就点底下的数字按钮。
 *
 * 三条规矩：
 *   · **对面一律现算**（data/fruitQuestions.js → domain/net.js 的折叠几何），
 *     这里一张答案表都不查。
 *   · **三次机会，绝不卡关**：错一次鼓励再试，错两次亮一对对面当线索，
 *     错三次直接贴给他看，然后照样往下走。
 *   · **屏幕上不出现句子**。唯一的例外是闯关三格子上印的数字 —— 那是这一讲要教的东西，
 *     也是书上的画法。别的一切由方方说出来。
 */

// ---------------------------------------------------------------------------
// 纯逻辑：走到第几题、贴够没有、贴对没有、几只兔兔
// ---------------------------------------------------------------------------

const 题号们 = 题库.map((一题) => 一题.号);

const 答过了 = (作答, 号) => typeof 作答?.[号] === 'boolean';

/**
 * 该做第几题：书上的次序里第一道还没答的。
 * 孩子玩到一半跑掉是常态，回来接着上次那道。
 * @returns {number|null} 全答完了是 null
 */
export function 第几题(作答 = {}) {
  const 下标 = 题号们.findIndex((号) => !答过了(作答, 号));
  return 下标 === -1 ? null : 下标;
}

/** 13 题全答过了没有（错了也算答过 —— 三次机会用完照样往下走，孩子不许被卡住） */
export function 都做完了(作答 = {}) {
  return 第几题(作答) === null;
}

/**
 * 一题贴到什么份上了。
 *
 * @param {object} 一题 贴水果题库里的一题
 * @param {Map<number, number>} 贴上的 孩子贴的：格子下标 → 水果槽位（书上先贴好的不算在内）
 * @returns {Array<{从:number, 贴到:number, 槽位:number, 贴了哪格:number|null, 对:boolean}>}
 */
export function 查贴的(一题, 贴上的 = new Map()) {
  return 一题.答案.map((一个) => {
    let 贴了哪格 = null;
    for (const [下标, 槽位] of 贴上的) {
      if (槽位 === 一个.槽位) 贴了哪格 = 下标;
    }
    return { ...一个, 贴了哪格, 对: 贴了哪格 === 一个.贴到 };
  });
}

/** 该贴的都贴上了吗（贴对贴错另说） */
export function 贴够了(一题, 贴上的 = new Map()) {
  return 查贴的(一题, 贴上的).every((一个) => 一个.贴了哪格 !== null);
}

/** 全贴对了吗 */
export function 判贴对了(一题, 贴上的 = new Map()) {
  const 查 = 查贴的(一题, 贴上的);
  return 查.length > 0 && 查.every((一个) => 一个.对);
}

/**
 * 13 只兔兔各自的状态。答错要跟没答分得开 ——
 * 都是灰的话，孩子看不出自己走到哪儿了。
 * @returns {Array<'对'|'错'|'没答'>}
 */
export function 兔兔队(作答 = {}) {
  return 题号们.map((号) => {
    if (!答过了(作答, 号)) return '没答';
    return 作答[号] ? '对' : '错';
  });
}

/** 点亮了几只兔兔 */
export function 答对几只(作答 = {}) {
  return 兔兔队(作答).filter((一只) => 一只 === '对').length;
}

/** 数字题的备选：正确答案 + 挨着的几个数（都落在 0–9 里），排好序 */
export function 凑四个数(答, 几个 = 4) {
  const 出 = [答];
  for (let d = 1; 出.length < 几个 && d <= 10; d += 1) {
    for (const 候选 of [答 - d, 答 + d]) {
      if (候选 >= 0 && 候选 <= 9 && !出.includes(候选) && 出.length < 几个) 出.push(候选);
    }
  }
  return 出.sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// 样式：本模块自己注入，不写进 styles.css
//
// 跟图鉴、判断关一个约定：功能自带的样式跟着功能的 JS 走。
// 起因是这几张票由不同的人并行做，styles.css 谁都改就必然互相覆盖。
// 一个字节都不从网上取，断网照样是这个样子。
// ---------------------------------------------------------------------------

const 样式 = `
/*
  **本讲最高的一屏，基准舞台那 740px 就是从这儿量出来的**（另一处是导航的 640）：
    20 上 + 兔兔 38 + 14 + 贴纸板 411 + 14 + 水果盘 92 + 116 下（给坞让位）= 705
  这一屏跟判断关不同，**压不动**：板子和水果盘都是触靶，缩下去就按不着了，
  所以它才是那笔账的下限。740 给它留 35px 的余地。

  尺寸一律定死的舞台像素，不再写 vh / vw：窗口单位量的是窗口，手机横屏上每个
  clamp() 都会压到下限，整屏东西先小一圈、再被舞台缩一次（docs/adr/0004；
  触靶下限的推导在 styles.css 文件头）。换上的数就是它们在 1280 × 740 上本来的值。

  底下那 116：坞自己离屏幕底边 18、身高 96，加起来 114，取 116 刚好不压着水果盘。
*/
.贴水果 {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 14px;
  height: 100%;
  padding: 20px 32px 116px;
  box-sizing: border-box;
}

/* --- 兔兔排：走到哪儿了，一眼看见 --------------------------------------- */

.兔兔排 { display: flex; justify-content: center; gap: 10px; }

/* 定死 38px（原来跟着窗口宽伸缩）：兔兔不是触靶（点不着也不用点），但它是
   「我走到哪儿了」唯一的读法，缩成一排小灰点孩子就读不出来了。
   十三只 × 38 + 十二道 10px 的缝 = 614，排得开。 */
.一只兔 {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 25px;
  line-height: 1;
  border-radius: 50%;
  transition: transform 0.25s ease, filter 0.25s ease, opacity 0.25s ease;
}

.一只兔.没答 { filter: grayscale(1); opacity: 0.26; }
.一只兔.错   { filter: grayscale(0.75); opacity: 0.48; }
.一只兔.对   { filter: none; opacity: 1; }
.一只兔.刚点亮 { animation: 兔兔蹦 0.6s ease; }

@keyframes 兔兔蹦 {
  0%   { transform: scale(1); }
  35%  { transform: scale(1.75) rotate(-9deg); }
  100% { transform: scale(1); }
}

/* --- 中间：左边贴纸板，右边舞台 ----------------------------------------- */

.贴台 {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: 26px;
  min-height: 0;
}

.贴纸板 {
  display: grid;
  grid-template-columns: repeat(var(--板列数), 1fr);
  gap: 5px;
  aspect-ratio: var(--板列数) / var(--板行数);
  /*
    411px 是从触靶下限倒推的，一格一格都得按得准：
      4 格 × 92 + 3 道 5px 的缝 + 2 × 14 内边距 = 411  → 一格正好 92（44.5pt）
    四列是题库里最宽的那张衣服说了算的（fruitQuestions 的 板列数），不是写死的。
    从前是 46vh —— 整讲上了基准舞台之后 vh 量的还是窗口，手机横屏上会缩到 179px、
    一格 40px，手指按不着；而基准舞台的几何本来就该是定死的舞台像素。
    这一处也是「只能真放大」的：格子挨着格子，热区四面一起扩就扩到邻格身上 ——
    贴错一格，孩子还得先看出自己贴错了。
    max-height 是那道保险：万一舞台比 740 矮，板子连同格子一起等比缩小，
    而不是把底下那排水果钮压出画面。
  */
  width: min(100%, 411px);
  max-height: 100%;
  margin: 0 auto;
  padding: 14px;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.72);
  border-radius: 26px;
  box-shadow: 0 10px 30px rgba(43, 51, 82, 0.1);
}

/* 空格位连虚线框都不画：书上就是白纸上摆着几个方块，别给孩子多余的东西看 */
.贴格 {
  position: relative;
  border: none;
  padding: 0;
  background: transparent;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  cursor: default;
  transition: transform 0.14s ease, box-shadow 0.18s ease;
}

/* 衣服上的格子：一张浅浅的纸 */
.贴格.有 {
  background: #fdf8ec;
  border: 2px solid rgba(255, 255, 255, 0.75);
  box-shadow:
    inset 0 0 0 3px rgba(255, 255, 255, 0.7),
    0 4px 10px rgba(43, 51, 82, 0.16);
}

/* 能往上贴东西的格子：手感要像个按钮 */
.贴水果.可贴 .贴格.有.空着 { cursor: pointer; }
.贴水果.可贴 .贴格.孩子贴的 { cursor: pointer; }

/* 装饰性 hover 只给鼠标：触屏上点过的格子会粘着放大不放（docs/adr/0004） */
@media (hover: hover) {
  .贴水果.可贴 .贴格.有.空着:hover {
    transform: scale(1.06);
    box-shadow: 0 0 0 4px rgba(76, 111, 255, 0.35), 0 6px 14px rgba(43, 51, 82, 0.2);
  }
  .贴水果.可贴 .贴格.孩子贴的:hover { transform: scale(1.04); }
}
.贴格:focus-visible { outline: 3px solid var(--高亮, #4c6fff); outline-offset: 3px; }

/* 贴上去的水果：一张圆角小贴纸 */
.水果贴纸 {
  position: absolute;
  inset: 8%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  border-radius: 22%;
  box-shadow: 0 3px 8px rgba(43, 51, 82, 0.28);
  animation: 贴上去 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes 贴上去 {
  0%   { transform: scale(1.9) rotate(-14deg); opacity: 0; }
  100% { transform: scale(1) rotate(0); opacity: 1; }
}

/* 闯关三：格子上印着数字。这是这一关屏幕上唯一允许出现的字符 */
.贴格 .数字 {
  font-weight: 800;
  font-size: 52px;
  color: var(--墨色, #2b3352);
}

/* 方方正指着问的那一格 */
.贴格.在问::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: inherit;
  border: 4px solid #ffd54a;
  animation: 问着闪 1.2s ease-in-out infinite;
  pointer-events: none;
}

@keyframes 问着闪 {
  0%, 100% { opacity: 0.35; transform: scale(1); }
  50%      { opacity: 1; transform: scale(1.06); }
}

/* 线索：平面上这两格和三维上那两个面同时亮同一个颜色 */
.贴格.线索::before {
  content: '';
  position: absolute;
  inset: -5px;
  border-radius: inherit;
  border: 5px solid var(--线索色, #22e3ff);
  box-shadow: 0 0 16px var(--线索色, #22e3ff);
  animation: 线索呼吸 1.5s ease-in-out infinite;
  pointer-events: none;
}

@keyframes 线索呼吸 {
  0%, 100% { opacity: 0.55; }
  50%      { opacity: 1; }
}

.贴水果舞台 { position: relative; width: 100%; height: 100%; min-height: 0; }
.贴水果舞台 canvas { display: block; width: 100%; height: 100%; }

/* --- 底下：水果盘 + 几个大键 -------------------------------------------- */

.水果盘 {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 26px;
  min-height: 92px; /* = 水果钮的高。这一行的高进了 705 那笔账（见 .贴水果） */
}

/*
  水果盘里的水果、试穿键、下一题键 —— 这一关孩子要按的全在这一行，
  所以定死在触靶红线上（≥80 基准 px，docs/adr/0004）。
  原来的 clamp(54px, 8.4vh, 88px) 在手机横屏上会掉到 54px 的下限，
  再被基准舞台缩一次只剩 26pt；vh 量的是窗口，跟舞台的固定坐标系本来就不是一回事。
  92px 落到玻璃上 44.5pt（推导见 styles.css 文件头）。
*/
.水果钮, .贴键 {
  width: 92px;
  height: 92px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 4px solid transparent;
  border-radius: 50%;
  background: #fff;
  font-size: 46px; /* 跟着钮一起定死，不然 92px 的圆里浮着一个小水果 */
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(43, 51, 82, 0.16);
  transition: transform 0.14s ease, box-shadow 0.14s ease, opacity 0.2s ease;
}

/* 装饰性 hover 只给鼠标（docs/adr/0004）：「在手上」那一档是状态，不在这里面 */
@media (hover: hover) {
  .水果钮:hover, .贴键:hover { transform: scale(1.09); box-shadow: 0 12px 26px rgba(43, 51, 82, 0.22); }
}
.水果钮:active, .贴键:active { transform: scale(0.96); }
.水果钮:focus-visible, .贴键:focus-visible { outline: 3px solid var(--高亮, #4f6ef7); outline-offset: 4px; }

/* 拿在手上的那个水果：托起来、一圈光，孩子知道现在贴的是它 */
.水果钮.在手上 {
  transform: scale(1.16) translateY(-6px);
  border-color: #ffd54a;
  box-shadow: 0 0 0 6px rgba(255, 213, 74, 0.35), 0 14px 28px rgba(43, 51, 82, 0.26);
}

/* 已经贴出去了：淡下去，但留在原地 —— 位置一变孩子就得重新找 */
.水果钮.用掉了 { opacity: 0.26; cursor: default; box-shadow: none; }
@media (hover: hover) {
  .水果钮.用掉了:hover { transform: none; }
}

.贴键.试穿 { background: linear-gradient(160deg, #d9f7e6, #a9ecc6); }
.贴键.下一题 { background: linear-gradient(160deg, #dfe6ff, #b9c8ff); }
.贴键.重玩 { background: linear-gradient(160deg, #fff0d4, #ffe0a8); }
.贴键.数键 {
  width: auto;
  min-width: 92px; /* 同上：定死在触靶下限那一档，不再跟着窗口高度伸缩 */
  padding: 0 18px;
  border-radius: 30px;
  font-weight: 800;
  background: linear-gradient(160deg, #f2f5ff, #dbe3ff);
  color: var(--墨色, #2b3352);
}
.贴键[hidden], .水果钮[hidden] { display: none; }

/* --- 十三题全做完 ------------------------------------------------------- */

.贴水果收尾 {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  /* 这一幕盖在面板里（舞台之内），所以也是定死的舞台像素 —— 写 vh 的话，
     手机上奖杯会缩到 56px 再被舞台缩一次，收尾这一下的份量就没了 */
  gap: 24px;
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.96), rgba(230, 238, 255, 0.98));
  border-radius: 30px;
  z-index: 5;
}

.贴水果奖杯 {
  font-size: 128px;
  line-height: 1;
  animation: 贴水果奖杯蹦 1.1s ease infinite;
}

.贴水果收尾兔 {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 9px;
  max-width: 80%;
}

@keyframes 贴水果奖杯蹦 {
  0%, 100% { transform: translateY(0) rotate(-4deg); }
  50%      { transform: translateY(-11px) rotate(4deg); }
}

@media (prefers-reduced-motion: reduce) {
  .一只兔.刚点亮,
  .水果贴纸,
  .贴格.在问::after,
  .贴格.线索::before,
  .贴水果奖杯 { animation: none; }
}
`;

let 样式挂了 = false;
function 挂样式() {
  if (样式挂了 || typeof document === 'undefined') return;
  样式挂了 = true;
  const 标签 = document.createElement('style');
  标签.dataset.来自 = '贴水果';
  标签.textContent = 样式;
  document.head.appendChild(标签);
}

// ---------------------------------------------------------------------------
// 格子贴图：白纸、水果、数字
// ---------------------------------------------------------------------------

const 纸色 = '#FDF8EC';
const 字色 = '#2B3352';

/** 一张贴图画一次就够，几道题反复用（材质不共用，见 摆好衣服 里的说明） */
const 贴图池 = new Map();

/**
 * 一张格子贴图长什么样。三种，`这一格长什么样()` 出的就是它：
 *   {色}            没贴东西的白纸
 *   {色, 数}        印着数字的格子（闯关三）
 *   {色, 名, 兜底}  贴着水果的格子（名 = 判对的规范名，兜底 = 缺图时的绘文字）
 * @typedef {{色: string, 数?: number, 名?: string, 兜底?: string}} 格样
 */

/**
 * 把一个格子画到画布上。
 *
 * 水果那一笔跟 render/cellTexture.js 画到方块上的是同一张贴纸、走同一套素材加载
 * （`贴纸贴图.js`：三态、等着的重画、缺图回落绘文字）—— 同一屏上孩子手里贴的
 * 和方方身上穿的必须长得一样。
 *
 * 这儿比那边多两种格子：**没贴东西的白纸**和**印着数字的格子**。
 * 数字得是深色的 —— 那边画字用的是白色（绘文字自带颜色所以看得见），
 * 数字照那么画等于没画。
 *
 * @param {格样} 样
 * @returns {boolean} 画齐了没有 —— false = 还等着素材，回头得重画一遍
 */
function 画一格(笔, 边, 样) {
  笔.clearRect(0, 0, 边, 边);
  笔.fillStyle = 样.色;
  笔.fillRect(0, 0, 边, 边);
  // 往里缩一圈的白边，让相邻的格子看得出分界，但纸本身还是连着的
  笔.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  笔.lineWidth = 边 * 0.045;
  const 缩 = 边 * 0.055;
  笔.strokeRect(缩, 缩, 边 - 缩 * 2, 边 - 缩 * 2);

  const 写个字 = (字, 颜色) => {
    笔.fillStyle = 颜色;
    笔.font = `800 ${边 * 0.52}px "Apple Color Emoji", "Segoe UI Emoji", system-ui, sans-serif`;
    笔.textAlign = 'center';
    笔.textBaseline = 'middle';
    笔.fillText(字, 边 / 2, 边 / 2 + 边 * 0.02);
  };

  // 闯关三：印着数字的格子。深色的字，画法一个像素都没变
  if (样.数 !== undefined) {
    写个字(String(样.数), 字色);
    return true;
  }

  // 没贴东西的白纸：纯色 + 白边，就这样
  if (!样.名) return true;

  const 态 = 画贴纸(笔, 样.名, { 边, 幅: 边 * 贴纸幅比 });
  if (态 === '好了') return true;
  // 还在路上：这一格先是纯色 + 白边，绝不空着 —— 孩子贴下去的那一刻就得看见东西
  if (态 === '等着') return false;
  // 素材压根没有：照老样子写个绘文字，这一局照玩
  写个字(样.兜底, '#ffffff');
  return true;
}

/**
 * 一个格子的贴图（画一次就够，几道题反复用）。
 * @param {格样} 样
 */
function 取贴图(样) {
  const 键 = `${样.色}|${样.数 ?? ''}|${样.名 ?? ''}`;
  if (贴图池.has(键)) return 贴图池.get(键);
  const 贴图 = 造会补画的贴图((笔, 边) => 画一格(笔, 边, 样));
  贴图池.set(键, 贴图);
  return 贴图;
}

// ---------------------------------------------------------------------------
// 界面
// ---------------------------------------------------------------------------

/** 折给孩子看要花多久。太快看不清折痕是怎么转的，太慢他会跑掉 */
const 折叠时长 = 1900;
/** 一对对面亮多久，然后轮到下一对 */
const 一对亮多久 = 1500;
/** 导航念完玩法名字要这么久。抢在前面说，孩子听见的是被掐断的半句 */
const 等名字念完 = 1700;
/** 每题开局的机位方向：摊平的衣服要从斜上方看才看得出形状 */
const 开局机位 = new THREE.Vector3(0, 4.6, 6.4).normalize();
/** 脸从那一片表面浮出来多少（格）—— 跟沙盒同一个数 */
const 浮出表面 = 0.14;
/** 朝天／朝地的那一片挑脸时要扣的分（同沙盒：镜头是俯视的，不扣脸会爬到盖子上） */
const 朝天要扣的分 = 0.35;

/**
 * 方方在这一关说的话。句子住在 data/台词表.js（全站一份，开场时统一预热进
 * TTS 磁盘缓存），这儿只挑不写；进场时再叫一次 `备话()` 是个保险 ——
 * 孩子要是抢在预热铺到这一关之前就切了过来，这一下把它们插到队伍最前面。
 */
const 话 = () => 台词().贴水果;
/** 这一关要备进 TTS 磁盘缓存的每一句（按语取） */
const 本关台词 = (语 = 当前语言()) => Object.values(台词(语).贴水果);

/**
 * 这一关的小助手：一题一只兔子，用的是全站那一张兔子素材
 * （第 3 讲里那只也是它，孩子在哪一关看见的都是同一只）。
 * 尺寸交给 `.实体图` 的 1em —— 1em 就是原先那个绘文字的字号盒，位置一点不挪。
 */
const 画一只兔 = () => 画实体('兔子', '🐰', { 类名: '实体图' });

/**
 * 水果盘上那三个钮、和贴进格子里的那张贴纸，画的都是它 ——
 * 跟三维那件衣服上的、跟第 3 讲货架上的是同一张贴纸风素材。
 *
 * 尺寸同样交给 `.实体图` 的 1em：1em 就是原先那个绘文字的字号盒
 * （水果钮 46px、水果贴纸 40px 的字号盒），
 * 换图前后每一个都落在原来的像素上。缺图时回落成绘文字，孩子这一局照玩。
 */
const 画一个水果 = (槽位) => 画实体(水果(槽位).名.cn, 水果(槽位).图, { 类名: '实体图' });

/**
 * 闯关三送给 ASR 的热词。**两语一起喂** —— 判定那头（`判数字` → `抽数字`）
 * 本来就中英文数字通吃，识别这一关不该先把另一语掐死。
 */
const 数字热词 = () =>
  [
    '零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '几',
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'how many',
  ].join('、');

/**
 * @param {HTMLElement|null} 容器 导航给的那块面板（`#面板-对面关`）
 * @param {{进度?: object, 说?: (文本: string) => Promise<void>|void}} [依赖]
 */
export function 创建贴水果(容器, { 进度 = 默认进度, 说 = 默认朗读 } = {}) {
  if (!容器) return null;
  挂样式();

  容器.classList.add('贴水果');
  容器.innerHTML = '';

  const 念一下 = 创建不复读的朗读(说); // 鼠标扫过水果时别复读

  // --- 搭界面 ---------------------------------------------------------------

  const 兔兔排 = document.createElement('div');
  兔兔排.className = '兔兔排';
  兔兔排.setAttribute('role', 'status'); // 屏幕上一个字都没有，读屏得说得出走到哪儿了
  const 兔们 = 题库.map(() => {
    const 一只 = document.createElement('span');
    一只.className = '一只兔';
    一只.setAttribute('aria-hidden', 'true');
    一只.appendChild(画一只兔());
    兔兔排.appendChild(一只);
    return 一只;
  });

  const 贴台 = document.createElement('div');
  贴台.className = '贴台';

  const 贴纸板 = document.createElement('div');
  贴纸板.className = '贴纸板';
  贴纸板.style.setProperty('--板列数', 板列数);
  贴纸板.style.setProperty('--板行数', 板行数);
  /** 板上 4×4 个格位，换题时不重建 —— 板子不跳，孩子的眼睛不用重新找 */
  const 格位们 = [];
  for (let i = 0; i < 板行数 * 板列数; i += 1) {
    const 格 = document.createElement('button');
    格.type = 'button';
    格.className = '贴格';
    格.tabIndex = -1;
    格.setAttribute('aria-hidden', 'true');
    格.addEventListener('click', () => 点了格位(i));
    贴纸板.appendChild(格);
    格位们.push(格);
  }

  const 舞台位 = document.createElement('div');
  舞台位.className = '贴水果舞台';
  贴台.append(贴纸板, 舞台位);

  const 水果盘 = document.createElement('div');
  水果盘.className = '水果盘';

  /** 按钮上只有图标，字只给读屏和自动化验收 —— 换语言时统一重挂一遍 */
  const 键名们 = new Map();
  const 造键 = (样式名, 图标, 名字) => {
    const 按 = document.createElement('button');
    按.type = 'button';
    按.className = `贴键 ${样式名}`;
    按.setAttribute('aria-label', 选(名字)); // 按钮上只有图标，字只给读屏
    键名们.set(按, 名字);
    const 图 = document.createElement('span');
    图.setAttribute('aria-hidden', 'true');
    图.textContent = 图标;
    按.appendChild(图);
    return 按;
  };

  /** 水果盘上最多摆三个水果（一题最多三对） */
  const 水果钮们 = [0, 1, 2].map(() => {
    const 按 = document.createElement('button');
    按.type = 'button';
    按.className = '水果钮';
    按.hidden = true;
    水果盘.appendChild(按);
    return 按;
  });

  /** 数字题的鼠标兜底：四个数字键，跟嘴巴说的走同一条判定 */
  const 数键们 = [0, 1, 2, 3].map(() => {
    const 按 = 造键('数键', '', { cn: '数字', en: 'Number' });
    按.hidden = true;
    水果盘.appendChild(按);
    return 按;
  });

  const 试穿键 = 造键('试穿', '👕', { cn: '穿上看看', en: 'Put it on' });
  const 下一题键 = 造键('下一题', '➡️', { cn: '下一题', en: 'Next one' });
  const 重玩键 = 造键('重玩', '🔄', { cn: '再玩一次', en: 'Play again' });
  水果盘.append(试穿键, 下一题键, 重玩键);

  容器.append(兔兔排, 贴台, 水果盘);

  // --- 舞台：第一次进这个玩法才建，孩子不来就一分钱不花 ----------------------

  /** @type {ReturnType<typeof createScene>|null} */
  let 舞台 = null;
  /** @type {FoldedNet|null} */
  let 衣服 = null;
  let 对面高亮 = null;
  let 方方 = null;
  let 衣架 = null;
  /** 这一题六个格子各自的材质，按格子下标存 —— 换题时收掉（贴图是共用的，不收） */
  let 材质们 = [];
  let 上一帧 = 0;

  function 备好舞台() {
    if (舞台) return 舞台;
    舞台 = createScene(舞台位);
    衣架 = new THREE.Group();
    衣架.name = '衣架';
    舞台.scene.add(衣架);
    /*
      方方就是被折的这只正方体本身（跟沙盒同一个设定）。情绪动的是衣架，
      折叠引擎动的是衣架里那件衣服 —— 挤在同一个 Object3D 上，
      后写的那个会把先写的抹掉。
    */
    方方 = 创建方方(舞台.scene, 衣架);
    上一帧 = performance.now();
    舞台.onFrame(() => {
      const 此刻 = performance.now();
      const 秒 = Math.min(0.1, (此刻 - 上一帧) / 1000);
      上一帧 = 此刻;
      对面高亮?.更新(此刻 / 1000);
      方方?.更新(秒, 方方站哪儿());
    });
    return 舞台;
  }

  const 方方站位 = new THREE.Vector3();
  const 这一片的位置 = new THREE.Vector3();
  const 这一片的朝向 = new THREE.Vector3();
  const 选中的朝向 = new THREE.Vector3();
  const 朝镜头 = new THREE.Vector3();
  const 身子中心 = new THREE.Vector3();
  const 向上 = new THREE.Vector3(0, 1, 0);

  /**
   * 方方的脸这一帧摆在哪儿（世界坐标）；null = 这一帧别露脸。
   *
   * 跟沙盒同一条规矩：**只在纸停稳的两个时候露脸 —— 摊平躺着，和穿好了**，
   * 折到半路一律收起来。半路上六片纸全是斜的，脸摆到哪一片上都是贴在一片刀刃上
   * （沙盒 main.js 的 方方站哪儿 里记着这条弯路，别再踩一遍）。
   *
   * 这儿是那段的一份小抄：沙盒那份没有导出，而按票 04 的分工我不动 main.js。
   */
  function 方方站哪儿() {
    if (!衣服 || !舞台) return null;

    // 摊平躺着：钉在根格子上。脸不会随着孩子转镜头在格子间跳来跳去
    if (衣服.fold <= 0.002) {
      const 根 = 衣服.cellGroups[衣服.tree.root];
      if (!根) return null;
      根.getWorldPosition(方方站位);
      return 方方站位.addScaledVector(向上, CELL_SIZE * 浮出表面);
    }
    if (衣服.fold < 0.998) return null; // 正折着，收脸

    衣服.boundingBox().getCenter(身子中心);
    朝镜头.subVectors(舞台.camera.position, 身子中心);
    if (朝镜头.lengthSq() < 1e-12) return null;
    朝镜头.normalize();

    let 最正的分 = -Infinity;
    let 挑中了 = false;
    for (const 片 of 衣服.cellGroups) {
      if (!片) continue;
      片.getWorldPosition(这一片的位置);
      /*
        「朝外」用的是「从身子中心指向这一片」，不是那张纸的法线：
        纸有正反两面，背面那一片的法线常常正好朝着镜头，用法线算脸会被塞进肚子里。
      */
      这一片的朝向.subVectors(这一片的位置, 身子中心);
      if (这一片的朝向.lengthSq() < 1e-9) 这一片的朝向.copy(向上);
      else 这一片的朝向.normalize();
      const 分 = 这一片的朝向.dot(朝镜头) - Math.abs(这一片的朝向.y) * 朝天要扣的分;
      if (分 <= 最正的分) continue;
      最正的分 = 分;
      挑中了 = true;
      方方站位.copy(这一片的位置);
      选中的朝向.copy(这一片的朝向);
    }
    if (!挑中了) return null;
    return 方方站位.addScaledVector(选中的朝向, CELL_SIZE * 浮出表面);
  }

  function 看得全() {
    if (!舞台 || !衣服) return;
    // 比 boundingBox 再放宽一圈：这块面板比沙盒窄，正方体卡满画面时发光的边会被切掉
    const 盒 = 衣服.boundingBox().clone();
    盒.expandByScalar(0.3);
    舞台.框住(盒);
  }

  function 收掉衣服() {
    对面高亮?.dispose();
    对面高亮 = null;
    if (衣服 && 舞台) 舞台.scene.remove(衣服.object3D);
    衣服?.dispose();
    衣服 = null;
    for (const 材质 of 材质们) 材质?.dispose(); // 贴图是共用的（贴图池），不跟着收
    材质们 = [];
    方方?.换身子(false);
  }

  /** 换一张衣服上台，摊平躺着等孩子贴 */
  function 摆好衣服() {
    if (!这一题) return;
    const 台 = 备好舞台();
    收掉衣服();

    材质们 = new Array(这一题.格子.length).fill(null);
    衣服 = new FoldedNet(这一题.格子, {
      /*
        六个格子**各造一份材质**，哪怕两格长得一模一样（两张白纸）。
        共用一份的话，「对面高亮」把这一对调亮、其余四片调暗时改的是同一个对象，
        最后一次写入赢 —— 六个面一样亮，孩子什么也看不出来。
      */
      makeCellMaterial: (下标) => {
        const 材质 = new THREE.MeshBasicMaterial({
          map: 取贴图(这一格长什么样(下标)),
          side: THREE.DoubleSide,
          toneMapped: false,
        });
        材质们[下标] = 材质;
        return 材质;
      },
    });
    衣架.add(衣服.object3D);
    对面高亮 = 创建对面高亮(衣服);
    衣服.setFold(0);
    方方?.换身子(true);
    看得全();
    台.转镜头到(开局机位, 0.45); // 把上一题「对面高亮」时孩子转过的角度转回来
  }

  /**
   * 贴纸变了：只换那几张贴图，不重建整件衣服。
   * 重建的话方方的脸每贴一下就要淡出淡入一次，看着像画面在闪。
   */
  function 刷新贴图() {
    if (!衣服) return;
    材质们.forEach((材质, 下标) => {
      if (!材质) return;
      材质.map = 取贴图(这一格长什么样(下标));
      材质.needsUpdate = true;
    });
  }

  /**
   * 一格在三维上长什么样（见上面的「格样」）。
   *
   * 水果那一格交出去的是**规范名**（`名.cn`，跟调色板和判对词表是同一个键），
   * 不是那个绘文字 —— 绘文字只当缺图时的兜底。别拿它当键（CLAUDE.md 实体图那节）。
   */
  function 这一格长什么样(下标) {
    if (这一题?.种类 === '数字') return { 色: 纸色, 数: 这一题.数字[下标] };
    const 槽位 = 贴了什么(下标);
    if (槽位 === null) return { 色: 纸色 };
    return { 色: 水果(槽位).色, 名: 水果(槽位).名.cn, 兜底: 水果(槽位).图 };
  }

  // --- 状态 -----------------------------------------------------------------

  /** @type {'贴'|'试穿'|'看'|'问'|'完'} */
  let 状态 = '贴';
  let 这一题 = null;
  /** 孩子这一题贴上去的：格子下标 → 水果槽位（书上先贴好的不在里面） */
  let 贴上的 = new Map();
  /** 手上拿着的水果槽位 */
  let 在手上 = null;
  let 错了几次 = 0;
  /** 换一题就加一。异步的那几出戏拿它当身份牌：号变了就别接着演 */
  let 这一局 = 0;
  /** 折叠动画各自的号，旧的那段看见号变了就自己停下 */
  let 动画请求 = 0;
  let 进场定时 = 0;
  let 庆祝层 = null;
  let 在前 = false;
  /** dispose 过了 —— 听水果那个循环靠它收摊 */
  let 没了 = false;
  /** 台词备进 TTS 缓存了没有（备一次就够） */
  let 备过话 = false;
  /** 正等着孩子说话的那一次听：换题、离场、点了数字键都把它叫醒 */
  let 打断听 = null;
  /** @type {ReturnType<typeof 借麦克风>|null} 借来的那只坞。离场还回去 */
  let 麦 = null;
  /** 同一时刻只许有一次听 —— 两处同时抢麦钮的 onclick，谁也别想收到孩子的话 */
  let 听着 = false;
  /** 数字题那条问答链在不在跑（别开出两条来） */
  let 问着 = false;

  const 作答 = () => 进度.贴水果成绩().作答;

  // --- 平面贴纸板 -----------------------------------------------------------

  /** 这一格上是什么水果：书上先贴好的，或者孩子贴上去的。都没有是 null */
  function 贴了什么(下标) {
    const 书上的 = 这一题?.已贴?.find((一个) => 一个.下标 === 下标);
    if (书上的) return 书上的.槽位;
    return 贴上的.has(下标) ? 贴上的.get(下标) : null;
  }

  const 是书上贴的 = (下标) => Boolean(这一题?.已贴?.some((一个) => 一个.下标 === 下标));

  /** 板上第几个格位放的是衣服的第几格。不在衣服上是 -1 */
  let 板上的映射 = new Array(板行数 * 板列数).fill(-1);

  function 画板() {
    板上的映射 = new Array(板行数 * 板列数).fill(-1);
    if (这一题) {
      for (const 格 of 居中摆(这一题.格子)) 板上的映射[格.row * 板列数 + 格.col] = 格.下标;
    }

    格位们.forEach((格, 位) => {
      const 下标 = 板上的映射[位];
      格.className = '贴格';
      格.replaceChildren();
      格.style.removeProperty('--线索色');
      格.tabIndex = -1;
      格.setAttribute('aria-hidden', 'true');
      delete 格.dataset.下标;
      if (下标 === -1) return;

      格.classList.add('有');
      格.dataset.下标 = String(下标);
      格.setAttribute('aria-hidden', 'false');
      格.tabIndex = 0;

      if (这一题.种类 === '数字') {
        const 字 = document.createElement('span');
        字.className = '数字';
        字.textContent = String(这一题.数字[下标]);
        格.appendChild(字);
        if (下标 === 这一题.问下标) 格.classList.add('在问');
        格.setAttribute('aria-label', 选({
          cn: `数字 ${这一题.数字[下标]}`,
          en: `Number ${这一题.数字[下标]}`,
        }));
        return;
      }

      const 槽位 = 贴了什么(下标);
      if (槽位 === null) {
        格.classList.add('空着');
        格.setAttribute('aria-label', 选({ cn: '空格子', en: 'Empty square' }));
        return;
      }
      格.classList.add(是书上贴的(下标) ? '书上贴的' : '孩子贴的');
      const 贴纸 = document.createElement('span');
      贴纸.className = '水果贴纸';
      贴纸.style.background = 水果(槽位).色;
      贴纸.appendChild(画一个水果(槽位));
      格.appendChild(贴纸);
      格.setAttribute('aria-label', 水果名(槽位));
    });

    容器.classList.toggle('可贴', 状态 === '贴' && 这一题?.种类 === '水果');
  }

  /** 平面上把一对对面圈起来 —— 跟三维上那两个面同一个颜色，孩子靠这个对上号 */
  function 设线索(下标们, 色) {
    格位们.forEach((格, 位) => {
      const 亮 = 下标们.includes(板上的映射[位]);
      格.classList.toggle('线索', 亮);
      if (亮) 格.style.setProperty('--线索色', 色);
      else 格.style.removeProperty('--线索色');
    });
  }

  const 清线索 = () => 设线索([], '');

  // --- 水果盘和按钮 ---------------------------------------------------------

  function 画水果盘() {
    const 槽位们 = 这一题?.种类 === '水果' ? 这一题.水果槽位 : [];
    水果钮们.forEach((按, 位) => {
      const 槽位 = 槽位们[位];
      按.hidden = 槽位 === undefined;
      按.onclick = null;
      按.onpointerenter = null;
      if (槽位 === undefined) return;
      const 用掉了 = [...贴上的.values()].includes(槽位);
      按.replaceChildren(画一个水果(槽位));
      按.style.background = 水果(槽位).色;
      按.setAttribute('aria-label', 水果名(槽位));
      按.dataset.槽位 = String(槽位);
      按.classList.toggle('在手上', 在手上 === 槽位);
      按.classList.toggle('用掉了', 用掉了);
      按.disabled = 用掉了 || 状态 !== '贴';
      按.onclick = () => 挑水果(槽位);
      // 孩子不认字，鼠标扫过去先听见这是什么水果
      按.onpointerenter = () => {
        if (状态 === '贴') 念一下(水果名(槽位));
      };
    });
  }

  function 摆按钮() {
    试穿键.hidden = !(状态 === '贴' && 这一题?.种类 === '水果' && 贴够了(这一题, 贴上的));
    下一题键.hidden = 状态 !== '看';
    重玩键.hidden = 状态 !== '完';
    if (状态 !== '问') 收数键();
  }

  function 画兔兔({ 刚点亮 = -1 } = {}) {
    兔兔排.setAttribute('aria-label', 选({
      cn: `已经收到 ${答对几只(作答())} 只兔子，一共 ${题数} 题`,
      en: `${答对几只(作答())} bunnies collected out of ${题数} questions`,
    }));
    兔兔队(作答()).forEach((一只状态, i) => {
      兔们[i].className = `一只兔 ${一只状态}`;
      if (i === 刚点亮) {
        void 兔们[i].offsetWidth; // 先摘掉再挂上，连着答对时第二只才会再蹦一次
        兔们[i].classList.add('刚点亮');
      }
    });
  }

  // --- 贴 -------------------------------------------------------------------

  function 挑水果(槽位) {
    if (状态 !== '贴') return;
    if ([...贴上的.values()].includes(槽位)) return;
    在手上 = 槽位;
    音效.点一下();
    画水果盘();
    念一下(水果名(槽位));
  }

  function 点了格位(位) {
    const 下标 = 板上的映射[位];
    if (下标 === undefined || 下标 === -1) return;
    if (状态 !== '贴' || 这一题?.种类 !== '水果') return;

    // 点自己贴上去的那一张：拿下来，水果回到盘子里重挑
    if (贴上的.has(下标)) {
      贴上的.delete(下标);
      在手上 = null;
      音效.点一下();
      重画一遍();
      return;
    }
    if (是书上贴的(下标)) {
      说(话().我先贴的);
      return;
    }
    if (在手上 === null) {
      说(话().先挑水果);
      return;
    }

    贴上的.set(下标, 在手上);
    在手上 = null;
    折纸声({ 轻重: 0.5 });
    重画一遍();
    if (贴够了(这一题, 贴上的)) 说(话().贴齐了);
  }

  /** 贴纸一变，平面板、水果盘、三维那件衣服上的贴图全跟着换一遍 */
  function 重画一遍() {
    画板();
    画水果盘();
    摆按钮();
    刷新贴图();
  }

  // --- 试穿：折给他看 -------------------------------------------------------

  /**
   * 把衣服折到某个折叠度。
   * @returns {Promise<boolean>} 折完了是 true；中途换题了是 false
   */
  function 折一段(到) {
    return new Promise((好) => {
      if (!衣服) return 好(false);
      const 这一次 = (动画请求 += 1);
      const 从 = 衣服.fold;
      const 开始 = performance.now();
      const 一帧 = () => {
        if (这一次 !== 动画请求 || !衣服) return 好(false);
        const t = Math.min(1, (performance.now() - 开始) / 折叠时长);
        const 缓 = t * t * (3 - 2 * t);
        衣服.setFold(从 + (到 - 从) * 缓);
        看得全();
        if (t < 1) requestAnimationFrame(一帧);
        else 好(true);
      };
      requestAnimationFrame(一帧);
    });
  }

  async function 试穿() {
    if (状态 !== '贴' || !衣服 || !贴够了(这一题, 贴上的)) return;
    const 这一次 = 这一局;
    别听了(); // 听水果那个循环这会儿可能正armed着，先把麦克风还回去
    状态 = '试穿';
    容器.classList.remove('可贴');
    画水果盘();
    摆按钮();
    折纸声({ 轻重: 1 });
    说(话().我穿给你看);
    const 折完了 = await 折一段(1);
    if (!折完了 || 这一次 !== 这一局) return;
    await 判一判(这一次);
  }

  async function 判一判(这一次) {
    const 查 = 查贴的(这一题, 贴上的);

    if (查.every((一个) => 一个.对)) {
      状态 = '看';
      音效.答对();
      const 一次就对了 = 错了几次 === 0;
      进度.记贴水果(这一题.号, 一次就对了);
      画兔兔({ 刚点亮: 一次就对了 ? 题库.indexOf(这一题) : -1 });
      摆按钮();
      方方?.情绪('跳舞');
      说(模板.碰到头(水果名(查[0].槽位)));
      await 挨个亮一遍(查.map((一个) => [一个.从, 一个.贴到]), 这一次);
      return;
    }

    // 贴错了：那两个同款水果折成了邻居，见不着面
    错了几次 += 1;
    音效.答错();
    方方?.情绪('发抖');

    if (错了几次 >= 3) {
      await 教一遍(这一次);
      return;
    }

    await 说(错了几次 === 1 ? 话().见不着面 : 话().露一个);
    if (这一次 !== 这一局) return;

    if (错了几次 === 2) {
      // 提示 = 把一对**贴错了的**对面亮出来，平面和三维同时亮。只指认，不讲道理
      const 错的 = 查.find((一个) => !一个.对) ?? 查[0];
      await 挨个亮一遍([[错的.从, 错的.贴到]], 这一次, { 说完了: 话().这才是一对 });
      if (这一次 !== 这一局) return;
    }

    收回错的(查);
    const 摊平了 = await 折一段(0);
    if (!摊平了 || 这一次 !== 这一局) return;
    状态 = '贴';
    重画一遍();
  }

  /** 贴错的水果自己回到盘子里；贴对的留在原地（对的那一格别让孩子重贴一遍） */
  function 收回错的(查) {
    for (const 一个 of 查) {
      if (!一个.对 && 一个.贴了哪格 !== null) 贴上的.delete(一个.贴了哪格);
    }
    对面高亮?.清除();
    清线索();
  }

  /** 三次都没贴对：直接贴给他看，然后照样往下走 —— 绝不卡关 */
  async function 教一遍(这一次) {
    贴上的 = new Map(这一题.答案.map((一个) => [一个.贴到, 一个.槽位]));
    状态 = '看';
    进度.记贴水果(这一题.号, false);
    画兔兔();
    画板();
    画水果盘();
    摆按钮();
    刷新贴图();
    await 说(话().告诉你在这儿);
    if (这一次 !== 这一局) return;
    await 挨个亮一遍(这一题.答案.map((一个) => [一个.从, 一个.贴到]), 这一次);
  }

  /**
   * 一对一对地亮给他看：正方体变半透明，这一对的两个面一起发光，
   * **同一时刻**平面板上对应的两格也亮同一个颜色 ——
   * 孩子就是靠这一下把正方体上的关系搬回衣服上的。
   */
  async function 挨个亮一遍(对们, 这一次, { 说完了 } = {}) {
    for (let 序 = 0; 序 < 对们.length; 序 += 1) {
      if (这一次 !== 这一局) return;
      对面高亮?.显示(对们[序], 序);
      设线索(对们[序], 对面色(序));
      await 歇(一对亮多久);
    }
    if (这一次 !== 这一局) return;
    对面高亮?.清除();
    清线索();
    if (说完了) await 说(说完了);
  }

  // --- 麦克风：进场借一把，离场还回去 ---------------------------------------

  /**
   * 等孩子说一句。
   *
   * 坞全站只有一只，进场时借在手上（票 08），别的玩法借走时手上这个 await
   * 会当场解成「被打断」—— 循环拿到它就退场，不再是从前那种永远挂着的 promise。
   * 孩子改用手点数字键时走的是同一条路：`别听了()` 把这次听叫醒。
   *
   * 没借到坞（自动化测试、页面还没建好）也照样能玩：这时候只等按钮。
   *
   * @returns {Promise<string|null>} 听到的话；没说话/被叫醒了/被借走了都是 null
   */
  async function 等孩子说(热词) {
    if (听着) {
      // 上一次听还没收摊（比如孩子正贴着水果就点了试穿）。等一小会儿再说
      await 歇(300);
      return null;
    }
    let 我的打断 = null;
    听着 = true;
    try {
      return await new Promise((好) => {
        let 完 = false;
        const 出 = (值) => { if (完) return; 完 = true; 好(值); };
        我的打断 = () => { 麦?.打断自己(); 出(null); };
        打断听 = 我的打断;
        if (!麦?.是主人()) { 出(null); return; } // 坞不在手上：只等按钮
        try {
          麦.听一句(热词).then(
            (文) => 出(是被打断(文) ? null : 文),
            () => 出(null),
          );
        } catch {
          // 坞还没装起来（听一句 会当场抛）。语音这条路今天没有，孩子照样用手玩
          出(null);
        }
      });
    } finally {
      听着 = false;
      if (打断听 === 我的打断) 打断听 = null;
    }
  }

  /** 换题、离场、他改用手点了：把正等着的那一次听叫醒，别让 await 卡在那儿 */
  function 别听了() {
    打断听?.();
    打断听 = null;
    麦?.打断自己(); // 没人挂着也照样把坞上那只耳朵收回来
  }

  /** 让麦克风坞冒出来 —— main.js 切玩法时会把它收下去（那是沙盒的东西） */
  function 叫出麦克风(要不要) {
    if (typeof document === 'undefined') return;
    document.getElementById('麦克风坞挂点')?.classList.toggle('收着', !要不要);
  }

  /**
   * 贴水果时也能用嘴巴：孩子点麦克风说「苹果」，苹果就到手上。
   * 一句一句地听，贴完这一题就歇着 —— 不做常开监听，家里说的每句话不该都在动贴纸。
   */
  let 听水果开着 = false;

  async function 一直听水果() {
    if (听水果开着) return;
    听水果开着 = true;
    for (;;) {
      if (没了) return;
      if (!在前 || 状态 !== '贴' || 这一题?.种类 !== '水果') {
        await 歇(500);
        continue;
      }
      const 这一次 = 这一局;
      // 两语一起喂给 ASR：判定本来就两语通吃，识别这一关不该先把另一语掐死
      const 可选 = 这一题?.水果槽位 ?? [];
      const 文 = await 等孩子说(热词(可选.map((槽位) => 水果(槽位).名.cn), 水果词表(可选)));
      if (文 === null || 这一次 !== 这一局 || 状态 !== '贴') {
        // 没听到、或者这一题已经翻篇了。歇一下再重新支起耳朵 ——
        // 万一麦克风坞根本不在（语音这条路今天没有），这一下也拦住了空转
        await 歇(400);
        continue;
      }
      const 槽位 = 听出水果(文, 这一题?.水果槽位 ?? []);
      if (槽位 === null) {
        await 说(话().没听清水果);
      } else if ([...贴上的.values()].includes(槽位)) {
        await 说(模板.已经贴上了(水果名(槽位)));
      } else {
        挑水果(槽位);
      }
    }
  }

  // --- 闯关三：数字题 -------------------------------------------------------

  /**
   * 一问一答：嘴巴说、手点数字键，走同一条判定。
   * 三次机会（鼓励 → 亮一对对面当线索 → 告诉他），一次都不会把孩子卡住。
   *
   * @returns {Promise<{全对: boolean}>}
   */
  async function 问一个数(题) {
    const 这一次 = 这一局;
    let 错次 = 0;
    let 没听清 = 0;
    let 点的 = null;

    摆数键(题.选项, (数) => {
      点的 = String(数);
      打断听?.(); // 手点了按钮：把等着的那次听叫醒，走同一条判定
    });

    await 说(题.问);

    for (;;) {
      if (这一次 !== 这一局) return { 全对: false };
      点的 = null;
      const 听到的 = await 等孩子说(题.热词);
      if (这一次 !== 这一局) return { 全对: false };

      const 文 = 点的 ?? 听到的;
      const 裁定 = 文 === null ? '不确定' : 判数字(文, 题.答);

      if (裁定 === '对') {
        音效.答对();
        await 说(话().答对了);
        return { 全对: 错次 === 0 };
      }
      if (裁定 === '错') {
        错次 += 1;
        音效.答错();
        if (错次 >= 3) {
          await 说(模板.告诉你答案(题.答));
          return { 全对: false };
        }
        if (错次 === 2 && 题.提示) await 题.提示();
        else await 说(话().差一点);
      } else {
        没听清 += 1;
        await 说(没听清 >= 2 ? 话().没听清点数字 : 话().没听清);
      }
      if (这一次 !== 这一局) return { 全对: false };
    }
  }

  function 摆数键(选项, 点了) {
    数键们.forEach((按, i) => {
      const 数 = 选项[i];
      按.hidden = 数 === undefined;
      按.onclick = null;
      if (数 === undefined) return;
      按.firstChild.textContent = String(数);
      按.setAttribute('aria-label', 选({ cn: `答案是${数}`, en: `The answer is ${数}` }));
      按.onclick = () => {
        音效.点一下();
        点了(数);
      };
    });
  }

  function 收数键() {
    for (const 按 of 数键们) {
      按.hidden = true;
      按.onclick = null;
    }
  }

  async function 演一题数字() {
    if (问着 || 这一题?.种类 !== '数字') return;
    问着 = true;
    别听了(); // 麦克风这会儿归数字题用
    const 这一次 = 这一局;
    const 一题 = 这一题;
    try {
      状态 = '问';
      摆按钮();
      画板();
      const 一对 = [一题.问下标, 一题.答下标];

      const 第一问 = await 问一个数({
        问: 模板.问对面数(一题),
        答: 一题.对面数,
        热词: 数字热词(),
        选项: 凑四个数(一题.对面数),
        提示: async () => {
          // 提示就是把这一对亮给他看：折起来，两个面一起发光，平面上那两格同时亮
          await 说(话().碰头看);
          if (await 折一段(1)) await 挨个亮一遍([一对], 这一次);
          await 折一段(0);
        },
      });
      if (这一次 !== 这一局) return;

      // 不管答没答对，都折起来把这一对亮给他看 —— 对错不是大人说了算，是穿出来的
      if (await 折一段(1)) await 挨个亮一遍([一对], 这一次);
      if (这一次 !== 这一局) return;

      const 第二问 = await 问一个数({
        问: 模板.问加起来(一题),
        答: 一题.和,
        热词: 数字热词(),
        选项: 凑四个数(一题.和),
      });
      if (这一次 !== 这一局) return;

      const 全对 = 第一问.全对 && 第二问.全对;
      进度.记贴水果(一题.号, 全对);
      画兔兔({ 刚点亮: 全对 ? 题库.indexOf(一题) : -1 });
      状态 = '看';
      摆按钮();
      方方?.情绪('跳舞');
      音效.答对();
      await 说(全对 ? 话().全答对 : 话().看下一张);
    } finally {
      问着 = false;
    }
  }

  // --- 换题 -----------------------------------------------------------------

  function 摆好这一题() {
    这一局 += 1;
    动画请求 += 1;
    别听了();
    收数键();
    收掉庆祝();
    贴上的 = new Map();
    在手上 = null;
    错了几次 = 0;
    对面高亮?.清除();
    清线索();

    const 下标 = 第几题(作答());
    if (下标 === null) {
      这一题 = null;
      状态 = '完';
      收掉衣服();
      画板();
      画水果盘();
      摆按钮();
      画兔兔();
      放收尾庆祝();
      return;
    }

    这一题 = 题库[下标];
    状态 = 这一题.种类 === '数字' ? '问' : '贴';
    画兔兔();
    画板();
    画水果盘();
    摆按钮();
    摆好衣服();

    // 数字题一上来就开口问。人还没进这块面板就别问 ——
    // 那会儿导航正念着别的玩法的名字，孩子也看不见这张图
    if (这一题.种类 === '数字' && 在前) 演一题数字();
  }

  function 放收尾庆祝() {
    收掉庆祝();
    庆祝层 = document.createElement('div');
    庆祝层.className = '贴水果收尾';

    const 奖杯 = document.createElement('div');
    奖杯.className = '贴水果奖杯';
    奖杯.setAttribute('aria-hidden', 'true');
    奖杯.textContent = '🏆';

    const 一排兔 = document.createElement('div');
    一排兔.className = '贴水果收尾兔';
    一排兔.setAttribute('aria-hidden', 'true');
    for (const 一只状态 of 兔兔队(作答())) {
      const 兔 = document.createElement('span');
      兔.className = `一只兔 ${一只状态}`;
      兔.appendChild(画一只兔());
      一排兔.appendChild(兔);
    }

    庆祝层.append(奖杯, 一排兔);
    贴台.appendChild(庆祝层);
    说(模板.贴水果收尾(答对几只(作答())));
  }

  function 收掉庆祝() {
    庆祝层?.remove();
    庆祝层 = null;
  }

  // --- 接线 -----------------------------------------------------------------

  试穿键.addEventListener('click', () => 试穿());
  下一题键.addEventListener('click', () => 摆好这一题());
  重玩键.addEventListener('click', () => {
    进度.清贴水果();
    摆好这一题();
    说(话().重贴);
  });

  /*
    进度自己会广播（角落里那个「重来」清光了，或者别处记了一题）。
    兔兔跟着刷新；人正停在收尾庆祝上而进度被清空了，就直接开新的一局 ——
    不然孩子点了重来，屏幕上还杵着那只奖杯。
  */
  const 退订 = 进度.订阅(() => {
    画兔兔();
    if (状态 === '完' && !都做完了(作答())) 摆好这一题();
  });

  /**
   * 换了语言：读屏标签和贴纸板重挂一遍。
   *
   * 板上唯一的字符是闯关三印在格子上的**数字** —— 那是这一讲要教的东西，
   * 两语长得一模一样（书上的画法也是数字），所以这一下重画不会换掉它，
   * 换的只是读屏那几句。**这儿不开口**：重读当前指令由 main.js 统一叫。
   */
  const 退订语言 = 订阅语言(() => {
    for (const [按, 名字] of 键名们) 按.setAttribute('aria-label', 选(名字));
    画板();
    画水果盘();
    画兔兔();
  });

  画兔兔();
  画板();
  画水果盘();
  摆按钮();

  return {
    /** 导航切到这个玩法时叫一声。第一次进来才真的建舞台 */
    进场({ 等一下 = 等名字念完 } = {}) {
      在前 = true;
      clearTimeout(进场定时);
      备好舞台();
      // 把全站那只坞借过来（沙盒的口令循环会拿到「被打断」自己退场）
      if (!麦?.是主人()) 麦 = 借麦克风('贴水果');
      一直听水果(); // 第一次进来才起这个循环，孩子不来就一分钱不花
      叫出麦克风(true); // main.js 切玩法时把坞收下去了，这一关也要用嘴巴
      if (!备过话) {
        备过话 = true; // 备一次就够了，后端有磁盘缓存
        备话((语) => 本关台词(语));
      }
      if (!这一题 && 状态 !== '完') 摆好这一题();
      else if (状态 === '完' && !庆祝层) 放收尾庆祝();
      else if (这一题 && !衣服) 摆好衣服();

      /*
        等导航把「贴水果」念完再开口。说() 是后一句掐前一句的，
        抢在前面说，孩子听见的是「贴水……先挑一个水果」。
      */
      进场定时 = setTimeout(() => {
        if (!在前) return;
        if (状态 === '贴') 说(话().开场);
        else if (状态 === '问' && !问着) 演一题数字();
      }, 等一下);
    },

    /**
     * 孩子切到别的玩法去了。
     *
     * 光停下不行：停在「试穿」「问」上，孩子回来看见的是一个折了一半的正方体、
     * 一个还等着他开口的问题。所以退回这一题的起点，回来能重新贴。
     */
    离场() {
      在前 = false;
      clearTimeout(进场定时);
      别听了();
      麦?.还回去(); // 坞交还，下一个玩法（多半是沙盒）自己去借
      麦 = null;
      收数键();
      if (状态 === '试穿' || 状态 === '看' || 状态 === '问') 摆好这一题();
      else 这一局 += 1;
    },

    /** 角落里的「重来」清了进度以后（进度广播也会走到这儿） */
    重头来过() {
      clearTimeout(进场定时);
      摆好这一题();
    },

    /**
     * 刚换了语言，用新语言把「现在该干什么」重讲一遍（main.js 只叫在台上的那一个）。
     *
     * 数字题走的是一整条问答链（`演一题数字`），链子上挂着「等孩子说」那个 await，
     * 光说一句是接不上的 —— 这一题从头再问一遍最干净：孩子这一题还没答完，
     * 兔兔一只都没动，进度一个字都不变。
     */
    重读指令() {
      if (!在前) return false;
      if (状态 === '问') {
        摆好这一题();
      } else if (状态 === '贴') {
        说(话().开场);
      } else if (状态 === '完') {
        说(模板.贴水果收尾(答对几只(作答())));
      } else {
        return false; // 正试穿、正看结果：这会儿没有「该干什么」可讲
      }
      return true;
    },

    // 调试和自动化验收用（页面本身不用它们）
    get 状态() {
      return 状态;
    },
    get 这一题() {
      return 这一题;
    },
    get 贴上的() {
      return new Map(贴上的);
    },
    get 在前() {
      return 在前;
    },
    /** 把某个水果贴到某一格上（自动化验收用，走的是孩子点下去那条路） */
    贴一个(下标, 槽位) {
      在手上 = 槽位;
      const 位 = 板上的映射.indexOf(下标);
      if (位 >= 0) 点了格位(位);
    },
    试穿,
    格位元素: (位) => 格位们[位] ?? null,

    dispose() {
      clearTimeout(进场定时);
      这一局 += 1;
      动画请求 += 1;
      在前 = false;
      没了 = true;
      别听了();
      麦?.还回去();
      麦 = null;
      退订();
      退订语言();
      收掉庆祝();
      收掉衣服();
      方方?.dispose();
    },
  };
}
