import {
  CELL_SIZE,
  buildHingeTree,
  canClose,
  foldMatrices,
  isNet,
  transformPoint,
  选根格子,
} from '../domain/net.js';
import { cellStyle } from '../domain/palette.js';
import { 台词 } from '../data/台词表.js';
import { 当前语言, 订阅语言, 选 } from '/shared/js/语言.js';
import { 创建不复读的朗读 } from './nav.js';
import { 说 as 默认朗读 } from '/shared/js/说话.js';
import { 音效 as 默认音效 } from '/shared/js/音效.js';
import { 创建看见, 能看见 as 默认探测 } from '/shared/js/看见.js';

/**
 * 做一件真的 —— 把屏幕上那件衣服印成一张真能剪下来折起来的纸，
 * 再让方方亲眼看见孩子做出来的那个盒子。
 *
 * 对应书上闯关四「请你动手和爸爸妈妈一起制作一件正方体的衣服」。
 * 孩子在沙盒里画好一张**能合上**的衣服，切到这儿，按打印机图标，
 * 打印机吐出来的就是同一件衣服：同样的颜色、同样的水果、真尺寸、带小耳朵。
 * 剪下来、沿虚线折、把小耳朵抹上胶水粘住，屏幕上那个正方体就到手里了。
 *
 * 三条硬规矩：
 *   1. 穿不上的形状不印。孩子剪半天粘不上，比不给印挫败得多。
 *   2. 每条要粘的外边，两片当中只有**一片**带小耳朵 —— 两片都带就粘不上了。
 *      谁带谁不带不是画上去的，是把衣服折起来算出来的，见「小耳朵怎么算」。
 *   3. 实线剪、虚线折。孩子和家长得一眼分得清。
 *
 * 不引 PDF 库：一张 SVG（尺寸就写成毫米）+ 打印专用 CSS + window.print()。
 * 颜色画在 SVG 的 fill 上而不是 CSS 背景上 —— 打印对话框里那个「背景图形」
 * 默认是关的，画成背景就印出一张白纸，孩子手上那件衣服就没颜色了。
 *
 * 打印机旁边还有一个相机（`/shared/js/看见.js`）：盒子做好了，举到摄像头前，
 * 倒数三二一拍一张，方方看着照片具体地夸一句。**只夸不判** ——
 * 识别翻车顶多夸错颜色，绝不会说孩子做错了。
 *
 * 相机按钮有第四条硬规矩：**没摄像头、爸妈点了不允许、后端没配 key，
 * 这三种情况下它压根不出现**。孩子不认字，一个点了没反应的按钮
 * 对他来说就是「网站坏了」，比没有这个功能糟得多。
 */

// ---------------------------------------------------------------------------
// 纸上的尺寸（毫米）
// ---------------------------------------------------------------------------

/** 格子边长。折起来就是一个边长 4.5cm 的正方体，五岁的手抓得住 */
export const 格子边长 = 45;

/**
 * 小耳朵伸出去多长。必须 ≤ 边长的 1/4：
 * 两个小耳朵有可能从两边伸进同一个空格子里，短过 1/4 才不会撞上（见测试）。
 */
export const 粘贴边深 = 格子边长 * 0.2;

/** A4，和四周留白。纸样比这个大就印不下 */
export const 纸宽 = 210;
export const 纸高 = 297;
export const 页边 = 8;

// ---------------------------------------------------------------------------
// 格子的四条边
// ---------------------------------------------------------------------------

/**
 * 四个方向。`局部` 是这条边的中点在格子自己坐标系里的位置（net.js 那套：
 * +x 是列变大，+z 是行变大），折起来之后拿它去认「哪两条边碰到了一块儿」。
 */
export const 方向表 = Object.freeze({
  上: Object.freeze({ dRow: -1, dCol: 0, 局部: [0, 0, -CELL_SIZE / 2] }),
  右: Object.freeze({ dRow: 0, dCol: 1, 局部: [CELL_SIZE / 2, 0, 0] }),
  下: Object.freeze({ dRow: 1, dCol: 0, 局部: [0, 0, CELL_SIZE / 2] }),
  左: Object.freeze({ dRow: 0, dCol: -1, 局部: [-CELL_SIZE / 2, 0, 0] }),
});

/** 固定的次序 —— 同一张衣服每次算出来的纸样必须一模一样 */
export const 方向次序 = Object.freeze(['上', '右', '下', '左']);

/**
 * 方方在这个玩法里说的话，出处在 data/台词表.js（全站一份，开场统一预热）。
 * 是个**函数**：要说的时候才取，不然中文那一句会被焊死在模块加载的那一刻。
 */
const 纸样话 = () => 台词().做一件真的;

const 同一格 = (a, b) => a.row === b.row && a.col === b.col;

/**
 * 外边 = 那一侧没有邻居的边。折起来之后它得跟另一条外边粘在一起。
 *
 * 6 个格子共 24 条边，5 条折痕吃掉 10 条，剩下 14 条外边 ——
 * 正方体 12 条棱，5 条是折痕，还有 7 条要粘，每条两片，正好 14。
 *
 * @returns {Array<{格子下标: number, 方向: string}>}
 */
export function 外边(cells) {
  const 边 = [];
  cells.forEach((格, 下标) => {
    for (const 方向 of 方向次序) {
      const { dRow, dCol } = 方向表[方向];
      const 邻居 = { row: 格.row + dRow, col: 格.col + dCol };
      if (!cells.some((其他) => 同一格(其他, 邻居))) 边.push({ 格子下标: 下标, 方向 });
    }
  });
  return 边;
}

/** 把浮点误差抹平，好拿坐标当 Map 的键（-0 也归成 0） */
const 抹平 = (值) => {
  const 四舍五入 = Math.round(值 * 1e4) / 1e4;
  return 四舍五入 === 0 ? 0 : 四舍五入;
};

const 边的键 = (边) => `${边.格子下标}${边.方向}`;

/**
 * 哪两条外边要粘在一起 —— 把衣服真的折起来（折叠度 = 1）看出来的。
 *
 * 每条边算出它的中点在三维里落在哪儿。两条外边落到同一个点，
 * 说明它们贴到了正方体的同一条棱上，就是要粘的那一对。
 * 一共 7 对。表是算的，不是查的：孩子画哪张衣服就算哪张。
 *
 * 只对能合上的衣服有意义 —— 穿不上的时候几条边挤在一处、几条棱没人管，
 * 「谁跟谁粘」这句话就没有答案了。
 *
 * @returns {Array<[{格子下标, 方向}, {格子下标, 方向}]>} 7 对，次序固定
 */
export function 外边配对(cells) {
  if (!能打印(cells)) {
    throw new Error('穿不上的衣服没有「哪两条边粘一起」可言');
  }
  const 树 = buildHingeTree(cells, 选根格子(cells));
  const 矩阵 = foldMatrices(树, 1);

  const 按落点 = new Map();
  for (const 边 of 外边(cells)) {
    const 点 = transformPoint(矩阵[边.格子下标], 方向表[边.方向].局部).map(抹平);
    const 键 = 点.join(',');
    if (!按落点.has(键)) 按落点.set(键, []);
    按落点.get(键).push(边);
  }

  const 配对 = [];
  for (const 一堆 of 按落点.values()) {
    // 合上的衣服每条要粘的棱恰好两片纸。凑不齐两片说明折叠数学出了岔子，
    // 绝不能悄悄放过 —— 放过就会印出一条粘不上的边，孩子在桌子上才发现。
    if (一堆.length !== 2) {
      throw new Error(`有一条棱上贴着 ${一堆.length} 条外边，纸样不敢印`);
    }
    配对.push(一堆);
  }
  配对.sort((a, b) => (边的键(a[0]) < 边的键(b[0]) ? -1 : 1));
  return 配对;
}

/**
 * 小耳朵怎么算：先算出 7 对要粘的外边，**每一对只挑一片**带小耳朵。
 *
 * 这是这一票最容易做错的一条 —— 两片都带，两个耳朵顶在一起，
 * 那条边就合不拢；两片都不带，就没地方抹胶水。所以「一对挑一片」
 * 是从数据结构上保证的：耳朵是按对生出来的，一对生一个，不多不少。
 *
 * 挑哪一片：谁身上的耳朵少给谁（一个格子上挂满四个耳朵不好粘），
 * 一样多就挑下标小的那一片，保证同一张衣服每次印出来都一样。
 *
 * @returns {Array<{格子下标, 方向, 对家: {格子下标, 方向}}>} 7 个
 */
export function 算粘贴边(cells) {
  const 每格几个 = new Array(cells.length).fill(0);
  const 结果 = [];
  for (const [甲, 乙] of 外边配对(cells)) {
    const 甲少 = 每格几个[甲.格子下标] < 每格几个[乙.格子下标];
    const 一样多 = 每格几个[甲.格子下标] === 每格几个[乙.格子下标];
    const 挑中 = 甲少 || (一样多 && 边的键(甲) < 边的键(乙)) ? 甲 : 乙;
    const 对家 = 挑中 === 甲 ? 乙 : 甲;
    每格几个[挑中.格子下标]++;
    结果.push({ ...挑中, 对家: { ...对家 } });
  }
  return 结果;
}

/** 这张衣服能不能拿去印：得是一张衣服，而且得穿得上 */
export function 能打印(cells) {
  return Array.isArray(cells) && isNet(cells) && canClose(cells);
}

// ---------------------------------------------------------------------------
// 摆到纸上（毫米）
// ---------------------------------------------------------------------------

/** 一条边在纸上的两个端点，按顺时针绕格子走，好让外法线一律指向格子外面 */
function 边的端点(x, y, 边长, 方向) {
  const 右下 = [x + 边长, y + 边长];
  if (方向 === '上') return [[x, y], [x + 边长, y]];
  if (方向 === '右') return [[x + 边长, y], 右下];
  if (方向 === '下') return [右下, [x, y + 边长]];
  return [[x, y + 边长], [x, y]];
}

/**
 * 小耳朵画成一个梯形：两腰斜 45°。
 *
 * 斜边不是为了好看 —— 两个小耳朵从相邻两条边伸出来的时候，45° 让它们
 * 只在对角线上碰一下、绝不相互压住，剪刀一路剪得过去。
 */
function 粘贴边形状([[x1, y1], [x2, y2]], 深) {
  const 长 = Math.hypot(x2 - x1, y2 - y1);
  const [tx, ty] = [(x2 - x1) / 长, (y2 - y1) / 长];
  const [nx, ny] = [ty, -tx]; // 顺时针走的话，右手边就是格子外面
  return [
    [x1, y1],
    [x1 + (nx + tx) * 深, y1 + (ny + ty) * 深],
    [x2 + (nx - tx) * 深, y2 + (ny - ty) * 深],
    [x2, y2],
  ];
}

/**
 * 一张纸样的全部几何，单位毫米，左上角留出小耳朵的地方。
 *
 * 线分两种，印出来一眼分得清：
 *   剪切线（实线）= 纸的外沿，包括小耳朵的三条外边；
 *   折痕（虚线）  = 格子和格子之间那 5 条，外加 7 个小耳朵的根 ——
 *                  小耳朵也是要折进去的，它的根当然是折痕不是剪切线。
 */
export function 纸样几何(cells, { 边长 = 格子边长, 深 = 粘贴边深 } = {}) {
  if (!能打印(cells)) throw new Error('这张衣服穿不上，没有纸样');

  const 最小行 = Math.min(...cells.map((c) => c.row));
  const 最小列 = Math.min(...cells.map((c) => c.col));
  const 行数 = Math.max(...cells.map((c) => c.row)) - 最小行 + 1;
  const 列数 = Math.max(...cells.map((c) => c.col)) - 最小列 + 1;

  const 左上 = (格) => [(格.col - 最小列) * 边长 + 深, (格.row - 最小行) * 边长 + 深];

  const 格子 = cells.map((格, 下标) => {
    const [x, y] = 左上(格);
    const 样 = cellStyle(格.槽位 ?? 下标);
    // 水果拿的是绘文字，不是屏幕上那张贴纸风素材 —— 有意为之，缘由见下面 纸样SVG() 里那段
    return { 下标, row: 格.row, col: 格.col, x, y, 边长, 颜色: 样.color, 水果: 样.fruit };
  });

  const 剪切 = [];
  const 折痕 = [];

  // 折痕：两个格子共用的那条边，一对只画一次
  cells.forEach((格, 下标) => {
    for (const 方向 of ['右', '下']) {
      const { dRow, dCol } = 方向表[方向];
      const 邻居 = { row: 格.row + dRow, col: 格.col + dCol };
      if (!cells.some((其他) => 同一格(其他, 邻居))) continue;
      const [x, y] = 左上(格);
      const [甲, 乙] = 边的端点(x, y, 边长, 方向);
      折痕.push({ x1: 甲[0], y1: 甲[1], x2: 乙[0], y2: 乙[1], 是: '折痕', 格子下标: 下标 });
    }
  });

  const 带耳朵的 = new Map(算粘贴边(cells).map((一个) => [边的键(一个), 一个]));

  const 粘贴边 = [];
  for (const 边 of 外边(cells)) {
    const [x, y] = 左上(cells[边.格子下标]);
    const 端点 = 边的端点(x, y, 边长, 边.方向);
    const 耳朵 = 带耳朵的.get(边的键(边));

    if (!耳朵) {
      // 没耳朵的外边：纸到这儿为止，剪刀沿着它剪
      剪切.push({ x1: 端点[0][0], y1: 端点[0][1], x2: 端点[1][0], y2: 端点[1][1] });
      continue;
    }

    const 点 = 粘贴边形状(端点, 深);
    粘贴边.push({
      ...边,
      对家: 耳朵.对家,
      点,
      颜色: 格子[边.格子下标].颜色,
    });
    // 耳朵的根是折痕（要折进去），另外三条是剪切线
    折痕.push({ x1: 端点[0][0], y1: 端点[0][1], x2: 端点[1][0], y2: 端点[1][1], 是: '粘贴边根' });
    for (let i = 0; i < 3; i++) {
      剪切.push({ x1: 点[i][0], y1: 点[i][1], x2: 点[i + 1][0], y2: 点[i + 1][1] });
    }
  }

  return {
    边长,
    深,
    行数,
    列数,
    宽: 列数 * 边长 + 深 * 2,
    高: 行数 * 边长 + 深 * 2,
    格子,
    折痕,
    剪切,
    粘贴边,
  };
}

/** 竖着放印得下就竖着印，太宽了就横过来 —— 孩子手上那张跟屏幕上摆法一样 */
export function 纸张朝向(几何) {
  return 几何.宽 > 几何.高 ? 'landscape' : 'portrait';
}

/** 这张纸样印不印得进一页 A4 */
export function 放得下(几何) {
  const 横 = 纸张朝向(几何) === 'landscape';
  const 能用宽 = (横 ? 纸高 : 纸宽) - 页边 * 2;
  const 能用高 = (横 ? 纸宽 : 纸高) - 页边 * 2;
  return 几何.宽 <= 能用宽 && 几何.高 <= 能用高;
}

// ---------------------------------------------------------------------------
// 画成 SVG（字符串，好在 node 里直接验）
// ---------------------------------------------------------------------------

const 线色 = '#20263f';
const 剪切线粗 = 0.55;
const 折痕线粗 = 0.45;

const 线段 = (线, 属性) =>
  `<line x1="${圆(线.x1)}" y1="${圆(线.y1)}" x2="${圆(线.x2)}" y2="${圆(线.y2)}" ${属性} />`;

const 圆 = (值) => Math.round(值 * 1000) / 1000;

/**
 * 把几何画成一张 SVG。
 *
 * @param {'毫米'|'自适应'} 单位 打印用毫米（印出来就是真尺寸），预览用自适应
 */
export function 纸样SVG(几何, { 单位 = '毫米' } = {}) {
  const 尺寸 =
    单位 === '毫米'
      ? `width="${圆(几何.宽)}mm" height="${圆(几何.高)}mm"`
      : 'width="100%" height="100%"';

  const 耳朵 = 几何.粘贴边
    .map((一个) => {
      const 点 = 一个.点.map(([x, y]) => `${圆(x)},${圆(y)}`).join(' ');
      // 淡淡染上这一格自己的颜色：孩子一眼看得出这只耳朵是哪一格的
      return `<polygon points="${点}" fill="${一个.颜色}" fill-opacity="0.22" />`;
    })
    .join('');

  /*
    水果在这儿**仍然是绘文字**，屏幕上那三处（三维贴图、格子纸、猜一猜题面）
    换成贴纸风素材之后也没跟着换 —— 这是拍板过的，不是漏了（票 10 / 00-spec）。

    纸样是一段 SVG，里头这一格是个 <text> 节点。要印贴纸就得把六张 PNG 转成
    data URI 内嵌进来，纸样文件从几 KB 涨到几百 KB，打印预览也跟着变慢；
    而这份收益只落在纸面上（孩子拿剪刀剪的那张），屏幕上一眼都看不见。
    真要换的那天，改的是这一行加一份 PNG→dataURI 的构建步骤，别在运行时读文件。
  */
  const 格子 = 几何.格子
    .map((格) => {
      const 内缩 = 几何.边长 * 0.055;
      return (
        `<rect x="${圆(格.x)}" y="${圆(格.y)}" width="${圆(几何.边长)}" height="${圆(几何.边长)}" fill="${格.颜色}" />` +
        `<rect x="${圆(格.x + 内缩)}" y="${圆(格.y + 内缩)}" width="${圆(几何.边长 - 内缩 * 2)}" height="${圆(几何.边长 - 内缩 * 2)}" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="${圆(几何.边长 * 0.045)}" />` +
        `<text x="${圆(格.x + 几何.边长 / 2)}" y="${圆(格.y + 几何.边长 / 2)}" font-size="${圆(几何.边长 * 0.46)}" text-anchor="middle" dominant-baseline="central">${格.水果}</text>`
      );
    })
    .join('');

  const 折 = 几何.折痕
    .map((线) =>
      线段(
        线,
        `stroke="${线色}" stroke-width="${折痕线粗}" stroke-dasharray="${圆(几何.边长 * 0.09)} ${圆(几何.边长 * 0.06)}" stroke-linecap="round"`,
      ),
    )
    .join('');

  const 剪 = 几何.剪切
    .map((线) =>
      线段(线, `stroke="${线色}" stroke-width="${剪切线粗}" stroke-linecap="round" stroke-linejoin="round"`),
    )
    .join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ${尺寸} viewBox="0 0 ${圆(几何.宽)} ${圆(几何.高)}" ` +
    `preserveAspectRatio="xMidYMid meet" class="纸样图" role="img" aria-label="正方体的衣服纸样">` +
    `${耳朵}${格子}${折}${剪}</svg>`
  );
}

/**
 * 还印不了的时候，把孩子手上那张（画了一半的、或者穿不上的）衣服灰着摆出来。
 * 一个字都不写 —— 他得认出「说的就是我那件」，剩下的话交给 说()。
 */
export function 灰衣服SVG(cells) {
  if (!Array.isArray(cells) || cells.length === 0) return '';
  const 边 = 10;
  const 最小行 = Math.min(...cells.map((c) => c.row));
  const 最小列 = Math.min(...cells.map((c) => c.col));
  const 宽 = (Math.max(...cells.map((c) => c.col)) - 最小列 + 1) * 边;
  const 高 = (Math.max(...cells.map((c) => c.row)) - 最小行 + 1) * 边;
  const 方块 = cells
    .map((格) => {
      const x = (格.col - 最小列) * 边;
      const y = (格.row - 最小行) * 边;
      return `<rect x="${x + 0.6}" y="${y + 0.6}" width="${边 - 1.2}" height="${边 - 1.2}" rx="1.4" fill="#c9d0e4" />`;
    })
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${宽} ${高}" ` +
    `preserveAspectRatio="xMidYMid meet" aria-hidden="true">${方块}</svg>`
  );
}

// ---------------------------------------------------------------------------
// 样式（自己注入，不写进 styles.css —— 那是别的票的地盘）
// ---------------------------------------------------------------------------

/**
 * 这段 CSS 由本模块自己注入，跟 03 票（格子纸）一个约定：
 * styles.css 归 04 票，几张票一起改必然互相覆盖，所以功能自带的样式跟着功能的 JS 走。
 * 一个字节都不从网上取，断网照样用。
 */
const 纸样样式 = `
.纸样 {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 18px;
  height: 100%;
  padding: 26px 26px 30px;
}

.纸样台 {
  display: grid;
  place-items: center;
  min-height: 0;
}

/* 一张真的纸躺在那儿：白底、薄影、按纸样自己的长宽比 */
.纸样纸 {
  display: grid;
  place-items: center;
  max-width: 100%;
  max-height: 100%;
  padding: 14px;
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 18px 44px rgba(43, 51, 82, 0.16);
}

.纸样纸 > svg {
  display: block;
  width: 100%;
  height: 100%;
}

.纸样台.还不行 .纸样纸 {
  background: rgba(255, 255, 255, 0.5);
  box-shadow: none;
  border: 3px dashed #ccd4e8;
}

/* 打印机 +（也许有的）相机。相机不出现的时候打印机还是居中的 */
.纸样钮排 {
  justify-self: center;
  display: flex;
  gap: 22px;
}

.打印键,
.相机键 {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 132px;
  height: 96px;
  padding: 0;
  border: 3px solid transparent;
  border-radius: 30px;
  background: linear-gradient(160deg, #ffffff 0%, #dde6ff 100%);
  box-shadow: 0 14px 30px rgba(76, 111, 255, 0.28);
  font-size: 54px;
  line-height: 1;
  cursor: pointer;
  transition:
    transform 0.14s ease,
    box-shadow 0.18s ease,
    filter 0.18s ease;
}

/* 装饰性 hover 只给鼠标：触屏上点过的键会粘着放大不放（docs/adr/0004）。
   两个键本身 132×96，已经在触靶红线以上，尺寸不用动 */
@media (hover: hover) {
  .打印键:hover:not(:disabled),
  .相机键:hover:not(:disabled) {
    transform: scale(1.06);
    border-color: #4c6fff;
  }
}

.打印键:focus-visible,
.相机键:focus-visible {
  outline: 3px solid #4c6fff;
  outline-offset: 4px;
}

/* 相机跟纸样没关系 —— 衣服还没画完也照样能把做好的盒子举给方方看 */
.相机键 {
  background: linear-gradient(160deg, #ffffff 0%, #ffe6f2 100%);
  box-shadow: 0 14px 30px rgba(255, 108, 178, 0.3);
}

/* 印不了的时候按钮灰着、还在原地 —— 别让它消失，孩子会以为自己按坏了 */
.打印键:disabled {
  cursor: default;
  filter: grayscale(1);
  opacity: 0.4;
  box-shadow: none;
}

/* 打印前那道二次确认：跟左下角「重来」同一套问-确认。
   浮在打印机键正上方（绝对定位，不挤动旁边那个相机键）；孩子拍一下 🖨️ 先见到它，
   点绿勾才真的印。问句不上屏（孩子不认字），走语音。 */
.打印组 {
  position: relative;
  display: flex;
}

.打印确认 {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 16px);
  transform: translateX(-50%);
  z-index: 5;
  display: none;
  align-items: center;
  /* 两个 96px 圆钮之间要留得下一根手指的误差：这两个键是「点准了才行」的那种，
     不像孤零零的控件能靠隐形热区外扩 —— 挨着放，外扩会盖到隔壁那个答案上去 */
  gap: 16px;
  padding: 12px 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 16px 36px rgba(43, 51, 82, 0.24);
}

.打印组.问着 .打印确认 {
  display: flex;
  animation: 打印确认冒出 0.16s ease;
}

@keyframes 打印确认冒出 {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(6px) scale(0.92);
  }
}

/* 96 舞台像素：第2讲触靶下限是 92（styles.css 头注释推导），这两个再往上留一点。
   跟「重来」那对确认键同一个道理、同一个尺寸档：点错一下就真印了，得点得准。 */
.打印确认键 {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 96px;
  padding: 0;
  border: none;
  border-radius: 50%;
  font-size: 40px;
  line-height: 1;
  cursor: pointer;
  transition: transform 0.12s ease;
}

/* 装饰性 hover 只给鼠标：触屏点完会粘着放大不散（docs/adr/0004） */
@media (hover: hover) {
  .打印确认键:hover {
    transform: scale(1.08);
  }
}

.打印确认键.要印 {
  background: #ddf6e5;
}

.打印确认键.不印 {
  background: #eef0f7;
}

.打印确认键:focus-visible {
  outline: 3px solid #4c6fff;
  outline-offset: 3px;
}

/* 屏幕上看不见的那张待印的纸 */
.纸样打印区 {
  display: none;
}

@media print {
  /* 导航、滑块、别的玩法，一概不上纸；只留这一张纸样 */
  body > *:not(.纸样打印区) {
    display: none !important;
  }

  html,
  body {
    height: auto !important;
    overflow: visible !important;
    background: #ffffff !important;
  }

  .纸样打印区 {
    display: block !important;
    margin: 0;
  }

  /* 颜色画在 SVG 的 fill 上，这一句只是双保险 */
  .纸样打印区 svg {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}
`;

let 样式装好了 = false;
function 装上样式() {
  if (样式装好了 || typeof document === 'undefined') return;
  样式装好了 = true;
  const 标签 = document.createElement('style');
  标签.dataset.来自 = '纸样';
  标签.textContent = 纸样样式;
  document.head.appendChild(标签);
}

/** @page 得跟着这张纸样的胖瘦换朝向，所以单开一个标签，每次印之前重写 */
function 设页面朝向(朝向) {
  let 标签 = document.querySelector('style[data-来自="纸样·页面"]');
  if (!标签) {
    标签 = document.createElement('style');
    标签.dataset.来自 = '纸样·页面';
    document.head.appendChild(标签);
  }
  标签.textContent = `@page { size: A4 ${朝向}; margin: ${页边}mm; }`;
}

// ---------------------------------------------------------------------------
// 面板
// ---------------------------------------------------------------------------

/** 默认从沙盒里现拿孩子手上那件衣服（票 01 就把它挂在 window 上了，只读） */
const 默认取格子 = () => window.__沙盒?.衣服?.cells ?? [];

/**
 * 把「做一件真的」这个面板搭起来。
 *
 * @param {HTMLElement} 容器 `window.__导航.面板元素('纸样')`
 * @param {{
 *   说?: (文本: string) => void,
 *   取格子?: () => Array<{row, col, 槽位}>,
 *   打印?: () => void,
 *   音效?: object,
 *   探测?: () => Promise<boolean>,   // 相机按钮该不该出现
 *   造看见?: (选项) => object,        // 取景幕，默认 /shared/js/看见.js
 * }} [依赖]
 */
export function 创建纸样(
  容器,
  {
    说 = 默认朗读,
    取格子 = 默认取格子,
    打印,
    音效 = 默认音效,
    探测 = 默认探测,
    造看见 = 创建看见,
  } = {},
) {
  if (!容器) return null;

  装上样式();
  容器.textContent = ''; // index.html 里那个占位图标让位

  const 念一下 = 创建不复读的朗读(说);

  const 壳 = document.createElement('div');
  壳.className = '纸样';

  const 台 = document.createElement('div');
  台.className = '纸样台';
  const 纸 = document.createElement('div');
  纸.className = '纸样纸';
  台.appendChild(纸);

  const 打印键 = document.createElement('button');
  打印键.type = 'button';
  打印键.className = '打印键';
  // 按钮上只有图标，字只给读屏和自动化验收
  打印键.setAttribute('aria-label', 纸样话().印出来);
  const 图 = document.createElement('span');
  图.setAttribute('aria-hidden', 'true');
  图.textContent = '🖨️';
  打印键.appendChild(图);

  /** 确认键：一个圆钮，上面只有图标，字只给读屏。跟「重来」那对确认键同一个模子 */
  const 造确认键 = (额外类, 图标, 标签) => {
    const 按 = document.createElement('button');
    按.type = 'button';
    按.className = `打印确认键 ${额外类}`;
    按.setAttribute('aria-label', 标签);
    const 图元 = document.createElement('span');
    图元.setAttribute('aria-hidden', 'true');
    图元.textContent = 图标;
    按.appendChild(图元);
    return 按;
  };

  // 打印前的二次确认 —— 跟左下角「重来」同一套问-确认。
  // 5 岁孩子一巴掌拍上打印机就弹系统打印框、整个课堂冻住，不识字的他不会取消。
  // 先只弹出一绿一灰两个大键（配语音问一句），点绿的才真的 window.print()。
  // 浮在打印键正上方（CSS 里 position:absolute），不挤动旁边那个相机键。
  const 打印确认 = document.createElement('div');
  打印确认.className = '打印确认';
  打印确认.setAttribute('aria-hidden', 'true');
  打印确认.inert = true;
  const 要印 = 造确认键('要印', '✔️', 选({ cn: '真的印', en: 'Yes, print it' }));
  const 不印 = 造确认键('不印', '✖️', 选({ cn: '先不印', en: 'Not now' }));
  打印确认.append(要印, 不印);

  const 打印组 = document.createElement('div');
  打印组.className = '打印组';
  打印组.append(打印键, 打印确认);

  const 钮排 = document.createElement('div');
  钮排.className = '纸样钮排';
  钮排.appendChild(打印组);

  // 相机键先造出来但**不挂上去** —— 挂不挂等 探测() 回话（见文件开头那第四条规矩）
  const 相机键 = document.createElement('button');
  相机键.type = 'button';
  相机键.className = '相机键';
  相机键.setAttribute('aria-label', 选({ cn: '举给方方看', en: 'Show it to Fangfang' }));
  const 相机图 = document.createElement('span');
  相机图.setAttribute('aria-hidden', 'true');
  相机图.textContent = '📷';
  相机键.appendChild(相机图);

  壳.append(台, 钮排);
  容器.appendChild(壳);

  let 当前几何 = null;

  function 刷新() {
    const 格子 = 取格子() ?? [];
    当前几何 = 能打印(格子) ? 纸样几何(格子) : null;

    台.classList.toggle('还不行', !当前几何);
    打印键.disabled = !当前几何;
    // 衣服被「重来」擦了、或者这会儿还穿不上：把可能悬着的打印确认收回去，
    // 免得孩子对着一件已经不在的衣服点了绿勾还真印出来
    if (!当前几何) 打印问(false);

    if (当前几何) {
      纸.style.aspectRatio = `${当前几何.宽} / ${当前几何.高}`;
      纸.innerHTML = 纸样SVG(当前几何, { 单位: '自适应' });
    } else {
      纸.style.aspectRatio = '3 / 4';
      纸.innerHTML = 灰衣服SVG(格子);
    }
    return 当前几何;
  }

  /** 一进这个面板就说一句 —— 孩子不认字，界面上没有一个句子告诉他现在能不能印 */
  function 进来了() {
    刷新();
    // 接口刚才没起来、摄像头刚插上，回到这个面板再问一次
    亮出相机();
    if (当前几何) 念一下(纸样话().纸样在这儿);
    else if ((取格子() ?? []).length === 0) 念一下(纸样话().先去画一件);
    else 念一下(纸样话().先折得上);
  }

  /** 切去别的玩法了：取景幕收起来，摄像头指示灯别一直亮着 */
  function 离开了() {
    打印问(false); // 悬着的打印确认别跟着孩子留到别的玩法上去招误点
    眼睛?.关?.();
  }

  function 印() {
    if (!当前几何) {
      念一下(纸样话().印不了);
      return false;
    }
    let 印区 = document.querySelector('.纸样打印区');
    if (!印区) {
      印区 = document.createElement('div');
      印区.className = '纸样打印区';
      // 直接挂在 body 下：打印时把 body 底下除它以外的全藏掉，
      // 导航、滑块、别的玩法一个都上不了纸
      document.body.appendChild(印区);
    }
    印区.innerHTML = 纸样SVG(当前几何, { 单位: '毫米' });
    设页面朝向(纸张朝向(当前几何));
    说(纸样话().剪下来);
    (打印 ?? (() => window.print()))();
    return true;
  }

  // -------------------------------------------------------------------------
  // 相机：把做好的盒子举给方方看
  // -------------------------------------------------------------------------

  /** 说给模型听的场景。写明「可能有点歪」，省得它憋不住去点评手工 */
  const 场景 = () => 纸样话().场景;
  const 举起来 = () => 纸样话().举给我看;

  /**
   * 看见模块那几句写死的中文，进方方的嘴之前过一道译台。
   *
   * 倒数（三、二、一）和接口挂了时的保底夸奖是 `/shared/js/看见.js` 里的常量，
   * 而那个文件是全站共享的，不归本讲改。台词表里两语各存了一份**同构**的列表
   * （中文那份直接引它的导出，不抄），这儿把两份拉链配起来：
   * 看见模块递出来的要是那几句中的一句，英文课上就换成英文的说法。
   *
   * 模型现夸的那一句不在表里，原样放行 —— 它本来就该是英文的：
   * 英文那一栏的 `场景` 里带着「请用一句简短的英文来夸他」。
   */
  function 说给看见(话) {
    if (当前语言() === 'cn') return 说(话);
    const 中 = 台词('cn').做一件真的;
    const 英 = 台词('en').做一件真的;
    const 换 = (中们, 英们) => {
      const 位 = 中们.indexOf(话);
      return 位 >= 0 ? 英们[位] : null;
    };
    const 译 = 换(中.倒数们, 英.倒数们) ?? 换(中.保底夸奖们, 英.保底夸奖们);
    return 说(译 ?? 话);
  }

  let 眼睛 = null;
  let 相机在了 = false;
  let 探测中 = null;

  function 撤掉相机() {
    相机在了 = false;
    相机键.remove();
    眼睛?.dispose?.();
    眼睛 = null;
  }

  /** 三条（有摄像头 / 没被拒 / 接口在）全过才把按钮挂上去 */
  function 亮出相机() {
    if (相机在了) return Promise.resolve(true);
    探测中 ??= Promise.resolve()
      .then(() => 探测())
      .catch(() => false)
      .then((行) => {
        探测中 = null;
        if (!行 || 相机在了) return 相机在了;
        相机在了 = true;
        钮排.appendChild(相机键);
        return true;
      });
    return 探测中;
  }

  async function 看一看() {
    if (!相机在了) return false;
    眼睛 ??= 造看见({ 说: 说给看见, 音效, 场景: 场景(), 开口白: 纸样话().举起来吧 });
    if (!眼睛) return false;
    const 果 = await 眼睛.开();
    if (果.ok) return true;
    // 爸妈点了「不允许」，或者摄像头这会儿不在了 —— 这两种是「往后也开不了」，按钮当场撤掉。
    // 留着它孩子会一直点，一直没反应，那就成了一个坏掉的网站。
    if (果.原因 === '拒绝' || 果.原因 === '没摄像头') {
      撤掉相机();
      return false;
    }
    // 被别的程序占着、硬件报错 —— 这是**暂时**开不了，跟上面两种不同：按钮留着可重试，
    // 但一定要出个声，不然孩子点了 📷 什么都不发生，还当是自己把网站按坏了。
    if (果.原因 === '开不了') 说(纸样话().相机开不了);
    // '过期'（授权对话框还开着孩子就切走了）：看见.js 已经把流当场关掉、没揭幕，这儿什么都不做。
    return false;
  }

  相机键.addEventListener('pointerenter', () => 念一下(举起来()));
  相机键.addEventListener('focus', () => 念一下(举起来()));
  相机键.addEventListener('click', () => {
    看一看();
  });

  打印键.addEventListener('pointerenter', () => {
    念一下(当前几何 ? 纸样话().印出来 : 纸样话().印不了);
  });
  打印键.addEventListener('focus', () => {
    念一下(当前几何 ? 纸样话().印出来 : 纸样话().印不了);
  });

  // -------------------------------------------------------------------------
  // 打印前的二次确认（同左下角「重来」的问-确认）
  // -------------------------------------------------------------------------

  let 打印问着 = false;
  let 打印问定时 = 0;

  /**
   * 打开／收起打印前那道问-确认。只有真能印时才问得起来。
   * 跟「重来」一样：确认态自己会超时收回去，别一直悬着招误点。
   */
  function 打印问(要不要) {
    打印问着 = Boolean(要不要 && 当前几何);
    打印组.classList.toggle('问着', 打印问着);
    打印确认.setAttribute('aria-hidden', 打印问着 ? 'false' : 'true');
    打印确认.inert = !打印问着;
    clearTimeout(打印问定时);
    // 那句问话念完要好几秒，留出孩子听完再想一下的工夫；跑神了就自己收回去
    if (打印问着) 打印问定时 = setTimeout(() => 打印问(false), 8000);
  }

  打印键.addEventListener('click', () => {
    if (!当前几何) {
      // 按钮 disabled 时点不到这儿，兜一手：没得印就说一句，别默默无事
      念一下(纸样话().印不了);
      return;
    }
    if (打印问着) {
      // 又拍了一下打印机：当作「先不印」，把确认收回去
      打印问(false);
      return;
    }
    打印问(true);
    说(纸样话().打印问);
  });

  要印.addEventListener('click', () => {
    打印问(false);
    印(); // 印() 自己会念「剪下来…」再真的 window.print()
  });

  不印.addEventListener('click', () => {
    打印问(false);
    说(纸样话().先不印);
  });

  // 点到别处、按 Esc 都算「先不印」—— 悬着的确认键是误点的温床（同「重来」）。
  // pointerdown 比 click 早：点在确认组自己身上得先放过，不然那一下 click 会落空。
  const 打印点了别处 = (事件) => {
    if (打印问着 && !打印组.contains(事件.target)) 打印问(false);
  };
  const 打印按了键 = (事件) => {
    if (事件.key === 'Escape' && 打印问着) 打印问(false);
  };
  window.addEventListener('pointerdown', 打印点了别处);
  window.addEventListener('keydown', 打印按了键);

  // 换到这个面板就重新拿一次衣服 —— 孩子刚在沙盒里改过格子，这儿得是最新那件。
  //
  // 两条路都留着，谁也不用改别人的文件：
  //   订阅：票 04 的导航专门为「票 05 / 06 / 07 进场」留的钩子，同步、准；
  //   盯 class：万一没有导航（单独跑这个模块、写测试）也照样醒得过来。
  let 在前过 = 容器.classList.contains('在前');
  function 也许进来了() {
    const 在前 = 容器.classList.contains('在前');
    const 刚进来 = 在前 && !在前过;
    const 刚走开 = !在前 && 在前过;
    在前过 = 在前;
    if (刚进来) 进来了();
    if (刚走开) 离开了();
    return 刚进来;
  }

  const 退订 = window.__导航?.订阅?.(() => 也许进来了()) ?? null;

  // 「重来」按钮就在左下角，站在这个面板上也点得着，一点沙盒里那件衣服就没了。
  // 不跟着刷新的话，纸上还摆着刚被擦掉的那件，孩子照样能把它印出来。
  //
  // 排到微任务里再刷：擦格子纸的是另一个听众，谁先谁后由谁先订阅决定，
  // 我们不能指望自己排在后面。等这一轮听众全跑完再去取衣服，取到的才是擦干净之后的。
  // 不说话 —— 重来自己已经说过一句了。
  const 退订重来 = window.__重来?.订阅重来?.(() => queueMicrotask(刷新)) ?? null;

  const 盯着 = new MutationObserver((记录) => {
    // MutationObserver 是攒着一批一起送的：一口气切走再切回来，
    // 回调跑起来时 class 早就变回「在前」了，只看当下会漏掉这一次进场。
    // 所以还要翻一翻这批记录里有没有哪一刻是不在前的。
    const 中间离开过 = 记录.some(
      (条) => !(条.oldValue ?? '').split(/\s+/).includes('在前'),
    );
    if (中间离开过) 在前过 = false;
    也许进来了();
  });
  盯着.observe(容器, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });

  if (在前过) 进来了();
  else {
    刷新();
    // 页面一起来就问一次：孩子切过来的时候按钮已经在那儿了，不会当着他的面冒出来
    亮出相机();
  }

  /**
   * 换了语言：两个按钮的读屏标签重挂，取景幕整个拆掉重来。
   *
   * 拆取景幕是因为它是**带着 `场景` 建出来的** —— 那句提示词决定了模型用哪种语言
   * 夸孩子。留着旧的，英文课上举起盒子听见的会是一句中文。它本来也是懒建的
   * （孩子不点相机就一分钱不花），拆了下次点的时候按新语言重建就行。
   */
  const 退订语言 = 订阅语言(() => {
    打印键.setAttribute('aria-label', 纸样话().印出来);
    要印.setAttribute('aria-label', 选({ cn: '真的印', en: 'Yes, print it' }));
    不印.setAttribute('aria-label', 选({ cn: '先不印', en: 'Not now' }));
    相机键.setAttribute('aria-label', 选({ cn: '举给方方看', en: 'Show it to Fangfang' }));
    眼睛?.关?.();
    眼睛?.dispose?.();
    眼睛 = null;
  });

  return {
    元素: 壳,
    打印键,
    相机键,
    刷新,
    印,
    // main.js 切到这个玩法时叫的就是它（导航订阅那条路进不来时的正路）
    进场: 进来了,
    离场: 离开了,
    /** 刚换了语言：用新语言把「现在能不能印」重讲一遍（main.js 只叫在台上的那一个） */
    重读指令() {
      if (!容器.classList.contains('在前')) return false;
      if (当前几何) 说(纸样话().纸样在这儿);
      else if ((取格子() ?? []).length === 0) 说(纸样话().先去画一件);
      else 说(纸样话().先折得上);
      return true;
    },
    看一看,
    get 几何() {
      return 当前几何;
    },
    get 能印() {
      return Boolean(当前几何);
    },
    get 有相机() {
      return 相机在了;
    },
    get 眼睛() {
      return 眼睛;
    },
    dispose() {
      盯着.disconnect();
      退订?.();
      退订重来?.();
      退订语言();
      clearTimeout(打印问定时);
      window.removeEventListener('pointerdown', 打印点了别处);
      window.removeEventListener('keydown', 打印按了键);
      眼睛?.dispose?.();
    },
  };
}
