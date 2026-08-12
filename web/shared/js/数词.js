// 数词 —— 0~99 的中/阿/英三套说法，与「把童声报的数抽出来判对错」。
// 纯模块：无 DOM、无网络、零依赖，node 直接测。第4讲报数题的地基，第5讲报数照用
// （2026-08 自 chapters/04 升入 shared，代码原样搬）。
//
// 数字判对的**规范名就是数字串本身**（"6"、"16"）—— 语言中立，不违「判对规范名恒中文」
// 的本意（那条是给方位那种有多语说法的词立的；数字的阿拉伯写法本就通用）。
// 报数题不走共享 判对.js（那儿的中文数字只到十，"十六"会被拆成"106"），走这儿。

const 汉个 = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const 阿到汉 = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

const 英个 = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
];
const 英十 = { 20: 'twenty', 30: 'thirty', 40: 'forty', 50: 'fifty', 60: 'sixty', 70: 'seventy', 80: 'eighty', 90: 'ninety' };

// 范围 0~99：书里最大到 70（数字火车 闯关四 10…70）。数字长龙只到 50，但一套代码兜到 99 更省心。
/** 0~99 → 中文（十六 / 二十一 / 七十）；范围外 null。 */
export function 中文数(n) {
  if (!Number.isInteger(n) || n < 0 || n > 99) return null;
  if (n < 10) return 阿到汉[n];
  if (n === 10) return '十';
  if (n < 20) return `十${阿到汉[n - 10]}`;
  const 十位 = Math.floor(n / 10);
  const 个位 = n % 10;
  return 个位 === 0 ? `${阿到汉[十位]}十` : `${阿到汉[十位]}十${阿到汉[个位]}`;
}

/** 0~99 → 英文（sixteen / twenty-one / seventy）；范围外 null。 */
export function 英文数(n) {
  if (!Number.isInteger(n) || n < 0 || n > 99) return null;
  if (n < 20) return 英个[n];
  const 十位 = Math.floor(n / 10) * 10;
  const 个位 = n % 10;
  return 个位 === 0 ? 英十[十位] : `${英十[十位]}-${英个[个位]}`;
}

/**
 * 说法们(n) → 这个数被接受的全部写法（中文 + 阿拉伯串 + 英文），去重。
 * 用两处：喂给 ASR 当热词上下文；作报数题的接受集（供备选钮/兜底）。
 */
export function 说法们(n) {
  const 出 = new Set();
  const 中 = 中文数(n);
  const 英 = 英文数(n);
  if (中) 出.add(中);
  if (n === 2) 出.add('两'); // 数东西时孩子说「两个」
  出.add(String(n));
  if (英) {
    出.add(英);
    if (英.includes('-')) {
      出.add(英.replace('-', ' ')); // twenty one
      出.add(英.replace('-', '')); // twentyone（ASR 偶尔粘一起）
    }
  }
  return [...出];
}

// ── 把转写抽成数字 ───────────────────────────────────────────────────────────

/** 一段中文数字（已隔离出来）→ 数，认不出给 null。只管 0~99 那几种形状。 */
function 汉转数(段) {
  if (段 === '十') return 10;
  if (段.length === 1) return 汉个[段] ?? null;
  if (段.startsWith('十')) { const o = 汉个[段[1]]; return o == null ? null : 10 + o; }
  const i = 段.indexOf('十');
  if (i > 0) {
    const t = 汉个[段.slice(0, i)];
    if (t == null) return null;
    const 尾 = 段.slice(i + 1);
    const o = 尾 ? 汉个[尾] : 0;
    if (o == null) return null;
    return t * 10 + o;
  }
  return null; // 「六六」这种连写不是一个数
}

const 英十正 = new RegExp(`\\b(${Object.values(英十).join('|')})\\b`, 'g');
const 英个正 = new RegExp(`\\b(${英个.join('|')})\\b`, 'g');

/**
 * 抽数(转写) → 转写里**最后提到**的那个数（0~99 内），没有给 null。
 * 「最后提到」给自我纠正留门：「五，不对，六」按 6 算。
 */
export function 抽数(转写) {
  let 文 = String(转写 ?? '').toLowerCase().replace(/[-–—]/g, ' ');
  const 位数 = []; // {位, 值}

  // 1) 英文：先 tens+units（twenty one），再落单的
  文 = 文.replace(new RegExp(`${英十正.source}\\s+(${英个.slice(1, 10).join('|')})\\b`, 'g'),
    (m, t, o, off) => { 位数.push({ 位: off, 值: 数英十(t) + 英个.indexOf(o) }); return ' '.repeat(m.length); });
  文 = 文.replace(英十正, (m, t, off) => { 位数.push({ 位: off, 值: 数英十(t) }); return ' '.repeat(m.length); });
  文 = 文.replace(英个正, (m, w, off) => { 位数.push({ 位: off, 值: 英个.indexOf(w) }); return ' '.repeat(m.length); });

  // 2) 中文数字连写
  文 = 文.replace(/[零一二两三四五六七八九十]+/g, (m, off) => {
    const v = 汉转数(m);
    if (v != null) 位数.push({ 位: off, 值: v });
    return ' '.repeat(m.length);
  });

  // 3) 阿拉伯（前两步把认掉的都换成了空格，剩下的裸数字才是真数字）
  for (const m of 文.matchAll(/\d+/g)) 位数.push({ 位: m.index, 值: Number(m[0]) });

  const 有效 = 位数.filter((x) => Number.isInteger(x.值) && x.值 >= 0 && x.值 <= 99);
  if (!有效.length) return null;
  有效.sort((a, b) => a.位 - b.位);
  return 有效[有效.length - 1].值;
}

function 数英十(词) {
  for (const [n, w] of Object.entries(英十)) if (w === 词) return Number(n);
  return 0;
}

/** 判数(转写, 正确) → '对' | '错' | '不确定'。抽不到数才「不确定」，交上层重试/兜底。 */
export function 判数(转写, 正确) {
  const n = 抽数(转写);
  if (n == null) return '不确定';
  return n === 正确 ? '对' : '错';
}
