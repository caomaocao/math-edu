import test from 'node:test';
import assert from 'node:assert/strict';

import {
  areAdjacent,
  buildHingeTree,
  canClose,
  cellCenters,
  foldResult,
  isConnected,
  isNet,
  netCode,
  netFingerprint,
  对面,
  对面格子对,
  找对面,
  选根格子,
} from '../src/domain/net.js';
import { allHexominoes } from './hexominoes.js';

/** 硬编码在沙盒里的那张 141 型衣服 */
const NET_141 = [
  { row: 0, col: 1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
  { row: 1, col: 2 },
  { row: 1, col: 3 },
  { row: 2, col: 2 },
];

/** 2×3 方块 —— 书上典型的「穿不上」 */
const BLOCK_2x3 = [
  { row: 0, col: 0 },
  { row: 0, col: 1 },
  { row: 0, col: 2 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
  { row: 1, col: 2 },
];

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// ---------------------------------------------------------------------------
// 折痕树
// ---------------------------------------------------------------------------

test('折痕树覆盖全部格子，只有根格子没有父格子', () => {
  const tree = buildHingeTree(NET_141);
  assert.equal(tree.nodes.length, 6);
  assert.equal(tree.order.length, 6);
  assert.equal(tree.nodes.filter((n) => n.parent === null).length, 1);
  assert.equal(tree.nodes[tree.root].parent, null);
  for (const node of tree.nodes) {
    if (node.index === tree.root) continue;
    assert.ok(node.hinge, `格子 ${node.index} 应该挂在一条折痕上`);
  }
});

test('有环的图形（2×3 方块）也能建出一棵树，不会重复挂格子', () => {
  const tree = buildHingeTree(BLOCK_2x3);
  assert.equal(new Set(tree.order).size, 6);
  assert.equal(tree.nodes.filter((n) => n.parent === null).length, 1);
});

test('不相连的格子建不出折痕树', () => {
  const broken = [
    { row: 0, col: 0 },
    { row: 5, col: 5 },
  ];
  assert.equal(isConnected(broken), false);
  assert.throws(() => buildHingeTree(broken));
});

// ---------------------------------------------------------------------------
// 折叠度
// ---------------------------------------------------------------------------

test('折叠度 0 时衣服完全摊平在地面上', () => {
  const tree = buildHingeTree(NET_141);
  const 根 = NET_141[tree.root]; // 纯模型把根格子摆在原点，其余格子按网格排开
  cellCenters(tree, 0).forEach(([x, y, z], i) => {
    assert.ok(near(y, 0), `格子 ${i} 应该还贴着地`);
    assert.ok(near(x, NET_141[i].col - 根.col), `格子 ${i} 的 x`);
    assert.ok(near(z, NET_141[i].row - 根.row), `格子 ${i} 的 z`);
  });
});

test('半折状态是算出来的真实角度：折叠度 t 时格子正好转过 90°×t', () => {
  // 挨着根格子的那个格子，中心应该落在以折痕为圆心、半径半格的圆弧上
  const cells = [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
  ];
  const tree = buildHingeTree(cells, 0);
  for (const t of [0, 0.25, 0.4, 0.5, 0.75, 1]) {
    const 角 = (Math.PI / 2) * t;
    const [x, y, z] = cellCenters(tree, t)[1];
    assert.ok(near(x, 0.5 + 0.5 * Math.cos(角), 1e-12), `折叠度 ${t} 的 x`);
    assert.ok(near(y, 0.5 * Math.sin(角), 1e-12), `折叠度 ${t} 的 y`);
    assert.ok(near(z, 0, 1e-12));
  }
});

test('折叠度是连续的：中途不跳变', () => {
  const tree = buildHingeTree(NET_141);
  let previous = cellCenters(tree, 0);
  for (let step = 1; step <= 100; step++) {
    const current = cellCenters(tree, step / 100);
    current.forEach((p, i) => {
      const moved = Math.hypot(p[0] - previous[i][0], p[1] - previous[i][1], p[2] - previous[i][2]);
      assert.ok(moved < 0.1, `格子 ${i} 在折叠度 ${step / 100} 处跳变了 ${moved}`);
    });
    previous = current;
  }
});

test('折叠度 1 时六个面严丝合缝：格子中心正好落在单位正方体的六个面心上', () => {
  const { faces, valid } = foldResult(NET_141);
  assert.equal(valid, true);
  assert.equal(new Set(faces).size, 6);

  const tree = buildHingeTree(NET_141);
  for (const [x, y, z] of cellCenters(tree, 1)) {
    const d = [x, y - 0.5, z];
    const off = d.filter((v) => !near(Math.abs(v), 0.5, 1e-9));
    // 三个分量里恰好一个是 ±0.5，另外两个是 0
    assert.equal(off.length, 2);
    off.forEach((v) => assert.ok(near(v, 0, 1e-9)));
  }
});

test('换哪个格子当根，六个面都还是六个不同的面，只是转了个朝向', () => {
  for (let root = 0; root < 6; root++) {
    const { faces } = foldResult(NET_141, root);
    assert.equal(new Set(faces).size, 6, `根 = ${root}`);
    assert.equal(faces[root], '-y', `当根的那个格子应该是底面，根 = ${root}`);
  }
});

test('选根格子挑的是邻居最多、最居中的那个格子', () => {
  // 141 型里 (1,1) 和 (1,2) 都有 3 个邻居，离中心一样近，取下标小的
  assert.equal(选根格子(NET_141), 2);
  assert.deepEqual(NET_141[选根格子(NET_141)], { row: 1, col: 1 });

  // 一条长横排：中间的格子有 2 个邻居，两头只有 1 个
  const 长条 = [0, 1, 2, 3, 4, 5].map((col) => ({ row: 0, col }));
  const 根 = 选根格子(长条);
  assert.ok(根 === 2 || 根 === 3, `长条应该挑中间，实际挑了 ${根}`);
});

test('根格子下标越界要报错，不能悄悄折出一棵错的树', () => {
  assert.throws(() => buildHingeTree(NET_141, -1));
  assert.throws(() => buildHingeTree(NET_141, 6));
  assert.throws(() => buildHingeTree(NET_141, 1.5));
});

// ---------------------------------------------------------------------------
// 合上 / 穿不上
// ---------------------------------------------------------------------------

test('2×3 方块穿不上：有重叠，也有一样多的漏洞', () => {
  const { valid, overlaps, holes } = foldResult(BLOCK_2x3);
  assert.equal(valid, false);
  assert.ok(overlaps.length > 0);
  const overlapCount = overlaps.reduce((sum, group) => sum + group.length - 1, 0);
  assert.equal(overlapCount, holes.length, '重叠和漏洞必须一样多');
});

test('换哪个格子当根，合不合得上的结论都一样', () => {
  for (let root = 0; root < 6; root++) {
    assert.equal(foldResult(NET_141, root).valid, true, `根 = ${root}`);
    assert.equal(foldResult(BLOCK_2x3, root).valid, false, `根 = ${root}`);
  }
});

test('穿不上的形状问不出书上的编码 —— 编码只给能合上的衣服分类', () => {
  // 2×3 方块每行 3 格，光数格数会被当成 '33'，但它根本折不成正方体
  assert.equal(canClose(BLOCK_2x3), false);
  assert.equal(netCode(BLOCK_2x3), null);

  // 这几个也是每行格数凑得出书上编码、却穿不上的形状
  const 冒牌货 = [
    [{ row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 },
      { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }],
    [{ row: 0, col: 1 }, { row: 1, col: 1 }, { row: 1, col: 2 },
      { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }],
  ];
  for (const cells of 冒牌货) {
    assert.equal(canClose(cells), false, JSON.stringify(cells));
    assert.equal(netCode(cells), null, `穿不上的形状不该有编码：${JSON.stringify(cells)}`);
  }

  assert.equal(netCode(NET_141), '141');
});

test('isNet 要求恰好 6 格且边边相连', () => {
  assert.equal(isNet(NET_141), true);
  assert.equal(isNet(NET_141.slice(0, 5)), false);
  assert.equal(
    isNet([...NET_141.slice(0, 5), { row: 9, col: 9 }]),
    false,
  );
});

// ---------------------------------------------------------------------------
// ADR-0001 的回归测试：35 种六格骨牌，恰好 11 种能合上
// ---------------------------------------------------------------------------

test('六格骨牌恰好 35 种', () => {
  assert.equal(allHexominoes().length, 35);
});

test('35 种六格骨牌里恰好 11 种能合上，编码分类是 141×6 / 231×3 / 222×1 / 33×1', () => {
  const closable = allHexominoes().filter(canClose);
  assert.equal(closable.length, 11, '能合上的必须恰好 11 种');

  const byCode = {};
  for (const cells of closable) {
    const code = netCode(cells);
    assert.ok(code, `这张衣服认不出编码：${JSON.stringify(cells)}`);
    byCode[code] = (byCode[code] ?? 0) + 1;
  }
  assert.deepEqual(byCode, { 141: 6, 231: 3, 222: 1, 33: 1 });
});

test('穿不上的 24 种，重叠和漏洞必定成对出现', () => {
  const unclosable = allHexominoes().filter((cells) => !canClose(cells));
  assert.equal(unclosable.length, 24);
  for (const cells of unclosable) {
    const { overlaps, holes } = foldResult(cells);
    const overlapCount = overlaps.reduce((sum, group) => sum + group.length - 1, 0);
    assert.equal(overlapCount, holes.length, `重叠和漏洞不一样多：${JSON.stringify(cells)}`);
    assert.ok(overlapCount > 0);
  }
});

// ---------------------------------------------------------------------------
// 对面（03 票）
// ---------------------------------------------------------------------------

test('对面就是换个符号：对面的对面还是自己', () => {
  assert.equal(对面('+x'), '-x');
  assert.equal(对面('-z'), '+z');
  for (const 面 of ['+x', '-x', '+y', '-y', '+z', '-z']) {
    assert.equal(对面(对面(面)), 面);
  }
  assert.throws(() => 对面('x'));
  assert.throws(() => 对面('+w'));
});

test('11 种能合上的衣服，每一张都恰好三对对面，六个格子一个不落', () => {
  const closable = allHexominoes().filter(canClose);
  assert.equal(closable.length, 11);

  for (const cells of closable) {
    const 结果 = foldResult(cells);
    const 三对 = 对面格子对(结果);
    assert.equal(三对.length, 3, `${JSON.stringify(cells)} 没算出三对`);

    const 点过的格子 = 三对.flatMap((一对) => 一对.格子);
    assert.equal(new Set(点过的格子).size, 6, '六个格子必须恰好各属于一对，不重不漏');

    for (const 一对 of 三对) {
      const [a, b] = 一对.格子;
      assert.equal(结果.faces[a], 对面(结果.faces[b]), '一对里的两个面必须正对着');
      // 孩子随便点哪个面，查出来的都得是同一对
      assert.deepEqual(找对面(结果, a), 一对);
      assert.deepEqual(找对面(结果, b), 一对);
    }
  }
});

test('对面的两个格子在衣服上从来不挨着 —— 挨着的是邻面，这是孩子要看出的规律的底线', () => {
  for (const cells of allHexominoes().filter(canClose)) {
    const 结果 = foldResult(cells);
    for (const { 格子 } of 对面格子对(结果)) {
      const a = cells[格子[0]];
      const b = cells[格子[1]];
      assert.ok(!areAdjacent(a, b), `对面的两格挨上了：${JSON.stringify([a, b])}`);
      // 更强的一条：连斜着挨着都不行。行和列里至少有一个隔开了两格 ——
      // 「同一行隔一个格子」和「隔一行」这两种摆法都满足它
      assert.ok(
        Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col)) >= 2,
        `对面的两格挨得太近：${JSON.stringify([a, b])}`,
      );
    }
  }
});

test('穿不上的衣服没有对面可言', () => {
  for (const cells of allHexominoes().filter((c) => !canClose(c))) {
    const 结果 = foldResult(cells);
    assert.deepEqual(对面格子对(结果), []);
    assert.equal(找对面(结果, 0), null);
  }
});

test('同一张衣服上，同一对对面永远是同一个序号（发光色才不会每点一次换一种）', () => {
  const 结果 = foldResult(NET_141);
  const 一遍 = 对面格子对(结果);
  const 又一遍 = 对面格子对(foldResult(NET_141));
  assert.deepEqual(又一遍, 一遍);
  assert.deepEqual(
    一遍.map((一对) => 一对.轴),
    ['x', 'y', 'z'],
  );
  assert.deepEqual(
    一遍.map((一对) => 一对.序),
    [0, 1, 2],
  );
});

test('转个方向、翻个面画出来的是同一张衣服（图鉴判重要用）', () => {
  const turned = NET_141.map((c) => ({ row: c.col, col: -c.row }));
  const flipped = NET_141.map((c) => ({ row: c.row, col: -c.col }));
  assert.equal(netFingerprint(turned), netFingerprint(NET_141));
  assert.equal(netFingerprint(flipped), netFingerprint(NET_141));
});
