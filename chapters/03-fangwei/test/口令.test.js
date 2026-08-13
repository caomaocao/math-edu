// 口令 认解析：把「往东走两格」拆成 {方, 数}。纯逻辑，node 直接测。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { 认口令, 认格数 } from '../js/口令.js';

const 四方 = ['北', '南', '西', '东'];

test('认格数：阿拉伯 / 中文 / 英文数字都收，没有回 null', () => {
  assert.equal(认格数('往东走2格'), 2);
  assert.equal(认格数('往东走两格'), 2);
  assert.equal(认格数('往北走三格'), 3);
  assert.equal(认格数('go east two squares'), 2);
  assert.equal(认格数('go north one square'), 1);
  assert.equal(认格数('往东'), null);
  assert.equal(认格数(''), null);
});

test('认口令：方向 + 格数一起认（中文）', () => {
  assert.deepEqual(认口令('往东走两格', 四方), { 方: '东', 数: 2 });
  assert.deepEqual(认口令('往北走3格', 四方), { 方: '北', 数: 3 });
});

test('认口令：英文一句也认', () => {
  assert.deepEqual(认口令('go east two squares', 四方), { 方: '东', 数: 2 });
});

test('认口令：只报方向没报格数 → 数为 null（前端提醒走几格）', () => {
  assert.deepEqual(认口令('往东', 四方), { 方: '东', 数: null });
});

test('认口令：只报格数没报方向 → 方为 null（前端提醒往哪走）', () => {
  assert.deepEqual(认口令('走两格', 四方), { 方: null, 数: 2 });
});

test('认口令：句里提了两个方向，取最后一个（同开车的既有约定）', () => {
  const { 方 } = 认口令('先往北再往东走两格', 四方);
  assert.equal(方, '东');
});
