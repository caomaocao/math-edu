// 兔子草地 —— 书第 53 页 练一练 的活版（一多对应 1:2，纯报数）。
// 十只兔子排两排晒太阳，问一共几只耳朵 → 20。错2提示（票面定的）：按只带数
// 2、4、6……逐只高亮读数。答对后**换位演示**（只演不考）：先把每只兔子的左耳
// 逐个点亮数到 10，再点右耳数到 10，说破「10+10 也是 20」。
//
// 题面数值从 站点表.js 的台账读；换位步子 / 带数序列 / 带数着亮 从 熊猫竹林.js
// import（三站共用的小逻辑，家在头一站，别抄第二份）。
// 耳朵点不动兔子贴纸本身：贴纸是一张图，单只耳朵亮不起来，所以在耳朵位置叠两个
// CSS 光点（跟拍照色点、宝藏脚印同一先例——不是实体，是指示光）。

import { 说 } from '/shared/js/说话.js';
import { 收起麦克风 } from '/shared/js/问答.js';
import { 画实体 } from '/shared/js/实体图.js';
import { 元, 歇 } from '/shared/js/搭台.js';
import { 报一个数 } from '../报数.js';
import { 台词, 模板 } from '../台词表.js';
import { 站点表 } from '../站点表.js';
import { 换位步子, 带数序列, 带数着亮, 念数 } from './熊猫竹林.js';

export const 实体们 = ['兔子'];

const 账 = 站点表.find((条) => 条.号 === '兔子草地').台账;
const 话 = 台词.兔子草地;

/**
 * 队形() —— 「排两排」是 spec 的布景事实（不是台账数值），每排几只由台账的只数推导。
 * 一致性测试咬：排数 × 每排 = 只数。
 */
export function 队形() {
  const 排数 = 2;
  return { 排数, 每排: 账.只数 / 排数 };
}

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="大画框"><div class="草地排"></div></div>
    </div>`;
  const 排区 = 面板.querySelector('.草地排');
  let 局 = 0;

  /** 摆出两排兔子；每只身上备好左右两个耳朵光点（演示前都藏着）。 */
  function 摆兔子() {
    排区.textContent = '';
    const { 排数, 每排 } = 队形();
    const 兔位们 = [];
    for (let r = 0; r < 排数; r += 1) {
      const 行 = 元('div', '草地行');
      for (let k = 0; k < 每排; k += 1) {
        const 位 = 元('div', '兔位');
        位.append(
          画实体('兔子', '🐰', { 类名: '兔图' }),
          元('span', '耳点 耳点左'),
          元('span', '耳点 耳点右'),
        );
        行.appendChild(位);
        兔位们.push(位);
      }
      排区.appendChild(行);
    }
    return 兔位们;
  }

  async function 进入() {
    const 本局 = ++局;
    const 还在 = () => 局 === 本局 && 面板.classList.contains('在前');
    const 兔位们 = 摆兔子();

    await 说(话.开场);
    if (!还在()) return;

    // 报数：一共几只耳朵 → 答（错2提示 = 按只带数 2、4、6……逐只高亮读数，票面定的）
    await 报一个数(账.答, {
      问: 话.问耳朵,
      提示: async () => {
        await 说(话.带数头);
        await 带数着亮(兔位们, 带数序列(账.每只, 账.只数), 还在);
      },
    });
    if (!还在()) return;
    收起麦克风();

    // 换位演示（只演不考）：左耳全点亮数出 10，右耳再点亮数出 10，说破 10+10 也是 20。
    // 20 个光点逐个报数太磨叽，这儿是快速级联 + 每边收尾念一声那一边的数。
    await 说(话.换位头);
    if (!还在()) return;
    for (const { 侧, 第几 } of 换位步子(账.换位)) {
      if (!还在()) return;
      const 点 = 兔位们[第几 - 1].querySelector(侧 === 0 ? '.耳点左' : '.耳点右');
      点.classList.add(侧 === 0 ? '亮甲' : '亮乙');
      工具.音效.点一下();
      await 歇(140);
      if (第几 === 账.换位[侧]) await 说(念数(账.换位[侧]));
    }
    if (!还在()) return;
    await 说(模板.兔子草地.换位说破(账.换位[0], 账.换位[1], 账.答));
    if (!还在()) return;
    await 歇(600);
    for (const 位 of 兔位们) {
      for (const 点 of 位.querySelectorAll('.耳点')) 点.classList.remove('亮甲', '亮乙');
    }

    await 工具.完成('兔子草地');
    if (!还在()) return;
    await 说(话.收尾);
  }

  return { 进入 };
}
