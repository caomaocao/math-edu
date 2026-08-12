import test from 'node:test';
import assert from 'node:assert/strict';

import { 全部台词, 台词, 模板, 两语台词, 两语模板 } from '../js/台词表.js';
import { 环节表, 环节名 } from '../js/环节表.js';
import { 设语言 } from '/shared/js/语言.js';
import { 问答台词表 } from '/shared/js/问答.js';

/** 汉字与中文标点。英文那张表里出现任何一个，就是漏译。 */
const 汉字 = /[　-〿一-鿿＀-￯]/;
const 全份 = (语) => 全部台词({ 语, 环节名们: 环节表.map((条) => 环节名(条, 语)) });

function 摊(值, 收 = []) {
  if (typeof 值 === 'string') 收.push(值);
  else if (值 && typeof 值 === 'object') Object.values(值).forEach((一个) => 摊(一个, 收));
  return 收;
}
function 键路(值, 前缀 = '', 收 = []) {
  if (值 && typeof 值 === 'object') {
    for (const [键, 子] of Object.entries(值)) 键路(子, 前缀 ? `${前缀}.${键}` : 键, 收);
  } else 收.push(前缀);
  return 收;
}
const 顺着路取 = (表, 路) => 路.split('.').reduce((节, 键) => 节[键], 表);

test.afterEach(() => 设语言('cn'));

// ── 预热单子 ─────────────────────────────────────────────────────────────────

for (const 语 of ['cn', 'en']) {
  test(`全部台词(${语})：每一句都是非空字符串，没有重复`, () => {
    const 单子 = 全份(语);
    assert.ok(单子.length > 80, `台词表看着太短了（${单子.length} 句）`);
    for (const 一句 of 单子) {
      assert.equal(typeof 一句, 'string');
      assert.ok(一句.trim(), '空句子不该进单子');
    }
    assert.equal(new Set(单子).size, 单子.length, '同一句备两遍是白花一次往返');
  });

  test(`全部台词(${语})：13 站 + 全站的静态台词一句不落`, () => {
    const 单子 = new Set(全份(语));
    for (const [摊名, 一摊] of Object.entries(两语台词[语])) {
      for (const 一句 of 摊(一摊)) {
        assert.ok(单子.has(一句), `「${摊名}」这一句没进预热单子：${一句}`);
      }
    }
  });

  test(`全部台词(${语})：站名从环节表递进来（不递就没有）`, () => {
    const 单子 = new Set(全份(语));
    for (const 条 of 环节表) {
      assert.ok(单子.has(环节名(条, 语)), `地图节点念的「${环节名(条, 语)}」没备上`);
    }
    assert.equal(new Set(全部台词({ 语 })).has(环节名(环节表[0], 语)), false);
  });

  test(`全部台词(${语})：报数「教」0~50 整档都展开备上`, () => {
    const 单子 = new Set(全份(语));
    const 模 = 两语模板[语];
    for (const n of [0, 6, 16, 25, 50]) {
      assert.ok(单子.has(模.报数.教(n)), `报数教(${n}) 没备上`);
    }
  });
}

test('全部台词：台词表覆盖到每一站，一个都没落下', () => {
  for (const { 号 } of 环节表) {
    assert.ok(台词[号], `站「${号}」在台词表里没有自己的一摊`);
  }
});

test('全部台词：共享问答三摊两门课都捎上了', () => {
  for (const 语 of ['cn', 'en']) {
    const 单子 = new Set(全份(语));
    const { 表扬们, 鼓励们, 没听清们 } = 问答台词表(语);
    for (const 一句 of [...表扬们, ...鼓励们, ...没听清们]) {
      assert.ok(单子.has(一句), `${语} 课问答流程这一句没备上：${一句}`);
    }
  }
});

// ── 两门课同构 ───────────────────────────────────────────────────────────────

test('台词：中英两张表的键完全一样', () => {
  const 中键 = 键路(两语台词.cn);
  const 英键 = 键路(两语台词.en);
  assert.deepEqual(中键.filter((键) => !英键.includes(键)), [], '这几句还没翻译成英文');
  assert.deepEqual(英键.filter((键) => !中键.includes(键)), [], '英文表里有多出来的键');
});

test('台词：英文那张表里一个汉字都不剩', () => {
  for (const 路 of 键路(两语台词.en)) {
    const 句 = 顺着路取(两语台词.en, 路);
    assert.equal(typeof 句, 'string', `${路} 不是一句话`);
    assert.ok(句.trim(), `${路} 是空的`);
    assert.equal(汉字.test(句), false, `英文课这一句还夹着中文：${路} → ${句}`);
  }
});

// 每个模板一组样例参数（新加模板忘了填，下面断言会红）
const 样例 = {
  报数: { 教: [16] },
  花圃: { 教: [7] },
  山洞: { 教橙: [5], 教蓝: [3] },
  长龙: { 行开始: [2], 教: [26] },
  摆放: { 教数: [6] },
  找错: { 教: [6, 3] },
  Boss: { 亮车厢: [3] },
};

test('模板：中英两张表的键与参数个数完全一样', () => {
  const 中键 = 键路(两语模板.cn).sort();
  const 英键 = 键路(两语模板.en).sort();
  assert.deepEqual(英键, 中键, '模板漏译 / 键名对不上');
  for (const 路 of 中键) {
    const 中造句 = 顺着路取(两语模板.cn, 路);
    const 英造句 = 顺着路取(两语模板.en, 路);
    assert.equal(typeof 中造句, 'function', `模板.${路} 应该是函数`);
    assert.equal(英造句.length, 中造句.length, `模板.${路} 两语参数个数对不上`);
  }
});

for (const 语 of ['cn', 'en']) {
  test(`模板(${语})：每一句都调得动，变量真落进句子里`, () => {
    for (const [摊名, 一摊] of Object.entries(两语模板[语])) {
      for (const [键, 造句] of Object.entries(一摊)) {
        const 参数 = 样例[摊名]?.[键];
        assert.ok(参数, `模板.${摊名}.${键} 忘了在测试里给样例参数`);
        const 句 = 造句(...参数);
        assert.equal(typeof 句, 'string');
        assert.ok(句.trim().length > 1, `模板.${摊名}.${键} 造出来的句子太短：${句}`);
        assert.equal(句.includes('undefined'), false, `模板.${摊名}.${键} 有变量没填上：${句}`);
      }
    }
  });
}

test('模板：英文那张表造出来的句子里一个汉字都没有', () => {
  for (const [摊名, 一摊] of Object.entries(两语模板.en)) {
    for (const [键, 造句] of Object.entries(一摊)) {
      const 句 = 造句(...样例[摊名][键]);
      assert.equal(汉字.test(句), false, `英文课这一句还夹着中文：模板.${摊名}.${键} → ${句}`);
    }
  }
});

test('台词 / 模板：读的那一刻才挑语言', () => {
  const 话 = 台词.全站;
  const 模 = 模板.报数;
  assert.equal(话.开场白, 两语台词.cn.全站.开场白);
  assert.equal(模.教(6), 两语模板.cn.报数.教(6));
  设语言('en');
  assert.equal(话.开场白, 两语台词.en.全站.开场白);
  assert.equal(模.教(6), 两语模板.en.报数.教(6));
});
