import { test } from 'node:test';
import assert from 'node:assert/strict';

import { 定配 } from '../js/摆放.js';

/*
  摆放 —— 数量题动手引擎的**注入面**（定配）：宿主要递 提交钮/话术/上限 三样，
  缺一样、错一样都得在开发时就地炸出来，不能等孩子摆到一半才发现钮是 undefined。
  引擎的摆件/点击/三次机会梯子是 DOM 形状的，按家规手验；这儿只盯纯逻辑的校验闸。
*/

/** 第4讲那样的一份全须全尾的配（测试自备，不 import 章节文件 —— shared 测试不吃路径钩子）。 */
function 好配() {
  return {
    提交钮: { 图标: '🔔', 标签: { cn: '拉汽笛', en: 'Pull the whistle' } },
    话术: {
      对: () => '对啦',
      错1: () => '再数数',
      提示头: () => '一组一组数',
      演示头: () => '看好啦',
      教数: (n) => `是${n}个`,
    },
    上限: 12,
  };
}

test('定配：全须全尾的配原样放行', () => {
  const 配 = 好配();
  assert.equal(定配(配), 配);
});

test('定配：整个配缺席就抛', () => {
  assert.throws(() => 定配(), TypeError);
  assert.throws(() => 定配(null), TypeError);
  assert.throws(() => 定配('汽笛'), TypeError);
});

test('定配：提交钮要有非空图标', () => {
  const 好标签 = { cn: '拉汽笛', en: 'Pull the whistle' };
  const 坏钮们 = [
    undefined,                      // 整个钮没传
    { 标签: 好标签 },               // 没图标
    { 图标: '', 标签: 好标签 },
    { 图标: '  ', 标签: 好标签 },
    { 图标: 42, 标签: 好标签 },
  ];
  for (const 坏钮 of 坏钮们) {
    const 配 = { ...好配(), 提交钮: 坏钮 };
    assert.throws(() => 定配(配), /图标/, JSON.stringify(坏钮));
  }
});

test('定配：提交钮标签要 cn/en 双语齐全且非空', () => {
  for (const 坏标签 of [undefined, {}, { cn: '拉汽笛' }, { en: 'Pull' }, { cn: '', en: 'Pull' }, { cn: '拉汽笛', en: ' ' }]) {
    const 配 = 好配();
    配.提交钮 = { 图标: '🔔', 标签: 坏标签 };
    assert.throws(() => 定配(配), /标签/, JSON.stringify(坏标签));
  }
});

test('定配：上限要正整数（04 是 12，05 将是 18）', () => {
  for (const 坏 of [undefined, 0, -1, 1.5, NaN, '12']) {
    const 配 = { ...好配(), 上限: 坏 };
    assert.throws(() => 定配(配), /上限/, String(坏));
  }
  for (const 好 of [1, 12, 18]) {
    assert.equal(定配({ ...好配(), 上限: 好 }).上限, 好);
  }
});

test('定配：话术五键一个不能少，且必须是函数（说话那一刻才取词）', () => {
  for (const 键 of ['对', '错1', '提示头', '演示头', '教数']) {
    const 配 = 好配();
    delete 配.话术[键];
    assert.throws(() => 定配(配), new RegExp(`话术.${键}`), `缺 ${键}`);

    const 配2 = 好配();
    配2.话术[键] = '焊死的字符串'; // 传字符串会把课钉死在配好的那门语言上
    assert.throws(() => 定配(配2), new RegExp(`话术.${键}`), `${键} 不是函数`);
  }
});

test('定配：玩自由那路不开口，要话术:false 时话术缺席也放行', () => {
  const 配 = 好配();
  delete 配.话术;
  assert.equal(定配(配, { 要话术: false }), 配);
  // 但钮和上限照查不误
  assert.throws(() => 定配({ 上限: 12 }, { 要话术: false }), /图标/);
  assert.throws(() => 定配({ 提交钮: 好配().提交钮 }, { 要话术: false }), /上限/);
});
