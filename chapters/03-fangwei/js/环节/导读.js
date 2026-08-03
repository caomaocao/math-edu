// 导读 —— 出发啦：一分钟的开场，说清今天学什么，不考任何题。
// 书第 26 页「思维导航」的孩子版：文字版给家长（首页 ⓘ），这里全靠说和演。

import { 说 } from '/shared/js/说话.js';
import { 元, 歇 } from '/shared/js/搭台.js';
import { 画实体 } from '/shared/js/实体图.js';
import { 台词 } from '../台词表.js';
import { 牌字 } from '../方位词.js';

// 这一关屏幕上出现的实体（规范名）。主角依次变成火箭、礼物盒、罗盘；小熊小狐狸站在前后两边当「前」「后」的参照。
// 实体图覆盖测试拿它对账，见 test/实体图覆盖.test.js。
export const 实体们 = [
  '火箭', '礼物盒', '罗盘', '小熊', '狐狸',
];

const 话 = 台词.导读;

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="大画框 导读框">
        <div class="导读台" id="导读台">
          <div class="导读主角" id="导读主角"></div>
          <div class="导读演区" id="导读演区"></div>
        </div>
      </div>
    </div>`;
  const 演区 = 面板.querySelector('#导读演区');
  const 主角 = 面板.querySelector('#导读主角');

  // 主角连换三次（火箭 → 礼物盒 → 罗盘），每次整个换掉那一个孩子，不是改一个字。
  function 换主角(名, 兜底) {
    主角.replaceChildren(画实体(名, 兜底, { 类名: '主角图' }));
  }

  let 局 = 0;

  async function 进入() {
    const 本局 = ++局;
    演区.innerHTML = '';
    换主角('火箭', '🚀');

    const 还在 = () => 局 === 本局 && 面板.classList.contains('在前');

    await 说(话.开场);
    if (!还在()) return;

    // 演一：盒子和六个方向的小伙伴
    换主角('礼物盒', '🎁');
    // 第五项是规范名：有名字的是实体（小熊、狐狸，画贴纸图），没名字的四个是方向标
    // ——⬆️⬇️⬅️➡️ 是 UI 图形，跟罗盘的箭头、Boss 的指针同类，永远保持 emoji。
    const 六方 = [
      ['⬆️', '上', 50, 4], ['⬇️', '下', 50, 88], ['⬅️', '左', 10, 46],
      ['➡️', '右', 90, 46], ['🐻', '前', 38, 72, '小熊'], ['🦊', '后', 62, 22, '狐狸'],
    ];
    for (const [图, , x, y, 名] of 六方) {
      const 员 = 元('span', '导读冒头', 名 ? '' : 图);
      if (名) 员.appendChild(画实体(名, 图, { 类名: '冒头图' }));
      员.style.left = `${x}%`;
      员.style.top = `${y}%`;
      演区.appendChild(员);
      await 歇(160);
    }
    await 说(话.六个方向);
    if (!还在()) return;

    // 演二：罗盘和口诀
    演区.innerHTML = '';
    换主角('罗盘', '🧭');
    // 屏幕上印的是当前这门课要认的那个词（中文课「北」，英文课 NORTH）
    const 四方 = [['北', 50, 6], ['南', 50, 88], ['西', 8, 46], ['东', 92, 46]];
    for (const [方, x, y] of 四方) {
      const 牌 = 元('span', '导读方位字', 牌字(方));
      牌.style.left = `${x}%`;
      牌.style.top = `${y}%`;
      演区.appendChild(牌);
      await 歇(200);
    }
    await 说(话.四个大方向);
    if (!还在()) return;

    await 说(话.学了有什么用);
    if (!还在()) return;
    await 工具.完成('导读');
    if (!还在()) return;
    await 说(话.去下一关);
    if (!还在()) return;
    工具.回地图();
  }

  return { 进入 };
}
