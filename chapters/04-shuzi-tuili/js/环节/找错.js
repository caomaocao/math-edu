// 找错车厢 —— 自创拓展。一列火车按规律装货，有一节装错了，孩子点出它。
// 点对：车厢摇一摇认错、自动改对。点错：温柔提醒。三次点错：高亮错车厢 + 演示，照样过。
// 题库在 数据.找错，用 识律 反向验证过（每列纠正后是一条能认出的规律；票 08 的一致性测试）。

import { 说 } from '/shared/js/说话.js';
import { 元, 做进度点, 歇 } from '/shared/js/搭台.js';
import { 音效 } from '/shared/js/音效.js';
import { 画实体 } from '/shared/js/实体图.js';
import { 造数瓦, 填瓦, 念数 } from '../组件.js';
import { 台词, 模板 } from '../台词表.js';
import { 找错 as 题库 } from '../数据.js';

// 量题用到的实体（数题没有实体）
export const 实体们 = [...new Set(题库.filter((t) => t.形 === '量').map((t) => t.实体))];

const 话 = 台词.找错;

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="大画框"><div class="找错列" id="找错列"></div></div>
      <div class="进度点挂" id="找错进度"></div>
    </div>`;
  const 列 = 面板.querySelector('#找错列');
  const 点 = 做进度点(面板.querySelector('#找错进度'), 题库.length);
  let 局 = 0;
  let 车厢回调 = null;

  function 画量货(堆, 实体, 兜底, n) {
    堆.textContent = '';
    for (let k = 0; k < n; k += 1) 堆.appendChild(画实体(实体, 兜底, { 类名: '摆件图' }));
  }

  function 画一列(题) {
    列.textContent = '';
    列.className = `找错列 ${题.形 === '量' ? '摆放区 摆布-塔' : '数字条'}`;
    return 题.显示.map((v, i) => {
      let 厢;
      if (题.形 === '量') {
        厢 = 元('div', '摆格');
        const 堆 = 元('div', '摆堆');
        厢.appendChild(堆);
        画量货(堆, 题.实体, 题.兜底, v);
      } else {
        厢 = 造数瓦(v);
        厢.classList.add('车厢');
      }
      厢.classList.add('可点厢');
      厢.dataset.i = String(i);
      厢.addEventListener('click', () => { if (车厢回调) 车厢回调(i, 厢); });
      列.appendChild(厢);
      return 厢;
    });
  }

  async function 进入() {
    const 本局 = ++局;
    const 还在 = () => 局 === 本局 && 面板.classList.contains('在前');
    点.清零();

    for (const [ti, 题] of 题库.entries()) {
      if (!还在()) return;
      // 先摆出这一列货再开口——空的 #找错列 会让画框塌成一个小方块，看着像卡住了。
      const 厢们 = 画一列(题);
      if (ti === 0) { await 说(话.开场); if (!还在()) return; }
      await 说(话.找一找);
      if (!还在()) return;

      const 改对 = (厢) => {
        if (题.形 === '量') 画量货(厢.querySelector('.摆堆'), 题.实体, 题.兜底, 题.对值);
        else 填瓦(厢, 题.对值);
        厢.classList.add('对了');
      };

      const 成 = await new Promise((好) => {
        let 错 = 0;
        let 冷却 = false; // 错点节流：一个意图连点三下不算三次错（防呆票01的精神）
        车厢回调 = (i, 厢) => {
          if (i === 题.错位) { 好({ 厢, 演示: false }); return; } // 点对永远算数，不被节流
          if (冷却) return;
          冷却 = true;
          setTimeout(() => { 冷却 = false; }, 600); // 盖过 500ms 的摇头动画
          音效.答错();
          厢.classList.add('摇一摇');
          setTimeout(() => 厢.classList.remove('摇一摇'), 500);
          错 += 1;
          if (错 >= 3) { 好({ 厢: 厢们[题.错位], 演示: true }); return; } // 三次：直接点出错车厢演示
          说(话.点错了);
        };
      });
      车厢回调 = null;
      if (!还在() || !成) return;
      音效.答对();
      if (成.演示) {
        // 三错演示（票 07）：其余车厢依次点亮报数，错车厢自己跳出来认错
        for (const [i, 厢] of 厢们.entries()) {
          if (i === 题.错位) continue;
          厢.classList.add('提示中');
          await 说(念数(题.显示[i]));
          厢.classList.remove('提示中');
          if (!还在()) return;
        }
        成.厢.classList.add('跳出');
        await 歇(700);
        成.厢.classList.remove('跳出');
        if (!还在()) return;
      }
      成.厢.classList.add('提示中');
      改对(成.厢);
      await 说(成.演示 ? 模板.找错.教(题.对值, 题.错位 + 1) : 话.点对了);
      if (!还在()) return;
      点.点亮(ti);
    }

    if (!还在()) return;
    await 工具.完成('找错');
    if (!还在()) return;
    await 说(话.收尾);
  }

  return { 进入 };
}
