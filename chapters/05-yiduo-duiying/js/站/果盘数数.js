// 果盘数数 —— 书第 58 页 闯关三的活版（几个几：横着数、竖着数）。
// 三盘递进：苹果 2×3（带练：网站先演一遍横着数）→ 橘子 2×4 → 樱桃 3×6，数据从站点表读。
// 每盘每个方向**拆两问**（spec grilling 定稿，别合成复合短语）：「一排有几个？」→ 报数；
// 「有几排？」→ 报数；答对后逐排/逐列高亮动画 + 喝彩说破「横着数，是三个六！」——
// 「几个几」这句只由网站说，孩子嘴里只有单个数字。
// 行/列高亮是 CSS 类切换（styles.css「站：果盘数数」段）；果盘只看不点，不是触靶
// （孩子点的只有麦克风坞和数字瓦片，都是共享件管的）。

import { 说 } from '/shared/js/说话.js';
import { 收起麦克风 } from '/shared/js/问答.js';
import { 元, 歇, 做进度点 } from '/shared/js/搭台.js';
import { 画实体 } from '/shared/js/实体图.js';
import { 选 } from '/shared/js/语言.js';
import { 中文数, 英文数 } from '/shared/js/数词.js';
import { 报一个数 } from '../报数.js';
import { 台词, 模板 } from '../台词表.js';
import { 站点表 } from '../站点表.js';

const 账 = 站点表.find((条) => 条.号 === '果盘数数').台账;
const 兜底们 = { 苹果: '🍎', 橘子: '🍊', 樱桃: '🍒' };

// 台账是单一出处：这一站看得见的实体就是三盘的果（覆盖测试与预热同吃这一个导出）。
export const 实体们 = 账.盘们.map((盘) => 盘.果);

/**
 * 几个几(排数, 每排, 方向) —— 两问的答案与说破的口径，纯算术（test/果盘腿腿.test.js）。
 * 横着数：一排有几个 → 每份=每排；有几排 → 份数=排数；说破「排数 个 每排」（3 个 6）。
 * 竖着数：一列有几个 → 每份=排数；有几列 → 份数=每排；说破「每排 个 排数」（6 个 3）。
 * 两个方向的 总 相等 —— 这正是这一站要教的事。
 */
export function 几个几(排数, 每排, 方向) {
  return 方向 === '横'
    ? { 每份: 每排, 份数: 排数, 总: 排数 * 每排 }
    : { 每份: 排数, 份数: 每排, 总: 排数 * 每排 };
}

const 数词说 = (n) => 说(选({ cn: 中文数(n), en: 英文数(n) }));

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="大画框"><div class="果盘"><div class="果阵" id="果阵"></div></div></div>
      <div class="进度点挂" id="果盘进度"></div>
    </div>`;
  const 阵 = 面板.querySelector('#果阵');
  const 进度点 = 做进度点(面板.querySelector('#果盘进度'), 账.盘们.length);
  let 格们 = [];
  let 局 = 0;

  function 摆盘({ 果, 排数, 每排 }) {
    阵.textContent = '';
    阵.style.gridTemplateColumns = `repeat(${每排}, auto)`;
    格们 = [];
    for (let r = 0; r < 排数; r += 1) {
      for (let c = 0; c < 每排; c += 1) {
        const 格 = 元('div', '果格');
        格.appendChild(画实体(果, 兜底们[果], { 尺寸: 60 }));
        阵.appendChild(格);
        格们.push({ 格, 排: r, 列: c });
      }
    }
  }

  const 亮 = (挑, 亮否 = true) => { for (const 个 of 格们) if (挑(个)) 个.格.classList.toggle('亮', 亮否); };
  const 全灭 = () => 亮(() => true, false);

  // 「一份」= 高亮哪些格 + 念哪个数。行/列的逐份高亮、逐个点数全走同一个执行器。
  const 一排里 = (每排) => Array.from({ length: 每排 }, (_, c) => ({ 挑: (个) => 个.排 === 0 && 个.列 === c, 数: c + 1 }));
  const 一列里 = (排数) => Array.from({ length: 排数 }, (_, r) => ({ 挑: (个) => 个.排 === r && 个.列 === 0, 数: r + 1 }));
  const 逐排 = (排数) => Array.from({ length: 排数 }, (_, r) => ({ 挑: (个) => 个.排 === r, 数: r + 1 }));
  const 逐列 = (每排) => Array.from({ length: 每排 }, (_, c) => ({ 挑: (个) => 个.列 === c, 数: c + 1 }));

  /** 逐份点亮（点过的留着亮，越数越多）+ 嘴里跟着念数。 */
  async function 数着亮(份们, 还在) {
    for (const { 挑, 数 } of 份们) {
      if (!还在()) return;
      亮(挑);
      await 数词说(数);
    }
  }

  /** 错 2 次的提示：把参照那几格逐个亮起来重数一遍（数到头就是答案，5 岁的梯子本该这样）。 */
  function 数一数提示(份们, 还在) {
    return async () => {
      await 说(台词.果盘数数.提示头);
      if (!还在()) return;
      await 数着亮(份们, 还在);
      await 歇(500);
      全灭();
    };
  }

  /** 答对两问后的喝彩：逐份扫亮的动画压着说破「几个几」。 */
  async function 扫破(份们, 破句, 还在) {
    全灭();
    for (const { 挑 } of 份们) {
      if (!还在()) return;
      亮(挑);
      await 歇(380);
    }
    await 说(破句);
    await 歇(450);
    全灭();
  }

  /** 带练（只第一盘）：网站自己演一遍横着数——先数一排几个，再数几排，最后说破。 */
  async function 演示({ 排数, 每排 }, 还在) {
    const 话 = 台词.果盘数数;
    await 说(话.带练头);
    if (!还在()) return;
    await 说(话.演示数排里);
    if (!还在()) return;
    await 数着亮(一排里(每排), 还在);
    await 说(模板.果盘数数.排里破(每排));
    if (!还在()) return;
    全灭();
    await 歇(300);
    await 说(话.演示数几排);
    if (!还在()) return;
    await 数着亮(逐排(排数), 还在);
    await 说(模板.果盘数数.几排破(排数));
    if (!还在()) return;
    await 说(模板.果盘数数.横破(排数, 每排));
    全灭();
    if (!还在()) return;
    await 说(话.该你啦);
  }

  /** 一盘走完横竖两个方向，各拆两问。走完返回 true；中途被打断返回 false。 */
  async function 玩一盘(盘, 序, 还在) {
    const 话 = 台词.果盘数数;
    const { 排数, 每排 } = 盘;
    摆盘(盘);
    await 说(话.盘开场们[序]);
    if (!还在()) return false;
    if (盘.带练) {
      await 演示(盘, 还在);
      if (!还在()) return false;
    }

    const 横 = 几个几(排数, 每排, '横');
    await 报一个数(横.每份, { 问: 话.问排里, 提示: 数一数提示(一排里(每排), 还在) });
    if (!还在()) return false;
    全灭();
    await 报一个数(横.份数, { 问: 话.问几排, 提示: 数一数提示(逐排(排数), 还在) });
    if (!还在()) return false;
    await 扫破(逐排(排数), 模板.果盘数数.横破(横.份数, 横.每份), 还在);
    if (!还在()) return false;

    await 说(话.换竖);
    if (!还在()) return false;
    const 竖 = 几个几(排数, 每排, '竖');
    await 报一个数(竖.每份, { 问: 话.问列里, 提示: 数一数提示(一列里(排数), 还在) });
    if (!还在()) return false;
    全灭();
    await 报一个数(竖.份数, { 问: 话.问几列, 提示: 数一数提示(逐列(每排), 还在) });
    if (!还在()) return false;
    await 扫破(逐列(每排), 模板.果盘数数.竖破(竖.份数, 竖.每份), 还在);
    if (!还在()) return false;

    await 说(话.盘收尾);
    return 还在();
  }

  async function 进入() {
    const 本局 = ++局;
    const 还在 = () => 局 === 本局 && 面板.classList.contains('在前');
    let 起 = 工具.取('果盘数数.盘');
    if (!Number.isInteger(起) || 起 < 0 || 起 >= 账.盘们.length) 起 = 0; // 柜值两头钳
    进度点.清零();
    for (let i = 0; i < 起; i += 1) 进度点.点亮(i);
    await 说(台词.果盘数数.开场);
    for (let i = 起; i < 账.盘们.length; i += 1) {
      if (!还在()) return;
      if (!await 玩一盘(账.盘们[i], i, 还在)) return;
      进度点.点亮(i);
      // 走完一盘记一格；全走完归零，下回从头玩（重来清柜也回到这儿）。
      工具.记('果盘数数.盘', i + 1 < 账.盘们.length ? i + 1 : 0);
    }
    await 工具.完成('果盘数数');
    if (!还在()) return;
    收起麦克风();
    await 说(台词.果盘数数.收尾);
  }

  return { 进入 };
}
