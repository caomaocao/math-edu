// 山洞 —— 书第 41 页 例2 的活版（跳跃双线）。橙萝卜一根一根多起来（1 2 3 4 → 5），
// 紫萝卜一直是 3（→ 3），两种换着排。孩子分别报出下一撮橙的、紫的各几根。
// 本站的魂在提示：错第二次时把同色的一撮撮单独点亮，「隔一个看一个」。

import { 说 } from '/shared/js/说话.js';
import { 收起麦克风 } from '/shared/js/问答.js';
import { 元 } from '/shared/js/搭台.js';
import { 画实体 } from '/shared/js/实体图.js';
import { 报一个数 } from '../报数.js';
import { 台词, 模板 } from '../台词表.js';
import { 山洞 as 题 } from '../数据.js';

export const 实体们 = ['胡萝卜', '茄子'];

const 话 = 台词.山洞;

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="大画框"><div class="山洞排" id="山洞排"></div></div>
    </div>`;
  const 排 = 面板.querySelector('#山洞排');
  let 局 = 0;

  function 一撮(色, 条, n) {
    const 撮 = 元('div', `萝卜撮 ${色}`);
    if (n == null) 撮.classList.add('空撮');
    else for (let k = 0; k < n; k += 1) 撮.appendChild(画实体(条.实体, 条.兜底, { 类名: '萝卜图' }));
    return 撮;
  }

  async function 进入() {
    const 本局 = ++局;
    const 还在 = () => 局 === 本局 && 面板.classList.contains('在前');
    排.textContent = '';
    // 交替铺开已给的：橙 蓝 橙 蓝 橙 蓝 橙，再留一撮橙空、一撮蓝空
    const 橙撮们 = [];
    const 蓝撮们 = [];
    const 轮数 = Math.max(题.橙.给.length, 题.蓝.给.length);
    for (let i = 0; i < 轮数; i += 1) {
      if (i < 题.橙.给.length) { const c = 一撮('橙', 题.橙, 题.橙.给[i]); 橙撮们.push(c); 排.appendChild(c); }
      if (i < 题.蓝.给.length) { const c = 一撮('蓝', 题.蓝, 题.蓝.给[i]); 蓝撮们.push(c); 排.appendChild(c); }
    }
    // 末尾两撮空的：DOM 顺序按交替接下去（橙4 → 蓝空 → 橙空），让「橙紫橙紫…橙」的
    // 隔一个节奏一路保持到尾巴。若照「橙空 蓝空」贴出去，尾巴成了 橙4 橙5 蓝3——两根橙
    // 挨在一起、紫萝卜落单在最右，家长一看就觉得「放反了」（真机反馈）。报数仍先橙后紫
    // （跟台词/书对齐）：各撮认的是 橙空/蓝空 的引用，跟它排在第几位无关。
    const 蓝空 = 一撮('蓝', 题.蓝, null); 蓝撮们.push(蓝空); 排.appendChild(蓝空);
    const 橙空 = 一撮('橙', 题.橙, null); 橙撮们.push(橙空); 排.appendChild(橙空);

    const 闪 = (撮们) => { for (const c of 撮们) c.classList.add('提示中'); setTimeout(() => { for (const c of 撮们) c.classList.remove('提示中'); }, 2400); };
    const 填撮 = (撮, 条, n) => { 撮.classList.remove('空撮'); 撮.textContent = ''; for (let k = 0; k < n; k += 1) 撮.appendChild(画实体(条.实体, 条.兜底, { 类名: '萝卜图' })); 撮.classList.add('对了'); };

    await 说(话.开场);
    if (!还在()) return;

    // 橙萝卜下一撮
    const 橙答 = 题.橙.补[0];
    橙空.classList.add('当格');
    await 报一个数(橙答, { 问: 话.橙问, 提示: async () => { 闪(橙撮们.filter((c) => c !== 橙空)); await 说(话.提示); }, 教: async () => 说(模板.山洞.教橙(橙答)) });
    if (!还在()) return;
    橙空.classList.remove('当格');
    填撮(橙空, 题.橙, 橙答);

    // 紫萝卜下一撮
    const 蓝答 = 题.蓝.补[0];
    蓝空.classList.add('当格');
    await 报一个数(蓝答, { 问: 话.蓝问, 提示: async () => { 闪(蓝撮们.filter((c) => c !== 蓝空)); await 说(话.提示); }, 教: async () => 说(模板.山洞.教蓝(蓝答)) });
    if (!还在()) return;
    蓝空.classList.remove('当格');
    填撮(蓝空, 题.蓝, 蓝答);

    if (!还在()) return;
    await 工具.完成('山洞');
    if (!还在()) return;
    收起麦克风();
    await 说(话.收尾);
  }

  return { 进入 };
}
