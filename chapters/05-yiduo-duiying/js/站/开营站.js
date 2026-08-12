// 开营站 —— 导读（书第 50 页 思维导航的活版）。
// 篝火噼啪、帐篷立好，念三句：欢迎 → 这一讲学什么 → 去玩。念完自动回地图。
// spec 定的星星是站 1~9 + Boss 共 10 颗——开营站**没有星**，所以这儿不调 工具.完成。
// 自动回地图走 工具.回地图（= 层级.退()）：离开一层的唯一出口，见 /shared/js/后退.js。

import { 说 } from '/shared/js/说话.js';
import { 画实体 } from '/shared/js/实体图.js';
import { 台词 } from '../台词表.js';

// 帐篷、篝火是 CSS 画的布景（帐篷×4色的素材归票 03，这儿的开场帐篷不承担教学）；
// 两棵树走实体图单闸——它们是孩子看得见的布景实体，进 实体们（覆盖测试与预热同一接缝）。
export const 实体们 = ['大树', '松树'];

const 话 = 台词.开营站;

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="开营台">
        <span class="开营树 树左" id="开营树左"></span>
        <div class="开营帐 帐甲"></div>
        <div class="篝火堆">
          <span class="柴 柴左"></span><span class="柴 柴右"></span>
          <span class="火苗 苗大"></span><span class="火苗 苗左"></span><span class="火苗 苗右"></span>
        </div>
        <div class="开营帐 帐乙"></div>
        <span class="开营树 树右" id="开营树右"></span>
        <div class="营地坪"></div>
      </div>
    </div>`;

  面板.querySelector('#开营树左').append(画实体('大树', '🌳', { 尺寸: 116 }));
  面板.querySelector('#开营树右').append(画实体('松树', '🌲', { 尺寸: 108 }));

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
