// 口令 —— 把小朋友喊的一句「往东走两格」拆成 {方, 数}。纯模块：无 DOM、无网络，node 直接测。
//
// 方向借共享 判对 的 找方位词（两语都认，回中文规范名）；格数在这儿认（中文「两/三」、英文
// 「two/three」、阿拉伯数字都收）。开车关要 方 + 数 都齐才动车 —— 数没认出来就当这一步没说清，
// 前端给「走几格没听清」的提醒（用户拍板：往哪、走几格由孩子自己报，机器不代他说答案）。

import { 洗转写, 找方位词 } from '/shared/js/判对.js';

const 中数 = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const 英数 = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

/** 从（洗过的）一句话里认出第一个数：阿拉伯数字 > 中文数字 > 英文数字，都没有回 null。 */
export function 认格数(净文) {
  const 串 = String(净文);
  const m = 串.match(/\d+/);
  if (m) return parseInt(m[0], 10);
  for (const [字, n] of Object.entries(中数)) if (串.includes(字)) return n;
  const 低 = 串.toLowerCase();
  for (const [词, n] of Object.entries(英数)) if (低.includes(词)) return n;
  return null;
}

/**
 * 认口令(文, 允许方) → { 方, 数 }
 *   方：句中最后提到的、落在 允许方 里的方位（回中文规范名），没有回 null。
 *   数：句中第一个数（认格数），没有回 null。
 * 两样都齐前端才动车；缺方 = 没听懂方向，缺数 = 没听清走几格。
 */
export function 认口令(文, 允许方) {
  const 净 = 洗转写(文);
  const 提到 = 找方位词(净).filter((词) => 允许方.includes(词));
  const 方 = 提到.length ? 提到[提到.length - 1] : null;
  return { 方, 数: 认格数(净) };
}
