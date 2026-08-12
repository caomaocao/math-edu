// 数字火车 —— 书第 47 页 闯关四的活版（等差 + 差递增，报数）。
// 四列火车开过来，有的车厢牌子空着；一列一轮，孩子把空车厢的号码报出来。

import { 说 } from '/shared/js/说话.js';
import { 收起麦克风 } from '/shared/js/问答.js';
import { 做进度点 } from '/shared/js/搭台.js';
import { 报一个数 } from '../报数.js';
import { 画序列, 填瓦, 标当前 } from '../组件.js';
import { 台词 } from '../台词表.js';
import { 火车 as 题们 } from '../数据.js';

export const 实体们 = []; // 纯数字

const 话 = 台词.火车;

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="大画框">
        <div class="火车列">
          <div class="火车头小" aria-hidden="true">
            <span class="头囱"></span>
            <span class="头舱"></span>
            <span class="头窗"></span>
            <span class="头身"></span>
            <span class="头轮 头轮1"></span>
            <span class="头轮 头轮2"></span>
          </div>
          <div class="车厢条" id="车厢条"></div>
        </div>
      </div>
      <div class="进度点挂" id="火车进度"></div>
    </div>`;
  const 条 = 面板.querySelector('#车厢条');
  const 点 = 做进度点(面板.querySelector('#火车进度'), 题们.length);
  let 局 = 0;

  async function 进入() {
    const 本局 = ++局;
    const 还在 = () => 局 === 本局 && 面板.classList.contains('在前');
    点.清零();

    for (const [ti, 题] of 题们.entries()) {
      if (!还在()) return;
      // 先摆出这一列车厢再开口——理由同接龙站：空的 #车厢条 会让画框塌成一个小方块。
      const 空 = new Set(题.空);
      const 瓦们 = 画序列(条, 题.值们, 空);
      for (const 瓦 of 瓦们) 瓦.classList.add('车厢');
      if (ti === 0) { await 说(话.开场); } else { await 说(话.换一列); }
      if (!还在()) return;

      for (const idx of 题.空) {
        if (!还在()) return;
        标当前(瓦们, idx);
        await 报一个数(题.值们[idx]);
        if (!还在()) return;
        填瓦(瓦们[idx], 题.值们[idx]);
      }
      点.点亮(ti);
    }

    if (!还在()) return;
    await 工具.完成('火车');
    if (!还在()) return;
    收起麦克风();
    await 说(话.收尾);
  }

  return { 进入 };
}
