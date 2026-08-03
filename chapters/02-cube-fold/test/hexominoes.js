import { netFingerprint, normalize } from '../src/domain/net.js';

/**
 * 枚举全部 35 种六格骨牌（hexomino），无视旋转和翻面。
 *
 * 从一个格子开始，每一轮往已有的形状边上贴一格，用「无视旋转翻面的指纹」去重。
 * 这是 ADR-0001 那条回归测试的原料：35 种里必须恰好 11 种能合上。
 * 02 票的失败提示（红黄两处标在哪、镜头该转到哪）也拿这 35 种挨个验一遍。
 */
export function allHexominoes() {
  let shapes = new Map();
  shapes.set(netFingerprint([{ row: 0, col: 0 }]), [{ row: 0, col: 0 }]);

  for (let size = 1; size < 6; size++) {
    const grown = new Map();
    for (const cells of shapes.values()) {
      for (const cell of cells) {
        for (const [dRow, dCol] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const next = { row: cell.row + dRow, col: cell.col + dCol };
          if (cells.some((c) => c.row === next.row && c.col === next.col)) continue;
          const candidate = normalize([...cells, next]);
          grown.set(netFingerprint(candidate), candidate);
        }
      }
    }
    shapes = grown;
  }
  return [...shapes.values()];
}
