import * as THREE from '/shared/vendor/three/three.module.js';

import { 算挪了的位移 } from './指针容差.js';

/**
 * 在舞台上点一个面。
 *
 * 麻烦在于同一块画布上还挂着 OrbitControls：孩子拖着转正方体，松手时也会收到
 * 一次 pointerup。所以这里只认「按下和松开几乎在同一个点上」的那一下 ——
 * 转了一圈再松手不算点面，不然孩子每转一次镜头就莫名其妙亮一对。
 *
 * 「几乎在同一个点上」是多少，手和鼠标两档，跟折纸手共用一处（./指针容差.js）：
 * 七个像素是给鼠标定的，手指点一下自己就能晃出这么多。
 */

/** 按住不放超过这么久也不算点（孩子按着不动想事情） */
const 算点的时长 = 700;

/**
 * @param {{renderer: THREE.WebGLRenderer, camera: THREE.Camera}} 舞台
 * @param {{
 *   取面: () => THREE.Mesh[],
 *   可点: () => boolean,
 *   on点面: (格子下标: number) => void,
 *   on点空: () => void,
 * }} 接线 取面 返回当前可点的那几片；可点 说现在这个状态让不让点
 */
export function 创建点面(舞台, { 取面, 可点, on点面, on点空 }) {
  const 画布 = 舞台.renderer.domElement;
  const 射线 = new THREE.Raycaster();
  const 屏幕点 = new THREE.Vector2();
  let 按下 = null;

  /** 这个位置底下是哪一片面（最近的那片，也就是孩子看得见的那片） */
  function 打到的格子(事件) {
    if (!可点()) return null;
    const 面 = 取面();
    if (!面 || 面.length === 0) return null;

    const 框 = 画布.getBoundingClientRect();
    if (框.width === 0 || 框.height === 0) return null;
    屏幕点.x = ((事件.clientX - 框.left) / 框.width) * 2 - 1;
    屏幕点.y = -((事件.clientY - 框.top) / 框.height) * 2 + 1;

    射线.setFromCamera(屏幕点, 舞台.camera);
    const 打中 = 射线.intersectObjects(面, false);
    const 格子下标 = 打中[0]?.object?.userData?.cellIndex;
    return Number.isInteger(格子下标) ? 格子下标 : null;
  }

  const 按下了 = (事件) => {
    if (事件.button !== 0 && 事件.pointerType === 'mouse') return;
    按下 = { x: 事件.clientX, y: 事件.clientY, 指: 事件.pointerType, 时刻: performance.now() };
    画布.style.cursor = ''; // 拖起来了，让 CSS 的抓手接管
  };

  const 松开了 = (事件) => {
    const 起点 = 按下;
    按下 = null;
    if (!起点) return;
    const 挪了 = Math.hypot(事件.clientX - 起点.x, 事件.clientY - 起点.y);
    if (挪了 > 算挪了的位移(起点.指) || performance.now() - 起点.时刻 > 算点的时长) return;
    if (!可点()) return;

    const 格子下标 = 打到的格子(事件);
    if (格子下标 === null) on点空?.();
    else on点面?.(格子下标);
  };

  /**
   * 鼠标停在面上就换成手指光标 —— 孩子不认字，「这里能点」只能靠光标和 hover 说。
   * 正在拖的时候不管，免得跟 CSS 的抓手打架。
   * 手指那边整条路都不走：没有光标可换，白打一次射线（这一关看对面的六个面
   * 一直都能点，孩子点哪儿都亮，不缺「这里能点」的提示）。
   */
  const 移动了 = (事件) => {
    if (按下 || 事件.pointerType !== 'mouse') return;
    画布.style.cursor = 打到的格子(事件) === null ? '' : 'pointer';
  };

  const 离开了 = () => {
    画布.style.cursor = '';
  };

  画布.addEventListener('pointerdown', 按下了);
  画布.addEventListener('pointerup', 松开了);
  画布.addEventListener('pointermove', 移动了);
  画布.addEventListener('pointerleave', 离开了);

  return {
    dispose() {
      画布.removeEventListener('pointerdown', 按下了);
      画布.removeEventListener('pointerup', 松开了);
      画布.removeEventListener('pointermove', 移动了);
      画布.removeEventListener('pointerleave', 离开了);
      画布.style.cursor = '';
    },
  };
}
