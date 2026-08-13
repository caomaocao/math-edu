// 布景图 —— 地图整幅背景（全景）注册表 + 挂进 SVG 地图底的渲染。
//
// 跟 实体图.js 是姊妹，但语义不同，别混：
//   实体图 是「孩子要认 / 要数的实体」——进各讲 实体们 覆盖表、被判对、被预热。
//   布景图 是「地图那张底」（一讲一张全景）——**不是实体**：不进 实体们、不判对、不预热同表，
//           只是铺在 SVG 地图最底层的一张 <image>。所以它有自己的注册表和自己的存在性守卫
//           （见 web/shared/test/布景图.test.js），不搅进 实体们 ⊆ registry ⊆ disk 那套。
//
// 素材：宽幅不透明 WebP（**不抠白底**，整张就是地图底），tools/生成实体图.py 全景 出、
// 转 WebP 落 /shared/assets/布景/。做法定案见 .scratch/素材升级/（混合：背景全景 + 道具零件，
// 功能性铁路 / 小路仍是代码描边画在全景上层）。

const 目录 = '/shared/assets/布景/';

// 磁盘上真实存在的背景图（一讲一张）。测试拿这份和 assets/布景/ 双向对账，
// 多一个少一个都变红——跟 实体图 的 有图 同例。
export const 有背景 = new Set([
  '第4讲地图',
  '第3讲地图',
  '第5讲地图',
]);

/** 背景图(名) → 图片 URL；没有就 null（调用方保留它原来的 SVG 天空兜底） */
export function 背景图(名) {
  return 有背景.has(名) ? `${目录}${encodeURIComponent(名)}.webp` : null;
}

const SVG命名空间 = 'http://www.w3.org/2000/svg';

/**
 * 画背景SVG(名, {宽, 高, 类名}) → 铺满地图 viewBox 的 <image>，或 null（没图时）。
 *
 * 宽 / 高 给的是地图 viewBox 尺寸（不是屏幕尺寸——背景跟着舞台一起等比缩放，
 * 所以这里只认舞台坐标、绝不掺视口单位，见 CLAUDE.md 触屏铁律）。
 * preserveAspectRatio="xMidYMid slice"：全景覆盖整个 viewBox，宽高比不一致时裁边不留白。
 * 调用方把它 prepend 到 <svg> 最前，就落在所有站点 / 铁路 / 点缀之下。
 * 缺图回 null，调用方保留原来的 SVG 天空——孩子这一局绝不会因为缺背景而崩（同 画实体 的兜底铁律）。
 */
/**
 * 铺地图底(名) —— 把同一张全景也铺到整页 body 当氛围层（票 12）。舞台内是清晰主图，这层是它
 * 虚化压暗的延伸：缩放剩下的那圈补边（letterbox）不再露纯色渐变，整页被图填满且接缝不穿帮。
 * 只设一个 CSS 变量 + 挂一个类，长相在 /shared/css/舞台.css 的 body.有地图氛围::before。
 * 缺图就不动 body（保留讲内 CSS 兜底渐变，同 画实体 缺图不崩的铁律）。
 */
export function 铺地图底(名) {
  const url = 背景图(名);
  if (!url) return;
  document.body.style.setProperty('--地图氛围', `url("${url}")`);
  document.body.classList.add('有地图氛围');
}

export function 画背景SVG(名, { 宽, 高, 类名 } = {}) {
  const url = 背景图(名);
  if (!url) return null;
  const 图 = document.createElementNS(SVG命名空间, 'image');
  图.setAttribute('href', url);
  图.setAttribute('x', 0);
  图.setAttribute('y', 0);
  图.setAttribute('width', 宽);
  图.setAttribute('height', 高);
  图.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  if (类名) 图.setAttribute('class', 类名);
  return 图;
}
