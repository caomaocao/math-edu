// 蘑菇 —— 书第 42 页 例3 + 练一练的活版（双重规律 / 差递增）。
//  A 轮：篮里已摘 1 2 4 7（差递增 +1+2+3），草地蘑菇编号 10~17，点出下一个该摘的（11 再 16）。
//        蘑菇黄蓝相间是第二条线索。
//  B 轮：2 3 5 8（差递增）报数 → 12 17。
//
// 蘑菇伞盖走贴纸图（黄/蓝两张，颜色仍是第二条线索，只是不再靠 CSS 画那个假半球），
// 数字盖一枚白底圆牌在伞盖正中；篮子也是贴纸图（宽扁托篮）。所以 实体们 列这三样。

import { 说 } from '/shared/js/说话.js';
import { 收起麦克风 } from '/shared/js/问答.js';
import { 元, 做进度点, 洗牌, 歇 } from '/shared/js/搭台.js';
import { 音效 } from '/shared/js/音效.js';
import { 画实体 } from '/shared/js/实体图.js';
import { 报一个数 } from '../报数.js';
import { 画序列, 标当前, 填瓦, 念数 } from '../组件.js';
import { 台词 } from '../台词表.js';
import { 蘑菇 as 题 } from '../数据.js';

export const 实体们 = ['黄蘑菇', '蓝蘑菇', '篮子'];

const 话 = 台词.蘑菇;

// 色 → 素材名，造蘑菇 / 入篮 共用一份（别在两处各写一遍三目）。
const 菇图名 = { 黄: '黄蘑菇', 蓝: '蓝蘑菇' };

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="大画框">
        <div class="草地" id="草地"></div>
        <div class="蘑菇篮框" id="蘑菇篮框">
          <div class="蘑菇篮" id="蘑菇篮"></div>
        </div>
      </div>
      <div class="进度点挂" id="蘑菇进度"></div>
    </div>`;
  const 草地 = 面板.querySelector('#草地');
  const 篮 = 面板.querySelector('#蘑菇篮');
  // 篮子贴纸铺在篮框最底层（卧在小蘑菇后面）。它挂在篮框下、当 篮 的兄弟而不进 篮 里，
  // 这样清空篮里的蘑菇（篮.textContent = ''）永远碰不到它。
  const 篮框 = 面板.querySelector('#蘑菇篮框');
  篮框.insertBefore(画实体('篮子', '🧺', { 类名: '篮图' }), 篮框.firstChild);
  const 点 = 做进度点(面板.querySelector('#蘑菇进度'), 题.A.摘.length + 题.B.补.length);
  let 局 = 0;
  let 摘回调 = null;

  function 造蘑菇(n, i) {
    const 色 = i % 2 === 0 ? '黄' : '蓝';
    const 菇 = 元('div', `蘑菇 ${色}`);
    菇.dataset.n = String(n);
    菇.append(画实体(菇图名[色], '🍄', { 类名: '菇图' }), 元('span', '菇号', String(n)));
    菇.addEventListener('click', () => { if (摘回调) 摘回调(菇); });
    return 菇;
  }

  function 入篮(n, 色类) {
    const 粒 = 元('div', `篮粒 ${色类}`);
    粒.append(画实体(菇图名[色类], '🍄', { 类名: '粒图' }), 元('span', '菇号', String(n)));
    篮.appendChild(粒);
  }

  async function 进入() {
    const 本局 = ++局;
    const 还在 = () => 局 === 本局 && 面板.classList.contains('在前');
    点.清零();
    草地.textContent = '';
    篮.textContent = '';
    摘回调 = null;

    // 篮里已摘的
    题.A.篮.forEach((n, i) => 入篮(n, i % 2 === 0 ? '黄' : '蓝'));
    // 草地 8 朵（编号固定，位置洗一下更像真草地）
    const 菇们 = 洗牌(题.A.草地.map((n, i) => 造蘑菇(n, i)));
    for (const 菇 of 菇们) 草地.appendChild(菇);

    await 说(话.开场);
    if (!还在()) return;
    await 说(话.点摘开场);
    if (!还在()) return;

    let 做到 = 0;
    for (const 目标 of 题.A.摘) {
      if (!还在()) return;
      const 成 = await new Promise((好) => {
        let 错 = 0;
        let 冷却 = false; // 错点节流：孩子一个意图连点三下不算三次错（防呆票01的精神）
        摘回调 = (菇) => {
          if (菇.classList.contains('摘走')) return;
          if (菇.dataset.n === String(目标)) { 好({ 菇, 演示: false }); return; } // 点对永远算数，不被节流
          if (冷却) return;
          冷却 = true;
          setTimeout(() => { 冷却 = false; }, 600); // 盖过 500ms 的摇头动画
          音效.答错();
          菇.classList.add('摇');
          setTimeout(() => 菇.classList.remove('摇'), 500);
          错 += 1;
          if (错 >= 3) { 好({ 菇: 菇们.find((m) => m.dataset.n === String(目标)), 演示: true }); return; }
          说(错 >= 2 ? 话.提示 : 话.摘错);
        };
      });
      摘回调 = null;
      if (!还在() || !成.菇) return;
      if (成.演示) {
        // 三错演示（票 04）：把篮里的差数递增数破——一粒一粒点亮念数，再点亮该摘的那朵
        for (const 粒 of 篮.querySelectorAll('.篮粒')) {
          粒.classList.add('提示中');
          await 说(念数(Number(粒.querySelector('.菇号').textContent)));
          粒.classList.remove('提示中');
          if (!还在()) return;
        }
        await 说(话.提示);
        if (!还在()) return;
        成.菇.classList.add('提示中');
        await 歇(900);
        成.菇.classList.remove('提示中');
        if (!还在()) return;
      }
      音效.答对();
      成.菇.classList.add('摘走');
      入篮(目标, 成.菇.classList.contains('黄') ? '黄' : '蓝');
      点.点亮(做到);
      做到 += 1;
    }

    // B 轮：报数接龙 —— 用组件的序列条，跟火车/接龙/Boss 同一套渲染，不自己搓瓦片
    await 说(话.报数开场);
    if (!还在()) return;
    篮.textContent = '';
    草地.textContent = '';
    const B排 = 元('div');
    草地.appendChild(B排);
    const 值们 = [...题.B.给, ...题.B.补];
    const 空 = new Set(题.B.补.map((_, k) => 题.B.给.length + k));
    const 瓦们 = 画序列(B排, 值们, 空);

    for (let k = 0; k < 题.B.补.length; k += 1) {
      if (!还在()) return;
      const idx = 题.B.给.length + k;
      标当前(瓦们, idx);
      await 报一个数(题.B.补[k], { 提示: async () => 说(话.提示) });
      if (!还在()) return;
      填瓦(瓦们[idx], 题.B.补[k]);
      点.点亮(做到);
      做到 += 1;
    }

    if (!还在()) return;
    await 工具.完成('蘑菇');
    if (!还在()) return;
    收起麦克风();
    await 说(话.收尾);
  }

  return { 进入 };
}
