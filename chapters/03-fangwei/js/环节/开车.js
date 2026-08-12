// 开车 —— 方向小司机（书第 35 页 闯关四的活版，路线自由 → 变成语音开车）。
// 孩子喊「往东走！」小车就沿路开到下一个路口。送三趟客就通关。
// 嗓子累了也有四个方向大按钮（按钮上是要学的「北南西东」字）。
//
// 小镇每次进关**现生成**（连通路网 + 五站落在随机路格 + 随机起点 + 随机三趟订单，见 小镇.js）：
// 进两次是两座不同的镇。换语言这一下 主.js 会重进本关（见那儿的注释），于是也顺带重洗一座 ——
// 关内做到一半的进度归零，是第 3 讲认下的换语言代价（Boss 同理）。
//
// 每趟开场先念一句分段提示「往北走2格，再往东走3格，就到啦！」（规划路线 从车当前位置现算，
// 见 路线.js）。走岔了（喊了没路的方向）就重念一遍，🔁 键随时可以再听一遍 —— 孩子照样自由地
// 用语音或四个方向钮开，提示只是搭把手，不代替他开。

import { 说 } from '/shared/js/说话.js';
import { 听一句, 收起麦克风 } from '/shared/js/问答.js';
import { 洗转写, 找方位词, 热词 } from '/shared/js/判对.js';
import { 音效 } from '/shared/js/音效.js';
import { 建路网, 开车 as 网上开车 } from '/shared/js/路网.js';
import { 元, 做进度点, 歇, 洗牌 } from '/shared/js/搭台.js';
import { 框心到舞台 } from '/shared/js/舞台.js';
import { 画实体 } from '/shared/js/实体图.js';
import { 生成小镇 } from '../小镇.js';
import { 规划路线 } from '../路线.js';
import { 台词, 模板 } from '../台词表.js';
import { 牌字, 名说 } from '../方位词.js';

// 这一关屏幕上出现的实体（规范名）。五个站牌是提示实体（孩子说的是方向），小汽车是主角。
// 实体图覆盖测试拿它对账，见 test/实体图覆盖.test.js。
export const 实体们 = [
  '游乐园', '猫猫家', '面包店', '博物馆', '兔子家', '小汽车',
];

const 话 = 台词.开车;
const 模 = 模板.开车;

// 小镇尺寸固定 6 行 × 7 列 —— 别改：CSS 的 .小镇网 写死了 repeat(7, ...)，
// 触屏热区尺寸也照这个盘推的。随机的是路怎么铺、站点落哪，不是盘多大。
const 行数 = 6;
const 列数 = 7;
const 订单数 = 3;

// 站点只留「身份」，位置由 生成小镇 每次现给。昵 = 念给孩子听的叫法（🐱 那站念「小猫」，不念「猫猫家」）。
const 站点 = [
  { 名: '游乐园', 图: '🎡', 英: 'amusement park' },
  { 名: '猫猫家', 图: '🐱', 英: "kitten's house", 昵: '小猫', 英昵: 'kitten' },
  { 名: '面包店', 图: '🍞', 英: 'bakery' },
  { 名: '博物馆', 图: '🏛️', 英: 'museum' },
  { 名: '兔子家', 图: '🐰', 英: "bunny's house", 昵: '小兔', 英昵: 'bunny' },
];
/** 这一站的昵称（没单独起昵称就用站名本身） */
const 昵说 = (站) => 名说({ 名: 站.昵 ?? 站.名, 英: 站.英昵 ?? 站.英 });
const 四方 = ['北', '南', '西', '东'];

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="大画框">
        <div class="小镇台" id="小镇台">
          <div class="小罗盘">
            <span class="小北" data-方="北"></span><span class="小南" data-方="南"></span>
            <span class="小西" data-方="西"></span><span class="小东" data-方="东"></span>
          </div>
          <div class="小镇网" id="小镇网"></div>
          <span class="小车" id="小车"></span>
        </div>
      </div>
      <button class="线索钮 热区" id="重念钮">🔁</button>
      <div class="方向盘" id="方向盘"></div>
      <div class="进度点挂" id="小镇进度"></div>
    </div>`;
  const 台 = 面板.querySelector('#小镇台');
  const 镇网 = 面板.querySelector('#小镇网');
  const 车 = 面板.querySelector('#小车');
  const 方向盘 = 面板.querySelector('#方向盘');
  const 重念钮 = 面板.querySelector('#重念钮');
  const 点 = 做进度点(面板.querySelector('#小镇进度'), 订单数);

  // 小车跟原来那个 🚗 同占 40px 的字号盒，摆车() 算的还是同一个中心点。
  // 车是 镇网 的**兄弟**、不在 镇网 里，所以重铺小镇（清空 镇网）不会连它一起清掉。
  车.appendChild(画实体('小汽车', '🚗', { 类名: '车图' }));

  // 方向盘：北在上的十字布局。钮面上印的就是这一讲要学的字（北 / NORTH）。
  // 热区：钮排在十字网格里（那个类由它自己建定位上下文），补一圈隐形的可点范围
  const 方向钮们 = {};
  for (const 方 of 四方) {
    const 钮 = 元('button', `方向钮 钮${方} 热区`);
    方向盘.appendChild(钮);
    方向钮们[方] = 钮;
  }

  // 小罗盘四个字 + 四个方向钮，换语言当场重写（面板不重建、跟小镇无关）
  const 罗盘字们 = [...面板.querySelectorAll('.小罗盘 [data-方]')];
  function 换语言() {
    for (const 字 of 罗盘字们) 字.textContent = 牌字(字.dataset.方);
    for (const [方, 钮] of Object.entries(方向钮们)) 钮.textContent = 牌字(方);
  }
  换语言();

  // 每次进关现铺：格元们（格子 DOM，摆车 靠它定位）、网（开车 用的路网）、
  // 车在（车现在哪一格）、当前目的地（这一趟送哪个站）。后两样 🔁 要拿来现算提示。
  let 格元们 = {};
  let 网 = null;
  let 车在 = null;
  let 当前目的地 = null;

  // 🔁 再念一遍这一趟的分段提示，**从车当前位置现算**（走岔了也给对的路）。
  // 直接 说() 就行：此刻坞是待命、没在录（听一句 只有孩子点大麦时才开录，且开录前先 闭嘴），
  // 这一声不会灌进录音 —— 同 宝藏 的 线索钮。两趟之间 当前目的地 是 null，按了不作声。
  重念钮.onclick = () => {
    if (!网 || !当前目的地 || !车在) return;
    const 步们 = 规划路线(网, 车在, 当前目的地);
    if (!步们 || !步们.length) return;
    音效.点一下();
    说(模.步数提示({ 步们 }));
  };

  /** 把这一座小镇铺到格网上：清空重铺格子、按新路格分 是路/是草、把站牌摆到各自随机位置 */
  function 铺镇(路格们, 站点带位) {
    const 路集 = new Set(路格们.map(({ 行, 列 }) => `${行},${列}`));
    镇网.replaceChildren();
    格元们 = {};
    for (let 行 = 0; 行 < 行数; 行 += 1) {
      for (let 列 = 0; 列 < 列数; 列 += 1) {
        const 格 = 元('div', 路集.has(`${行},${列}`) ? '镇格 是路' : '镇格 是草');
        镇网.appendChild(格);
        格元们[`${行},${列}`] = 格;
      }
    }
    // 站牌：贴纸图和 emoji 同占 44px 的字号盒。「游乐园」「猫猫家」按归一表折到摩天轮和小猫
    // 那两张图上（跟学校地图共用一只摩天轮、跟别的关共用同一只小猫）。
    for (const 站 of 站点带位) {
      const 牌 = 元('span', '站牌');
      牌.appendChild(画实体(站.名, 站.图, { 类名: '站实体图' }));
      牌.title = 站.名;
      格元们[`${站.行},${站.列}`].appendChild(牌);
    }
  }

  /**
   * 把车停到某一格的正中。折算走 框心到舞台()（两套坐标的换算只此一处，见 /shared/js/舞台.js）。
   *
   * 车是靠 CSS 的 translate(-50%,-50%) 居中的（见 styles.css 的 .小车），不是靠减自己
   * 半个身子，所以这儿没有 offsetWidth 那类本来就是舞台单位、不许再除的项。
   *
   * 当初直接把 rect 的数写进 style.left 时，症状不是报错：缩放不到一半的手机上，车会停在
   * 「到格子那段距离的四成多」处，一格一格越开越偏 —— 孩子听见「到啦」，车却明明在别的格子上。
   */
  function 摆车(格, 立刻) {
    const 中 = 框心到舞台(格元们[`${格.行},${格.列}`], 台);
    车.style.transition = 立刻 ? 'none' : 'left 0.45s linear, top 0.45s linear';
    车.style.left = `${中.x}px`;
    车.style.top = `${中.y}px`;
  }

  let 局 = 0;

  async function 进入() {
    const 本局 = ++局;
    const 还在 = () => 局 === 本局 && 面板.classList.contains('在前');
    点.清零();
    当前目的地 = null;

    // 现生成一座小镇，铺好格网、建好路网、把五个站身份配上随机位置
    const 小镇 = 生成小镇({ 行数, 列数, 站点数: 站点.length });
    网 = 建路网(行数, 列数, 小镇.路格们);
    const 站点带位 = 站点.map((站, i) => ({ ...站, ...小镇.站点位置们[i] }));
    铺镇(小镇.路格们, 站点带位);

    await 歇(60);

    车在 = { ...小镇.起点 };
    摆车(车在, true);

    await 说(话.开场);
    if (!还在()) return;

    const 今日订单 = 洗牌(站点带位).slice(0, 订单数); // 五站里随机挑三趟
    for (let 单 = 0; 单 < 今日订单.length; 单++) {
      const 目的地 = 今日订单[单];
      当前目的地 = 目的地;
      const 目的格 = 格元们[`${目的地.行},${目的地.列}`];
      目的格.classList.add('提示中');
      setTimeout(() => 目的格.classList.remove('提示中'), 3200);
      await 说(模.送客(名说(目的地), 昵说(目的地)));
      if (!还在()) return;

      // 开场分段提示：从车此刻的位置算一条到站的路，一段一段念（照着喊就能到）
      const 开场步们 = 规划路线(网, 车在, 目的地);
      if (开场步们 && 开场步们.length) await 说(模.步数提示({ 步们: 开场步们 }));
      if (!还在()) return;

      let 圈防呆 = 0;
      while (还在() && !(车在.行 === 目的地.行 && 车在.列 === 目的地.列)) {
        // 语音和按钮赛跑：谁先来听谁的
        const 方 = await new Promise((好) => {
          let 完 = false;
          const 出 = (答) => { if (!完) { 完 = true; 好(答); } };
          for (const 某方 of 四方) 方向钮们[某方].onclick = () => { 音效.点一下(); 出(某方); };
          听一句(热词(四方)).then((文) => {
            if (文 === null) { 出(null); return; }
            // 用 洗转写 而不是 归一化：它多做一道两语口头语的清洗
            // （"I think east" 不洗的话会粘成 ithinkeast，east 就找不着了）。
            // 中文那条路一字未变 —— 「往东走」洗完还是「往东走」。
            const 提到 = 找方位词(洗转写(文)).filter((词) => 四方.includes(词));
            出(提到.length ? 提到[提到.length - 1] : undefined);
          });
        });
        if (!还在()) return;
        if (方 === null) { 圈防呆 += 1; if (圈防呆 > 6) { await 说(话.也能点按钮); 圈防呆 = 0; } continue; }
        if (方 === undefined) { await 说(话.没听懂); continue; }

        const { 终点, 经过 } = 网上开车(网, 车在, 方, [目的地]);
        if (经过.length === 0) {
          音效.答错();
          await 说(模.没有路(方));
          if (!还在()) return;
          // 走岔了：把这一趟从当前位置重新算一遍，裹一层「再听一遍」念给他
          const 步们 = 规划路线(网, 车在, 目的地);
          if (步们 && 步们.length) await 说(模.重念(模.步数提示({ 步们 })));
          continue;
        }
        音效.点一下();
        for (const 步 of 经过) { 摆车(步); 车在 = 步; await 歇(470); }
        车在 = 终点;
        if (车在.行 === 目的地.行 && 车在.列 === 目的地.列) {
          音效.答对();
          目的格.classList.add('对了');
          setTimeout(() => 目的格.classList.remove('对了'), 800);
          await 说(模.到站(名说(目的地)));
          点.点亮(单);
        } else {
          await 说(话.到路口);
        }
      }
      if (!还在()) return;
    }

    当前目的地 = null;
    收起麦克风();
    await 工具.完成('开车');
    if (!还在()) return;
    await 说(话.收尾);
  }

  return { 进入, 换语言 };
}
