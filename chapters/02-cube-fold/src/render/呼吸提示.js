import * as THREE from '/shared/vendor/three/three.module.js';

import { CELL_SIZE } from '../domain/net.js';

/**
 * 「这一片能折」—— 手指版。
 *
 * 桌面上这句话是光标说的：鼠标停在能折的那一片上，光标变成小手（见 foldHand.js
 * 那句「孩子不认字，『这里能点』只能靠光标说」）。手机上没有光标、也没有「停在
 * 上面」这回事，那句话就整个消失了 —— 孩子面对六片一模一样的纸，没有任何线索
 * 说该点哪一片。全站唯一一处「光标是唯一信号」的地方，所以 docs/adr/0004 单点了它。
 *
 * 补的是一圈会呼吸的白边：能折的那几片各蒙一层只有边缘发亮的膜，明暗慢慢起落。
 * 三条自律：
 *   · **真值只有一个**：能折哪几片一律问 `可折(下标)`，跟折纸手问的是同一个函数
 *     （main.js 里那一个 const，两处共用）。这儿一个字节的「谁能折」都不存 ——
 *     存了就有第二套状态，迟早跟折纸手对不上。
 *   · **只在粗指针设备上出现**：桌面照旧靠光标，屏幕上不多一样会动的东西。
 *     媒体查询伸不进画布里，所以这一条只能在 JS 里读。
 *   · **慢**。给五岁孩子看的屏幕不是老虎机：一次呼吸走三秒多，亮的那一头也压得住，
 *     孩子扫一眼知道「这几片可以碰」，不至于被吸着盯住不动。
 *     系统里开了「减少动态效果」就不呼吸，停在一个静止的亮度上 —— 提示照旧在，
 *     只是不动了。
 *
 * 中间必须透：底下那格水果和颜色是孩子把三维和平面对上号的唯一线索，蒙糊了就断了。
 * 亮边的路子跟 oppositeGlow / failureCue 是一套（加色混合的一层膜，不染材质本身）——
 * 直接把材质染亮会跟贴图相乘，水果整个糊掉。
 */

/** 膜比格子大一丁点，白边刚好压在纸的边缘上而不是缩在里面 */
const 膜边长 = CELL_SIZE * 1.04;

/** 一次呼吸多少秒（越长越安静）。3.4 秒上下，比心跳慢，接近方方闲着时的那种起伏 */
const 一次呼吸 = 3.4;
/** 暗的那一头 / 亮的那一头。上限压在 0.5 以下：这是提示，不是庆祝 */
const 最暗 = 0.16;
const 最亮 = 0.46;
/** 不许动的时候停在哪 —— 取中间偏亮，静止的提示得看得出来 */
const 不动时 = (最暗 + 最亮) / 2;

/**
 * @param {{cellMeshes: THREE.Mesh[]}} 衣服 一张折起来的衣服（FoldedNet）
 * @param {{
 *   可折: (格子下标: number) => boolean,
 *   粗指针?: () => boolean,
 *   少动画?: () => boolean,
 *   做贴图?: () => THREE.Texture,
 * }} 接线 可折 必须就是折纸手手里那一个函数，别在这儿另写一份判断
 */
export function 创建呼吸提示(衣服, { 可折, 粗指针 = 默认粗指针, 少动画 = 默认少动画, 做贴图 = 做呼吸贴图 } = {}) {
  /** @type {Map<number, THREE.Mesh>} 下标 → 那一片上蒙着的膜。是 可折 的**投影**，不是第二份真值 */
  const 膜们 = new Map();
  let 贴图 = null;
  let 几何 = null;

  function 蒙一层(下标) {
    const 片 = 衣服.cellMeshes?.[下标];
    if (!片) return null;
    贴图 ??= 做贴图();
    几何 ??= new THREE.PlaneGeometry(膜边长, 膜边长);
    const 膜 = new THREE.Mesh(
      几何,
      new THREE.MeshBasicMaterial({
        map: 贴图,
        transparent: true,
        opacity: 不动时,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    膜.name = `呼吸${下标}`;
    // 排在红膜（1）、漏洞牌（2）、对面发光膜（3）前面：那几样都是「出了什么事」，
    // 比「这里能点」要紧，谁在上面看得出优先次序
    膜.renderOrder = 1;
    片.add(膜);
    return 膜;
  }

  function 撤一层(下标) {
    const 膜 = 膜们.get(下标);
    if (!膜) return;
    膜.removeFromParent();
    膜.material.dispose();
    膜们.delete(下标);
  }

  /** 每帧叫一次。谁能折现问一遍，膜跟着长跟着撤 —— 这样就没有「记着的可折」可漂移 */
  const 更新 = (秒) => {
    const 该有 = 粗指针();
    for (let i = 0; i < (衣服.cellMeshes?.length ?? 0); i += 1) {
      const 要 = 该有 && 可折(i);
      if (要 && !膜们.has(i)) {
        const 膜 = 蒙一层(i);
        if (膜) 膜们.set(i, 膜);
      } else if (!要 && 膜们.has(i)) {
        撤一层(i);
      }
    }
    if (膜们.size === 0) return;

    // 一起呼吸，不错开相位：六片纸各喘各的会像一堆在闪的东西，
    // 齐着起落看着才是「这一件衣服在等你动手」
    const 亮 = 少动画()
      ? 不动时
      : 最暗 + (最亮 - 最暗) * (0.5 + 0.5 * Math.sin((秒 * Math.PI * 2) / 一次呼吸));
    for (const 膜 of 膜们.values()) 膜.material.opacity = 亮;
  };

  const 清除 = () => {
    for (const 下标 of [...膜们.keys()]) 撤一层(下标);
  };

  const dispose = () => {
    清除();
    贴图?.dispose();
    几何?.dispose();
    贴图 = null;
    几何 = null;
  };

  return {
    更新,
    清除,
    dispose,
    /** 现在哪几片在呼吸（自动化验收要用；真值仍旧是 可折，这只是当下的投影） */
    get 呼吸着的() {
      return [...膜们.keys()].sort((a, b) => a - b);
    },
  };
}

/** 手指设备吗。每帧现问：媒体查询列表是活的，插上鼠标当场就变，不用自己订阅 */
function 默认粗指针() {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
}

/** 系统里开了「减少动态效果」吗 */
function 默认少动画() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

/**
 * 呼吸膜的贴图：中间全透，只有靠边一圈白。
 *
 * 中间留空是硬要求（同 oppositeGlow 的发光膜）：蒙上去以后水果和颜色还得认得出来。
 * 白边也不画成一条锐利的框 —— 边缘糊一点才像光，锐的看着像选中框，
 * 而这一讲的「选中」另有其人（对面高亮那三种颜色）。
 */
function 做呼吸贴图() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  const 光 = ctx.createRadialGradient(64, 64, 30, 64, 64, 72);
  光.addColorStop(0, 'rgba(255, 255, 255, 0)');
  光.addColorStop(0.7, 'rgba(255, 255, 255, 0.06)');
  光.addColorStop(1, 'rgba(255, 255, 255, 0.5)');
  ctx.fillStyle = 光;
  ctx.fillRect(0, 0, 128, 128);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';
  ctx.strokeRect(5, 5, 118, 118);

  const 贴图 = new THREE.CanvasTexture(canvas);
  贴图.colorSpace = THREE.SRGBColorSpace;
  return 贴图;
}
