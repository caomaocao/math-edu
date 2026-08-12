// 发饭 —— 平均分两站（分饭站 / 蛋糕派对）共用的「发饭模式」：摆放引擎的薄变体，
// 落在站点层组合、不另起引擎（spec 原话：锅=源、人=容器）。桌上一锅共 N 份，排队的
// 小朋友比吃得上的多；点一个没吃上的，每人份就飞到他的份盘上；点已吃上的，那份回锅。
// **发到锅空就是提交时机，不用铃**——站点转身进报数问「分给了几个人」。
// 这个文件只住两样：纯逻辑的锅账（node --test 咬着）和两站同款的台面 DOM。
// 只有本票 06 的两站用它；第三个站要用了再谈进 组件.js 的事（共享件家规：用了两次才上桌）。

import { 音效 } from '/shared/js/音效.js';
import { 画实体 } from '/shared/js/实体图.js';

/** 排队几人(答) —— 排队的小朋友要比吃得上的多（票面：多于答案数），孩子才有的挑。 */
export function 排队几人(答) { return 答 + 2; }

/**
 * 开一锅({共, 每人}) —— 发饭的纯账本，DOM 一概不知道。
 * 共 必须能被 每人 整除：发到锅空正好分完，是这个玩法成立的前提
 * （台账那头另有一致性测试把守，这儿再守一道是防新数据接错线）。
 */
export function 开一锅({ 共, 每人 }) {
  if (!Number.isInteger(共) || 共 < 1) throw new TypeError('开一锅：共 要正整数');
  if (!Number.isInteger(每人) || 每人 < 1) throw new TypeError('开一锅：每人 要正整数');
  if (共 % 每人 !== 0) throw new TypeError('开一锅：共 要能被 每人 整除（发到锅空正好分完）');
  const 吃上的 = new Set();
  return {
    共,
    每人,
    锅剩: () => 共 - 吃上的.size * 每人,
    吃上了: (人) => 吃上的.has(人),
    吃上几人: () => 吃上的.size,
    空了: () => 吃上的.size * 每人 === 共,
    /** 发给(人) → '发了' | '已经有了' | '没饭了'（锅剩不够一份）。 */
    发给(人) {
      if (吃上的.has(人)) return '已经有了';
      if (共 - 吃上的.size * 每人 < 每人) return '没饭了';
      吃上的.add(人);
      return '发了';
    },
    /** 收回(人) → 收没收成（没吃上的人无份可收）。 */
    收回(人) {
      if (!吃上的.has(人)) return false;
      吃上的.delete(人);
      return true;
    },
  };
}

/** 造贴(实体, 兜底, 类名) —— 走渲染单闸；缺图回落的文本节点包一层好摆进格里
 *（跟 /shared/js/摆放.js 的 造件 同款处理）。松果虫虫站的题眼牌也用它。 */
export function 造贴(实体, 兜底, 类名) {
  const 图 = 画实体(实体, 兜底, { 类名 });
  if (图.nodeType === Node.ELEMENT_NODE) return 图;
  const 壳 = document.createElement('span');
  壳.className = `${类名} 贴纸字`;
  壳.appendChild(图);
  return 壳;
}

/**
 * 摆发饭台({挂点, 食, 账, 排队数, 走查, 空了}) → { 挨个亮 }
 *   食       { 实体, 兜底 } —— 锅里发的那样东西（米饭 / 蛋糕块）
 *   账       开一锅(...) 的账本（谁吃上了、锅剩几份，都问它）
 *   排队数   排队的小朋友几个（比 账.共/账.每人 多，票面要求）
 *   走查()   假 = 还没开闸或这一局已被切走，点了不作数（04 摆放站的同款闸）
 *   空了()   锅发空那一刻叫 —— 站点转报数的提交时机
 * 挨个亮(念) —— 报数错 2 的提示（票面：把已吃上饭的小朋友挨个点亮带数）：
 *   按队伍顺序点亮每个吃上饭的，亮一个 await 念(第几个)。
 */
export function 摆发饭台({ 挂点, 食, 账, 排队数, 走查 = () => true, 空了 = () => {} }) {
  挂点.textContent = '';
  const 台 = document.createElement('div');
  台.className = '发饭台';
  挂点.appendChild(台);

  const 锅 = document.createElement('div');
  锅.className = '饭锅';
  const 锅肚 = document.createElement('div');
  锅肚.className = '锅肚';
  锅.appendChild(锅肚);
  for (let i = 0; i < 账.共; i += 1) 锅肚.appendChild(造贴(食.实体, 食.兜底, '锅里份'));
  台.appendChild(锅);

  const 队 = document.createElement('div');
  队.className = '排队区';
  台.appendChild(队);

  const 食客们 = [];
  for (let i = 0; i < 排队数; i += 1) {
    const 客 = document.createElement('button');
    客.type = 'button';
    客.className = '食客';
    客.appendChild(造贴('小朋友', '🧒', '食客图'));
    const 盘 = document.createElement('div');
    盘.className = '份盘';
    客.appendChild(盘);
    客.addEventListener('click', () => {
      if (!走查()) return;
      if (账.收回(i)) {
        // 点已发的收回：那份回锅（票面）。
        音效.点一下();
        客.classList.remove('吃上');
        盘.textContent = '';
        for (let k = 0; k < 账.每人; k += 1) 锅肚.appendChild(造贴(食.实体, 食.兜底, '锅里份 飞来'));
        return;
      }
      if (账.发给(i) !== '发了') {
        // 锅里不够一份（正常玩不到：共 整除 每人，发空即提交）——摇摇锅示意就好。
        锅.classList.remove('摇一摇');
        void 锅.offsetWidth;
        锅.classList.add('摇一摇');
        return;
      }
      音效.点一下();
      客.classList.add('吃上');
      for (let k = 0; k < 账.每人; k += 1) {
        锅肚.lastElementChild?.remove();
        盘.appendChild(造贴(食.实体, 食.兜底, '份饭 飞来'));
      }
      if (账.空了()) 空了();
    });
    队.appendChild(客);
    食客们.push(客);
  }

  return {
    async 挨个亮(念) {
      let 第几 = 0;
      for (const 客 of 食客们) {
        if (!客.classList.contains('吃上')) continue;
        第几 += 1;
        客.classList.add('提示中');
        await 念(第几);
        客.classList.remove('提示中');
      }
    },
  };
}
