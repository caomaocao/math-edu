import test from 'node:test';
import assert from 'node:assert/strict';

import { canClose, isNet, orientations } from '../src/domain/net.js';
import { 切换格子, 格子纸列数, 格子纸行数, 最多格子 } from '../src/ui/gridPaper.js';
import { allHexominoes } from './hexominoes.js';

/** 涂一串格子，一格一格点上去 */
const 涂 = (格子们) => 格子们.reduce((已涂, 格) => 切换格子(已涂, 格), []);

test('点一下涂上，再点一下取消', () => {
  const 一格 = 涂([{ row: 1, col: 2 }]);
  assert.equal(一格.length, 1);
  assert.deepEqual(切换格子(一格, { row: 1, col: 2 }), []);
});

test('涂满六格就不再加了 —— 正方体只有六个面', () => {
  const 六格 = 涂([0, 1, 2, 3, 4].map((col) => ({ row: 0, col })).concat({ row: 1, col: 0 }));
  assert.equal(六格.length, 最多格子);
  assert.equal(最多格子, 6);

  const 想加第七格 = 切换格子(六格, { row: 1, col: 1 });
  assert.equal(想加第七格, 六格, '涂满了就该原样返回，好让界面知道该抖一下纸');
});

test('擦掉中间一格，剩下的格子颜色不跟着换', () => {
  const 四格 = 涂([
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
    { row: 0, col: 3 },
  ]);
  assert.deepEqual(四格.map((c) => c.槽位), [0, 1, 2, 3]);

  const 擦掉第二格 = 切换格子(四格, { row: 0, col: 1 });
  assert.deepEqual(
    擦掉第二格.map((c) => c.槽位),
    [0, 2, 3],
    '剩下的格子得守着自己原来的颜色，不然孩子以为自己把别的也弄坏了',
  );

  // 空出来的槽位让给新涂的那一格，六个颜色始终各用一次
  const 再涂一格 = 切换格子(擦掉第二格, { row: 1, col: 0 });
  assert.deepEqual(再涂一格.map((c) => c.槽位).sort(), [0, 1, 2, 3]);
});

test('槽位永远两两不同：颜色和面一一对应，不能有两格抢同一个颜色', () => {
  let 已涂 = [];
  for (const 格 of [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 1, col: 1 },
    { row: 0, col: 1 }, // 取消
    { row: 2, col: 2 },
    { row: 0, col: 1 }, // 再涂回来
    { row: 3, col: 4 },
    { row: 2, col: 0 },
  ]) {
    已涂 = 切换格子(已涂, 格);
    assert.equal(new Set(已涂.map((c) => c.槽位)).size, 已涂.length);
    assert.ok(已涂.every((c) => c.槽位 >= 0 && c.槽位 < 最多格子));
  }
});

test('切换格子不改原来那一份', () => {
  const 原 = 涂([{ row: 0, col: 0 }]);
  const 快照 = JSON.stringify(原);
  切换格子(原, { row: 0, col: 1 });
  切换格子(原, { row: 0, col: 0 });
  assert.equal(JSON.stringify(原), 快照);
});

// ---------------------------------------------------------------------------
// 纸够不够大
// ---------------------------------------------------------------------------

const 装得下 = (cells) =>
  orientations(cells).some(
    (摆法) =>
      Math.max(...摆法.map((c) => c.row)) < 格子纸行数 &&
      Math.max(...摆法.map((c) => c.col)) < 格子纸列数,
  );

test('5 列 × 4 行的格子纸，11 种能合上的衣服每一种都画得出来', () => {
  const 能合上的 = allHexominoes().filter(canClose);
  assert.equal(能合上的.length, 11);
  for (const cells of 能合上的) {
    assert.ok(装得下(cells), `这张衣服画不进格子纸：${JSON.stringify(cells)}`);
  }
});

test('35 种六格骨牌里，格子纸装不下的只有一条直的 1×6 —— 而它本来也穿不上', () => {
  const 装不下的 = allHexominoes().filter((cells) => !装得下(cells));
  assert.equal(装不下的.length, 1);
  assert.equal(canClose(装不下的[0]), false);
  assert.ok(isNet(装不下的[0]));
});
