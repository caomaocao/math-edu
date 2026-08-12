import test from 'node:test';
import assert from 'node:assert/strict';

import { 开一锅, 排队几人 } from '../js/发饭.js';
import { 排轮们, 实体们 as 虫站实体们 } from '../js/站/松果虫虫站.js';
import { 实体们 as 分饭实体们 } from '../js/站/分饭站.js';
import { 实体们 as 蛋糕实体们 } from '../js/站/蛋糕派对.js';
import { 摆放配 } from '../js/组件.js';
import { 站点表 } from '../js/站点表.js';

/*
  票 06 的三站：分饭站 / 蛋糕派对（发饭模式）+ 松果虫虫站（正反混练）。
  这儿咬两件事：发饭的纯逻辑锅账（谁吃上了、锅空即提交的那本账），和
  站点数据全由 站点表 台账推出（排轮们 是纯函数，数值对不上台账立刻红）。
  台面、点击、报数流程是 DOM 形状的，按家规真机手验。
*/

const 账 = Object.fromEntries(站点表.map((条) => [条.号, 条.台账]));

// ── 发饭纯逻辑：开一锅 ───────────────────────────────────────────────────────

test('开一锅：共/每人 要正整数，且共能被每人整除（发到锅空正好分完）', () => {
  assert.throws(() => 开一锅({ 共: 0, 每人: 2 }), /正整数/);
  assert.throws(() => 开一锅({ 共: 8, 每人: 0 }), /正整数/);
  assert.throws(() => 开一锅({ 共: 8.5, 每人: 2 }), /正整数/);
  assert.throws(() => 开一锅({ 共: 8, 每人: '2' }), /正整数/);
  assert.throws(() => 开一锅({ 共: 8, 每人: 3 }), /整除/);
  assert.doesNotThrow(() => 开一锅({ 共: 8, 每人: 2 }));
});

test('开一锅：发一份少一份，发到锅空；已发的再发是「已经有了」', () => {
  const 锅 = 开一锅({ 共: 8, 每人: 2 });
  assert.equal(锅.锅剩(), 8);
  assert.equal(锅.空了(), false);

  assert.equal(锅.发给(0), '发了');
  assert.equal(锅.锅剩(), 6);
  assert.equal(锅.吃上了(0), true);
  assert.equal(锅.发给(0), '已经有了');
  assert.equal(锅.锅剩(), 6, '重复发不该多扣');

  锅.发给(1); 锅.发给(2); 锅.发给(3);
  assert.equal(锅.锅剩(), 0);
  assert.equal(锅.空了(), true);
  assert.equal(锅.吃上几人(), 4, '8 碗每人 2 碗，锅空时正是台账的 4 人');
  assert.equal(锅.发给(4), '没饭了');
  assert.equal(锅.吃上几人(), 4);
});

test('开一锅：点已发的收回，那份回锅，还能再发给别人', () => {
  const 锅 = 开一锅({ 共: 8, 每人: 4 });
  锅.发给(0); 锅.发给(1);
  assert.equal(锅.空了(), true);

  assert.equal(锅.收回(2), false, '没吃上的无份可收');
  assert.equal(锅.收回(0), true);
  assert.equal(锅.空了(), false);
  assert.equal(锅.锅剩(), 4);
  assert.equal(锅.吃上了(0), false);

  assert.equal(锅.发给(3), '发了');
  assert.equal(锅.空了(), true);
  assert.equal(锅.吃上几人(), 2, 'B 轮每人 4 碗，锅空时正是台账的 2 人');
});

// ── 发饭两站的题面：从台账推，排队要比吃得上的多 ─────────────────────────────

test('分饭站：两轮都发同一锅 8 碗、锅正好分完，排队人数多于答案数', () => {
  const { 共, 轮们 } = 账.分饭站;
  for (const 轮 of 轮们) {
    assert.equal(共 % 轮.每人, 0);
    assert.equal(共 / 轮.每人, 轮.答);
    assert.ok(排队几人(轮.答) > 轮.答, '排队的小朋友要比吃得上的多（票面）');
  }
});

test('蛋糕派对：20 块每人 4 块正好分完，排队人数多于答案数', () => {
  const { 共, 每人, 答 } = 账.蛋糕派对;
  assert.equal(共 % 每人, 0);
  assert.equal(共 / 每人, 答);
  assert.ok(排队几人(答) > 答);
});

// ── 松果虫虫站：三轮题面全由台账推出 ─────────────────────────────────────────

test('排轮们：三轮各四格，第 0 格样例已给、后三格空着要孩子摆', () => {
  const 轮们 = 排轮们(账.松果虫虫站.小题们);
  assert.equal(轮们.length, 3);
  for (const 轮 of 轮们) {
    assert.equal(轮.题.值们.length, 4);
    assert.equal(轮.标.数们.length, 4);
    assert.deepEqual(轮.题.空, [1, 2, 3], '样例格不空，其余全要孩子摆');
    assert.ok(typeof 轮.话键 === 'string' && 轮.话键);
  }
});

test('排轮们⑴ 正向：题眼是松鼠（1/2/4/6 只），格里摆松果，颗数 = 只数 × 每只', () => {
  const [松鼠轮] = 排轮们(账.松果虫虫站.小题们);
  const { 每只, 只数们, 答们 } = 账.松果虫虫站.小题们[0];
  assert.equal(松鼠轮.反向, false);
  assert.equal(松鼠轮.标.实体, '松鼠');
  assert.equal(松鼠轮.题.实体, '松果');
  assert.equal(松鼠轮.标.每堆, 0, '正向轮题眼不扎堆');
  assert.deepEqual(松鼠轮.标.数们, [1, ...只数们]);
  assert.deepEqual(松鼠轮.题.值们, [每只, ...答们]);
  松鼠轮.标.数们.forEach((只, i) => assert.equal(松鼠轮.题.值们[i], 只 * 每只));
});

test('排轮们⑵ 反向：题眼是骨头按 4 根一堆，格里摆小狗，只数 = 根数 ÷ 每只', () => {
  const [, 骨头轮] = 排轮们(账.松果虫虫站.小题们);
  const { 每只, 根数们, 答们 } = 账.松果虫虫站.小题们[1];
  assert.equal(骨头轮.反向, true);
  assert.equal(骨头轮.标.实体, '骨头');
  assert.equal(骨头轮.题.实体, '小狗');
  assert.equal(骨头轮.标.每堆, 每只, '反向轮题眼按每只的份扎堆（错 2 圈亮分堆吃这个）');
  assert.deepEqual(骨头轮.标.数们, [每只, ...根数们]);
  assert.deepEqual(骨头轮.题.值们, [1, ...答们]);
  骨头轮.标.数们.forEach((根, i) => assert.equal(骨头轮.题.值们[i] * 每只, 根));
});

test('排轮们⑶ 反向：题眼是毛毛虫按 3 条一堆，格里摆公鸡（素材名 公鸡）', () => {
  const [, , 毛毛虫轮] = 排轮们(账.松果虫虫站.小题们);
  const { 每只, 条数们, 答们 } = 账.松果虫虫站.小题们[2];
  assert.equal(毛毛虫轮.反向, true);
  assert.equal(毛毛虫轮.标.实体, '毛毛虫');
  assert.equal(毛毛虫轮.题.实体, '公鸡');
  assert.equal(毛毛虫轮.标.每堆, 每只);
  assert.deepEqual(毛毛虫轮.标.数们, [每只, ...条数们]);
  assert.deepEqual(毛毛虫轮.题.值们, [1, ...答们]);
  毛毛虫轮.标.数们.forEach((条数, i) => assert.equal(毛毛虫轮.题.值们[i] * 每只, 条数));
});

test('最大 18 颗松果顶到 摆放配.上限，一颗不多一颗不少', () => {
  const [松鼠轮] = 排轮们(账.松果虫虫站.小题们);
  assert.equal(Math.max(...松鼠轮.题.值们), 摆放配.上限,
    '上限 18 就是为这站的顶（spec：容器上限 18 靠票 01 注入）');
});

// ── 实体们：预热与覆盖同吃的那个接缝 ─────────────────────────────────────────

test('三站的 实体们 如票所列', () => {
  assert.deepEqual(分饭实体们, ['米饭', '小朋友']);
  assert.deepEqual(蛋糕实体们, ['蛋糕块', '小朋友']);
  assert.deepEqual(虫站实体们, ['松鼠', '松果', '骨头', '小狗', '毛毛虫', '公鸡']);
});
