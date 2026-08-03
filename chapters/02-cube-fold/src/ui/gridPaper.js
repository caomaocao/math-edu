import { CELL_STYLES, cellStyle } from '../domain/palette.js';
import { 订阅语言, 选 } from '/shared/js/语言.js';
import { 画实体 } from '/shared/js/实体图.js';

/**
 * 格子纸 —— 孩子在这儿点格子，涂出一张衣服。
 *
 * 点一下涂上颜色，再点一下取消。最多涂 6 格：正方体只有 6 个面，
 * 一个格子折上去就是一个面，多涂一格就没有面能给它了。
 *
 * 涂上的颜色和水果，跟三维里那个面上的一模一样（同一套 palette）——
 * 孩子必须看得出格子和面是同一张纸的两种状态。
 */

export const 格子纸行数 = 4;
export const 格子纸列数 = 5;

/**
 * 5 列 × 4 行装得下 11 种能合上的衣服里的每一种（某个摆法下），
 * 35 种六格骨牌里装不下的只有一条直的 1×6 —— 而它本来也穿不上。
 */
export const 最多格子 = CELL_STYLES.length;

const 同一格 = (a, b) => a.row === b.row && a.col === b.col;

// ---------------------------------------------------------------------------
// 对面高亮的样式（03 票）
// ---------------------------------------------------------------------------

/**
 * 这段 CSS 由本模块自己注入，没写进 styles.css。
 *
 * 刻意的取舍：03（点面看对面）和 04（导航）是两个 agent 同时在做的，
 * styles.css 归 04，两边一起改必然互相覆盖。功能自带的样式跟着功能的 JS 走，
 * 谁也不碰谁。断网可用这条不受影响 —— 一个字节都不从网上取。
 */
const 对面高亮样式 = `
.纸格子.涂了.对面亮 {
  border-color: var(--对面色);
  box-shadow:
    inset 0 0 0 3px rgba(255, 255, 255, 0.9),
    0 0 0 5px var(--对面色),
    0 0 26px 9px var(--对面光);
  transform: scale(1.09);
  animation: 对面呼吸 1.5s ease-in-out infinite;
}

/* 亮着一对的时候，别的格子跟着三维里那四个面一起暗下去 */
.格子纸.在看对面 .纸格子.涂了:not(.对面亮) {
  opacity: 0.38;
}

@keyframes 对面呼吸 {
  0%,
  100% {
    box-shadow:
      inset 0 0 0 3px rgba(255, 255, 255, 0.9),
      0 0 0 5px var(--对面色),
      0 0 18px 5px var(--对面光);
  }
  50% {
    box-shadow:
      inset 0 0 0 3px rgba(255, 255, 255, 0.9),
      0 0 0 6px var(--对面色),
      0 0 34px 12px var(--对面光);
  }
}
`;

let 样式装好了 = false;
function 装上对面高亮样式() {
  if (样式装好了 || typeof document === 'undefined') return;
  样式装好了 = true;
  const 标签 = document.createElement('style');
  标签.dataset.来自 = '格子纸·对面高亮';
  标签.textContent = 对面高亮样式;
  document.head.appendChild(标签);
}

/** 把 #RRGGBB 兑成半透明的一团光晕 */
function 光晕色(颜色, 浓度 = 0.55) {
  const m = /^#?([0-9a-f]{6})$/i.exec(颜色 ?? '');
  if (!m) return `rgba(255, 255, 255, ${浓度})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${浓度})`;
}

/**
 * 纯逻辑：点一下某个格子，算出新的涂色。不碰 DOM，可以直接跑单元测试。
 *
 * 每个涂上的格子记着自己的**颜色槽位**，取消别的格子时它不跟着换颜色 ——
 * 孩子擦掉一格，剩下的格子突然集体变色，会以为自己把别的也弄坏了。
 *
 * @param {Array<{row:number, col:number, 槽位:number}>} 已涂
 * @param {{row:number, col:number}} 格子
 * @returns {Array<{row:number, col:number, 槽位:number}>} 新的一份，不改原来那个
 */
export function 切换格子(已涂, 格子, 上限 = 最多格子) {
  const 命中 = 已涂.findIndex((c) => 同一格(c, 格子));
  if (命中 >= 0) return 已涂.filter((_, i) => i !== 命中);
  if (已涂.length >= 上限) return 已涂; // 涂满了就不再加，颜色和面都只有六份

  const 用掉的 = new Set(已涂.map((c) => c.槽位));
  let 槽位 = 0;
  while (用掉的.has(槽位)) 槽位++;
  return [...已涂, { row: 格子.row, col: 格子.col, 槽位 }];
}

/**
 * 把格子纸画到页面上。
 *
 * @param {HTMLElement} 容器
 * @param {{
 *   行数?: number, 列数?: number,
 *   onChange: (格子: Array<{row, col, 槽位}>) => void,
 *   on涂满?: () => void,
 * }} options
 */
export function 创建格子纸(容器, { 行数 = 格子纸行数, 列数 = 格子纸列数, onChange, on涂满 } = {}) {
  let 已涂 = [];
  /** 正在亮着的那一对对面在平面上是哪两格（03 票） */
  let 对面亮着 = [];
  const 按钮 = [];

  装上对面高亮样式();
  容器.style.setProperty('--列数', 列数);

  for (let row = 0; row < 行数; row++) {
    for (let col = 0; col < 列数; col++) {
      const 按 = document.createElement('button');
      按.type = 'button';
      按.className = '纸格子';
      按.dataset.row = row;
      按.dataset.col = col;
      // 界面上不放句子，但读屏和自动化验收要认得出这是哪一格
      按.setAttribute('aria-label', 选({
        cn: `第${row + 1}行第${col + 1}格`,
        en: `row ${row + 1}, column ${col + 1}`,
      }));
      按.addEventListener('click', () => 点了({ row, col }));
      容器.appendChild(按);
      按钮.push(按);
    }
  }

  function 点了(格子) {
    const 下一份 = 切换格子(已涂, 格子);
    if (下一份 === 已涂) {
      提示涂满了();
      return;
    }
    已涂 = 下一份;
    刷新();
    onChange?.(已涂.map((c) => ({ ...c })));
  }

  /** 第七格点不上。孩子不认字，所以只抖一下纸，话交给语音说 */
  function 提示涂满了() {
    容器.classList.remove('满了');
    void 容器.offsetWidth; // 逼浏览器重算一次，连点两下才会再抖一次
    容器.classList.add('满了');
    on涂满?.();
  }

  function 刷新() {
    容器.classList.toggle('在看对面', 对面亮着.length > 0);
    for (const 按 of 按钮) {
      const row = Number(按.dataset.row);
      const col = Number(按.dataset.col);
      const 格 = 已涂.find((c) => 同一格(c, { row, col }));
      按.classList.toggle('涂了', Boolean(格));
      按.classList.toggle('对面亮', 对面亮着.some((c) => 同一格(c, { row, col })));
      // 水果是贴纸风素材（缺图时 画实体 自己回落成绘文字），尺寸由 .实体图 那条
      // `1em` 管着 —— 1em 就是原先那个绘文字的字号盒，换图不许让格子里的东西挪位
      const 皮 = 格 ? cellStyle(格.槽位) : null;
      按.replaceChildren();
      if (皮) 按.appendChild(画实体(皮.名, 皮.fruit, { 类名: '实体图' }));
      按.style.background = 皮 ? 皮.color : '';
    }
  }

  /*
    换了语言：纸上一个字都没有（格子里是水果绘文字），要换的只有读屏认的那几句
    「第几行第几格」。格子本身不重建 —— 孩子手上那张没画完的衣服得原样留着。
  */
  const 退订语言 = 订阅语言(() => {
    for (const 按 of 按钮) {
      const row = Number(按.dataset.row);
      const col = Number(按.dataset.col);
      按.setAttribute('aria-label', 选({
        cn: `第${row + 1}行第${col + 1}格`,
        en: `row ${row + 1}, column ${col + 1}`,
      }));
    }
  });

  刷新();

  return {
    dispose: 退订语言,
    /** 当前涂了哪些格子（拷贝一份，外面改不动里面的状态） */
    get 格子() {
      return 已涂.map((c) => ({ ...c }));
    },
    /** 直接摆一张衣服上去（自动化验收、后面的票「判断关」和「图鉴」都要用） */
    设格子(格子列表) {
      已涂 = 格子列表
        .slice(0, 最多格子)
        .map((c, i) => ({ row: c.row, col: c.col, 槽位: c.槽位 ?? i }));
      对面亮着 = [];
      刷新();
      onChange?.(已涂.map((c) => ({ ...c })));
    },
    /**
     * 03 票：三维里亮起一对对面的**同一时刻**，平面上这两格也亮起来。
     * 这一条是让孩子把正方体上的关系映回衣服上的唯一通道，不能省。
     *
     * @param {Array<{row:number, col:number}>} 格子们 空数组 = 取消高亮
     * @param {string|null} 颜色 跟三维里那一对的发光色是同一个
     */
    设对面高亮(格子们 = [], 颜色 = null) {
      对面亮着 = 格子们.map((c) => ({ row: c.row, col: c.col }));
      if (颜色) {
        容器.style.setProperty('--对面色', 颜色);
        容器.style.setProperty('--对面光', 光晕色(颜色));
      }
      刷新();
    },
    /** 现在平面上亮着哪两格（自动化验收要用） */
    get 对面高亮() {
      return 对面亮着.map((c) => ({ ...c }));
    },
    清空() {
      this.设格子([]);
    },
  };
}
