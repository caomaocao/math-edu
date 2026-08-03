import { 当前语言 } from '/shared/js/语言.js';

/**
 * 数点点 —— 图鉴里那个数数彩蛋的纯逻辑。
 *
 * 书上练一练 p16 教的是给展开图分类：每一行有几个格子，读出来就是 141 / 231 / 222 / 33。
 * 五岁的孩子不认字，「141」写在屏幕上等于没写 —— 图鉴上本来就把它画成了点：
 * 一个点、四个点、一个点。这个彩蛋只做一件事：让孩子**把那些点数出来**。
 * 分类法于是不用讲，孩子数着数着就数进去了。
 *
 * 这里只管「几个点」「怎么念」「孩子说的算不算数对」，一个 DOM 都不碰，node 直接测。
 * 会动的界面（点一个个亮起来、麦克风、数错重来）在 ui/collection.js。
 *
 * **两语平行**：中文课上数「一、二、三」，英文课上数 one, two, three ——
 * 数的是同一排点，念法跟着当前语言走。每个函数都收一个可选的 `语`，
 * 不给就是当前语言；判定那一头（`判数数`）两语通吃，跟 判对.js 一个规矩。
 */

/**
 * 数怎么念。图鉴一排最多四个点，但方方数数时也可能一路数上去，留到十。
 *
 * **界面上不出现数字字符**（家规）—— 所以凡是要让孩子看见或听见的数，
 * 都从这儿取，绝不 String(n)。
 */
const 中文数 = Object.freeze(['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']);
const 英文数 = Object.freeze([
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
]);

const 两语数 = Object.freeze({ cn: 中文数, en: 英文数 });
const 取数表 = (语) => 两语数[语] ?? 中文数;

/** 一串数念完中间用什么隔开：中文是顿号，英文是逗号加空格 */
const 顿 = (语) => (语 === 'en' ? ', ' : '、');

/**
 * 数读出来。超出范围返回 null —— 宁可让调用方少说一句，
 * 也不能悄悄吐出个「11」印到方方的台词里。
 * @param {number} 数
 * @param {'cn'|'en'} [语]
 * @returns {string|null}
 */
export function 读数(数, 语 = 当前语言()) {
  const 表 = 取数表(语);
  if (!Number.isInteger(数) || 数 < 0 || 数 >= 表.length) return null;
  return 表[数];
}

/**
 * 数后面跟量词的时候读法不一样：中文数数是「一、二、三」，说个数是「两个点」。
 * 方方要是说出「二个点」，孩子听着就不像人话了。英文没有这一档，two 就是 two。
 * @param {number} 数
 * @param {'cn'|'en'} [语]
 * @returns {string|null}
 */
export function 读量词(数, 语 = 当前语言()) {
  if (语 !== 'en' && 数 === 2) return '两';
  return 读数(数, 语);
}

/**
 * 一排的数数题。编码就是题面：'141' → 数三行，分别是 1、4、1 个点。
 *
 * @param {string} 编码 '141' / '231' / '222' / '33'
 * @param {'cn'|'en'} [语]
 * @returns {{编码: string, 点数们: number[], 念法: string, 总格数: number}|null}
 */
export function 数数题(编码, 语 = 当前语言()) {
  if (typeof 编码 !== 'string' || !/^[1-9]+$/.test(编码)) return null;
  const 点数们 = [...编码].map(Number);
  const 念法们 = 点数们.map((一个) => 读数(一个, 语));
  if (念法们.some((一个) => 一个 === null)) return null;
  return {
    编码,
    点数们,
    /** 数完了方方把整排念一遍：「一、四、一！」 */
    念法: 念法们.join(顿(语)),
    总格数: 点数们.reduce((和, 个) => 和 + 个, 0),
  };
}

/**
 * 方方带着孩子一个一个点着数：「一、二、三、四」。
 * 数错以后就靠这一句把节奏放慢，界面上同时一个点一个点地亮。
 *
 * @param {number} 点数
 * @param {'cn'|'en'} [语]
 * @returns {string} 数不出来（超范围）就是空串，调用方直接跳过这一句
 */
export function 数着念(点数, 语 = 当前语言()) {
  if (!Number.isInteger(点数) || 点数 < 1) return '';
  const 一路 = [];
  for (let i = 1; i <= 点数; i++) {
    const 字 = 读数(i, 语);
    if (字 === null) return '';
    一路.push(字);
  }
  return 一路.join(顿(语));
}

/** 中文数字放宽：孩子说「四」和说「4」是一回事，说「两」也是二 */
const 中文数字 = Object.freeze({
  零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
});

/**
 * 英文数字与序数词。**判定不分语言**（判对.js 那条规矩）：中文课上孩子顺口
 * 报了个 four，一样算数对 —— 他数的点本来就是对的。
 */
const 英文数字 = Object.freeze({
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
  sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
});
const 英文数字正则 = new RegExp(`\\b(?:${Object.keys(英文数字).join('|')})\\b`, 'g');

/**
 * 从孩子说的话里抽出「他报的是几」。
 *
 * 这儿**没有**直接用 `/shared/js/判对.js` 的 `抽数字`，虽然那边看着正是干这个的。
 * 原因是这个玩法特有的一件事：孩子多半是**一路数过去**的，而 ASR 转出来常常没有标点 ——
 * 「一二三四」转成数字就粘成了 1234，`抽数字` 老老实实读出一千二百三十四，
 * 数得完全正确的孩子会被判错。数数是这个彩蛋的全部，这一条错了就没得玩了。
 *
 * 所以这里多一条规矩：一串**从一开始、一个一个往上加**的数字（1234 / 123 / 12），
 * 那是在数数，答案是最后那一个。其余照旧「取最后提到的那个数」——
 * 「四……不对，三」按后说的算，自我纠正的门留着。
 *
 * 英文数词换成数字时**两边留空格**：「one two three four」不像中文那样会粘成 1234，
 * 它本来就是四个分开的数，最后那个才是他报的。
 *
 * @param {string|null} 转写
 * @returns {number|null} 一个数都没提就是 null
 */
export function 抽点数(转写) {
  const 文 = String(转写 ?? '')
    .toLowerCase()
    .replace(英文数字正则, (词) => ` ${英文数字[词]} `)
    .replace(/[零一二两三四五六七八九十]/g, (字) => String(中文数字[字]))
    .replace(/[^0-9]+/g, ' ');
  const 串们 = 文.match(/\d+/g);
  if (!串们 || 串们.length === 0) return null;
  const 最后 = 一串读成几(串们[串们.length - 1]);
  // 「one two three four」拆成了四个串：一路往上数的话，报的还是最后那个
  return 最后;
}

function 一串读成几(串) {
  const 数们 = [...串].map(Number);
  if (数们.length === 1) return 数们[0];
  // 「一二三四」：从一开始一个一个往上，这是在数数，报的是最后那个
  const 在数数 = 数们[0] === 1 && 数们.every((数, i) => 数 === i + 1);
  if (在数数) return 数们[数们.length - 1];
  // 「四四四」：结巴了，还是四
  if (数们.every((数) => 数 === 数们[0])) return 数们[0];
  return Number(串);
}

/**
 * 孩子报的数算不算对。
 *
 * @param {string|null} 转写 孩子说的话（ASR 转出来的）
 * @param {number} 正确数 这一行有几个点
 * @returns {'对'|'错'|'不确定'} 找不到数是「不确定」：那是没听清，不是答错，不该扣机会
 */
export function 判数数(转写, 正确数) {
  const 说的 = 抽点数(转写);
  if (说的 === null) return '不确定';
  return 说的 === 正确数 ? '对' : '错';
}

/**
 * 麦克风没听清时亮出来的备选：几颗点的按钮，孩子点一下也能答。
 *
 * 给的是**数**，画成几个点由界面负责 —— 备选钮上一样不许出现数字字符。
 * 正确答案一定在里面（不然孩子点半天点不到对的），其余按 1、2、3、4 补齐：
 * 图鉴四排的每一行都在这个范围里，多给反而挑花眼。
 *
 * @param {number} 正确数
 * @param {number} [最多]
 * @returns {number[]} 从小到大
 */
export function 数数备选(正确数, 最多 = 4) {
  const 们 = new Set();
  for (let i = 1; i <= 最多; i++) 们.add(i);
  if (Number.isInteger(正确数) && 正确数 >= 1) 们.add(正确数);
  return [...们].sort((a, b) => a - b);
}

/**
 * 送给 ASR 的热词：这一关孩子嘴里只会蹦这几个说法，两语一起喂
 * （判定本来就两语通吃，识别这一关不该先把另一语掐死 —— 见 判对.js 的 `热词`）。
 */
export function 数数热词(语 = 当前语言()) {
  const 几个点 = 语 === 'en' ? 'how many dots' : '几个点';
  return [...中文数.slice(1, 5), ...英文数.slice(1, 5), 几个点].join('、');
}

/**
 * 方方在这个彩蛋里会说的每一句。启动时拿去 `备话()` 灌进 TTS 磁盘缓存，
 * 孩子点下去就有声音，不用先听一段安静。
 *
 * @param {string[]} 编码们 图鉴那四排的编码
 * @param {'cn'|'en'} [语]
 * @returns {string[]}
 */
export function 数点点台词(编码们 = [], 语 = 当前语言()) {
  const 话 = 数点点话(语);
  const 词 = [
    话.开场语, ...话.问句们, ...话.表扬们, ...话.鼓励们, ...话.没听清们,
    话.用手点吧, 话.不数啦,
  ];
  for (const 编码 of 编码们) {
    const 题 = 数数题(编码, 语);
    if (!题) continue;
    词.push(整排念完(题, 语));
    for (const 点数 of new Set(题.点数们)) {
      词.push(数着念(点数, 语));
      词.push(告诉他(点数, 语));
      词.push(一起数吧(点数, 语));
    }
  }
  return [...new Set(词.filter(Boolean))];
}

// ---------------------------------------------------------------------------
// 台词。都在这儿，界面那边只挑不写
//
// 跟 data/台词表.js 一个规矩：**要说的时候才取**（`数点点话()` 是个函数），
// 别在模块顶上摊成常量 —— 那会把中文那几句焊死在加载的那一刻。
// ---------------------------------------------------------------------------

const 数点点两语 = Object.freeze({
  cn: Object.freeze({
    开场语: '我们一起数点点吧！',
    问句们: Object.freeze(['这一行有几个点？数给我听。', '这一行呢？有几个点呀？']),
    表扬们: Object.freeze(['数对啦，你真棒！', '就是这么多，好厉害！', '一个不多一个不少！']),
    鼓励们: Object.freeze(['差一点点，再数一次！', '没关系，我们慢慢数。']),
    没听清们: Object.freeze(['我没听清，再说一遍好不好？', '声音再大一点点，我们再来一次！']),
    用手点吧: '用手点一点下面的点点，也可以告诉我哦。',
    不数啦: '好，那不数啦。',
  }),
  en: Object.freeze({
    开场语: 'Let us count the dots together!',
    问句们: Object.freeze([
      'How many dots are in this row? Count them for me.',
      'And this row? How many dots are there?',
    ]),
    表扬们: Object.freeze([
      'That is right, you are brilliant!',
      'That is exactly how many, well done!',
      'Not one more, not one less!',
    ]),
    鼓励们: Object.freeze(['So close, count them once more!', 'Never mind, let us count slowly.']),
    没听清们: Object.freeze([
      'I did not catch that. Can you say it again?',
      'A little bit louder, let us try again!',
    ]),
    用手点吧: 'You can press the dots below to tell me too.',
    不数啦: 'OK, we will stop counting.',
  }),
});

/** 这一语的数点点台词。要说的时候才取 */
export function 数点点话(语 = 当前语言()) {
  return 数点点两语[语] ?? 数点点两语.cn;
}

/** 数错第二次：方方一个点一个点地数给他听 */
export function 一起数吧(点数, 语 = 当前语言()) {
  const 一路 = 数着念(点数, 语);
  if (!一路) return '';
  return 语 === 'en' ? `Watch me count: ${一路}.` : `看好我数：${一路}。`;
}

/** 三次都没数对：直接告诉他，然后接着玩，绝不卡关 */
export function 告诉他(点数, 语 = 当前语言()) {
  const 字 = 读量词(点数, 语);
  if (!字) return '';
  return 语 === 'en'
    ? `There are ${字} dots. You will get it next time!`
    : `是${字}个点。下次就会啦！`;
}

/** 一整排数完：把编码整个念一遍，「一、四、一！」 */
export function 整排念完(题, 语 = 当前语言()) {
  if (!题) return '';
  return 语 === 'en'
    ? `${题.念法}! Every coat in this row is laid out just like that.`
    : `${题.念法}！这一排的衣服，每一件都是这样排的。`;
}
