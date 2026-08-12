import test from 'node:test';
import assert from 'node:assert/strict';

import { 站点表 } from '../js/站点表.js';
import * as 熊猫竹林 from '../js/站/熊猫竹林.js';
import * as 兔子草地 from '../js/站/兔子草地.js';
import * as 喂食站 from '../js/站/喂食站.js';
import { 两语台词, 两语模板 } from '../js/台词表.js';
import { 中文数, 英文数 } from '/shared/js/数词.js';

/*
  一多对应三站（票 05）：熊猫竹林 / 兔子草地 / 喂食站。
  站点表.js 是题面数值的单一出处——这里咬合「站模块递给引擎的题真是从台账推导的」
  （谁在站里硬编码第二份数，这里立刻红），再把换位演示的亮灯序列当纯逻辑测一遍
  （它是本票的灵魂，别让重构悄悄改了数数的顺序）。
*/

const 账 = Object.fromEntries(站点表.map((条) => [条.号, 条.台账]));

// ── 熊猫竹林 ─────────────────────────────────────────────────────────────────

test('熊猫竹林：摆放题从台账推导——一只熊猫一格、每格 每只 根，总和 = 答', () => {
  const 题 = 熊猫竹林.摆放题();
  assert.equal(题.实体, '竹子');
  assert.equal(题.值们.length, 账.熊猫竹林.只数);
  for (const v of 题.值们) assert.equal(v, 账.熊猫竹林.每只);
  assert.equal(题.值们.reduce((s, v) => s + v, 0), 账.熊猫竹林.答);
});

test('熊猫竹林：第 0 格是书上的示范（已给），其余空着等孩子摆', () => {
  const 题 = 熊猫竹林.摆放题();
  assert.ok(!题.空.includes(0), '第一只熊猫是示范——全空的话错2提示就没有「已给」可数');
  assert.equal(题.空.length, 题.值们.length - 1);
  for (const i of 题.空) assert.ok(i >= 1 && i < 题.值们.length, `空位 ${i} 越界`);
});

test('换位步子：先左手 1-2-3 再右手 1-2-3（熊猫 3+3，步数 = 答）', () => {
  const 步 = 熊猫竹林.换位步子(账.熊猫竹林.换位);
  assert.equal(步.length, 账.熊猫竹林.答);
  assert.deepEqual(步, [
    { 侧: 0, 第几: 1 }, { 侧: 0, 第几: 2 }, { 侧: 0, 第几: 3 },
    { 侧: 1, 第几: 1 }, { 侧: 1, 第几: 2 }, { 侧: 1, 第几: 3 },
  ]);
});

test('换位步子：兔子 10+10——20 步，每一侧都从 1 一个个数到 10', () => {
  const 步 = 熊猫竹林.换位步子(账.兔子草地.换位);
  assert.equal(步.length, 账.兔子草地.答);
  const 左 = 步.filter((s) => s.侧 === 0);
  const 右 = 步.filter((s) => s.侧 === 1);
  assert.equal(左.length, 账.兔子草地.换位[0]);
  assert.equal(右.length, 账.兔子草地.换位[1]);
  左.forEach((s, i) => assert.equal(s.第几, i + 1));
  右.forEach((s, i) => assert.equal(s.第几, i + 1));
  // 左手全亮完才轮到右手（演示的节奏就是「一撮亮完再亮另一撮」）
  assert.equal(步.findIndex((s) => s.侧 === 1), 账.兔子草地.换位[0]);
});

test('带数序列：按只带数——熊猫 2、4、6，兔子数到 20，企鹅数到 8', () => {
  assert.deepEqual(熊猫竹林.带数序列(账.熊猫竹林.每只, 账.熊猫竹林.只数), [2, 4, 6]);
  const 兔 = 熊猫竹林.带数序列(账.兔子草地.每只, 账.兔子草地.只数);
  assert.equal(兔.length, 账.兔子草地.只数);
  兔.forEach((n, i) => assert.equal(n, 账.兔子草地.每只 * (i + 1)));
  assert.equal(兔.at(-1), 账.兔子草地.答);
  const 鱼 = 熊猫竹林.带数序列(账.喂食站.企鹅鱼.每只, 账.喂食站.企鹅鱼.只数);
  assert.deepEqual(鱼, [2, 4, 6, 8]);
  assert.equal(鱼.at(-1), 账.喂食站.企鹅鱼.答);
});

// ── 兔子草地 ─────────────────────────────────────────────────────────────────

test('兔子草地：排两排，排数 × 每排 = 台账只数（每排是整数）', () => {
  const { 排数, 每排 } = 兔子草地.队形();
  assert.equal(排数, 2);
  assert.ok(Number.isInteger(每排), '只数不能整除排数的话队形就摆歪了');
  assert.equal(排数 * 每排, 账.兔子草地.只数);
});

// ── 喂食站 ───────────────────────────────────────────────────────────────────

test('喂食站轮⑴：狗骨头 1:1——每群骨头数 = 狗数 × 每只，头一群是示范', () => {
  const 题 = 喂食站.狗骨头题();
  assert.equal(题.实体, '骨头');
  assert.deepEqual(题.值们, 账.喂食站.狗骨头.狗数们.map((狗) => 狗 * 账.喂食站.狗骨头.每只));
  assert.deepEqual(题.值们, [2, 3, 4]); // 每只 = 1：1:1 的意思就是数目相同
  assert.ok(!题.空.includes(0), '第一群是示范（已给）');
  for (const i of 题.空) assert.ok(i >= 1 && i < 题.值们.length, `空位 ${i} 越界`);
});

test('喂食站轮⑵：企鹅鱼 1:2——一只一格各两条，总和 = 答 8，头一只是示范', () => {
  const 题 = 喂食站.企鹅题();
  assert.equal(题.实体, '小鱼');
  assert.equal(题.值们.length, 账.喂食站.企鹅鱼.只数);
  for (const v of 题.值们) assert.equal(v, 账.喂食站.企鹅鱼.每只);
  assert.equal(题.值们.reduce((s, v) => s + v, 0), 账.喂食站.企鹅鱼.答);
  assert.ok(!题.空.includes(0), '第一只企鹅是示范（已给）');
});

// ── 实体们 与 台词/模板落位 ──────────────────────────────────────────────────

test('实体们：三站各自导出票面点名的实体（覆盖与预热同吃这一个接缝）', () => {
  assert.deepEqual(熊猫竹林.实体们, ['熊猫', '竹子']);
  assert.deepEqual(兔子草地.实体们, ['兔子']);
  assert.deepEqual(喂食站.实体们, ['小狗', '骨头', '企鹅', '小鱼']);
});

test('台词：三站的摊两张表都落了位（键同构由台词表.test.js 统管，这儿点名存在）', () => {
  for (const 语 of ['cn', 'en']) {
    for (const 号 of ['熊猫竹林', '兔子草地', '喂食站']) {
      assert.ok(两语台词[语][号], `${语} 表缺「${号}」的摊`);
    }
  }
});

test('模板：换位说破拿台账数值造句（3+3=6 / 10+10=20），词里不焊第二份数', () => {
  const 熊 = 账.熊猫竹林;
  assert.ok(两语模板.cn.熊猫竹林.换位说破(...熊.换位, 熊.答).includes(中文数(熊.答)));
  assert.ok(两语模板.en.熊猫竹林.换位说破(...熊.换位, 熊.答).includes(英文数(熊.答)));
  const 兔 = 账.兔子草地;
  assert.ok(两语模板.cn.兔子草地.换位说破(...兔.换位, 兔.答).includes(中文数(兔.答)));
  assert.ok(两语模板.en.兔子草地.换位说破(...兔.换位, 兔.答).includes(英文数(兔.答)));
});
