// 转屏拦罩 —— 竖着拿手机进了讲，就盖住画面请他把手机横过来。
//
// 为什么是「拦」而不是「为竖屏重排」：竖屏 402pt 宽塞不下基准舞台的宽度，系数会掉到
// 三成上下，什么都按不着 —— 让孩子在按不着的画面里挣扎，比拦住他更糟。见 docs/adr/0004。
//
// 只拦两讲的孩子界面。大人页（家长伴读、使用指南、首页、试音）竖屏照常读，不装这件。
//
// 提示是图形不是句子：孩子不认字，屏幕上不许出现要他读的字（全站铁律）。所以画面是
// 一台会自己转过去的手机（纯 CSS，没有一个绘文字 —— Boss 的指针那次教训：生僻绘文字
// 在系统字体里可能整个是空的），字只在嘴上说。
//
// 一份代码两讲共用：markup 在这儿，长相在 /shared/css/转屏.css。别拷第三份。

import { 说, 有话可重听 } from './说话.js';
import { 当前语言 } from './语言.js';

const 两语 = {
  cn: { 请横屏: '把手机横过来玩，转一下！' },
  en: { 请横屏: 'Turn the phone sideways to play. Give it a turn!' },
};

/** 这一件的台词。和别处一样：说的时候才查表，别在 import 时把语言焊死。 */
export function 转屏台词表(语 = 当前语言()) { return 语 === 'en' ? 两语.en : 两语.cn; }

/** 预热要备的话（讲把它摊进自己的预热单子里）。 */
export function 转屏台词们(语) { return [转屏台词表(语).请横屏]; }

function 造罩() {
  const 罩 = document.createElement('div');
  罩.className = '转屏拦罩';
  罩.setAttribute('aria-hidden', 'true'); // 孩子不认字，这件对读屏也没意义
  // 一台竖着的手机，转到横着，停一下，再来 —— 动作本身就是那句话
  罩.innerHTML = `
    <div class="转屏台">
      <div class="转屏手机"><span class="转屏屏"></span></div>
      <div class="转屏弧"></div>
    </div>`;
  return 罩;
}

/**
 * 装上转屏拦罩。竖屏 + 触屏时露面，横过来就撤。
 *
 * 只在「粗指针」设备上拦：桌面上把窗口拉成瘦高的，那是大人在调窗口，不该被拦。
 *
 * 说话的时机借 有话可重听() 判断 —— 这一讲要是还没开过口，说明开始遮罩上那一下点击
 * 还没发生、浏览器不许出声，这时候硬说只会在控制台里报一条错。孩子玩到一半才转屏的，
 * 那会儿早就说过话了，自然听得见。
 */
export function 装转屏拦罩(挂点 = document.body) {
  const 罩 = 造罩();
  挂点.appendChild(罩);

  const 竖着 = window.matchMedia('(orientation: portrait)');
  const 手指 = window.matchMedia('(pointer: coarse)');
  let 挡着 = false;

  const 看一眼 = () => {
    const 该挡 = 竖着.matches && 手指.matches;
    if (该挡 === 挡着) return;
    挡着 = 该挡;
    罩.classList.toggle('挡着', 该挡);
    // 转回横屏什么都不做：面板一直挂在文档里没销毁，孩子玩到哪还在哪（第2讲同款约定）
    if (该挡 && 有话可重听()) 说(转屏台词表().请横屏);
  };

  看一眼();
  竖着.addEventListener('change', 看一眼);
  手指.addEventListener('change', 看一眼);

  // 不还任何东西：这件跟讲同生共死，没有「拆掉它」这回事（面板都不销毁，它更不会）。
  // 一个没人调的 拆() 只是看着周全的死代码。真需要退场的那天再加，那时才知道该退成什么样。
}
