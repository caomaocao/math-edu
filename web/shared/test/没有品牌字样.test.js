import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/*
  仓级红线：品牌字样不进库。

  本仓公开发布（GitHub 快照 = 入库文件减去 .scratch/），而配套教材的书名是别人的
  注册商标——公开仓里出现一次，就等于举着别人的牌子发布。去品牌是 2026-08 一次性
  改完的（.scratch/open-source/issues/01），这条测试挡回潮：哪天新章节的注释里
  手滑写了书名，npm test 会替下一个人记得。

  扫描范围 = `git ls-files` 减去 `.scratch/`（历史工作票，不发布也不改）减去
  `web/shared/vendor/`（第三方库，不可能含中文品牌词，扫它只费时间）。
  二进制文件（图片/音频等）按扩展名跳过。

  两个词都用 \u 转义构造，所以本文件自己的源码里不含这两个词——
  测试不用把自己排除在扫描范围外，也不用给自己开白名单口子。
*/

const 根 = fileURLToPath(new URL('../../../', import.meta.url));

/** 品牌词。\u 转义构造（见文件头），别改写成字面量——那会让本文件自己撞线。 */
const 品牌词 = [
  '\u6469\u6bd4', // 教材品牌名的头两个字
  '\u5b66\u800c\u601d', // 教材出版方的机构名
];

/** 不发布或不可能含中文品牌词的目录，整棵跳过 */
const 跳过前缀 = ['.scratch/', 'web/shared/vendor/'];

/** 二进制扩展名：读出来是乱码，匹配不出汉字，纯浪费时间 */
const 二进制扩展 = /\.(webp|png|jpe?g|gif|ico|mp3|wav|m4a|ogg|mp4|webm|pdf|woff2?|ttf|otf|zip)$/i;

/**
 * 白名单：每条都得写清为什么这个文件的这一处可以出现品牌词。
 * 初始为空，往里加一条等于宣称「这处品牌词随公开仓发布也没问题」——想清楚再加。
 * 条目形如 { 文件, 片段, 因为 }；写了却没命中的条目也算红（防 stale）。
 */
const 白名单 = [];

const 入库文件 = execFileSync('git', ['ls-files', '-z'], { cwd: 根, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter((路) => !跳过前缀.some((前) => 路.startsWith(前)))
  .filter((路) => !二进制扩展.test(路));

const 用过的白名单 = new Set();

test('入库文件里没有品牌字样（.scratch/ 与 vendor 除外）', () => {
  const 犯规 = [];
  for (const 路 of 入库文件) {
    const 绝对 = `${根}${路}`;
    if (!existsSync(绝对)) continue; // 已在工作区删除、尚未提交的文件
    const 文 = readFileSync(绝对, 'utf8');
    if (!品牌词.some((词) => 文.includes(词))) continue;
    文.split('\n').forEach((行, i) => {
      for (const 词 of 品牌词) {
        if (!行.includes(词)) continue;
        const 条 = 白名单.find((条) => 条.文件 === 路 && 行.includes(条.片段));
        if (条) { 用过的白名单.add(`${条.文件}|${条.片段}`); continue; }
        犯规.push(`${路}:${i + 1}  含「${词}」 ← ${行.trim().slice(0, 72)}`);
      }
    });
  }
  assert.deepEqual(
    犯规,
    [],
    `这些地方出现了品牌字样，会随公开仓一起发布出去：\n  ${犯规.join('\n  ')}\n` +
      '书名一律泛化成「配套教材」/「配套某大班数学教材」（页码出处可以留，书名不行）；' +
      '确有理由保留的，去 web/shared/test/没有品牌字样.test.js 的白名单里写上理由。',
  );
});

test('白名单每一项都写了理由', () => {
  for (const 条 of 白名单) {
    assert.ok(
      条.因为 && 条.因为.length >= 3,
      `白名单里「${条.文件}」的「${条.片段}」没写清楚凭什么可以留品牌词`,
    );
  }
});

test('白名单里没有过期条目', () => {
  const 没命中 = 白名单.filter((条) => !用过的白名单.has(`${条.文件}|${条.片段}`));
  assert.deepEqual(
    没命中.map((条) => `${条.文件} 的「${条.片段}」`),
    [],
    '这些白名单条目一处也没命中 —— 字样已经清掉了就把豁免一起删掉，别留着骗下一个人。',
  );
});
