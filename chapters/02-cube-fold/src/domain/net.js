/**
 * 衣服（展开图 net）的纯数学模型 —— 不依赖 three.js，可以直接跑单元测试。
 *
 * 术语见 CONTEXT.md，代码里用括号里的英文名：
 *   衣服 = net      格子 = cell      面 = face
 *   折痕 = hinge    折叠度 = fold    合上 = valid
 *   重叠 = overlap  漏洞 = hole      编码 = netCode
 *
 * 坐标系：衣服摊平时躺在地面 y = 0 上。
 *   格子 (row, col) 的中心在 (col, 0, row)，格子边长 = 1。
 *   row 变大 → +z，col 变大 → +x，折起来的方向是 +y。
 *
 * 按 ADR-0001：格子构成一张图，相邻格子之间连一条折痕；BFS 出一棵折痕树；
 * 每个非根格子绕它和父格子共用的折痕转 90° × 折叠度，变换是嵌套的。
 */

export const CELL_SIZE = 1;

/** 折叠度到 1 时每条折痕转过的角度 */
const RIGHT_ANGLE = Math.PI / 2;

/**
 * 父格子 → 子格子的四个方向。
 * offset 是父格子中心到折痕中点的位移（父格子局部坐标），
 * 折痕中点到子格子中心的位移恰好也是它。
 * axis / angleSign 决定绕折痕往上折的转向。
 */
const HINGE_BY_DELTA = {
  // 子格子在下一行（+z）：绕 x 轴折起
  '1,0': { name: 'down', axis: 'x', angleSign: -1, offset: [0, 0, CELL_SIZE / 2] },
  // 子格子在上一行（-z）
  '-1,0': { name: 'up', axis: 'x', angleSign: 1, offset: [0, 0, -CELL_SIZE / 2] },
  // 子格子在右一列（+x）：绕 z 轴折起
  '0,1': { name: 'right', axis: 'z', angleSign: 1, offset: [CELL_SIZE / 2, 0, 0] },
  // 子格子在左一列（-x）
  '0,-1': { name: 'left', axis: 'z', angleSign: -1, offset: [-CELL_SIZE / 2, 0, 0] },
};

const key = (cell) => `${cell.row},${cell.col}`;

/** 两个格子是否共边（共边 = 中间有一条折痕） */
export function areAdjacent(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

/** 所有格子是否边边相连成一整片 */
export function isConnected(cells) {
  if (cells.length === 0) return false;
  const seen = new Set([0]);
  const queue = [0];
  while (queue.length > 0) {
    const i = queue.shift();
    for (let j = 0; j < cells.length; j++) {
      if (!seen.has(j) && areAdjacent(cells[i], cells[j])) {
        seen.add(j);
        queue.push(j);
      }
    }
  }
  return seen.size === cells.length;
}

/** 是不是一张能拿去折的衣服：恰好 6 个格子，且边边相连 */
export function isNet(cells) {
  if (cells.length !== 6) return false;
  if (new Set(cells.map(key)).size !== 6) return false;
  return isConnected(cells);
}

/**
 * 挑一个当根的格子：邻居最多的那个，一样多就挑离衣服中心最近的。
 * 根格子折起来是正方体的底面、而且自己不动，所以选中间的格子折起来左右均衡，
 * 不会出现一大半衣服绕着边角上的一个格子甩过去。
 *
 * 孩子在格子纸上画什么形状都要能折（02 票），所以这里必须是算出来的，
 * 不能在调用处写死一个下标。
 */
export function 选根格子(cells) {
  const 中心行 = cells.reduce((sum, c) => sum + c.row, 0) / cells.length;
  const 中心列 = cells.reduce((sum, c) => sum + c.col, 0) / cells.length;

  let 最好 = 0;
  let 最好邻居数 = -1;
  let 最好离中心 = Infinity;

  cells.forEach((cell, index) => {
    const 邻居数 = cells.filter((other) => areAdjacent(cell, other)).length;
    const 离中心 = (cell.row - 中心行) ** 2 + (cell.col - 中心列) ** 2;
    // 邻居越多越好；一样多就离中心越近越好；再一样就保留下标小的，保证结果可复现
    const 更好 = 邻居数 > 最好邻居数 || (邻居数 === 最好邻居数 && 离中心 < 最好离中心);
    if (更好) {
      最好 = index;
      最好邻居数 = 邻居数;
      最好离中心 = 离中心;
    }
  });
  return 最好;
}

/**
 * 按 ADR-0001 用 BFS 建折痕树（spanning tree）。
 * 根格子不动；每个非根格子挂在父格子下面，绕共用折痕转。
 *
 * @returns {{root: number, order: number[], nodes: Array<{
 *   index: number, cell: {row, col}, parent: number|null,
 *   children: number[], hinge: null|{name, axis, angleSign, offset}
 * }>}}
 */
export function buildHingeTree(cells, rootIndex = 选根格子(cells)) {
  if (!isConnected(cells)) {
    throw new Error('格子没有边边相连，建不出折痕树');
  }
  if (!Number.isInteger(rootIndex) || rootIndex < 0 || rootIndex >= cells.length) {
    throw new Error(`根格子下标越界：${rootIndex}`);
  }
  const nodes = cells.map((cell, index) => ({
    index,
    cell,
    parent: null,
    children: [],
    hinge: null,
  }));

  const visited = new Set([rootIndex]);
  const queue = [rootIndex];
  const order = [rootIndex];

  while (queue.length > 0) {
    const i = queue.shift();
    for (let j = 0; j < cells.length; j++) {
      if (visited.has(j) || !areAdjacent(cells[i], cells[j])) continue;
      const dRow = cells[j].row - cells[i].row;
      const dCol = cells[j].col - cells[i].col;
      nodes[j].parent = i;
      nodes[j].hinge = HINGE_BY_DELTA[`${dRow},${dCol}`];
      nodes[i].children.push(j);
      visited.add(j);
      queue.push(j);
      order.push(j);
    }
  }

  return { root: rootIndex, order, nodes };
}

// ---------------------------------------------------------------------------
// 4×4 矩阵（行主序），只够用来验算折叠，不追求通用
// ---------------------------------------------------------------------------

function identity() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[r * 4 + k] * b[k * 4 + c];
      out[r * 4 + c] = sum;
    }
  }
  return out;
}

function translation([x, y, z]) {
  return [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1];
}

function rotation(axis, angle) {
  const s = Math.sin(angle);
  const c = Math.cos(angle);
  if (axis === 'x') return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1];
  if (axis === 'z') return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  throw new Error(`折痕轴只可能是 x 或 z，收到 ${axis}`);
}

export function transformPoint(m, [x, y, z]) {
  return [
    m[0] * x + m[1] * y + m[2] * z + m[3],
    m[4] * x + m[5] * y + m[6] * z + m[7],
    m[8] * x + m[9] * y + m[10] * z + m[11],
  ];
}

/**
 * 算出每个格子在给定折叠度下的变换矩阵（根格子在原点，朝上）。
 * 变换是嵌套的：子格子的矩阵 = 父格子的矩阵 × 自己绕折痕的旋转。
 *
 * @param {number} fold 折叠度 0→1，连续值，0.4 就是停在 0.4
 * @returns {number[][]} 下标 = 格子下标，值 = 4×4 行主序矩阵
 */
export function foldMatrices(tree, fold) {
  const matrices = new Array(tree.nodes.length).fill(null);
  matrices[tree.root] = identity();
  for (const i of tree.order) {
    if (i === tree.root) continue;
    const node = tree.nodes[i];
    const { axis, angleSign, offset } = node.hinge;
    // 挂到折痕上 → 绕折痕转 → 再从折痕走到子格子中心
    const local = multiply(
      translation(offset),
      multiply(rotation(axis, angleSign * RIGHT_ANGLE * fold), translation(offset)),
    );
    matrices[i] = multiply(matrices[node.parent], local);
  }
  return matrices;
}

/** 每个格子中心在给定折叠度下的位置（根格子中心为原点） */
export function cellCenters(tree, fold) {
  return foldMatrices(tree, fold).map((m) => transformPoint(m, [0, 0, 0]));
}

// ---------------------------------------------------------------------------
// 合上 / 穿不上
// ---------------------------------------------------------------------------

/** 正方体的 6 个面，根格子折起来永远是 -y（底面），正方体中心在 (0, 0.5, 0) */
const FACE_IDS = ['+x', '-x', '+y', '-y', '+z', '-z'];

function faceIdOfCenter([x, y, z]) {
  const half = CELL_SIZE / 2;
  const d = [x, y - half, z].map((v) => Math.round(v / half) * half);
  if (Math.abs(x - d[0]) > 1e-6 || Math.abs(y - half - d[1]) > 1e-6 || Math.abs(z - d[2]) > 1e-6) {
    return null;
  }
  const axes = ['x', 'y', 'z'];
  let found = null;
  for (let i = 0; i < 3; i++) {
    if (d[i] === 0) continue;
    if (Math.abs(d[i]) !== half || found !== null) return null;
    found = (d[i] > 0 ? '+' : '-') + axes[i];
  }
  return found;
}

/**
 * 折叠度到 1 的那一刻做判定：每个格子落在单位正方体的哪个面上。
 * 6 个格子落到 6 个不同的面 → 合上；两个落到同一个面 → 重叠，
 * 同时必然有面成了漏洞（数量相等，见 CONTEXT.md）。
 */
export function foldResult(cells, rootIndex = 选根格子(cells)) {
  const tree = buildHingeTree(cells, rootIndex);
  const centers = cellCenters(tree, 1);

  const faces = centers.map((center, i) => {
    const face = faceIdOfCenter(center);
    // 单位格子在正方体上滚，落点必然是某个面心。落不上说明折叠数学写错了，
    // 绝不能悄悄跳过 —— 跳过就会让「重叠和漏洞一样多」这条不变量凭空破掉。
    if (face === null) {
      throw new Error(`格子 ${i} 折完落在 ${center}，不在正方体的任何一个面上`);
    }
    return face;
  });

  const byFace = new Map();
  faces.forEach((face, i) => {
    if (!byFace.has(face)) byFace.set(face, []);
    byFace.get(face).push(i);
  });

  const overlaps = [...byFace.values()].filter((group) => group.length > 1);
  const holes = FACE_IDS.filter((face) => !byFace.has(face));
  const valid = cells.length === 6 && overlaps.length === 0 && holes.length === 0;

  return { tree, faces, valid, overlaps, holes };
}

/** 这张衣服能不能合上 */
export function canClose(cells) {
  return isNet(cells) && foldResult(cells).valid;
}

// ---------------------------------------------------------------------------
// 对面
// ---------------------------------------------------------------------------

/**
 * 三条轴，也是三对对面的固定次序。
 * 03 票里三对对面各有一种发光色，颜色就按这个次序取 ——
 * 同一张衣服上「这一对」的颜色必须每次都一样，孩子才认得出自己已经点过它。
 */
export const 对面轴 = ['x', 'y', 'z'];

/** 一个面正对着的那个面：换个符号，轴不变 */
export function 对面(面) {
  const 符号 = 面[0];
  const 轴 = 面.slice(1);
  if ((符号 !== '+' && 符号 !== '-') || !对面轴.includes(轴)) {
    throw new Error(`认不出这个面：${面}`);
  }
  return (符号 === '+' ? '-' : '+') + 轴;
}

/**
 * 合上以后，哪两个**格子**折成了一对对面。3 对，按 x / y / z 排。
 *
 * 只有合上的衣服才有对面可言：穿不上的时候有两个格子挤在同一个面上、
 * 还有面根本没人盖，「谁和谁是一对」这句话就没有意义了 —— 一律返回空。
 *
 * @param {{faces: string[], valid: boolean}} 结果 foldResult 的输出
 * @returns {Array<{序: number, 轴: string, 面: [string, string], 格子: [number, number]}>}
 */
export function 对面格子对(结果) {
  if (!结果.valid) return [];
  const 面到格子 = new Map(结果.faces.map((面, 下标) => [面, 下标]));
  return 对面轴.map((轴, 序) => ({
    序,
    轴,
    面: [`+${轴}`, `-${轴}`],
    格子: [面到格子.get(`+${轴}`), 面到格子.get(`-${轴}`)],
  }));
}

/**
 * 孩子点了一个面，它跟谁是一对。
 * @returns {null|{序, 轴, 面, 格子}} 点在没合上的衣服上时返回 null
 */
export function 找对面(结果, 格子下标) {
  return 对面格子对(结果).find((一对) => 一对.格子.includes(格子下标)) ?? null;
}

// ---------------------------------------------------------------------------
// 编码（书上的 141 / 231 / 222 / 33 分类）
// ---------------------------------------------------------------------------

const KNOWN_NET_CODES = new Set(['141', '231', '222', '33']);

/** 一张衣服的 8 种摆法（4 个旋转 × 翻面） */
export function orientations(cells) {
  const out = [];
  let current = cells.map((c) => ({ row: c.row, col: c.col }));
  for (let flip = 0; flip < 2; flip++) {
    for (let turn = 0; turn < 4; turn++) {
      out.push(normalize(current));
      current = current.map((c) => ({ row: c.col, col: -c.row })); // 转 90°
    }
    current = current.map((c) => ({ row: c.row, col: -c.col })); // 翻面
  }
  return out;
}

/** 把格子挪到左上角贴边，并按固定顺序排好，方便比较两张衣服是不是同一种 */
export function normalize(cells) {
  const minRow = Math.min(...cells.map((c) => c.row));
  const minCol = Math.min(...cells.map((c) => c.col));
  return cells
    .map((c) => ({ row: c.row - minRow, col: c.col - minCol }))
    .sort((a, b) => a.row - b.row || a.col - b.col);
}

/** 无视旋转和翻面的唯一指纹（图鉴判重要用） */
export function netFingerprint(cells) {
  return orientations(cells)
    .map((o) => o.map(key).join(' '))
    .sort()[0];
}

/**
 * 书上的编码：按格子的行分组数，返回 '141' / '231' / '222' / '33'。
 *
 * 书上这套编码只用来给 11 种能合上的衣服分类，所以穿不上的形状一律返回 null ——
 * 光数每行几格是不够的：有些穿不上的形状每行的格数也凑得出 '33' 或 '231'，
 * 不先问一句「合得上吗」就会把孩子折不成的形状塞进图鉴的某一排。
 */
export function netCode(cells) {
  if (!canClose(cells)) return null;

  const codes = new Set();
  for (const orientation of orientations(cells)) {
    const maxRow = Math.max(...orientation.map((c) => c.row));
    const counts = [];
    for (let row = 0; row <= maxRow; row++) {
      counts.push(orientation.filter((c) => c.row === row).length);
    }
    const code = counts.join('');
    if (KNOWN_NET_CODES.has(code)) codes.add(code);
  }
  if (codes.size !== 1) return null;
  return [...codes][0];
}
