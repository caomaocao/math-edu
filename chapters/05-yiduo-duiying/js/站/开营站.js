// 开营站 —— 导读（书第 50 页 思维导航的活版）。
// 篝火噼啪、帐篷立好，念三句：欢迎 → 这一讲学什么 → 去玩。念完自动回地图。
// spec 定的星星是站 1~9 + Boss 共 10 颗——开营站**没有星**，所以这儿不调 工具.完成。
// 自动回地图走 工具.回地图（= 层级.退()）：离开一层的唯一出口，见 /shared/js/后退.js。

import { 说 } from '/shared/js/说话.js';
import { 画实体 } from '/shared/js/实体图.js';
import { 台词 } from '../台词表.js';

// 帐篷、篝火、两棵树都是孩子看得见的布景实体，走实体图单闸（素材升级10：帐篷/篝火从 CSS 换贴纸）。
// 开场帐篷复用帐篷站的绿/红帐篷素材（那儿是配对答案维度、已导出并预热），本站不重复登记；
// 篝火是本站首次上屏的实体（Boss 收官的篝火冲天复用它），由本站导出、进 实体们（覆盖测试与预热同一接缝）。
export const 实体们 = ['大树', '松树', '篝火'];

const 话 = 台词.开营站;

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="开营台">
        <span class="开营树 树左" id="开营树左"></span>
        <div class="开营帐 帐甲"></div>
        <div class="篝火堆"></div>
        <div class="开营帐 帐乙"></div>
        <span class="开营树 树右" id="开营树右"></span>
        <div class="营地坪"></div>
      </div>
    </div>`;

  面板.querySelector('#开营树左').append(画实体('大树', '🌳', { 尺寸: 116 }));
  面板.querySelector('#开营树右').append(画实体('松树', '🌲', { 尺寸: 108 }));
  面板.querySelector('.帐甲').append(画实体('绿帐篷', '⛺', { 尺寸: 150 }));
  面板.querySelector('.帐乙').append(画实体('红帐篷', '⛺', { 尺寸: 150 }));
  面板.querySelector('.篝火堆').append(画实体('篝火', '🔥', { 尺寸: 140 }));

  let 局 = 0;

  async function 进入() {
    const 本局 = ++局;
    const 还在 = () => 局 === 本局 && 面板.classList.contains('在前');
    await 说(话.开场);
    if (!还在()) return;
    await 说(话.学什么);
    if (!还在()) return;
    await 说(话.去玩);
    if (!还在()) return;
    工具.回地图();
  }

  return { 进入 };
}
