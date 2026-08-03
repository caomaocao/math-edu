import * as THREE from '/shared/vendor/three/three.module.js';

import { 算挪了的位移 } from './指针容差.js';

/**
 * 折纸的那只手 —— 孩子在三维舞台上直接折衣服。
 *
 * 点一下：那一片「啪」地弹起来 90°，再点一下放回去。
 * 按住不放：一点一点往上折，松手就停在半路 —— 半折状态是这一讲要看的东西，
 * 不是动画的中间帧，所以必须停得住。
 *
 * 同一块画布上还挂着 OrbitControls（孩子拖着转正方体看背面）。三件事要分开：
 *   挪了 → 他在转镜头，这一下不算折（也把按住的折叫停）
 *   按一下就松 → 点，切换折/不折
 *   按住不动超过一会儿 → 连续折，直到松手
 *
 * 「挪了多少才算转镜头」按手还是鼠标分两档，见 ./指针容差.js。
 */

/** 按住超过这么久就从「点」变成「连续折」 */
const 算按住的时长 = 260;

/**
 * @param {{renderer: THREE.WebGLRenderer, camera: THREE.Camera}} 舞台
 * @param {{
 *   取面: () => THREE.Mesh[],
 *   可折: (格子下标: number) => boolean,
 *   on按下: (格子下标: number) => void,
 *   on点: (格子下标: number) => void,
 *   on按住: (格子下标: number, 秒: number) => void,
 *   on松手: (格子下标: number) => void,
 * }} 接线
 */
export function 创建折纸手(舞台, { 取面, 可折, on按下, on点, on按住, on松手 }) {
  const 画布 = 舞台.renderer.domElement;
  const 射线 = new THREE.Raycaster();
  const 屏幕点 = new THREE.Vector2();

  /** 正按着的那一下。null = 手没在纸上 */
  let 按着 = null;
  let 计时 = 0;

  function 打到的格子(事件) {
    const 面 = 取面();
    if (!面 || 面.length === 0) return null;

    const 框 = 画布.getBoundingClientRect();
    if (框.width === 0 || 框.height === 0) return null;
    屏幕点.x = ((事件.clientX - 框.left) / 框.width) * 2 - 1;
    屏幕点.y = -((事件.clientY - 框.top) / 框.height) * 2 + 1;

    射线.setFromCamera(屏幕点, 舞台.camera);
    const 打中 = 射线.intersectObjects(面, false);
    const 下标 = 打中[0]?.object?.userData?.cellIndex;
    return Number.isInteger(下标) ? 下标 : null;
  }

  function 收手(叫松手) {
    if (!按着) return;
    if (叫松手 && 按着.折着) on松手?.(按着.下标);
    按着 = null;
    cancelAnimationFrame(计时);
  }

  /** 按住期间每帧喂一点时间进去，折痕就一点一点转起来 */
  function 按住的每一帧(上一刻) {
    计时 = requestAnimationFrame((此刻) => {
      if (!按着) return;
      const 秒 = Math.min(0.05, (此刻 - 上一刻) / 1000);
      if (!按着.折着 && 此刻 - 按着.时刻 >= 算按住的时长) 按着.折着 = true;
      if (按着.折着) on按住?.(按着.下标, 秒);
      按住的每一帧(此刻);
    });
  }

  const 按下了 = (事件) => {
    if (事件.button !== 0 && 事件.pointerType === 'mouse') return;
    const 下标 = 打到的格子(事件);
    if (下标 === null || !可折(下标)) return;

    按着 = {
      下标,
      x: 事件.clientX,
      y: 事件.clientY,
      指: 事件.pointerType, // 手指的门槛比鼠标宽，记下按的是什么，中途不换算
      时刻: performance.now(),
      折着: false,
    };
    on按下?.(下标); // 这一按往哪个方向走，现在就定死，按住的过程中不许掉头
    按住的每一帧(performance.now());
  };

  const 松开了 = (事件) => {
    if (!按着) return;
    const { 下标, 折着, 指 } = 按着;
    const 挪了 = Math.hypot(事件.clientX - 按着.x, 事件.clientY - 按着.y);
    收手(false);

    if (挪了 > 算挪了的位移(指)) return; // 他在转镜头
    if (折着) on松手?.(下标); // 按住折了一段，停在这儿
    else on点?.(下标); // 干脆利落的一下：切换
  };

  /**
   * 手在纸上滑动 = 他要转镜头，不是要折。按住折到一半也就此打住 ——
   * 不然孩子想换个角度看看，衣服却在他手底下自己折下去了。
   */
  const 移动了 = (事件) => {
    if (按着) {
      const 挪了 = Math.hypot(事件.clientX - 按着.x, 事件.clientY - 按着.y);
      if (挪了 > 算挪了的位移(按着.指)) 收手(true);
      return;
    }
    /*
      停在能折的那一片上就换手指光标 —— 孩子不认字，「这里能点」只能靠光标说。
      手指没有光标也没有「停在上面」这回事，所以这条路只走鼠标（省下每次滑动
      一次白打的射线），触屏那边换成呼吸提示接班，见 ./呼吸提示.js。
    */
    if (事件.pointerType !== 'mouse') return;
    const 下标 = 打到的格子(事件);
    画布.style.cursor = 下标 !== null && 可折(下标) ? 'pointer' : '';
  };

  const 离开了 = () => {
    收手(true);
    画布.style.cursor = '';
  };

  画布.addEventListener('pointerdown', 按下了);
  画布.addEventListener('pointerup', 松开了);
  画布.addEventListener('pointermove', 移动了);
  画布.addEventListener('pointerleave', 离开了);
  画布.addEventListener('pointercancel', 离开了);

  return {
    dispose() {
      收手(false);
      画布.removeEventListener('pointerdown', 按下了);
      画布.removeEventListener('pointerup', 松开了);
      画布.removeEventListener('pointermove', 移动了);
      画布.removeEventListener('pointerleave', 离开了);
      画布.removeEventListener('pointercancel', 离开了);
      画布.style.cursor = '';
    },
  };
}
