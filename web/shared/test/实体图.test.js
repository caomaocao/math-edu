import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { 有图, 归一, 素材名, 实体图, 画法 } from '../js/实体图.js';

/*
  实体图注册表和磁盘对账。跟台词表的「缺英文是红测试」同例：
  缺一张该有的图不许静默回落 emoji 上线，而是在这儿变红。

  换图工程收尾时那份临时的「待补」清单已经清空删掉（票 11），所以这里的
  对账是实打实的：注册表和磁盘必须一一对上，归一表指到的每张图都得真的存在。
*/

const 素材目录 = fileURLToPath(new URL('../assets/实体图/', import.meta.url));
const 磁盘上 = new Set(
  readdirSync(素材目录).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)),
);

test('注册表里的每个名字，磁盘上都有同名 WebP', () => {
  for (const 名 of 有图) {
    assert.ok(磁盘上.has(名), `注册表有「${名}」但 web/shared/assets/实体图/${名}.webp 不存在`);
  }
});

test('磁盘上的每张 WebP，注册表里都有名字（不许有黑户素材）', () => {
  for (const 名 of 磁盘上) {
    assert.ok(有图.has(名), `assets/实体图/${名}.webp 没登记进 实体图.js 的 有图`);
  }
});

test('归一表的每个目标都是注册表里真有的素材名', () => {
  for (const [规范, 素] of 归一) {
    assert.ok(
      有图.has(素),
      `归一表把「${规范}」指向「${素}」，但注册表里没有「${素}」这张素材`,
    );
    assert.ok(!归一.has(素), `「${素}」自己又被归一到别处了，归一表不许套两层`);
  }
});

test('小鸡和公鸡是两个视觉实体，不许归到一起', () => {
  assert.equal(素材名('小鸡'), '小鸡');
  assert.equal(素材名('大公鸡'), '公鸡');
});

test('素材名() 把同一只动物的几种叫法折到同一张图', () => {
  assert.equal(素材名('小狐狸'), 素材名('狐狸'));
  assert.equal(素材名('小兔子'), 素材名('小兔'));
  assert.equal(素材名('小兔子'), 素材名('兔子'));
  assert.equal(素材名('小松鼠'), 素材名('松鼠'));
  assert.equal(素材名('长颈鹿'), '长颈鹿', '没登记归一的，名字本身就是素材名');
});

test('实体图() 查得到的给 URL，查不到的给 null', () => {
  assert.equal(实体图('苹果'), '/shared/assets/实体图/%E8%8B%B9%E6%9E%9C.webp');
  assert.equal(实体图('不存在的实体'), null);
});

test('实体图() 走归一：小狐狸拿到的是狐狸那张', () => {
  assert.equal(实体图('小狐狸'), 实体图('狐狸'));
  assert.notEqual(实体图('狐狸'), null);
});

test('画法() 有图给图、没图给兜底 emoji', () => {
  assert.deepEqual(画法('苹果', '🍎'), {
    种: '图', url: '/shared/assets/实体图/%E8%8B%B9%E6%9E%9C.webp', 名: '苹果',
  });
  assert.deepEqual(画法('还没生成的东西', '🥔'), { 种: '字', 字: '🥔', 名: '还没生成的东西' });
});
