// 八大罗盘 —— 魔法罗盘（书第 30 页 例题3 的活版）。
// 第一步 生活罗盘：把 8 个箭头摆上罗盘（上下左右和四个斜角）。
// 第二步 地图罗盘：念口诀「上北下南左西右东」，把 8 个方位字摆上去。
// 第三步 指针急转弯：指针转到哪，孩子抢答那是什么方位。

import { 说 } from '/shared/js/说话.js';
import { 问答, 收起麦克风 } from '/shared/js/问答.js';
import { 判对, 热词 } from '/shared/js/判对.js';
import { 音效 } from '/shared/js/音效.js';
import { 生活对地图, 角度, 八方位 } from '/shared/js/罗盘.js';
import { 元, 洗牌, 做进度点, 歇 } from '/shared/js/搭台.js';
import { 画实体SVG } from '/shared/js/实体图.js';
import { 台词, 模板 } from '../台词表.js';
import { 牌字 } from '../方位词.js';

// 屏幕上只有一个实体：罗盘盘面（那张空盘子贴纸，指针另画在上层）。八个方向箭头是 UI 图形，
// 不在实体图体系内，所以只列盘面这一个——见 test/实体图覆盖.test.js。
export const 实体们 = ['罗盘盘面'];

const 话 = 台词.八大罗盘;
const 模 = 模板.八大罗盘;

const 生活序 = ['上', '右上', '右', '右下', '下', '左下', '左', '左上'];
const 箭头 = { 上: '⬆️', 下: '⬇️', 左: '⬅️', 右: '➡️', 左上: '↖️', 右上: '↗️', 左下: '↙️', 右下: '↘️' };

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="大画框">
        <div class="罗盘台" id="罗盘台">
          <!-- 盘面走实体图（罗盘盘面贴纸）：下面 JS 把 <image> 塞进这张空 svg。指针是另一层
               svg（罗盘针），叠在盘面之上转（见后面 .罗盘针 的说明）——盘面在底、针在上不打架。 -->
          <svg class="罗盘花" viewBox="-110 -110 220 220"></svg>
          <svg id="罗盘针" class="罗盘针" viewBox="-110 -110 220 220">
            <path d="M0,-78 L12,0 L-12,0 Z" fill="#f2604e"></path>
            <path d="M0,78 L12,0 L-12,0 Z" fill="#9fb6c9"></path>
            <circle r="10" fill="#35485e"></circle>
          </svg>
        </div>
      </div>
      <div class="罗盘托盘" id="罗盘托盘"></div>
      <div class="进度点挂" id="罗盘进度"></div>
    </div>`;
  const 台 = 面板.querySelector('#罗盘台');
  const 托盘 = 面板.querySelector('#罗盘托盘');
  const 针 = 面板.querySelector('#罗盘针');
  const 点 = 做进度点(面板.querySelector('#罗盘进度'), 5);

  // 盘面贴纸铺满整张 svg 的 viewBox（-110..110 = 220）；它是 罗盘花 唯一的孩子，
  // 落在独立的 罗盘针 那层之下，指针照转不误。
  面板.querySelector('.罗盘花').appendChild(画实体SVG('罗盘盘面', '🧭', { 边: 220, x: -110, y: -110 }));

  // 槽是按一个字的大小画的圆圈，斜方位（西南这些）是两个字，原字号塞不下会折行淌出圈外
  // ——打个记号让样式表降字号排成一行。只认「恰好两个汉字」：生活轮的箭头 emoji 和
  // 英文课的词都不沾（英文槽的字号在 data-语="en" 那段自己管）。
  const 填槽 = (槽, 字) => {
    槽.textContent = 字;
    槽.classList.toggle('两字名', /^[一-鿿]{2}$/.test(字));
  };

  // 8 个槽，绕圈摆。热区不动位 = 补一圈隐形的可点范围，视觉不动
  //（槽自己已经 absolute 摆在圆周上，那个类不许动它的 position）
  const 槽们 = {};
  for (const 生 of 生活序) {
    const 槽 = 元('div', '罗盘槽 落点 热区不动位');
    const 弧 = (角度[生活对地图[生]] * Math.PI) / 180;
    槽.style.left = `${50 + 44 * Math.sin(弧)}%`;
    槽.style.top = `${50 - 44 * Math.cos(弧)}%`;
    台.appendChild(槽);
    槽们[生] = 槽;
  }

  let 局 = 0;

  /**
   * 摆一轮 —— 八块牌子归位。
   *
   * @param 造字 (生活名) → **印在牌子上**的东西：生活轮是箭头 emoji（两门课通用），
   *   地图轮是当前这门课要认的那个词（北 / NORTH）。
   * @param 定名 (生活名) → 这块牌子的**中文规范名**（生活轮就是它自己，地图轮是「北」）。
   *   台词模板收的一律是规范名，念成哪门课的说法由模板自己决定。
   */
  async function 摆一轮(还在, 造字, 定名, 提示话) {
    // 第一块（上/北）先摆好做示范
    托盘.innerHTML = '';
    for (const 槽 of Object.values(槽们)) { 填槽(槽, ''); 槽.classList.remove('放好'); }
    const 牌们 = {};
    for (const 生 of 洗牌(生活序)) {
      // 牌子**不补隐形热区**：它自己就是 108 舞台px 的大方块，而挨着排的邻居是
      // 另一个答案，外扩会伸到隔壁头上（理由写在 styles.css 的 .方位牌 那儿）
      const 牌 = 元('button', '方位牌', 造字(生));
      牌.dataset.生 = 生;
      托盘.appendChild(牌);
      牌们[生] = 牌;
    }
    // 示范：上
    const 示范 = 牌们['上'];
    示范.classList.add('放好');
    填槽(槽们['上'], 示范.textContent);
    槽们['上'].classList.add('放好');
    示范.remove();
    await 说(模.示范(定名('上')));

    let 剩 = 生活序.filter((生) => 生 !== '上').length;
    await new Promise((全好) => {
      for (const 生 of 生活序) {
        if (生 === '上') continue;
        const 牌 = 牌们[生];
        // 方位牌从托盘拖到台上：把牌临时提为 fixed 定位比较麻烦，
        // 干脆点选式：点牌选中，再点槽放下 —— 对 5 岁的手更友好。
        牌.onclick = () => {
          if (!还在()) return;
          for (const 别 of Object.values(牌们)) 别.classList.remove('选中');
          牌.classList.add('选中');
          音效.点一下();
          说(模.该放哪(定名(生)));
          for (const [槽生, 槽] of Object.entries(槽们)) {
            槽.onclick = () => {
              if (槽.classList.contains('放好')) return;
              if (槽生 === 生) {
                填槽(槽, 牌.textContent);
                槽.classList.add('放好');
                牌.remove();
                音效.答对();
                说(模.放对了(定名(生)));
                剩 -= 1;
                if (剩 === 0) 全好();
              } else {
                音效.答错();
                说(提示话(生));
              }
            };
          }
        };
      }
    });
  }

  async function 进入() {
    const 本局 = ++局;
    const 还在 = () => 局 === 本局 && 面板.classList.contains('在前');
    点.清零();
    针.style.transform = 'rotate(0deg)';

    await 说(话.开场);
    if (!还在()) return;
    await 摆一轮(还在, (生) => 箭头[生], (生) => 生, 模.摆错生活);
    if (!还在()) return;

    await 说(话.口诀);
    if (!还在()) return;
    // 地图轮的牌面就是这一讲要认的字：中文课印「北」，英文课印 NORTH
    await 摆一轮(还在, (生) => 牌字(生活对地图[生]), (生) => 生活对地图[生], 模.摆错地图);
    if (!还在()) return;

    // ---------------- 指针急转弯
    await 说(话.急转弯);
    let 圈数 = 2;
    const 出题 = 洗牌([...八方位]).slice(0, 5);
    for (let i = 0; i < 出题.length; i++) {
      if (!还在()) return;
      const 方 = 出题[i];
      圈数 += 1;
      针.style.transform = `rotate(${圈数 * 360 + 角度[方]}deg)`;
      await 歇(1700);
      await 问答({
        问: 话.问,
        接受们: [方],
        判: (文) => 判对(文, [方], { 竞争: [...八方位] }),
        上下文: 热词([...八方位]),
        提示: async () => 说(方.length === 1 ? 话.提示单字 : 模.提示两字(方)),
        教: async () => 说(模.教(方)),
        备选: 八方位.map((名) => ({ 图: 牌字(名), 答: 名 })),
      });
      if (!还在()) return;
      点.点亮(i);
    }

    if (!还在()) return;
    await 工具.完成('八大罗盘');
    if (!还在()) return;
    收起麦克风();
    await 说(话.收尾);
  }

  return { 进入 };
}
