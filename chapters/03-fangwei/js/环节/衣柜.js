// 衣柜 —— 帮妈妈整理衣柜（书第 32 页 闯关一，八条指令与书一致，十样东西全是贴纸实体图）。
// 听一条指令，拖一件东西。放错了温柔提醒，全放对了过关。

import { 说 } from '/shared/js/说话.js';
import { 收起麦克风 } from '/shared/js/问答.js';
import { 音效 } from '/shared/js/音效.js';
import { 元, 做进度点, 装拖, 吸到, 歇 } from '/shared/js/搭台.js';
import { 画实体 } from '/shared/js/实体图.js';
import { 台词, 模板 } from '../台词表.js';

// 这一关屏幕上出现的实体（规范名）。十样东西（九件衣物 + 一个礼物盒），孩子按方位把它们放进柜子。
// 实体图覆盖测试拿它对账，见 test/实体图覆盖.test.js。
export const 实体们 = [
  '外套', '衬衫', '毛衣', '礼物盒', '书包', '马甲',
  '拖鞋', '靴子', '帽子', '黑皮鞋',
];

const 话 = 台词.衣柜;
const 模 = 模板.衣柜;

// 槽位：挂1~挂5（挂衣杆），右上/右中1/右中2/右下（右边一列），底1~底4（最下层）
//
// 指令和提示只从台词表里挑，不在这儿写第二份。**挑的是键，不是句子**：
// 名同时是台词表 `令们` / `提示们` 的键，念的时候才去表里取 —— 直接把句子存进
// 这个数组的话，那一行在 import 的时候就跑完了，孩子后来换语言也换不掉它。
const 任务们 = [
  { 名: '外套', 图: '🧥', 槽: '挂1' },
  { 名: '衬衫', 图: '👕', 槽: '挂2', 参照: '外套' },
  { 名: '毛衣', 图: '🧶', 槽: '挂5' },
  { 名: '礼物盒', 图: '🎁', 槽: '右下' },
  { 名: '书包', 图: '🎒', 槽: '右上' },
  { 名: '马甲', 图: '🦺', 槽: '右中2', 参照: '帽子' },
  { 名: '拖鞋', 图: '🩴', 槽: '底1', 参照: '黑皮鞋' },
  { 名: '靴子', 图: '👢', 槽: '底3' },
];

const 预置 = [
  { 名: '帽子', 图: '🎩', 槽: '右中1' },
  { 名: '黑皮鞋', 图: '👞', 槽: '底2' },
];

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="大画框">
        <div class="衣柜台" id="衣柜台">
          <div class="衣柜体">
            <div class="挂衣区" id="挂衣区"></div>
            <div class="右列" id="右列"></div>
            <div class="底层" id="底层"></div>
          </div>
          <div class="衣物托盘" id="衣物托盘"></div>
        </div>
      </div>
      <div class="进度点挂" id="衣柜进度"></div>
    </div>`;
  const 台 = 面板.querySelector('#衣柜台');
  const 点 = 做进度点(面板.querySelector('#衣柜进度'), 任务们.length);

  const 槽们 = {};
  const 挂衣区 = 面板.querySelector('#挂衣区');
  for (let i = 1; i <= 5; i++) {
    const 槽 = 元('div', '衣柜槽 挂槽 落点');
    槽.innerHTML = '<span class="钩子">⌒</span>';
    挂衣区.appendChild(槽);
    槽们[`挂${i}`] = 槽;
  }
  const 右列 = 面板.querySelector('#右列');
  for (const 号 of ['右上', '右中1', '右中2', '右下']) {
    const 槽 = 元('div', '衣柜槽 格槽 落点');
    右列.appendChild(槽);
    槽们[号] = 槽;
  }
  const 底层 = 面板.querySelector('#底层');
  for (let i = 1; i <= 4; i++) {
    const 槽 = 元('div', '衣柜槽 格槽 落点');
    底层.appendChild(槽);
    槽们[`底${i}`] = 槽;
  }

  const 员们 = {};
  for (const { 名, 图 } of [...预置, ...任务们]) {
    // 挂杆上和格子里是同一个 .衣物员，尺寸也就同一个 52px（原来 emoji 的字号盒）——
    // 位置全靠 吸到() 按落点中心算，换成图一步都不挪。
    // 热区不动位：66 舞台px 只有 28pt，补一圈隐形的可点范围补到约 48pt，视觉不动
    // （它自己已经 absolute 摆好了，那个类不许动它的 position）。
    // 托盘里十件东西中心相距 72px、彼此本就压着一点，但压的方向固定 —— 任务从左往右
    // 一件一件来，该拖的永远是最左边那件，它的左半边（含中心）没被压住。
    const 员 = 元('span', '衣物员 热区不动位');
    员.appendChild(画实体(名, 图, { 类名: '衣图' }));
    员.title = 名;
    台.appendChild(员);
    员们[名] = 员;
  }

  let 局 = 0;

  async function 进入() {
    const 本局 = ++局;
    const 还在 = () => 局 === 本局 && 面板.classList.contains('在前');
    点.清零();
    收起麦克风();
    await 歇(60);

    // 预置的先摆好，要放的排进托盘
    for (const 槽 of Object.values(槽们)) 槽.dataset.占 = '0';
    for (const { 名, 槽 } of 预置) {
      员们[名].dataset.锁 = '1';
      吸到(员们[名], 槽们[槽], 台);
      槽们[槽].dataset.占 = '1';
    }
    任务们.forEach(({ 名 }, i) => {
      const 员 = 员们[名];
      员.dataset.锁 = '1';
      员.style.left = `${14 + i * 10.4}%`;
      员.style.top = '86%';
    });

    await 说(话.开场);
    if (!还在()) return;

    let 做到 = 0;
    for (const 任务 of 任务们) {
      if (!还在()) return;
      const 员 = 员们[任务.名];
      const 目标 = 槽们[任务.槽];
      员.dataset.锁 = '0';
      let 错过 = 0;
      await new Promise((好) => {
        装拖(员, 台, (中x, 中y) => {
          for (const [号, 槽] of Object.entries(槽们)) {
            const 框 = 槽.getBoundingClientRect();
            if (中x > 框.left && 中x < 框.right && 中y > 框.top && 中y < 框.bottom) {
              if (槽 === 目标) { 好(); return true; }
              if (槽.dataset.占 === '1') { 音效.答错(); 说(话.槽里占着了); return false; }
              错过 += 1;
              音效.答错();
              if (错过 >= 2 && 任务.参照) {
                员们[任务.参照].classList.add('提示中');
                setTimeout(() => 员们[任务.参照].classList.remove('提示中'), 2600);
              }
              说(错过 >= 2 ? 话.提示们[任务.名] : 模.不是那里(话.令们[任务.名]));
              return false;
            }
          }
          return false;
        });
        if (任务.参照) {
          员们[任务.参照].classList.add('提示中');
          setTimeout(() => 员们[任务.参照].classList.remove('提示中'), 2600);
        }
        员.classList.add('对了');
        setTimeout(() => 员.classList.remove('对了'), 700);
        说(话.令们[任务.名]);
      });
      if (!还在()) return;
      吸到(员, 目标, 台);
      员.dataset.锁 = '1';
      目标.dataset.占 = '1';
      音效.答对();
      await 说(话.放好啦);
      点.点亮(做到++);
    }

    if (!还在()) return;
    await 工具.完成('衣柜');
    if (!还在()) return;
    await 说(话.收尾);
  }

  return { 进入 };
}
