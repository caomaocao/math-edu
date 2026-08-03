import test from 'node:test';
import assert from 'node:assert/strict';

import { canClose, foldResult, isNet, orientations, 对面 } from '../src/domain/net.js';
import { cellStyle } from '../src/domain/palette.js';
import {
  纸张朝向,
  纸样SVG,
  纸样几何,
  算粘贴边,
  粘贴边深,
  能打印,
  格子边长,
  外边,
  外边配对,
  放得下,
  方向次序,
} from '../src/ui/printSheet.js';
import { allHexominoes } from './hexominoes.js';

/** 六格骨牌只有 row/col，补上颜色槽位，跟孩子在格子纸上涂出来的那份长一样 */
const 上色 = (cells) => cells.map((c, i) => ({ row: c.row, col: c.col, 槽位: i }));

const 能合上的 = allHexominoes().filter(canClose).map(上色);
const 穿不上的 = allHexominoes().filter((c) => !canClose(c)).map(上色);

const 边的键 = (边) => `${边.格子下标}${边.方向}`;

test('原料：11 种能合上，24 种穿不上', () => {
  assert.equal(能合上的.length, 11);
  assert.equal(穿不上的.length, 24);
});

// ---------------------------------------------------------------------------
// 只对能合上的衣服开放打印
// ---------------------------------------------------------------------------

test('穿不上的形状一概不给印 —— 剪半天粘不上比不给印挫败得多', () => {
  for (const cells of 穿不上的) {
    assert.equal(能打印(cells), false, `这张穿不上却放行了：${JSON.stringify(cells)}`);
    assert.throws(() => 纸样几何(cells));
    assert.throws(() => 外边配对(cells));
  }
});

test('画不满六格、格子没连起来，也不给印', () => {
  assert.equal(能打印([]), false);
  assert.equal(能打印(上色([{ row: 0, col: 0 }])), false);
  // 五格连着 + 一格孤零零飘在外面：格数够了，但不是一张衣服
  const 断开 = 上色([
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
    { row: 1, col: 0 },
    { row: 1, col: 1 },
    { row: 3, col: 4 },
  ]);
  assert.ok(!isNet(断开));
  assert.equal(能打印(断开), false);
});

test('11 种能合上的衣服，每一种都印得出来', () => {
  for (const cells of 能合上的) assert.equal(能打印(cells), true);
});

// ---------------------------------------------------------------------------
// 外边和它们的配对
// ---------------------------------------------------------------------------

test('一张衣服有 14 条外边 —— 24 条边减掉 5 条折痕吃掉的 10 条', () => {
  for (const cells of 能合上的) {
    const 边 = 外边(cells);
    assert.equal(边.length, 14);
    assert.equal(new Set(边.map(边的键)).size, 14, '同一条边不能数两遍');
  }
});

test('14 条外边正好两两配成 7 对，每条只属于一对', () => {
  for (const cells of 能合上的) {
    const 配对 = 外边配对(cells);
    // 正方体 12 条棱，5 条是折痕，剩下 7 条要粘
    assert.equal(配对.length, 7);

    const 用过 = new Map();
    for (const 一对 of 配对) {
      assert.equal(一对.length, 2);
      for (const 边 of 一对) {
        assert.ok(!用过.has(边的键(边)), `外边 ${边的键(边)} 被配了两次`);
        用过.set(边的键(边), true);
      }
    }
    assert.equal(用过.size, 14, '14 条外边必须一条不落全配上对');
    assert.deepEqual([...用过.keys()].sort(), 外边(cells).map(边的键).sort());
  }
});

test('配成一对的两条边，来自折起来之后互为邻面的两个格子（不是同一格，也不是对面）', () => {
  for (const cells of 能合上的) {
    const 结果 = foldResult(cells);
    for (const [甲, 乙] of 外边配对(cells)) {
      assert.notEqual(甲.格子下标, 乙.格子下标, '一条棱上不会贴着同一个面的两条边');
      const 面甲 = 结果.faces[甲.格子下标];
      const 面乙 = 结果.faces[乙.格子下标];
      assert.notEqual(面甲, 面乙);
      assert.notEqual(对面(面甲), 面乙, '对面碰不到一块儿，粘不上');
    }
  }
});

test('要粘的那两条边，在平面上不是挨着的一对折痕 —— 折痕不用粘', () => {
  for (const cells of 能合上的) {
    for (const [甲, 乙] of 外边配对(cells)) {
      const a = cells[甲.格子下标];
      const b = cells[乙.格子下标];
      const 挨着 = Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
      assert.ok(!挨着, '挨着的两格中间是折痕，不该出现在要粘的那 7 对里');
    }
  }
});

// ---------------------------------------------------------------------------
// 粘贴边（小耳朵）—— 这一票最容易做错的一条
// ---------------------------------------------------------------------------

test('每条要粘的边，有且只有一侧带小耳朵', () => {
  for (const cells of 能合上的) {
    const 耳朵 = 算粘贴边(cells);
    assert.equal(耳朵.length, 7, '7 条要粘的棱，7 只耳朵');

    const 带耳朵的 = new Set(耳朵.map(边的键));
    assert.equal(带耳朵的.size, 7, '同一条边上不能长两只耳朵');

    for (const [甲, 乙] of 外边配对(cells)) {
      const 甲带 = 带耳朵的.has(边的键(甲));
      const 乙带 = 带耳朵的.has(边的键(乙));
      assert.ok(
        甲带 !== 乙带,
        `${边的键(甲)} 和 ${边的键(乙)} 要粘在一起，却${甲带 ? '两边都有' : '两边都没有'}耳朵`,
      );
    }
  }
});

test('小耳朵记着自己该粘到哪条边上，而且那条边确实是它的对家', () => {
  for (const cells of 能合上的) {
    const 配对 = new Map();
    for (const [甲, 乙] of 外边配对(cells)) {
      配对.set(边的键(甲), 边的键(乙));
      配对.set(边的键(乙), 边的键(甲));
    }
    for (const 一个 of 算粘贴边(cells)) {
      assert.equal(配对.get(边的键(一个)), 边的键(一个.对家));
    }
  }
});

test('带耳朵的 7 条 + 光边的 7 条 = 全部 14 条外边，不重不漏', () => {
  for (const cells of 能合上的) {
    const 全部 = 外边(cells).map(边的键).sort();
    const 带耳朵的 = 算粘贴边(cells).map(边的键);
    const 光边 = 全部.filter((键) => !带耳朵的.includes(键));
    assert.equal(带耳朵的.length, 7);
    assert.equal(光边.length, 7);
    assert.deepEqual([...带耳朵的, ...光边].sort(), 全部);
  }
});

test('同一张衣服每次算出来的耳朵都长在同一处 —— 印两遍是同一张纸样', () => {
  for (const cells of 能合上的) {
    assert.deepEqual(算粘贴边(cells), 算粘贴边(cells.map((c) => ({ ...c }))));
  }
});

test('耳朵匀着长，不会全挤在一个格子上', () => {
  for (const cells of 能合上的) {
    const 每格 = new Array(6).fill(0);
    for (const 一个 of 算粘贴边(cells)) 每格[一个.格子下标]++;
    assert.ok(Math.max(...每格) <= 3, `有个格子上挂了 ${Math.max(...每格)} 只耳朵，太挤`);
  }
});

// ---------------------------------------------------------------------------
// 配对是**算**出来的，不是查表 —— 这一条塌了，孩子转个方向画同一件衣服就印错
// ---------------------------------------------------------------------------

test('把衣服转个方向、翻个面（8 种摆法），照样算得出 7 对、7 只耳朵', () => {
  for (const cells of 能合上的) {
    const 摆法 = orientations(cells.map((c) => ({ row: c.row, col: c.col })));
    assert.equal(摆法.length, 8, '八种摆法一个都不能少');
    for (const 一种 of 摆法) {
      const 这张 = 上色(一种);
      assert.equal(能打印(这张), true);
      assert.equal(外边配对(这张).length, 7);

      const 耳朵 = 算粘贴边(这张);
      assert.equal(耳朵.length, 7);
      const 带耳朵的 = new Set(耳朵.map(边的键));
      for (const [甲, 乙] of 外边配对(这张)) {
        assert.ok(
          带耳朵的.has(边的键(甲)) !== 带耳朵的.has(边的键(乙)),
          '换个摆法之后一对边上长了两只耳朵（或者一只都没有）',
        );
      }
    }
  }
});

test('衣服在格子纸上挪个位置，算出来的配对一模一样 —— 只看形状，不看它画在哪儿', () => {
  for (const cells of 能合上的) {
    const 挪开 = cells.map((c) => ({ ...c, row: c.row + 3, col: c.col + 2 }));
    const 原 = 外边配对(cells).map((一对) => 一对.map(边的键));
    const 新 = 外边配对(挪开).map((一对) => 一对.map(边的键));
    assert.deepEqual(新, 原);
    assert.deepEqual(算粘贴边(挪开).map(边的键), 算粘贴边(cells).map(边的键));
  }
});

// ---------------------------------------------------------------------------
// 纸上的几何：剪切线、折痕、尺寸
// ---------------------------------------------------------------------------

const 方块 = (格) => [
  [格.x, 格.y],
  [格.x + 格.边长, 格.y],
  [格.x + 格.边长, 格.y + 格.边长],
  [格.x, 格.y + 格.边长],
];

/** 两个凸多边形压进彼此多深（≤ 0 就是只挨着或者分开，没有真的压住） */
function 压进多深(甲, 乙) {
  let 最小 = Infinity;
  for (const 多 of [甲, 乙]) {
    for (let i = 0; i < 多.length; i++) {
      const [x1, y1] = 多[i];
      const [x2, y2] = 多[(i + 1) % 多.length];
      const 长 = Math.hypot(x2 - x1, y2 - y1);
      if (长 === 0) continue;
      const nx = -(y2 - y1) / 长;
      const ny = (x2 - x1) / 长;
      const 投 = (多边形) => {
        const 值 = 多边形.map(([x, y]) => x * nx + y * ny);
        return [Math.min(...值), Math.max(...值)];
      };
      const [a1, a2] = 投(甲);
      const [b1, b2] = 投(乙);
      最小 = Math.min(最小, Math.min(a2, b2) - Math.max(a1, b1));
    }
  }
  return 最小;
}

test('折痕 12 条：5 条格子之间的 + 7 只耳朵的根（耳朵也是折进去的）', () => {
  for (const cells of 能合上的) {
    const 几何 = 纸样几何(cells);
    assert.equal(几何.折痕.filter((线) => 线.是 === '折痕').length, 5);
    assert.equal(几何.折痕.filter((线) => 线.是 === '粘贴边根').length, 7);
    assert.equal(几何.折痕.length, 12);
  }
});

test('剪切线 28 段：7 条光外边 + 7 只耳朵各 3 条外沿', () => {
  for (const cells of 能合上的) {
    const 几何 = 纸样几何(cells);
    assert.equal(几何.剪切.length, 7 + 7 * 3);
  }
});

test('同一段线不会既是剪切线又是折痕 —— 孩子分不清就白搭', () => {
  const 线键 = (线) =>
    [
      [线.x1, 线.y1],
      [线.x2, 线.y2],
    ]
      .map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`)
      .sort()
      .join('|');
  for (const cells of 能合上的) {
    const 几何 = 纸样几何(cells);
    const 折 = new Set(几何.折痕.map(线键));
    for (const 线 of 几何.剪切) {
      assert.ok(!折.has(线键(线)), '一条线同时印成实线和虚线');
    }
  }
});

test('小耳朵互相不打架，也不压到任何一个格子上 —— 剪刀一路剪得过去', () => {
  for (const cells of 能合上的) {
    const 几何 = 纸样几何(cells);
    const 耳朵 = 几何.粘贴边.map((一个) => 一个.点);
    const 挨着算 = 1e-6;

    for (let i = 0; i < 耳朵.length; i++) {
      for (let j = i + 1; j < 耳朵.length; j++) {
        assert.ok(压进多深(耳朵[i], 耳朵[j]) <= 挨着算, `两只耳朵压在一起了（${i} 和 ${j}）`);
      }
      for (const 格 of 几何.格子) {
        assert.ok(压进多深(耳朵[i], 方块(格)) <= 挨着算, `耳朵 ${i} 压到了格子 ${格.下标}`);
      }
    }
  }
});

test('小耳朵不超过格子的四分之一深 —— 这是它们不打架的前提', () => {
  assert.ok(粘贴边深 <= 格子边长 / 4);
  assert.ok(粘贴边深 > 0);
});

test('边长 4–5cm，折起来是个抓得住的正方体', () => {
  assert.ok(格子边长 >= 40 && 格子边长 <= 50, `边长 ${格子边长}mm 不在 4–5cm 之间`);
});

test('真尺寸：一格 45mm、耳朵 9mm，纸上的数字就是尺子上的毫米', () => {
  // SVG 的 width 直接写成 mm，所以这两个常数错一位，孩子手上就是个错尺寸的盒子
  assert.equal(格子边长, 45);
  assert.equal(粘贴边深, 9);

  // 一条横的 1×4 加两格（141 里的一种），算出来的纸样是 4×45+18 宽、3×45+18 高
  const 一四一 = 上色([
    { row: 0, col: 1 },
    { row: 1, col: 0 },
    { row: 1, col: 1 },
    { row: 1, col: 2 },
    { row: 1, col: 3 },
    { row: 2, col: 1 },
  ]);
  assert.equal(能打印(一四一), true);
  const 几何 = 纸样几何(一四一);
  assert.equal(几何.列数, 4);
  assert.equal(几何.行数, 3);
  assert.equal(几何.宽, 4 * 45 + 9 * 2); // 198mm
  assert.equal(几何.高, 3 * 45 + 9 * 2); // 153mm
  assert.equal(几何.格子[0].边长, 45);
});

test('换个边长照样换算得对 —— 尺寸是算的，不是写死在 SVG 里的数', () => {
  const 几何 = 纸样几何(能合上的[0], { 边长: 30, 深: 6 });
  assert.equal(几何.宽, 几何.列数 * 30 + 12);
  assert.equal(几何.高, 几何.行数 * 30 + 12);
  assert.match(纸样SVG(几何), new RegExp(`width="${几何.宽}mm"`));
});

test('11 种衣服每一种都放得进一页 A4', () => {
  for (const cells of 能合上的) {
    const 几何 = 纸样几何(cells);
    assert.ok(放得下(几何), `印不下：${几何.宽}×${几何.高}mm（${纸张朝向(几何)}）`);
    // 纸样的外框正好是格子加两边的耳朵
    assert.equal(几何.宽, 几何.列数 * 格子边长 + 粘贴边深 * 2);
    assert.equal(几何.高, 几何.行数 * 格子边长 + 粘贴边深 * 2);
  }
});

test('胖的横着印，瘦的竖着印 —— 孩子手上那张跟屏幕上是同一个摆法', () => {
  for (const cells of 能合上的) {
    const 几何 = 纸样几何(cells);
    assert.equal(纸张朝向(几何), 几何.宽 > 几何.高 ? 'landscape' : 'portrait');
  }
});

test('格子按行列摆好，谁也不压谁', () => {
  for (const cells of 能合上的) {
    const 几何 = 纸样几何(cells);
    assert.equal(几何.格子.length, 6);
    for (let i = 0; i < 6; i++) {
      for (let j = i + 1; j < 6; j++) {
        assert.ok(压进多深(方块(几何.格子[i]), 方块(几何.格子[j])) <= 1e-6);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// 实物和屏幕上是同一件衣服
// ---------------------------------------------------------------------------

test('印在纸上的颜色和水果，就是孩子自己选的那一套', () => {
  const cells = 能合上的[0].map((c, i) => ({ ...c, 槽位: (i + 3) % 6 }));
  const 几何 = 纸样几何(cells);
  几何.格子.forEach((格, i) => {
    assert.equal(格.颜色, cellStyle(cells[i].槽位).color);
    assert.equal(格.水果, cellStyle(cells[i].槽位).fruit);
    assert.equal(格.row, cells[i].row);
    assert.equal(格.col, cells[i].col);
  });
});

test('六个格子六种颜色，纸上不会有两格撞色', () => {
  for (const cells of 能合上的) {
    const 几何 = 纸样几何(cells);
    assert.equal(new Set(几何.格子.map((格) => 格.颜色)).size, 6);
    assert.equal(new Set(几何.格子.map((格) => 格.水果)).size, 6);
  }
});

// ---------------------------------------------------------------------------
// 画出来的那张 SVG
// ---------------------------------------------------------------------------

test('打印用的 SVG 尺寸写成毫米，印出来就是真尺寸', () => {
  const 几何 = 纸样几何(能合上的[0]);
  const svg = 纸样SVG(几何, { 单位: '毫米' });
  assert.match(svg, new RegExp(`width="${几何.宽}mm"`));
  assert.match(svg, new RegExp(`height="${几何.高}mm"`));
  assert.match(svg, new RegExp(`viewBox="0 0 ${几何.宽} ${几何.高}"`));
});

test('颜色画在 SVG 的 fill 上，不是 CSS 背景 —— 打印对话框默认不印背景图形', () => {
  for (const cells of 能合上的) {
    const svg = 纸样SVG(纸样几何(cells));
    for (const 格 of 纸样几何(cells).格子) {
      assert.ok(svg.includes(`fill="${格.颜色}"`), `${格.颜色} 没画进 SVG`);
      assert.ok(svg.includes(格.水果), `${格.水果} 没画进 SVG`);
    }
    assert.ok(!svg.includes('background'));
  }
});

test('折痕虚线、剪切线实线，数目对得上', () => {
  const svg = 纸样SVG(纸样几何(能合上的[0]));
  const 全部线 = svg.match(/<line [^>]*\/>/g) ?? [];
  const 虚 = 全部线.filter((线) => 线.includes('stroke-dasharray'));
  const 实 = 全部线.filter((线) => !线.includes('stroke-dasharray'));
  assert.equal(虚.length, 12, '折痕该是 12 条虚线');
  assert.equal(实.length, 28, '剪切线该是 28 段实线');
});

test('纸样上一个句子都没有，只有水果', () => {
  const 汉字或字母 = /[\p{Script=Han}A-Za-z]/u;
  for (const cells of 能合上的) {
    const svg = 纸样SVG(纸样几何(cells));
    const 文字 = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
    assert.equal(文字.length, 6);
    for (const 一段 of 文字) {
      assert.ok(!汉字或字母.test(一段), `纸样上印了字：${一段}`);
    }
  }
});

test('预览用的 SVG 不写死尺寸，跟着面板缩放', () => {
  const svg = 纸样SVG(纸样几何(能合上的[0]), { 单位: '自适应' });
  assert.ok(svg.includes('width="100%"'));
  assert.ok(!svg.includes('mm"'));
});

// ---------------------------------------------------------------------------
// 方向表
// ---------------------------------------------------------------------------

test('四个方向，次序固定 —— 纸样得可复现', () => {
  assert.deepEqual([...方向次序], ['上', '右', '下', '左']);
});
