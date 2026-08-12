// 数字接龙 —— 书第 41 页 例2 练一练的活版（跳跃/周期双线，纯数字报数）。
// 三条数字链一条比一条难；每条画出已知的一段，末尾留几个空，孩子一个一个报下去。
// 错第二次的提示是本站的魂：把链拆成两条线（隔项高亮），「隔一个看一个」。

import { 说 } from '/shared/js/说话.js';
import { 收起麦克风 } from '/shared/js/问答.js';
import { 做进度点 } from '/shared/js/搭台.js';
import { 报一个数 } from '../报数.js';
import { 画序列, 填瓦, 标当前 } from '../组件.js';
import { 台词 } from '../台词表.js';
import { 接龙 as 题们 } from '../数据.js';

export const 实体们 = []; // 纯数字，屏幕上没有实体

const 话 = 台词.接龙;

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="大画框"><div class="接龙条" id="接龙条"></div></div>
      <div class="进度点挂" id="接龙进度"></div>
    </div>`;
  const 条 = 面板.querySelector('#接龙条');
  const 点 = 做进度点(面板.querySelector('#接龙进度'), 题们.length);
  let 局 = 0;

  /** 隔项高亮：把和第 idx 格同奇偶的那条线点亮，另一条压暗 —— 「隔一个看一个」。 */
  function 分两线(瓦们, idx) {
    const 奇偶 = idx % 2;
    瓦们.forEach((瓦, i) => {
      瓦.classList.toggle('提示中', i % 2 === 奇偶);
      瓦.classList.toggle('另一线', i % 2 !== 奇偶);
    });
    setTimeout(() => 瓦们.forEach((瓦) => 瓦.classList.remove('提示中', '另一线')), 2600);
  }

  async function 进入() {
    const 本局 = ++局;
    const 还在 = () => 局 === 本局 && 面板.classList.contains('在前');
    点.清零();

    for (const [ti, 题] of 题们.entries()) {
      if (!还在()) return;
      // 先摆出这一条数字链再开口——空的 #接龙条 会让 .大画框 塌成一个小方块，
      // 看着像卡住了（同花圃/山洞的先例）。
      const 值们 = [...题.给, ...题.补];
      const 空 = new Set(题.补.map((_, k) => 题.给.length + k));
      const 瓦们 = 画序列(条, 值们, 空);
      if (ti === 0) { await 说(话.开场); } else { await 说(话.换一条); }
      if (!还在()) return;

      for (let k = 0; k < 题.补.length; k += 1) {
        if (!还在()) return;
        const idx = 题.给.length + k;
        标当前(瓦们, idx);
        await 报一个数(题.补[k], {
          提示: async () => { 分两线(瓦们, idx); await 说(话.提示); },
        });
        if (!还在()) return;
        填瓦(瓦们[idx], 题.补[k]);
      }
      点.点亮(ti);
    }

    if (!还在()) return;
    await 工具.完成('接龙');
    if (!还在()) return;
    收起麦克风();
    await 说(话.收尾);
  }

  return { 进入 };
}
