import * as THREE from '/shared/vendor/three/three.module.js';

import { CELL_SIZE } from '../domain/net.js';

/**
 * 穿不上的时候，把毛病指给孩子看。
 *
 * 重叠和漏洞必定成对出现，数量相等（见 CONTEXT.md）——
 * 所以这里**两个都要指**：撞在一起的格子染红发抖，没人盖的那个面框一圈黄光。
 * 只指重叠，孩子会以为「挪开一点就好了」；两个一起看，才知道纸就是不够铺满六个面。
 */

/** 正方体六个面的朝外法线。根格子折起来永远是底面 -y */
const 面法线表 = {
  '+x': [1, 0, 0],
  '-x': [-1, 0, 0],
  '+y': [0, 1, 0],
  '-y': [0, -1, 0],
  '+z': [0, 0, 1],
  '-z': [0, 0, -1],
};

export function 面法线(面) {
  const v = 面法线表[面];
  if (!v) throw new Error(`认不出这个面：${面}`);
  return new THREE.Vector3(...v);
}

/** 正方体中心在衣服局部坐标里的位置：根格子是底面，所以往上半格 */
export const 正方体中心 = new THREE.Vector3(0, CELL_SIZE / 2, 0);

const 红 = new THREE.Color('#ff2d3f');

/**
 * 染红用的是**蒙在格子上的一层半透明红**，不是把格子本身染成红的。
 *
 * 直接把材质染红，颜色会跟贴图相乘，水果整个糊成一团暗红 ——
 * 孩子就认不出是哪两格撞上了。蒙一层薄红，红看得见，水果也还认得出。
 */
const 红膜透明度 = 0.6;

// ---------------------------------------------------------------------------
// 转到哪个角度，才能同时看见红和黄
// ---------------------------------------------------------------------------

/** 正对着镜头才算看得清；擦着边看等于没看见 */
const 看得清的最小夹角 = 0.1;

/**
 * 一个面从这个方向看过去，看得见多少。
 *
 * 背对镜头的面本来是看不见的，但有个例外：它正好在一个看得见的**漏洞**对面时，
 * 透过那个洞就能看见它的里子 —— 漏洞是个真的窟窿，不是贴上去的牌子。
 * 重叠和漏洞正好落在一对对面上的时候（比如两头都堵、中间空），全靠这一条。
 */
function 可见度(方向, 面, 漏洞面) {
  const n = 面法线(面);
  const 正对 = 方向.dot(n);
  if (正对 > 看得清的最小夹角) return 正对;

  const 透过洞看得见 = 漏洞面.some((洞) => {
    const 洞法线 = 面法线(洞);
    return 洞法线.dot(n) < -0.9 && 方向.dot(洞法线) > 0.3;
  });
  return 透过洞看得见 ? 0.6 : 0;
}

/** 把一个方向压回镜头能转到的极角范围里，方位角不动 */
export function 压进极角范围(方向, 最小, 最大) {
  const v = 方向.clone().normalize();
  const 极角 = Math.acos(Math.min(1, Math.max(-1, v.y)));
  const 夹住 = Math.min(Math.max(极角, 最小), 最大);
  if (Math.abs(夹住 - 极角) < 1e-9) return v;

  const 水平 = new THREE.Vector3(v.x, 0, v.z);
  if (水平.lengthSq() < 1e-12) 水平.set(0, 0, 1); // 正上方俯瞰时方位角是退化的
  水平.normalize().multiplyScalar(Math.sin(夹住));
  水平.y = Math.cos(夹住);
  return 水平.normalize();
}

/**
 * 挑一个角度，让孩子同时看得见红色的重叠和黄色的漏洞。
 *
 * 候选方向都是从这些面自己的法线拼出来的，评分取「最好看的那个红」和
 * 「最好看的那个黄」里**小**的那个 —— 取最小值就是在逼它两个都得看得见，
 * 只把红转到正前方而把黄甩到背面的角度，分数会被压到 0。
 *
 * @param {string[]} 重叠面 撞在一起的格子落在哪些面上
 * @param {string[]} 漏洞面 没人盖的面
 * @returns {THREE.Vector3} 单位向量：镜头该站在正方体的哪个方向上
 */
export function 失败视角(重叠面, 漏洞面, { 极角最小 = 0.12, 极角最大 = Math.PI / 2 - 0.28 } = {}) {
  const 候选 = [];
  const 加候选 = (v) => {
    if (v.lengthSq() < 1e-8) return; // 一正一反加出个零向量，指不了方向
    候选.push(压进极角范围(v, 极角最小, 极角最大));
  };

  for (const 洞 of 漏洞面) {
    加候选(面法线(洞));
    for (const 红面 of 重叠面) 加候选(面法线(洞).add(面法线(红面)));
  }
  for (const 红面 of 重叠面) 加候选(面法线(红面));
  // 兜底：万一上面全被压成零向量，斜着看总比正对着看得全
  加候选(new THREE.Vector3(1, 1, 1));

  let 最好 = 候选[0];
  let 最高分 = -Infinity;
  for (const 方向 of 候选) {
    const 红分 = Math.max(...重叠面.map((面) => 可见度(方向, 面, 漏洞面)), 0);
    const 黄分 = Math.max(...漏洞面.map((面) => 可见度(方向, 面, 漏洞面)), 0);
    const 分 = Math.min(红分, 黄分);
    if (分 > 最高分) {
      最高分 = 分;
      最好 = 方向;
    }
  }
  return 最好;
}

// ---------------------------------------------------------------------------
// 染红发抖 + 闪黄光
// ---------------------------------------------------------------------------

/**
 * 撞在一起的那几片完全重合，得沿着法线摊开一点。
 *
 * 摊开的幅度不能只按「够不够避开渲染打架」定 —— 那只要千分之几就够了，
 * 但孩子看到的还是一堵严丝合缝的红墙，看不出「叠两层」。要摊到边缘一层一层露出来，
 * 他才数得出这里挤了几片纸。
 */
const 错开 = 0.07;
const 抖幅 = 0.02;

/**
 * @param {{cellMeshes: THREE.Mesh[], object3D: THREE.Object3D}} 衣服 一张折起来的衣服
 */
export function 创建穿不上提示(衣服) {
  /** @type {Array<{mesh: THREE.Mesh, 红膜: THREE.Mesh, 原位置: THREE.Vector3, 相位: number}>} */
  let 红格子 = [];
  /** @type {THREE.Mesh[]} */
  let 漏洞牌 = [];
  let 贴图 = null;
  let 几何 = null;
  let 红膜几何 = null;

  /**
   * 把 foldResult 算出来的毛病显示出来。只在折叠度到 1 的那一刻叫。
   * @param {{faces: string[], overlaps: number[][], holes: string[]}} 结果
   */
  const 显示 = (结果) => {
    清除();

    for (const 一组 of 结果.overlaps) {
      一组.forEach((下标, k) => {
        const mesh = 衣服.cellMeshes[下标];
        if (!mesh) return;
        const 红膜 = 蒙一层红(mesh);
        红格子.push({
          mesh,
          红膜,
          原位置: mesh.position.clone(),
          相位: 红格子.length * 1.9,
        });
        // 沿着自己的法线各让开一点，两片都看得见（格子平躺在局部的 XZ 面上，法线是 y）
        mesh.position.y += (k - (一组.length - 1) / 2) * 错开;
        mesh.renderOrder = 1;
      });
    }

    for (const 面 of 结果.holes) {
      漏洞牌.push(做一块漏洞牌(面));
    }
  };

  /**
   * 蒙一层红膜。挂在格子自己身上，格子一抖它跟着抖。
   * polygonOffset 让它总是浮在格子前面一丁点 —— 正反两面都看得见，
   * 又不至于像关掉深度测试那样连挡在前面的别的格子都盖住。
   */
  function 蒙一层红(mesh) {
    红膜几何 ??= new THREE.PlaneGeometry(CELL_SIZE, CELL_SIZE);
    const 膜 = new THREE.Mesh(
      红膜几何,
      new THREE.MeshBasicMaterial({
        color: 红,
        transparent: true,
        opacity: 红膜透明度,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        toneMapped: false,
      }),
    );
    膜.name = '红膜';
    膜.renderOrder = 1;
    mesh.add(膜);
    return 膜;
  }

  function 做一块漏洞牌(面) {
    贴图 ??= 做漏洞贴图();
    几何 ??= new THREE.PlaneGeometry(CELL_SIZE * 1.16, CELL_SIZE * 1.16);
    const 牌 = new THREE.Mesh(
      几何,
      new THREE.MeshBasicMaterial({
        map: 贴图,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false, // 中间是空的，得看得见正方体里面
        toneMapped: false,
      }),
    );
    const n = 面法线(面);
    牌.position.copy(正方体中心).addScaledVector(n, CELL_SIZE / 2);
    牌.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    牌.renderOrder = 2;
    牌.name = `漏洞${面}`;
    衣服.object3D.add(牌);
    return 牌;
  }

  /** 每帧叫一次：红的抖，黄的闪 */
  const 更新 = (秒) => {
    for (const { mesh, 原位置, 相位 } of 红格子) {
      mesh.position.x = 原位置.x + Math.sin(秒 * 26 + 相位) * 抖幅;
      mesh.position.z = 原位置.z + Math.cos(秒 * 21 + 相位) * 抖幅;
    }
    for (const 牌 of 漏洞牌) {
      牌.material.opacity = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(秒 * 5.5));
    }
  };

  /**
   * 只把黄牌子收走，红的留着。
   * 弹回平地的路上正方体已经散开了，黄牌子挂在面上没有意义；
   * 红的还有用 —— 孩子能一路盯着是哪两格闯的祸。
   */
  const 收起漏洞 = () => {
    for (const 牌 of 漏洞牌) {
      牌.removeFromParent();
      牌.material.dispose();
    }
    漏洞牌 = [];
  };

  const 清除 = () => {
    for (const { mesh, 红膜, 原位置 } of 红格子) {
      红膜.removeFromParent();
      红膜.material.dispose();
      mesh.position.copy(原位置);
      mesh.renderOrder = 0;
    }
    红格子 = [];
    收起漏洞();
  };

  const dispose = () => {
    清除();
    贴图?.dispose();
    几何?.dispose();
    红膜几何?.dispose();
    贴图 = null;
    几何 = null;
    红膜几何 = null;
  };

  return {
    显示,
    更新,
    收起漏洞,
    清除,
    dispose,
    get 在显示() {
      return 红格子.length > 0 || 漏洞牌.length > 0;
    },
  };
}

/**
 * 漏洞牌的贴图：一圈发光的黄框，中间是空的。
 * 中间必须留空 —— 漏洞是个真窟窿，孩子要能顺着它看进正方体里面，
 * 看见对面那两片红的挤在一起。贴一块实心黄板就把这层因果关系挡住了。
 */
function 做漏洞贴图() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const 光 = ctx.createRadialGradient(128, 128, 48, 128, 128, 132);
  光.addColorStop(0, 'rgba(255, 214, 10, 0)');
  光.addColorStop(0.62, 'rgba(255, 214, 10, 0.10)');
  光.addColorStop(0.88, 'rgba(255, 200, 0, 0.45)');
  光.addColorStop(1, 'rgba(255, 200, 0, 0)');
  ctx.fillStyle = 光;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = 'rgba(255, 206, 24, 0.96)';
  ctx.lineWidth = 22;
  ctx.lineJoin = 'round';
  ctx.strokeRect(28, 28, 200, 200);

  ctx.strokeStyle = 'rgba(255, 246, 190, 0.85)';
  ctx.lineWidth = 6;
  ctx.strokeRect(28, 28, 200, 200);

  const 贴图 = new THREE.CanvasTexture(canvas);
  贴图.colorSpace = THREE.SRGBColorSpace;
  return 贴图;
}
