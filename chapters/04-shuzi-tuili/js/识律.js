// 识律 —— 认本讲教的三族数字规律。纯模块：无 DOM/网络，node 直接测（票 06）。
//
// 三族：
//   等差    差恒定（含负差、跳步）：1 2 3 4 / 10 8 6 4 / 2 5 8 11
//   差递增  差本身成等差：2 3 5 8（差 1 2 3）/ 1 2 4 7 11（差 1 2 3 4）
//   交替    隔项两条线，各自恒定或等差：3 1 3 2 3 3 3 4 / 10 2 10 4 10 6 10 8
//
// 出题官用它「认出规律就夸好题、认不出照样发星」；找错车厢用它反向验证题库。
// 判族优先级 等差 > 交替 > 差递增（取最简解释）；认不出返回 null，绝不抛。

const 是整数列 = (a) => Array.isArray(a) && a.length >= 1 && a.every((x) => Number.isInteger(x));

/** 一串数是不是等差（差恒定），是则返回差，否则 null。至少 3 项才算数。 */
function 查等差(a) {
  if (a.length < 3) return null;
  const d = a[1] - a[0];
  for (let i = 2; i < a.length; i += 1) if (a[i] - a[i - 1] !== d) return null;
  return d;
}

/** 相邻差数组 */
function 差们(a) {
  const 出 = [];
  for (let i = 1; i < a.length; i += 1) 出.push(a[i] - a[i - 1]);
  return 出;
}

/**
 * 识律(数列) → {族, ...} | null。
 *   等差   → { 族:'等差', 差 }
 *   差递增 → { 族:'差递增', 差增, 首差 }
 *   交替   → { 族:'交替', 组:[{差}, {差}] }  组[0] 管偶数位、组[1] 管奇数位
 */
export function 识律(数列) {
  if (!是整数列(数列) || 数列.length < 3) return null;

  // 1) 等差（最简，优先）
  const d = 查等差(数列);
  if (d !== null) return { 族: '等差', 差: d };

  // 2) 交替：隔项两条线，各自等差（含恒定）。要够长才敢认 —— 否则 4 项的差递增
  //    会被「两条各两项」的假交替偷走（2 3 5 8：A=2,5 B=3,8 各自「等差」但那是差递增）。
  if (数列.length >= 5) {
    const 偶 = 数列.filter((_, i) => i % 2 === 0);
    const 奇 = 数列.filter((_, i) => i % 2 === 1);
    const 交 = 查交替线(偶, 奇);
    if (交) return { 族: '交替', 组: 交 };
  }

  // 3) 差递增：差本身成等差，且差增 ≠ 0（差增 0 就是等差，已在上面认掉）
  if (数列.length >= 4) {
    const dd = 查等差(差们(数列)) ?? 恒定差增(差们(数列));
    if (dd !== null && dd !== 0) {
      return { 族: '差递增', 差增: dd, 首差: 数列[1] - 数列[0] };
    }
  }

  return null;
}

/** 差数组只有两项时 查等差 会因「不足 3 项」回 null；差递增最短是 4 项数列（3 个差）。 */
function 恒定差增(差数组) {
  if (差数组.length < 2) return null;
  const e = 差数组[1] - 差数组[0];
  for (let i = 2; i < 差数组.length; i += 1) if (差数组[i] - 差数组[i - 1] !== e) return null;
  return e;
}

/** 两条隔项线各自「恒定或等差」，且够长可信（至少一条 ≥3 项）才算交替。 */
function 查交替线(偶, 奇) {
  if (偶.length < 2 || 奇.length < 2) return null;
  if (Math.max(偶.length, 奇.length) < 3) return null;
  const da = 线差(偶);
  const db = 线差(奇);
  if (da === null || db === null) return null;
  return [{ 差: da }, { 差: db }];
}

/** 一条线的恒定差：恒定→0、等差→那个差；不规律→null。1~2 项时取首尾差（含 0）。 */
function 线差(线) {
  if (线.length === 1) return 0;
  const d = 线[1] - 线[0];
  for (let i = 2; i < 线.length; i += 1) if (线[i] - 线[i - 1] !== d) return null;
  return d;
}

/** 从当前数列往下推一个（内部用，规律已知）。 */
function 推一个(work, 规律) {
  const n = work.length;
  if (规律.族 === '等差') return work[n - 1] + 规律.差;
  if (规律.族 === '差递增') {
    const 末差 = work[n - 1] - work[n - 2];
    return work[n - 1] + 末差 + 规律.差增;
  }
  // 交替：下一位的奇偶决定接哪条线；同线上一项在 n-2
  const 线 = n % 2;
  return work[n - 2] + 规律.组[线].差;
}

/**
 * 补下(数列, 个数=1) → 接着往下的那几个数（数组），认不出规律给 null。
 * 出题官用它自动出「盖哪节」，找错车厢用它验证唯一解。
 */
export function 补下(数列, 个数 = 1) {
  const 规律 = 识律(数列);
  if (!规律) return null;
  const work = [...数列];
  const 出 = [];
  for (let i = 0; i < 个数; i += 1) {
    const v = 推一个(work, 规律);
    出.push(v);
    work.push(v);
  }
  return 出;
}
