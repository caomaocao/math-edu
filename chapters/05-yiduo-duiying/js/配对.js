// 配对 —— 一一对应的「点谁 → 点哪儿」引擎（票 04）。本章模块：第一个要它的章，
// 暂不进 shared（家规：第二章要用时再升，别提前抽象）。现在只有帐篷站在用。
//
// 玩法：点一个实体（选中发光）→ 点一个归宿，即时判——判定纯本地，就是**颜色相等**，
// 无 ASR 介入。对了实体小跑进目标安家并锁定 + 音效；错了实体到目标处探个头、摇摇头
// 退回来，计一次错，进三次机会梯子（跟共享问答/摆放同一套精神，但这儿是颜色不是数量）：
//   错 1：鼓励再看看颜色。
//   错 2：提示——把还空着的归宿挨个点亮、把它的颜色念一遍。
//   错 3：演示——剩下的自动走对、把「按颜色对应」说破，照样过关拿星（星记完成不记全对）。
//
// 文件分两截：上半截是**无 DOM 的纯逻辑**（配对状态机 + 剩余项推演，进 node --test，
// 见 test/配对.test.js）；下半截是摆盘与动画。判定的每一步都先过纯函数再动 DOM——
// 屏幕永远只是状态机的影子，不许自己另记一份账。
//
// 话术是宿主注入的（摆放引擎的先例）：全是函数，说话那一刻才取词，语言活切换；
// 传字符串会把课焊死在配好的那门语言上。

import { 说 } from '/shared/js/说话.js';
import { 音效 } from '/shared/js/音效.js';
import { 画实体 } from '/shared/js/实体图.js';
import { 舞台系数 } from '/shared/js/舞台.js';
import { 元, 洗牌 } from '/shared/js/搭台.js';

const 歇 = (ms) => new Promise((好) => setTimeout(好, ms));

// ---------------------------------------------------------------------------
// 纯逻辑 —— 配对状态机。局是普通对象，reducer 不改旧局、回新局（好测，也好回放）。
//   局 = { 动物们, 归宿们, 选中, 配好: {动物名: 归宿名}, 错次 }
//   动物们 / 归宿们 = [{ 名, 色, 兜底? }]，色在各自一侧不许重复（颜色就是答案维度，
//   重了判定就有两个正确答案，出题的错就该在开局炸出来，别摆到孩子面前）。
// ---------------------------------------------------------------------------

/** 开一局。数量不齐、颜色对不上（两侧色集合不相等或有重色）都就地抛——配错阵是写代码时的事。 */
export function 开局({ 动物们, 归宿们 }) {
  if (!Array.isArray(动物们) || !Array.isArray(归宿们) || 动物们.length !== 归宿们.length || !动物们.length) {
    throw new TypeError('配对开局：动物们和归宿们要一样多，且至少一对');
  }
  for (const 侧 of [动物们, 归宿们]) {
    const 色集 = new Set(侧.map((x) => x.色));
    if (色集.size !== 侧.length) throw new TypeError('配对开局：同一侧的颜色不许重复（色就是答案）');
  }
  const 甲 = [...动物们].map((x) => x.色).sort().join('|');
  const 乙 = [...归宿们].map((x) => x.色).sort().join('|');
  if (甲 !== 乙) throw new TypeError('配对开局：两侧颜色对不上，有实体配不到归宿');
  return { 动物们, 归宿们, 选中: null, 配好: {}, 错次: 0 };
}

const 找 = (们, 名) => 们.find((x) => x.名 === 名);

/** 点一只实体。已安家的、不认识的一律 没理；否则选中它（重复点同一只也还是选中，无害）。 */
export function 点动物(局, 名) {
  if (!找(局.动物们, 名) || 局.配好[名]) return { 局, 动作: '没理' };
  return { 局: { ...局, 选中: 名 }, 动作: '选中' };
}

/**
 * 点一个归宿。没选中实体、归宿已有主、不认识的 → 没理（不计错——孩子先摸摸帐篷不算答题）。
 * 颜色相等 → 安家（配好记上、选中清空）；不等 → 摇头（错次 +1，选中保留让孩子接着试），
 * 梯级 = min(错次, 3)：1 鼓励、2 提示、3 演示。
 */
export function 点归宿(局, 名) {
  const 它 = 找(局.归宿们, 名);
  if (!它 || !局.选中 || Object.values(局.配好).includes(名)) return { 局, 动作: '没理' };
  const 动物 = 找(局.动物们, 局.选中);
  if (动物.色 === 它.色) {
    return {
      局: { ...局, 配好: { ...局.配好, [局.选中]: 名 }, 选中: null },
      动作: '安家', 动物: 动物.名, 归宿: 名,
    };
  }
  const 错次 = 局.错次 + 1;
  return { 局: { ...局, 错次 }, 动作: '摇头', 梯级: Math.min(错次, 3) };
}

/** 还空着的归宿，按开局顺序（错 2 的提示挨个念亮用它）。 */
export function 空归宿们(局) {
  const 占了 = new Set(Object.values(局.配好));
  return 局.归宿们.filter((h) => !占了.has(h.名));
}

/**
 * 剩余项推演：没安家的实体各自该去哪儿（错 3 的演示照这个单子走）。
 * 色在两侧各唯一，所以答案是确定的一份。
 */
export function 剩余对(局) {
  const 占了 = new Set(Object.values(局.配好));
  return 局.动物们
    .filter((a) => !局.配好[a.名])
    .map((a) => ({ 动物: a.名, 归宿: 局.归宿们.find((h) => !占了.has(h.名) && h.色 === a.色).名 }));
}

/** 全配好了没。 */
export function 全配好(局) {
  return 局.动物们.every((a) => 局.配好[a.名]);
}

// ---------------------------------------------------------------------------
// 摆盘与动画 —— 从这儿往下碰 DOM。
// ---------------------------------------------------------------------------

/** 话术注入面：缺一样就地抛（摆放引擎 定配 的同款道理——接错线该在孩子看到之前炸）。 */
function 查话术(话术) {
  for (const 键 of ['错1', '提示头', '念色', '演示头', '说破']) {
    if (typeof 话术?.[键] !== 'function') {
      throw new TypeError(`配对引擎缺配：话术.${键} 要是函数（说话那一刻才取词）`);
    }
  }
  return 话术;
}

/** 脸 = 实体图（缺图落兜底 emoji，都走渲染单闸）包一层 span——兜底是文本节点，包住才好挪好摇。 */
function 造脸(名, 兜底) {
  const 脸 = 元('span', '配对脸');
  脸.appendChild(画实体(名, 兜底));
  return 脸;
}

/**
 * 搭盘：归宿一排在上、实体一排在下，两排都洗过牌（别让孩子背位置）。
 * 触靶：两排里**相邻都是另一个答案**，不叠热区、真放大——尺寸账在 styles.css 帐篷站段。
 */
function 搭盘(挂点, 动物们, 归宿们) {
  挂点.textContent = '';
  const 归宿排 = 元('div', '配对排 归宿排');
  const 归宿位们 = {};
  for (const h of 洗牌(归宿们)) {
    const 位 = 元('button', '归宿位');
    位.type = 'button';
    位.setAttribute('aria-label', h.名); // 读屏用；屏幕上无字（童-UI 铁律）
    位.appendChild(造脸(h.名, h.兜底));
    const 安家点 = 元('span', '安家点');
    位.appendChild(安家点);
    归宿排.appendChild(位);
    归宿位们[h.名] = 位;
  }
  const 动物排 = 元('div', '配对排 动物排');
  const 动物位们 = {};
  for (const a of 洗牌(动物们)) {
    const 位 = 元('button', '动物位');
    位.type = 'button';
    位.setAttribute('aria-label', a.名);
    const 跑袋 = 元('span', '跑袋');
    跑袋.appendChild(造脸(a.名, a.兜底));
    位.appendChild(跑袋);
    动物排.appendChild(位);
    动物位们[a.名] = 位;
  }
  挂点.append(归宿排, 动物排);
  return { 动物位们, 归宿位们 };
}

/**
 * 安家：实体的跑袋挪进归宿的安家点，FLIP 补间成「小跑过去」。
 * 量出来的 rect 是视觉坐标，transform 写的是舞台坐标——差一个 舞台系数()，
 * 不除回去孩子在手机上会看到实体飞错地方（CLAUDE.md 触屏节的那条账）。
 * 静默 = 面板已不在前（孩子中途走了）：直接落位不演不响，绝不把动画欠成死锁。
 */
async function 安家动画(动物位, 归宿位, { 静默 = false } = {}) {
  const 跑袋 = 动物位.querySelector('.跑袋');
  const 安家点 = 归宿位.querySelector('.安家点');
  动物位.classList.remove('选中');
  动物位.classList.add('空了');
  动物位.disabled = true;
  归宿位.classList.add('有主');
  归宿位.disabled = true;
  const 前 = 跑袋.getBoundingClientRect();
  安家点.appendChild(跑袋);
  if (静默) return;
  const 后 = 跑袋.getBoundingClientRect();
  const 系 = 舞台系数() || 1;
  const dx = (前.left + 前.width / 2 - 后.left - 后.width / 2) / 系;
  const dy = (前.top + 前.height / 2 - 后.top - 后.height / 2) / 系;
  const 缩 = 后.width ? 前.width / 后.width : 1;
  跑袋.style.transition = 'none';
  跑袋.style.transform = `translate(${dx}px, ${dy}px) scale(${缩})`;
  void 跑袋.offsetWidth; // 先钉回原位再补间，不闪
  跑袋.style.transition = 'transform 0.55s cubic-bezier(0.34, 1.3, 0.42, 1)';
  跑袋.style.transform = '';
  await 歇(580);
  跑袋.style.transition = '';
}

/** 摇头退回：实体飞到归宿的安家点探个头，摇摇头，再飞回来。全程锁着盘。 */
async function 摇头动画(动物位, 归宿位) {
  const 跑袋 = 动物位.querySelector('.跑袋');
  const 脸 = 跑袋.querySelector('.配对脸');
  const 点 = 归宿位.querySelector('.安家点');
  const 甲 = 跑袋.getBoundingClientRect();
  const 乙 = 点.getBoundingClientRect();
  const 系 = 舞台系数() || 1;
  const dx = (乙.left + 乙.width / 2 - 甲.left - 甲.width / 2) / 系;
  const dy = (乙.top + 乙.height / 2 - 甲.top - 甲.height / 2) / 系;
  跑袋.style.transition = 'transform 0.4s ease';
  跑袋.style.transform = `translate(${dx}px, ${dy}px)`;
  await 歇(430);
  音效.答错();
  脸.classList.add('摇一摇');
  await 歇(500);
  脸.classList.remove('摇一摇');
  跑袋.style.transform = '';
  await 歇(430);
  跑袋.style.transition = '';
}

/**
 * 玩一轮({ 挂点, 动物们, 归宿们, 话术, 走查 }) → Promise<{ 演示过 }>。
 * 全配好（亲手或演示）才 resolve。搭盘是同步的——调用的那一刻孩子就看得见台子，
 * 宿主再开口念开场白（先摆台子后开口的家规）。
 * 走查() 回假 = 面板已不在前：点击一律作废，提示就地打住，演示改静默快进——
 * 快进是防死锁：演示要是半途弃了，锁着的盘谁也救不回来。
 */
export function 玩一轮({ 挂点, 动物们, 归宿们, 话术, 走查 = () => true }) {
  查话术(话术);
  let 局 = 开局({ 动物们, 归宿们 });
  const { 动物位们, 归宿位们 } = 搭盘(挂点, 动物们, 归宿们);
  let 锁 = false;

  return new Promise((结束) => {
    async function 提示() {
      if (走查()) await 说(话术.提示头());
      for (const h of 空归宿们(局)) {
        if (!走查()) return;
        归宿位们[h.名].classList.add('提示中');
        await 说(话术.念色(h.色));
        归宿位们[h.名].classList.remove('提示中');
      }
    }

    async function 演示() {
      if (走查()) await 说(话术.演示头());
      for (const { 动物, 归宿 } of 剩余对(局)) {
        const 静默 = !走查();
        局 = 点归宿(点动物(局, 动物).局, 归宿).局;
        if (!静默) {
          动物位们[动物].classList.add('选中');
          音效.点一下();
          await 歇(340);
        }
        await 安家动画(动物位们[动物], 归宿位们[归宿], { 静默: !走查() });
        if (走查()) { 音效.答对(); await 歇(220); }
      }
      if (走查()) await 说(话术.说破());
    }

    for (const [名, 位] of Object.entries(动物位们)) {
      位.addEventListener('click', () => {
        if (锁 || !走查()) return;
        const 果 = 点动物(局, 名);
        局 = 果.局;
        if (果.动作 !== '选中') return;
        for (const 别位 of Object.values(动物位们)) 别位.classList.remove('选中');
        位.classList.add('选中');
        音效.点一下();
      });
    }

    for (const [名, 位] of Object.entries(归宿位们)) {
      位.addEventListener('click', async () => {
        if (锁 || !走查()) return;
        const 之前选中 = 局.选中;
        const 果 = 点归宿(局, 名);
        if (果.动作 === '没理') return;
        局 = 果.局;
        锁 = true; // 动画和梯子说完之前不收新答案（在途锁——防呆票的先例）
        if (果.动作 === '安家') {
          await 安家动画(动物位们[果.动物], 归宿位们[果.归宿]);
          音效.答对();
          if (全配好(局)) { 结束({ 演示过: false }); return; }
          锁 = false;
          return;
        }
        // 摇头：退回后进梯子
        await 摇头动画(动物位们[之前选中], 位);
        if (果.梯级 === 1) {
          if (走查()) await 说(话术.错1());
          锁 = false;
          return;
        }
        if (果.梯级 === 2) {
          await 提示();
          锁 = false;
          return;
        }
        await 演示();
        结束({ 演示过: true });
      });
    }
  });
}

/**
 * 摆完局({ 挂点, 动物们, 归宿们 })：把「全配好」的终局直接摆出来（不接点击、不出声）。
 * 刷新后回访已完成的站用——孩子该看到成果，不是一块空台子。
 */
export function 摆完局({ 挂点, 动物们, 归宿们 }) {
  const 局 = 开局({ 动物们, 归宿们 });
  const { 动物位们, 归宿位们 } = 搭盘(挂点, 动物们, 归宿们);
  for (const { 动物, 归宿 } of 剩余对(局)) {
    // 静默安家：不量不补间，直接落位
    安家动画(动物位们[动物], 归宿位们[归宿], { 静默: true });
  }
}
