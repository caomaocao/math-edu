// 腿腿站 —— 书第 59 页 闯关四的活版（一多对应·腿数）。两轮报数，数据从站点表读：
// 5 只小鸡几条腿 → 10；4 只小猪几条腿 → 16。
// 错 2 次的提示按票面：「按只带数」——逐只高亮，数字牌翻出累计腿数 2、4、6……
// （小猪 4、8、12……），嘴里跟着念（屏上唯一允许的字是数字，04 的豁免口径）。
// 孩子点的只有麦克风坞和数字瓦片（共享件管触靶）；小动物只看不点。

import { 说 } from '/shared/js/说话.js';
import { 收起麦克风 } from '/shared/js/问答.js';
import { 元, 歇, 做进度点 } from '/shared/js/搭台.js';
import { 画实体 } from '/shared/js/实体图.js';
import { 选 } from '/shared/js/语言.js';
import { 中文数, 英文数 } from '/shared/js/数词.js';
import { 报一个数 } from '../报数.js';
import { 台词, 模板 } from '../台词表.js';
import { 站点表 } from '../站点表.js';

const 账 = 站点表.find((条) => 条.号 === '腿腿站').台账;
const 兜底们 = { 小鸡: '🐤', 小猪: '🐷' };

// 台账是单一出处：这一站看得见的实体就是两轮的动物（覆盖测试与预热同吃这一个导出）。
export const 实体们 = 账.题们.map((题) => 题.物);

/** 逐只腿数(腿, 只数) → [2, 4, 6, …]：数到第 i 只时的累计腿数，提示逐只念的就是这串。 */
export function 逐只腿数(腿, 只数) {
  return Array.from({ length: 只数 }, (_, i) => 腿 * (i + 1));
}

const 数词说 = (n) => 说(选({ cn: 中文数(n), en: 英文数(n) }));

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="大画框"><div class="动物排" id="动物排"></div></div>
      <div class="进度点挂" id="腿腿进度"></div>
    </div>`;
  const 排 = 面板.querySelector('#动物排');
  const 进度点 = 做进度点(面板.querySelector('#腿腿进度'), 账.题们.length);
  let 位们 = [];
  let 局 = 0;

  function 摆动物({ 物, 只数 }) {
    排.textContent = '';
    位们 = [];
    for (let i = 0; i < 只数; i += 1) {
      const 位 = 元('div', '动物位');
      位.appendChild(画实体(物, 兜底们[物], { 尺寸: 108 }));
      const 牌 = 元('div', '数字牌 腿数牌');
      位.appendChild(牌);
      排.appendChild(位);
      位们.push({ 位, 牌 });
    }
  }

  /** 错 2 次的提示：逐只点亮（点过的留着亮），数字牌翻出累计腿数，嘴里跟着念。 */
  function 逐只提示(题, 还在) {
    return async () => {
      await 说(台词.腿腿站.提示头);
      const 数列 = 逐只腿数(题.腿, 题.只数);
      for (let i = 0; i < 位们.length; i += 1) {
        if (!还在()) return;
        位们[i].位.classList.add('亮');
        位们[i].牌.textContent = String(数列[i]);
        位们[i].牌.classList.add('显');
        await 数词说(数列[i]);
      }
      await 歇(600);
      for (const { 位 } of 位们) 位.classList.remove('亮');
      // 数字牌留着不收：提示数出来的战果，孩子答的时候还要看着它。
    };
  }

  /** 一轮：摆动物 → 教「一只有几条腿」→ 报总腿数。走完返回 true；被打断返回 false。 */
  async function 玩一轮(题, 还在) {
    摆动物(题);
    // 模板键按动物名拼（小鸡开场/小猪问……），说话那一刻才从合并视图取——语言活切换。
    await 说(模板.腿腿站[`${题.物}开场`](题.腿));
    if (!还在()) return false;
    await 报一个数(题.答, {
      问: 模板.腿腿站[`${题.物}问`](题.只数),
      提示: 逐只提示(题, 还在),
    });
    if (!还在()) return false;
    for (const { 位 } of 位们) 位.classList.add('对了');
    await 歇(700);
    for (const { 位 } of 位们) 位.classList.remove('对了');
    return true;
  }

  async function 进入() {
    const 本局 = ++局;
    const 还在 = () => 局 === 本局 && 面板.classList.contains('在前');
    let 起 = 工具.取('腿腿站.轮');
    if (!Number.isInteger(起) || 起 < 0 || 起 >= 账.题们.length) 起 = 0; // 柜值两头钳
    进度点.清零();
    for (let i = 0; i < 起; i += 1) 进度点.点亮(i);
    await 说(台词.腿腿站.开场);
    if (!还在()) return;
    for (let i = 起; i < 账.题们.length; i += 1) {
      if (!还在()) return;
      if (!await 玩一轮(账.题们[i], 还在)) return;
      进度点.点亮(i);
      // 走完一轮记一格；全走完归零，下回从头玩（重来清柜也回到这儿）。
      工具.记('腿腿站.轮', i + 1 < 账.题们.length ? i + 1 : 0);
      if (i + 1 < 账.题们.length) {
        await 说(台词.腿腿站.换下一位);
        if (!还在()) return;
      }
    }
    await 工具.完成('腿腿站');
    if (!还在()) return;
    收起麦克风();
    await 说(台词.腿腿站.收尾);
  }

  return { 进入 };
}
