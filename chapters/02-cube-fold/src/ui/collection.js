import { canClose, netCode, netFingerprint, normalize, orientations } from '../domain/net.js';
import { cellStyle } from '../domain/palette.js';
import { 备话, 说 as 默认朗读 } from '/shared/js/说话.js';
import { 借麦克风, 是被打断 } from '/shared/js/问答.js';
import { 音效 } from '/shared/js/音效.js';
import { 进度 as 默认进度 } from '../state/progress.js';
import { 创建不复读的朗读 } from './nav.js';
import { 格子纸列数, 格子纸行数 } from './gridPaper.js';
import { 台词, 模板 } from '../data/台词表.js';
import { 当前语言, 订阅语言, 选 } from '/shared/js/语言.js';
import {
  一起数吧,
  判数数,
  告诉他,
  整排念完,
  数数备选,
  数数热词,
  数数题,
  数点点台词,
  数点点话,
  读数,
  读量词,
} from '../domain/collectionCount.js';

/**
 * 图鉴自己那几句。数点点彩蛋的台词不在这儿 —— 它们跟着「这一行有几个点」现算，
 * 住在 domain/collectionCount.js（那边有 node --test 盯着两语读数和「不许出数字」）。
 * 别的都在 data/台词表.js。
 *
 * 两处都是**函数**，要说的时候才取：摊成模块顶上的常量，就把中文那一句焊死在
 * 模块加载的那一刻，孩子切成英文之后方方还在念中文。
 */
const 图鉴话 = () => 台词().衣服图鉴;
const 数话 = () => 数点点话();

/**
 * 图鉴 —— 11 种能合上的衣服的收集册。
 *
 * 11 个空位按书上的编码排成四排：141（6 件）、231（3 件）、222（1 件）、33（1 件）。
 * 没找到的是灰色的问号，找到了就显示那件衣服的缩略图，颜色和沙盒里画出来的那张一模一样。
 *
 * 孩子在沙盒里每折成一件**以前没折过的**衣服，对应那一格当场点亮，
 * 同时语音喊一声「发现新衣服！」—— 不用他跑到图鉴这边来看。集齐 11 件放一个满屏的大庆祝。
 *
 * ## 判重无视旋转和翻转
 *
 * 这是整个收集玩法的地基：孩子把同一件衣服转个方向、翻个面重画一遍，不算新的。
 * 做不到的话他永远集不齐 11 种，跟书上的「11 种」也对不上。
 * 靠的是 domain/net.js 的 `netFingerprint`（8 种摆法里取字典序最小的那一种），
 * 存进 localStorage 的键就是它，不另造一套。
 *
 * ## 11 是算出来的，不是抄来的
 *
 * 按 ADR-0001：这里长出全部 35 种六格骨牌，再拿 `canClose` 滤一遍，
 * 剩下的恰好 11 种。一张表都不查 —— 引擎哪天算错了，这里的格子数会跟着变，
 * 测试立刻炸，而不是让孩子对着一本抄来的图鉴永远集不齐。
 */

/** 书上的四类，排在图鉴上就是四排，次序跟书上一致 */
export const 编码顺序 = Object.freeze(['141', '231', '222', '33']);

const 键串 = (格子) => 格子.map((c) => `${c.row},${c.col}`).join(' ');
const 行数 = (格子) => Math.max(...格子.map((c) => c.row)) + 1;
const 列数 = (格子) => Math.max(...格子.map((c) => c.col)) + 1;

/** 缩略图统一按这么大的一张纸画，各排的格子才一样大小 */
const 图幅列 = 5;
const 图幅行 = 3;

/**
 * 长出全部 35 种六格骨牌（hexomino）：从一格开始，每轮往边上贴一格，
 * 用「无视旋转翻面的指纹」去重。
 *
 * 跟 test/hexominoes.js 是同一套长法。那边是测试的原料，归测试；
 * 这边是图鉴要摆出来的 11 个空位，归运行时。共用的是 domain/net.js 里那两个函数，
 * 抄过来的只有十来行外壳 —— 让 src 反过来依赖 test 才是真的坏。
 */
function 长出六格骨牌() {
  let 形状 = new Map();
  形状.set(netFingerprint([{ row: 0, col: 0 }]), [{ row: 0, col: 0 }]);

  for (let 格数 = 1; 格数 < 6; 格数++) {
    const 下一轮 = new Map();
    for (const 格子 of 形状.values()) {
      for (const 格 of 格子) {
        for (const [d行, d列] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const 新格 = { row: 格.row + d行, col: 格.col + d列 };
          if (格子.some((c) => c.row === 新格.row && c.col === 新格.col)) continue;
          const 候选 = normalize([...格子, 新格]);
          下一轮.set(netFingerprint(候选), 候选);
        }
      }
    }
    形状 = 下一轮;
  }
  return [...形状.values()];
}

/**
 * 把一件衣服摆成书上那个样子：每一行的格数正好读出它的编码（141 就是 1、4、1），
 * 而且要装得进格子纸（4 行 × 5 列）—— 孩子点一下就能把它装回沙盒接着折，
 * 装不进那张纸的摆法等于点了没用。
 *
 * 8 种摆法里合格的不止一种，取字典序最小的那个，保证每次打开图鉴长得一模一样。
 */
export function 摆正(格子) {
  const 编码 = netCode(格子);
  if (!编码) return null;
  const 合格 = orientations(格子).filter((摆法) => {
    if (行数(摆法) > 格子纸行数 || 列数(摆法) > 格子纸列数) return false;
    const 每行 = [];
    for (let r = 0; r < 行数(摆法); r++) 每行.push(摆法.filter((c) => c.row === r).length);
    return 每行.join('') === 编码;
  });
  if (合格.length === 0) return null;
  return 合格.sort((a, b) => (键串(a) < 键串(b) ? -1 : 1))[0];
}

/**
 * 一件衣服在图鉴里的那把钥匙。转个方向、翻个面画出来的是同一把 —— 这就是判重。
 * 存进 localStorage 的也是它。
 */
export const 图鉴键 = netFingerprint;

/**
 * 这形状是图鉴里的哪一件？穿不上的、格子数不对的一律 null。
 * @returns {null|{键: string, 编码: string, 格子: Array<{row, col, 槽位}>}}
 */
export function 认衣服(格子) {
  if (!Array.isArray(格子) || 格子.length !== 6) return null;
  const 素格子 = 格子.map((c) => ({ row: c.row, col: c.col }));
  return 全部衣服().find((一件) => 一件.键 === netFingerprint(素格子)) ?? null;
}

let 缓存的十一件 = null;

/**
 * 图鉴里的 11 件衣服，按 141 / 231 / 222 / 33 排好队。
 * 同一排里的次序按摆正后的坐标排，跟运行几次无关，孩子每次打开看见的位置都一样。
 *
 * @returns {Array<{键: string, 编码: string, 排: number, 格子: Array<{row, col, 槽位}>}>}
 */
export function 全部衣服() {
  if (缓存的十一件) return 缓存的十一件;

  const 按编码 = new Map(编码顺序.map((码) => [码, []]));
  for (const 形状 of 长出六格骨牌()) {
    if (!canClose(形状)) continue;
    const 编码 = netCode(形状);
    const 摆好 = 摆正(形状);
    // 编码认不出来、或者哪个摆法都装不进格子纸，就没法摆进图鉴。
    // 真出现了得让人看见，不能悄悄少一格 —— 孩子会永远集不齐。
    if (!编码 || !按编码.has(编码) || !摆好) {
      throw new Error(`这件衣服摆不进图鉴：${键串(normalize(形状))}（编码 ${编码}）`);
    }
    按编码.get(编码).push({
      键: netFingerprint(形状),
      编码,
      排: 编码顺序.indexOf(编码),
      // 缩略图和「装回沙盒」用同一份格子和同一套颜色，孩子看见的就是他要画的那张
      格子: 摆好.map((c, i) => ({ row: c.row, col: c.col, 槽位: i })),
    });
  }

  缓存的十一件 = 编码顺序.flatMap((码) =>
    按编码.get(码).sort((a, b) => (键串(a.格子) < 键串(b.格子) ? -1 : 1)),
  );
  return 缓存的十一件;
}

/** 分成四排，直接拿去铺界面 */
export function 分排() {
  return 编码顺序.map((码) => ({
    编码: 码,
    /** 界面上不写「141」，就画成 1 个点、4 个点、1 个点三行 —— 孩子不认字，但数得清点 */
    点数: [...码].map(Number),
    衣服: 全部衣服().filter((一件) => 一件.编码 === 码),
  }));
}

/** 图鉴一共几件（是算出来的 11，不是写死的 11） */
export function 总件数() {
  return 全部衣服().length;
}

// ---------------------------------------------------------------------------
// 样式：由本模块自己注入，不写进 styles.css
// ---------------------------------------------------------------------------

/**
 * 跟 gridPaper.js 一个道理（见那边的注释）：05 / 06 / 07 三张票同时在做，
 * styles.css 一起改必然互相覆盖。功能自带的样式跟着功能的 JS 走。
 * 一个字节都不从网上取，断网照样是这个样子。
 */
const 图鉴样式 = `
/*
  竖着的 flex + width: fit-content：四排一样宽，宽度就是最长那排（141 的六格）。
  不这么写，只有一件的 222 和 33 那两排要么拉成一条空荡荡的长条，要么缩成一小块，
  四排看上去就不像同一本册子了。
*/
/*
  尺寸一律是定死的舞台像素，不再写 vh / vw —— 整讲画在 1280 × 740 的基准舞台上
  （docs/adr/0004）。窗口单位量的是**窗口**，跟舞台这套恒定坐标系只在
  「窗口正好等于基准」时才对得上；手机上每个 clamp() 都会压到下限，整册书先小一圈、
  再被舞台缩一次。换上的数就是它们在 1280 × 740 上本来的值。
  （满屏那层大庆祝是例外，它挂在 body 上、在舞台外面，见下面那一段。）

  136px 的格宽是从触靶下限倒推的：缩略图的比例是 5 : 3.4，
  136 × 3.4 / 5 ≈ 92.5 高，正好压住 92px 那条线（推导见 styles.css 文件头）。
  凑巧跟它原来在 1280 上的值（10.5vw ≈ 134）差不多，桌面上几乎看不出变化。
  这一格得真放大，不能加隐形热区：一排六件衣服肩挨着肩，热区四面一起扩就扩到
  邻居身上 —— 孩子想装回沙盒的是这一件，点出来的是旁边那件。
  四排合 4 × (92.5 + 18) + 3 × 12 + 30 ≈ 508，740 的舞台里装得下。
*/
.图鉴 {
  --格宽: 136px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 12px;
  width: fit-content;
  max-width: 100%;
  height: 100%;
  margin: 0 auto;
  padding: 15px 38px;
  overflow: auto;
}

/* 一排 = 书上的一类。左边是那一类的「点记号」，右边是这一类的格子 */
.图鉴排 {
  display: flex;
  align-items: center;
  gap: 23px;
  padding: 9px 20px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(14px);
  border-radius: 26px;
  box-shadow: 0 14px 34px rgba(43, 51, 82, 0.1);
}

/*
  编码不写成字（孩子不认字，写 141 等于没写）：
  141 就画成一个点、四个点、一个点三行，跟那一排衣服的样子对得上。

  它同时是个按钮：点下去就跟方方一起数这几行点（书上练一练 p16 的编码，
  就这么变成了数数游戏）。所以它不能再是 aria-hidden 的一块装饰。
*/
/*
  58px 宽、内容撑出来的高。它是孩子的触靶（点下去开始数点点），但**视觉尺寸有意义**
  ——那几行点的数目就是这一排的编码，放大会把它撑成一块跟衣服抢戏的大板子。
  所以这一处走隐形热区（.热区 加在 JS 那边的 className 上）：
  视觉 × 系数 + 20 ≥ 44 → 视觉 ≥ 50px 就够，宽 58 过线，高得靠 min-height 补到 56。
  邻居够远，热区扩得开：右边第一件衣服隔着 23px，上下两排的记号隔着 30px。
*/
.图鉴记号 {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 58px;
  min-height: 56px;
  padding: 8px 2px;
  border: 3px solid transparent;
  border-radius: 16px;
  background: transparent;
  opacity: 0.5;
  cursor: pointer;
  transition:
    opacity 0.18s ease,
    transform 0.16s ease,
    background-color 0.2s ease;
}

/* 装饰性的 hover 一律关进鼠标里：触屏上点完会粘着不散（docs/adr/0004） */
@media (hover: hover) {
  .图鉴记号:hover {
    opacity: 1;
    transform: scale(1.12);
    background: rgba(76, 111, 255, 0.1);
  }
}

.图鉴记号:focus-visible {
  outline: 3px solid var(--高亮, #4c6fff);
  outline-offset: 3px;
}

/* 正在数这一排：整块记号亮起来，别的排看着就知道现在轮到谁 */
.图鉴记号.数着 {
  opacity: 1;
  background: rgba(255, 213, 74, 0.24);
  border-color: rgba(255, 176, 32, 0.55);
}

.图鉴记号行 {
  display: flex;
  gap: 4px;
  padding: 3px 5px;
  border-radius: 10px;
  transition: background-color 0.2s ease;
}

/* 现在数的是这一行 */
.图鉴记号行.在数 {
  background: rgba(76, 111, 255, 0.18);
}

.图鉴点 {
  width: 8px;
  height: 8px;
  border-radius: 3px;
  background: var(--墨色, #2b3352);
  transition:
    transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1),
    background-color 0.18s ease;
}

/* 方方一个一个点着数的时候，数到哪个哪个跳一下 */
.图鉴点.数到 {
  transform: scale(1.75);
  background: #ffb020;
}

/* 数对了的那一行：点变绿，孩子看得见自己走到哪儿了 */
.图鉴记号行.数过了 .图鉴点 {
  background: #2ed8a5;
}

/* =========================================================================
   数点点的备选按钮：住在借来的那只麦克风坞里
   ========================================================================= */

/*
  麦克风本身是全站那一只坞（/shared/js/问答.js，长相在 styles.css 里），
  数点点开始时借过来、数完还回去（票 08）。它本来就摆在屏幕正下方 ——
  跟从前这一关自己长的那只位置一模一样，孩子看不出换过东西。

  没听清两次就亮出来的备选：按钮上画的还是点，一个数字都不写 ——
  嘴巴不好使的时候用手点，答的仍然是「几个点」。它们塞进坞的 .备选行 里。
*/
/*
  尺寸对齐共享坞里的 .备选钮（100px），不是本讲那条 92px 的下限：这一排的**邻居是
  另一个答案**，按在缝上报的就是隔壁那个数 —— 判错。共享件那边为这一条把答案钮
  抬到了 100 并且明说不许加热区，本讲跟着走，别让同一排里两种钮一高一矮。
  孩子嘴不好使了才轮到它出场，这时候手是他唯一的路，58px 缩完只有 28pt，按不着。
  点也跟着放大，不然三四颗小点浮在一个大钮中间，看着像个没画完的按钮。

  它是坞上那个「备选钮」的**本讲私产**（住在共享坞的 .备选行 里，却另起了一个类名），
  所以共享件那边调 .备选钮 的每一手都够不着它 —— 正是 CLAUDE.md 说的
  「共享件抄一份必漂移」。并成一个类是另一张票的事，这儿只把两处的数对上。
*/
.数数备选钮 {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 100px;
  height: 100px;
  padding: 0 18px;
  border: none;
  border-radius: 24px;
  cursor: pointer;
  background: rgba(233, 237, 248, 0.95);
  box-shadow: 0 8px 20px rgba(43, 51, 82, 0.16);
  transition: transform 0.14s ease;
}

@media (hover: hover) {
  .数数备选钮:hover {
    transform: scale(1.1);
  }
}

.数数备选钮 .图鉴点 {
  width: 13px;
  height: 13px;
}

.图鉴格们 {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.图鉴格 {
  position: relative;
  width: var(--格宽);
  aspect-ratio: 5 / 3.4;
  padding: 6px;
  border: 3px solid transparent;
  border-radius: 20px;
  background: rgba(233, 237, 248, 0.9);
  cursor: default;
  transition:
    transform 0.14s ease,
    box-shadow 0.18s ease,
    background-color 0.2s ease;
}

.图鉴格 svg {
  display: block;
  width: 100%;
  height: 100%;
}

/* 没找到的：灰底一个大问号 */
.图鉴格.没亮 .图鉴问号 {
  fill: #aab3cc;
  opacity: 0.55;
}

.图鉴格.亮了 {
  background: #ffffff;
  border-color: rgba(76, 111, 255, 0.28);
  box-shadow: 0 10px 24px rgba(43, 51, 82, 0.14);
  cursor: pointer;
}

@media (hover: hover) {
  .图鉴格.亮了:hover {
    transform: translateY(-4px) scale(1.05);
    box-shadow: 0 16px 32px rgba(76, 111, 255, 0.3);
  }
}

.图鉴格:focus-visible {
  outline: 3px solid var(--高亮, #4c6fff);
  outline-offset: 4px;
}

/* 刚点亮的那一格：蹦一下 + 一圈光。孩子当场就知道是哪一格亮的 */
.图鉴格.刚亮 {
  animation: 图鉴蹦一下 0.9s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 2;
}

.图鉴格.刚亮::after {
  content: '';
  position: absolute;
  inset: -10px;
  border-radius: 28px;
  border: 4px solid #ffd54a;
  animation: 图鉴一圈光 0.9s ease-out forwards;
  pointer-events: none;
}

@keyframes 图鉴蹦一下 {
  0% {
    transform: scale(0.7) rotate(-6deg);
  }
  55% {
    transform: scale(1.22) rotate(3deg);
  }
  100% {
    transform: scale(1) rotate(0);
  }
}

@keyframes 图鉴一圈光 {
  0% {
    opacity: 1;
    transform: scale(0.75);
  }
  100% {
    opacity: 0;
    transform: scale(1.5);
  }
}

/* 人在沙盒里的时候也得看得见有事发生：左边那个图鉴图标跟着跳 */
.导航图标.图鉴新发现 {
  animation: 图鉴图标跳 0.9s ease 2;
}

@keyframes 图鉴图标跳 {
  0%,
  100% {
    transform: scale(1.07);
  }
  35% {
    transform: scale(1.28) rotate(-7deg);
  }
  70% {
    transform: scale(1.16) rotate(5deg);
  }
}

/* =========================================================================
   集齐 11 件：满屏的大庆祝。挂在 body 上，孩子在哪个玩法里都看得见 ——
   所以这一层在基准舞台**外面**，铺的是真屏幕、不被 scale() 缩，这儿的 px 就是
   屏幕上的 px。原先几处尺寸写的是 vw/vh（在这一层是讲得通的），现在也一律不写：
   全站红线「舞台里没有视口单位」是按文件查的，而同一个文件里既有舞台内的
   图鉴册、又有舞台外的这一层 —— 留一个豁免，下一个人就分不清哪一处能写。
   要「铺满真屏幕」的那两处各有别的走法：
     · 尺寸定死 px（这一层就放九秒，差几十像素无所谓）
     · 纸屑得真落出屏幕底边，距离由 JS 按 innerHeight 现算成 --落多远
       （读窗口是对的，它本来就在窗口坐标系里；换成舞台像素会停在半空）
   ========================================================================= */

.图鉴大庆祝 {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: none;
  place-items: center;
  /*
    满屏一层，底下压着的是一直在跑的三维舞台。
    这儿刻意**不用** backdrop-filter：整屏的实时模糊叠在 WebGL 画布上，
    每一帧都要把画布读回来再糊一遍，庆祝动画会把帧率拖垮 —— 孩子看见的会是卡住的礼花。
    底色直接铺到几乎不透明，效果一样，代价是零。
  */
  background: radial-gradient(60% 60% at 50% 45%, rgba(255, 255, 255, 0.97), rgba(231, 237, 252, 0.97));
  cursor: pointer;
}

.图鉴大庆祝.来了 {
  display: grid;
  animation: 图鉴庆祝出场 0.4s ease;
}

@keyframes 图鉴庆祝出场 {
  from {
    opacity: 0;
  }
}

.图鉴奖杯 {
  font-size: 168px; /* 定死。原来 clamp(96px, 17vw, 210px)：桌面 210、手机 148，取中 */
  line-height: 1;
  filter: drop-shadow(0 18px 34px rgba(255, 170, 0, 0.45));
  animation: 图鉴奖杯跳 1.1s cubic-bezier(0.34, 1.56, 0.64, 1) infinite alternate;
}

@keyframes 图鉴奖杯跳 {
  from {
    transform: scale(0.94) rotate(-5deg);
  }
  to {
    transform: scale(1.08) rotate(5deg);
  }
}

/* 十一件衣服绕着奖杯摆一圈，孩子一眼看见自己攒了这么多 */
.图鉴战利品 {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.图鉴战利品 svg {
  position: absolute;
  width: 88px; /* 定死。原来 clamp(64px, 8vw, 104px)：桌面 104、手机 70，取中 */
  transform: translate(-50%, -50%);
  filter: drop-shadow(0 8px 18px rgba(43, 51, 82, 0.22));
  animation: 图鉴战利品转 2.6s ease-in-out infinite alternate;
}

@keyframes 图鉴战利品转 {
  from {
    rotate: -8deg;
  }
  to {
    rotate: 8deg;
  }
}

.图鉴纸屑 {
  position: absolute;
  /* -8% 就是原来的 -8vh：这一层是 position:fixed inset:0，包含块正好是视口，
     百分比和 vh 在这儿等值，而百分比不会被红线误判成「舞台里的视口单位」 */
  top: -8%;
  width: 14px;
  height: 22px;
  border-radius: 3px;
  animation: 图鉴纸屑落 linear infinite;
}

@keyframes 图鉴纸屑落 {
  from {
    transform: translateY(0) rotate(0);
  }
  to {
    transform: translateY(var(--落多远, 1200px)) rotate(720deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .图鉴格.刚亮,
  .图鉴奖杯,
  .图鉴纸屑,
  .图鉴战利品 svg,
  .导航图标.图鉴新发现 {
    animation: none;
  }

  /* 数到哪个点还是得看得出来，只是不跳 —— 那是这个玩法的全部意思 */
  .图鉴点.数到 {
    transform: none;
  }
}
`;

let 样式装好了 = false;
function 装上图鉴样式() {
  if (样式装好了 || typeof document === 'undefined') return;
  样式装好了 = true;
  const 标签 = document.createElement('style');
  标签.dataset.来自 = '图鉴';
  标签.textContent = 图鉴样式;
  document.head.appendChild(标签);
}

// ---------------------------------------------------------------------------
// 缩略图
// ---------------------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * 一件衣服的缩略图。所有格子在所有排里都一样大 —— 统一画在 5 格宽 × 3 格高的纸上，
 * 形状自己居中。孩子比的是形状，不该被「这排的图画得比那排大」带偏。
 */
function 画衣服(格子, { 描边 = true } = {}) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${图幅列 * 10} ${图幅行 * 10}`);
  svg.setAttribute('aria-hidden', 'true');

  const 左 = ((图幅列 - 列数(格子)) / 2) * 10;
  const 上 = ((图幅行 - 行数(格子)) / 2) * 10;

  for (const 格 of 格子) {
    const 方 = document.createElementNS(SVG_NS, 'rect');
    方.setAttribute('x', 左 + 格.col * 10 + 0.6);
    方.setAttribute('y', 上 + 格.row * 10 + 0.6);
    方.setAttribute('width', 8.8);
    方.setAttribute('height', 8.8);
    方.setAttribute('rx', 2.2);
    方.setAttribute('fill', cellStyle(格.槽位 ?? 0).color);
    if (描边) {
      方.setAttribute('stroke', 'rgba(255, 255, 255, 0.85)');
      方.setAttribute('stroke-width', 1.1);
    }
    svg.appendChild(方);
  }
  return svg;
}

/** 还没找到的那一格：一个大灰问号 */
function 画问号() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${图幅列 * 10} ${图幅行 * 10}`);
  svg.setAttribute('aria-hidden', 'true');
  const 字 = document.createElementNS(SVG_NS, 'text');
  字.setAttribute('class', '图鉴问号');
  字.setAttribute('x', (图幅列 * 10) / 2);
  字.setAttribute('y', (图幅行 * 10) / 2);
  字.setAttribute('text-anchor', 'middle');
  字.setAttribute('dominant-baseline', 'central');
  字.setAttribute('font-size', 20);
  字.setAttribute('font-weight', '700');
  字.textContent = '?';
  svg.appendChild(字);
  return svg;
}

// ---------------------------------------------------------------------------
// 大庆祝
// ---------------------------------------------------------------------------

const 纸屑色 = ['#FF5A5A', '#FFC53D', '#9B6BFF', '#FF9235', '#FF4D9E', '#2ED8A5', '#4C6FFF'];

function 造大庆祝() {
  const 幕 = document.createElement('div');
  幕.className = '图鉴大庆祝';
  幕.setAttribute('aria-hidden', 'true');

  const 战利品 = document.createElement('div');
  战利品.className = '图鉴战利品';
  全部衣服().forEach((一件, i) => {
    const 图 = 画衣服(一件.格子);
    const 角 = (i / 总件数()) * Math.PI * 2 - Math.PI / 2;
    图.style.left = `${50 + Math.cos(角) * 34}%`;
    图.style.top = `${50 + Math.sin(角) * 36}%`;
    图.style.animationDelay = `${(i % 5) * 0.18}s`;
    战利品.appendChild(图);
  });

  const 奖杯 = document.createElement('div');
  奖杯.className = '图鉴奖杯';
  奖杯.setAttribute('aria-hidden', 'true');
  奖杯.textContent = '🏆';

  const 纸屑数 = 36;
  for (let i = 0; i < 纸屑数; i++) {
    const 屑 = document.createElement('span');
    屑.className = '图鉴纸屑';
    屑.style.left = `${(i * 100) / 纸屑数 + (i % 3)}%`;
    屑.style.background = 纸屑色[i % 纸屑色.length];
    屑.style.animationDuration = `${2.4 + (i % 7) * 0.35}s`;
    屑.style.animationDelay = `${(i % 11) * 0.22}s`;
    幕.appendChild(屑);
  }

  幕.append(战利品, 奖杯);
  return 幕;
}

// ---------------------------------------------------------------------------
// 界面
// ---------------------------------------------------------------------------

/** 大庆祝自己摆多久就收 —— 孩子不用去找关闭键，点一下也能提前收 */
const 大庆祝时长 = 9000;

/**
 * 切到图鉴这一页，导航自己会先念一声「衣服图鉴」。
 * 说() 是后一句掐掉前一句的，所以报进度得等那个名字念完 ——
 * 不等的话孩子听见的是「衣服图……你已经找到三件」。
 */
const 等名字念完 = 1700;

/**
 * 把图鉴画到页面上。
 *
 * @param {HTMLElement} 容器 `#面板-图鉴`
 * @param {{ 进度?: typeof 默认进度, 说?: (文本: string) => void }} [依赖]
 */
export function 创建图鉴(容器, { 进度 = 默认进度, 说 = 默认朗读 } = {}) {
  装上图鉴样式();

  const 念一下 = 创建不复读的朗读(说);
  const 格元素 = new Map();
  const 装回听众 = new Set();
  const 退订们 = [];
  /** 四排各留一份把手，数点点要用（记号、每一行的那几个点） */
  const 排们 = [];
  let 庆祝幕 = null;
  let 庆祝定时 = 0;
  let 跳定时 = 0;
  let 进场定时 = 0;
  let 备过话 = false;
  /** 图鉴这一页在不在台上 —— 收麦克风时要看它，别把别的玩法的麦克风也收了 */
  let 在前 = false;

  容器.replaceChildren();
  const 板 = document.createElement('div');
  板.className = '图鉴';
  容器.appendChild(板);

  for (const 一排 of 分排()) {
    const 排 = document.createElement('div');
    排.className = '图鉴排';
    排.dataset.编码 = 一排.编码; // 编码只留在 data 上给自动化验收，屏幕上一个字都不显示

    /*
      「141」画成 1 个点 / 4 个点 / 1 个点，不写字。
      它还是个按钮：点下去就跟方方一起数（见「数点点」那一节）。
    */
    const 记号 = document.createElement('button');
    记号.type = 'button';
    // 热区：看着还是那几行点，按着的范围补大一圈（/shared/css/热区.css）
    记号.className = '图鉴记号 热区';
    记号.dataset.编码 = 一排.编码;
    // 按钮上一个字都没有，这句只给读屏和自动化验收
    记号.setAttribute('aria-label', 选({ cn: '数一数这一排的点点', en: 'Count the dots in this row' }));
    const 点行们 = [];
    for (const 几个 of 一排.点数) {
      const 行 = document.createElement('div');
      行.className = '图鉴记号行';
      行.setAttribute('aria-hidden', 'true');
      const 点们 = [];
      for (let i = 0; i < 几个; i++) {
        const 点 = document.createElement('span');
        点.className = '图鉴点';
        行.appendChild(点);
        点们.push(点);
      }
      记号.appendChild(行);
      点行们.push({ 行元素: 行, 点们 });
    }

    const 这一排 = { 编码: 一排.编码, 点数: [...一排.点数], 记号, 点行们 };
    排们.push(这一排);
    记号.addEventListener('click', () => 玩数点点(这一排));
    记号.addEventListener('pointerenter', () => 念一下(图鉴话().数点点吧));

    const 格们 = document.createElement('div');
    格们.className = '图鉴格们';
    for (const 一件 of 一排.衣服) {
      const 格 = document.createElement('button');
      格.type = 'button';
      格.className = '图鉴格';
      格.dataset.键 = 一件.键;
      格.dataset.编码 = 一件.编码;
      格.addEventListener('click', () => 点了一格(一件));
      格.addEventListener('pointerenter', () => 扫过一格(一件));
      格们.appendChild(格);
      格元素.set(一件.键, 格);
    }

    排.append(记号, 格们);
    板.appendChild(排);
  }

  function 已解锁() {
    return new Set(进度.已解锁图鉴());
  }

  function 刷新() {
    const 亮着的 = 已解锁();
    for (const 一件 of 全部衣服()) {
      const 格 = 格元素.get(一件.键);
      const 亮 = 亮着的.has(一件.键);
      格.classList.toggle('亮了', 亮);
      格.classList.toggle('没亮', !亮);
      格.disabled = !亮;
      // 屏幕上不放字，但读屏和自动化验收得认得出这一格是什么、亮没亮
      格.setAttribute('aria-label', 选({
        cn: `${一件.编码} 第 ${一件.排 + 1} 类的衣服`,
        en: `${一件.编码} coat, group ${一件.排 + 1}`,
      }));
      格.setAttribute('aria-pressed', 亮 ? 'true' : 'false');
      格.replaceChildren(亮 ? 画衣服(一件.格子) : 画问号());
    }
  }

  function 点了一格(一件) {
    if (!已解锁().has(一件.键)) return;
    // 拿的是图鉴自己那份摆正过的格子：装进 4×5 的格子纸一定放得下
    const 格子 = 一件.格子.map((c) => ({ ...c }));
    /*
      这儿**不说话**：接下来沙盒那边一定会开口（导航念「自己折」、格子纸满六格又念
      「往右拖，把衣服折起来」），说() 是后一句掐掉前一句的，
      在这儿再说一句只会被掐掉 —— 留着就是一句永远听不见的话。
    */
    for (const 听 of 装回听众) {
      try {
        听(格子, 一件);
      } catch {
        // 一个听众炸了不能连累别的
      }
    }
  }

  /** 孩子不认字，鼠标扫过去先听见这一格是什么状态 */
  function 扫过一格(一件) {
    if (已解锁().has(一件.键)) 念一下(图鉴话().找到了);
    else 念一下(图鉴话().还没找到);
  }

  // ------------------------------------------------------------------
  // 数点点 —— 点那一排的点记号，跟方方一起数
  //
  // 书上练一练 p16 教的是按行分组给衣服分类（141 / 231 / 222 / 33）。
  // 那几个数字本来就没法写给不认字的孩子看，图鉴早就把它画成了点；
  // 这个彩蛋只是让他**把那些点数出来**——分类法不用讲，数着数着就数进去了。
  //
  // 几个点、怎么念、说的算不算对，全在 domain/collectionCount.js（那边有测试）。
  // 这儿只管会动的部分：点一个个亮起来、麦克风、数错了重来。
  // ------------------------------------------------------------------

  /**
   * 这一局的号码牌。孩子切走玩法、或者去点别的排，号就变了 ——
   * 正在等孩子说话、或者正在念一半的那一局照着号一对，发现不是自己了就收摊。
   */
  let 数数局 = 0;
  let 数着的排 = null;
  let 等着的答 = null;
  /** @type {ReturnType<typeof 借麦克风>|null} 数点点时借来的那只坞，数完还回去 */
  let 麦 = null;

  const 等等 = (毫秒) => new Promise((好) => setTimeout(好, 毫秒));
  const 随一句 = (们) => 们[Math.floor(Math.random() * 们.length)];

  /**
   * 数点点用的是**全站那一只麦克风坞**（`/shared/js/问答.js`）：数点点开始时借过来，
   * 数完（或者孩子切走）还回去（票 08）。
   *
   * 从前这儿自己长了一只，因为坞是个模块级单例，沙盒那边挂着一个永远在等的
   * `听一句()`（孩子喊「穿衣服！」那条线）—— 一来抢坞，沙盒那个 await 就再也等不到。
   * 现在借还是有规矩的：借走时上一位的 await 当场解成「被打断」，
   * 它的循环干净退场，孩子切回穿衣服时沙盒重新借、重新起，口令照样灵。
   *
   * 坞本来就摆在屏幕正下方，跟从前那只位置一样，孩子看不出换过东西。
   */
  function 开台() {
    if (!麦?.是主人()) 麦 = 借麦克风('数点点');
    麦.备选行?.replaceChildren();
    叫出麦克风(true);
    麦.状态('待命');
  }

  function 收台() {
    麦?.收起();
    麦?.还回去();
    麦 = null;
    /*
      只在图鉴还在台上时才把坞收回去。孩子从图鉴切去别的玩法时，
      main.js 已经先按新玩法摆过坞的显隐了（切去沙盒是「冒出来」），
      这会儿再收一次就把沙盒的麦克风也一并藏了。
    */
    if (在前) 叫出麦克风(false);
  }

  /**
   * 让坞冒出来／缩回去。
   *
   * 坞的挂点是 position:fixed 挂在面板外头的，main.js 切玩法时把它收下去了
   * （它认为坞只属于沙盒）。数点点要用嘴巴，这一下把它请出来；数完再收回去 ——
   * 图鉴平时是个纯看的页面，不该杵着一个没人接的麦克风。
   */
  function 叫出麦克风(要不要) {
    if (typeof document === 'undefined') return;
    document.getElementById('麦克风坞挂点')?.classList.toggle('收着', !要不要);
  }

  /** 把孩子这一句交给正在等的那个 await（点按钮答的也走这儿） */
  function 交答案(值) {
    const 好 = 等着的答;
    等着的答 = null;
    好?.(值);
    麦?.打断自己(); // 手点了备选：把坞上支着的那只耳朵收回来，别再录一遍
  }

  /** 没听清两次：亮出几颗点的按钮，用手点也能答。它们住在坞的备选行里 */
  function 亮备选(点数) {
    const 备选行 = 麦?.备选行;
    if (!备选行 || 备选行.childElementCount) return;
    for (const 几 of 数数备选(点数)) {
      const 钮 = document.createElement('button');
      钮.type = 'button';
      钮.className = '数数备选钮';
      // 钮上只有点，数字只给读屏
      钮.setAttribute('aria-label', 选({ cn: `${读量词(几, 'cn')}个点`, en: `${读量词(几, 'en')} dots` }));
      for (let i = 0; i < 几; i++) {
        const 点 = document.createElement('span');
        点.className = '图鉴点';
        钮.appendChild(点);
      }
      钮.addEventListener('click', () => {
        音效.点一下();
        交答案(读数(几)); // 点出来的和说出来的走同一条判定（判数数 认中文数字）
      });
      备选行.appendChild(钮);
    }
  }

  /**
   * 等孩子说一句（或者点一个备选钮）。
   *
   * 录音、转写、坞的长相全由借来的那把麦克风管；这儿只负责把「点按钮」这条路
   * 和「说话」这条路汇到同一个 await 上。
   *
   * @returns {Promise<string|null>} 坞被别人借走了也是 null（外面 `还在()` 会发现）
   */
  function 等一句() {
    const 这把麦 = 麦;
    return new Promise((好) => {
      let 完 = false;
      const 出 = (值) => { if (完) return; 完 = true; 等着的答 = null; 好(值); };
      等着的答 = 出;
      if (!这把麦?.是主人()) return; // 没坞（自动化测试）：只等按钮
      try {
        这把麦.听一句(数数热词()).then(
          (文) => 出(是被打断(文) ? null : 文),
          () => 出(null),
        );
      } catch {
        // 坞还没装起来（听一句 会当场抛）。用手点备选照样能答
        出(null);
      }
    });
  }

  /** 方方一个点一个点地数给他听，屏幕上跟着一个一个亮 */
  async function 一起数(排, 行序, 还在) {
    const 点数 = 排.点数[行序];
    const { 点们 } = 排.点行们[行序];
    const 念完 = 说(一起数吧(点数));
    for (const 点 of 点们) {
      if (!还在()) break;
      点.classList.add('数到');
      音效.点一下();
      await 等等(560);
    }
    await 念完;
    await 等等(200);
    for (const 点 of 点们) 点.classList.remove('数到');
  }

  /**
   * 问一行：这一行有几个点？
   *
   * 三次机会（同第3讲的规矩）：错一次鼓励，错两次一起数一遍，错三次直接告诉他，
   * 然后照样往下走 —— 绝不卡关。「没听清」不算错，不扣机会。
   */
  async function 问一行(排, 行序, 还在) {
    const 点数 = 排.点数[行序];
    const 行 = 排.点行们[行序];
    行.行元素.classList.add('在数');
    // 换一行就把上一行的备选撤了：那几颗点是给上一行准备的，也别让孩子还没数就先看见答案
    麦?.备选行?.replaceChildren();
    try {
      let 错次 = 0;
      let 没听清次 = 0;
      const 问句们 = 数话().问句们;
      await 说(问句们[Math.min(行序, 问句们.length - 1)]);

      // 封个顶：一直「没听清」的话不能在这一行里原地打转打到天荒地老
      for (let 轮 = 0; 轮 < 8 && 还在(); 轮++) {
        const 文 = await 等一句();
        if (!还在()) return false;
        const 裁 = 判数数(文, 点数);

        if (裁 === '对') {
          音效.答对();
          行.行元素.classList.add('数过了');
          await 说(随一句(数话().表扬们));
          return true;
        }

        if (裁 === '错') {
          错次 += 1;
          音效.答错();
          if (错次 >= 3) {
            await 一起数(排, 行序, 还在);
            if (!还在()) return false;
            await 说(告诉他(点数));
            return false;
          }
          await 说(随一句(数话().鼓励们));
          if (错次 === 2) await 一起数(排, 行序, 还在);
          continue;
        }

        没听清次 += 1;
        if (没听清次 >= 2) {
          亮备选(点数);
          await 说(数话().用手点吧);
        } else {
          await 说(随一句(数话().没听清们));
        }
      }
      return false;
    } finally {
      行.行元素.classList.remove('在数');
    }
  }

  /** 点了一排的点记号：从第一行数到最后一行，数完把整排念一遍（「一、四、一！」） */
  async function 玩数点点(排) {
    音效.点一下();
    if (数着的排 === 排) {
      停数点点({ 说一句: true }); // 再点一下同一排 = 不数了
      return;
    }
    停数点点(); // 换一排数：上一排立刻收摊

    const 这一局 = ++数数局;
    // 号没变、坞还在手上，这一局才算还在跑。坞被别的玩法借走了也是「不数了」
    const 还在 = () => 这一局 === 数数局 && Boolean(麦?.是主人());
    数着的排 = 排;
    排.记号.classList.add('数着');
    for (const { 行元素 } of 排.点行们) 行元素.classList.remove('数过了');
    开台();
    clearTimeout(进场定时); // 进场那句「你已经找到几件」别追上来把数数打断

    try {
      await 说(数话().开场语);
      for (let 行序 = 0; 行序 < 排.点数.length; 行序++) {
        if (!还在()) return;
        await 问一行(排, 行序, 还在);
      }
      if (!还在()) return;
      音效.星星();
      await 说(整排念完(数数题(排.编码)));
    } finally {
      if (还在()) 停数点点();
    }
  }

  /** 收摊：切走玩法、换一排、或者孩子再点一下同一排 */
  function 停数点点({ 说一句 = false } = {}) {
    数数局 += 1;
    交答案(null); // 正等着孩子说话的那个 await 立刻放行，它自己会发现号变了
    if (数着的排) {
      数着的排.记号.classList.remove('数着');
      for (const { 行元素, 点们 } of 数着的排.点行们) {
        行元素.classList.remove('在数');
        for (const 点 of 点们) 点.classList.remove('数到');
      }
      数着的排 = null;
    }
    收台();
    if (说一句) 说(数话().不数啦);
  }

  // ------------------------------------------------------------------
  // 发现新衣服
  // ------------------------------------------------------------------

  /** 沙盒里刚折成的这一格亮起来的时候，左边那个图鉴图标也跳两下 */
  function 图标跳一跳() {
    const 按 = globalThis.window?.__导航?.按钮元素?.('图鉴');
    if (!按) return;
    按.classList.remove('图鉴新发现');
    void 按.offsetWidth; // 逼浏览器重算一次，连着发现两件才会再跳一次
    按.classList.add('图鉴新发现');
    clearTimeout(跳定时);
    跳定时 = setTimeout(() => 按.classList.remove('图鉴新发现'), 2200);
  }

  function 收起大庆祝() {
    clearTimeout(庆祝定时);
    庆祝幕?.classList.remove('来了');
  }

  function 放大庆祝() {
    if (typeof document === 'undefined') return;
    if (!庆祝幕) {
      庆祝幕 = 造大庆祝();
      庆祝幕.addEventListener('click', 收起大庆祝);
      document.body.appendChild(庆祝幕);
    }
    /*
       纸屑得落出屏幕底边才像落完。这一层在舞台外面，量的就该是真窗口 ——
       每次放之前现算一遍（转屏、改窗口大小之后再集齐一件，用的是新的数）。
       多给 140px：屑本身有高度，还从 -8% 起跳。
    */
    庆祝幕.style.setProperty('--落多远', `${(window.innerHeight || 800) + 140}px`);
    庆祝幕.classList.add('来了');
    clearTimeout(庆祝定时);
    庆祝定时 = setTimeout(收起大庆祝, 大庆祝时长);
  }

  /**
   * 沙盒里折成了一件衣服，交给图鉴收。
   *
   * 判重无视旋转和翻转（键就是 netFingerprint）—— 转个方向重画一遍不算新的。
   *
   * @param {Array<{row, col}>} 格子 折成正方体的那张衣服
   * @param {{接着说?: string}} [怎么说] 新衣服那一句后面接一句沙盒自己的话，
   *   合成同一句说出去。分两次说的话，后一句会把「发现新衣服」拦腰打断。
   * @returns {{认得: boolean, 键: string|null, 编码: string|null, 新: boolean, 齐了: boolean, 数: number}}
   */
  function 收下衣服(格子, { 接着说 = '' } = {}) {
    const 一件 = 认衣服(格子);
    if (!一件) return { 认得: false, 键: null, 编码: null, 新: false, 齐了: false, 数: 进度.图鉴数() };

    const 新 = 进度.解锁图鉴(一件.键); // 只有第一次才 true，第二次画同一种不再庆祝
    const 数 = 进度.图鉴数();
    const 齐了 = 新 && 数 >= 总件数();

    if (新) {
      刷新(); // 订阅那边也会刷，但先刷一次，下面加「刚亮」时那一格已经是亮的了
      const 格 = 格元素.get(一件.键);
      格?.classList.remove('刚亮');
      void 格?.offsetWidth;
      格?.classList.add('刚亮');
      图标跳一跳();

      if (齐了) {
        放大庆祝();
        说(图鉴话().集齐了);
      } else {
        说(模板.发现新衣服(接着说));
      }
    }

    return { 认得: true, 键: 一件.键, 编码: 一件.编码, 新, 齐了, 数 };
  }

  // 「重来」把进度清了、或者别处点亮了一格，图鉴自己跟着变
  退订们.push(进度.订阅(() => 刷新()));

  /**
   * 换了语言：读屏标签重挂一遍。
   *
   * 图鉴上一个字都没有 —— 编码画成的是点，没找到的是个问号，缩略图是色块 ——
   * 所以像素一点没变，换的只有读屏认的那几句。正数着点点的话就当场收摊：
   * 那条链子上挂着一个用旧语言问出去的问题，接着数下去两边就串了台。
   */
  退订们.push(
    订阅语言(() => {
      const 数着呢 = Boolean(数着的排);
      刷新();
      for (const 一排 of 排们) {
        一排.记号.setAttribute(
          'aria-label',
          选({ cn: '数一数这一排的点点', en: 'Count the dots in this row' }),
        );
      }
      if (数着呢) 停数点点();
    }),
  );

  刷新();

  return {
    元素: 板,
    刷新,
    收下衣服,
    /** 现在攒了几件 */
    get 数() {
      return 进度.图鉴数();
    },
    总件数,
    // 自动化验收要拿得到这 11 件的格子（页面本身不用它们）
    全部衣服,
    认衣服,
    /** 自动化验收和「装回沙盒」都要拿得到某一格 */
    格元素: (键) => 格元素.get(键) ?? null,
    /** 切到图鉴这一页：等导航把「衣服图鉴」念完，再报一下攒了多少 */
    进场({ 等一下 = 等名字念完 } = {}) {
      在前 = true;
      // 数点点那几句先在后端备好（不出声），孩子点下去就有声音，不用先听一段安静
      if (!备过话) {
        备过话 = true;
        try {
          备话((语) => 数点点台词(编码顺序, 语));
        } catch {
          // 备不上就现合成，慢一点而已，不能因此打不开图鉴
        }
      }
      clearTimeout(进场定时);
      进场定时 = setTimeout(() => {
        if (数着的排) return; // 正跟方方数着点点呢，别插嘴
        const 数 = 进度.图鉴数();
        if (数 === 0) 念一下(图鉴话().一件都没有);
        else if (数 >= 总件数()) 念一下(图鉴话().全在这儿了);
        else 念一下(模板.找到几件(数));
      }, 等一下);
    },
    /**
     * 刚换了语言，用新语言把「攒了多少」重报一遍（main.js 只叫在台上的那一个）。
     * 图鉴的「当前指令」就是这一句 —— 孩子到这一页要知道的只有「我集了几件」。
     */
    重读指令() {
      if (!在前) return false;
      clearTimeout(进场定时);
      const 数 = 进度.图鉴数();
      if (数 === 0) 说(图鉴话().一件都没有);
      else if (数 >= 总件数()) 说(图鉴话().全在这儿了);
      else 说(模板.找到几件(数));
      return true;
    },
    /** 孩子没等报完就切走了：那句话别再追出来盖掉别人的话，数点点也当场收摊 */
    离场() {
      clearTimeout(进场定时);
      在前 = false; // 先落这一笔：停数点点 收坞时要靠它认出「已经不在台上了」
      停数点点(); // 里头会把借来的坞还回去
    },
    收起大庆祝,
    /** 自动化验收和调试用：直接开某一排的数点点 */
    数点点(编码) {
      const 排 = 排们.find((一排) => 一排.编码 === 编码);
      if (!排) return false;
      玩数点点(排);
      return true;
    },
    停数点点,
    /**
     * 孩子点了已解锁的一格，把那张衣服装回沙盒（沙盒那边接）。
     * @returns {() => void} 退订
     */
    订阅装回沙盒(听) {
      装回听众.add(听);
      return () => 装回听众.delete(听);
    },
    dispose() {
      clearTimeout(庆祝定时);
      clearTimeout(跳定时);
      clearTimeout(进场定时);
      停数点点(); // 里头会把借来的坞还回去
      for (const 退 of 退订们) 退();
      庆祝幕?.remove();
      庆祝幕 = null;
    },
  };
}
