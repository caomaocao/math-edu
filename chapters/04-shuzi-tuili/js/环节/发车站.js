// 发车站 —— 导读（书第 38 页 思维导航的活版）。
// 小火车在轨道上咔哒咔哒，方方念三句：欢迎 → 这一讲学什么 → 去玩。播完点星、回地图。

import { 说 } from '/shared/js/说话.js';
import { 台词 } from '../台词表.js';

// 这一站满屏只有 CSS 画的小火车和轨道（布景），没有一个走实体图的实体：导出空数组，
// 让「确实没有」和「忘了写」分得清（覆盖测试的约定）。
export const 实体们 = [];

const 话 = 台词.发车站;

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="发车台">
        <div class="发车轨"></div>
        <div class="发车头" id="发车头">
          <span class="车身"></span>
          <span class="车头前"></span>
          <span class="车窗"></span>
          <span class="烟囱"></span>
          <span class="烟 烟1"></span><span class="烟 烟2"></span><span class="烟 烟3"></span>
          <span class="轮 轮1"></span><span class="轮 轮2"></span><span class="轮 轮3"></span>
        </div>
      </div>
    </div>`;

  let 局 = 0;

  async function 进入() {
    const 本局 = ++局;
    const 还在 = () => 局 === 本局 && 面板.classList.contains('在前');
    await 说(话.开场);
    if (!还在()) return;
    await 说(话.学什么);
    if (!还在()) return;
    await 工具.完成('发车站');
    if (!还在()) return;
    await 说(话.去玩);
    if (!还在()) return;
    工具.回地图();
  }

  return { 进入 };
}
