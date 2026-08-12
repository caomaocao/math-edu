// Boss 终点总站 —— 自创收官。四类规律混在一起连闯 8 题，输入也混着来：
// '数' 走报数管线、'量' 走摆放管线（复用两条既有管线，票 07）。
// 答对一道，车厢进度往前一节；中途退出再进，连闯进度还在（柜里记做到第几题）；
// 八道全过通关。集齐全章 13 星由 工具.完成 触发大庆祝。

import { 说 } from '/shared/js/说话.js';
import { 收起麦克风 } from '/shared/js/问答.js';
import { 做进度点 } from '/shared/js/搭台.js';
import { 报一个数 } from '../报数.js';
import { 玩一轮 } from '/shared/js/摆放.js';
import { 画序列, 填瓦, 标当前, 摆放配 } from '../组件.js';
import { 台词, 模板 } from '../台词表.js';
import { boss题 as 题们 } from '../数据.js';

// 量题摆的货走实体图（数题是纯数字）
export const 实体们 = [...new Set(题们.filter((q) => q.形 === '量').map((q) => q.实体))];

const 话 = 台词.Boss;
const 续键 = 'Boss题号';

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="大画框"><div class="Boss题条" id="Boss题条"></div></div>
      <div class="进度点挂" id="Boss进度"></div>
    </div>`;
  const 题条 = 面板.querySelector('#Boss题条');
  const 点 = 做进度点(面板.querySelector('#Boss进度'), 题们.length);
  let 局 = 0;

  /**
   * 摆出一题的台子，返回「等它做完」的函数（不 await，调用方决定何时 await）。
   * 量题：起手 玩一轮（渲染+挂监听一步到位，promise 到孩子拉汽笛才 resolve），
   *       但闸没开之前点击和汽笛一律不理（开场白念完调用方才开闸——不锁的话孩子
   *       抢在开场白里连拉汽笛，三次机会梯子能把第一题自动演完）。
   * 数题：画好序列瓦片，等真要听答案时才 报一个数（画面在，天然不可交互，无需闸）。
   * 拆成「先摆」「后等」两步是为了让台子在开场白念完之前就已经在孩子眼前——
   * 空的 #Boss题条 会让画框塌成一个小方块，看着像卡住了（同接龙/找错的先例）。
   * 还在 由调用方按**本局**递进来（不共享可变引用：闭包要是晚绑定到重进后的新局，
   * 守卫护的就是别人家的局了）。
   */
  function 起手(题, 还在, 闸 = () => true) {
    if (题.形 === '量') {
      const p = 玩一轮({
        挂点: 题条,
        题: { 实体: 题.实体, 兜底: 题.兜底, 排布: '塔', 值们: [...题.给, 题.答], 空: [题.给.length] },
        配: 摆放配,
        走查: () => 闸() && 还在(),
      });
      return () => p;
    }
    const 值们 = [...题.给, 题.答];
    const idx = 题.给.length;
    const 瓦们 = 画序列(题条, 值们, new Set([idx]));
    for (const 瓦 of 瓦们) 瓦.classList.add('车厢');
    标当前(瓦们, idx);
    return async () => {
      await 报一个数(题.答);
      if (还在()) 填瓦(瓦们[idx], 题.答);
    };
  }

  async function 进入() {
    const 本局 = ++局;
    const 还在 = () => 局 === 本局 && 面板.classList.contains('在前');
    点.清零();
    // 断点续闯：通关过就从头再玩；没通关就从上次做到的那题接着来（票 07 的验收条）。
    // 两头都钳 + 取整：柜值随云同步走，坏数据（负数/小数/NaN）当没有，不许把站搞死。
    const 起 = 工具.有星('Boss') ? 0
      : Math.min(Math.max(0, Math.floor(Number(工具.取(续键)) || 0)), 题们.length - 1);
    for (let i = 0; i < 起; i += 1) 点.点亮(i);

    let 闸开 = false;
    let 收尾 = 起手(题们[起], 还在, () => 闸开);
    await 说(话.开场);
    if (!还在()) return;
    闸开 = true;

    for (let i = 起; i < 题们.length; i += 1) {
      if (!还在()) return;
      if (i > 起) 收尾 = 起手(题们[i], 还在); // 后续题在上一题的报幕后才摆，无需闸
      await 收尾();
      if (!还在()) return;
      点.点亮(i);
      工具.记(续键, i + 1);
      await 说(模板.Boss.亮车厢(i + 1));
      if (!还在()) return;
    }

    if (!还在()) return;
    工具.记(续键, 0); // 通关了，下次从头
    await 说(话.通关);
    if (!还在()) return;
    await 工具.完成('Boss');
    if (!还在()) return;
    收起麦克风();
    await 说(话.收尾);
  }

  return { 进入 };
}
