import { test } from 'node:test';
import assert from 'node:assert/strict';
import { 图清单, 实体图 } from '../js/实体图.js';

/*
  图清单() —— 预热的「灌哪些图」清单生成，是 实体图.js 里「画法」之外的第二个纯函数。
  规范名单 → 素材名归一去重 → 有图过滤 → URL 清单，不碰 DOM/网络，所以它进这个
  node 测试席；预热.js 里的 Image() 拉取和 idle 时序是 UI-shaped，按家规手工浏览器验。

  URL 一律拿 实体图() 的返回值对，不写死 .png —— 换扩展名（.png → .webp）那张票
  改的是渲染门里那一行，这些断言照样绿，不会替提速工程埋一颗定时炸弹。
*/

test('空名单进，空数组出（「一个实体都没有」不报错，安静给空清单）', () => {
  assert.deepEqual(图清单([]), []);
});

test('滤掉没有图的实体（查不到给 null，这儿不进清单）', () => {
  assert.deepEqual(图清单(['压根没这东西', '也没有这个']), []);
  assert.deepEqual(图清单(['苹果', '压根没这东西']), [实体图('苹果')]);
});

test('同一张图只出一个 URL（去重）', () => {
  assert.deepEqual(图清单(['苹果', '苹果', '苹果']), [实体图('苹果')]);
});

test('归一表多对一合并：小狐狸 / 狐狸 共用一张图，只出一个 URL', () => {
  const 清单 = 图清单(['小狐狸', '狐狸']);
  assert.equal(清单.length, 1);
  assert.equal(清单[0], 实体图('狐狸'));
  assert.equal(清单[0], 实体图('小狐狸'));
});

test('兔子的四种叫法折成一张：小兔 / 小兔子 / 兔子家 / 兔子 → 一个 URL', () => {
  assert.deepEqual(图清单(['小兔', '小兔子', '兔子家', '兔子']), [实体图('兔子')]);
});

test('清单里的每个 URL 都是渲染门给的那个（不自己拼路径）', () => {
  const 名单 = ['苹果', '香蕉', '狐狸', '小狐狸', '压根没这东西'];
  const 清单 = 图清单(名单);
  assert.deepEqual(清单, [...new Set(名单.map(实体图).filter(Boolean))]);
});
