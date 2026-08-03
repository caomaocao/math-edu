import * as THREE from '/shared/vendor/three/three.module.js';
import { OrbitControls } from '/shared/vendor/three/OrbitControls.js';
import { 舞台系数, 订阅舞台 } from '/shared/js/舞台.js';

/**
 * 三维舞台：渲染器、镜头、绕着看的控制器、地面上的一团淡影子。
 * 后面的票（格子纸、点面看对面、导航切换）复用同一个舞台，不重建。
 *
 * 注意这一讲有两个「舞台」：这儿说的是装三维场景的那个盒子（`#舞台`），
 * 下面 `舞台系数()` 问的是**基准舞台**（整讲的那套恒定坐标系，见 /shared/js/舞台.js）。
 */

/**
 * 画布的像素密度上限。
 *
 * 从前是 `min(devicePixelRatio, 2)` —— 只按设备像素比算。上了基准舞台之后这笔账
 * 少了一项：CSS 的 scale() 缩的是**已经画好的**画布，而 canvas.clientWidth 量到的
 * 仍是舞台像素。桌面大屏上系数会大于 1（1080 高的屏幕上约 1.5），照旧只按
 * devicePixelRatio 定密度的话，等于把一张小图放大 1.5 倍糊给孩子看；
 * 手机上系数约 0.48，反过来是白画了一半多的像素。所以两者相乘才是
 * 「落到玻璃上的那个密度」。
 *
 * 上限从 2 抬到 3：这个数现在的含义是「每个屏幕像素最多画三个」，
 * 手机（dpr 3 × 0.48 ≈ 1.45）反而比从前省，只有桌面视网膜屏 × 大系数才会顶到上限。
 */
const 像素密度上限 = 3;

/**
 * 镜头能转到的极角范围（0 = 正上方往下看，π/2 = 贴着地平线平视）。
 * 上限 0.12：几乎能转到正上方，垂直俯瞰正好看清摊平的衣服是什么形状。
 * 下限 π/2 − 0.28 ≈ 74°：再低要么钻到地底下，要么把那张纸看成一条线。
 */
const 极角最小 = 0.12;
const 极角最大 = Math.PI / 2 - 0.28;

/**
 * 算出镜头该站在哪儿，才刚好装得下这个盒子。纯函数，不碰场景，方便单独测。
 *
 * 方向取的是「旧镜头位置 → 旧目标点」，在挪目标点之前就定下来 ——
 * 这一条是关键：孩子来回蹭滑块时这个函数会被叫上千次，
 * 要是先挪目标点再反推方向，每叫一次角度就偏一点，蹭一会儿画面自己就转跑了。
 *
 * 装不装得下算的是盒子八个角点在画面里的真实位置，不是外接球，
 * 所以贴着地的那张薄纸不会因为被压扁而白白退太远。
 */
export function 拟合镜头(盒子, 旧镜头位置, 旧目标, 视野角度, 宽高比, 余量 = 1.3) {
  const 目标 = 盒子.getCenter(new THREE.Vector3());

  const 看向 = new THREE.Vector3().subVectors(旧镜头位置, 旧目标);
  if (看向.lengthSq() < 1e-12) 看向.set(0, 0.75, 1); // 镜头正好压在目标点上时的兜底
  看向.normalize();

  const 右 = new THREE.Vector3(0, 1, 0).cross(看向);
  if (右.lengthSq() < 1e-6) 右.set(1, 0, 0); // 正上方俯瞰时「右」是退化的
  右.normalize();
  const 上 = new THREE.Vector3().copy(看向).cross(右).normalize();

  const 竖直半角 = Math.tan((视野角度 * Math.PI) / 360);
  const 水平半角 = 竖直半角 * 宽高比;

  const 角 = new THREE.Vector3();
  let 距离 = 0;
  for (let i = 0; i < 8; i++) {
    角
      .set(
        i & 1 ? 盒子.max.x : 盒子.min.x,
        i & 2 ? 盒子.max.y : 盒子.min.y,
        i & 4 ? 盒子.max.z : 盒子.min.z,
      )
      .sub(目标);
    const 纵深 = 角.dot(看向);
    距离 = Math.max(
      距离,
      纵深 + (Math.abs(角.dot(右)) * 余量) / 水平半角,
      纵深 + (Math.abs(角.dot(上)) * 余量) / 竖直半角,
    );
  }

  return { 目标, 看向, 距离 };
}

export function createScene(container) {
  /** 这一刻画布该按多少像素密度画 —— 设备的密度乘上基准舞台的缩放系数 */
  const 该有的像素密度 = () =>
    Math.min((window.devicePixelRatio || 1) * 舞台系数(), 像素密度上限);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(该有的像素密度());
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 4.6, 6.4);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false; // 孩子只会拖，别让他把东西拖出画面
  controls.minDistance = 1.6;
  controls.maxDistance = 14;
  controls.minPolarAngle = 极角最小;
  controls.maxPolarAngle = 极角最大;
  controls.rotateSpeed = 0.75;
  controls.zoomSpeed = 0.6;

  scene.add(makeGroundShadow());

  /**
   * 把镜头退到刚好装得下这个盒子的地方，孩子转到的角度原样保留。
   * 衣服摊平时是一大张薄纸、合上时只有一个正方体那么小 ——
   * 镜头不跟着走，孩子要么看不全，要么看不清。
   */
  const 上次盒子 = new THREE.Box3();
  let 有盒子 = false;

  const 框住 = (盒子 = null) => {
    if (盒子) {
      上次盒子.copy(盒子);
      有盒子 = true;
    }
    if (!有盒子 || 上次盒子.isEmpty()) return;

    const { 目标, 看向, 距离 } = 拟合镜头(
      上次盒子,
      camera.position,
      controls.target,
      camera.fov,
      camera.aspect,
    );
    const 夹住的距离 = Math.min(Math.max(距离, controls.minDistance), controls.maxDistance);
    controls.target.copy(目标);
    // 直接按方向重新摆位，而不是 setLength ——
    // 镜头万一正好压在目标点上，setLength 会把零向量原地放大成零向量，再也回不来
    camera.position.copy(目标).addScaledVector(看向, 夹住的距离);
  };

  /**
   * 把镜头转到指定方向去，转的过程孩子看得见。
   *
   * 02 票的失败提示要用：撞红的那片和漏光的那个面可能都在孩子看不见的背面，
   * 直接瞬移过去孩子会以为画面换了个东西，转过去他才跟得上是同一个正方体。
   * 只改方向，站多远还是交给「框住」算。
   */
  let 转镜头 = null;
  const 转镜头到 = (方向, 秒 = 0.9) => {
    const 从 = new THREE.Vector3().subVectors(camera.position, controls.target);
    if (从.lengthSq() < 1e-12) 从.set(0, 0.75, 1);
    转镜头 = {
      从: 从.normalize(),
      到: 方向.clone().normalize(),
      开始: performance.now(),
      时长: Math.max(秒, 0.001) * 1000,
    };
  };

  const 推进转镜头 = () => {
    if (!转镜头) return;
    const t = Math.min(1, (performance.now() - 转镜头.开始) / 转镜头.时长);
    const 缓 = t * t * (3 - 2 * t);

    // 用四元数插值，不用直接插两个向量：一正一反的两个方向线性插到中间会缩成零向量
    const 整段 = new THREE.Quaternion().setFromUnitVectors(转镜头.从, 转镜头.到);
    const 方向 = 转镜头.从.clone().applyQuaternion(new THREE.Quaternion().slerp(整段, 缓));

    const 距离 = camera.position.distanceTo(controls.target) || controls.maxDistance / 2;
    camera.position.copy(controls.target).addScaledVector(方向, 距离);
    框住(); // 方向定了，站多远重新算一遍
    if (t >= 1) 转镜头 = null;
  };

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container;
    if (w === 0 || h === 0) return;
    renderer.setPixelRatio(该有的像素密度());
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    框住();
  };
  resize();
  window.addEventListener('resize', resize);
  new ResizeObserver(resize).observe(container);
  /*
    舞台重新缩放时也要补一次密度，而这一下**两个现成的耳朵都听不见**：
    基准舞台缩的是 transform，画布的布局尺寸一个像素都没变，所以 ResizeObserver
    不响；window 的 resize 也不是每次都跟着来（iOS 上工具栏一伸一缩走的是
    visualViewport）。孩子正玩到一半转个屏，画面就会一直糊到他退出去再进来。
  */
  订阅舞台(resize);

  /** 每帧要做的那几件事：推折痕、更新提示、让方方眨眼 */
  const 每帧 = [];
  const onFrame = (fn) => 每帧.push(fn);

  const 循环 = () => {
    requestAnimationFrame(循环);
    for (const fn of 每帧) {
      try {
        fn();
      } catch (错) {
        /*
          一个回调炸了不能连累这一帧的 render()。
          不隔离的话，某个 onFrame 里一次拼错的变量名就会让画面**静止**在上一帧上：
          正方体凭空消失，没有报错、没有白屏，孩子只看见东西没了，也说不出哪儿不对。
          炸了就往控制台丢一句给家长看，画面照常往下走。
        */
        console.error('每帧回调炸了：', 错);
      }
    }
    推进转镜头();
    controls.update();
    renderer.render(scene, camera);
  };
  循环();

  return { renderer, scene, camera, controls, onFrame, 框住, 转镜头到 };
}

/** 地上那团软软的影子，光靠它孩子就能看出东西离地多高 */
function makeGroundShadow() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(30, 41, 80, 0.20)');
  gradient.addColorStop(0.55, 'rgba(30, 41, 80, 0.08)');
  gradient.addColorStop(1, 'rgba(30, 41, 80, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.02;
  mesh.renderOrder = -1;
  mesh.name = '地面影子';
  return mesh;
}
