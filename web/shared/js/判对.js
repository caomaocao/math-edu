// 判对 —— 童声转写文本的归一化与判定。纯模块：无 DOM、无网络，node 直接测。
//
// 外部行为只有一个：判对(转写, 接受列表) → '对' | '错' | '不确定'
//   '对'    转写里最后提到的候选答案正是接受的
//   '错'    转写里明确提到了别的候选答案（孩子答了，但答错了）
//   '不确定' 转写里根本找不到本题词表里的词 —— 交给上层重试或兜底裁决
//
// 「最后提到的算数」是给自我纠正留的门：孩子说「上面……不对，下面！」按「下面」判。
//
// **两语并集，判定与当前语言模式无关**：中英文说法同在一个词条里，英文课上说「东边」
// 判对，中文课上说 east 也判对 —— 孩子答的方位本来就是对的，不该因为顺口换了语言挨判错。
// 跟着模式走的只有反馈语言（该用哪种语言复述正确词），那归说话/台词表管，不归这里。

// 每个词条：规范名（永远是中文那个名字）→ 两语的全部说法。
// 判定在「本题接受集 ∪ 同题竞争集」里做，词表按长度从长到短匹配，
// 「东南」不会被「东」抢先吃掉，northeast 也不会被 north 抢先吃掉。
export const 词典 = {
  // 上下前后左右（六方位，玩偶方位、蔬菜格子用）
  // 英文不收 over：孩子说 over there 是「在那边」，不是「在上面」
  上面: ['上面', '上边', '上头', '上方', '上', 'up', 'top', 'above', 'upper'],
  下面: ['下面', '下边', '下头', '下方', '底下', '下',
    'down', 'bottom', 'below', 'under', 'underneath', 'lower'],
  前面: ['前面', '前边', '前头', '前方', '前', 'front', 'ahead', 'forward'],
  后面: ['后面', '后边', '后头', '后方', '背后', '后', 'back', 'behind', 'rear'],
  左边: ['左边', '左面', '左侧', '左', 'left'],
  右边: ['右边', '右面', '右侧', '右', 'right'],
  // 八大方位（斜方位在先，词表匹配时长词优先）
  东北: ['东北', '东北边', '东北方', '东北角', '右上',
    'northeast', 'north east', 'upper right', 'top right', 'up right', 'right up'],
  东南: ['东南', '东南边', '东南方', '东南角', '右下',
    'southeast', 'south east', 'lower right', 'bottom right', 'down right', 'right down'],
  西北: ['西北', '西北边', '西北方', '西北角', '左上',
    'northwest', 'north west', 'upper left', 'top left', 'up left', 'left up'],
  西南: ['西南', '西南边', '西南方', '西南角', '左下',
    'southwest', 'south west', 'lower left', 'bottom left', 'down left', 'left down'],
  东: ['东', '东边', '东面', '东方', 'east'],
  南: ['南', '南边', '南面', '南方', 'south'],
  西: ['西', '西边', '西面', '西方', 'west'],
  北: ['北', '北边', '北面', '北方', 'north'],
};

// 口头语：判定前从转写里整段抹掉（只抹不影响答案的）。
// 「东西」是名词（什么东西），先于方位词抹掉；孩子真想一口气答两个方向
// 也轮不到它——一道题只有一个正确方位，抹掉后判「不确定」走重试正合适。
const 口头语 = ['我觉得', '我认为', '那个', '这个', '应该', '好像', '就是', '不对', '等等',
  '什么', '东西', '嗯', '呃', '哦', '啊', '呀', '哇', '吧', '呢', '了', '的', '是'];

// 英文口头语：只能按词边界抹，不能像中文那样当子串抠 ——
// 「um」当子串抹会把 column 抠成 coln，行列题当场哑火。
// 「and」「or」故意不收：抹掉会把 north and east 粘成 northeast，答两个方向反倒变成答东北。
const 英文口头语 = [
  'i think', 'i guess', 'i mean', 'i believe', 'you know', 'let me see', 'hold on',
  'um', 'umm', 'uh', 'uhh', 'erm', 'er', 'hmm', 'hm', 'well', 'like', 'maybe', 'probably',
  'actually', 'really', 'just', 'so', 'okay', 'ok', 'yeah', 'yep', 'yes', 'no', 'nope',
  'wait', 'sorry', 'oops', 'oh', 'ah', 'hey', 'please', 'its', 'it is', 'thats', 'that is',
  'is', 'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'my', 'this', 'that', 'there', 'here',
];
const 英文口头语正则 = new RegExp(
  `\\b(?:${[...英文口头语].sort((a, b) => b.length - a.length).join('|')})\\b`, 'g');

// 「right」既是方向也是「对不对」的口头确认：「north, right?」问的是对不对，不是右边。
// 只认带问号的收尾和 that's right 这两副确认口气，孩子真答 right 时照旧算右边。
const 确认语 = /(?:\bthat['’]?s\s+right\b|[,，]?\s*\bright\s*[?？])/g;

const 隔 = '|'; // 隔断符：标点与抹掉的口头语留下它，免得两头的词被粘成一个新词
const 标点 = /[，。！？、,.!?~·…—;；:：'’"「」『』()（）]/g;

const 中文数字 = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

/** 归一化：小写、去标点、去空白，得到一整条干净文本（第2讲的口令词表直接吃这个）。 */
export function 归一化(转写) {
  return String(转写 || '').toLowerCase().replace(标点, '').replace(/\s+/g, '');
}

/**
 * 洗转写：判对用的那道工序 —— 抹掉两语口头语，标点与抹掉处留下隔断符，
 * 最后把词间空格粘上。
 *
 * 空格粘、隔断符不粘，是英文判对的关键一刀：「north east」和「northeast」
 * 得是同一个答案，而「north, no, east」是改口答了两个方向，绝不能粘成东北。
 */
export function 洗转写(转写) {
  let 文 = String(转写 || '').toLowerCase();
  文 = 文.replace(确认语, 隔);
  文 = 文.replace(英文口头语正则, 隔); // 英文按词边界抹，此时空格还在
  文 = 文.replace(标点, 隔);
  for (const 词 of 口头语) 文 = 文.split(词).join(隔); // 中文照旧整段抠
  return 文.replace(/\s+/g, '');
}

// 在文本里找出「词表中的词」每一次出现，按出现位置排序，返回规范名序列。
// 同一位置长词优先（东南 优先于 东/南），吃掉后跳过其覆盖区。
export function 找方位词(文, 词表 = 词典) {
  const 条目 = [];
  for (const [规范, 说法们] of Object.entries(词表)) {
    // 说法本身也过一遍归一化：词表里能写「upper right」「on top」这种带空格的英文，
    // 和去掉空白的转写才对得上（英文一个词一个词地念，空格靠不住）。
    for (const 原 of 说法们) {
      const 说法 = 归一化(原);
      if (说法) 条目.push({ 规范, 说法 });
    }
  }
  条目.sort((a, b) => b.说法.length - a.说法.length);
  const 命中 = [];
  const 占用 = new Array(文.length).fill(false);
  for (const { 规范, 说法 } of 条目) {
    let 从 = 0;
    while (true) {
      const 位 = 文.indexOf(说法, 从);
      if (位 === -1) break;
      从 = 位 + 1;
      let 空着 = true;
      for (let i = 位; i < 位 + 说法.length; i++) if (占用[i]) 空着 = false;
      if (!空着) continue;
      for (let i = 位; i < 位 + 说法.length; i++) 占用[i] = true;
      命中.push({ 位, 规范 });
    }
  }
  命中.sort((a, b) => a.位 - b.位);
  return 命中.map((h) => h.规范);
}

// 把「自定义答案」（动物名、水果名、建筑名……）临时变成一份词表。
// 接受列表元素可以是字符串，也可以是 {答: '松鼠', 别名: ['小松鼠'], 英: ['squirrel']}。
// 规范名（键）永远是中文那个名字：英文只是又一种说法，判定不因语言而分家。
export function 建词表(候选们) {
  const 表 = {};
  for (const 候选 of 候选们) {
    if (typeof 候选 === 'string') { 表[候选] = [候选]; continue; }
    const 英 = 候选.英 == null ? [] : [].concat(候选.英);
    表[候选.答] = [候选.答, ...(候选.别名 || []), ...英];
  }
  return 表;
}

/**
 * 热词(接受们, 词表?) → 一串候选说法，喂给 ASR 当上下文（/api/asr 的 context）。
 *
 * 摊的是**两语并集**：英文课上也把中文说法喂进去，中文课上也把英文说法喂进去 ——
 * 判定本来就两语通吃，识别这一关就不该先把另一语掐死。
 * 词表里没有的规范名（临时的自定义答案）原样奉还，不至于漏喂。
 */
export function 热词(接受们, 词表 = 词典) {
  const 摊 = [];
  for (const 名 of 接受们 || []) {
    const 说法们 = 词表[名];
    if (说法们 && 说法们.length) 摊.push(...说法们);
    else 摊.push(名);
  }
  return [...new Set(摊)].join('、');
}

/**
 * 说法(规范名, 语, 词表?) → 这个答案在那一门课里**怎么念**，念不出来给 null。
 *
 * 规范名永远是中文（判对与罗盘的通用货币），中文课直接就是它自己；英文课要从词条里
 * 挑出第一个不含汉字的说法 —— 词表的排法本来就是「规范名、中文别名…、英文说法…」，
 * 所以第一个非汉字的就是最正统的那个英文词（东北 → northeast，上面 → up）。
 *
 * 这个模块保持纯粹：不去问「现在是哪门课」，语言由调用方递进来。
 */
export function 说法(名, 语, 词表 = 词典) {
  if (语 !== 'en') return 名;
  const 说法们 = 词表[名];
  if (!说法们) return null;
  return 说法们.find((说) => !/[一-龥]/.test(说)) ?? null;
}

/**
 * 判对(转写, 接受, 选项?)
 *   接受：规范名数组（本题的正确答案，可多个）
 *   选项.竞争：本题可能被说出的其它候选（答错的选项）。缺省用整本词典。
 *   选项.词表：自定义词表（建词表() 的产出），给动物名这类非方位题用。
 */
export function 判对(转写, 接受, 选项 = {}) {
  const 词表 = 选项.词表 || 词典;
  const 文 = 洗转写(转写);
  if (!文) return '不确定';
  const 提到 = 找方位词(文, 词表);
  const 圈子 = new Set([...(接受 || []), ...(选项.竞争 || Object.keys(词表))]);
  const 有效 = 提到.filter((词) => 圈子.has(词));
  if (有效.length === 0) return '不确定';
  return 接受.includes(有效[有效.length - 1]) ? '对' : '错';
}

// ---------------------------------------------------------------- 数字（行列题）

// 英文数字与序数词：three 和 third 都得变成 3（孩子两种都会说）。
const 英文数字 = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
  seventh: 7, eighth: 8, ninth: 9, tenth: 10,
};
const 英文数字正则 = new RegExp(`\\b(?:${Object.keys(英文数字).join('|')})\\b`, 'g');

// 数字题不能走「删口头语」那条路：删掉夹在中间的字会把两个数字粘成一个
// （「不是二，是三」→「不23」）。这里把要删的都换成空格，数字保持各自独立。
// 英文口头语更得按词边界抹：把 um 当子串抠，column 会变成 coln，行列题当场哑火。
function 数字文本(转写) {
  let 文 = String(转写 || '').toLowerCase()
    .replace(/[一二两三四五六七八九十]/g, (c) => 中文数字[c]);
  文 = 文.replace(英文数字正则, (词) => ` ${英文数字[词]} `);
  文 = 文.replace(/(\d)\s*(?:st|nd|rd|th)\b/g, '$1'); // 2nd → 2
  文 = 文.replace(英文口头语正则, ' ');
  文 = 文.replace(标点, ' ').replace(/\s+/g, ' ');
  for (const 词 of 口头语) 文 = 文.split(词).join(' ');
  return 文;
}

// 数字在词前还是词后，中英正好相反：「3行」vs「row 3」，还都可能是「third row」。
// 所以不按语言分岔，按「就近」配对：把数字和行/列记号按出现顺序排成一串，
// 每个记号先看紧挨着的前一个数（3行 / 3 row），没有就看后一个（row 3），
// 认过的数不能再被认第二次 —— 不然「row 3 column 2」里的 3 会被 column 抢走。
function 配数(文) {
  const 记号 = [];
  const 扫 = /\d+|行|列|rows?|col(?:umns?)?/g;
  for (let m = 扫.exec(文); m; m = 扫.exec(文)) {
    const 词 = m[0];
    if (/^\d+$/.test(词)) 记号.push({ 类: '数', 值: Number(词), 认了: false });
    else 记号.push({ 类: 词 === '列' || 词[0] === 'c' ? '列' : '行' });
  }
  const 出 = { 行: null, 列: null };
  记号.forEach((记, i) => {
    if (记.类 === '数' || 出[记.类] !== null) return;
    const 挨着 = [记号[i - 1], 记号[i + 1]].find((邻) => 邻 && 邻.类 === '数' && !邻.认了);
    if (挨着) { 出[记.类] = 挨着.值; 挨着.认了 = true; }
  });
  return 出;
}

// 从转写里抽「第几行第几列」。容忍：阿拉伯数字、中文数字、英文数字词与序数词、
// 「三行二列」「第3行第2列」「3的2」「row three column two」「third row」；
// 两个裸数字按「先行后列」。
export function 抽行列(转写) {
  const 文 = 数字文本(转写);
  let { 行, 列 } = 配数(文);
  if (行 === null || 列 === null) {
    const 裸 = (文.match(/\d+/g) || []).map(Number);
    if (行 === null && 列 === null && 裸.length >= 2) [行, 列] = 裸;
    else if (行 !== null && 列 === null) { const 余 = 裸.filter((n) => n !== 行); if (余.length) 列 = 余[余.length - 1]; }
    else if (列 !== null && 行 === null) { const 余 = 裸.filter((n) => n !== 列); if (余.length) 行 = 余[0]; }
  }
  return { 行, 列 };
}

export function 判行列(转写, 正确行, 正确列) {
  const { 行, 列 } = 抽行列(转写);
  if (行 === null && 列 === null) return '不确定';
  return 行 === 正确行 && 列 === 正确列 ? '对' : '错';
}

// 单独问「第几行」或「第几列」时用
export function 抽数字(转写) {
  const 配 = 数字文本(转写).match(/\d+/g);
  return 配 ? Number(配[配.length - 1]) : null;
}
