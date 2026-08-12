// 帐篷站 —— 一一对应（书第 52 页 例1 + 练一练的活版）。配对引擎（../配对.js）的第一个宿主。
// A 轮：四只小动物按体色住四顶同色帐篷 → 小转场（**下雨音效就是转场信号**，雨声现场
// 合成 + 一层雨幕）→ B 轮：同四只挑四把同色雨伞。完 B 轮 工具.完成('帐篷站') 拿星。
//
// 四动物四色是 03 票的定案（.scratch/yiduo-duiying/issues/03 票尾）：
// 青蛙-绿 / 瓢虫-红 / 小鸟-蓝 / 小熊-棕；帐篷、雨伞一色一素材名（绿帐篷…棕雨伞）。
//
// 站内轮次进度落「柜」（工具.记/取，跟星星一起存、同步、被重来清）；轮内已配对的
// 不落柜——面板常驻不卸载，中途退站再进它们还在（家规），刷新丢半轮不心疼。
// 「搭过」是重来的哨兵：柜被清它就没了，下次进站发现链还活着但哨兵没了 → 拆台重开。

import { 说 } from '/shared/js/说话.js';
import { 音效, 解锁 } from '/shared/js/音效.js';
import { 元 } from '/shared/js/搭台.js';
import { 玩一轮, 摆完局 } from '../配对.js';
import { 台词 } from '../台词表.js';
import { 站点表 } from '../站点表.js';

const 歇 = (ms) => new Promise((好) => setTimeout(好, ms));

/** 配对四动物四色（03 票定案）。导出给测试咬：动物、颜色、素材名三者对齐是本站的地基。 */
export const 配对阵 = Object.freeze([
  Object.freeze({ 名: '青蛙', 兜底: '🐸', 色: '绿' }),
  Object.freeze({ 名: '瓢虫', 兜底: '🐞', 色: '红' }),
  Object.freeze({ 名: '小鸟', 兜底: '🐦', 色: '蓝' }),
  Object.freeze({ 名: '小熊', 兜底: '🐻', 色: '棕' }),
]);

const 归宿兜底 = { 帐篷: '⛺', 雨伞: '☂️' };
const 归宿名单 = (类) => 配对阵.map(({ 色 }) => ({ 名: `${色}${类}`, 兜底: 归宿兜底[类], 色 }));

// 四动物 + 四色帐篷 + 四色雨伞，预热与覆盖测试同吃这一个导出（家规接缝）。
export const 实体们 = [
  ...配对阵.map(({ 名 }) => 名),
  ...归宿名单('帐篷').map(({ 名 }) => 名),
  ...归宿名单('雨伞').map(({ 名 }) => 名),
];

const 话 = 台词.帐篷站;
const 配话 = 台词.配对;

// 台账单一出处：两轮叫什么、有几对，都听 站点表 的（改题面只许改那儿）。
const 台账 = 站点表.find((条) => 条.号 === '帐篷站').台账;
const 轮们 = 台账.轮们; // ['帐篷', '雨伞']

/** 下雨声 —— 转场信号。借 音效.js 的 解锁() 拿同一个 AudioContext，白噪声过带通就是雨。
 *  失败静默：雨声哑了转场照走，绝不拦孩子。 */
function 下雨声(秒 = 2.8) {
  let 音台;
  try { 音台 = 解锁(); } catch { return; }
  if (!音台) return;
  try {
    const 帧 = Math.floor(音台.sampleRate * 秒);
    const 缓冲 = 音台.createBuffer(1, 帧, 音台.sampleRate);
    const 阵 = 缓冲.getChannelData(0);
    for (let i = 0; i < 帧; i += 1) 阵[i] = Math.random() * 2 - 1;
    const 源 = 音台.createBufferSource();
    源.buffer = 缓冲;
    const 高通 = 音台.createBiquadFilter();
    高通.type = 'highpass';
    高通.frequency.value = 500;
    const 低通 = 音台.createBiquadFilter();
    低通.type = 'lowpass';
    低通.frequency.value = 3800;
    const 幅 = 音台.createGain();
    const 起 = 音台.currentTime;
    幅.gain.setValueAtTime(0.0001, 起);
    幅.gain.linearRampToValueAtTime(0.16, 起 + 0.4);
    幅.gain.setValueAtTime(0.16, 起 + 秒 - 0.8);
    幅.gain.linearRampToValueAtTime(0.0001, 起 + 秒);
    源.connect(高通).connect(低通).connect(幅).connect(音台.destination);
    源.start(起);
    源.stop(起 + 秒 + 0.05);
  } catch { /* 合成不了就静默 */ }
}

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="进度点挂"><div class="进度点排" id="帐篷进度"></div></div>
      <div class="帐篷台" id="帐篷台"></div>
    </div>`;
  const 台 = 面板.querySelector('#帐篷台');
  const 点排 = 面板.querySelector('#帐篷进度');
  const 台面 = 面板.querySelector('.舞台布');

  const 话术 = {
    错1: () => 配话.错1,
    提示头: () => 配话.提示头,
    念色: (色) => 配话[`色${色}`],
    演示头: () => 配话.演示头,
    说破: () => 配话.说破,
  };

  function 刷进度点(轮) {
    点排.textContent = '';
    for (let i = 0; i < 轮们.length; i += 1) {
      点排.appendChild(元('span', i < 轮 ? '进度点 亮' : '进度点'));
    }
  }

  async function 下雨转场() {
    下雨声();
    const 幕 = 元('div', '雨幕');
    for (let i = 0; i < 18; i += 1) {
      const 滴 = 元('span', '雨滴');
      滴.style.left = `${(i + Math.random()) * (100 / 18)}%`;
      滴.style.animationDelay = `${(Math.random() * 0.9).toFixed(2)}s`;
      滴.style.animationDuration = `${(0.7 + Math.random() * 0.5).toFixed(2)}s`;
      幕.appendChild(滴);
    }
    台面.appendChild(幕);
    await 说(话.下雨啦);
    await 歇(1400);
    幕.remove();
  }

  // 链 = 从当前轮一路跑到完站的那条流程，整站只跑一条。跟 进入 解耦：进出站不重跑，
  // 只有重来（哨兵没了）才拆台重开。
  let 链 = null;

  function 拆台() {
    链 = null;
    台.textContent = '';
  }

  function 开链(从轮) {
    const 本链 = {};
    链 = 本链;
    工具.记('帐篷站搭过', true); // 重来哨兵：柜被清它就没了
    const 活 = () => 链 === 本链;
    const 显 = () => 活() && 面板.classList.contains('在前');
    (async () => {
      for (let 轮 = 从轮; 轮 < 轮们.length; 轮 += 1) {
        // 搭盘同步先行，孩子先看见台子再听指令（先摆台子后开口的家规）；
        // 从轮那次的开场白由 进入() 念，后面的轮换完场由链自己念。
        const 这轮 = 玩一轮({
          挂点: 台,
          动物们: 配对阵,
          归宿们: 归宿名单(轮们[轮]),
          话术,
          走查: 显,
        });
        if (轮 !== 从轮 && 显()) await 说(话.开场雨伞);
        await 这轮;
        if (!活()) return;
        工具.记('帐篷站轮', 轮 + 1);
        刷进度点(轮 + 1);
        if (轮 === 0) {
          if (显()) await 说(话.帐篷好了);
          if (显()) await 下雨转场();
          if (!活()) return;
        }
      }
      if (!活()) return;
      if (面板.classList.contains('在前')) await 说(话.全都好了);
      await 工具.完成('帐篷站'); // 演示过关也照样拿星（梯子的允诺）
    })();
  }

  async function 进入() {
    // 重来把柜清空了：链还活着但哨兵没了 → 拆台，从头再玩
    if (链 && !工具.取('帐篷站搭过')) 拆台();
    const 轮 = 工具.取('帐篷站轮') || 0;
    刷进度点(Math.min(轮, 轮们.length));
    if (轮 >= 轮们.length) {
      // 全完成的回访：台子空着（多半是刷新过）就把终局摆出来，孩子看成果不看空台
      if (!台.hasChildNodes()) {
        摆完局({ 挂点: 台, 动物们: 配对阵, 归宿们: 归宿名单(轮们[轮们.length - 1]) });
      }
      await 说(话.都好过了);
      return;
    }
    if (!链) 开链(轮);
    await 说(轮 === 0 ? 话.开场帐篷 : 话.开场雨伞);
  }

  return { 进入 };
}
