import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { 实体图 } from '/shared/js/实体图.js';

/*
  第 3 讲的实体图覆盖：全站换图工程的单接缝。

  每个环节模块导出 `实体们`——它屏幕上会出现的全部实体规范名（教学的、提示的、
  布景道具都算）。确实一个实体都没有的环节（八大罗盘满屏只有方向箭头，是 UI 图形）
  导出空数组：「我确实没有」和「我忘了写」必须分得开，所以漏导出是红的，
  导出空数组是绿的。

  换图工程收尾时（票 11）那份临时的「待补」清单已经清空删掉——所以这里是
  实打实的全覆盖：任何环节列进 实体们 却没有素材，当场就红。
*/

const 环节目录 = fileURLToPath(new URL('../js/环节/', import.meta.url));
const 环节名们 = readdirSync(环节目录).filter((f) => f.endsWith('.js')).sort();

const 环节们 = await Promise.all(
  环节名们.map(async (f) => [f, await import(pathToFileURL(环节目录 + f).href)]),
);

test('每个环节都导出了 实体们（漏写是红的，确实没有就导出空数组）', () => {
  for (const [文件, 模] of 环节们) {
    assert.ok(
      Array.isArray(模.实体们),
      `${文件} 没导出 实体们。屏幕上有实体就列出它们的规范名，一个都没有就导出 []`,
    );
  }
});

test('每个环节的实体都有实体图（待补清单上的除外）', () => {
  const 缺 = [];
  for (const [文件, 模] of 环节们) {
    for (const 名 of 模.实体们 ?? []) {
      if (实体图(名) === null) 缺.push(`${文件} 的「${名}」`);
    }
  }
  assert.deepEqual(缺, [], `以下实体没有实体图，也不在待补清单上：\n  ${缺.join('\n  ')}`);
});

test('实体们 里没有重复的名字', () => {
  for (const [文件, 模] of 环节们) {
    const 们 = 模.实体们 ?? [];
    assert.equal(new Set(们).size, 们.length, `${文件} 的 实体们 里有重复`);
  }
});
