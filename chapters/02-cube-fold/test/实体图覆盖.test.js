import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CELL_STYLES, 实体们 } from '../src/domain/palette.js';
import { 实体图, 素材名 } from '/shared/js/实体图.js';

/*
  第 2 讲的实体图覆盖，跟第 3 讲那份是同一个接缝。
  这一讲的实体全都从调色板长出来（六个格子的水果 + 两位小助手），
  所以清单就放在调色板里，不散到各个 UI 模块。

*/

test('六个格子都有规范名，且互不重复', () => {
  const 名们 = CELL_STYLES.map((样) => 样.名);
  assert.equal(名们.filter(Boolean).length, 6, '每个格子都要有 名');
  assert.equal(new Set(名们).size, 6, '六个格子的规范名不许重复');
});

test('每个实体都有实体图', () => {
  const 缺 = 实体们.filter((名) => 实体图(名) === null);
  assert.deepEqual(缺, [], `以下实体没有实体图：${缺.join('、')}`);
});

test('水果跟第 3 讲货架共用素材，不各生成一套', () => {
  // 五种水果在两讲里都出现，规范名相同 → 素材名相同 → 同一张图
  for (const 名 of ['苹果', '香蕉', '葡萄', '橘子', '草莓']) {
    assert.equal(素材名(名), 名);
    assert.notEqual(实体图(名), null, `${名} 在货架那一批就该已经入库了`);
  }
});
