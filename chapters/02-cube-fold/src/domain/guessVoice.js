/**
 * 猜一猜里孩子喊的那一句：「能！」还是「不能！」／ "Yes!" 还是 "No!"
 *
 * 五岁孩子不会照着按钮上的字回答。他会喊「可以呀」「穿得上」「行」「当然啦」，
 * 也会喊「不行」「穿不上」「不可能」—— 全是同一个意思。英文课上是 "it fits"
 * "sure" "no way" "it doesn't fit"。听不懂就重问一遍，而他并不知道自己该换个说法，
 * 重问几次就没兴致了。所以词表宁可宽。
 *
 * 但宽不等于猜：拿不准一律返回 null 交给上层重问。替孩子猜错一次，
 * 他会被判一次错、灰掉一只猫猫，而他明明什么都没答 —— 那比让他重说一遍伤人得多。
 *
 * **两语并集**（判对.js 那条规矩）：英文课上答「能」算对，中文课上答 yes 也算对。
 *
 * 纯的：不碰 DOM、不碰麦克风，node 直接测。
 */

import { 建词表, 归一化, 找方位词 } from '/shared/js/判对.js';

/**
 * 「能 / 不能」两条词表。
 *
 * 走 找方位词 而不是 判对()：判对()（和它内部的 `洗转写`）判之前会先抹掉一串口头语，
 * 而那串口头语里正好有「是」「不对」，英文那半边更要命 —— `yes` `no` `yeah` `nope`
 * 全在里头。抹完孩子最顺口的那句答案就成了空气，他明明答了却被当成没听清。
 * 这儿要的是原样的字。
 *
 * 找方位词 按说法长度从长到短吃词，长的先吃掉，所以「不能」不会被「能」抢走、
 * 「穿不上」不会被「穿上」抢走、cannot 不会被 can 抢走。踩过的两个坑都在这条规则的缝里：
 *
 *   一、**等长的两个说法会打架**（先登记的先吃）。「能穿」曾经在肯定那条里，
 *       「不能穿」里的「能穿」比「不能」先被吃掉，否定就成了肯定。等长说法不许重叠。
 *   二、**否定在前、肯定在后时，「后说的算数」会反过来咬人**：「不能穿上」里
 *       「不能」在前、「穿上」在后，按后说的算就成了「能」。所以整句否定
 *       （不能穿／不能穿上／不能穿得上／不可以穿／不会穿）得整条登记进否定那栏 ——
 *       它更长，先被吃掉，里头的肯定词就没机会露头了。英文同理：
 *       `doesnt fit` `cant wear it` 得整条登记，不能指望 `no` 一个词扛下来。
 *
 * 测试里那条「否定句里的肯定词不算数」同时看着这两个坑。
 */
export const 猜词表 = 建词表([
  {
    答: '能',
    别名: ['能', '行', '会', '是', '对', '能够', '可以', '穿上', '当然', '穿得上', '没问题'],
    英: [
      'yes', 'yeah', 'yep', 'yup', 'sure', 'of course', 'definitely',
      'it can', 'he can', 'can',
      'it fits', 'fits', 'it will fit', 'will fit', 'fit',
      'it works', 'works',
      'it does', 'i think so', 'true', 'correct',
    ],
  },
  {
    答: '不能',
    别名: [
      '不能', '不行', '不对', '不是', '不会', '没法',
      '不能够', '不可以', '不可能', '穿不上', '穿不了', '穿不进',
      // 整句否定，比里头的肯定词长，先吃掉它们
      '不能穿', '不会穿', '不能穿上', '不可以穿', '不能穿得上',
    ],
    英: [
      'no', 'nope', 'nah',
      'no way', 'not at all',
      'cannot', 'cant', 'it cannot', 'it cant', 'he cannot', 'he cant',
      // 整句否定：比里头的 fit / can / will 长，先被吃掉
      'does not fit', 'doesnt fit', 'will not fit', 'wont fit',
      'cannot wear it', 'cant wear it', 'cannot fit', 'cant fit',
      'it does not', 'it doesnt', 'does not', 'doesnt',
      'will not', 'wont', 'not',
      'wrong', 'false', 'impossible',
    ],
  },
]);

/**
 * 明明白白说了「没答上来」的那几句。
 *
 * 「不知道」里含着一个「不」，"I don't know" 里含着一个 no（藏在 know 里），
 * 不挡一下就会被当成「不能」当场记一次作答。孩子说的是「我不知道」，
 * 那是求助，不是答案。
 *
 * 写的时候按人话写，登记前统一过一遍 `归一化`（去标点去空白），
 * 好跟下面同样归一化过的转写对得上。
 */
const 摸不准 = [
  '不知道', '不晓得', '不清楚', '忘了', '忘记',
  "i don't know", 'do not know', 'no idea', 'not sure', 'dunno',
  'i forget', 'forgot', "can't remember",
].map((一句) => 归一化(一句));

/**
 * 英文里藏着答案的那几个词。
 *
 * `归一化` 会把空格全去掉，判定是拿子串比的 —— 于是 "know" 里那两个字母就成了
 * 一个 no，"now" "another" 也一样，"yesterday" 里藏着一个 yes。
 * 这些词本身都不是答案，判定前按**词边界**整个抹掉（这一步必须在去空格之前做）。
 */
const 藏着答案的词 = /\b(?:know|knows|knew|known|now|nothing|notice|another|snow|nose|yesterday|eyes)\b/g;

/**
 * 听一句话是「能」还是「不能」。
 *
 * 后说的算数 —— 孩子会自我纠正：「能……不对，不能！」按后一句办才是他真正的意思。
 *
 * @param {string} 转写 ASR 吐回来的字
 * @returns {'能'|'不能'|null} 听不出来就是 null，交给上层重问
 */
export function 听能不能(转写) {
  const 文 = 归一化(String(转写 ?? '').toLowerCase().replace(藏着答案的词, ' '));
  if (!文) return null;
  for (const 词 of 摸不准) if (词 && 文.includes(词)) return null;
  const 提到 = 找方位词(文, 猜词表);
  return 提到.length ? 提到[提到.length - 1] : null;
}

/** 送给 ASR 的热词：两语一起喂，识别这一关不该先把另一语掐死 */
export function 猜热词() {
  return [...new Set(Object.values(猜词表).flat())].join('、');
}
