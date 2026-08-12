import { test } from 'node:test';
import assert from 'node:assert/strict';
import { 合并 } from '../js/进度.js';

/*
  第 4 讲进度模块的 合并(本地, 云端) 纯函数 —— 云端进度同步的单接缝（票 08）。
  语义与第2/3讲同源：星并集只增不减、柜同格冲突本地胜、整包重置戳胜出、坏形状当没有不炸。
*/

test('星取并集：两侧各有的都保留', () => {
  const 合 = 合并(
    { 版本: 1, 星: { 花圃: true, 火车: true }, 柜: {} },
    { 版本: 1, 星: { 花圃: true, Boss: true }, 柜: {} },
  );
  assert.deepEqual(合.星, { 花圃: true, 火车: true, Boss: true });
});

test('星只增不减：本地空、云端有 → 拿到云端的', () => {
  const 合 = 合并({ 版本: 1, 星: {}, 柜: {} }, { 版本: 1, 星: { 花圃: true }, 柜: {} });
  assert.deepEqual(合.星, { 花圃: true });
});

test('柜同格冲突：本地胜（长龙填到第几行以本机为准）', () => {
  const 合 = 合并(
    { 版本: 1, 星: {}, 柜: { 长龙行: 3 } },
    { 版本: 1, 星: {}, 柜: { 长龙行: 1 } },
  );
  assert.equal(合.柜.长龙行, 3);
});

test('整包重置戳：本地刚重来 → 本地整包胜出，云端旧星不诈尸', () => {
  const 合 = 合并(
    { 版本: 1, 星: {}, 柜: {}, 重置戳: 2000 },
    { 版本: 1, 星: { 花圃: true, 火车: true }, 柜: { 长龙行: 4 }, 重置戳: 1000 },
  );
  assert.deepEqual(合.星, {});
  assert.deepEqual(合.柜, {});
  assert.equal(合.重置戳, 2000);
});

test('整包重置戳：云端戳更新（别的设备重来）→ 本地旧星被清', () => {
  const 合 = 合并(
    { 版本: 1, 星: { 花圃: true }, 柜: {}, 重置戳: 1000 },
    { 版本: 1, 星: {}, 柜: {}, 重置戳: 3000 },
  );
  assert.deepEqual(合.星, {});
  assert.equal(合.重置戳, 3000);
});

test('戳相同才字段并集', () => {
  const 合 = 合并(
    { 版本: 1, 星: { 花圃: true }, 柜: {}, 重置戳: 5000 },
    { 版本: 1, 星: { 火车: true }, 柜: {}, 重置戳: 5000 },
  );
  assert.deepEqual(合.星, { 花圃: true, 火车: true });
});

test('坏形状 / null 当没有，不炸', () => {
  const 本地 = { 版本: 1, 星: { 花圃: true }, 柜: {} };
  for (const 坏 of [null, undefined, 42, 'x', [], { 版本: 2 }, { 版本: 1, 星: '不是对象', 柜: null }]) {
    const 合 = 合并(本地, 坏);
    assert.equal(合.星.花圃, true, `云端=${JSON.stringify(坏)} 时本地星应原样保住`);
    assert.equal(合.版本, 1);
  }
  assert.deepEqual(合并(null, null), { 版本: 1, 星: {}, 柜: {}, 重置戳: 0 });
});

test('合并不改动传进来的两份 payload（纯函数）', () => {
  const 本地 = { 版本: 1, 星: { 花圃: true }, 柜: { 长龙行: 2 } };
  const 云端 = { 版本: 1, 星: { 火车: true }, 柜: { 长龙行: 1 } };
  const a = JSON.parse(JSON.stringify(本地));
  const b = JSON.parse(JSON.stringify(云端));
  合并(本地, 云端);
  assert.deepEqual(本地, a);
  assert.deepEqual(云端, b);
});
