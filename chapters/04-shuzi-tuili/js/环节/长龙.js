// 数字长龙 —— 书第 44 页 闯关一的活版（1~50 数感）。
// 五行 × 十的大网，锚点 1/10/20/30/40/50 常亮；一行一小轮，每行固定抽 3 空报数，
// 不逐格填满。断点续行：填到第几行落进「柜」，退出再进从那一行接着来。

import { 说 } from '/shared/js/说话.js';
import { 收起麦克风 } from '/shared/js/问答.js';
import { 报一个数 } from '../报数.js';
import { 造数瓦, 填瓦 } from '../组件.js';
import { 台词, 模板 } from '../台词表.js';
import { 长龙 as 配 } from '../数据.js';

export const 实体们 = []; // 纯数字

const 话 = 台词.长龙;
const 行数 = 配.总 / 配.每行;
const 行号 = (v) => Math.floor((v - 1) / 配.每行);
const 空集 = new Set(配.空.flat());
const 锚集 = new Set(配.锚);
const 续键 = '长龙行';

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="大画框"><div class="长龙网" id="长龙网"></div></div>
    </div>`;
  const 网 = 面板.querySelector('#长龙网');
  let 局 = 0;

  function 画网(起始行) {
    网.textContent = '';
    const 瓦按值 = {};
    for (let v = 1; v <= 配.总; v += 1) {
      const 是空 = 行号(v) >= 起始行 && 空集.has(v);
      const 瓦 = 造数瓦(是空 ? null : v);
      瓦.classList.add('长龙格');
      if (锚集.has(v)) 瓦.classList.add('锚');
      网.appendChild(瓦);
      瓦按值[v] = 瓦;
    }
    return 瓦按值;
  }

  async function 进入() {
    const 本局 = ++局;
    const 还在 = () => 局 === 本局 && 面板.classList.contains('在前');
    // 已通关就从头玩；没通关就从存的那一行接着来。
    // 两头都钳 + 取整：柜值随云同步走，坏数据（负数/小数/NaN）当没有，不许把站搞死。
    const 起始行 = 工具.有星('长龙') ? 0
      : Math.min(Math.max(0, Math.floor(Number(工具.取(续键)) || 0)), 行数 - 1);
    const 瓦按值 = 画网(起始行);
    await 说(话.开场);
    if (!还在()) return;

    for (let 行 = 起始行; 行 < 行数; 行 += 1) {
      if (!还在()) return;
      await 说(模板.长龙.行开始(行 + 1));
      if (!还在()) return;
      for (const v of 配.空[行]) {
        if (!还在()) return;
        const 瓦 = 瓦按值[v];
        瓦.classList.add('当前');
        await 报一个数(v, { 教: async () => 说(模板.长龙.教(v)) });
        if (!还在()) return;
        填瓦(瓦, v);
      }
      工具.记(续键, 行 + 1);
      if (行 < 行数 - 1) { await 说(话.一行完); if (!还在()) return; }
    }

    if (!还在()) return;
    await 工具.完成('长龙');
    if (!还在()) return;
    收起麦克风();
    await 说(话.收尾);
  }

  return { 进入 };
}
