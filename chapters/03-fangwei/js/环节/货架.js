// 货架 —— 水果小超市（书第 33 页 闯关二的活版）。
// 六次「听行列拖水果」+ 两道「看格子说水果」的语音题。

import { 说 } from '/shared/js/说话.js';
import { 问答, 收起麦克风 } from '/shared/js/问答.js';
import { 判对, 建词表, 热词 } from '/shared/js/判对.js';
import { 音效 } from '/shared/js/音效.js';
import { 元, 做进度点, 装拖, 吸到, 歇 } from '/shared/js/搭台.js';
import { 画实体 } from '/shared/js/实体图.js';
import { 台词, 模板 } from '../台词表.js';
import { 名说, 行标字, 列标字 } from '../方位词.js';

// 这一关屏幕上出现的实体（规范名）。这一关的九种水果都是教学实体（孩子要开口说名字），棚子是布景。
// 实体图覆盖测试拿它对账，见 test/实体图覆盖.test.js。
export const 实体们 = [
  '西瓜', '蓝莓', '橘子', '香蕉', '樱桃', '葡萄',
  '芒果', '草莓', '苹果', '货架棚',
];

const 话 = 台词.货架;
const 模 = 模板.货架;

// 3 行 × 4 列。先摆好三样，孩子摆六样，最后两道读位置题。
const 预置 = [
  { 名: '西瓜', 图: '🍉', 行: 3, 列: 3, 英: 'watermelon', 别名: [], 英别名: [] },
  { 名: '蓝莓', 图: '🫐', 行: 3, 列: 1, 英: 'blueberry', 别名: ['蓝色的莓', '蓝色果子'], 英别名: ['blueberries'] },
  { 名: '橘子', 图: '🍊', 行: 2, 列: 2, 英: 'orange', 别名: ['桔子', '橙子'], 英别名: ['tangerine'] },
];
const 要摆 = [
  { 名: '香蕉', 图: '🍌', 行: 1, 列: 1, 英: 'banana', 别名: [], 英别名: ['bananas'] },
  { 名: '樱桃', 图: '🍒', 行: 1, 列: 2, 英: 'cherry', 别名: ['车厘子'], 英别名: ['cherries'] },
  { 名: '葡萄', 图: '🍇', 行: 1, 列: 4, 英: 'grapes', 别名: ['提子'], 英别名: ['grape'] },
  { 名: '芒果', 图: '🥭', 行: 2, 列: 1, 英: 'mango', 别名: [], 英别名: ['mangoes'] },
  { 名: '草莓', 图: '🍓', 行: 2, 列: 4, 英: 'strawberry', 别名: [], 英别名: ['strawberries'] },
  { 名: '苹果', 图: '🍎', 行: 3, 列: 2, 英: 'apple', 别名: [], 英别名: ['apples'] },
];
const 全部 = [...预置, ...要摆];
const 找果 = (名) => 全部.find((g) => g.名 === 名);
// 键仍是中文名；英文只是词条里多出来的说法
export const 水果词表 = 建词表(全部.map(({ 名, 别名, 英, 英别名 }) => ({ 答: 名, 别名, 英: [英, ...英别名] })));
const 读位题 = [
  { 行: 3, 列: 1, 答: '蓝莓' },
  { 行: 2, 列: 2, 答: '橘子' },
];

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="大画框">
        <div class="货架台" id="货架台">
          <div class="货架棚" id="货架棚"></div>
          <div class="货架网" id="货架网"></div>
          <div class="行标们" id="行标们"></div>
          <div class="列标们" id="列标们"></div>
        </div>
      </div>
      <div class="进度点挂" id="货架进度"></div>
    </div>`;
  const 台 = 面板.querySelector('#货架台');
  const 网 = 面板.querySelector('#货架网');
  面板.querySelector('#货架棚').appendChild(画实体('货架棚', '🎪', { 类名: '棚图' }));
  const 点 = 做进度点(面板.querySelector('#货架进度'), 要摆.length + 读位题.length);

  const 格们 = {};
  for (let 行 = 1; 行 <= 3; 行++) {
    for (let 列 = 1; 列 <= 4; 列++) {
      const 格 = 元('div', '货架格 落点');
      网.appendChild(格);
      格们[`${行},${列}`] = 格;
    }
  }
  // 行标 / 列标也是这一讲要认的字（中文课「第1行」，英文课 Row 1）。
  // 只有 换语言() 这一处出处，开场和切换走同一行代码。
  const 行标们 = 面板.querySelector('#行标们');
  for (let 行 = 1; 行 <= 3; 行++) 行标们.appendChild(元('span', '行标'));
  const 列标们 = 面板.querySelector('#列标们');
  for (let 列 = 1; 列 <= 4; 列++) 列标们.appendChild(元('span', '列标'));
  function 换语言() {
    [...行标们.children].forEach((标, i) => { 标.textContent = 行标字(i + 1); });
    [...列标们.children].forEach((标, i) => { 标.textContent = 列标字(i + 1); });
  }
  换语言();

  // 水果贴纸只有 56 舞台px（24pt），够不着 44pt 那条线 → 热区不动位 补一圈隐形的
  // 可点范围（外扩量由 styles.css 的 .货员 调到 12px，约 48pt），视觉一个像素不动
  //（员自己已经 absolute 摆在台上，那个类不许动它的 position）。
  // 托盘里九样东西横排，中心相距 92px，外扩 10px 谁也抢不到谁的手指。
  const 员们 = {};
  for (const { 名, 图 } of 全部) {
    const 员 = 元('span', '货员 热区不动位');
    员.appendChild(画实体(名, 图, { 类名: '货图' }));
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

    for (const { 名, 行, 列 } of 预置) {
      员们[名].dataset.锁 = '1';
      吸到(员们[名], 格们[`${行},${列}`], 台);
    }
    要摆.forEach(({ 名 }, i) => {
      const 员 = 员们[名];
      员.dataset.锁 = '1';
      员.style.left = `${16 + i * 13}%`;
      员.style.top = '92%';
    });

    await 说(话.开场);
    if (!还在()) return;

    let 做到 = 0;
    for (const 任务 of 要摆) {
      if (!还在()) return;
      const 员 = 员们[任务.名];
      const 目标 = 格们[`${任务.行},${任务.列}`];
      员.dataset.锁 = '0';
      let 错过 = 0;
      await new Promise((好) => {
        装拖(员, 台, (中x, 中y) => {
          for (const 格 of Object.values(格们)) {
            const 框 = 格.getBoundingClientRect();
            if (中x > 框.left && 中x < 框.right && 中y > 框.top && 中y < 框.bottom) {
              if (格 === 目标) { 好(); return true; }
              错过 += 1;
              音效.答错();
              说(错过 >= 2
                ? 模.慢慢数(任务.行, 任务.列)
                : 模.数一数(任务.行, 任务.列));
              return false;
            }
          }
          return false;
        });
        员.classList.add('对了');
        setTimeout(() => 员.classList.remove('对了'), 700);
        说(模.指令(名说(任务), 任务.行, 任务.列));
      });
      if (!还在()) return;
      吸到(员, 目标, 台);
      员.dataset.锁 = '1';
      音效.答对();
      await 说(话.摆好啦);
      点.点亮(做到++);
    }

    await 说(话.考考你);
    if (!还在()) return;

    for (const 题 of 读位题) {
      if (!还在()) return;
      const 格 = 格们[`${题.行},${题.列}`];
      格.classList.add('候着');
      await 问答({
        问: 模.问(题.行, 题.列),
        接受们: [题.答],
        判: (文) => 判对(文, [题.答], { 词表: 水果词表 }),
        上下文: 热词(全部.map((g) => g.名), 水果词表),
        提示: async () => 说(模.提示(题.行, 题.列)),
        教: async () => 说(模.教(名说(找果(题.答)))),
        备选: [题.答, ...全部.filter((g) => g.名 !== 题.答).slice(0, 3).map((g) => g.名)]
          .map((名) => ({ 图: 找果(名).图, 答: 名 })),
      });
      格.classList.remove('候着');
      if (!还在()) return;
      点.点亮(做到++);
    }

    if (!还在()) return;
    await 工具.完成('货架');
    if (!还在()) return;
    收起麦克风();
    await 说(话.收尾);
  }

  return { 进入, 换语言 };
}
