import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { 实体图 } from '/shared/js/实体图.js';

/*
  第 5 讲的实体图覆盖：换图工程的单接缝（同第 3/4 讲）。
  每个站点模块导出 实体们 —— 它屏幕上会出现的、走实体图渲染的实体规范名。
  纯报数、发饭这种「屏上只有数字/走 CSS 形状」的地方确实没有实体，导出空数组：
  「确实没有」和「忘了写」必须分得开，所以漏导出是红的、导出 [] 是绿的。

  这条测试查的是 实体们 ⊆ registry（实体图() 查得到）；registry ⊆ 磁盘 由
  web/shared/test/实体图.test.js 双向对账，两条合起来就是 实体们 ⊆ registry ⊆ 磁盘。
*/

const 站目录 = fileURLToPath(new URL('../js/站/', import.meta.url));
const 站名们 = readdirSync(站目录).filter((f) => f.endsWith('.js')).sort();

const 站们 = await Promise.all(
  站名们.map(async (f) => [f, await import(pathToFileURL(站目录 + f).href)]),
);

test('每个站点都导出了 实体们（漏写是红的，确实没有就导出空数组）', () => {
  for (const [文件, 模] of 站们) {
    assert.ok(
      Array.isArray(模.实体们),
      `${文件} 没导出 实体们。屏幕上有走实体图的实体就列出规范名，一个都没有就导出 []`,
    );
  }
});

test('每个站点的实体都有实体图', () => {
  const 缺 = [];
  for (const [文件, 模] of 站们) {
    for (const 名 of 模.实体们 ?? []) {
      if (实体图(名) === null) 缺.push(`${文件} 的「${名}」`);
    }
  }
  assert.deepEqual(缺, [], `以下实体没有实体图：\n  ${缺.join('\n  ')}`);
});

test('实体们 里没有重复的名字', () => {
  for (const [文件, 模] of 站们) {
    const 们 = 模.实体们 ?? [];
    assert.equal(new Set(们).size, 们.length, `${文件} 的 实体们 里有重复`);
  }
});
