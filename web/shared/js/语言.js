// 语言 —— 全站说哪种话，由这里说了算。
//
// 中文课与英文课是同一套课的两张皮：键相同、两张同构的台词表，切换只换取哪一张。
// 和 说话.js 的 `站点:音色` 一个路数：一个全站键、读写永不抛错 —— 隐私模式或存储满了
// 顶多是「记不住这次选择」，绝不能因此让孩子玩不下去。

const 键 = '站点:语言';
const 认得的 = ['cn', 'en'];
const 缺省 = 'cn';

/** 存储写不进时（隐私模式 / 存储满）本页内的退路：至少这一局能切得动。 */
let 记着的 = 缺省;

function 规整(值) {
  return 认得的.includes(值) ? 值 : null;
}

/** 当前语言：'cn' 或 'en'，永远是这两个之一。 */
export function 当前语言() {
  try {
    const 存的 = 规整(localStorage.getItem(键));
    if (存的) return 存的;
  } catch { /* 读不了就用记着的 —— 没记过就是缺省 */ }
  return 记着的;
}

/** 谁想在换语言时被叫醒。讲内「即点即切」就是靠这批人重绘、重读。 */
const 订阅者们 = new Set();

/**
 * 订阅语言变化。回调收到新语言（'cn' | 'en'），只在真的换了时才响。
 * @returns {() => void} 退订
 */
export function 订阅语言(回调) {
  订阅者们.add(回调);
  return () => 订阅者们.delete(回调);
}

/**
 * 换一种语言。认不出来的值一概不理（别让一个笔误把孩子的课变成哑巴）。
 * @returns {boolean} 真的换了才 true —— 调用方拿它决定要不要停语音、重读指令
 */
export function 设语言(语) {
  const 新 = 规整(语);
  if (!新 || 新 === 当前语言()) return false;
  记着的 = 新;
  try {
    localStorage.setItem(键, 新);
  } catch {
    // 写不进（隐私模式 / 存储满）：这一局按 记着的 走。存储里若还压着上一次的旧值，
    // 得把它撵走，否则读的时候旧值会盖过刚切的语言 —— 说的和听的就对不上了。
    try { localStorage.removeItem(键); } catch { /* 删也删不动就算了 */ }
  }
  // 一个订阅者重绘时摔了，不该连累后面的面板 —— 那会切出一屏半中半英
  for (const 回调 of [...订阅者们]) {
    try { 回调(新); } catch { /* 这块自己没画好，别的照画 */ }
  }
  return true;
}

/**
 * 从一条同构条目 `{cn, en}` 里按当前语言取值。
 *
 * 缺当前语言的说法就回落到另一语 —— 漏译时孩子看到的是中文，不是一片空白。
 * （漏译该在测试里红，不该在孩子面前白。）
 * 不长这个样子的（字符串、数字、别的对象）原样奉还：台词表里两语通用的那些
 * （🇬🇧 这种符号、纯数字）不必写两遍。
 */
export function 选(条目) {
  if (!条目 || typeof 条目 !== 'object') return 条目;
  const 有中 = 'cn' in 条目;
  const 有英 = 'en' in 条目;
  if (!有中 && !有英) return 条目;
  const 这语 = 当前语言() === 'en' ? 条目.en : 条目.cn;
  if (这语 !== undefined && 这语 !== null) return 这语;
  const 那语 = 当前语言() === 'en' ? 条目.cn : 条目.en;
  return 那语 !== undefined && 那语 !== null ? 那语 : 这语;
}
