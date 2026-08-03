import * as THREE from '/shared/vendor/three/three.module.js';

import { CELL_SIZE } from '../domain/net.js';
import { 对面色 } from '../domain/palette.js';

/**
 * 点面看对面 —— 三维那一半。
 *
 * 孩子点一个面，整个正方体变半透明，被点的面和它的对面一起发光，其余四个面暗下去。
 * 半透明不是好看，是这一票的全部意义：**孩子要能真的看穿过去**，
 * 亲眼看见背面那个也在亮 —— 「对面」这个词才有东西可指。
 *
 * 发光是蒙在格子上的一层膜（跟穿不上提示的红膜一个路子）：
 * 直接把材质染亮会跟贴图相乘，水果糊成一片，孩子就认不出是哪一格了。
 */

/** 被点的那一对：留一点透明度，好让背面那片光透过来 */
const 亮面不透明度 = 0.88;
/**
 * 其余四个面：淡到看得穿，但**不能淡到没有**。
 * 太浓就把背面那片光藏住了；太淡正方体就散成两片飘着的发光牌子，
 * 孩子看不出这两个面长在同一个正方体上，「对面」也就无从谈起。
 */
const 暗面不透明度 = 0.24;

/** 发光膜比格子大一圈，光晕溢到边缘外面去，像真的在发光 */
const 发光膜边长 = CELL_SIZE * 1.02;

/**
 * @param {{cellMeshes: THREE.Mesh[]}} 衣服 一张折起来的衣服（FoldedNet）
 * @param {{做贴图?: () => THREE.Texture}} options 贴图要画 canvas，测试里换成假的就能在 node 里跑
 */
export function 创建对面高亮(衣服, { 做贴图 = 做发光贴图 } = {}) {
  /**
   * 材质是外面传进来、几张衣服共用的（见 main.js 的材质池），
   * 半透明是**借用**，不是改写：借之前先把原样抄一份，清除时一字不差地还回去。
   */
  const 原样 = 衣服.cellMeshes.map((mesh) =>
    mesh
      ? {
          transparent: mesh.material.transparent,
          opacity: mesh.material.opacity,
          depthWrite: mesh.material.depthWrite,
          renderOrder: mesh.renderOrder,
        }
      : null,
  );

  /** @type {THREE.Mesh[]} */
  let 发光膜 = [];
  let 当前对子 = null;
  let 贴图 = null;
  let 几何 = null;

  /**
   * 亮出一对对面。
   * @param {[number, number]} 格子对 这一对是哪两个格子
   * @param {number} 序 第几对（0/1/2），决定发光色
   */
  const 显示 = (格子对, 序 = 0) => {
    清除();
    当前对子 = { 格子对: [...格子对], 序 };

    const 色 = new THREE.Color(对面色(序));

    衣服.cellMeshes.forEach((mesh, 下标) => {
      if (!mesh) return;
      const 亮 = 格子对.includes(下标);
      const 材质 = mesh.material;
      材质.transparent = true;
      材质.opacity = 亮 ? 亮面不透明度 : 暗面不透明度;
      // 六个面都不写深度：写了的话，正面那片会把背面那片的光挡在深度缓冲外头，
      // 半透明就白透了 —— 孩子看穿过去什么也看不见
      材质.depthWrite = false;
      材质.needsUpdate = true;
      if (亮) 发光膜.push(蒙一层光(mesh, 色));
    });
  };

  /** 发光膜用加色混合：底下是什么水果颜色都会被提亮，不会把贴图盖掉 */
  function 蒙一层光(mesh, 色) {
    贴图 ??= 做贴图();
    几何 ??= new THREE.PlaneGeometry(发光膜边长, 发光膜边长);
    const 膜 = new THREE.Mesh(
      几何,
      new THREE.MeshBasicMaterial({
        map: 贴图,
        color: 色,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    膜.name = '发光膜';
    // 排在所有面后面画，正对着镜头的那几片半透明的面就挡不住背面这层光
    膜.renderOrder = 3;
    mesh.add(膜);
    return 膜;
  }

  /** 每帧叫一次：光一呼一吸，孩子的眼睛会自己跟过去 */
  const 更新 = (秒) => {
    for (const 膜 of 发光膜) {
      膜.material.opacity = 0.74 + 0.26 * (0.5 + 0.5 * Math.sin(秒 * 3.4));
    }
  };

  /** 收起高亮，正方体恢复不透明 */
  const 清除 = () => {
    for (const 膜 of 发光膜) {
      膜.removeFromParent();
      膜.material.dispose();
    }
    发光膜 = [];

    衣服.cellMeshes.forEach((mesh, 下标) => {
      const 旧 = 原样[下标];
      if (!mesh || !旧) return;
      mesh.material.transparent = 旧.transparent;
      mesh.material.opacity = 旧.opacity;
      mesh.material.depthWrite = 旧.depthWrite;
      mesh.material.needsUpdate = true;
      mesh.renderOrder = 旧.renderOrder;
    });
    当前对子 = null;
  };

  const dispose = () => {
    清除();
    贴图?.dispose();
    几何?.dispose();
    贴图 = null;
    几何 = null;
  };

  return {
    显示,
    更新,
    清除,
    dispose,
    get 在显示() {
      return 当前对子 !== null;
    },
    /** 现在亮着的是哪一对（自动化验收要用） */
    get 对子() {
      return 当前对子 && { 格子对: [...当前对子.格子对], 序: 当前对子.序 };
    },
  };
}

/**
 * 发光膜的贴图：中间淡、边缘亮的一圈光。
 *
 * 中间必须淡 —— 蒙上去之后水果和颜色还得认得出来，
 * 那是孩子把这个面和平面上那一格对上号的唯一线索。
 */
function 做发光贴图() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const 光 = ctx.createRadialGradient(128, 128, 24, 128, 128, 150);
  光.addColorStop(0, 'rgba(255, 255, 255, 0.07)');
  光.addColorStop(0.55, 'rgba(255, 255, 255, 0.16)');
  光.addColorStop(1, 'rgba(255, 255, 255, 0.48)');
  ctx.fillStyle = 光;
  ctx.fillRect(0, 0, 256, 256);

  // 一圈亮边，正方体的棱在半透明状态下才看得清是从哪儿折过去的
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = 18;
  ctx.lineJoin = 'round';
  ctx.strokeRect(14, 14, 228, 228);

  const 贴图 = new THREE.CanvasTexture(canvas);
  贴图.colorSpace = THREE.SRGBColorSpace;
  return 贴图;
}
