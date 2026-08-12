import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { 站点表, 星站们, 站名 } from '../js/站点表.js';

/*
  站点表 —— 本讲台账的单一出处，对着 .scratch/yiduo-duiying/issues/00-spec.md 的台账
  逐项核。这里咬合三件事：
    1. 11 站的名单、顺序、星星账（站 1~9 + Boss 共 10 颗）与 spec 一字不差；
    2. 核准题面数值既等于 spec 抄下来的数，又自己算得拢（答 = 每只×只数 …）——
       谁改歪一个数，这里立刻红；
    3. 并行热点的三处对得上：站点表的 号 ↔ index.html 的 面板-<号> ↔ styles.css 的
       「站：<号>」分段标（票 02 的约定，后票只在自己的段里写）。
*/

const 汉字 = /[　-〿一-鿿＀-￯]/;

// ── 名单与星星账 ─────────────────────────────────────────────────────────────

test('台账：11 站的号与顺序和 spec 逐项一致', () => {
  assert.deepEqual(
    站点表.map((条) => 条.号),
    ['开营站', '帐篷站', '熊猫竹林', '兔子草地', '分饭站', '喂食站',
     '松果虫虫站', '果盘数数', '腿腿站', '蛋糕派对', 'Boss'],
  );
});

test('台账：星星只在站 1~9 + Boss，共 10 颗；开营站没有星', () => {
  assert.equal(星站们.length, 10);
  assert.equal(站点表[0].号, '开营站');
  assert.equal(站点表[0].星, false);
  for (const 条 of 站点表.slice(1)) assert.equal(条.星, true, `「${条.号}」该有星`);
});

test('台账：每站双语名、图标、出处、输入方式齐全，英文名无汉字', () => {
  const 见过的号 = new Set();
  for (const 条 of 站点表) {
    assert.ok(条.号 && !见过的号.has(条.号), `站号「${条.号}」重复或为空`);
    见过的号.add(条.号);
    assert.ok(条.名?.cn?.trim(), `「${条.号}」缺中文名`);
    assert.ok(条.名?.en?.trim(), `「${条.号}」缺英文名`);
    assert.equal(汉字.test(条.名.en), false, `「${条.号}」英文名夹汉字：${条.名.en}`);
    assert.ok(条.素?.trim(), `「${条.号}」缺节点图标的规范名`);
    assert.ok(条.图?.trim(), `「${条.号}」缺兜底 emoji`);
    assert.ok(条.书?.trim(), `「${条.号}」缺书面出处`);
    assert.ok(条.输入?.trim(), `「${条.号}」缺输入方式`);
  }
  assert.equal(站名(站点表[0], 'en'), 站点表[0].名.en);
  assert.equal(站名(站点表[0], '法语这种没有的'), 站点表[0].名.cn, '缺的语言该回落中文');
});

test('台账：spec 的输入列逐项对上', () => {
  const 输入 = Object.fromEntries(站点表.map((条) => [条.号, 条.输入]));
  assert.deepEqual(输入, {
    开营站: '导读',
    帐篷站: '配对',
    熊猫竹林: '摆放+报数',
    兔子草地: '报数',
    分饭站: '发饭+报数',
    喂食站: '摆放+报数',
    松果虫虫站: '摆放',
    果盘数数: '报数',
    腿腿站: '报数',
    蛋糕派对: '发饭+报数',
    Boss: '混合+演示',
  });
});

// ── 核准题面数值：等于 spec 的数，且自己算得拢 ─────────────────────────────────

const 账 = Object.fromEntries(站点表.map((条) => [条.号, 条.台账]));

test('开营站是导读，没有题面', () => {
  assert.equal(账.开营站, null);
});

test('帐篷站：4 对，帐篷/雨伞两轮', () => {
  assert.equal(账.帐篷站.对数, 4);
  assert.deepEqual(账.帐篷站.轮们, ['帐篷', '雨伞']);
});

test('熊猫竹林：3 只 × 2 根 = 6，换位 3+3', () => {
  assert.deepEqual(账.熊猫竹林, { 每只: 2, 只数: 3, 答: 6, 换位: [3, 3] });
  assert.equal(账.熊猫竹林.答, 账.熊猫竹林.每只 * 账.熊猫竹林.只数);
  assert.equal(账.熊猫竹林.换位[0] + 账.熊猫竹林.换位[1], 账.熊猫竹林.答);
});

test('兔子草地：10 只 × 2 耳 = 20，换位 10+10', () => {
  assert.deepEqual(账.兔子草地, { 每只: 2, 只数: 10, 答: 20, 换位: [10, 10] });
  assert.equal(账.兔子草地.答, 账.兔子草地.每只 * 账.兔子草地.只数);
  assert.equal(账.兔子草地.换位[0] + 账.兔子草地.换位[1], 账.兔子草地.答);
});

test('分饭站：8 碗，每人 2 碗分 4 人、每人 4 碗分 2 人', () => {
  assert.equal(账.分饭站.共, 8);
  assert.deepEqual(账.分饭站.轮们, [{ 每人: 2, 答: 4 }, { 每人: 4, 答: 2 }]);
  for (const 轮 of 账.分饭站.轮们) {
    assert.equal(轮.每人 * 轮.答, 账.分饭站.共, '发到锅空：每人 × 人数 = 一锅');
  }
});

test('喂食站：狗骨头 1:1（2/3/4 只）；企鹅鱼 1:2，4 只 → 8', () => {
  assert.deepEqual(账.喂食站.狗骨头, { 每只: 1, 狗数们: [2, 3, 4] });
  assert.deepEqual(账.喂食站.企鹅鱼, { 每只: 2, 只数: 4, 答: 8 });
  assert.equal(账.喂食站.企鹅鱼.答, 账.喂食站.企鹅鱼.每只 * 账.喂食站.企鹅鱼.只数);
});

test('松果虫虫站：三小题的数值列（票 06 已对 p57 裁图逐格核准，与 spec 台账一致）', () => {
  const { 小题们 } = 账.松果虫虫站;
  assert.equal(小题们.length, 3);
  const [松鼠, 骨头, 毛毛虫] = 小题们;

  assert.equal(松鼠.名, '松鼠松果');
  assert.deepEqual([松鼠.每只, 松鼠.只数们, 松鼠.答们], [3, [2, 4, 6], [6, 12, 18]]);
  松鼠.只数们.forEach((只, i) => assert.equal(松鼠.答们[i], 只 * 松鼠.每只));

  assert.equal(骨头.名, '骨头分狗');
  assert.deepEqual([骨头.每只, 骨头.根数们, 骨头.答们], [4, [4, 8, 12], [1, 2, 3]]);
  骨头.根数们.forEach((根, i) => assert.equal(骨头.答们[i], 根 / 骨头.每只));

  assert.equal(毛毛虫.名, '毛毛虫分鸡');
  assert.deepEqual([毛毛虫.每只, 毛毛虫.条数们, 毛毛虫.答们], [3, [6, 9, 12], [2, 3, 4]]);
  毛毛虫.条数们.forEach((条数, i) => assert.equal(毛毛虫.答们[i], 条数 / 毛毛虫.每只));

  for (const 题 of 小题们) assert.equal('待核' in 题, false, `「${题.名}」已核准，待核标该摘干净`);
});

test('果盘数数：苹果 2×3 带练 → 橘子 2×4 → 樱桃 3×6', () => {
  assert.deepEqual(账.果盘数数.盘们, [
    { 果: '苹果', 排数: 2, 每排: 3, 带练: true },
    { 果: '橘子', 排数: 2, 每排: 4 },
    { 果: '樱桃', 排数: 3, 每排: 6 },
  ]);
});

test('腿腿站：小鸡 2 腿 5 只 → 10；小猪 4 腿 4 只 → 16', () => {
  assert.deepEqual(账.腿腿站.题们, [
    { 物: '小鸡', 腿: 2, 只数: 5, 答: 10 },
    { 物: '小猪', 腿: 4, 只数: 4, 答: 16 },
  ]);
  for (const 题 of 账.腿腿站.题们) assert.equal(题.答, 题.腿 * 题.只数);
});

test('蛋糕派对：20 块每人 4 块 → 5 人', () => {
  assert.deepEqual(账.蛋糕派对, { 共: 20, 每人: 4, 答: 5 });
  assert.equal(账.蛋糕派对.每人 * 账.蛋糕派对.答, 账.蛋糕派对.共);
});

test('Boss：五族混合 + 青蛙彩蛋数到 400（只演不考）', () => {
  assert.deepEqual(账.Boss.族们, ['配对', '喂食', '发饭', '几个几', '腿数']);
  assert.deepEqual(账.Boss.彩蛋, { 腿: 4, 一排: 10, 排数: 10, 顶: 400 });
  const { 腿, 一排, 排数, 顶 } = 账.Boss.彩蛋;
  assert.equal(顶, 腿 * 一排 * 排数);
});

// ── 并行热点的三处对得上（票 02 的约定形状） ──────────────────────────────────

test('挂点：index.html 每站都有 面板-<号>，外加地图面板', () => {
  const 页 = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
  assert.ok(页.includes('id="面板-地图"'), '地图面板不见了');
  for (const { 号 } of 站点表) {
    assert.ok(页.includes(`id="面板-${号}"`), `index.html 里没有「面板-${号}」的挂点`);
    assert.ok(页.includes(`data-环节="${号}"`), `「面板-${号}」缺 data-环节 标`);
  }
});

test('分段：styles.css 每站都有自己的「站：<号>」段标（后票只在自己的段里写）', () => {
  const 表 = readFileSync(fileURLToPath(new URL('../styles.css', import.meta.url)), 'utf8');
  for (const { 号 } of 站点表) {
    assert.ok(表.includes(`站：${号}`), `styles.css 里没有「站：${号}」的分段占位`);
  }
});
