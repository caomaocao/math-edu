import { test } from 'node:test';
import assert from 'node:assert/strict';
import { 建路网, 是路, 开车 } from '../js/路网.js';

// 3×5 小地图：一条横路带一个向北的岔
//   . . 2 . .
//   0 1 2 3 4   ← 第1行整行是路
//   . . . . .
const 网 = 建路网(3, 5, [
  { 行: 1, 列: 0 }, { 行: 1, 列: 1 }, { 行: 1, 列: 2 }, { 行: 1, 列: 3 }, { 行: 1, 列: 4 },
  { 行: 0, 列: 2 },
]);

test('是路', () => {
  assert.equal(是路(网, { 行: 1, 列: 0 }), true);
  assert.equal(是路(网, { 行: 2, 列: 0 }), false);
  assert.equal(是路(网, { 行: 1, 列: -1 }), false);
});

test('往东开：在岔口停', () => {
  const { 终点, 经过 } = 开车(网, { 行: 1, 列: 0 }, '东');
  assert.deepEqual(终点, { 行: 1, 列: 2 }); // 列2有向北的岔，停
  assert.equal(经过.length, 2);
});

test('过了岔口继续开到尽头', () => {
  const { 终点 } = 开车(网, { 行: 1, 列: 2 }, '东');
  assert.deepEqual(终点, { 行: 1, 列: 4 });
});

test('没路的方向原地不动', () => {
  const { 终点, 经过 } = 开车(网, { 行: 1, 列: 0 }, '南');
  assert.deepEqual(终点, { 行: 1, 列: 0 });
  assert.equal(经过.length, 0);
});

test('压上停靠点就停，不管是不是岔口', () => {
  const { 终点 } = 开车(网, { 行: 1, 列: 0 }, '东', [{ 行: 1, 列: 1 }]);
  assert.deepEqual(终点, { 行: 1, 列: 1 });
});

test('往北拐进岔路开到头', () => {
  const { 终点 } = 开车(网, { 行: 1, 列: 2 }, '北');
  assert.deepEqual(终点, { 行: 0, 列: 2 });
});
