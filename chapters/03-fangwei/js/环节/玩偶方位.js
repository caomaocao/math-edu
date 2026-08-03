// 玩偶方位 —— 礼物盒边的小伙伴（书第 28 页 例题1 的活版）。
// 玩法A 你说我猜：机器问「小猴在盒子的哪一边」，孩子开口答。
// 玩法B 我说你摆：机器说「把小猫放到盒子的左边」，孩子拖过去。

import { 说 } from '/shared/js/说话.js';
import { 问答, 收起麦克风 } from '/shared/js/问答.js';
import { 判对, 热词 } from '/shared/js/判对.js';
import { 音效 } from '/shared/js/音效.js';
import { 元, 洗牌, 做进度点, 装拖, 歇 } from '/shared/js/搭台.js';
import { 画实体 } from '/shared/js/实体图.js';
import { 台词, 模板 } from '../台词表.js';
import { 牌字, 名说 } from '../方位词.js';

// 这一关屏幕上出现的实体（规范名）。六个玩偶是提示实体，礼物盒是它们围着的那个中心。
// 实体图覆盖测试拿它对账，见 test/实体图覆盖.test.js。
export const 实体们 = [
  '小猴子', '小兔子', '小熊', '小狐狸', '小猫', '小狗',
  '礼物盒',
];

const 话 = 台词.玩偶方位;
const 模 = 模板.玩偶方位;

const 六方 = ['上面', '下面', '前面', '后面', '左边', '右边'];

// 位置（台内百分比）、层次和体型：
// 前面的正压在盒子前下方、更大（离你近）；后面的正躲在盒子后面、只露上半身、略小略暗（离你远）。
// 前后感全靠这三样：遮挡 + 大小 + 明暗，缺一样孩子就看不出来。
const 摆位 = {
  上面: { x: 50, y: 8, z: 6, 号: 64 }, 下面: { x: 50, y: 88, z: 6, 号: 64 },
  左边: { x: 15, y: 48, z: 6, 号: 64 }, 右边: { x: 85, y: 48, z: 6, 号: 64 },
  前面: { x: 50, y: 71, z: 8, 号: 82 }, 后面: { x: 50, y: 33, z: 2, 号: 52, 暗: true },
};

// 体型仍然由 fontSize 一处说了算：贴纸图在 CSS 里是 1em 见方，跟着字号盒一起大小，
// 所以「前面的更大、后面的更小」这套前后感换图之后一个数字都不用改。
function 摆员(员, 位) {
  const { x, y, z, 号, 暗 } = 摆位[位];
  员.style.left = `${x}%`;
  员.style.top = `${y}%`;
  员.style.zIndex = z;
  员.style.fontSize = `${号}px`;
  员.style.filter = 暗 ? 'brightness(0.88)' : '';
}

const 班底 = [
  { 图: '🐵', 名: '小猴子', 英: 'monkey', 位: '上面' },
  { 图: '🐰', 名: '小兔子', 英: 'bunny', 位: '下面' },
  { 图: '🐻', 名: '小熊', 英: 'bear', 位: '前面' },
  { 图: '🦊', 名: '小狐狸', 英: 'fox', 位: '后面' },
  { 图: '🐱', 名: '小猫', 英: 'cat', 位: '左边' },
  { 图: '🐶', 名: '小狗', 英: 'dog', 位: '右边' },
];

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="大画框">
        <div class="玩偶台" id="玩偶台">
          <div class="礼物盒" id="礼物盒"></div>
        </div>
      </div>
      <div class="进度点挂" id="玩偶进度"></div>
    </div>`;
  const 台 = 面板.querySelector('#玩偶台');
  const 点 = 做进度点(面板.querySelector('#玩偶进度'), 12);
  // 盒子是这一关的中心：六个方位都是「盒子的哪一边」，它必须跟玩偶同一画风
  面板.querySelector('#礼物盒').appendChild(画实体('礼物盒', '🎁', { 类名: '盒图' }));

  // 六个小伙伴常驻台上。热区不动位：托盘里它们是 64 舞台px（27pt），补一圈隐形的
  // 可点范围补到约 47pt，视觉不动（员自己已经 absolute 按百分比摆位）。
  // 托盘里中心相距 102 舞台px，外扩后一个也只占 111，谁也抢不到谁的手指。
  const 员们 = {};
  for (const { 图, 名, 位 } of 班底) {
    const 员 = 元('span', '玩偶员 热区不动位');
    员.appendChild(画实体(名, 图, { 类名: '玩偶图' }));
    员.title = 名;
    摆员(员, 位);
    台.appendChild(员);
    员们[名] = 员;
  }

  let 局 = 0;

  async function 进入() {
    const 本局 = ++局;
    const 还在 = () => 局 === 本局 && 面板.classList.contains('在前');
    点.清零();
    for (const 旧圈 of 台.querySelectorAll('.玩偶圈')) 旧圈.remove();
    // 归位（上一局可能拖乱了）
    for (const { 名, 位 } of 班底) {
      const 员 = 员们[名];
      员.dataset.锁 = '1';
      员.classList.remove('可拖', '拖着');
      员.style.transform = '';
      摆员(员, 位);
    }

    await 说(话.开场);
    if (!还在()) return;

    // ---------------- 玩法A 你说我猜
    let 做到 = 0;
    for (const 谁 of 洗牌(班底)) {
      if (!还在()) return;
      const { 名, 位 } = 谁;
      const 员 = 员们[名];
      员.classList.add('对了');
      setTimeout(() => 员.classList.remove('对了'), 600);
      await 问答({
        问: 模.问(名说(谁)),
        接受们: [位],
        判: (文) => 判对(文, [位], { 竞争: 六方 }),
        // 热词摊的是两语并集：英文课也把「上面」喂进去，反之亦然 —— 判定本来就两语通吃
        上下文: 热词(六方),
        提示: async () => { 员.classList.add('提示中'); await 说(话.提示话[位]); setTimeout(() => 员.classList.remove('提示中'), 2800); },
        教: async () => 说(模.教(名说(谁), 位)),
        备选: 六方.map((方) => ({ 图: 牌字(方), 答: 方 })),
      });
      if (!还在()) return;
      点.点亮(做到++);
    }

    await 说(话.换你摆);
    if (!还在()) return;

    // ---------------- 玩法B 我说你摆
    // 小伙伴排到台子底部当托盘，六个虚线圈是落点
    const 圈们 = {};
    for (const 位 of 六方) {
      const 圈 = 元('span', '玩偶圈');
      const { x, y } = 摆位[位];
      圈.style.left = `${x}%`;
      圈.style.top = `${y}%`;
      台.appendChild(圈);
      圈们[位] = 圈;
    }
    班底.forEach(({ 名 }, i) => {
      const 员 = 员们[名];
      员.style.zIndex = 9;
      员.style.fontSize = '64px'; // 托盘里一样大，前后感等他摆上去再给
      员.style.filter = '';
      员.style.left = `${10 + i * 16}%`;
      员.style.top = '104%';
    });
    await 歇(400);

    for (const 谁 of 洗牌(班底)) {
      if (!还在()) return;
      const { 名, 位 } = 谁;
      const 员 = 员们[名];
      员.dataset.锁 = '0';
      const 落好 = await new Promise((好) => {
        装拖(员, 台, (中x, 中y) => {
          for (const [某位, 圈] of Object.entries(圈们)) {
            const 框 = 圈.getBoundingClientRect();
            if (中x > 框.left - 8 && 中x < 框.right + 8 && 中y > 框.top - 8 && 中y < 框.bottom + 8) {
              if (某位 === 位) { 好(圈); return true; }
              音效.答错();
              说(模.放错了(某位, 位));
              return false;
            }
          }
          return false;
        });
        说(模.指令(名说(谁), 位));
      });
      if (!还在()) return;
      摆员(员, 位); // 圈就画在摆位上，直接按摆位落座，前后大小明暗一步到位
      员.dataset.锁 = '1';
      落好.remove();
      delete 圈们[位];
      音效.答对();
      员.classList.add('对了');
      await 说(模.放对了(名说(谁), 位));
      点.点亮(做到++);
    }

    if (!还在()) return;
    await 工具.完成('玩偶方位');
    if (!还在()) return;
    收起麦克风();
    await 说(话.收尾);
  }

  return { 进入 };
}
