import { CELL_STYLES } from '../domain/palette.js';
import { 画贴纸, 备素材, 贴纸幅比, 造会补画的贴图 } from './贴纸贴图.js';

/**
 * 一个格子的贴图：整块鲜艳颜色 + 中间一个水果。
 * 正反两面用的是同一张（拆开时看得见是同一张纸）。
 *
 * 水果画的是 /shared/assets/实体图/ 里那张贴纸风素材 —— 跟第 3 讲超市货架上的
 * 是同一张图，孩子在两讲里看到的苹果长得一模一样。素材走本站路径，
 * 生成永远只发生在开发机上（docs/adr/0003），断网照样有。
 *
 * 「图是异步的，而方方的衣服不能等」那套（素材三态、等着的重画、缺图回落绘文字）
 * 住在 `贴纸贴图.js`，贴水果关的格子贴图跟这儿共用同一份 ——
 * 这儿只管**这一种格子长什么样**。
 */

/**
 * 进第 2 讲时把六个格子的素材先要下来。
 *
 * 不叫这一声也不会坏（`makeCellTexture` 自己会要），只是孩子画出第一张衣服的
 * 那一两帧里，格子会是光秃秃的纯色。进讲时就要下来，等他点满六格早就到齐了。
 */
export function 备好格子素材(样们 = CELL_STYLES) {
  备素材(样们.map((样) => 样.名));
}

/**
 * 把一个格子画到画布上。
 * @returns {boolean} 画齐了没有 —— false = 还等着素材，回头得重画一遍
 */
function 画一格(笔, 边, 样) {
  // 整块颜色，铺满 —— 折起来时格子和格子之间不能有缝
  笔.clearRect(0, 0, 边, 边);
  笔.fillStyle = 样.color;
  笔.fillRect(0, 0, 边, 边);

  // 往里缩一圈的白边，让相邻的格子看得出分界，但纸本身还是连着的
  笔.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  笔.lineWidth = 边 * 0.045;
  const inset = 边 * 0.055;
  笔.strokeRect(inset, inset, 边 - inset * 2, 边 - inset * 2);

  const 态 = 画贴纸(笔, 样.名, { 边, 幅: 边 * 贴纸幅比 });
  if (态 === '好了') return true;

  // 还在路上：这一格就先是纯色 + 白边。**这一步绝不能空着不画** ——
  // 孩子点出一张衣服的那一刻，方方身上得有东西，不能等图
  if (态 === '等着') return false;

  // 这个实体压根没有素材（还没生成）：照老样子写个绘文字，孩子一样认得出
  笔.font = `${边 * 0.52}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  笔.textAlign = 'center';
  笔.textBaseline = 'middle';
  笔.fillText(样.fruit, 边 / 2, 边 / 2 + 边 * 0.02);
  return true;
}

/** 画一个格子的贴图，正反两面用的是同一张（拆开时看得见是同一张纸） */
export function makeCellTexture(样) {
  return 造会补画的贴图((笔, 边) => 画一格(笔, 边, 样));
}
