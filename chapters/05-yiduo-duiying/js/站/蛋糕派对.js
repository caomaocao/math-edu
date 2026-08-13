// 蛋糕派对 —— 平均分收官（书 p60 闯关五a）：20 块蛋糕每人 4 块，发到盘空 → 5 个小朋友。
// 同款发饭（台面在 ../发饭.js，规模更大），只是这回是一场派对：彩旗、气球都是 CSS
// 布景，不承担教学、不接手指（结构性布景走 CSS 的 spec 口径）；大白盘换掉饭锅的皮
// 也在样式段里。数值全从 站点表 的台账读。

import { 说 } from '/shared/js/说话.js';
import { 音效 } from '/shared/js/音效.js';
import { 选 } from '/shared/js/语言.js';
import { 中文数, 英文数 } from '/shared/js/数词.js';
import { 画实体 } from '/shared/js/实体图.js';
import { 台词 } from '../台词表.js';
import { 报一个数 } from '../报数.js';
import { 站点表 } from '../站点表.js';
import { 开一锅, 排队几人, 摆发饭台 } from '../发饭.js';

// 蛋糕块/小朋友是台上的实体；气球是派对布景，素材升级10 从 CSS 换贴纸（本站首次上屏，由本站导出）。
export const 实体们 = ['蛋糕块', '小朋友', '气球'];

const 账面 = 站点表.find((条) => 条.号 === '蛋糕派对').台账;
const 念数 = (n) => 选({ cn: 中文数(n), en: 英文数(n) });

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="大画框 发饭框 派对框">
        <div class="派对彩旗" aria-hidden="true">
          <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
        </div>
        <span class="派对气球 气球左" aria-hidden="true"></span>
        <span class="派对气球 气球右" aria-hidden="true"></span>
        <div class="发饭挂点"></div>
      </div>
    </div>`;
  面板.querySelector('.气球左').append(画实体('气球', '🎈', { 尺寸: 64 }));
  面板.querySelector('.气球右').append(画实体('气球', '🎈', { 尺寸: 64 }));
  const 挂 = 面板.querySelector('.发饭挂点');
  let 局 = 0;

  async function 进入() {
    const 本局 = ++局;
    const 还在 = () => 局 === 本局 && 面板.classList.contains('在前');
    const 话 = 台词.蛋糕派对;

    const 账 = 开一锅({ 共: 账面.共, 每人: 账面.每人 });
    let 闸开 = false;
    let 报盘空;
    const 盘空了 = new Promise((好) => { 报盘空 = 好; });
    const 台上 = 摆发饭台({
      挂点: 挂,
      食: { 实体: '蛋糕块', 兜底: '🍰' },
      账,
      排队数: 排队几人(账面.答),
      走查: () => 闸开 && 还在(),
      空了: () => 报盘空(),
    });
    await 说(话.开场);
    if (!还在()) return;
    await 说(话.发法);
    if (!还在()) return;
    闸开 = true;
    await 盘空了;
    if (!还在()) return;
    闸开 = false; // 盘空即提交：报数期间不许再动小朋友
    音效.答对();
    await 说(话.盘空);
    if (!还在()) return;
    await 报一个数(账面.答, {
      问: 话.问几人,
      提示: async () => {
        await 说(话.提示);
        await 台上.挨个亮((第几) => 说(念数(第几)));
      },
    });
    if (!还在()) return;
    await 工具.完成('蛋糕派对');
    if (!还在()) return;
    await 说(话.收尾);
  }

  return { 进入 };
}
