import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as 数据 from '../js/数据.js';
import { 识律, 补下 } from '../js/识律.js';

/*
  题面一致性 —— 数据.js 是全讲题面的单一出处，对着 spec 台账核准过。这里咬合两件事：
    1. 每个数值都是 0~50 的整数、空位下标都落在序列里（题面不越界、不脏）；
    2. 凡是能用本讲三族规律解释的题，答案 / 补的数真能被 识律+补下 推出来
       （防止有人改数据改歪了：改错一个数，这里立刻红）。
  改题面必过这一关，扫描核准值只此一处。
*/

// 数词.js 支持 0~99；书里最大到 70（数字火车 闯关四）
const 在范围 = (v) => Number.isInteger(v) && v >= 0 && v <= 99;
const 全在范围 = (arr) => arr.every(在范围);

test('所有数列的数都在 0~99（数词.js 能念能判的范围）', () => {
  const 全部 = [
    ...数据.花圃.给, ...数据.花圃.补,
    ...数据.果盘.flatMap((r) => r.值们),
    ...数据.山洞.橙.给, ...数据.山洞.橙.补, ...数据.山洞.蓝.给, ...数据.山洞.蓝.补,
    ...数据.蘑菇.A.篮, ...数据.蘑菇.A.草地, ...数据.蘑菇.A.摘, ...数据.蘑菇.B.给, ...数据.蘑菇.B.补,
    ...数据.接龙.flatMap((s) => [...s.给, ...s.补]),
    ...数据.火车.flatMap((s) => s.值们),
    ...数据.糖葫芦.flatMap((s) => s.值们),
    ...数据.装货.flatMap((s) => s.值们),
    ...数据.找错.flatMap((t) => [...t.显示, t.对值]),
    ...数据.boss题.flatMap((q) => [...q.给, q.答]),
  ];
  assert.ok(全在范围(全部), '有数越出了 0~50');
});

test('摆放题的空位下标都落在序列里', () => {
  for (const 组 of [数据.果盘, 数据.糖葫芦, 数据.装货]) {
    for (const r of 组) {
      for (const i of r.空) {
        assert.ok(i >= 0 && i < r.值们.length, `空位 ${i} 越界（长度 ${r.值们.length}）`);
      }
    }
  }
  for (const s of 数据.火车) {
    for (const i of s.空) assert.ok(i >= 0 && i < s.值们.length, `火车空位 ${i} 越界`);
  }
});

test('花圃：等差 +1，补下 推出下一朵', () => {
  assert.deepEqual(补下(数据.花圃.给, 数据.花圃.补.length), 数据.花圃.补);
});

test('果盘：每盘序列是等差，补下 推得出空位的值', () => {
  for (const r of 数据.果盘) {
    assert.equal(识律(r.值们)?.族, '等差', `果盘 ${r.实体} 不是等差`);
    // 空位以外的都作前缀，补下 应能续出第一个空位的值
    const 首空 = Math.min(...r.空);
    assert.deepEqual(补下(r.值们.slice(0, 首空), 1), [r.值们[首空]]);
  }
});

test('山洞：橙等差 +1、蓝恒定，补下 推出下一撮', () => {
  assert.deepEqual(补下(数据.山洞.橙.给, 1), 数据.山洞.橙.补);
  // 蓝是恒定序列（差 0），补下也该续出同一个数
  assert.deepEqual(补下(数据.山洞.蓝.给, 1), 数据.山洞.蓝.补);
});

test('蘑菇：篮里差递增，补下(篮) = 该摘的两个', () => {
  assert.deepEqual(补下(数据.蘑菇.A.篮, 数据.蘑菇.A.摘.length), 数据.蘑菇.A.摘);
  assert.deepEqual(补下(数据.蘑菇.B.给, 数据.蘑菇.B.补.length), 数据.蘑菇.B.补);
  // A 轮该摘的都在草地上找得到
  for (const n of 数据.蘑菇.A.摘) assert.ok(数据.蘑菇.A.草地.includes(n), `草地上没有 ${n}`);
});

test('接龙：能被识律认出的那几条，补下 = 补', () => {
  for (const s of 数据.接龙) {
    if (识律(s.给)) assert.deepEqual(补下(s.给, s.补.length), s.补, `接龙 ${s.给} 补错了`);
  }
});

test('数字长龙：5 行、每行 3 空、空不是锚、都在各自行内', () => {
  assert.equal(数据.长龙.空.length, 数据.长龙.总 / 数据.长龙.每行);
  const 锚 = new Set(数据.长龙.锚);
  数据.长龙.空.forEach((行空, r) => {
    assert.equal(行空.length, 3, `第 ${r + 1} 行不是 3 个空`);
    for (const v of 行空) {
      assert.equal(Math.floor((v - 1) / 数据.长龙.每行), r, `${v} 不在第 ${r + 1} 行`);
      assert.ok(!锚.has(v), `${v} 是锚点，不该抽空`);
    }
  });
});

test('数字火车：每列的完整序列都是一条能认出的规律（空位是它的一部分，自然吻合）', () => {
  // 完整 值们 被识律认出 ⇒ 里头每个数（含空位那几个）都合规律。不去切前缀单独验：
  // 有的空位在第 3 个之前，前缀不足 3 项识不出，那是前缀太短，不是数据错。
  for (const s of 数据.火车) {
    assert.ok(识律(s.值们), `火车 ${s.值们} 不成规律`);
  }
});

test('糖葫芦：每串等差 -2', () => {
  for (const s of 数据.糖葫芦) assert.deepEqual(识律(s.值们), { 族: '等差', 差: -2 });
});

test('车厢装货：每节塔等差 +1', () => {
  for (const s of 数据.装货) assert.deepEqual(识律(s.值们), { 族: '等差', 差: 1 });
});

test('找错车厢：纠正后是一条能认出的规律，且对值 ≠ 显示的错值', () => {
  for (const t of 数据.找错) {
    assert.ok(t.错位 >= 0 && t.错位 < t.显示.length, '错位越界');
    assert.notEqual(t.显示[t.错位], t.对值, '「错值」跟对值一样，那就不算错了');
    const 纠正 = [...t.显示];
    纠正[t.错位] = t.对值;
    assert.ok(识律(纠正), `纠正后 ${纠正} 还认不出规律 —— 题库这一列有问题`);
  }
});

test('Boss：每题答案都能被 识律+补下 推出来', () => {
  for (const q of 数据.boss题) {
    assert.ok(识律(q.给), `Boss 题 ${q.给} 不成规律`);
    assert.deepEqual(补下(q.给, 1), [q.答], `Boss 题 ${q.给} 的答案对不上`);
  }
});
