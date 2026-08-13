// 花圃 —— 书第 40 页 例1 的活版（等差 +1）。花坛一块一块，花越种越多：1 2 3 4 5 6，
// 下一块该种几朵？孩子开口报（或点数字瓦片）。

import { 说 } from '/shared/js/说话.js';
import { 收起麦克风 } from '/shared/js/问答.js';
import { 元, 歇 } from '/shared/js/搭台.js';
import { 画实体 } from '/shared/js/实体图.js';
import { 报一个数 } from '../报数.js';
import { 台词, 模板 } from '../台词表.js';
import { 花圃 as 题 } from '../数据.js';

export const 实体们 = ['小花'];

const 话 = 台词.花圃;

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="大画框"><div class="花坛排" id="花坛排"></div></div>
    </div>`;
  const 排 = 面板.querySelector('#花坛排');
  let 局 = 0;

  function 一块花坛(n) {
    const 坛 = 元('div', '花坛');
    坛.appendChild(画实体('花坛', '🪴', { 类名: '坛图' })); // 空土花坛贴纸（栽的花是上面另一层）
    const 花组 = 元('div', '花组');
    if (n == null) {
      坛.classList.add('空坛');
    } else {
      for (let k = 0; k < n; k += 1) 花组.appendChild(画实体('小花', '🌸', { 类名: '花图' }));
    }
    // 空花坛不写「?」：斜纹底 + 虚线框已经在说「这块空着、等你种」，屏幕上不多放一个非数字的字
    const 标 = 元('div', '花坛数', n == null ? '' : String(n));
    坛.append(花组, 标);
    return { 坛, 花组, 标 };
  }

  async function 进入() {
    const 本局 = ++局;
    const 还在 = () => 局 === 本局 && 面板.classList.contains('在前');
    排.textContent = '';
    const 坛们 = 题.给.map((n) => 一块花坛(n));
    const 空坛 = 一块花坛(null);
    for (const b of 坛们) 排.appendChild(b.坛);
    排.appendChild(空坛.坛);

    await 说(话.开场);
    if (!还在()) return;
    // 数一数：逐块高亮，念出朵数
    for (const b of 坛们) {
      if (!还在()) return;
      b.坛.classList.add('提示中');
      await 歇(500);
      b.坛.classList.remove('提示中');
    }

    const 答 = 题.补[0];
    await 报一个数(答, {
      问: 话.问,
      提示: async () => { for (const b of 坛们) b.坛.classList.add('提示中'); await 说(模板.花圃.教(答)); setTimeout(() => { for (const b of 坛们) b.坛.classList.remove('提示中'); }, 1500); },
      教: async () => 说(模板.花圃.教(答)),
    });
    if (!还在()) return;

    // 把空花坛种满
    空坛.坛.classList.remove('空坛');
    空坛.标.textContent = String(答);
    空坛.标.classList.add('填好');
    for (let k = 0; k < 答; k += 1) 空坛.花组.appendChild(画实体('小花', '🌸', { 类名: '花图' }));

    if (!还在()) return;
    await 工具.完成('花圃');
    if (!还在()) return;
    收起麦克风();
    await 说(话.收尾);
  }

  return { 进入 };
}
