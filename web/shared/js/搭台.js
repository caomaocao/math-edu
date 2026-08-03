// 搭台 —— 各环节共用的小工具：造元素、拖拽、进度点、洗牌。

import { 舞台系数, 落到舞台的长度, 框心到舞台 } from './舞台.js';

export function 元(标签, 类名 = '', 内容 = '') {
  const 件 = document.createElement(标签);
  if (类名) 件.className = 类名;
  if (内容 !== '') 件.textContent = 内容;
  return 件;
}

export function 洗牌(数组) {
  const 出 = [...数组];
  for (let i = 出.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [出[i], 出[j]] = [出[j], 出[i]];
  }
  return 出;
}

/** 进度点：一排小圆点，做一题亮一颗。 */
export function 做进度点(挂点, 总数) {
  const 排 = 元('div', '进度点排');
  const 点们 = [];
  for (let i = 0; i < 总数; i++) {
    const 点 = 元('span', '进度点');
    排.appendChild(点);
    点们.push(点);
  }
  挂点.appendChild(排);
  return {
    清零() { for (const 点 of 点们) 点.classList.remove('亮'); },
    点亮(i) { if (点们[i]) 点们[i].classList.add('亮'); },
  };
}

/**
 * 装拖(件, 台, 落点查) —— 一根手指、一只鼠标、一支笔，都能把件拖走。
 *   件：position:absolute 摆在 台 里的元素（left/top 用 px）。
 *   落点查(中心x, 中心y) → 接受了返回 true（由调用方把件吸到位）；false 弹回原位。
 *   件.dataset.锁 === '1' 时拖不动（已经放好的东西）。
 *
 * 走 Pointer Events 而不是 mouse 一套 + touch 一套：对这份代码来说鼠标和手指是同一件事，
 * 分成两条路就是共享件那两次「两份必漂移」的老路（见 CLAUDE.md 里的共享件那节）。
 * 按下就 setPointerCapture：这一次拖的 move/up 从此都定向发给这个件，手指滑出格子、
 * 滑出台、从别的元素上抬起来都还算这一次拖 —— 从前把监听挂到 window 上就是为了这件事，
 * 捕获把它做得更省：拆的时候只用管件自己身上这三个。
 * 手指拖东西时页面不跟着滚，由 舞台.css 在整块舞台上写的 touch-action: none 管，这儿不重复。
 *
 * 两套坐标，别混（见 舞台.js）：clientX 和 getBoundingClientRect 是**缩放之后的视觉像素**，
 * style.left 写的是**舞台像素**，中间差一个系数。而 落点查 收的**仍然是视觉坐标** ——
 * 四个环节都拿它去跟别的元素的 getBoundingClientRect 比，两边同是视觉的才对得上。
 */
export function 装拖(件, 台, 落点查) {
  件.classList.add('可拖');
  if (件.__拆拖) 件.__拆拖(); // 重玩时把上一局的监听拆掉，不然拖一下动两回
  let 作废 = null; // 正拖着时是「这一次不作数」的收场函数，也当「有没有人在拖」的旗子

  const 按下 = (按) => {
    if (件.dataset.锁 === '1' || 作废) return; // 第二根手指不许来抢同一件东西
    按.preventDefault();
    const 系数 = 舞台系数();
    const 台框 = 台.getBoundingClientRect();
    const 件框 = 件.getBoundingClientRect();
    // 手指按在件身上偏出去多少：量到的是视觉像素，而它要从写进 style.left 的数里减出去，
    // 所以先折成舞台里的长度，两个数同一套单位才减得对
    const 差x = 落到舞台的长度(按.clientX - 件框.left, 系数);
    const 差y = 落到舞台的长度(按.clientY - 件框.top, 系数);
    const 原左 = 件.style.left;
    const 原上 = 件.style.top;

    const 挪 = (动) => {
      if (动.pointerId !== 按.pointerId) return;
      件.style.left = `${落到舞台的长度(动.clientX - 台框.left, 系数) - 差x}px`;
      件.style.top = `${落到舞台的长度(动.clientY - 台框.top, 系数) - 差y}px`;
    };

    const 拆 = () => {
      件.removeEventListener('pointermove', 挪);
      件.removeEventListener('pointerup', 撒手);
      件.removeEventListener('pointercancel', 收场);
      try {
        if (件.hasPointerCapture(按.pointerId)) 件.releasePointerCapture(按.pointerId);
      } catch { /* 指针早被系统收走了，那就不用还了 */ }
      件.classList.remove('拖着'); // 先卸掉「拖着」的放大，再量中心，跟从前一个顺序
      作废 = null;
    };

    const 撒手 = (起) => {
      if (起.pointerId !== 按.pointerId) return;
      拆();
      const 框 = 件.getBoundingClientRect();
      const 好 = 落点查(框.left + 框.width / 2, 框.top + 框.height / 2);
      if (!好) { 件.style.left = 原左; 件.style.top = 原上; }
    };

    /*
      指针被收走（pointercancel）：iOS 上系统手势会半路把这根手指整个拿走，之后
      move 和 up 一个都不会再来。这一次拖没人给过它落点判定，所以回原位 ——
      让它停在半空中，孩子看见的是一件卡在货架外面、怎么按都不动的衣服。
      重玩时拆监听走的也是这儿（同样是没落点判定的收场）。
    */
    const 收场 = (断) => {
      if (断 && 断.pointerId !== 按.pointerId) return;
      拆();
      件.style.left = 原左;
      件.style.top = 原上;
    };

    // 先把监听和退路挂上，再去抓指针 —— 顺序是有讲究的。
    // setPointerCapture 会抛（NotFoundError：这个 id 已经没有活着的指针了）。原先它排在
    // 「加 .拖着」之后、挂监听之前，一抛就正好卡在最坏的位置上：件顶着放大 1.2 倍的
    // 「抓住了」的样子，却没有任何 move/up 能让它落回去，孩子眼里就是一件永远举在半空、
    // 怎么按都不动的东西。现在抓不到也只是退化成「手指别离开这个件」，拖照样能用。
    件.addEventListener('pointermove', 挪);
    件.addEventListener('pointerup', 撒手);
    件.addEventListener('pointercancel', 收场);
    作废 = () => 收场(null);
    件.classList.add('拖着');
    try { 件.setPointerCapture(按.pointerId); } catch { /* 抓不着就算了，见上 */ }
  };

  件.addEventListener('pointerdown', 按下);
  件.__拆拖 = () => {
    件.removeEventListener('pointerdown', 按下);
    if (作废) 作废();
  };
}

/**
 * 把件吸进某个落点元素的中心（两者须同在一个定位上下文里）。
 *
 * 这儿两套坐标是混着的，一个除一个不除，别顺手统一：rect 量到的是缩放后的视觉像素，
 * 而 offsetWidth 量的是布局像素（transform 不改它），本来就已经是舞台里的数。
 * 把 offsetWidth 也除一遍，件会歪出去半个自己。
 */
export function 吸到(件, 落点, 台) {
  const 中 = 框心到舞台(落点, 台);
  件.style.left = `${中.x - 件.offsetWidth / 2}px`;
  件.style.top = `${中.y - 件.offsetHeight / 2}px`;
}

/** 等一会儿（毫秒） */
export function 歇(毫秒) { return new Promise((好) => setTimeout(好, 毫秒)); }
