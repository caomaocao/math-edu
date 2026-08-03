import * as THREE from '/shared/vendor/three/three.module.js';

import { 实体图 } from '/shared/js/实体图.js';

/**
 * 画到 canvas 上的贴纸 —— 「素材是异步的，而画面不能等」这件事，全讲只有这一处实现。
 *
 * DOM 那头有 `/shared/js/实体图.js` 的 `画实体()`：有图给 `<img>`，没图给绘文字。
 * 三维这头贴图是画到 canvas 上的，`<img>` 用不上，但要处理的是同一件事，
 * 而且多一件：**图还在路上的那几十毫秒里，画面上得先有东西**。
 *
 * 这个模块管的就是那件事，两个用它的人各画各的：
 *   · `cellTexture.js` —— 整块水果色 + 一个水果
 *   · `ui/fruitLevel.js` —— 还要画没贴东西的白纸、和印着数字的格子
 * 两处曾经各有一套加载逻辑（票 12 之前），于是同一屏里 3D 方块上是贴纸、
 * 孩子手里贴的是绘文字。素材加载和三态只许有一处实现（见 CLAUDE.md 共享部件那节）。
 *
 * ## 三态
 *
 *   等着 = 已经发出请求，还没回来 —— 这会儿画的是纯色 + 白边，孩子看到的绝不是一片白
 *   好了 = 图在手上，画它
 *   没有 = 注册表里就没这张图，或者取失败了 —— 一直回落绘文字，孩子这一局照玩
 *
 * 素材落地之后，还等着它的那几张贴图**在同一张画布上重画一遍**、把贴图置
 * `needsUpdate` —— 贴图对象和材质都不换手，各处的材质池一个都不用知道这件事。
 *
 * 这里发出去的是本站 `/shared/...` 的请求，不碰任何外部网络资源（断网可用是铁律）。
 */

/** 一张贴图多少像素见方。两处用的是同一个数，缩放行为才一致 */
export const 贴图边 = 256;

/**
 * 贴纸画多大（占格子边长的几分之几）。
 *
 * 原先那个绘文字是 0.52 —— 但绘文字的字号盒四周本来就带着一圈行距留白，
 * 而素材是抠干净、裁到边的。按同一个数画出来的贴纸会比原来的水果小一圈，
 * 所以放到 0.62，两者在格子里看上去一样重。
 * 再大就要压到那圈白边上了（白边的内沿在 0.1 处，这个数留得下）。
 */
export const 贴纸幅比 = 0.62;

/** 素材名 → 这张图现在什么光景（`{态}`，好了时还带着 `图`） */
const 素材们 = new Map();

/** 还等着素材的那几张贴图。素材一到位，照原样重画一遍就完事 */
const 等着的 = new Set();

/**
 * 要一张素材。同一个名字只要一次；node 里（跑测试）没有 Image，直接当「没有」。
 */
function 取素材(名) {
  if (素材们.has(名)) return;

  const url = 实体图(名);
  if (!url || typeof Image === 'undefined') {
    素材们.set(名, { 态: '没有' });
    return;
  }

  素材们.set(名, { 态: '等着' });
  const 图 = new Image();
  图.decoding = 'async';
  图.addEventListener('load', () => {
    素材们.set(名, { 态: '好了', 图 });
    补画();
  });
  图.addEventListener('error', () => {
    // 取不着就回落绘文字。缺一张图不许让孩子对着一个空格子发呆
    素材们.set(名, { 态: '没有' });
    补画();
  });
  图.src = url;
}

/**
 * 进讲时把要用的素材先要下来。
 *
 * 不叫这一声也不会坏（画的时候自己会要），只是头一两帧里格子会是光秃秃的纯色。
 * @param {Iterable<string>} 名们 规范名
 */
export function 备素材(名们) {
  for (const 名 of 名们) 取素材(名);
}

/**
 * 把一个实体的贴纸画到画布正中。**只画贴纸**，底色、白边、回落绘文字由调用方自己画 ——
 * 它们两处长得不一样（这一头的数字得是深色的），不该被这个基元统一掉。
 *
 * @param {CanvasRenderingContext2D} 笔
 * @param {string} 名 规范名（判对的键，永远是中文）
 * @param {{边?: number, 幅?: number}} [怎么画]
 * @returns {'好了'|'等着'|'没有'} 没有 = 调用方该回落绘文字了；等着 = 这一张回头要重画
 */
export function 画贴纸(笔, 名, { 边 = 贴图边, 幅 = 边 * 贴纸幅比 } = {}) {
  取素材(名); // 头一回问到这个素材的话，请求就是在这儿发出去的
  const 素 = 素材们.get(名);
  if (素?.态 !== '好了') return 素?.态 ?? '没有';
  const 角 = (边 - 幅) / 2;
  笔.drawImage(素.图, 角, 角, 幅, 幅);
  return '好了';
}

/**
 * 造一张会自己补画的贴图。
 *
 * @param {(笔: CanvasRenderingContext2D, 边: number) => boolean} 画
 *   把这一张从头画一遍，还回**画齐了没有**：false = 还等着素材，回头得重画一遍。
 *   同一张画布会被反复交给它，所以第一笔要么铺满、要么先 clearRect。
 * @param {{边?: number}} [多大]
 * @returns {THREE.CanvasTexture}
 */
export function 造会补画的贴图(画, { 边 = 贴图边 } = {}) {
  const 画布 = document.createElement('canvas');
  画布.width = 边;
  画布.height = 边;

  const 贴图 = new THREE.CanvasTexture(画布);
  贴图.colorSpace = THREE.SRGBColorSpace;
  贴图.anisotropy = 4;

  const 一张 = {
    重画() {
      const 齐了 = 画(画布.getContext('2d'), 边);
      贴图.needsUpdate = true; // 画布变了，显卡那边得知道
      if (齐了) 等着的.delete(一张);
      else 等着的.add(一张);
    },
  };

  一张.重画();
  return 贴图;
}

/**
 * 有素材落地了：把还等着的那几张全重画一遍。
 *
 * 不挑「等的正好是这一张」—— 等着的至多是这一屏上的几张，重画一遍是几毫秒的事，
 * 而挑就得让每张贴图报出自己依赖哪些名字，那份账本迟早跟画法长歪。
 */
function 补画() {
  for (const 一张 of [...等着的]) 一张.重画();
}
