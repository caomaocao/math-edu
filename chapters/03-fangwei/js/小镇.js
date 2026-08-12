// 小镇 —— 开车关的随机小镇地图。纯模块：无 DOM、无网络，node 直接测（见 test/小镇生成.test.js）。
//
// 每次进关都现生成一座小镇：路格连成一张**连通**的网、五个站点落在随机路格上、一个随机起点。
// 约束全为「五岁孩子玩得动」服务：
//   · 连通 —— 从起点开得到每个站点，站点之间也互通（不然有的客人永远送不到）。
//   · 直行段 ≤3 格 —— 喊一声车最多开三格就停，孩子数得过来（书上闯关四也就三步之内）。
//   · 起点 + 五站六个位置两两不同 —— 谁都不叠谁。
//
// 造法：「长一片连通的短街 → 校验 → 重试」。街道刻意长成一格宽（不出现 2×2 的整块路），
// 且任一条直街最长 4 格 —— 这两条一上，上面的「直行段 ≤3」就由构造保证（4 格直街喊一声开 3 格
// 到头），几乎不用重试。浏览器用 Math.random；测试注入定死的 rng，可复现。

import { 建路网, 开车 } from '/shared/js/路网.js';

const 四邻 = [
  { 行: -1, 列: 0 }, { 行: 1, 列: 0 }, { 行: 0, 列: -1 }, { 行: 0, 列: 1 },
];
const 四向 = ['北', '南', '西', '东'];
const 键 = ({ 行, 列 }) => `${行},${列}`;
const 解键 = (k) => { const [行, 列] = k.split(',').map(Number); return { 行, 列 }; };

/** rng ∈ [0,1) → 数组里随机取一个 */
function 抽(rng, 数组) {
  return 数组[Math.floor(rng() * 数组.length)];
}

/** 加进 x 会不会凑出一整块 2×2 的路（那就成了空地，不是一格宽的街了） */
function 会成方块(路集, x) {
  const 有 = (行, 列) => (行 === x.行 && 列 === x.列) || 路集.has(`${行},${列}`);
  for (const [a, b] of [[-1, -1], [-1, 0], [0, -1], [0, 0]]) { // x 可能落在某个 2×2 的四个角之一
    const 行 = x.行 + a; const 列 = x.列 + b;
    if (有(行, 列) && 有(行, 列 + 1) && 有(行 + 1, 列) && 有(行 + 1, 列 + 1)) return true;
  }
  return false;
}

/** 加进 x 会不会让某条直街（横或竖）连通长度超过 上限：超了就拒，直街封顶 = drive 封顶 */
function 会拉长直街(路集, x, 上限) {
  for (const [d行, d列] of [[0, 1], [1, 0]]) { // 横、竖各量一次
    let 长 = 1; // x 自己
    for (const 号 of [-1, 1]) {
      let 行 = x.行 + d行 * 号; let 列 = x.列 + d列 * 号;
      while (路集.has(`${行},${列}`)) { 长 += 1; 行 += d行 * 号; 列 += d列 * 号; }
    }
    if (长 > 上限) return true;
  }
  return false;
}

/** 从一个随机起点长出一片连通的短街，长到 目标数 或长不动为止。还回路格键的 Set。 */
function 长街(行数, 列数, 目标数, rng) {
  const 路集 = new Set();
  路集.add(键({ 行: Math.floor(rng() * 行数), 列: Math.floor(rng() * 列数) }));
  while (路集.size < 目标数) {
    const 候选 = new Map(); // 键 → 格，顺带去重
    for (const k of 路集) {
      const { 行, 列 } = 解键(k);
      for (const d of 四邻) {
        const n = { 行: 行 + d.行, 列: 列 + d.列 };
        const nk = 键(n);
        if (n.行 < 0 || n.列 < 0 || n.行 >= 行数 || n.列 >= 列数) continue;
        if (路集.has(nk) || 候选.has(nk)) continue;
        if (会成方块(路集, n)) continue;
        if (会拉长直街(路集, n, 4)) continue;
        候选.set(nk, n);
      }
    }
    if (候选.size === 0) break; // 长不动了，就这么大
    路集.add(键(抽(rng, [...候选.values()])));
  }
  return 路集;
}

/** 路网里 4 邻度 ≥3 的格子数（岔口）—— 有岔口，送客路上才需要拐弯，玩起来才有意思 */
function 数岔口(路集) {
  let 数 = 0;
  for (const k of 路集) {
    const { 行, 列 } = 解键(k);
    let 度 = 0;
    for (const d of 四邻) if (路集.has(`${行 + d.行},${列 + d.列}`)) 度 += 1;
    if (度 >= 3) 数 += 1;
  }
  return 数;
}

/** 从路格里随机挑 张数 个互不相同的格（第一个当起点，其余是各站点位置） */
function 挑格(路集, 张数, rng) {
  const 余 = [...路集];
  const 出 = [];
  for (let i = 0; i < 张数; i += 1) {
    const j = Math.floor(rng() * 余.length);
    出.push(解键(余[j]));
    余.splice(j, 1);
  }
  return 出;
}

/** 直行段真的都 ≤3？拿真·开车 复核一遍（构造已保证，这里只是防呆） */
function 直行都不过三(网, 路格们) {
  for (const 格 of 路格们) {
    for (const 方 of 四向) {
      if (开车(网, 格, 方).经过.length > 3) return false;
    }
  }
  return true;
}

/** 试造一座镇；essential 不变量（连通/都在路上/两两不同/直行≤3）不满足就还回 null 让外面重试 */
function 试生成(行数, 列数, 站点数, rng) {
  const 需要 = 站点数 + 1; // 起点 + 各站
  const 目标数 = 需要 + 8 + Math.floor(rng() * 8); // 一片够走的短街：14~21 格（6×7=42 盘上宽裕）
  const 路集 = 长街(行数, 列数, 目标数, rng);
  if (路集.size < 需要) return null; // 连位置都摆不下（在 42 格盘上几乎不会发生）
  const 路格们 = [...路集].map(解键);
  const 网 = 建路网(行数, 列数, 路格们);
  if (!直行都不过三(网, 路格们)) return null; // 构造已保证，防呆
  const [起点, ...站点位置们] = 挑格(路集, 需要, rng);
  return { 路格们, 起点, 站点位置们, 岔口数: 数岔口(路集), 路数: 路集.size };
}

/**
 * 生成一座小镇。
 *
 * @param {{行数:number, 列数:number, 站点数?:number, rng?:()=>number}} 参
 * @returns {{路格们:{行,列}[], 起点:{行,列}, 站点位置们:{行,列}[]}}
 */
export function 生成小镇({ 行数, 列数, 站点数 = 5, rng = Math.random } = {}) {
  let 备选 = null; // 第一座 essential 都过的镇，最后兜底用
  for (let 试 = 0; 试 < 200; 试 += 1) {
    const 镇 = 试生成(行数, 列数, 站点数, rng);
    if (!镇) continue;
    备选 = 备选 ?? 镇;
    // 优先挑「好玩」的：有岔口、街也够长，孩子送客路上能拐几个弯
    if (镇.岔口数 >= 2 && 镇.路数 >= 站点数 + 6) return 精简(镇);
  }
  return 精简(备选 ?? 保底镇(行数, 列数, 站点数));
}

function 精简({ 路格们, 起点, 站点位置们 }) {
  return { 路格们, 起点, 站点位置们 };
}

/**
 * 极端兜底：一条右一步下一步交替的楼梯街，直街永远 ≤2 格、连通、必够 6 个位置。
 * 只有当 长街 连 6 格都长不出来（在 6×7 盘上不会发生）才会走到这儿 —— 保证「绝不抛错、
 * 孩子这一局照样有镇可开」。
 */
function 保底镇(行数, 列数, 站点数) {
  const 路集 = new Set();
  let 行 = 0; let 列 = 0;
  路集.add(键({ 行, 列 }));
  while (路集.size < 站点数 + 5) {
    if (路集.size % 2 === 1 && 列 + 1 < 列数) 列 += 1;
    else if (行 + 1 < 行数) 行 += 1;
    else if (列 + 1 < 列数) 列 += 1;
    else break;
    路集.add(键({ 行, 列 }));
  }
  const 路格们 = [...路集].map(解键);
  const [起点, ...其余] = 路格们;
  return { 路格们, 起点, 站点位置们: 其余.slice(0, 站点数) };
}
