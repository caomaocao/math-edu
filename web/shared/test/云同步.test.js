import { test } from 'node:test';
import assert from 'node:assert/strict';
import { 规划同步, 不同, 取云端payload } from '../js/云同步.js';

/*
  云同步.js 的算术核心 —— 逐键合并调度、「该不该回推」、深比较。

  这几个是纯逻辑（不碰 DOM/网络/localStorage），所以进这个 node 测试席；拉/推/防抖/
  sendBeacon/监听那些 UI-shaped 的活儿按家规浏览器手验，不在这儿 mock。

  真正的 合并(本地, 云端) 是各讲的纯函数（06/07 实现并各自测），这里用一个**假的合并**
  只验调度：给它一份本地、一份云端，看 规划同步 有没有把两边正确喂进去、有没有按
  「合并后 vs 本地」「合并后 vs 云端」算对 该收编 / 该推。
*/

// ── 不同 / 深等 ──────────────────────────────────────────────────────────────

test('不同：同一份内容判为相同（原始值）', () => {
  assert.equal(不同(1, 1), false);
  assert.equal(不同('a', 'a'), false);
  assert.equal(不同(null, null), false);
  assert.equal(不同(true, true), false);
});

test('不同：对象不看键序（合并产出的键序和云端存的未必一致，不算不同）', () => {
  assert.equal(不同({ 星: {}, 柜: {} }, { 柜: {}, 星: {} }), false);
  assert.equal(不同({ a: 1, b: 2 }, { b: 2, a: 1 }), false);
});

test('不同：数组看顺序（沙盒格子 [a,b] 和 [b,a] 是不同的进度）', () => {
  assert.equal(不同([1, 2], [1, 2]), false);
  assert.equal(不同([1, 2], [2, 1]), true);
});

test('不同：嵌套结构逐层比', () => {
  const 甲 = { 图鉴: { 已解锁: ['红', '蓝'] }, 判断关: { 作答: { 1: true } } };
  const 乙 = { 判断关: { 作答: { 1: true } }, 图鉴: { 已解锁: ['红', '蓝'] } };
  assert.equal(不同(甲, 乙), false);
  const 丙 = { 图鉴: { 已解锁: ['红'] }, 判断关: { 作答: { 1: true } } };
  assert.equal(不同(甲, 丙), true);
});

test('不同：null 与对象、少一个键、值不同都算不同', () => {
  assert.equal(不同(null, {}), true);
  assert.equal(不同({ a: 1 }, { a: 1, b: 2 }), true);
  assert.equal(不同({ a: 1 }, { a: 2 }), true);
  assert.equal(不同({ a: undefined }, {}), true); // 一边有键（值 undefined）一边没这个键
});

// ── 取云端payload ────────────────────────────────────────────────────────────

test('取云端payload：从 {存储键:{payload,updated_at}} 里剥出 payload', () => {
  const 云端全部 = {
    'ch:v1': { payload: { 星: { a: true } }, updated_at: '2026-08-03T00:00:00+00:00' },
  };
  assert.deepEqual(取云端payload(云端全部, 'ch:v1'), { 星: { a: true } });
});

test('取云端payload：云端没这个键（另一台设备没玩过这一讲）→ null', () => {
  assert.equal(取云端payload({ '别的键': { payload: {} } }, 'ch:v1'), null);
  assert.equal(取云端payload({}, 'ch:v1'), null);
  assert.equal(取云端payload(null, 'ch:v1'), null); // GET 失败传了个非对象也不炸
  assert.equal(取云端payload(undefined, 'ch:v1'), null);
});

// ── 规划同步：调度骨架（用假的合并）──────────────────────────────────────────

/** 一个「并集只增不减」味道的假合并，够验调度就行；真的语义在 06/07 各自测。 */
const 假合并并集 = (本地, 云端) => {
  const 甲 = (本地 && 本地.星) || {};
  const 乙 = (云端 && 云端.星) || {};
  return { 星: { ...乙, ...甲 } };
};

const 读本地从表 = (表) => (键) => (键 in 表 ? 表[键] : null);

test('规划同步：云端有本地无 —— 合并后落地（该收编），不必回推（合并后=云端）', () => {
  const 登记项们 = [{ 存储键: 'ch:v1', 合并: 假合并并集 }];
  const 读本地 = 读本地从表({}); // 本地这个键 = null
  const 云端全部 = { 'ch:v1': { payload: { 星: { a: true } } } };

  const 计划 = 规划同步(登记项们, 读本地, 云端全部);
  assert.equal(计划.length, 1);
  assert.deepEqual(计划[0].合并后, { 星: { a: true } });
  assert.equal(计划[0].该收编, true); // 本地是 null，合并后有东西 → 要写回本地
  assert.equal(计划[0].该推, false); // 合并后 == 云端 → 不必回推
});

test('规划同步：本地有云端无 —— 不必收编（合并后=本地），要回推', () => {
  const 登记项们 = [{ 存储键: 'ch:v1', 合并: 假合并并集 }];
  const 读本地 = 读本地从表({ 'ch:v1': { 星: { a: true } } });
  const 云端全部 = {}; // 云端没有这个键

  const 计划 = 规划同步(登记项们, 读本地, 云端全部);
  assert.deepEqual(计划[0].合并后, { 星: { a: true } });
  assert.equal(计划[0].该收编, false); // 合并后 == 本地
  assert.equal(计划[0].该推, true); // 云端为 null，合并后有东西 → 回推（存量进度首登即上云）
});

test('规划同步：双方都有且不相交 —— 并集既不等于本地也不等于云端，既收编又回推', () => {
  const 登记项们 = [{ 存储键: 'ch:v1', 合并: 假合并并集 }];
  const 读本地 = 读本地从表({ 'ch:v1': { 星: { a: true } } });
  const 云端全部 = { 'ch:v1': { payload: { 星: { b: true } } } };

  const 计划 = 规划同步(登记项们, 读本地, 云端全部);
  assert.deepEqual(计划[0].合并后, { 星: { a: true, b: true } });
  assert.equal(计划[0].该收编, true); // 并集 ≠ 本地
  assert.equal(计划[0].该推, true); // 并集 ≠ 云端
});

test('规划同步：本地云端完全一致 —— 既不收编也不回推（开机不白折腾）', () => {
  const 登记项们 = [{ 存储键: 'ch:v1', 合并: 假合并并集 }];
  const 读本地 = 读本地从表({ 'ch:v1': { 星: { a: true } } });
  const 云端全部 = { 'ch:v1': { payload: { 星: { a: true } } } };

  const 计划 = 规划同步(登记项们, 读本地, 云端全部);
  assert.equal(计划[0].该收编, false);
  assert.equal(计划[0].该推, false);
});

test('规划同步：多个键各算各的，一份 GET 拿全后逐键调度', () => {
  const 登记项们 = [
    { 存储键: 'a', 合并: 假合并并集 },
    { 存储键: 'b', 合并: 假合并并集 },
  ];
  const 读本地 = 读本地从表({ a: { 星: { x: true } } }); // a 本地有、b 本地无
  const 云端全部 = { b: { payload: { 星: { y: true } } } }; // b 云端有、a 云端无

  const 计划 = 规划同步(登记项们, 读本地, 云端全部);
  const 按键 = Object.fromEntries(计划.map((p) => [p.存储键, p]));
  assert.equal(按键.a.该推, true); // a 只在本地 → 回推
  assert.equal(按键.a.该收编, false);
  assert.equal(按键.b.该收编, true); // b 只在云端 → 收编落地
  assert.equal(按键.b.该推, false);
});

test('规划同步：某讲合并抛错，这一键跳过，别的键照常', () => {
  const 登记项们 = [
    { 存储键: 'good', 合并: 假合并并集 },
    { 存储键: 'bad', 合并: () => { throw new Error('这讲合并炸了'); } },
  ];
  const 读本地 = 读本地从表({ good: { 星: { a: true } } });
  const 云端全部 = {};

  const 计划 = 规划同步(登记项们, 读本地, 云端全部);
  assert.equal(计划.length, 1); // bad 被跳过
  assert.equal(计划[0].存储键, 'good');
});

test('规划同步：合并函数确实拿到本地与云端两份原料（喂参正确）', () => {
  let 收到;
  const 登记项们 = [{
    存储键: 'ch:v1',
    合并: (本地, 云端) => { 收到 = { 本地, 云端 }; return 本地 ?? 云端; },
  }];
  const 读本地 = 读本地从表({ 'ch:v1': { 星: { a: true } } });
  const 云端全部 = { 'ch:v1': { payload: { 星: { b: true } } } };

  规划同步(登记项们, 读本地, 云端全部);
  assert.deepEqual(收到.本地, { 星: { a: true } });
  assert.deepEqual(收到.云端, { 星: { b: true } });
});

test('规划同步：空登记表 / 缺省合并都不炸', () => {
  assert.deepEqual(规划同步([], () => null, {}), []);
  assert.deepEqual(规划同步(undefined, () => null, {}), []);
  // 登记项没带合并：缺省成原样返回本地，云端有本地无时正常收编
  const 计划 = 规划同步(
    [{ 存储键: 'ch:v1' }],
    () => null,
    { 'ch:v1': { payload: { 星: {} } } },
  );
  assert.equal(计划[0].该收编, false); // 缺省合并返回本地(null)，与云端不同但合并后=本地=null
  assert.deepEqual(计划[0].合并后, null);
});
