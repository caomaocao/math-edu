/**
 * 沙盒里孩子能喊的两句话。
 *
 * 「穿衣服！」/ "Get dressed!" 整张衣服一口气折拢，「脱衣服！」/ "Take it off!" 摊回平地 ——
 * 这是逐面点击折之外的那条捷径，也是这一讲唯一一处「说话就有魔法」的地方。
 *
 * 五岁孩子不会照着提示词说话，他会说「给它穿上」「快点合起来」「脱掉脱掉」，
 * 英文课上会说 "close it" "fold it up" "open it" —— 所以每条口令都带一串说法。
 * 听不懂就返回 null 交给上层重试 —— 绝不能猜：猜错了衣服自己动起来，
 * 孩子会以为这东西坏了。
 *
 * **两语并集**（判对.js 那条规矩）：英文课上喊「穿衣服」照样灵，中文课上喊
 * "get dressed" 也灵。跟着语言走的只有方方的回话，那归台词表管。
 *
 * 纯的：不碰 DOM、不碰麦克风，node 直接测。
 */

import { 建词表, 找方位词, 洗转写 } from '/shared/js/判对.js';

/**
 * 口令词表。长的说法排前面由 找方位词 保证（它按长度降序吃词），
 * 所以「穿衣服」不会被「穿」抢先吃掉，unfold 也不会被 fold 抢走。
 *
 * 英文这几条挑的时候躲开了 `洗转写()` 会抹掉的那些词（um / it is / on / the …）：
 * 「put it on」洗完只剩 "put it"，所以 'put it' 也得单独登记一条，
 * 不然孩子喊了一句最顺口的话，衣服纹丝不动。
 */
export const 口令词表 = 建词表([
  {
    答: '穿衣服',
    别名: ['穿上', '穿起来', '穿好', '合上', '合起来', '变身', '穿'],
    英: [
      'get dressed', 'dressed', 'dress up', 'dress',
      'close it up', 'close it', 'close',
      'fold it up', 'fold up', 'fold it', 'fold',
      'wear it', 'wear',
      'put it on', 'put it', 'put on',
      'transform',
    ],
  },
  {
    答: '脱衣服',
    别名: ['脱掉', '脱下来', '脱开', '打开', '摊平', '摊开', '脱'],
    英: [
      'take it off', 'take off', 'takeoff',
      'undress',
      'open it up', 'open it', 'open',
      'unfold it', 'unfold',
      'lay it flat', 'flatten', 'flat',
      'off',
    ],
  },
]);

/**
 * 听一句话里有没有口令。
 *
 * 走 `洗转写()` 而不是 `归一化()`：那道工序会把两语的口头语抹成隔断符，
 * 「um, close it」里的 um 不至于跟后面的词粘成一个谁也认不出的串。
 *
 * 最后提到的算数 —— 孩子会自我纠正：「脱衣服……不对，穿衣服！」
 * 按后一句办才是他真正想要的。
 *
 * @param {string} 转写 ASR 吐回来的字
 * @returns {'穿衣服'|'脱衣服'|null} 听不懂就是 null
 */
export function 听口令(转写) {
  const 文 = 洗转写(转写);
  if (!文) return null;
  const 提到 = 找方位词(文, 口令词表);
  return 提到.length ? 提到[提到.length - 1] : null;
}

/** 送给 ASR 的热词：两语一起喂，识别这一关不该先把另一语掐死 */
export function 口令热词() {
  return [...new Set(Object.values(口令词表).flat())].join('、');
}
