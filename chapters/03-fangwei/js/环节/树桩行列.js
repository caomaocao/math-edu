// 树桩行列 —— 森林点名（书第 29 页 例题2 的活版）。
// 先用扫光教「从上往下数行、从左往右数列」，
// 玩法A：机器问「小兔在第几行第几列」，孩子说数字。
// 玩法B 点名游戏：机器喊「第2行第3列」，孩子点那个树桩。

import { 说 } from '/shared/js/说话.js';
import { 问答, 收起麦克风 } from '/shared/js/问答.js';
import { 判行列 } from '/shared/js/判对.js';
import { 音效 } from '/shared/js/音效.js';
import { 元, 洗牌, 做进度点, 歇 } from '/shared/js/搭台.js';
import { 画实体 } from '/shared/js/实体图.js';
import { 选 } from '/shared/js/语言.js';
import { 台词, 模板 } from '../台词表.js';
import { 行列牌, 行列答, 行列上下文 } from '../方位词.js';

// 这一关屏幕上出现的实体（规范名）。九只动物是提示实体（孩子答的是第几行第几列，不必说出名字）；
// 树桩是每格那只动物坐的木墩凳（原先是 CSS 年轮盘，现走实体图贴纸）。
// 实体图覆盖测试拿它对账，见 test/实体图覆盖.test.js。
export const 实体们 = [
  '小松鼠', '小兔子', '小绵羊', '小狐狸', '大公鸡', '小猪',
  '小青蛙', '小老鼠', '小奶牛', '树桩',
];

const 话 = 台词.树桩行列;
const 模 = 模板.树桩行列;

const 阵容 = [
  ['🐿️', '小松鼠', 'squirrel'], ['🐰', '小兔子', 'bunny'], ['🐑', '小绵羊', 'sheep'],
  ['🦊', '小狐狸', 'fox'], ['🐔', '大公鸡', 'rooster'], ['🐷', '小猪', 'piglet'],
  ['🐸', '小青蛙', 'frog'], ['🐭', '小老鼠', 'mouse'], ['🐮', '小奶牛', 'cow'],
];

/** 这只动物这会儿该念哪个名字（中文名同时是它在 dataset 里的规范名） */
const 桩名 = (桩) => 选({ cn: 桩.dataset.名, en: 桩.dataset.英 });

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="大画框">
        <div class="森林台" id="森林台"></div>
      </div>
      <div class="进度点挂" id="森林进度"></div>
    </div>`;
  const 台 = 面板.querySelector('#森林台');
  const 点 = 做进度点(面板.querySelector('#森林进度'), 8);

  // 3×3 树桩，每个树桩上蹲一只
  const 桩们 = [];
  阵容.forEach(([图, 名, 英], i) => {
    const 桩 = 元('div', '树桩');
    // 动物和墩子叠成一个整体，一格就是一个单元，3×3 看上去才是 3 行，不会被数成 6 行。
    // 墩子走实体图（树桩贴纸，原先是 CSS 年轮盘）；墩上那只也走实体图（小狐狸/小兔子…
    // 归一到动物地图同一张，两关是同一只）。缺图时都还回文本节点，
    // .桩座图 / .桩上动物 的框原样，位置一点不挪。
    const 动 = 元('span', '桩上动物');
    动.appendChild(画实体(名, 图, { 类名: '桩动图' }));
    const 座 = 元('span', '桩座');
    座.setAttribute('aria-hidden', 'true');
    座.appendChild(画实体('树桩', '🪵', { 类名: '桩座图' }));
    桩.append(动, 座);
    桩.dataset.行 = Math.floor(i / 3) + 1;
    桩.dataset.列 = (i % 3) + 1;
    桩.dataset.名 = 名;
    桩.dataset.英 = 英;
    台.appendChild(桩);
    桩们.push(桩);
  });

  function 扫一排(选中) {
    for (const 桩 of 桩们) 桩.classList.remove('提示中');
    for (const 桩 of 选中) 桩.classList.add('提示中');
    setTimeout(() => { for (const 桩 of 桩们) 桩.classList.remove('提示中'); }, 1600);
  }

  let 局 = 0;
  let 点名回调 = null;
  for (const 桩 of 桩们) {
    桩.addEventListener('click', () => { if (点名回调) 点名回调(桩); });
  }

  async function 进入() {
    const 本局 = ++局;
    const 还在 = () => 局 === 本局 && 面板.classList.contains('在前');
    点.清零();
    点名回调 = null;

    // 小课：行与列的扫光
    await 说(话.行小课);
    if (!还在()) return;
    for (let 行 = 1; 行 <= 3; 行++) {
      扫一排(桩们.filter((z) => Number(z.dataset.行) === 行));
      await 说(模.数行(行));
      if (!还在()) return;
    }
    await 说(话.列小课);
    if (!还在()) return;
    for (let 列 = 1; 列 <= 3; 列++) {
      扫一排(桩们.filter((z) => Number(z.dataset.列) === 列));
      await 说(模.数列(列));
      if (!还在()) return;
    }

    let 做到 = 0;

    // ---------------- 玩法A：说行列
    const 出场A = 洗牌(桩们).slice(0, 4);
    await 说(话.我问你答);
    for (const 桩 of 出场A) {
      if (!还在()) return;
      const 行 = Number(桩.dataset.行);
      const 列 = Number(桩.dataset.列);
      桩.classList.add('对了');
      setTimeout(() => 桩.classList.remove('对了'), 700);
      await 问答({
        问: 模.问(桩名(桩)),
        接受们: [行列答(行, 列)],
        判: (文) => 判行列(文, 行, 列),
        上下文: 行列上下文,
        提示: async () => {
          扫一排(桩们.filter((z) => z.dataset.行 === 桩.dataset.行));
          await 说(模.提示(行));
        },
        教: async () => 说(模.教(桩名(桩), 行, 列)),
        备选: [[行, 列], [列, 行], [行, (列 % 3) + 1], [(行 % 3) + 1, 列]]
          .filter((对, i, 全) => 全.findIndex((x) => x[0] === 对[0] && x[1] === 对[1]) === i)
          .map(([r, c]) => ({ 图: 行列牌(r, c), 答: 行列答(r, c) })),
      });
      if (!还在()) return;
      点.点亮(做到++);
    }

    // ---------------- 玩法B：点名游戏
    await 说(话.点名开场);
    const 出场B = 洗牌(桩们).slice(0, 4);
    for (const 桩 of 出场B) {
      if (!还在()) return;
      const 行 = Number(桩.dataset.行);
      const 列 = Number(桩.dataset.列);
      let 错过 = 0;
      const 成 = await new Promise((好) => {
        点名回调 = (点到) => {
          if (点到 === 桩) { 好(true); return; }
          音效.答错();
          错过 += 1;
          if (错过 >= 2) 扫一排(桩们.filter((z) => z.dataset.行 === 桩.dataset.行));
          说(错过 >= 2 ? 模.点错两次(行, 列) : 模.点错了(行, 列));
        };
        说(模.点名(行, 列));
      });
      点名回调 = null;
      if (!还在() || !成) return;
      音效.答对();
      桩.classList.add('对了');
      setTimeout(() => 桩.classList.remove('对了'), 700);
      await 说(模.找对了(桩名(桩)));
      点.点亮(做到++);
    }

    if (!还在()) return;
    await 工具.完成('树桩行列');
    if (!还在()) return;
    收起麦克风();
    await 说(话.收尾);
  }

  return { 进入 };
}
