import { 说 as 默认朗读 } from '/shared/js/说话.js';
import { 订阅语言, 选 } from '/shared/js/语言.js';
import { 进度 as 默认进度 } from '../state/progress.js';
import { 台词 } from '../data/台词表.js';

/**
 * 导航壳 —— 页面左边竖着排五个很大的图标，点一下右边就换一个玩法。
 *
 * 不跳页、不刷新：五个面板从头到尾都躺在文档里，切换只是把不当前的那几个藏起来。
 * 藏的手法是 visibility + opacity，**不是 display:none** —— 沙盒那块的三维舞台
 * 得一直保着原来的宽高，孩子切走再切回来，衣服还在原地，镜头也不用重新拟合。
 *
 * 图标上不出现一个字：按钮里只有一个绘文字，名字走 `说()`。
 * 鼠标移上去就念名字（孩子不认字，得先听见才知道那是什么），点下去才真的换。
 */

/** 打开网站默认就在沙盒里，孩子不用先过一道菜单才能玩 */
export const 默认模式 = '沙盒';

/**
 * 五个玩法。`名字` 是念给孩子听的孩子叫法，不是术语 ——
 * 「判断关」「对面关」「纸样」这些词只活在代码和文档里，一个都不许念给孩子、
 * 也不许出现在屏幕上（术语和孩子叫法的对照见 CONTEXT.md）。
 *
 * 这五个名字是**鼠标扫过图标时念出来的台词**，出处在这儿而不在 data/台词表.js ——
 * 名字跟图标、面板键是一条数据，拆开了迟早对不上。`main.js` 预热时把它们递进去。
 *
 * 名字是**两语一对**的 `{cn, en}`：孩子扫过图标，听见的是当前这门课里这个入口叫什么。
 * 取值一律走 `玩法名字()`，别直接摸 `.名字` —— 那是个对象，不是句话。
 */
export const 模式列表 = Object.freeze([
  Object.freeze({ 键: '沙盒', 图标: '👕', 名字: Object.freeze({ cn: '穿衣服', en: 'Get dressed' }) }),
  Object.freeze({ 键: '判断关', 图标: '✅', 名字: Object.freeze({ cn: '猜一猜', en: 'Have a guess' }) }),
  Object.freeze({ 键: '对面关', 图标: '🍎', 名字: Object.freeze({ cn: '贴水果', en: 'Fruit stickers' }) }),
  Object.freeze({ 键: '图鉴', 图标: '📖', 名字: Object.freeze({ cn: '衣服图鉴', en: 'The coat book' }) }),
  Object.freeze({ 键: '纸样', 图标: '✂️', 名字: Object.freeze({ cn: '做一件真的', en: 'Make a real one' }) }),
]);

/**
 * 这个玩法这一语叫什么。
 * @param {{名字: {cn: string, en?: string}}} 一个 `模式列表` 里的一条
 * @param {'cn'|'en'} [语] 不给就是当前语言
 */
export function 玩法名字(一个, 语) {
  const 名 = 一个?.名字;
  if (!名) return '';
  return 语 ? (名[语] ?? 名.cn) : 选(名);
}

export function 找模式(键) {
  return 模式列表.find((一个) => 一个.键 === 键) ?? null;
}

/** 同一句话隔这么久之内不重说 */
const 别复读的间隔 = 1800;

/**
 * hover 念一遍、focus 又念一遍、click 再念一遍 —— 孩子听见的是被打断三次的半句话。
 * 包一层：短时间里重复的同一句话直接吞掉。
 */
export function 创建不复读的朗读(朗读, 现在 = () => Date.now()) {
  let 上一句 = null;
  let 上一次 = -Infinity;
  return (话) => {
    const 此刻 = 现在();
    if (话 === 上一句 && 此刻 - 上一次 < 别复读的间隔) return false;
    上一句 = 话;
    上一次 = 此刻;
    朗读(话);
    return true;
  };
}

/**
 * 把左边那条导航画到页面上。
 *
 * @param {HTMLElement} 容器 空的 `<nav>`，图标由这里填进去
 * @param {{
 *   模式?: typeof 模式列表,
 *   默认?: string,
 *   取面板?: (键: string) => HTMLElement | null,
 *   说?: (文本: string) => void,
 *   onSwitch?: (键: string, 上一个: string|null) => void,
 * }} [选项]
 */
export function 创建导航(
  容器,
  {
    模式 = 模式列表,
    默认 = 默认模式,
    取面板 = (键) => document.getElementById(`面板-${键}`),
    说 = 默认朗读,
    onSwitch,
  } = {},
) {
  const 念一下 = 创建不复读的朗读(说);
  const 按钮 = new Map();
  const 面板 = new Map();
  const 听众 = new Set();
  let 当前 = null;
  const 退订们 = [];

  容器.classList.add('导航');
  容器.setAttribute('role', 'tablist');
  容器.setAttribute('aria-orientation', 'vertical');

  for (const 一个 of 模式) {
    const 按 = document.createElement('button');
    按.type = 'button';
    按.className = '导航图标';
    按.dataset.模式 = 一个.键;
    按.setAttribute('role', 'tab');
    // 界面上不放句子，但读屏和自动化验收得认得出这是哪一个
    按.setAttribute('aria-label', 玩法名字(一个));

    const 图 = document.createElement('span');
    图.className = '导航图';
    图.setAttribute('aria-hidden', 'true');
    图.textContent = 一个.图标;
    按.appendChild(图);

    // 孩子不认字，鼠标扫过去就先听见名字，不用点也知道那儿是什么
    按.addEventListener('pointerenter', () => 念一下(玩法名字(一个)));
    按.addEventListener('focus', () => 念一下(玩法名字(一个)));
    按.addEventListener('click', () => 切换到(一个.键));

    容器.appendChild(按);
    按钮.set(一个.键, 按);
    面板.set(一个.键, 取面板(一个.键) ?? null);
  }

  // 上下方向键也能换，键盘用户不至于被挡在门外
  容器.addEventListener('keydown', (事件) => {
    const 方向 = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[事件.key];
    if (!方向) return;
    事件.preventDefault();
    const 位置 = 模式.findIndex((一个) => 一个.键 === 当前);
    const 下一个 = 模式[(位置 + 方向 + 模式.length) % 模式.length];
    切换到(下一个.键);
    按钮.get(下一个.键)?.focus();
  });

  /**
   * 换到某个玩法。
   * @param {string} 键
   * @param {{静音?: boolean}} [怎么换] 开页面时摆好初始状态用 静音，不然一进来就自报家门
   * @returns {boolean} 真的换了没有
   */
  function 切换到(键, { 静音 = false } = {}) {
    const 一个 = 模式.find((m) => m.键 === 键);
    if (!一个) return false;

    if (当前 === 键) {
      if (!静音) 念一下(玩法名字(一个));
      return false;
    }

    const 上一个 = 当前;
    当前 = 键;

    for (const [k, 按] of 按钮) {
      const 选中 = k === 键;
      按.classList.toggle('当前', 选中);
      按.setAttribute('aria-selected', 选中 ? 'true' : 'false');
    }

    for (const [k, 面] of 面板) {
      if (!面) continue;
      const 在前 = k === 键;
      面.classList.toggle('在前', 在前);
      面.setAttribute('aria-hidden', 在前 ? 'false' : 'true');
      // 藏起来的面板里那些按钮不能还能用 Tab 键跳进去
      面.inert = !在前;
    }

    if (!静音) 念一下(玩法名字(一个));

    onSwitch?.(键, 上一个);
    for (const 听 of 听众) {
      try {
        听(键, 上一个);
      } catch {
        // 一个听众炸了不能连累别的
      }
    }
    return true;
  }

  /**
   * 换了语言：五个图标的读屏标签跟着换一门课的说法。
   *
   * 图标本身一个字都没有，所以这里没有什么可「重绘」的像素 —— 但读屏和自动化验收
   * 认的就是这几个 aria-label，它们要是还留在上一语上，验收里根本看不出换过语言。
   * 面板一个都不动：常驻不重建是这一讲的地基（见 CONTEXT.md「不跳页」）。
   */
  function 重挂名字() {
    for (const 一个 of 模式) {
      按钮.get(一个.键)?.setAttribute('aria-label', 玩法名字(一个));
    }
  }

  退订们.push(订阅语言(重挂名字));

  切换到(默认, { 静音: true });

  return {
    get 当前() {
      return 当前;
    },
    模式: [...模式],
    切换到,
    重挂名字,
    按钮元素: (键) => 按钮.get(键) ?? null,
    面板元素: (键) => 面板.get(键) ?? null,
    /** 换玩法时叫你一声（票 05 / 06 / 07 进场时要用）。@returns {() => void} 退订 */
    订阅(听) {
      听众.add(听);
      return () => 听众.delete(听);
    },
    dispose() {
      for (const 退 of 退订们) 退();
      退订们.length = 0;
    },
  };
}

// ---------------------------------------------------------------------------
// 重来
// ---------------------------------------------------------------------------

/**
 * 「重来」—— 缩在左下角，小、灰、不显眼，孩子不容易误点。
 * 点第一下只是**问**：旁边冒出一绿一灰两个键，点绿的才真的清。
 * 问句也不写在屏幕上，走语音；两个键上只有图标。
 *
 * @param {HTMLElement} 容器 空的 `<div class="重来角">`
 * @param {{
 *   进度?: typeof 默认进度,
 *   说?: (文本: string) => void,
 *   onReset?: () => void,
 *   等多久?: number,
 * }} [选项]
 */
export function 创建重来按钮(
  容器,
  // 等多久：那句问话念完要五秒上下，得让孩子听完还有工夫想一想再决定
  { 进度 = 默认进度, 说 = 默认朗读, onReset, 等多久 = 10000 } = {},
) {
  容器.classList.add('重来角');

  /**
   * 三个键各记着自己那对两语名字，换语言时重挂一遍。
   * **得在第一次 造键() 之前声明** —— 造键 里用到它，而 const 在声明之前是个死区，
   * 摆在下面的话整个「重来」按钮建到一半就炸，孩子左下角空空如也。
   */
  const 名字们 = new Map();

  const 触发 = 造键('重来', '🔄', { cn: '重来', en: 'Start again' });
  const 确认组 = document.createElement('div');
  确认组.className = '重来确认';
  const 要 = 造键('确认键 要', '✔️', { cn: '真的重来', en: 'Yes, start again' });
  const 不要 = 造键('确认键 不要', '✖️', { cn: '不重来', en: 'No, keep it' });
  确认组.append(要, 不要);
  容器.append(触发, 确认组);

  let 问着 = false;
  let 定时 = 0;
  // index.html 建这个按钮的时候 main.js 还没跑，所以事后还得能挂钩子进来
  const 重来听众 = new Set(onReset ? [onReset] : []);

  function 造键(样式, 图标, 名字) {
    const 按 = document.createElement('button');
    按.type = 'button';
    按.className = 样式;
    按.setAttribute('aria-label', 选(名字)); // 按钮上只有图标，字只给读屏
    名字们.set(按, 名字);
    const 图 = document.createElement('span');
    图.setAttribute('aria-hidden', 'true');
    图.textContent = 图标;
    按.appendChild(图);
    return 按;
  }

  const 退订语言 = 订阅语言(() => {
    for (const [按, 名字] of 名字们) 按.setAttribute('aria-label', 选(名字));
  });

  function 问(要不要问) {
    问着 = 要不要问;
    容器.classList.toggle('问着', 要不要问);
    确认组.setAttribute('aria-hidden', 要不要问 ? 'false' : 'true');
    确认组.inert = !要不要问;
    clearTimeout(定时);
    // 孩子跑掉了就自己收回去，别一直摆着等人误点
    if (要不要问) 定时 = setTimeout(() => 问(false), 等多久);
  }

  触发.addEventListener('click', () => {
    if (问着) {
      问(false);
      return;
    }
    问(true);
    说(台词().全站.重来问);
  });

  要.addEventListener('click', () => {
    问(false);
    进度.重来();
    说(台词().全站.重来了);
    for (const 听 of 重来听众) {
      try {
        听();
      } catch {
        // 一个听众炸了不能连累别的
      }
    }
  });

  不要.addEventListener('click', () => {
    问(false);
    说(台词().全站.不清了);
  });

  /**
   * 点别处、按 Esc 都当作不清 —— 悬着的确认键是误点的温床。
   *
   * 「点在自己身上」必须先放过：pointerdown 比 click 早，
   * 要是这儿先把确认键收了（display:none），那一下的 click 根本落不到按钮上，
   * 孩子点了绿勾却什么也没发生。
   */
  const 点了别处 = (事件) => {
    if (问着 && !容器.contains(事件.target)) 问(false);
  };
  const 按了键 = (事件) => {
    if (事件.key === 'Escape' && 问着) 问(false);
  };
  window.addEventListener('pointerdown', 点了别处);
  window.addEventListener('keydown', 按了键);

  问(false);

  return {
    get 问着() {
      return 问着;
    },
    收起() {
      问(false);
    },
    /**
     * 真的清掉了就叫你一声（沙盒要靠它把格子纸擦干净）。
     * @returns {() => void} 退订
     */
    订阅重来(听) {
      重来听众.add(听);
      return () => 重来听众.delete(听);
    },
    dispose() {
      clearTimeout(定时);
      退订语言();
      window.removeEventListener('pointerdown', 点了别处);
      window.removeEventListener('keydown', 按了键);
    },
  };
}
