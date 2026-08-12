// 篝火晚会 Boss —— 全章收官（书 p60 闯关五b 落进彩蛋）。两幕：
//   ① 五族混合连闯：已教的五种玩法各出一题（配对 / 喂食摆放 / 发饭 / 几个几 / 腿数），
//      题面从各站题池换皮抽取（换实体不换题型），复用各站的引擎与纯逻辑，绝不改别的站。
//      连闯节奏快、转场短；三次机会梯子由各引擎照常提供，演示过关照样往前走。五题全过
//      记 续键=0（下次从头），点第 10 颗星前先放彩蛋。
//   ② 青蛙合唱团彩蛋（grilling 定稿「只演不考」）：先问「1 只青蛙几条腿」（4，报数）→
//      答对后 10 只一排蹦出来带数到 40 → 然后网站自己演：十排刷地铺满屏、一排一声
//      40、80、120……数到 400，孩子不需要答（40 之后纯演示、无输入）。大数字上屏走
//      数字豁免口径（屏上只出数字），>99 的念法落本站自己的 Boss 模板摊。
//   落幕：篝火冲天 + 全章大庆祝——大庆祝不在这儿另造，Boss 是第 10 颗星，工具.完成('Boss')
//   会自动触发 主.js 已有的仪式（烟花 / 奖杯 / 纸屑），本站只顺着现有仪式走、加自己的篝火。
//
// 断点续闯（04 Boss 的先例）：柜里记做到第几关，中途退出再进接着来；已通关就从头重玩
// （彩蛋是奖励，每次通关都放）。Boss 星一旦到手，大庆祝只此一次（主.js 的「大庆祝放过」闩）。
//
// 数值全从 站点表 的 Boss 台账读（族们 + 彩蛋 = {腿,一排,排数,顶}）；连闯题面用现库实体
// 换皮，动物↔颜色的真相从 帐篷站 的 配对阵 借（单一出处，别抄第二份）。

import { 说 } from '/shared/js/说话.js';
import { 收起麦克风 } from '/shared/js/问答.js';
import { 元, 歇, 做进度点 } from '/shared/js/搭台.js';
import { 画实体 } from '/shared/js/实体图.js';
import { 选 } from '/shared/js/语言.js';
import { 中文数, 英文数 } from '/shared/js/数词.js';
import { 报一个数 } from '../报数.js';
import { 玩一轮 as 摆放玩一轮 } from '/shared/js/摆放.js';
import { 玩一轮 as 配对玩一轮 } from '../配对.js';
import { 摆放配 } from '../组件.js';
import { 开一锅, 排队几人, 摆发饭台 } from '../发饭.js';
import { 台词, 模板 } from '../台词表.js';
import { 站点表 } from '../站点表.js';
import { 配对阵 } from './帐篷站.js';
import { 几个几 } from './果盘数数.js';
import { 逐只腿数 } from './腿腿站.js';

// 青蛙是彩蛋的主角，本站直接画它。连闯里借用的实体（小鱼/企鹅/米饭/小朋友/苹果/小猪/
// 瓢虫/小鸟/绿帐篷…）都由各自的站导出 实体们、在那儿预热与覆盖，本站不重复登记（票面口径）。
export const 实体们 = ['青蛙'];

const 账 = 站点表.find((条) => 条.号 === 'Boss').台账;
const 话 = 台词.Boss;
const 续键 = 'Boss.关';

// ---------------------------------------------------------------- 纯逻辑（test/boss.test.js 咬这几口）

/**
 * 连闯题单() —— 五族各一题，顺序 = 台账 族们。题面从各站题池换皮：换实体不换题型。
 * 配对借 帐篷站 的 配对阵（前 3 对）；几个几 的答用 果盘数数 的 几个几() 现算——
 * 谁把数改歪，boss.test.js 立刻红。全是纯数据，怎么摆台由 创建() 里的各引擎接。
 */
export function 连闯题单() {
  const 对子 = 配对阵.slice(0, 3); // 青蛙-绿 / 瓢虫-红 / 小鸟-蓝
  return [
    {
      族: '配对',
      动物们: 对子.map((a) => ({ 名: a.名, 色: a.色, 兜底: a.兜底 })),
      归宿们: 对子.map((a) => ({ 名: `${a.色}帐篷`, 色: a.色, 兜底: '⛺' })),
    },
    { 族: '喂食', 实体: '小鱼', 兜底: '🐟', 头实体: '企鹅', 头兜底: '🐧', 每: 2, 格数: 3 },
    { 族: '发饭', 食: '米饭', 兜底: '🍚', 共: 6, 每人: 2, 答: 3 },
    { 族: '几个几', 果: '苹果', 兜底: '🍎', 排数: 2, 每排: 4, 答: 几个几(2, 4, '横').每份 },
    { 族: '腿数', 物: '小猪', 兜底: '🐷', 腿: 4, 只数: 3, 答: 4 * 3 },
  ];
}

/** 一排腿数(腿, 一排) → [4,8,…,40]：一排 10 只青蛙带着数腿的那串（Phase B，≤40 走数词）。 */
export function 一排腿数(腿, 一排) {
  return Array.from({ length: 一排 }, (_, i) => 腿 * (i + 1));
}

/** 满屏排数列(腿,一排,排数) → [40,80,…,400]：十排各自的累计总腿数（Phase C，一排一声）。 */
export function 满屏排数列(腿, 一排, 排数) {
  const 一排数 = 腿 * 一排;
  return Array.from({ length: 排数 }, (_, r) => 一排数 * (r + 1));
}

// ---------------------------------------------------------------- 站

const 数词说 = (n) => 说(选({ cn: 中文数(n), en: 英文数(n) })); // Phase B 的 4…40 走这条（≤99）

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="大画框 Boss画框"><div class="题台" id="Boss题台"></div></div>
      <div class="进度点挂" id="Boss进度"></div>
    </div>`;
  const 舞台布 = 面板.querySelector('.舞台布');
  const 题台 = 面板.querySelector('#Boss题台');
  const 点 = 做进度点(面板.querySelector('#Boss进度'), 5);
  const 题单 = 连闯题单();
  let 局 = 0;

  // 配对引擎的话术：读共用的 配对 摊（判定纯本地按颜色，词儿全在那儿；同 帐篷站 的口径）。
  const 配话 = 台词.配对;
  const 配话术 = {
    错1: () => 配话.错1,
    提示头: () => 配话.提示头,
    念色: (色) => 配话[`色${色}`],
    演示头: () => 配话.演示头,
    说破: () => 配话.说破,
  };

  // ------- 五族连闯：每关先摆台子（同步）再开口，念完 词们 才开闸放手（04 Boss 的先例：
  //         空框像卡住 + 孩子抢在开场白里连点会把三次机会烧光自动演示过关）。报数关画面
  //         天然不可交互，无需闸——念完 词们 直接 报一个数（题.问 由报数管线自己念）。

  async function 配对关(还在, 词们) {
    题台.textContent = '';
    const 挂 = 元('div', '配对挂');
    题台.appendChild(挂);
    const 题 = 题单[0];
    let 闸开 = false;
    const 一关 = 配对玩一轮({
      挂点: 挂, 动物们: 题.动物们, 归宿们: 题.归宿们, 话术: 配话术,
      走查: () => 闸开 && 还在(),
    });
    for (const 词 of 词们) { if (!还在()) return; await 说(词); }
    闸开 = true;
    await 一关;
  }

  async function 喂食关(还在, 词们) {
    题台.textContent = '';
    const 挂 = 元('div', 'Boss摆放挂');
    题台.appendChild(挂);
    const 题 = 题单[1];
    let 闸开 = false;
    const 一关 = 摆放玩一轮({
      挂点: 挂,
      题: {
        实体: 题.实体, 兜底: 题.兜底, 排布: '横',
        值们: Array(题.格数).fill(题.每),
        空: Array.from({ length: 题.格数 - 1 }, (_, i) => i + 1), // 第 0 格是示范（已给）
      },
      配: 摆放配,
      走查: () => 闸开 && 还在(),
    });
    // 每格头上站一只企鹅（点这一格 = 喂它），交卷键接开饭铃皮（同喂食站；头不抢点击）
    for (const 格 of 挂.querySelectorAll('.摆格')) {
      const 头 = 元('div', '企鹅位');
      头.append(画实体(题.头实体, 题.头兜底, { 类名: '企鹅图' }));
      格.prepend(头);
    }
    挂.querySelector('.提交钮')?.classList.add('开饭铃');
    for (const 词 of 词们) { if (!还在()) return; await 说(词); }
    闸开 = true;
    await 一关;
  }

  async function 发饭关(还在, 词们) {
    题台.textContent = '';
    const 题 = 题单[2];
    const 账b = 开一锅({ 共: 题.共, 每人: 题.每人 });
    let 闸开 = false;
    let 报空;
    const 空了 = new Promise((好) => { 报空 = 好; });
    摆发饭台({
      挂点: 题台,
      食: { 实体: 题.食, 兜底: 题.兜底 },
      账: 账b,
      排队数: 排队几人(题.答),
      走查: () => 闸开 && 还在(),
      空了: () => 报空(),
    });
    for (const 词 of 词们) { if (!还在()) return; await 说(词); }
    闸开 = true;
    await 空了;
    if (还在()) 工具.音效.答对();
  }

  async function 几个几关(还在, 词们) {
    题台.textContent = '';
    const 挂 = 元('div', 'Boss果盘挂');
    题台.appendChild(挂);
    const 题 = 题单[3];
    const 格们 = 建果阵(挂, 题);
    for (const 词 of 词们) { if (!还在()) return; await 说(词); }
    if (!还在()) return;
    await 报一个数(题.答, {
      问: 话.几个几问,
      提示: async () => {                        // 错 2：把一排逐个亮起来数（数到头就是答案）
        for (let c = 0; c < 题.每排; c += 1) {
          if (!还在()) return;
          格们.find((x) => x.排 === 0 && x.列 === c).格.classList.add('亮');
          await 数词说(c + 1);
        }
        await 歇(400);
        for (const x of 格们) x.格.classList.remove('亮');
      },
    });
  }

  async function 腿数关(还在, 词们) {
    题台.textContent = '';
    const 挂 = 元('div', 'Boss腿挂');
    题台.appendChild(挂);
    const 题 = 题单[4];
    const 位们 = 建腿排(挂, 题);
    for (const 词 of 词们) { if (!还在()) return; await 说(词); }
    if (!还在()) return;
    const 数列 = 逐只腿数(题.腿, 题.只数);
    await 报一个数(题.答, {
      问: 话.腿数问,
      提示: async () => {                        // 错 2：逐只点亮、数字牌翻出累计腿数（4、8、12）
        for (let i = 0; i < 位们.length; i += 1) {
          if (!还在()) return;
          位们[i].位.classList.add('亮');
          位们[i].牌.textContent = String(数列[i]);
          位们[i].牌.classList.add('显');
          await 数词说(数列[i]);
        }
      },
    });
  }

  function 建果阵(挂, 题) {
    const 盘 = 元('div', '果盘');
    const 阵 = 元('div', '果阵');
    阵.style.gridTemplateColumns = `repeat(${题.每排}, auto)`;
    const 格们 = [];
    for (let r = 0; r < 题.排数; r += 1) {
      for (let c = 0; c < 题.每排; c += 1) {
        const 格 = 元('div', '果格');
        格.appendChild(画实体(题.果, 题.兜底, { 尺寸: 60 }));
        阵.appendChild(格);
        格们.push({ 格, 排: r, 列: c });
      }
    }
    盘.appendChild(阵);
    挂.appendChild(盘);
    return 格们;
  }

  function 建腿排(挂, 题) {
    const 排 = 元('div', '动物排');
    const 位们 = [];
    for (let i = 0; i < 题.只数; i += 1) {
      const 位 = 元('div', '动物位');
      位.appendChild(画实体(题.物, 题.兜底, { 尺寸: 108 }));
      const 牌 = 元('div', '数字牌 腿数牌');
      位.appendChild(牌);
      排.appendChild(位);
      位们.push({ 位, 牌 });
    }
    挂.appendChild(排);
    return 位们;
  }

  const 关跑法 = { 配对: 配对关, 喂食: 喂食关, 发饭: 发饭关, 几个几: 几个几关, 腿数: 腿数关 };
  const 关头词 = { 配对: 话.配对头, 喂食: 话.喂食头, 发饭: 话.发饭头 }; // 报数关的题面由 报一个数 自己念

  async function 跑一关(i, 还在, 首关) {
    const 族 = 题单[i].族;
    const 词们 = [];
    if (首关) 词们.push(话.开场);      // 开场白只在这一趟的头一关念（续闯时接着的那关）
    if (关头词[族]) 词们.push(关头词[族]);
    await 关跑法[族](还在, 词们);
  }

  // ------- 青蛙合唱团彩蛋（只演不考）

  const 造蛙 = () => {
    const s = 元('span', '蛙 蛙入');
    s.appendChild(画实体('青蛙', '🐸', { 类名: '蛙图' }));
    return s;
  };

  async function 彩蛋(还在) {
    const { 腿, 一排, 排数 } = 账.彩蛋;
    题台.textContent = '';
    舞台布.classList.add('彩蛋中');              // 收起画框/进度点，青蛙铺满整个舞台
    const 幕 = 元('div', '蛙幕');
    const 计 = 元('div', '蛙计 数字牌');          // 屏幕中上的大数字（数字豁免：屏上只出数字）
    幕.appendChild(计);
    const 排1 = 元('div', '蛙排');
    排1.appendChild(造蛙());                      // 先来一只，问它几条腿
    幕.appendChild(排1);
    舞台布.appendChild(幕);

    // Phase A（孩子参与）：1 只青蛙几条腿 → 4，走报数（≤20，进判对、可备选钮兜底）
    await 报一个数(腿, { 问: 话.蛙问 });
    if (!还在()) return;
    收起麦克风();

    // Phase B（演示）：凑满一排 10 只，一只只蹦出来带着数腿——4、8、12……数到 40
    await 说(话.蛙一排头);
    if (!还在()) return;
    const 逐 = 一排腿数(腿, 一排);
    for (let k = 0; k < 一排; k += 1) {
      if (!还在()) return;
      if (k > 0) 排1.appendChild(造蛙());         // 第 0 只是问句里那只，已经在了
      工具.音效.点一下();
      计.textContent = String(逐[k]);
      计.classList.remove('跳'); void 计.offsetWidth; 计.classList.add('跳');
      await 数词说(逐[k]);                         // 4…40：中文数/英文数 兜得住
    }

    // Phase C（纯演示，无输入）：另外九排刷地铺满屏，一排一声 40、80、120……数到 400
    await 说(话.满屏头);
    if (!还在()) return;
    const 排数列 = 满屏排数列(腿, 一排, 排数);
    加排数(排1, 排数列[0]);                        // 第一排的总数也挂上牌（40）
    for (let r = 1; r < 排数; r += 1) {
      if (!还在()) return;
      const 排 = 元('div', '蛙排 蛙排入');
      for (let c = 0; c < 一排; c += 1) 排.appendChild(造蛙());
      加排数(排, 排数列[r]);
      幕.appendChild(排);
      工具.音效.星星();
      计.textContent = String(排数列[r]);
      await 说(模板.Boss.念大(排数列[r]));         // 40…400：>99 的念法在本站模板摊
      if (!还在()) return;
      await 歇(120);
    }
    await 说(话.满屏说破);
    if (!还在()) return;
    await 歇(500);
    // 幕不撤：满屏青蛙留着当大庆祝的底景（下次进站时 进入() 会清掉）
  }

  const 加排数 = (排, n) => 排.appendChild(元('div', '蛙排数 数字牌', String(n)));

  // ---------------------------------------------------------------- 进入

  async function 进入() {
    const 本局 = ++局;
    const 还在 = () => 局 === 本局 && 面板.classList.contains('在前');
    舞台布.classList.remove('彩蛋中');
    for (const 旧 of 面板.querySelectorAll('.蛙幕, .篝火冲天')) 旧.remove(); // 清上一次彩蛋的遗留
    题台.textContent = '';
    点.清零();

    // 断点续闯：通关过（Boss 有星）就从头重玩；没通关从上次做到的那关接着来。
    // 柜值随云同步走，坏数据（负/小数/NaN/越界）一律当没有——两头钳 + 取整，不许把站搞死。
    const 起 = 工具.有星('Boss') ? 0
      : Math.min(Math.max(0, Math.floor(Number(工具.取(续键)) || 0)), 题单.length - 1);
    for (let i = 0; i < 起; i += 1) 点.点亮(i);

    for (let i = 起; i < 题单.length; i += 1) {
      if (!还在()) return;
      await 跑一关(i, 还在, i === 起);
      if (!还在()) return;
      点.点亮(i);
      工具.记(续键, i + 1);
      if (i < 题单.length - 1) { if (!还在()) return; await 说(话.过关); }
    }

    if (!还在()) return;
    工具.记(续键, 0);            // 五关全过，下次从头（彩蛋每次通关都放）
    收起麦克风();
    await 说(话.通关);
    if (!还在()) return;

    await 彩蛋(还在);           // 只演不考的青蛙合唱团
    if (!还在()) return;

    // 篝火冲天（本站自己的收官布景）+ 全章大庆祝（第 10 星由 完成 自动触发主.js 的仪式，
    // 烟花/奖杯/纸屑不在这儿重造，顺着现有仪式走）
    舞台布.appendChild(元('div', '篝火冲天'));
    await 工具.完成('Boss');
    if (!还在()) return;
    await 说(话.收尾);
  }

  return { 进入 };
}
