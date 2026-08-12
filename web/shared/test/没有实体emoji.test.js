import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/*
  契约红线：实体 emoji 不许**直接**进 DOM。

  全站的实体 emoji 已经换成统一贴纸风的预生成素材（docs/adr/0003，工程票在
  .scratch/entity-art/）。没有这条测试，下一个人随手写个 `员.textContent = '🐰'`
  就把画风打回去了，而且不会有任何人发现——emoji 在代码里长得跟别的字符一样。

  盯的是**渲染出口**，不是「源码里有没有 emoji」：按 ADR 0003，环节数据里的 emoji
  字段要保留，作 `画实体(名, emoji)` 的兜底——查不到素材就回落它，孩子的这一局
  永远不会因为缺图而崩。所以 `画实体('兔子', '🐰')` 是对的，
  `一只.textContent = '🐰'` 是错的：前者过了那道「有图用图」的闸，后者绕过去了。

  放行的只有 UI 图形：话筒、喇叭、按钮图标、国旗、✅❌、⭐、🏆、彩带、方向箭头。
  它们承担的是**操作约定**，不是课程里的某个东西，画成插画反而削弱辨识
  （拍照关那四个色点就是这个道理，它们连 emoji 都不用，是 CSS 画的）。

  白名单只增不减地讨论：往里加一个字符，等于宣称「这个图形不代表任何具体事物」。
*/

/** UI 图形白名单。每一项后面写清楚它凭什么是 UI 图形，别默默往里塞。 */
const UI图形 = new Map([
  ['🎤', '麦克风坞的说话钮'],
  ['🔊', '重听钮'],
  ['🔔', '第4讲摆放题的汽笛（提交）钮 —— 和 🎤🔊 同类的操作约定，不是课程里的东西'],
  ['⏳', '记忆关「再看几秒」的倒计时'],
  ['📸', '看见（拍照）的快门钮'],
  ['▶', '开始钮'],
  ['🇨🇳', '语言开关'],
  ['🇬🇧', '语言开关'],
  ['✅', '猜一猜的「能穿上」'],
  ['❌', '猜一猜的「穿不上」'],
  ['✔', '重来的二次确认'],
  ['✖', '重来的二次确认'],
  ['✔️', '导航键'],
  ['✖️', '导航键'],
  ['➡️', '「下一题」键'],
  ['🔄', '「再玩一次」键'],
  ['🔁', '宝藏的「再听一遍线索」/ 开车的「再念一遍步数提示」'],
  ['↺', '重来钮'],
  ['⭐', '得星标记'],
  ['🌟', '彩带花样'],
  ['✨', '彩带花样'],
  ['🎉', '彩带花样'],
  ['🏆', '通关奖杯'],
  ['🏁', '地图终点旗'],
  ['🏡', '回家钮'],
  ['📖', '「衣服图鉴」导航键'],
  ['✂️', '「做一件真的」导航键'],
  ['🖨️', '打印钮'],
  ['📷', '拍照钮 / 首页卡片图标'],
  ['👕', '「穿衣服」导航键'],
  ['🍎', '「贴水果」导航键（是导航图标，不是台上那个苹果）'],
  ['💨', 'Boss 通关时「小龙已经不在了」的效果字形，不是一个实体'],
  ['⬆️', '方向箭头'], ['⬇️', '方向箭头'], ['⬅️', '方向箭头'], ['➡', '方向箭头'],
  ['↖️', '方向箭头'], ['↗️', '方向箭头'], ['↙️', '方向箭头'], ['↘️', '方向箭头'],
  ['🧭', '「魔法罗盘」那一关的导航图标（关内那个罗盘走素材）'],
  ['🔷', 'manifest 里的章节图标'],
  ['📘', 'manifest 缺图标时的兜底'],
]);

/** 认得出 emoji 的正则（含变体选择符和 ZWJ 连字） */
const emoji正则 = /(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*/gu;

const 根 = fileURLToPath(new URL('../../../', import.meta.url));

/** 递归收集要扫的源文件：两讲的环节/界面代码 + 共享层 */
function 收源(目录, 出 = []) {
  for (const 条 of readdirSync(目录, { withFileTypes: true })) {
    if (条.name === 'vendor' || 条.name === 'test' || 条.name === 'node_modules') continue;
    const 路 = `${目录}/${条.name}`;
    if (条.isDirectory()) 收源(路, 出);
    else if (/\.(js|html)$/.test(条.name) && !条.name.includes('家长') && !条.name.includes('试音')) 出.push(路);
  }
  return 出;
}

const 源们 = [
  ...收源(`${根}chapters/02-cube-fold/src`),
  ...收源(`${根}chapters/03-fangwei/js`),
  ...收源(`${根}chapters/04-shuzi-tuili/js`),
  ...收源(`${根}chapters/05-yiduo-duiying/js`),
  ...收源(`${根}web/shared/js`),
];

/**
 * 把字面 emoji 送进屏幕的那几个出口。
 * `画实体()` / `画实体SVG()` 不在里头——它们就是那道闸。
 */
const 渲染出口 = /textContent|innerHTML|innerText|fillText\s*\(|元素\(\s*'text'|(?<!画实体SVG|画实体)\b元\(/;

test('实体 emoji 不许直接进 DOM（UI 图形白名单除外）', () => {
  const 犯规 = [];
  for (const 路 of 源们) {
    const 文 = readFileSync(路, 'utf8');
    文.split('\n').forEach((行, i) => {
      // 注释不算：文档里提 emoji 是在说明历史，不是画到屏幕上
      const 码 = 行.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '').replace(/^\s*\*.*$/, '');
      if (!渲染出口.test(码)) return;
      for (const m of 码.match(emoji正则) ?? []) {
        if (UI图形.has(m)) continue;
        犯规.push(`${路.slice(根.length)}:${i + 1}  ${m}  ← ${行.trim().slice(0, 72)}`);
      }
    });
  }
  assert.deepEqual(
    犯规,
    [],
    `这些 emoji 绕过 画实体() 直接画到屏幕上了，代表的又是课程里的具体事物：\n  ${犯规.join('\n  ')}\n` +
      `改成 画实体(规范名, 这个emoji, {类名})；确实是 UI 图形的话，往 UI图形 白名单里加一条并写明理由`,
  );
});

test('白名单每一项都写了理由', () => {
  for (const [符, 由] of UI图形) {
    assert.ok(由 && 由.length >= 3, `白名单里的「${符}」没写清楚凭什么是 UI 图形`);
  }
});
