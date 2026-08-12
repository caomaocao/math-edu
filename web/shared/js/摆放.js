// 摆放 —— 数量题的动手引擎：一排容器（盘 / 竹签 / 车厢 / 食盘），有的已给、有的空着，
// 孩子点空容器加一个、点已放的拿走，摆好按提交钮交卷。判定纯本地（数量比对，无 ASR）。
// 2026-08 自 chapters/04 升入 shared（第5讲发饭/喂食二次需要），三处章味改成宿主注入：
//   提交钮（04 汽笛🔔 / 05 开饭铃）、梯子话术（04 火车 / 05 营地）、单容器上限（12 / 18）。
// 注入面的形状与校验见 定配()；梯子的**结构**长在引擎里，只有词儿是宿主的。
//
// 三次机会梯子（跟共享问答同一套精神，但这儿是数量不是转写）：
//   错 1：鼓励再数。错 2：把前面已给的一组一组数过去（高亮 + 念数）。
//   错 3：自动摆对、把规律说破，照样过关拿星（星记完成不记全对）。
//
// 身份要紧的实体（草莓 / 苹果 / 钻石）走实体图渲染单闸；颗数就是答案、身份无所谓的
// （山楂 / 橘瓣 / 蘑菇）走 CSS 形状 —— 跟拍照色点、宝藏脚印同一个先例（见 CLAUDE.md 实体图）。

import { 说 } from './说话.js';
import { 音效 } from './音效.js';
import { 画实体 } from './实体图.js';
import { 选 } from './语言.js';
import { 中文数, 英文数 } from './数词.js';

const 歇 = (ms) => new Promise((好) => setTimeout(好, ms));

/** 这个数在当前这门课里怎么念（十六 / sixteen）—— 梯子第二档的带数提示用它。
 * 数字的念法是共享 数词 的事，跟宿主无关，所以不进注入面。 */
const 念数 = (n) => 选({ cn: 中文数(n), en: 英文数(n) });

/**
 * 定配(配, {要话术}) —— 校验宿主注入面，缺一样就地抛。接错线是写代码时的事，
 * 就该在摆到孩子面前之前炸出来；宿主的配是写死的，跑对一次就永远不会再走到 throw。
 *
 * 配 = {
 *   提交钮: { 图标, 标签: { cn, en } },        // 图标就是孩子的说明书；标签只给读屏，
 *                                              // 双语对写在宿主那一处，不进台词表（不是要念的话）
 *   话术:   { 对, 错1, 提示头, 演示头, 教数 }, // 全是函数：说话那一刻才取词，语言活切换
 *                                              //（传字符串会把课焊死在配好的那门语言上）
 *   上限:   12,                                // 单容器最多摆几个（04 传 12，05 传 18）
 * }
 * 玩自由 不开口，不要话术（要话术: false 时不查）。
 */
export function 定配(配, { 要话术 = true } = {}) {
  if (!配 || typeof 配 !== 'object') throw new TypeError('摆放引擎缺配：宿主要传 {提交钮, 话术, 上限}');
  const { 提交钮, 话术, 上限 } = 配;
  if (typeof 提交钮?.图标 !== 'string' || !提交钮.图标.trim()) {
    throw new TypeError('摆放引擎缺配：提交钮.图标（汽笛 / 开饭铃那样的图形字符）');
  }
  const 标签 = 提交钮.标签;
  if (typeof 标签?.cn !== 'string' || !标签.cn.trim() || typeof 标签?.en !== 'string' || !标签.en.trim()) {
    throw new TypeError('摆放引擎缺配：提交钮.标签 要 {cn, en} 双语对（读屏用）');
  }
  if (!Number.isInteger(上限) || 上限 < 1) {
    throw new TypeError('摆放引擎缺配：上限 要正整数（单容器最多摆几个）');
  }
  if (要话术) {
    for (const 键 of ['对', '错1', '提示头', '演示头', '教数']) {
      if (typeof 话术?.[键] !== 'function') {
        throw new TypeError(`摆放引擎缺配：话术.${键} 要是函数（说话那一刻才取词，别把词儿焊死在配里）`);
      }
    }
  }
  return 配;
}

/** 提交钮，玩一轮/玩自由共用。长相（图标、名字）是宿主注入的；样式钩子 .提交钮 由宿主的样式表接。 */
function 造提交钮({ 图标, 标签 }) {
  const 钮 = document.createElement('button');
  钮.className = '提交钮';
  钮.textContent = 图标;
  钮.setAttribute('aria-label', 选(标签));
  return 钮;
}

/** 造一个「货」：有实体名就走实体图，否则按 料 画 CSS 形状（山楂 / 橘瓣 / 蘑菇）。
 *
 * 删除靠 e.target.closest('.摆件形,.摆件图') 命中被点中的那一颗——所以货件**必须**能接指针
 * 事件，这是引擎删除契约的一部分。各章样式表却总照展示类实体图（花图/萝卜图/菇图）的老习惯，
 * 给 .摆件图/.摆件形 也写上 pointer-events:none（04 果盘/糖葫芦/装货、05 松果站都中过招），
 * 那样被点的颗永远不是 e.target，closest 落空 → 只能加不能减（家长反馈「点不掉，只能重来」）。
 * 引擎在这里就地给自己造的货件兜上 pointer-events:auto（行内样式压过样式表的 none），别指望每章
 * CSS 都记得——展示用的货件（找错列的车厢货）不走 造件，仍按各章 CSS 保持不可点。 */
function 造件(题) {
  let 件;
  if (题.实体) {
    const 图 = 画实体(题.实体, 题.兜底, { 类名: '摆件图' });
    if (图.nodeType === Node.ELEMENT_NODE) {
      件 = 图;
    } else {
      // 缺图回落文本节点时包一层，好摆进堆里
      件 = document.createElement('span');
      件.className = '摆件图 摆件字';
      件.appendChild(图);
    }
  } else {
    件 = document.createElement('span');
    件.className = `摆件形 摆件-${题.料}`;
    件.setAttribute('aria-hidden', 'true');
  }
  件.style.pointerEvents = 'auto';
  return 件;
}

/**
 * 玩一轮({挂点, 题, 配, 走查?}) → Promise<void>（做完就 resolve）。
 * 题 = { 实体?, 兜底?, 料?, 排布:'横'|'竖'|'塔', 值们:[整条正确序列], 空:[要孩子摆的下标] }
 * 配 = 宿主注入面（见 定配）。
 * 走查() 返回假就当这一局已经被切走（换关/换语言），点击与提交一律作废。
 */
export function 玩一轮({ 挂点, 题, 配, 走查 = () => true }) {
  const { 提交钮, 话术, 上限 } = 定配(配);
  return new Promise((结束) => {
    挂点.textContent = '';
    const 台 = document.createElement('div');
    台.className = `摆放区 摆布-${题.排布 || '横'}`;
    挂点.appendChild(台);

    const 格们 = 题.值们.map((v, i) => {
      const 格 = document.createElement('div');
      格.className = '摆格';
      const 堆 = document.createElement('div');
      堆.className = '摆堆';
      格.appendChild(堆);
      const 是空 = 题.空.includes(i);
      if (是空) {
        格.classList.add('可摆');
      } else {
        for (let k = 0; k < v; k += 1) 堆.appendChild(造件(题));
      }
      台.appendChild(格);
      return { 格, 堆, 是空, 目标: v };
    });

    let 锁 = false;
    for (const g of 格们) {
      if (!g.是空) continue;
      g.格.addEventListener('click', (e) => {
        if (锁 || !走查()) return;
        const 件 = e.target.closest('.摆件形, .摆件图');
        if (件) { 件.remove(); 音效.点一下(); return; }
        if (g.堆.childElementCount >= 上限) return;
        g.堆.appendChild(造件(题));
        音效.点一下();
      });
    }

    const 钮 = 造提交钮(提交钮);
    挂点.appendChild(钮);

    const 空格们 = 格们.filter((g) => g.是空);
    let 错次 = 0;

    async function 提示() {
      await 说(话术.提示头());
      for (const g of 格们) {
        if (g.是空 || !走查()) continue;
        g.格.classList.add('提示中');
        await 说(念数(g.目标));
        g.格.classList.remove('提示中');
        if (!走查()) return;
      }
    }

    async function 演示() {
      await 说(话术.演示头());
      for (const g of 空格们) {
        while (g.堆.childElementCount > g.目标) g.堆.lastElementChild.remove();
        while (g.堆.childElementCount < g.目标) {
          g.堆.appendChild(造件(题));
          音效.点一下();
          await 歇(180);
          if (!走查()) return;
        }
        await 说(话术.教数(g.目标));
        if (!走查()) return;
      }
    }

    钮.onclick = async () => {
      if (锁 || !走查()) return;
      // 在途锁（防呆票01备选钮的同款）：反馈没说完，再按提交不作数。不锁的话
      // 连按三下就在一句反馈里烧光三次机会直接演示过关，还会开出并发的提示/演示
      // 循环，讲到下一轮头上。答对与演示两条路走到 结束()，锁不再放开。
      锁 = true;
      const 全对 = 空格们.every((g) => g.堆.childElementCount === g.目标);
      if (全对) {
        音效.答对();
        台.classList.add('开动');
        await 说(话术.对());
        结束();
        return;
      }
      错次 += 1;
      音效.答错();
      if (错次 === 1) { await 说(话术.错1()); 锁 = false; return; }
      if (错次 === 2) { await 提示(); 锁 = false; return; }
      await 演示();
      台.classList.add('开动');
      结束();
    };
  });
}

/**
 * 玩自由({挂点, 题, 配, 走查}) → Promise<number[]>（按提交钮就把每个容器的颗数交出来）。
 * 出题官那类创作站用：N 个空容器全可摆，孩子随便装（没有对错），提交把这串数交给上层去认。
 * 题 = { 实体?, 兜底?, 料?, 排布, 车厢数 }
 */
export function 玩自由({ 挂点, 题, 配, 走查 = () => true }) {
  const { 提交钮, 上限 } = 定配(配, { 要话术: false });
  return new Promise((结束) => {
    挂点.textContent = '';
    const 台 = document.createElement('div');
    台.className = `摆放区 摆布-${题.排布 || '塔'}`;
    挂点.appendChild(台);

    // 交过卷就封盘：监听还挂在 DOM 上（面板不卸载的家规），不封的话孩子交卷后
    // 接着点容器，改的是屏幕、交出去的 数们 还是交卷那一刻的——两边就对不上了（评审抓的雷）。
    let 交卷了 = false;

    const 堆们 = [];
    for (let i = 0; i < 题.车厢数; i += 1) {
      const 格 = document.createElement('div');
      格.className = '摆格 可摆';
      const 堆 = document.createElement('div');
      堆.className = '摆堆';
      格.appendChild(堆);
      格.addEventListener('click', (e) => {
        if (交卷了 || !走查()) return;
        const 件 = e.target.closest('.摆件形, .摆件图');
        if (件) { 件.remove(); 音效.点一下(); return; }
        if (堆.childElementCount >= 上限) return;
        堆.appendChild(造件(题));
        音效.点一下();
      });
      台.appendChild(格);
      堆们.push(堆);
    }

    const 钮 = 造提交钮(提交钮);
    挂点.appendChild(钮);
    钮.onclick = () => {
      if (交卷了 || !走查()) return;
      交卷了 = true;
      音效.答对();
      结束(堆们.map((堆) => 堆.childElementCount));
    };
  });
}
