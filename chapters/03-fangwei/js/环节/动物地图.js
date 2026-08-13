// 动物地图 —— 去谁家做客（书第 34 页 闯关三的活版，十道题与书同构）。
// 「松鼠往南走，会到谁的家？」孩子说动物名。北在上边，有小罗盘。

import { 说 } from '/shared/js/说话.js';
import { 问答, 收起麦克风 } from '/shared/js/问答.js';
import { 判对, 建词表, 热词 } from '/shared/js/判对.js';
import { 走一步 } from '/shared/js/罗盘.js';
import { 元, 做进度点, 歇 } from '/shared/js/搭台.js';
import { 框心到舞台 } from '/shared/js/舞台.js';
import { 画实体 } from '/shared/js/实体图.js';
import { 选 } from '/shared/js/语言.js';
import { 台词, 模板 } from '../台词表.js';
import { 牌字 } from '../方位词.js';

// 这一关屏幕上出现的实体（规范名）。十二只动物是教学实体，房子是每只动物住的那间屋（布景），
// 罗盘盘面是角落那个参照小罗盘的底（空盘无指针——四个方位字要压上去还得读得出，票 12；与八大罗盘同图）。
// 实体图覆盖测试拿它对账，见 test/实体图覆盖.test.js。
export const 实体们 = [
  '松鼠', '长颈鹿', '小鸟', '刺猬', '小猪', '奶牛',
  '蚂蚁', '狐狸', '兔子', '小鸡', '青蛙', '小羊',
  '房子', '罗盘盘面',
];

const 话 = 台词.动物地图;
const 模 = 模板.动物地图;

// 4 行 × 3 列的小房子（行0 在最北边）。中文名是规范名（房们的键、判对的答案），
// 第三格是英文课里念的那个词。
const 住户 = [
  ['🐿️', '松鼠', 'squirrel'], ['🦒', '长颈鹿', 'giraffe'], ['🐦', '小鸟', 'bird'],
  ['🦔', '刺猬', 'hedgehog'], ['🐷', '小猪', 'piglet'], ['🐮', '奶牛', 'cow'],
  ['🐜', '蚂蚁', 'ant'], ['🦊', '狐狸', 'fox'], ['🐰', '兔子', 'rabbit'],
  ['🐔', '小鸡', 'chick'], ['🐸', '青蛙', 'frog'], ['🐑', '小羊', 'lamb'],
];
const 别名表 = {
  松鼠: ['小松鼠'], 长颈鹿: ['小长颈鹿', '鹿'], 小鸟: ['鸟', '鸟儿'],
  刺猬: ['小刺猬'], 小猪: ['猪', '猪猪'], 奶牛: ['牛', '小牛'],
  蚂蚁: ['小蚂蚁'], 狐狸: ['小狐狸'], 兔子: ['小兔子', '小兔'],
  小鸡: ['鸡', '小鸡仔'], 青蛙: ['小青蛙', '蛙'], 小羊: ['羊', '绵羊'],
};
const 英别名表 = {
  松鼠: ['little squirrel'], 长颈鹿: [], 小鸟: ['little bird', 'birdie'],
  刺猬: [], 小猪: ['pig', 'little pig'], 奶牛: ['little cow'],
  蚂蚁: ['little ant'], 狐狸: ['little fox'], 兔子: ['bunny', 'little rabbit'],
  小鸡: ['chicken', 'baby chick'], 青蛙: ['little frog'], 小羊: ['sheep', 'little lamb'],
};
const 英名表 = Object.fromEntries(住户.map(([, 名, 英]) => [名, 英]));
/** 这只动物这会儿念哪个名字 */
const 念 = (名) => 选({ cn: 名, en: 英名表[名] });
export const 动物词表 = 建词表(住户.map(([, 名]) => ({
  答: 名, 别名: 别名表[名], 英: [英名表[名], ...英别名表[名]],
})));

// 十道题（与书第 34 页同构：主角、方向、走一步）
const 题们 = [
  ['松鼠', '南'], ['松鼠', '东'], ['小鸟', '南'], ['小鸟', '西'],
  ['小鸡', '北'], ['小鸡', '东'], ['小羊', '北'], ['小羊', '西'],
  ['小猪', '东'], ['狐狸', '西'],
];

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="大画框">
        <div class="村子台" id="村子台">
          <div class="小罗盘">
            <span class="小北" data-方="北"></span><span class="小南" data-方="南"></span>
            <span class="小西" data-方="西"></span><span class="小东" data-方="东"></span>
          </div>
          <div class="村子网" id="村子网"></div>
          <span class="走路的" id="走路的"></span>
        </div>
      </div>
      <div class="进度点挂" id="村子进度"></div>
    </div>`;
  const 台 = 面板.querySelector('#村子台');
  const 网 = 面板.querySelector('#村子网');
  const 走路的 = 面板.querySelector('#走路的');
  const 点 = 做进度点(面板.querySelector('#村子进度'), 题们.length);

  // 角落那个参照小罗盘：底盘走实体图（罗盘盘面，空盘无指针），四个教学字盖在上层。
  面板.querySelector('.小罗盘').prepend(画实体('罗盘盘面', '🧭', { 类名: '小罗盘图' }));

  // 小罗盘上的四个教学字，换语言当场重写（面板不重建，只改这四个 textContent）
  const 罗盘字们 = [...面板.querySelectorAll('.小罗盘 [data-方]')];
  function 换语言() {
    for (const 字 of 罗盘字们) 字.textContent = 牌字(字.dataset.方);
  }
  换语言();

  const 房们 = {}; // 名 → 格元素；格 → {行,列}
  const 屋色 = ['#ffe3de', '#fff3d1', '#e2f4ff', '#eee5ff', '#e5f7e0', '#ffe9f5'];
  住户.forEach(([图, 名], i) => {
    const 行 = Math.floor(i / 3);
    const 列 = i % 3;
    const 房 = 元('div', '小房子');
    房.style.background = 屋色[i % 屋色.length];
    // 屋子和住户都走实体图：房顶那间屋十二格共用同一张「房子」，住户各是自己那只。
    // 缺图时 画实体() 还回文本节点，两个 span 的字号盒原样，一格都不挪。
    const 顶 = 元('span', '房顶');
    顶.appendChild(画实体('房子', '🏠', { 类名: '房顶图' }));
    const 主 = 元('span', '房主');
    主.appendChild(画实体(名, 图, { 类名: '房主图' }));
    房.append(顶, 主);
    房.dataset.名 = 名;
    网.appendChild(房);
    房们[名] = { 元: 房, 行, 列 };
  });
  const 名字在 = (行, 列) => 住户.find((_, i) => Math.floor(i / 3) === 行 && i % 3 === 列)?.[1];

  let 局 = 0;

  async function 进入() {
    const 本局 = ++局;
    const 还在 = () => 局 === 本局 && 面板.classList.contains('在前');
    点.清零();
    收起麦克风();
    走路的.textContent = '';
    await 歇(60);

    await 说(话.开场);
    if (!还在()) return;

    let 做到 = 0;
    for (const [主角, 方] of 题们) {
      if (!还在()) return;
      const 家 = 房们[主角];
      const 到 = 走一步({ 行: 家.行, 列: 家.列 }, 方);
      const 答 = 名字在(到.行, 到.列);
      家.元.classList.add('提示中');
      setTimeout(() => 家.元.classList.remove('提示中'), 2000);
      await 问答({
        问: 模.问(念(主角), 方),
        接受们: [答],
        判: (文) => 判对(文, [答], { 词表: 动物词表 }),
        上下文: 热词(住户.map(([, 名]) => 名), 动物词表),
        提示: async () => {
          家.元.classList.add('提示中');
          await 说(模.提示(方, 念(主角)));
          setTimeout(() => 家.元.classList.remove('提示中'), 2400);
        },
        教: async () => {
          房们[答].元.classList.add('提示中');
          await 说(模.教(念(答)));
          setTimeout(() => 房们[答].元.classList.remove('提示中'), 2400);
        },
        备选: [答, ...Object.keys(房们).filter((名) => 名 !== 答 && 名 !== 主角).slice(0, 3)]
          .map((名) => ({ 图: 住户.find(([, n]) => n === 名)[0], 答: 名 })),
      });
      if (!还在()) return;
      // 走一段给孩子看：主角小跑到目的地。两个端点都用 框心到舞台()（两套坐标怎么换、
      // 为什么不能就手写 rect 的数，见 /shared/js/舞台.js 那儿）。这儿没有 offsetWidth
      // 那类本来就是舞台单位的项要减 —— 小跑那只是靠 CSS 的 translate(-50%,-50%) 居中的。
      const 主图 = 住户.find(([, n]) => n === 主角)[0];
      const 起 = 框心到舞台(家.元, 台);
      const 终 = 框心到舞台(房们[答].元, 台);
      // 小跑的那只必须跟房子里的是同一只，所以这儿也走 画实体()（清场仍是 textContent = ''）
      走路的.replaceChildren(画实体(主角, 主图, { 类名: '走图' }));
      走路的.style.transition = 'none';
      走路的.style.left = `${起.x}px`;
      走路的.style.top = `${起.y}px`;
      await 歇(40);
      走路的.style.transition = 'left 1s ease, top 1s ease';
      走路的.style.left = `${终.x}px`;
      走路的.style.top = `${终.y}px`;
      await 歇(1100);
      走路的.textContent = '';
      房们[答].元.classList.add('对了');
      setTimeout(() => 房们[答].元.classList.remove('对了'), 700);
      点.点亮(做到++);
    }

    if (!还在()) return;
    await 工具.完成('动物地图');
    if (!还在()) return;
    收起麦克风();
    await 说(话.收尾);
  }

  return { 进入, 换语言 };
}
