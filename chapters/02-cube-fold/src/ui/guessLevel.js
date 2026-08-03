import * as THREE from '/shared/vendor/three/three.module.js';

import { 题库, 题卡列数, 题卡行数, 摆中间 } from '../data/bookQuestions.js';
import { 台词, 模板 } from '../data/台词表.js';
import { CELL_SIZE, foldResult } from '../domain/net.js';
import { cellStyle } from '../domain/palette.js';
import { 听能不能, 猜热词 } from '../domain/guessVoice.js';
import { 当前语言, 订阅语言, 选 } from '/shared/js/语言.js';
import { 画实体 } from '/shared/js/实体图.js';
import { createScene } from '../render/scene.js';
import { FoldedNet } from '../render/foldedNet.js';
import { makeCellTexture } from '../render/cellTexture.js';
import { 创建穿不上提示, 失败视角 } from '../render/failureCue.js';
import { 创建方方 } from '../render/fangfang.js';
import { 进度 as 默认进度 } from '../state/progress.js';
import { 说 as 默认朗读, 备话 } from '/shared/js/说话.js';
import { 借麦克风, 是被打断 } from '/shared/js/问答.js';
import { 音效 } from '/shared/js/音效.js';
import { 折纸声 } from '../audio/paperSound.js';

/**
 * 猜一猜（判断关）—— 方方举着一张题卡问「这件我能穿上吗？」
 *
 * 书上第 17 页例题2 的四个形状 + 同一页练一练的四个 + 第 20 页闯关一的九个，
 * 一共 17 题，一个不多一个不少。孩子做完可以捧着书一题一题核对，
 * 所以题库照抄不改（见 data/bookQuestions.js）。
 *
 * 规矩只有一条：**必须先猜，才给折**。
 * 先折了再问，孩子就只是在念答案；先押上自己的判断，折开的那几秒才有他的份。
 *
 * 怎么答都行：对着麦克风喊「能！」「不能！」（说法放宽，见 domain/guessVoice.js），
 * 或者点 ✓ / ✗ 两个大按钮。嗓子哑了、麦克风坏了、后端没配 key —— 手永远兜得住。
 *
 * 答错不卡关，三次机会（同第3讲的问答规矩）：
 *   错一次 → 鼓励再试；错两次 → 把衣服折一半给他看（半折观察态就是提示本身）；
 *   错三次 → 直接告诉他答案，照样往下走。一道题绝不把孩子钉在原地。
 *
 * 一道题收尾时**方方当场试穿**：能穿上就折拢、转圈跳舞；穿不上就折到卡住，
 * 重叠染红、漏洞框黄，方方先喊痒再打喷嚏 —— 跟沙盒里是同一套反应，
 * 「穿不上」长什么样全站只教一次。对错不是大人说了算，是穿给他看的。
 */

// ---------------------------------------------------------------------------
// 纯逻辑：走到第几题、对没对、几只猫猫
// ---------------------------------------------------------------------------

const 题号们 = 题库.map((一题) => 一题.号);

const 答过了 = (作答, 号) => typeof 作答?.[号] === 'boolean';

/**
 * 该做第几题：书上的次序里第一道还没答的。
 *
 * 孩子玩到一半跑掉是常态，回来接着上次那道 —— 从头再来的话，
 * 他得把答过的重答一遍才够得着新题，猫猫看起来也像没在长。
 *
 * @param {Record<string, boolean>} 作答
 * @returns {number|null} 全答完了是 null
 */
export function 第几题(作答 = {}) {
  const 下标 = 题号们.findIndex((号) => !答过了(作答, 号));
  return 下标 === -1 ? null : 下标;
}

/** 17 题全答过了没有（答错也算答过，不然孩子会被卡在同一题上过不去） */
export function 都做完了(作答 = {}) {
  return 第几题(作答) === null;
}

/**
 * 孩子猜的跟这张衣服折起来的结果对不对得上。
 * 题库里那栏「能合上」本身就是 canClose 现算的（ADR-0001），这里不查第二张表。
 *
 * @param {boolean} 猜的能合上
 * @param {{能合上: boolean}} 一题
 */
export function 判对错(猜的能合上, 一题) {
  return Boolean(猜的能合上) === 一题.能合上;
}

/**
 * 17 只猫猫各自的状态。
 * 答错要跟没答分得开 —— 都是灰的话，孩子看不出自己走到哪儿了。
 *
 * @returns {Array<'对'|'错'|'没答'>}
 */
export function 猫猫队(作答 = {}) {
  return 题号们.map((号) => {
    if (!答过了(作答, 号)) return '没答';
    return 作答[号] ? '对' : '错';
  });
}

/** 点亮了几只猫猫 */
export function 答对几只(作答 = {}) {
  return 猫猫队(作答).filter((一只) => 一只 === '对').length;
}

// ---------------------------------------------------------------------------
// 方方在这一关说的话
//
// 句子本身住在 data/台词表.js（全站一份，开场时统一预热进 TTS 磁盘缓存），
// 这儿只把它们摊开成本地名字，底下的流程照原样读。
//
// 猫猫只给「第一次就猜对」的（见 试穿 的记法）：这一关只有两个答案，
// 猜错一次再换一个必然对 —— 「最终答对就点亮」的话十七只猫猫必定全亮，
// 收尾那句「你收到了十七只小猫」就成了空话，「重玩」也再没什么可争取的。
// 改口才对的说 `改口了`，不说「你真棒」，同一个道理。
// ---------------------------------------------------------------------------

/*
  **两语的台词一律现取**（`话()` 是个函数）。摊成模块顶上的常量看着清爽，
  代价是把中文那一句焊死在模块加载的那一刻 —— 孩子切成英文，方方还在念中文。
*/
const 话 = () => 台词().猜一猜;
/** 「穿不上」长什么样全站只教一次，跟沙盒是同两句话 */
const 共用话 = () => 台词().共用;

/** 这一关要备进 TTS 磁盘缓存的每一句（按语取） */
function 本关台词(语 = 当前语言()) {
  const 猜 = 台词(语).猜一猜;
  const 共 = 台词(语).共用;
  return [
    猜.问句, ...猜.表扬们, 猜.改口了, ...猜.鼓励们, ...猜.没听清们, 猜.用手也行,
    猜.提示语, 猜.教答案.能, 猜.教答案.不能, 猜.穿上了, 共.痒, 共.漏风,
  ];
}

const 随一句 = (们) => 们[Math.floor(Math.random() * 们.length)];

/**
 * 这一关的小助手：一题一只小猫。
 *
 * 素材还没生成的时候 画实体 自己回落成 🐱，位置和大小一个像素都不差
 * （`.实体图` 是 1em 见方 = 原先那个绘文字的字号盒）—— 图到位的那天，
 * 这两处什么都不用改。
 */
const 画一只猫 = () => 画实体('小猫', '🐱', { 类名: '实体图' });

// ---------------------------------------------------------------------------
// 样式：本模块自己注入，不写进 styles.css
//
// 跟图鉴、纸样一个约定：功能自带的样式跟着功能的 JS 走。
// 起因是这几张票由不同的 agent 并行做，styles.css 谁都改就必然互相覆盖。
// 断网可用这条不受影响 —— 一个字节都不从网上取。
//
// 麦克风坞是全站那一只（/shared/js/问答.js），进场时借过来（票 08）。
// 借的时候把它搬进底下那排按钮里排在 ✅❌ 中间 —— 它原来的挂点是 position:fixed，
// 会压在这排按钮上。`.麦位` 是那个搬进来的位子，用 display:contents，
// 好让坞本人直接当 .猜键排 的 flex 子项：坞睡着（display:none）时这一格连间距都不占，
// 跟从前一模一样。
// ---------------------------------------------------------------------------

const 样式 = `
/*
  尺寸一律是定死的舞台像素，不再写 vh / vw —— 整讲画在 1280 × 740 的基准舞台上
  （docs/adr/0004；触靶下限的推导在 styles.css 文件头）。窗口单位量的是**窗口**：
  手机横屏 402pt 高的视口里每一个 clamp() 都会压到下限，整屏东西先小一圈、
  再被舞台缩一次，孩子什么都按不着。换上的数就是它们在 1280 × 740 上本来的值。

  这一屏的竖向账：26 + 猫猫 34 + 20 + 题卡那一行 1fr + 20 + 猜键排 116 + 26 = 242 定死，
  余下的全归中间那一行。**这一屏压不坏也裁不掉**：中间是 minmax(0, 1fr)，
  题卡自己还有 max-height: 100%，舞台矮了它跟着缩 —— 所以它不参与「基准高该多少」
  那笔账（那笔账是贴水果和导航定的，见 main.js 的 基准舞台尺寸）。
  740 的舞台上中间那行有 498，题卡 420 宽、按 6/4 是 280 高，宽宽松松。
*/
.判断关 {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 20px;
  height: 100%;
  padding: 26px 32px;
  box-sizing: border-box;
}

/* --- 猫猫排：走到哪儿了，一眼看见 --------------------------------------- */

.猫猫排 { display: flex; justify-content: center; gap: 8px; }

/* 定死 34px（原来 clamp 到窗口宽）：猫猫不是触靶（点不着也不用点），
   但它是「我走到哪儿了」唯一的读法 —— 十七只缩成小灰点，孩子就读不出来了。
   十七只 × 34 + 十六道 8px 的缝 = 706，1280 的舞台里排得开。 */
.一只猫 {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  line-height: 1;
  border-radius: 50%;
  transition: transform 0.25s ease, filter 0.25s ease, opacity 0.25s ease;
}

.一只猫.没答 { filter: grayscale(1); opacity: 0.26; }
.一只猫.错   { filter: grayscale(0.75); opacity: 0.48; }
.一只猫.对   { filter: none; opacity: 1; }
.一只猫.刚点亮 { animation: 猫猫蹦 0.6s ease; }

@keyframes 猫猫蹦 {
  0%   { transform: scale(1); }
  35%  { transform: scale(1.75) rotate(-9deg); }
  100% { transform: scale(1); }
}

/* --- 中间：左边题卡，右边舞台 ------------------------------------------- */

.猜台 {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
  align-items: center;
  gap: 26px;
  min-height: 0;
}

/* 题卡是给孩子看的，不是给他点的（他答的是底下那两个键），所以尺寸只要「看得清、
   换题不跳」：定死 420 宽，max-height 兜住屏幕矮的时候，连格子一起等比缩 */
.题卡 {
  display: grid;
  grid-template-columns: repeat(var(--题卡列数), 1fr);
  gap: 7px;
  aspect-ratio: var(--题卡列数) / var(--题卡行数);
  width: min(100%, 420px);
  max-height: 100%;
  margin: 0 auto;
  padding: 20px;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.72);
  border-radius: 26px;
  box-shadow: 0 10px 30px rgba(43, 51, 82, 0.1);
  transform-origin: 50% 90%;
}

/*
  举着的那张卡 —— 轻轻地一起一伏，像被举在手里，不是钉在墙上。
  只在等孩子作答的时候举着；折起来验证的时候它就该安静下来，
  孩子那会儿要看的是右边的方方。
*/
.判断关.在问 .题卡 { animation: 举题卡 3.4s ease-in-out infinite; }

@keyframes 举题卡 {
  0%, 100% { transform: translateY(0) rotate(-0.7deg); }
  50%      { transform: translateY(-7px) rotate(0.7deg); }
}

/* 空格子连虚线框都不画：书上就是白纸上摆着几个方块，别给孩子多余的东西看 */
.题格 {
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  line-height: 1;
}

.题格.有 {
  border: 2px solid rgba(255, 255, 255, 0.75);
  box-shadow:
    inset 0 0 0 3px rgba(255, 255, 255, 0.7),
    0 4px 10px rgba(43, 51, 82, 0.16);
}

.判断关舞台 { position: relative; width: 100%; height: 100%; min-height: 0; }
.判断关舞台 canvas { display: block; width: 100%; height: 100%; }

/* --- 底下的按钮和麦克风 -------------------------------------------------- */

.猜键排 {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 31px;
  min-height: 116px; /* 定死：92px 的键 + 上下留一点，见 .判断关 那笔账 */
}

/* 借来的麦克风坞就住在这儿。display:contents = 这个盒子本身不占位 */
.麦位 { display: contents; }

/*
  ✅ / ❌ 是这一关孩子唯一要按的东西，所以定死在触靶红线上（≥80 基准 px，docs/adr/0004）。
  从前是 clamp(58px, 9vh, 96px)：整讲上了基准舞台之后 vh 量的还是**窗口**，
  手机横屏 402pt 高的视口里 9vh = 36px、直接掉到 58px 那个下限，再被舞台缩一次
  就只剩 28pt —— 孩子按十次中不了三次，而这一关他只有这两个键可按。
  92px 落到玻璃上 44.5pt（推导见 styles.css 文件头）。两个键中间隔着 31px 和
  一只麦克风，各自都是「另一个答案」，所以是真放大，不是加隐形热区。
*/
.猜键 {
  width: 92px;
  height: 92px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: #fff;
  font-size: 46px; /* 跟着钮一起定死：92px 的钮里浮一个 28px 的勾，看着像没画完 */
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(43, 51, 82, 0.16);
  transition: transform 0.14s ease, box-shadow 0.14s ease;
}

/* 装饰性 hover 只给鼠标：触屏上会粘着不散（docs/adr/0004） */
@media (hover: hover) {
  .猜键:hover { transform: scale(1.09); box-shadow: 0 12px 26px rgba(43, 51, 82, 0.22); }
}
.猜键:active { transform: scale(0.96); }
.猜键:focus-visible { outline: 3px solid var(--高亮, #4f6ef7); outline-offset: 4px; }

.猜键.能 { background: linear-gradient(160deg, #d9f7e6, #a9ecc6); }
.猜键.不能 { background: linear-gradient(160deg, #ffe0e0, #ffc0c0); }
.猜键.下一题 { background: linear-gradient(160deg, #dfe6ff, #b9c8ff); }
.猜键.重玩 { background: linear-gradient(160deg, #fff0d4, #ffe0a8); }
.猜键[hidden] { display: none; }

/* 猜对了整张题卡蹦一下，比任何文字都快 */
.判断关.猜对了 .题卡 { animation: 题卡欢呼 0.7s ease; }

@keyframes 题卡欢呼 {
  0%   { transform: scale(1) rotate(0deg); }
  30%  { transform: scale(1.07) rotate(-2.5deg); }
  60%  { transform: scale(1.05) rotate(2.5deg); }
  100% { transform: scale(1) rotate(0deg); }
}

/* --- 十七题全做完 ------------------------------------------------------- */

.收尾庆祝 {
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

.收尾奖杯 {
  font-size: 128px;
  line-height: 1;
  animation: 奖杯蹦 1.1s ease infinite;
}

.收尾猫猫 {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 9px;
  max-width: 80%;
}

@keyframes 奖杯蹦 {
  0%, 100% { transform: translateY(0) rotate(-4deg); }
  50%      { transform: translateY(-11px) rotate(4deg); }
}

@media (prefers-reduced-motion: reduce) {
  .一只猫.刚点亮,
  .判断关.在问 .题卡,
  .判断关.猜对了 .题卡,
  .收尾奖杯 { animation: none; }
}
`;

let 样式挂了 = false;
function 挂样式() {
  if (样式挂了 || typeof document === 'undefined') return;
  样式挂了 = true;
  const 标签 = document.createElement('style');
  标签.dataset.来自 = '判断关';
  标签.textContent = 样式;
  document.head.appendChild(标签);
}

// ---------------------------------------------------------------------------
// 界面
// ---------------------------------------------------------------------------

/** 折给孩子看要花多久。太快看不清折痕是怎么转的，太慢他会跑掉 */
const 折叠时长 = 1900;
/** 提示那一下折到几分。半折观察态：看得见几片纸开始互相靠拢，又还没揭晓答案 */
const 提示折到 = 0.5;
/** 折到底以后隔多久才放出下一题的键 —— 键一冒出来，孩子就只想按它，不看正方体了 */
const 才放下一题键 = 1600;
/** 导航念完玩法名字要这么久。抢在前面说，孩子听见的是被掐断的半句 */
const 等名字念完 = 1700;
/** 脸从那一片表面浮出来多少（格），够躲开纸的厚度、不至于飘在半空 */
const 浮出表面 = 0.14;
/** 朝天／朝地的那一片扣多少分，免得脸爬到正方体顶上去（缘由见 main.js 的 方方站哪儿） */
const 朝天要扣的分 = 0.35;

/**
 * 每道题开头的机位方向。
 *
 * 上一题要是穿不上，镜头被「失败视角」转到过一个专看红黄的怪角度。
 * 不转回来，下一题那张摊平的衣服就会以一个近乎贴着地面的仰角侧着出现 ——
 * 孩子第一眼看到的是一条缝，根本没法判断。
 */
const 开局机位 = new THREE.Vector3(0, 4.6, 6.4).normalize();

/**
 * @param {HTMLElement|null} 容器 导航给的那块面板
 * @param {{进度?: object, 说?: (文本: string) => Promise<void>}} [依赖]
 */
export function 创建判断关(容器, { 进度 = 默认进度, 说 = 默认朗读 } = {}) {
  if (!容器) return null;
  挂样式();

  容器.classList.add('判断关');
  容器.innerHTML = '';

  // --- 搭界面 ---------------------------------------------------------------

  const 猫猫排 = document.createElement('div');
  猫猫排.className = '猫猫排';
  // 屏幕上一个字都没有，但读屏得说得出走到哪儿了
  猫猫排.setAttribute('role', 'status');
  const 猫们 = 题库.map(() => {
    const 一只 = document.createElement('span');
    一只.className = '一只猫';
    一只.setAttribute('aria-hidden', 'true');
    一只.appendChild(画一只猫());
    猫猫排.appendChild(一只);
    return 一只;
  });

  const 猜台 = document.createElement('div');
  猜台.className = '猜台';

  const 题卡 = document.createElement('div');
  题卡.className = '题卡';
  题卡.style.setProperty('--题卡列数', 题卡列数);
  题卡.style.setProperty('--题卡行数', 题卡行数);
  const 题格们 = [];
  for (let i = 0; i < 题卡行数 * 题卡列数; i += 1) {
    const 格 = document.createElement('div');
    格.className = '题格';
    格.setAttribute('aria-hidden', 'true');
    题卡.appendChild(格);
    题格们.push(格);
  }

  const 舞台位 = document.createElement('div');
  舞台位.className = '判断关舞台';
  猜台.append(题卡, 舞台位);

  /** 按钮上只有图标，字只给读屏和自动化验收 —— 换语言时统一重挂一遍 */
  const 键名们 = new Map();
  const 造键 = (样式名, 图标, 名字) => {
    const 按 = document.createElement('button');
    按.type = 'button';
    按.className = `猜键 ${样式名}`;
    按.setAttribute('aria-label', 选(名字));
    键名们.set(按, 名字);
    const 图 = document.createElement('span');
    图.setAttribute('aria-hidden', 'true');
    图.textContent = 图标;
    按.appendChild(图);
    return 按;
  };
  const 猜键排 = document.createElement('div');
  猜键排.className = '猜键排';
  const 能键 = 造键('能', '✅', { cn: '能穿上', en: 'It fits' });
  const 不能键 = 造键('不能', '❌', { cn: '穿不上', en: 'It does not fit' });
  const 下一题键 = 造键('下一题', '➡️', { cn: '下一题', en: 'Next one' });
  const 重玩键 = 造键('重玩', '🔄', { cn: '再玩一次', en: 'Play again' });

  /*
    麦克风：全站就那一只坞（/shared/js/问答.js）。进场时借过来搬进这个位子，
    离场时还回去 —— 沙盒的 一直听着() 循环会拿到「被打断」自己退场，
    孩子切回穿衣服时它重新借、重新起，喊「穿衣服」照样灵（票 08）。
  */
  const 麦位 = document.createElement('div');
  麦位.className = '麦位';

  猜键排.append(能键, 麦位, 不能键, 下一题键, 重玩键);
  容器.append(猫猫排, 猜台, 猜键排);

  // --- 舞台：第一次进这个玩法才建，孩子不来就一分钱不花 ----------------------

  /** @type {ReturnType<typeof createScene>|null} */
  let 舞台 = null;
  /** 衣服挂在这个组里；方方的情绪动的是这个组，折叠引擎动的是组里那件衣服 */
  let 衣架 = null;
  /** @type {ReturnType<typeof 创建方方>|null} */
  let 方方 = null;
  /** @type {FoldedNet|null} */
  let 衣服 = null;
  let 提示 = null;
  let 上一帧 = 0;
  const 材质池 = new Map();

  function 槽位材质(槽位) {
    if (!材质池.has(槽位)) {
      材质池.set(
        槽位,
        new THREE.MeshBasicMaterial({
          map: makeCellTexture(cellStyle(槽位)),
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      );
    }
    return 材质池.get(槽位);
  }

  function 备好舞台() {
    if (舞台) return 舞台;
    舞台 = createScene(舞台位);
    衣架 = new THREE.Group();
    衣架.name = '衣架';
    舞台.scene.add(衣架);
    方方 = 创建方方(舞台.scene, 衣架);
    上一帧 = performance.now();
    舞台.onFrame(() => {
      const 此刻 = performance.now();
      const 秒 = Math.min(0.1, (此刻 - 上一帧) / 1000);
      上一帧 = 此刻;
      提示?.更新(此刻 / 1000);
      方方?.更新(秒, 方方站哪儿());
    });
    return 舞台;
  }

  /**
   * 把镜头退到看得见整件衣服的地方。
   *
   * 比 boundingBox 再放宽一圈：这块面板比沙盒窄，正方体正好卡满画面时，
   * 红膜和黄框贴着边缘，孩子看不出毛病长在哪一面上。
   * boundingBox() 返回的是衣服自己那一份，会被下一帧改掉，所以先拷一份再撑。
   */
  function 看得全() {
    if (!舞台 || !衣服) return;
    const 盒 = 衣服.boundingBox().clone();
    盒.expandByScalar(0.3);
    舞台.框住(盒);
  }

  function 收掉衣服() {
    提示?.dispose();
    提示 = null;
    if (衣服 && 衣架) 衣架.remove(衣服.object3D);
    衣服?.dispose();
    衣服 = null;
    方方?.换身子(false);
  }

  // --- 方方站哪儿 -----------------------------------------------------------

  const 方方站位 = new THREE.Vector3();
  const 这一片的位置 = new THREE.Vector3();
  const 这一片的朝向 = new THREE.Vector3();
  const 选中的朝向 = new THREE.Vector3();
  const 朝镜头 = new THREE.Vector3();
  const 身子中心 = new THREE.Vector3();
  const 向上 = new THREE.Vector3(0, 1, 0);

  /**
   * 方方的脸这一帧摆在哪儿（世界坐标）；返回 null = 这一帧别露脸。
   *
   * **只在纸停稳的两个时候露脸：摊平躺着（举着题卡问），和穿好了（试穿完）。**
   * 折到半路一律收起来 —— 那会儿六片纸全是斜的，脸摆到哪一片上都是贴在一片刀刃上。
   * 沙盒里刚定下的这条规矩在这儿照办，别绕过它。
   *
   * 这一段跟 main.js 的 方方站哪儿 是同一套算法（那边是正主，注释也在那边）。
   * 抄一份而不是抽出去共用，是因为两边喂给它的「折到几分」来路不同：
   * 沙盒问的是逐面折叠状态机，这儿只有一个动画进度数。
   */
  function 方方站哪儿() {
    if (!衣服 || !舞台) return null;

    // 摊平躺着：钉在根格子上。脸不会随着孩子转镜头在格子间跳来跳去
    if (当前折叠度 <= 0.02) {
      const 根 = 衣服.cellGroups[衣服.tree.root];
      if (!根) return null;
      根.getWorldPosition(方方站位);
      return 方方站位.addScaledVector(向上, CELL_SIZE * 浮出表面);
    }

    // 正折着：半路上没有好位置，收起来（穿不上的那件也是「折到底了」，戏照演）
    if (当前折叠度 < 0.98) return null;

    衣服.boundingBox().getCenter(身子中心);
    朝镜头.subVectors(舞台.camera.position, 身子中心);
    if (朝镜头.lengthSq() < 1e-12) return null; // 镜头正好压在身上，这一帧不摆了
    朝镜头.normalize();

    let 最正的分 = -Infinity;
    let 挑中了 = false;

    for (let i = 0; i < 衣服.cellGroups.length; i += 1) {
      const 片 = 衣服.cellGroups[i];
      if (!片) continue;

      片.getWorldPosition(这一片的位置);
      // 「朝外」用从身子中心指向这一片算，不用那张纸的法线 —— 纸有正反两面，
      // 背面那一片的法线常常正好朝着镜头，脸会被塞进正方体肚子里去
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

  // --- 状态 -----------------------------------------------------------------

  /** @type {'猜'|'判'|'折'|'看'|'完'} 判=方方正在说话（鼓励/提示/告知答案），这会儿不收作答 */
  let 状态 = '猜';
  let 这一题 = null;
  /** 这一题答错过几次。三次就把答案告诉他，绝不卡关 */
  let 错次 = 0;
  /** 这一题没听清几次。两次之后加一句「点按钮也行」 */
  let 没听清次 = 0;
  /** 这张衣服现在折到几分。方方站哪儿、试穿从哪儿接着折，都看它 */
  let 当前折叠度 = 0;
  /** 每换一题、每开一段动画就加一。旧的那段看见号码变了就自己停下 */
  let 动画请求 = 0;
  let 等着放下一题 = 0;
  let 进场定时 = 0;
  let 看够了 = false;
  let 庆祝层 = null;
  let 备过话了 = false;
  /** @type {ReturnType<typeof 借麦克风>|null} 借来的那只坞。离场还回去 */
  let 麦 = null;
  let 在前 = false;

  const 作答本 = () => 进度.判断关成绩().作答;

  function 画题卡(一题) {
    // 每一格都是 aria-hidden 的色块，题目本身靠这句话让读屏说得出来（含书上的出处）
    // 出处是书上那一页的中文说法，英文课上只报第几题 —— 这一句本来就只给读屏
    题卡.setAttribute(
      'aria-label',
      !一题
        ? ''
        : 当前语言() === 'en'
          ? `Question ${题库.indexOf(一题) + 1}`
          : `第 ${题库.indexOf(一题) + 1} 题，${一题.出处}`,
    );
    for (const 格 of 题格们) {
      格.className = '题格';
      格.textContent = '';
      格.style.background = '';
    }
    if (!一题) return;
    for (const 格 of 摆中间(一题.格子)) {
      const 位 = 格.row * 题卡列数 + 格.col;
      const 皮 = cellStyle(格.槽位);
      题格们[位].className = '题格 有';
      // 贴纸风素材，跟格子纸和三维那六个面是同一张图（缺图时回落绘文字）
      题格们[位].replaceChildren(画实体(皮.名, 皮.fruit, { 类名: '实体图' }));
      题格们[位].style.background = 皮.color;
    }
  }

  function 画猫猫({ 刚点亮 = -1 } = {}) {
    猫猫排.setAttribute(
      'aria-label',
      选({
        cn: `已经收到 ${答对几只(作答本())} 只小猫，一共 ${题库.length} 题`,
        en: `${答对几只(作答本())} kittens collected out of ${题库.length} questions`,
      }),
    );
    猫猫队(作答本()).forEach((一只状态, i) => {
      猫们[i].className = `一只猫 ${一只状态}`;
      if (i === 刚点亮) {
        // 先摘掉再挂上，否则连着答对时第二只不会蹦（同一个动画名没重新触发）
        void 猫们[i].offsetWidth;
        猫们[i].classList.add('刚点亮');
      }
    });
  }

  function 坞状态(名) {
    麦?.状态(名);
  }

  function 摆按钮() {
    const 在猜 = 状态 === '猜';
    能键.hidden = !在猜;
    不能键.hidden = !在猜;
    下一题键.hidden = !(状态 === '看' && 看够了);
    重玩键.hidden = 状态 !== '完';
    容器.classList.toggle('在问', 在猜);
    /*
      不收作答了（方方正说话、正试穿）：把支着的那只耳朵也收回来。
      留着的话孩子点麦克风会对着一只没人接的耳朵说半天 ——
      他用 ✅ 答完题、方方正说着话，这一下让麦克风安安静静地睡下去。
    */
    if (!在猜) 麦?.打断自己();
    坞状态(在猜 ? '待命' : '睡着');
  }

  function 停动画() {
    动画请求 += 1;
    clearTimeout(等着放下一题);
  }

  /**
   * 换一张衣服上台，摊平躺着等孩子先猜。
   *
   * @param {{出声?: boolean}} [选项] 出声=false 用在「孩子正切去别的玩法」那一路：
   *   台上要收拾干净，但不许在这会儿开口 —— 导航正在念下一个玩法的名字，
   *   说() 是后一句掐前一句的，抢这一下孩子两句都听不全。
   */
  function 摆好这一题({ 出声 = true } = {}) {
    停动画();
    收掉衣服();
    收掉庆祝();
    看够了 = false;
    错次 = 0;
    没听清次 = 0;
    当前折叠度 = 0;
    容器.classList.remove('猜对了');

    const 下标 = 第几题(作答本());
    if (下标 === null) {
      这一题 = null;
      状态 = '完';
      画题卡(null);
      画猫猫();
      摆按钮();
      放收尾庆祝({ 出声 });
      return;
    }

    这一题 = 题库[下标];
    状态 = '猜';
    画题卡(这一题);
    画猫猫();
    摆按钮();

    const 台 = 备好舞台();
    衣服 = new FoldedNet(这一题.格子, { makeCellMaterial: 槽位材质 });
    衣架.add(衣服.object3D);
    提示 = 创建穿不上提示(衣服);
    衣服.setFold(0);
    方方?.换身子(true);
    看得全();
    台.转镜头到(开局机位, 0.45); // 把上一题「失败视角」留下的怪角度转回来
  }

  // --- 作答：喊出来的和点出来的走同一条路 ------------------------------------

  /**
   * 孩子给了一个答案。
   *
   * 三次机会：错一次鼓励、错两次折一半给他看、错三次告诉他答案。
   * 中间方方在说话的那几秒状态是「判」，按钮和麦克风都收着 ——
   * 不然孩子会在方方说「再想一想」的当口又点一下，白白用掉一次机会。
   *
   * @param {boolean} 猜的能合上
   */
  async function 作答(猜的能合上) {
    if (状态 !== '猜' || !这一题) return;
    const 这一次 = 动画请求;
    状态 = '判';
    摆按钮();

    if (判对错(猜的能合上, 这一题)) {
      const 一次就中 = 错次 === 0;
      容器.classList.add('猜对了');
      音效.答对();
      await 说(一次就中 ? 随一句(话().表扬们) : 话().改口了);
      if (这一次 !== 动画请求) return;
      return 试穿(一次就中);
    }

    错次 += 1;
    音效.答错();

    if (错次 >= 3) {
      await 说(这一题.能合上 ? 话().教答案.能 : 话().教答案.不能);
      if (这一次 !== 动画请求) return;
      return 试穿(false);
    }

    if (错次 === 2) {
      // 提示不是一句话，是把衣服折一半给他看 —— 半折的样子本身就是线索
      折纸声({ 轻重: 0.45 });
      await 折到(提示折到, 900, 这一次);
      if (这一次 !== 动画请求) return;
      await 说(话().提示语);
    } else {
      await 说(随一句(话().鼓励们));
    }
    if (这一次 !== 动画请求) return;
    状态 = '猜';
    摆按钮();
  }

  /** 折到某个折叠度，动画放完才 resolve。中途换题（动画请求变了）就悄悄不管了 */
  function 折到(目标, 毫秒, 这一次) {
    return new Promise((好) => {
      if (!衣服 || 这一次 !== 动画请求) return 好();
      const 起点 = 当前折叠度;
      if (Math.abs(目标 - 起点) < 0.001) return 好();
      const 开始 = performance.now();
      const 一帧 = () => {
        if (这一次 !== 动画请求 || !衣服) return 好();
        const t = Math.min(1, (performance.now() - 开始) / Math.max(1, 毫秒));
        const 缓 = t * t * (3 - 2 * t);
        当前折叠度 = 起点 + (目标 - 起点) * 缓;
        衣服.setFold(当前折叠度);
        看得全();
        if (t < 1) requestAnimationFrame(一帧);
        else 好();
      };
      requestAnimationFrame(一帧);
    });
  }

  /**
   * 方方当场试穿这一题的衣服。
   *
   * 对错不是大人说了算，是穿给孩子看的 —— 所以猜对猜错都要穿一遍，
   * 连被告诉了答案的那次也穿。提示折过一半的话就从半路接着折，不倒回去重来。
   *
   * @param {boolean} 记为对 这一题记不记一只猫猫。**只有第一次就猜对才记**，
   *   理由见上面 改口了 那条注释：两个答案的题，猜错再换一个必然对。
   */
  async function 试穿(记为对) {
    if (!这一题 || !衣服) return;
    状态 = '折';
    摆按钮();

    进度.记判断关(这一题.号, 记为对);
    画猫猫({ 刚点亮: 记为对 ? 题库.indexOf(这一题) : -1 });

    const 这一次 = 动画请求;
    折纸声({ 轻重: 1 });
    await 折到(1, 折叠时长 * Math.max(0.4, 1 - 当前折叠度), 这一次);
    if (这一次 !== 动画请求) return;
    await 穿完了看看(这一次);
  }

  async function 穿完了看看(这一次) {
    状态 = '看';
    看够了 = false;
    摆按钮();

    const 结果 = foldResult(这一题.格子, 衣服.tree.root);

    if (结果.valid) {
      方方.情绪('跳舞'); // 穿上新衣服，转圈蹦跶
      音效.答对();
      await 说(话().穿上了);
    } else {
      // 穿不上就把毛病摆出来 —— 猜对的孩子也该看见「为什么穿不上」，
      // 不然他只是押中了，没学到东西。红黄两处、失败视角、喊痒打喷嚏，
      // 跟沙盒里那一出是同一套（见 main.js 的 演一遍穿不上）
      提示.显示(结果);
      const 重叠面 = 结果.overlaps.map((一组) => 结果.faces[一组[0]]);
      舞台.转镜头到(失败视角(重叠面, 结果.holes));
      音效.答错();

      方方.情绪('发抖');
      await 说(共用话().痒);
      if (这一次 !== 动画请求) return;
      方方.情绪('喷嚏');
      await 说(共用话().漏风);
    }

    if (这一次 !== 动画请求) return;
    等着放下一题 = setTimeout(() => {
      if (这一次 !== 动画请求) return;
      看够了 = true;
      摆按钮();
    }, 才放下一题键);
  }

  // --- 喊出来的那条路 -------------------------------------------------------

    const 歇 = (毫秒) => new Promise((好) => setTimeout(好, 毫秒));

  async function 没听清() {
    没听清次 += 1;
    const 这一次 = 动画请求;
    // 两个大按钮一直摆在那儿，只是得有人告诉他可以点 —— 他不认字，自己看不出来
    await 说(没听清次 >= 2 ? `${随一句(话().没听清们)} ${话().用手也行}` : 随一句(话().没听清们));
    if (这一次 !== 动画请求) return;
    坞状态(状态 === '猜' ? '待命' : '睡着');
  }

  /**
   * 只要这一关在台上、又轮到孩子猜，就一直支着耳朵等他开口。
   *
   * 录音、转写、坞的长相全由借来的那把麦克风管（`/shared/js/问答.js`）；
   * 这儿只管一件事：听到的那句话是「能」还是「不能」。
   * 判不出来一律当没听清重问，绝不替孩子猜 —— 猜错了他会白白丢一次机会、
   * 灰掉一只猫猫，而他明明什么都没答。
   */
  async function 一直听着(这把麦) {
    for (;;) {
      if (!在前 || !这把麦.是主人()) return; // 切走了、或者坞被别的玩法借走了
      if (状态 !== '猜') {
        // 方方正说话、正试穿：这会儿不收作答，歇一下再看
        await 歇(200);
        continue;
      }

      const 这一次 = 动画请求;
      let 文;
      try {
        // 🔊 挂在坞上：孩子随时可以让方方把题目再念一遍
        文 = await 这把麦.听一句(猜热词(), { 重听: () => 说(话().问句) });
      } catch {
        return; // 坞根本没装起来：语音这条路今天没有，✅❌ 两个大按钮兜得住
      }
      if (是被打断(文)) {
        if (!这把麦.是主人()) return; // 真被借走了
        continue; // 自己叫停的（换题了、他改点按钮了）：接着支耳朵
      }
      if (!在前 || 这一次 !== 动画请求 || 状态 !== '猜') {
        坞状态(状态 === '猜' ? '待命' : '睡着');
        continue;
      }

      const 听出来的 = 听能不能(文);
      if (!听出来的) {
        await 没听清();
        continue;
      }
      作答(听出来的 === '能');
    }
  }

  // --- 收尾庆祝 -------------------------------------------------------------

  const 收尾语 = () => 模板.猜一猜收尾(题库.length, 答对几只(作答本()));

  function 放收尾庆祝({ 出声 = true } = {}) {
    收掉庆祝();
    庆祝层 = document.createElement('div');
    庆祝层.className = '收尾庆祝';

    const 奖杯 = document.createElement('div');
    奖杯.className = '收尾奖杯';
    奖杯.setAttribute('aria-hidden', 'true');
    奖杯.textContent = '🏆';

    const 一排猫 = document.createElement('div');
    一排猫.className = '收尾猫猫';
    一排猫.setAttribute('aria-hidden', 'true');
    for (const 一只状态 of 猫猫队(作答本())) {
      const 猫 = document.createElement('span');
      猫.className = `一只猫 ${一只状态}`;
      猫.appendChild(画一只猫());
      一排猫.appendChild(猫);
    }

    庆祝层.append(奖杯, 一排猫);
    猜台.appendChild(庆祝层);
    if (出声) 说(收尾语());
  }

  function 收掉庆祝() {
    庆祝层?.remove();
    庆祝层 = null;
  }

  // --- 接线 -----------------------------------------------------------------

  能键.addEventListener('click', () => {
    音效.点一下();
    作答(true);
  });
  不能键.addEventListener('click', () => {
    音效.点一下();
    作答(false);
  });
  下一题键.addEventListener('click', () => 摆好这一题());
  重玩键.addEventListener('click', () => {
    进度.清判断关();
    摆好这一题();
    说(话().重猜);
  });

  /**
   * 换了语言：把读屏标签重挂一遍。
   *
   * 屏幕上一个句子都没有（猫猫是绘文字、题卡是色块），所以没有像素要重画 ——
   * 要换的只有那几句读屏和自动化验收认的话。**这儿不开口**：
   * 用新语言重读当前指令由 `main.js` 统一叫 `重读指令()`，
   * 五个玩法各说各的，孩子听见的会是一团乱。
   */
  const 退订语言 = 订阅语言(() => {
    for (const [按, 名字] of 键名们) 按.setAttribute('aria-label', 选(名字));
    画题卡(这一题);
    画猫猫();
  });

  画猫猫();
  摆按钮();

  return {
    /** 导航切到这个玩法时叫一声。第一次进来才真的建舞台 */
    进场({ 等一下 = 等名字念完 } = {}) {
      clearTimeout(进场定时);
      在前 = true;
      /*
        把全站那只坞借过来，搬到 ✅❌ 中间那个位子上。
        沙盒的口令循环会当场拿到「被打断」自己退场（不再是永远挂着的那种），
        孩子切回穿衣服时 main.js 重新借、重新起循环。
      */
      if (!麦?.是主人()) {
        麦 = 借麦克风('猜一猜', { 挂到: 麦位 });
        一直听着(麦);
      }
      if (!备过话了) {
        // 悄悄把这一关的台词灌进后端的磁盘缓存，孩子答题时零等待
        备过话了 = true;
        备话((语) => 本关台词(语));
      }
      if (状态 === '完' || (这一题 === null && 都做完了(作答本()))) {
        状态 = '完';
        摆按钮();
        if (!庆祝层) 放收尾庆祝({ 出声: false });
        // 幕布立刻挂上，话等导航念完玩法名字再说 —— 跟每道题的问句一个规矩
        进场定时 = setTimeout(() => {
          if (状态 === '完') 说(收尾语());
        }, 等一下);
        return;
      }
      if (!这一题) 摆好这一题();
      摆按钮();
      if (状态 !== '猜') return;
      // 等导航把「猜一猜」念完再开口。说() 是后一句掐前一句的，
      // 抢在前面说，孩子听见的是「猜一……这件衣服我能穿得上吗」
      进场定时 = setTimeout(() => {
        if (状态 === '猜') 说(话().问句);
      }, 等一下);
    },
    /**
     * 孩子切到别的玩法去了。
     *
     * 光停动画不行：停在「折」这个状态上，按钮全是藏着的，
     * 孩子回来只看见一个折了一半的正方体，无键可点也无路可走。
     * 提示折到一半那种情况也一样要收拾干净 —— 状态虽然还是「猜」，
     * 可台上摆着一张折了一半的纸，他回来会以为自己刚才干了什么。
     * 所以退回到这一题的起点，让他回来能重新猜。
     *
     * `这一题` 还是 null 就什么都别做：导航每切一次都会叫一遍这儿，
     * 在这里建舞台，等于孩子从没点过「猜一猜」就先付了一整个 WebGL 场景的钱。
     */
    离场() {
      clearTimeout(进场定时);
      在前 = false;
      停动画();
      if (这一题 && (状态 === '判' || 状态 === '折' || 状态 === '看' || 当前折叠度 > 0.001)) {
        摆好这一题({ 出声: false });
      }
      坞状态('睡着');
      // 坞还回去：搬回它自己的挂点，交给下一个玩法（多半是沙盒）
      麦?.还回去();
      麦 = null;
    },
    /** 角落里的「重来」清了进度以后叫一声：猫猫得当场灭掉，不能等到刷新页面 */
    重头来过() {
      clearTimeout(进场定时);
      摆好这一题();
    },
    /**
     * 刚换了语言，用新语言把「现在该干什么」重讲一遍（main.js 只叫在台上的那一个）。
     * 不在台上就闭嘴：孩子看着别的玩法，这儿没道理插一句。
     */
    重读指令() {
      if (!在前) return false;
      if (状态 === '完') 说(收尾语());
      else if (状态 === '猜') 说(话().问句);
      else return false; // 方方正说着话、正试穿：这会儿没有「该干什么」可讲
      return true;
    },
    /** 调试和实测用 */
    get 状态() {
      return 状态;
    },
    get 这一题() {
      return 这一题;
    },
    get 错次() {
      return 错次;
    },
    /** 手工验收时不想对着麦克风喊也能走语音这条路：__判断关.喊一声('不行') */
    喊一声(文) {
      const 听出来的 = 听能不能(文);
      if (!听出来的) return null;
      作答(听出来的 === '能');
      return 听出来的;
    },
    dispose() {
      clearTimeout(进场定时);
      退订语言();
      在前 = false;
      麦?.还回去();
      麦 = null;
      停动画();
      收掉衣服();
      收掉庆祝();
      方方?.dispose();
      方方 = null;
      for (const 材质 of 材质池.values()) {
        材质.map?.dispose();
        材质.dispose();
      }
      材质池.clear();
    },
  };
}
