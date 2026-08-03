// 语言开关 —— 全站那两面旗，一处出处。
//
// 长相在 /shared/css/语言开关.css（宿主 <link> 它，或首页那样把它 link 进模板）。
//
// **单击即切，没有二次确认。** 换语言是可逆的、一个字的进度都不动，跟左下角那个
// 「重来」完全不是一个风险等级（那个才要两击）。所以它也刻意长得不像「重来」：
// 摆在对角、是两面彩旗、没有 ↺。
//
// **切换的时序不在这儿。** `说话.js` 自己订了语言变化，而且它排在订阅者队伍的
// 第一个（全站最早被 import 的模块）—— 所以「停语音 → 各面板重绘 → 用新语言
// 重读当前指令」天然就是这个顺序。这儿只管把语言拨过去，重读交给宿主的订阅。

import { 当前语言, 设语言, 订阅语言, 选 } from './语言.js';

/** 两门课各一面旗。孩子不认字，开关只能是图形；字只给读屏和自动化验收 */
const 两门课 = Object.freeze([
  Object.freeze({ 语: 'cn', 旗: '🇨🇳', 名: { cn: '中文', en: 'Chinese' } }),
  Object.freeze({ 语: 'en', 旗: '🇬🇧', 名: { cn: '英文', en: 'English' } }),
]);

/**
 * 把开关装进挂点。挂点自己负责摆在哪儿（这份共享件不写 position）。
 *
 * @param {HTMLElement|null} 挂点 一个空容器；已经有内容的话会被清掉
 * @param {object} [选项]
 * @param {(语: 'cn'|'en') => void} [选项.onSwitch] **真的换了**才叫（点已选中的那面旗不叫）
 * @param {() => void} [选项.点一下] 点旗子的音效，各讲自己的音效库递进来；不给就没声
 * @returns {{元素: HTMLElement, 键元素: (语: string) => HTMLButtonElement|null,
 *            画一下: () => void, dispose: () => void} | null}
 */
export function 装语言开关(挂点, { onSwitch, 点一下 } = {}) {
  if (!挂点) return null;
  挂点.textContent = '';
  挂点.classList.add('语言开关');
  挂点.setAttribute('role', 'group');

  const 钮们 = 两门课.map((一门) => {
    const 旗 = document.createElement('button');
    旗.type = 'button';
    旗.className = '旗';
    旗.dataset.语 = 一门.语;
    旗.textContent = 一门.旗;
    旗.addEventListener('click', () => {
      try { 点一下?.(); } catch { /* 音效不该拦着换课 */ }
      // 已经是这门课了：设语言() 自己回 false，一句多余的话都不说、一次也不重绘
      if (设语言(一门.语)) onSwitch?.(一门.语);
    });
    挂点.appendChild(旗);
    return { ...一门, 旗 };
  });

  /** 选中的那面旗亮着，另一面灰着 —— 「现在上的是这门课」 */
  function 画一下() {
    const 现在 = 当前语言();
    for (const 一门 of 钮们) {
      一门.旗.setAttribute('aria-pressed', String(一门.语 === 现在));
      // 旗上只有一个 emoji，字只给读屏；标签本身也跟着换课
      一门.旗.setAttribute('aria-label', 选(一门.名));
    }
  }

  const 退订 = 订阅语言(画一下);
  画一下();

  return {
    元素: 挂点,
    键元素: (语) => 钮们.find((一门) => 一门.语 === 语)?.旗 ?? null,
    画一下,
    dispose: 退订,
  };
}
