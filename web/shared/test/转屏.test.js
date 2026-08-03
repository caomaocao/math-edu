import { test } from 'node:test';
import assert from 'node:assert/strict';
import { 转屏台词表, 转屏台词们 } from '../js/转屏.js';

/*
  转屏拦罩的台词也归两语同构管 —— 和各讲台词表同一条红线：
  漏一句译文的下场不是英文课上出现一句中文，而是孩子在英文课里听见中文。
*/

test('两语键集完全一样', () => {
  assert.deepEqual(Object.keys(转屏台词表('cn')).sort(), Object.keys(转屏台词表('en')).sort());
});

test('英文表里没有汉字', () => {
  for (const [键, 句] of Object.entries(转屏台词表('en'))) {
    assert.ok(!/[一-鿿]/.test(句), `英文的「${键}」里还有汉字：${句}`);
  }
});

test('两语都有话可说，预热单子拿得到', () => {
  for (const 语 of ['cn', 'en']) {
    const 们 = 转屏台词们(语);
    assert.ok(们.length > 0);
    assert.ok(们.every((句) => typeof 句 === 'string' && 句.trim().length > 0));
  }
});

test('认不出的语言按中文兜着，不返回 undefined', () => {
  assert.equal(转屏台词表('de').请横屏, 转屏台词表('cn').请横屏);
});
