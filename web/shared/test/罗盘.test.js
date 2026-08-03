import { test } from 'node:test';
import assert from 'node:assert/strict';
import { 走一步, 走多步, 相对方位, 生活对地图, 地图对生活, 角度, 八方位 } from '../js/罗盘.js';

test('上北下南左西右东', () => {
  assert.equal(生活对地图.上, '北');
  assert.equal(生活对地图.下, '南');
  assert.equal(生活对地图.左, '西');
  assert.equal(生活对地图.右, '东');
  assert.equal(地图对生活.东北, '右上');
});

test('走一步：北是行减一，东是列加一', () => {
  assert.deepEqual(走一步({ 行: 2, 列: 2 }, '北'), { 行: 1, 列: 2 });
  assert.deepEqual(走一步({ 行: 2, 列: 2 }, '南'), { 行: 3, 列: 2 });
  assert.deepEqual(走一步({ 行: 2, 列: 2 }, '东'), { 行: 2, 列: 3 });
  assert.deepEqual(走一步({ 行: 2, 列: 2 }, '西北'), { 行: 1, 列: 1 });
});

test('走多步：往北2格再算相对方位', () => {
  assert.deepEqual(走多步({ 行: 4, 列: 1 }, '北', 2), { 行: 2, 列: 1 });
});

test('相对方位：从甲看乙', () => {
  assert.equal(相对方位({ 行: 1, 列: 1 }, { 行: 0, 列: 1 }), '北');
  assert.equal(相对方位({ 行: 1, 列: 1 }, { 行: 1, 列: 2 }), '东');
  assert.equal(相对方位({ 行: 1, 列: 1 }, { 行: 0, 列: 2 }), '东北');
  assert.equal(相对方位({ 行: 1, 列: 1 }, { 行: 2, 列: 0 }), '西南');
  assert.equal(相对方位({ 行: 1, 列: 1 }, { 行: 1, 列: 1 }), null);
});

test('表盘角度整圈无重复', () => {
  const 角们 = 八方位.map((名) => 角度[名]);
  assert.equal(new Set(角们).size, 8);
  assert.equal(角度.北, 0);
  assert.equal(角度.东, 90);
});
