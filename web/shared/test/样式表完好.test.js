import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/*
  样式表完好检查 —— 抓「规则被吞进上一条规则的声明块」这种哑火。

  真事：换实体图那一轮，几张票各自往 styles.css 末尾追加规则，合并时漏掉一个右
  花括号，后面整段规则全被吞进 `.沙格.走过::after { … }` 里当成了声明。浏览器不报错、
  数花括号也是平的（少的那个正好被文件末尾多出来的补上），只是那些规则一条都不生效——
  屏幕上动物撑成了 256px 的巨图。人眼是发现了，但那是运气。

  普通规则的声明块里不许再出现 `{`；只有 @media / @keyframes / @supports / @layer
  这类套规则的 at-rule 才允许嵌一层。
*/

const 套得起 = /@(media|keyframes|supports|layer|container|scope)\b/;

/** 找出「普通规则里又开了一个块」的位置，还回出错的行号和那行内容 */
function 找嵌套(源) {
  const 无注释 = 源.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const 栈 = [];
  const 坏 = [];
  let 头 = 0; // 当前这个 { 前面那段选择器/at-rule 的起点
  for (let i = 0; i < 无注释.length; i++) {
    const c = 无注释[i];
    if (c === '{') {
      const 前缀 = 无注释.slice(头, i);
      const 外 = 栈[栈.length - 1];
      if (外 !== undefined && !套得起.test(外)) {
        const 行 = 无注释.slice(0, i).split('\n').length;
        坏.push({ 行, 外: 外.trim().split('\n').pop().trim(), 内: 前缀.trim().split('\n').pop().trim() });
      }
      栈.push(前缀);
      头 = i + 1;
    } else if (c === '}') {
      栈.pop();
      头 = i + 1;
    }
  }
  return { 坏, 没闭上: 栈.length };
}

const 根 = fileURLToPath(new URL('../../../', import.meta.url));

/*
  取材有两种，检查逻辑是同一个。

  一是独立的样式表文件（共享组件的 + 每讲自己的）。二是**大人页写在行内的 `<style>`**——
  这一类一开始不在覆盖内，而它恰恰是全站最大的一坨手写 CSS：两张家长伴读页各约 1180 行，
  比任何一张共享样式表都长，却没有任何东西看着。站级使用指南同样是一整页行内样式。
  大人页不受儿童 UI 铁律约束、各自手写、允许视觉不统一（这是有意的），但「少一个右花括号
  就整段规则静默失效」这条和它们一样适用——那种哑火在散文页上更难被人眼发现。

  孩子的界面不用在这儿单收：讲的样式都在各自的 styles.css 里，上面第一类已经收了。
*/

/*
  一份待查的样式来源：
    标   —— 测试名怎么称呼它（可以带「的行内 <style>」这类修饰）
    址   —— 报错时贴在行号前面的那截，永远是纯路径，好让编辑器点得开
    源   —— CSS 正文
    行偏 —— 让 找嵌套() 报的行号加回去就是原文件里的真实行号
*/
const 取样式表 = (址) => [{ 标: 址, 址, 源: readFileSync(`${根}${址}`, 'utf8'), 行偏: 0 }];

const 取行内 = (址) => {
  const 文 = readFileSync(`${根}${址}`, 'utf8');
  const 块们 = [...文.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
  return 块们.map((m, i) => {
    const 起 = m.index + m[0].length - m[1].length - '</style>'.length;
    return {
      标: 块们.length > 1 ? `${址} 的第 ${i + 1} 个 <style>` : `${址} 的行内 <style>`,
      址,
      源: m[1],
      行偏: 文.slice(0, 起).split('\n').length - 1,
    };
  });
};

const 讲们 = readdirSync(`${根}chapters/`, { withFileTypes: true }).filter((d) => d.isDirectory());

const 源们 = [
  ...readdirSync(`${根}web/shared/css/`)
    .filter((f) => f.endsWith('.css'))
    .flatMap((f) => 取样式表(`web/shared/css/${f}`)),
  ...讲们.flatMap((d) => 取样式表(`chapters/${d.name}/styles.css`)),
  // 站级大人页：web/ 顶层的 HTML。新添一页自动进覆盖，不用回来改这里。
  ...readdirSync(`${根}web/`, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.html'))
    .flatMap((e) => 取行内(`web/${e.name}`)),
  // 每讲的家长伴读页：写了才有，同「存在才显示」那套判断
  ...讲们.filter((d) => existsSync(`${根}chapters/${d.name}/家长.html`)).flatMap((d) => 取行内(`chapters/${d.name}/家长.html`)),
];

for (const { 标, 址, 源, 行偏 } of 源们) {
  test(`${标}：没有规则被吞进上一条规则里`, () => {
    const { 坏, 没闭上 } = 找嵌套(源);
    assert.equal(没闭上, 0, `${标} 有 ${没闭上} 个花括号没闭上`);
    assert.deepEqual(
      坏,
      [],
      坏.map((b) => `${址}:${b.行 + 行偏} 「${b.内}」被吞进了「${b.外}」的声明块——上一条规则少了个 }`).join('\n'),
    );
  });
}
