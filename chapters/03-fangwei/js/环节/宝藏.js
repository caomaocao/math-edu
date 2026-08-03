// 宝藏 —— 挖宝藏（自创拓展关）。多步线索：「从海盗船往北走2格，再往东走1格，挖！」
// 孩子听完点格子开挖。挖错给脚印演示，三次直接把宝藏亮出来，不卡关。

import { 说 } from '/shared/js/说话.js';
import { 收起麦克风 } from '/shared/js/问答.js';
import { 音效 } from '/shared/js/音效.js';
import { 走多步 } from '/shared/js/罗盘.js';
import { 元, 做进度点, 歇 } from '/shared/js/搭台.js';
import { 画实体 } from '/shared/js/实体图.js';
import { 台词, 模板 } from '../台词表.js';
import { 牌字, 名说 } from '../方位词.js';

// 这一关屏幕上出现的实体（规范名）。三个地标是线索起点，三样宝物是挖到的东西，沙坑是挖开的格子。
// 实体图覆盖测试拿它对账，见 test/实体图覆盖.test.js。
// 走过的格子那个标记不在这份清单里：它是路径标记不是实体，用 CSS 画（见 styles.css 的 .沙格.走过）。
export const 实体们 = [
  '海盗船', '棕榈树', '大石头', '金币', '钻石', '皇冠',
  '沙坑',
];

const 话 = 台词.宝藏;
const 模 = 模板.宝藏;

const 边 = 5;
const 地标们 = [
  { 名: '海盗船', 图: '🏴‍☠️', 行: 4, 列: 0, 英: 'pirate ship' },
  { 名: '棕榈树', 图: '🌴', 行: 0, 列: 4, 英: 'palm tree' },
  { 名: '大石头', 图: '🪨', 行: 4, 列: 4, 英: 'big rock' },
];
/**
 * 三样宝贝：**具名键 → 挖开那一格画什么**。
 *
 * 关卡里存的是名字（金币 / 钻石 / 皇冠），不是那个字形 —— 台词表按这个名字挑词，
 * 图只是这一刻的画法。换成实体图那天，改的只有这张表的右边一列。
 */
export const 宝物们 = Object.freeze({ 金币: '💰', 钻石: '💎', 皇冠: '👑' });

const 关卡们 = [
  { 起: '海盗船', 步们: [['北', 2]], 宝: '金币' },
  { 起: '棕榈树', 步们: [['南', 2], ['西', 1]], 宝: '钻石' },
  { 起: '大石头', 步们: [['西', 2], ['北', 3], ['东', 1]], 宝: '皇冠' },
];

// 沙格里画东西只有这一处出口：有素材就贴纸图，没有就原来那个 emoji（画实体 自己判）。
// 尺寸交给 .沙格 .沙图 那条 CSS，和格子的 font-size 一样大 —— 换图不许让东西位移。
function 画进格(格元, 名, 兜底) {
  格元.replaceChildren(画实体(名, 兜底, { 类名: '沙图' }));
}

function 算目标({ 起, 步们 }) {
  let 格 = (({ 行, 列 }) => ({ 行, 列 }))(地标们.find((d) => d.名 === 起));
  for (const [方, 数] of 步们) 格 = 走多步(格, 方, 数);
  return 格;
}

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="大画框">
        <div class="海岛台" id="海岛台">
          <div class="小罗盘">
            <span class="小北" data-方="北"></span><span class="小南" data-方="南"></span>
            <span class="小西" data-方="西"></span><span class="小东" data-方="东"></span>
          </div>
          <div class="海岛网" id="海岛网"></div>
        </div>
      </div>
      <button class="线索钮 热区" id="线索钮">🔁</button>
      <div class="进度点挂" id="海岛进度"></div>
    </div>`;
  const 网 = 面板.querySelector('#海岛网');
  const 线索钮 = 面板.querySelector('#线索钮');
  const 点 = 做进度点(面板.querySelector('#海岛进度'), 关卡们.length);

  // 小罗盘上的四个教学字，换语言当场重写（面板不重建）
  const 罗盘字们 = [...面板.querySelectorAll('.小罗盘 [data-方]')];
  function 换语言() {
    for (const 字 of 罗盘字们) 字.textContent = 牌字(字.dataset.方);
  }
  换语言();

  const 格元们 = {};
  for (let 行 = 0; 行 < 边; 行++) {
    for (let 列 = 0; 列 < 边; 列++) {
      // 热区：格子只有 92×78，靠视觉尺寸够不着触靶红线。这一处的外扩会跟邻格叠上
      // （缝只有 6px），代价与为什么吃得住写在 styles.css 的 .沙格 那儿
      const 格 = 元('div', '沙格 热区');
      网.appendChild(格);
      格元们[`${行},${列}`] = 格;
    }
  }
  for (const { 名, 图, 行, 列 } of 地标们) {
    画进格(格元们[`${行},${列}`], 名, 图);
    格元们[`${行},${列}`].classList.add('有地标');
  }

  let 点格回调 = null;
  for (const [号, 格] of Object.entries(格元们)) {
    格.addEventListener('click', () => {
      if (点格回调) {
        const [行, 列] = 号.split(',').map(Number);
        点格回调({ 行, 列 }, 格);
      }
    });
  }

  function 清挖痕() {
    for (const 格 of Object.values(格元们)) {
      if (!格.classList.contains('有地标')) 格.replaceChildren();
      格.classList.remove('挖开', '走过');
    }
  }

  let 局 = 0;

  async function 进入() {
    const 本局 = ++局;
    const 还在 = () => 局 === 本局 && 面板.classList.contains('在前');
    点.清零();
    收起麦克风();
    清挖痕();

    await 说(话.开场);
    if (!还在()) return;

    for (let 关 = 0; 关 < 关卡们.length; 关++) {
      if (!还在()) return;
      const 本关 = 关卡们[关];
      const 目标 = 算目标(本关);
      const 起格 = 地标们.find((d) => d.名 === 本关.起);
      // 起点念当前这门课的叫法；步子里的方位仍是中文规范名，模板自己按语言念
      const 线索 = 模.线索({ 起: 名说(起格), 步们: 本关.步们 });
      线索钮.onclick = () => { 音效.点一下(); 说(线索); };

      格元们[`${起格.行},${起格.列}`].classList.add('提示中');
      setTimeout(() => 格元们[`${起格.行},${起格.列}`].classList.remove('提示中'), 2600);

      let 错过 = 0;
      await new Promise((好) => {
        点格回调 = async (格, 格元) => {
          if (格.行 === 目标.行 && 格.列 === 目标.列) { 好(); return; }
          错过 += 1;
          音效.答错();
          画进格(格元, '沙坑', '🕳️');
          setTimeout(() => { if (!格元.classList.contains('有地标')) 格元.replaceChildren(); }, 1500);
          if (错过 === 1) {
            说(模.挖空了(线索));
          } else if (错过 === 2) {
            // 脚印演示：一步一步走给他看。脚印是 CSS 画的（.沙格.走过），不是实体也不是字。
            说(话.看脚印);
            let 走到 = { 行: 起格.行, 列: 起格.列 };
            for (const [方, 数] of 本关.步们) {
              for (let i = 0; i < 数; i++) {
                走到 = 走多步(走到, 方, 1);
                const 印 = 格元们[`${走到.行},${走到.列}`];
                if (!印.classList.contains('有地标')) 印.classList.add('走过');
                await 歇(650);
              }
            }
            说(话.脚印停在哪儿);
            setTimeout(() => { 清挖痕(); }, 4000);
          } else {
            格元们[`${目标.行},${目标.列}`].classList.add('提示中');
            说(话.亮亮那一格);
          }
        };
        说(线索);
      });
      点格回调 = null;
      if (!还在()) return;
      清挖痕();
      const 宝格 = 格元们[`${目标.行},${目标.列}`];
      画进格(宝格, 本关.宝, 宝物们[本关.宝]);
      宝格.classList.add('挖开', '对了');
      音效.星星();
      await 说(模.挖到宝(本关.宝));
      点.点亮(关);
    }

    if (!还在()) return;
    await 工具.完成('宝藏');
    if (!还在()) return;
    await 说(话.收尾);
  }

  return { 进入, 换语言 };
}
