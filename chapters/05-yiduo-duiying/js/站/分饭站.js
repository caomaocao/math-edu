// 分饭站 —— 平均分（书 p54 例3+练一练）：一锅 8 碗饭，排队的小朋友比吃得上的多；
// 点一个小朋友发过去每人份、点已发的收回，发到锅空转报数「分给了几个人」。
// A 轮每人 2 碗 → 4 人；B 轮每人 4 碗 → 2 人 —— 数值全从 站点表 的台账读，这儿不背数。
// 发饭模式 = 摆放引擎的薄变体，落在站点层组合（锅=源、人=容器），台面在 ../发饭.js。
// 报数错 2 的提示（票面）：把已吃上饭的小朋友挨个点亮带数。

import { 说 } from '/shared/js/说话.js';
import { 音效 } from '/shared/js/音效.js';
import { 做进度点 } from '/shared/js/搭台.js';
import { 选 } from '/shared/js/语言.js';
import { 中文数, 英文数 } from '/shared/js/数词.js';
import { 台词 } from '../台词表.js';
import { 报一个数 } from '../报数.js';
import { 站点表 } from '../站点表.js';
import { 开一锅, 排队几人, 摆发饭台 } from '../发饭.js';

export const 实体们 = ['米饭', '小朋友'];

const 账面 = 站点表.find((条) => 条.号 === '分饭站').台账;
const 念数 = (n) => 选({ cn: 中文数(n), en: 英文数(n) });

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="大画框 发饭框"><div class="发饭挂点"></div></div>
      <div class="进度点挂"></div>
    </div>`;
  const 挂 = 面板.querySelector('.发饭挂点');
  const 点 = 做进度点(面板.querySelector('.进度点挂'), 账面.轮们.length);
  let 局 = 0;

  async function 进入() {
    const 本局 = ++局;
    const 还在 = () => 局 === 本局 && 面板.classList.contains('在前');
    const 话 = 台词.分饭站; // 读的这一刻取（合并视图），换语言重进自然换课
    点.清零();

    // 轮次进度落柜（AGENTS 的约定）：A 轮玩完切走，回来直接从 B 轮接着；
    // 整站玩完归零，下回再进从头当复习。跟星星一起存、同步、被重来清。
    let 起 = 工具.取('分饭站轮');
    if (!Number.isInteger(起) || 起 < 0 || 起 >= 账面.轮们.length) 起 = 0;
    for (let i = 0; i < 起; i += 1) 点.点亮(i);

    for (let i = 起; i < 账面.轮们.length; i += 1) {
      if (!还在()) return;
      const 轮 = 账面.轮们[i];
      const 账 = 开一锅({ 共: 账面.共, 每人: 轮.每人 });
      let 闸开 = false;
      let 报锅空;
      const 锅空了 = new Promise((好) => { 报锅空 = 好; });
      // 先摆台子再开口（04 真机反馈的先例：空框像卡住）；念完开闸才接手指。
      const 台上 = 摆发饭台({
        挂点: 挂,
        食: { 实体: '米饭', 兜底: '🍚' },
        账,
        排队数: 排队几人(轮.答),
        走查: () => 闸开 && 还在(),
        空了: () => 报锅空(),
      });
      if (i === 起) { await 说(话.开场); if (!还在()) return; }
      await 说(i === 0 ? 话.A轮 : 话.B轮);
      if (!还在()) return;
      闸开 = true;
      await 锅空了;
      if (!还在()) return;
      闸开 = false; // 锅空即提交：报数期间不许再动小朋友
      音效.答对();
      await 说(话.锅空);
      if (!还在()) return;
      await 报一个数(轮.答, {
        问: 话.问几人,
        提示: async () => {
          await 说(话.提示);
          await 台上.挨个亮((第几) => 说(念数(第几)));
        },
      });
      if (!还在()) return;
      点.点亮(i);
      工具.记('分饭站轮', (i + 1) % 账面.轮们.length);
    }

    if (!还在()) return;
    await 工具.完成('分饭站');
    if (!还在()) return;
    await 说(话.收尾);
  }

  return { 进入 };
}
