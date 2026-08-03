import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/*
  舞台里不许出现视口单位（vw / vh / dvh / svh / vmin / vmax）。

  真事，而且是这轮触屏化最隐蔽的一处：`vw`/`vh` **永远**按真实视口算，祖先身上的
  transform 一点也不影响单位解析。所以一个画在基准舞台（比如 1280×842 的定尺坐标系）
  里的元素写 `min(600px, 70vh)`，在手机上算的是那台手机 ~358pt 的七成 ≈ 250px ——
  周围的东西都按舞台缩放走，就它按窗口走。桌面上看不出来（窗口本来就 900 上下），
  一到横屏手机整块版面不是等比缩小而是**扭曲**：该占半台的东西缩成三分之一。

  规矩很简单：**舞台就是那套坐标系，「装进小屏幕」是舞台一个人的事，缩放一次搞定。**
  舞台里再摆一套按窗口走的响应式，就是两套机制互相拆台。
    min(600px, 70vh) → 600px；要「舞台的几分之几」用 % 或直接写 px。

  舞台外的那几处是正当的（html/body 的高、开始遮罩、转屏拦罩、纸样打印区 ——
  打印要的是真毫米，不是舞台像素），所以下面按「文件 + 片段 + 为什么」一条条放行。
  放行条目必须真的命中；写了却没命中也算红 —— 免得挪走代码之后留一条骗人的豁免。
*/

const 根 = fileURLToPath(new URL('../../../', import.meta.url));

const 视口单位 = /(?<![\w-])\d*\.?\d+(vw|vh|dvh|svh|lvh|dvw|svw|lvw|vmin|vmax)(?![\w-])/g;

/**
 * 把注释挖掉再查 —— 注释里追述「原来是 min(760px, 90vw)」是**好事**，
 * 那是留给下一个人的说明，不该被红线打成违规。
 * 块注释按 CSS/JS 一起处理；行注释只挖不像网址的那种（别把 https:// 挖断）。
 */
function 去注释(源) {
  return 源
    .replace(/\/\*[\s\S]*?\*\//g, (块) => 块.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:\w])\/\/[^\n]*/g, (行, 前) => 前 + ' '.repeat(Math.max(行.length - 前.length, 0)));
}

/** 放行名单：每条都得写清为什么它在舞台外 */
const 放行 = [
  { 文件: 'chapters/03-fangwei/styles.css', 片段: 'html, body', 因为: 'html/body 的高在舞台外，铺的是整块屏幕' },
  // 第2讲的 html/body 用的是 height: 100%，本来就没有视口单位，所以这儿不需要它的条目。
];

const 讲们 = readdirSync(`${根}chapters/`, { withFileTypes: true }).filter((d) => d.isDirectory());

/** 一讲里所有可能写 CSS 的文件：样式表 + 往 JS 里塞 CSS 的那些（第2讲好几关这么干） */
function 讲的文件们(名) {
  const 出 = [];
  const 表 = `chapters/${名}/styles.css`;
  if (existsSync(`${根}${表}`)) 出.push(表);
  const 走 = (相对) => {
    const 绝对 = `${根}${相对}`;
    if (!existsSync(绝对)) return;
    for (const 条 of readdirSync(绝对, { withFileTypes: true })) {
      const 下 = `${相对}/${条.name}`;
      if (条.isDirectory()) 走(下);
      else if (条.name.endsWith('.js') && !相对.includes('/test')) 出.push(下);
    }
  };
  走(`chapters/${名}/js`);
  走(`chapters/${名}/src`);
  return 出;
}

const 用过的放行 = new Set();

for (const { name } of 讲们) {
  for (const 址 of 讲的文件们(name)) {
    test(`${址}：舞台里没有视口单位`, () => {
      const 源 = 去注释(readFileSync(`${根}${址}`, 'utf8'));
      const 犯规 = [];
      源.split('\n').forEach((行文, i) => {
        const 命中 = [...行文.matchAll(视口单位)];
        if (!命中.length) return;
        const 条 = 放行.find((条) => 条.文件 === 址 && 行文.includes(条.片段));
        if (条) { 用过的放行.add(`${条.文件}|${条.片段}`); return; }
        犯规.push(`${址}:${i + 1} 用了 ${命中.map((m) => m[0]).join('、')} —— ${行文.trim()}`);
      });
      assert.deepEqual(
        犯规,
        [],
        `${犯规.length} 处视口单位画在基准舞台里（vw/vh 按窗口算，不跟舞台缩放，手机上会扭曲）：\n${犯规.join('\n')}\n`
        + '改成舞台像素（写死 px）或对定尺父元素取百分比；真在舞台外的，去 web/shared/test/舞台里没有视口单位.test.js 的放行名单里写上理由。',
      );
    });
  }
}

test('放行名单里没有过期条目', () => {
  const 没命中 = 放行.filter((条) => !用过的放行.has(`${条.文件}|${条.片段}`));
  assert.deepEqual(
    没命中.map((条) => `${条.文件} 的「${条.片段}」`),
    [],
    '这些放行条目一处也没命中 —— 代码挪走了就把豁免一起删掉，别留着骗下一个人。',
  );
});
