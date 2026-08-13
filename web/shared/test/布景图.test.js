import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { 有背景, 背景图 } from '../js/布景图.js';

/*
  布景图注册表和磁盘对账——跟 实体图.test.js 同例，但管的是「地图那张全景底」。
  布景不是实体：它不进各讲 实体们、不参与 实体们 ⊆ registry ⊆ disk 那套覆盖测试，
  所以在这儿单独立一道存在性守卫：注册表和 assets/布景/ 必须一一对上，不许有黑户背景、
  也不许注册了却没文件（缺一张地图底不许静默变空白上线）。
*/

const 背景目录 = fileURLToPath(new URL('../assets/布景/', import.meta.url));
const 磁盘上 = new Set(
  readdirSync(背景目录).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)),
);

test('注册表里的每张背景，磁盘上都有同名 WebP', () => {
  for (const 名 of 有背景) {
    assert.ok(磁盘上.has(名), `注册表有「${名}」但 web/shared/assets/布景/${名}.webp 不存在`);
  }
});

test('磁盘上的每张背景 WebP，注册表里都有名字（不许有黑户背景）', () => {
  for (const 名 of 磁盘上) {
    assert.ok(有背景.has(名), `assets/布景/${名}.webp 没登记进 布景图.js 的 有背景`);
  }
});

test('背景图() 查得到的给 URL，查不到的给 null', () => {
  assert.equal(背景图('第4讲地图'), '/shared/assets/布景/%E7%AC%AC4%E8%AE%B2%E5%9C%B0%E5%9B%BE.webp');
  assert.equal(背景图('不存在的背景'), null);
});
