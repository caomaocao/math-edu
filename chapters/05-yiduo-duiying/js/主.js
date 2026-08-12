// 主 —— 营地地图 + 站点切换 + 星星 + 开场解锁 + 讲内语言开关。
//
// 地图是首页：一条营地小径串起 11 个站点（开营站 + 9 个玩法站 + 篝火晚会 Boss）。
// 指到节点念名字，点进去玩。面板全部常驻文档，切换只换「在前」（第 2/3/4 讲同款），
// 不在前的挂 inert。结构与第 4 讲的 主.js 同源——同一套 打开/层级/完成/庆祝/重来/
// 换语言/云同步，只换了世界观（营地而非铁路）和基准尺寸。
//
// 星星的账跟第 4 讲有一处不同：开营站**没有星**（spec：站 1~9 + Boss 共 10 颗），
// 完成() 对无星站不点星，大庆祝的门槛数的是 星站们.length。

import { 说, 备话, 闭嘴 } from '/shared/js/说话.js';
import { 先要权限 } from '/shared/js/录音.js';
import { 装麦克风坞, 收起麦克风 } from '/shared/js/问答.js';
import { 音效, 解锁 } from '/shared/js/音效.js';
import { 进度, 合并, 存储键 } from './进度.js';
import { 登记, 启动同步, 立即推 } from '/shared/js/云同步.js';
import { 当前语言, 订阅语言, 选 } from '/shared/js/语言.js';
import { 装语言开关 } from '/shared/js/语言开关.js';
import { 台词, 全部台词 } from './台词表.js';
import { 站点表, 星站们, 站名 } from './站点表.js';
import { 画实体SVG } from '/shared/js/实体图.js';
import { 装后退 } from '/shared/js/后退.js';
import { 装舞台 } from '/shared/js/舞台.js';
import { 装转屏拦罩, 转屏台词们 } from '/shared/js/转屏.js';
import { 预热实体图 } from '/shared/js/预热.js';

/**
 * 这一讲的基准分辨率 —— 11 站的几何全按这一个尺寸画，整块画面再等比缩放到实际屏幕
 * （见 docs/adr/0004 与 /shared/js/舞台.js）。改屏幕只改这两个数。
 *
 * 高 720 是**内容倒推**出来的：站里排得最高的是松果虫虫站（一篮 18 颗松果按 3 列码 6 行
 * ≈ 384 舞台px）+ 开饭铃 92 + 缝 24，加上 .舞台布 上下留的 174（24 顶 + 150 给麦克风坞）
 * ≈ 674，落在 720 以内。这个数一改，触靶的物理尺寸全跟着变 ——
 * **动它就得重算 styles.css 头上那笔账。**
 */
const 基准舞台 = { 宽: 1280, 高: 720 };

// 营地小径的 11 站（1200×680 viewBox 上手摆的蛇形）。0-4 顶行（开营 → 分饭）、
// 5 右弯（喂食）、6-9 中行往回走（松果 → 蛋糕）、10 篝火晚会（底部正中偏左收官）。
const 站们 = [
  [110, 140], [310, 140], [510, 140], [710, 140], [910, 140],
  [1080, 300],
  [910, 450], [690, 450], [470, 450], [250, 450],
  [560, 595],
];

const 图纸 = document.getElementById('营地地图');
const 面板们 = {};
for (const { 号 } of 站点表) 面板们[号] = document.getElementById(`面板-${号}`);
const 地图面板 = document.getElementById('面板-地图');
const 回家钮 = document.getElementById('回家钮');
const 站账 = Object.fromEntries(站点表.map((条) => [条.号, 条]));

// 号 → Promise<{进入, 换语言?}>（存的是「import + 创建」这件事本身，理由见第3讲 主.js）。
const 模块池 = {};
let 现在在 = '地图';
let 进关代 = 0;
let 收重来确认 = () => {};

// ---------------------------------------------------------------- 工具箱（发给每个站点模块）

async function 完成(号) {
  if (!站账[号]?.星) return; // 开营站没有星（spec：站 1~9 + Boss 共 10 颗）
  if (进度.点星(号)) {
    音效.星星();
    撒纸屑(26);
    await 说(台词.全站.得星);
  }
  if (进度.数星() >= 星站们.length && !进度.读柜('大庆祝放过')) {
    进度.写柜('大庆祝放过', true);
    大庆祝();
  }
}

// 站点想自动回地图也得走 层级.退()——离开一层的唯一出口，见 后退.js
// 记/取：站内小进度（第几轮、第几盘）落进「柜」，跟星星一起带版本存、跟云同步、被重来清。
const 工具 = {
  完成, 回地图: () => 层级.退(), 说, 备话, 音效,
  有星: (号) => 进度.有星(号),
  记: (格, 值) => 进度.写柜(格, 值),
  取: (格) => 进度.读柜(格),
};

// ---------------------------------------------------------------- 面板切换

function 摆正面板() {
  const 全部 = [地图面板, ...Object.values(面板们)];
  for (const 板 of 全部) {
    const 在前 = 板.dataset.环节 === 现在在 || (现在在 === '地图' && 板 === 地图面板);
    板.classList.toggle('在前', 在前);
    if (在前) 板.removeAttribute('inert');
    else 板.setAttribute('inert', '');
  }
}

async function 打开(号, { 从历史 = false } = {}) {
  if (!从历史 && 现在在 === 号) return;
  if (!从历史) 层级.进(号);
  闭嘴();
  收起麦克风();
  收重来确认();
  现在在 = 号;
  const 这代 = ++进关代;
  摆正面板();
  if (!模块池[号]) {
    模块池[号] = (async () => {
      try {
        const 模块 = await import(`./站/${号}.js`);
        return 模块.创建(面板们[号], 工具);
      } catch (错) {
        console.error(`站点「${号}」还没搭好`, 错);
        return { async 进入() { await 说(台词.全站.还在施工); } };
      }
    })();
  }
  const 实例 = await 模块池[号];
  if (这代 !== 进关代 || 现在在 !== 号) return;
  await 实例.进入();
}

function 回地图() {
  闭嘴();
  收起麦克风();
  现在在 = '地图';
  摆正面板();
  刷星星();
}

const 层级 = 装后退({
  起点: '地图',
  切到: (层) => (层 === '地图' ? 回地图() : 打开(层, { 从历史: true })),
});

// 小房子 = 回上一层（站里回地图；地图上回全站首页）。500ms 挡连点，同第 3/4 讲。
let 上次回家 = 0;
回家钮.onclick = () => {
  const 现在 = Date.now();
  if (现在 - 上次回家 < 500) return;
  上次回家 = 现在;
  音效.点一下();
  if (现在在 === '地图') location.assign('/');
  else 层级.退();
};

// ---------------------------------------------------------------- 画地图

const 命名空间 = 'http://www.w3.org/2000/svg';

function 元素(名, 属性们 = {}, 文字) {
  const 元 = document.createElementNS(命名空间, 名);
  for (const [k, v] of Object.entries(属性们)) 元.setAttribute(k, v);
  if (文字 !== undefined) 元.textContent = 文字;
  return 元;
}

function 画布景() {
  // 远处的林line + 太阳（结构性布景走手绘 SVG——spec 世界观）
  图纸.append(
    元素('path', {
      d: 'M0,240 Q150,120 320,220 Q480,110 660,210 Q840,100 1010,200 Q1120,140 1200,210 L1200,0 L0,0 Z',
      fill: '#e6f1d5', opacity: 0.9,
    }),
    元素('circle', { cx: 1080, cy: 78, r: 46, fill: '#ffd76e' }),
  );
  // 分区框线：帐篷区 / 竹林 / 草地 / 餐桌区 / 篝火圈（长相在 styles.css 的地图段）
  图纸.append(
    元素('rect', { x: 225, y: 52, width: 170, height: 176, rx: 30, class: '分区 帐篷区' }),
    元素('ellipse', { cx: 510, cy: 138, rx: 100, ry: 88, class: '分区 竹林区' }),
    元素('ellipse', { cx: 710, cy: 138, rx: 100, ry: 86, class: '分区 草地区' }),
    元素('ellipse', { cx: 470, cy: 452, rx: 100, ry: 84, class: '分区 草地区' }),
    元素('ellipse', { cx: 910, cy: 140, rx: 100, ry: 88, class: '分区 餐桌区' }),
    元素('ellipse', { cx: 250, cy: 452, rx: 100, ry: 84, class: '分区 餐桌区' }),
    元素('circle', { cx: 560, cy: 595, r: 78, class: '分区 篝火圈' }),
  );
  // 营地小径：一条土路 + 白色脚步虚线
  const 路点 = 站们.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
  图纸.append(
    元素('path', { d: 路点, fill: 'none', stroke: '#e0cda4', 'stroke-width': 38, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    元素('path', { d: 路点, fill: 'none', stroke: '#fffdf4', 'stroke-width': 5, 'stroke-dasharray': '2 26', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.9 }),
  );
  // 点缀：走实体图（地图是 SVG，用 画实体SVG）。位置都躲开了节点热区（r60）。
  const 点缀们 = [
    [60, 320, '大树', '🌳'], [1130, 190, '松树', '🌲'],
    [90, 620, '花丛', '🌷'], [990, 620, '小花', '🌼'],
    [610, 300, '蝴蝶', '🦋'],
  ];
  for (const [x, y, 名, 兜底] of 点缀们) {
    图纸.append(画实体SVG(名, 兜底, { 边: 40, x: x - 20, y: y - 32 }));
  }
}

const 节点们 = {};

function 画节点() {
  站点表.forEach((条, i) => {
    const { 号, 素, 图 } = 条;
    const [x, y] = 站们[i];
    const 组 = 元素('g', { class: '地图节点 没星', transform: `translate(${x},${y})` });
    组.append(
      // 隐形热区大圆。viewBox 1200×680 塞进 1280×720 的舞台，取小者 = 720/680 ≈ 1.059；
      // 直径 2×60×1.059 ≈ 127 舞台px ≈ 63pt，过 44pt（账在 styles.css 头）。全图两站
      // 最近是 Boss↔腿腿站 ≈ 171 viewBox 单位，两个 60 的圆要 120 才碰上，不抢。
      元素('circle', { class: '节点热区', r: 60 }),
      元素('circle', { class: '节点圈', r: 42 }),
      画实体SVG(素, 图, { 边: 44, x: -22, y: -22, 类名: '节点图' }),
    );
    // 星星只给有星的站（开营站没有——spec 的 10 颗账）
    if (条.星) 组.append(元素('text', { class: '节点星', y: -46, 'text-anchor': 'middle' }, '⭐'));
    // mouseenter 而非 pointerenter：同第 3/4 讲，触屏上进站第一句 说() 会 闭嘴()，
    // 划过念名字只当桌面白得的便利。
    组.addEventListener('mouseenter', () => 说(选(条.名)));
    组.addEventListener('click', () => { 音效.点一下(); 打开(号); });
    图纸.append(组);
    节点们[号] = 组;
  });
}

/** 小营员站在最近一个没点亮的星站旁（纯装饰、不锁顺序），用 小朋友 贴纸走渲染单闸。
 *  往右挪 40：别正压在节点自己的星星上。 */
let 营员 = null;
function 摆营员() {
  const 下一站 = 星站们.find(({ 号 }) => !进度.有星(号)) ?? 星站们[星站们.length - 1];
  const i = 站点表.findIndex((条) => 条.号 === 下一站.号);
  const [x, y] = 站们[i];
  if (!营员) {
    营员 = 元素('g', { class: '营员标' });
    营员.append(画实体SVG('小朋友', '🧒', { 边: 64, x: -32, y: -64 }));
    图纸.append(营员);
  }
  营员.setAttribute('transform', `translate(${x + 40},${y - 40})`);
}

function 刷星星() {
  for (const { 号 } of 星站们) {
    const 有 = 进度.有星(号);
    节点们[号].classList.toggle('有星', 有);
    节点们[号].classList.toggle('没星', !有);
  }
  // 只差 Boss 一颗星时，篝火在地图上发光召唤（票 08 的收官仪式感）
  const 只差Boss = !进度.有星('Boss')
    && 星站们.every(({ 号 }) => 号 === 'Boss' || 进度.有星(号));
  节点们.Boss.classList.toggle('召唤', 只差Boss);
  摆营员();
}

// ---------------------------------------------------------------- 庆祝（同第 3/4 讲）

function 撒纸屑(数量) {
  const 层 = document.createElement('div');
  层.className = '庆祝层';
  const 落多远 = `${(window.visualViewport?.height || window.innerHeight) + 80}px`;
  const 花样 = ['🎉', '⭐', '🎈', '✨', '🌟'];
  for (let i = 0; i < 数量; i++) {
    const 片 = document.createElement('span');
    片.className = '纸屑';
    片.textContent = 花样[i % 花样.length];
    片.style.left = `${Math.random() * 100}%`;
    片.style.setProperty('--落多远', 落多远);
    片.style.animationDuration = `${1.6 + Math.random() * 1.6}s`;
    片.style.animationDelay = `${Math.random() * 0.5}s`;
    层.appendChild(片);
  }
  document.body.appendChild(层);
  setTimeout(() => 层.remove(), 3800);
}

function 大庆祝() {
  音效.大烟花();
  撒纸屑(90);
  const 牌 = document.createElement('div');
  牌.className = '大奖牌';
  牌.innerHTML = `<div class="奖杯">🏆</div><div class="奖星">${'⭐'.repeat(星站们.length)}</div>`;
  牌.onclick = () => 牌.remove();
  document.body.appendChild(牌);
  说(台词.全站.大庆祝);
  setTimeout(() => 牌.remove(), 12_000);
}

// ---------------------------------------------------------------- 重来（两次确认，同第 3/4 讲）

function 装重来() {
  const 角 = document.getElementById('重来角');
  const 重来 = document.createElement('button');
  重来.textContent = '↺';
  角.appendChild(重来);
  重来.onclick = async () => {
    if (角.childElementCount > 1) return;
    说(台词.全站.重来问);
    const 真清 = document.createElement('button');
    真清.className = '真清';
    真清.textContent = '✔';
    const 算了 = document.createElement('button');
    算了.className = '算了';
    算了.textContent = '✕';
    let 计时;
    const 收 = () => { 真清.remove(); 算了.remove(); clearTimeout(计时); 收重来确认 = () => {}; };
    收重来确认 = 收;
    真清.onclick = () => { 进度.清空(); 立即推(存储键); 收(); 刷星星(); 说(台词.全站.重来了); };
    算了.onclick = () => { 收(); 闭嘴(); };
    角.append(真清, 算了);
    计时 = setTimeout(收, 8000);
  };
}

// ---------------------------------------------------------------- 换语言这一下（同第 3/4 讲）

function 上家长角标() {
  const 钮 = document.getElementById('家长页钮');
  钮.textContent = 选({ cn: 钮.dataset.cn, en: 钮.dataset.en });
  for (const 元 of document.querySelectorAll('#家长角 [data-cn-title]')) {
    元.title = 选({ cn: 元.dataset.cnTitle, en: 元.dataset.enTitle });
  }
}

function 摆文档语言() {
  const 英 = 当前语言() === 'en';
  document.documentElement.lang = 英 ? 'en' : 'zh-CN';
  document.documentElement.dataset.语 = 当前语言();
  document.title = 英 ? 'Forest Camp Picnic' : '森林营地野餐会';
}

订阅语言(() => {
  摆文档语言();
  上家长角标();
  for (const 待建 of Object.values(模块池)) {
    Promise.resolve(待建)
      .then((模块) => 模块.换语言?.())
      .catch((错) => console.error('这一站没换成语言', 错));
  }
  if (现在在 !== '地图') 打开(现在在, { 从历史: true });
});

// ---------------------------------------------------------------- 家长角

document.getElementById('家长信息钮').onclick = () => {
  document.getElementById('家长信息卡').hidden = false;
};
document.getElementById('家长信息关').onclick = () => {
  document.getElementById('家长信息卡').hidden = true;
};

// ---------------------------------------------------------------- 开场

装舞台(document.querySelector('.外壳'), 基准舞台);
装转屏拦罩();
画布景();
画节点();
刷星星();
装重来();
装语言开关(document.getElementById('语言角'), { 点一下: 音效.点一下 });
上家长角标();
装麦克风坞(document.getElementById('麦克风坞挂点'));
摆正面板();
摆文档语言();

// 云端进度同步（同第 3/4 讲：登记 + 启动；off/未登录/断网就永久休眠，本机开发逐字节一致）
登记({
  存储键,
  合并,
  收编: (合并后) => { 进度.落整包(合并后); 刷星星(); },
});
启动同步();

document.getElementById('开始钮').onclick = async () => {
  解锁();
  先要权限();
  document.getElementById('开始遮罩').remove();
  备话([台词.全站.开场白]);
  if (进度.数星() === 0) {
    await 说(台词.全站.开场白);
  } else {
    await 说(台词.全站.欢迎回来);
  }
  // 开口之后再在背景里慢慢灌缓存（同第 3/4 讲）。递取话函数，换语言时自动用新语言再备。
  备话((语) => [
    ...转屏台词们(语),
    ...全部台词({ 语, 环节名们: 站点表.map((条) => 站名(条, 语)) }),
  ]);

  // 实体图预热：把 11 站会用到的实体图静静拉进缓存（跟覆盖测试同一接缝：每站导出 实体们）。
  预热实体图(async () => {
    const 名单 = [];
    await Promise.all(
      站点表.map(async ({ 号 }) => {
        try {
          const 模块 = await import(`./站/${号}.js`);
          if (Array.isArray(模块.实体们)) 名单.push(...模块.实体们);
        } catch { /* 这一站还没搭好或没导出：跳过 */ }
      }),
    );
    return 名单;
  });
};
