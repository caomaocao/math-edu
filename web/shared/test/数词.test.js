import { test } from 'node:test';
import assert from 'node:assert/strict';

import { 中文数, 英文数, 说法们, 抽数, 判数 } from '../js/数词.js';

/*
  数词 —— 0~99 的中/阿/英三套说法与判定，第4讲报数题的地基，第5讲报数照用
  （2026-08 随模块自 chapters/04 升入 shared，断言原样搬）。
  纯函数，不碰 DOM/网络/localStorage，node 直接 import。

  规范名（判对的键）在这一讲是**数字串本身**（"6"、"16"）—— 语言中立，
  不违「判对规范名恒中文」的本意（方位那种才要恒中文）。这里测三件事：
  三套写法正确、说法并集互认、判定容错（中/阿/英 + 口头语 + 自我纠正取最后）。
*/

// ── 三套写法 ─────────────────────────────────────────────────────────────────

test('中文数：0~99 逐档正确（书里最大到 70）', () => {
  const 表 = {
    0: '零', 1: '一', 5: '五', 9: '九', 10: '十', 11: '十一', 16: '十六', 19: '十九',
    20: '二十', 21: '二十一', 25: '二十五', 30: '三十', 40: '四十', 50: '五十', 60: '六十', 70: '七十',
  };
  for (const [n, 字] of Object.entries(表)) assert.equal(中文数(Number(n)), 字, `${n}`);
});

test('英文数：0~99 逐档正确', () => {
  const 表 = {
    0: 'zero', 9: 'nine', 10: 'ten', 16: 'sixteen', 19: 'nineteen',
    20: 'twenty', 21: 'twenty-one', 30: 'thirty', 42: 'forty-two', 50: 'fifty', 60: 'sixty', 70: 'seventy',
  };
  for (const [n, 字] of Object.entries(表)) assert.equal(英文数(Number(n)), 字, `${n}`);
});

test('中文数 / 英文数：范围外给 null，不硬编', () => {
  for (const n of [-1, 100, 101, 1.5, NaN]) {
    assert.equal(中文数(n), null, `中文数(${n})`);
    assert.equal(英文数(n), null, `英文数(${n})`);
  }
});

// ── 说法并集 ─────────────────────────────────────────────────────────────────

test('说法们：至少含中文、阿拉伯串、英文三种', () => {
  const s = 说法们(16);
  assert.ok(s.includes('十六'));
  assert.ok(s.includes('16'));
  assert.ok(s.includes('sixteen'));
});

test('说法们：2 收「两」，英文连字与空格两种写法都在', () => {
  assert.ok(说法们(2).includes('两'));
  const s = 说法们(21);
  assert.ok(s.includes('twenty-one'));
  assert.ok(s.includes('twenty one'));
});

test('说法们：无重复', () => {
  for (const n of [0, 2, 7, 16, 20, 21, 50]) {
    const s = 说法们(n);
    assert.equal(new Set(s).size, s.length, `${n} 的说法有重复`);
  }
});

// ── 抽数：把转写里最后提到的那个数抽出来 ─────────────────────────────────────

test('抽数：阿拉伯 / 中文 / 英文都认得', () => {
  assert.equal(抽数('7'), 7);
  assert.equal(抽数('十六'), 16);
  assert.equal(抽数('二十一'), 21);
  assert.equal(抽数('sixteen'), 16);
  assert.equal(抽数('twenty one'), 21);
  assert.equal(抽数('twenty-one'), 21);
  assert.equal(抽数('五十'), 50);
  assert.equal(抽数('fifty'), 50);
});

test('抽数：裹着口头语也认得出来', () => {
  assert.equal(抽数('嗯……我觉得是六'), 6);
  assert.equal(抽数('Um, I think it is sixteen.'), 16);
  assert.equal(抽数('应该是二十五吧'), 25);
});

test('抽数：自我纠正取最后一个', () => {
  assert.equal(抽数('五，不对，六'), 6);
  assert.equal(抽数('twenty... no, thirty'), 30);
});

test('抽数：一个数都没有给 null', () => {
  for (const s of ['', '不知道', 'hmm', null, undefined]) assert.equal(抽数(s), null);
});

// ── 判数 ─────────────────────────────────────────────────────────────────────

test('判数：对的各种说法都判对', () => {
  for (const 说 of ['6', '六', 'six', '嗯是六', 'it is six']) {
    assert.equal(判数(说, 6), '对', `${说}`);
  }
  assert.equal(判数('十六', 16), '对');
  assert.equal(判数('sixteen', 16), '对');
  assert.equal(判数('二十五', 25), '对');
});

test('判数：答成别的数判错', () => {
  assert.equal(判数('七', 6), '错');
  assert.equal(判数('seven', 6), '错');
  assert.equal(判数('十五', 16), '错');
});

test('判数：一个数都没抽到给不确定（交上层重试/兜底）', () => {
  for (const s of ['不知道', 'hmm', '']) assert.equal(判数(s, 6), '不确定');
});
