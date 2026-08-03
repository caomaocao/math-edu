// 记忆 —— 谁躲在哪儿（自创拓展关）。
// 小动物们围着大树待 5 秒，然后全躲进花丛。「小鸟刚才在大树的哪边？」

import { 说 } from '/shared/js/说话.js';
import { 问答, 收起麦克风 } from '/shared/js/问答.js';
import { 判对, 热词 } from '/shared/js/判对.js';
import { 元, 洗牌, 做进度点, 歇 } from '/shared/js/搭台.js';
import { 画实体 } from '/shared/js/实体图.js';
import { 台词, 模板 } from '../台词表.js';
import { 牌字, 名说 } from '../方位词.js';

// 这一关屏幕上出现的实体（规范名）。六只小动物是提示实体，大树和花丛是布景。
// 实体图覆盖测试拿它对账，见 test/实体图覆盖.test.js。
export const 实体们 = [
  '小鸟', '小松鼠', '小蝴蝶', '小瓢虫', '小蜗牛', '小蜜蜂',
  '大树', '花丛',
];

const 话 = 台词.记忆;
const 模 = 模板.记忆;

const 四位 = ['上面', '下面', '左边', '右边'];
const 摆位 = { 上面: [50, 10], 下面: [50, 88], 左边: [13, 50], 右边: [87, 50] };
const 客串 = [
  ['🐦', '小鸟', 'bird'], ['🐿️', '小松鼠', 'squirrel'], ['🦋', '小蝴蝶', 'butterfly'],
  ['🐞', '小瓢虫', 'ladybug'], ['🐌', '小蜗牛', 'snail'], ['🐝', '小蜜蜂', 'bee'],
];

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="大画框">
        <div class="记忆台" id="记忆台">
          <div class="大树" id="大树"></div>
          <div class="倒数圈" id="倒数圈"></div>
        </div>
      </div>
      <div class="进度点挂" id="记忆进度"></div>
    </div>`;
  const 台 = 面板.querySelector('#记忆台');
  const 倒数圈 = 面板.querySelector('#倒数圈');
  面板.querySelector('#大树').appendChild(画实体('大树', '🌳', { 类名: '树图' }));
  const 点 = 做进度点(面板.querySelector('#记忆进度'), 4);

  let 局 = 0;

  async function 进入() {
    const 本局 = ++局;
    const 还在 = () => 局 === 本局 && 面板.classList.contains('在前');
    点.清零();
    收起麦克风();

    await 说(话.开场);
    if (!还在()) return;

    let 做到 = 0;
    for (let 轮 = 0; 轮 < 3; 轮++) {
      if (!还在()) return;
      for (const 旧 of 台.querySelectorAll('.记忆员, .花丛')) 旧.remove();

      // 摆四只（随机挑、随机站位）
      const 这轮 = 洗牌(客串).slice(0, 4);
      const 站位 = 洗牌(四位);
      const 名单 = 这轮.map(([图, 名, 英], i) => ({ 图, 名, 英, 位: 站位[i] }));
      for (const { 图, 名, 位 } of 名单) {
        const 员 = 元('span', '记忆员');
        员.appendChild(画实体(名, 图, { 类名: '记忆图' }));
        员.style.left = `${摆位[位][0]}%`;
        员.style.top = `${摆位[位][1]}%`;
        台.appendChild(员);
      }
      await 说(轮 === 0 ? 话.看仔细 : 话.新一轮);
      if (!还在()) return;
      // 倒数五秒（念的时候已经开始看了，再给一小段安静观察）
      for (let 秒 = 5; 秒 >= 1; 秒--) {
        倒数圈.textContent = '⏳'.repeat(秒);
        await 歇(700);
        if (!还在()) return;
      }
      倒数圈.textContent = '';

      // 全部躲进花丛
      for (const 员 of 台.querySelectorAll('.记忆员')) {
        const 丛 = 元('span', '花丛');
        丛.appendChild(画实体('花丛', '🌺', { 类名: '丛图' }));
        丛.style.left = 员.style.left;
        丛.style.top = 员.style.top;
        台.appendChild(丛);
        员.remove();
      }

      // 问 1~2 只（最后一轮问两只）
      const 问几 = 轮 === 2 ? 2 : 1;
      for (const 谁 of 洗牌(名单).slice(0, 问几)) {
        if (!还在()) return;
        const { 图, 名, 位 } = 谁;
        await 问答({
          问: 模.问(名说(谁)),
          接受们: [位],
          判: (文) => 判对(文, [位], { 竞争: 四位 }),
          上下文: 热词(四位),
          // 递名字（按当前这门课挑好），不递图形 —— 提示句是念出来的
          提示: async () => 说(模.提示(名说(谁))),
          教: async () => 说(模.教(名说(谁), 位)),
          备选: 四位.map((方) => ({ 图: 牌字(方), 答: 方 })),
        });
        if (!还在()) return;
        // 揭晓：花丛翻开 —— 那朵花整个换成刚才藏在这儿的那只小动物
        // （躲之前和露出来必须是同一张贴纸图，孩子才认得出「原来是它」）
        for (const 丛 of 台.querySelectorAll('.花丛')) {
          if (丛.style.left === `${摆位[位][0]}%` && 丛.style.top === `${摆位[位][1]}%`) {
            丛.replaceChildren(画实体(名, 图, { 类名: '记忆图' }));
            丛.classList.add('对了');
          }
        }
        点.点亮(做到++);
        await 歇(900);
      }
    }

    if (!还在()) return;
    await 工具.完成('记忆');
    if (!还在()) return;
    收起麦克风();
    await 说(话.收尾);
  }

  return { 进入 };
}
