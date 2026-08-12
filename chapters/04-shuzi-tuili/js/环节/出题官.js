// 小小出题官 —— 书第 48 页 闯关五的活版（创作题）。孩子给车厢装货编一道规律题，
// 盖住一节考爸爸，然后**孩子当裁判**点对错。识律器只负责「认出规律就夸好题、
// 认不出也照样发星」——判爸爸对错的权力在孩子手里，机器不插手。创作站记完成不记对错。

import { 说 } from '/shared/js/说话.js';
import { 元 } from '/shared/js/搭台.js';
import { 玩自由 } from '/shared/js/摆放.js';
import { 识律 } from '../识律.js';
import { 造数瓦, 摆放配 } from '../组件.js';
import { 台词 } from '../台词表.js';

export const 实体们 = ['草莓'];

const 话 = 台词.出题官;
const 车厢数 = 5;

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="大画框"><div class="出题挂" id="出题挂"></div></div>
    </div>`;
  const 挂 = 面板.querySelector('#出题挂');
  let 局 = 0;

  // 盖住那一节写「?」是刻意的：这不是空位（斜纹空位=还没填），而是「这里有个数、盖住了、
  // 让爸爸猜」。? 是不认字的孩子也懂的「谜面」记号，跟 ✅❌ 一样属操作约定，不是教学字符。
  function 盖住(瓦) { 瓦.classList.add('盖住'); 瓦.textContent = '?'; }

  async function 进入() {
    const 本局 = ++局;
    const 还在 = () => 局 === 本局 && 面板.classList.contains('在前');
    // 先把空车厢和汽笛摆出来再开口——两句开场白加起来要好几秒，空的 #出题挂 那几秒里
    // 只是一张白板，孩子会不知道发生了什么（同其余几站的先例：先摆台子后开口）。
    // 但闸没开之前台子锁着（点击和汽笛不理）：开场白正念着孩子抢拉汽笛的话，
    // 交上去的是一列空车厢，仪式莫名其妙就开始了（评审抓的雷）。
    let 闸开 = false;
    const 待数们 = 玩自由({
      挂点: 挂,
      题: { 实体: '草莓', 兜底: '🍓', 排布: '塔', 车厢数 },
      配: 摆放配,
      走查: () => 闸开 && 还在(),
    });

    await 说(话.开场);
    if (!还在()) return;
    await 说(话.装车);
    if (!还在()) return;
    闸开 = true;

    const 数们 = await 待数们;
    if (!还在()) return;

    // 重画成数字瓦片，好盖住一节
    挂.textContent = '';
    const 条 = 元('div', '数字条');
    挂.appendChild(条);
    const 瓦们 = 数们.map((v) => { const w = 造数瓦(v); 条.appendChild(w); return w; });

    let 盖下标;
    if (识律(数们)) {
      await 说(话.夸好题);
      if (!还在()) return;
      盖下标 = Math.floor(数们.length / 2); // 认得出：自动盖中间一节
      盖住(瓦们[盖下标]);
      await 说(话.考爸爸);
    } else {
      await 说(话.认不出);
      if (!还在()) return;
      await 说(话.考爸爸);
      if (!还在()) return;
      盖下标 = await new Promise((好) => { // 认不出：请孩子自己点一节盖住
        瓦们.forEach((w, wi) => {
          w.classList.add('可盖');
          w.onclick = () => {
            if (!还在()) return;
            瓦们.forEach((x) => { x.classList.remove('可盖'); x.onclick = null; });
            盖住(w);
            好(wi);
          };
        });
      });
    }
    if (!还在()) return;
    // 出的题存进度（票 06）：跟星星一起进「柜」、随云同步走 —— 换台设备也拿得到这题去考妈妈。
    // 专门的重放界面故意没做：重进这一站重新出一题，比翻旧题更合创作站的乐趣（偏离写此一行）。
    工具.记('出题官最近', { 数们, 盖: 盖下标 });

    // 你当裁判：孩子点 ✅ / ❌（✅❌ 是 UI 图形，白名单里有），机器不判爸爸对错
    await 说(话.你当裁判);
    if (!还在()) return;
    const 章 = 元('div', '裁判章');
    const 对钮 = 元('button', '裁判钮 对章', '✅');
    const 错钮 = 元('button', '裁判钮 错章', '❌');
    章.append(对钮, 错钮);
    挂.appendChild(章);
    await new Promise((好) => {
      const 敲章 = (钮) => {
        工具.音效.点一下();
        钮.classList.add('已盖章');
        对钮.disabled = true; 错钮.disabled = true;
        setTimeout(好, 800);
      };
      对钮.onclick = () => 敲章(对钮);
      错钮.onclick = () => 敲章(错钮);
    });
    if (!还在()) return;

    await 工具.完成('出题官'); // 记完成不记对错：孩子乱摆也拿星
    if (!还在()) return;
    await 说(话.收尾);
  }

  return { 进入 };
}
