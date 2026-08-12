// 组件 —— 这一讲各站共用的小 DOM 件：数字瓦片、数字序列条，和「这个数怎么念」。
// 屏幕上唯一允许的字是数字（本讲要教的字），所以数字直接写进 textContent，
// 不走实体图（那是给「东西」的闸，数字不是东西）。没有一个 emoji。

import { 选 } from '/shared/js/语言.js';
import { 中文数, 英文数 } from '/shared/js/数词.js';
import { 台词, 模板 } from './台词表.js';

/** 这个数在当前这门课里怎么念（十六 / sixteen）——演示、提示里数数用它，一处出处。 */
export function 念数(n) {
  return 选({ cn: 中文数(n), en: 英文数(n) });
}

/**
 * 共享摆放引擎（/shared/js/摆放.js）的本讲注入面：汽笛提交钮 + 火车话术 + 上限 12。
 * 三个摆放站和出题官、Boss 都递这一份，别各自现写（写三份必漂移）。
 * 话术全是函数 —— 说话那一刻才从台词表取词，语言活切换（焊成字符串就把课钉死了）。
 * 标签只给读屏（图标就是孩子的说明书），双语对写在这一处 —— 跟 问答.js 坞钮标签的
 * 先例一样，不进台词表（不是要念的话）。
 */
export const 摆放配 = {
  提交钮: { 图标: '🔔', 标签: { cn: '拉汽笛', en: 'Pull the whistle' } },
  话术: {
    对: () => 台词.摆放.对,
    错1: () => 台词.摆放.错1,
    提示头: () => 台词.摆放.提示头,
    演示头: () => 台词.摆放.演示头,
    教数: (n) => 模板.摆放.教数(n),
  },
  上限: 12, // 一个容器最多摆几个（书里最多 10，留一点余量）
};

/** 一块数字瓦片。值为 null = 空位（斜纹底）。 */
export function 造数瓦(值, { 类名 = '' } = {}) {
  const 瓦 = document.createElement('div');
  瓦.className = `数瓦 ${值 == null ? '空' : ''} ${类名}`.trim();
  if (值 != null) 瓦.textContent = String(值);
  return 瓦;
}

/**
 * 画一条数字序列（火车车厢 / 花坛 / 数字链都用它）。
 * @param 容器  挂点
 * @param 值们  完整正确序列
 * @param 空    Set<下标>，这些位置画成空位（等孩子来补）
 * @returns 瓦片数组（按下标），空位那格可后来 填(下标, 值)
 */
export function 画序列(容器, 值们, 空 = new Set()) {
  容器.textContent = '';
  容器.classList.add('数字条');
  const 瓦们 = 值们.map((v, i) => {
    const 瓦 = 造数瓦(空.has(i) ? null : v);
    容器.appendChild(瓦);
    return 瓦;
  });
  return 瓦们;
}

/** 把某个空位填上数字并弹一下。 */
export function 填瓦(瓦, 值) {
  瓦.classList.remove('空', '当前');
  瓦.classList.add('填好');
  瓦.textContent = String(值);
}

/** 高亮「现在轮到这一格」。 */
export function 标当前(瓦们, 下标) {
  for (const 瓦 of 瓦们) 瓦.classList.remove('当前');
  if (瓦们[下标]) 瓦们[下标].classList.add('当前');
}
