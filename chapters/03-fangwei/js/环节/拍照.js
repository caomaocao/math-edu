// 拍照 —— 给小鸭拍照（书第 36 页 闯关五的活版，视角转换）。
// 桌子中间一只小鸭，四个小朋友坐四边。点小朋友，镜头飞到他的座位看小鸭；
// 然后一张张照片问「这是谁拍的」。四张照片就是四个座位真实渲染的快照，
// 照片和座位看到的永远一模一样。

import * as THREE from '/shared/vendor/three/three.module.js';
import { 说 } from '/shared/js/说话.js';
import { 收起麦克风 } from '/shared/js/问答.js';
import { 音效 } from '/shared/js/音效.js';
import { 元, 洗牌, 做进度点, 歇 } from '/shared/js/搭台.js';
import { 舞台系数, 订阅舞台 } from '/shared/js/舞台.js';
import { 画实体 } from '/shared/js/实体图.js';
import { 台词, 模板 } from '../台词表.js';
import { 名说 } from '../方位词.js';

// 这一关屏幕上出现的实体（规范名）。只有座位钮上那个小朋友；四个座位共用同一张图，
// 谁是谁全靠旁边那颗色点。小鸭是 3D 模型，色点是 CSS 画的，都不算实体。
// 实体图覆盖测试拿它对账，见 test/实体图覆盖.test.js。
export const 实体们 = ['小朋友'];

const 话 = 台词.拍照;
const 模 = 模板.拍照;

// 四个小朋友按颜色起名（中文叠字，英文就叫颜色本身）。中文名是规范名：
// 座位钮、快照、钮位表都拿它当键。
//
// `色` 是这四个人唯一的颜色出处：3D 场景里的身子、座位钮和照片上的色点都从它来，
// 所以「红红穿的」和「红红那颗点」永远是同一个红。
const 座位们 = [
  { 名: '红红', 英: 'Red', 色: 0xf2604e, 角: 0 },          // 南边（小鸭脸朝他）
  { 名: '蓝蓝', 英: 'Blue', 色: 0x3a9ad9, 角: Math.PI / 2 },  // 东边
  { 名: '黄黄', 英: 'Yellow', 色: 0xffb632, 角: Math.PI },      // 北边（看到尾巴）
  { 名: '绿绿', 英: 'Green', 色: 0x69b35e, 角: -Math.PI / 2 }, // 西边
];

// 四色圆点**故意不出贴纸素材**：它是颜色标识，颜色本身就是答案，画成插画反而
// 削弱辨识（票 09 拍板）。CSS 画一颗实心圆，颜色直接取自上面那张表。
function 色点(色, 类名 = '色点') {
  const 点 = 元('span', 类名);
  点.style.background = `#${色.toString(16).padStart(6, '0')}`;
  return 点;
}

function 搭场景() {
  const 场 = new THREE.Scene();
  场.background = new THREE.Color(0xeaf7ff);

  场.add(new THREE.AmbientLight(0xffffff, 0.75));
  const 阳 = new THREE.DirectionalLight(0xffffff, 0.9);
  阳.position.set(3, 6, 4);
  场.add(阳);

  const 地 = new THREE.Mesh(
    new THREE.CircleGeometry(7, 40),
    new THREE.MeshLambertMaterial({ color: 0xd8f0c8 }),
  );
  地.rotation.x = -Math.PI / 2;
  场.add(地);

  // 桌子
  const 桌腿 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.0, 16), new THREE.MeshLambertMaterial({ color: 0x9a7b53 }));
  桌腿.position.y = 0.5;
  const 桌面 = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.14, 32), new THREE.MeshLambertMaterial({ color: 0x53b8a7 }));
  桌面.position.y = 1.06;
  场.add(桌腿, 桌面);

  // 小鸭（脸朝 +z，也就是红红那边）
  const 鸭 = new THREE.Group();
  const 黄 = new THREE.MeshLambertMaterial({ color: 0xffd34d });
  const 身 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 18), 黄);
  身.scale.set(1, 0.82, 1.12);
  身.position.y = 1.52;
  const 头 = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 18), 黄);
  头.position.set(0, 2.08, 0.3);
  const 嘴 = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 16), new THREE.MeshLambertMaterial({ color: 0xff9432 }));
  嘴.rotation.x = Math.PI / 2;
  嘴.position.set(0, 2.02, 0.62);
  const 黑 = new THREE.MeshBasicMaterial({ color: 0x2b2b2b });
  const 左眼 = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), 黑);
  左眼.position.set(-0.12, 2.16, 0.52);
  const 右眼 = 左眼.clone();
  右眼.position.x = 0.12;
  const 尾 = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 14), 黄);
  尾.rotation.x = -Math.PI / 2.6;
  尾.position.set(0, 1.62, -0.62);
  const 白 = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const 帽筒 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.32, 18), 白);
  帽筒.position.set(0, 2.44, 0.26);
  const 帽檐 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 18), 白);
  帽檐.position.set(0, 2.28, 0.26);
  const 左翅 = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), 黄);
  左翅.scale.set(0.5, 0.9, 1.1);
  左翅.position.set(-0.52, 1.52, -0.05);
  const 右翅 = 左翅.clone();
  右翅.position.x = 0.52;
  鸭.add(身, 头, 嘴, 左眼, 右眼, 尾, 帽筒, 帽檐, 左翅, 右翅);
  场.add(鸭);

  // 四个小朋友
  for (const { 色, 角 } of 座位们) {
    const 孩 = new THREE.Group();
    const 身子 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.85, 18), new THREE.MeshLambertMaterial({ color: 色 }));
    身子.position.y = 0.62;
    const 脑袋 = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 16), new THREE.MeshLambertMaterial({ color: 0xffe0c2 }));
    脑袋.position.y = 1.35;
    孩.add(身子, 脑袋);
    孩.position.set(Math.sin(角) * 2.6, 0, Math.cos(角) * 2.6);
    孩.lookAt(0, 0.8, 0);
    场.add(孩);
  }
  return 场;
}

function 座位相机(角, 宽高比) {
  const 机 = new THREE.PerspectiveCamera(50, 宽高比, 0.1, 50);
  机.position.set(Math.sin(角) * 1.95, 1.95, Math.cos(角) * 1.95);
  机.lookAt(0, 1.8, 0);
  return 机;
}

export function 创建(面板, 工具) {
  面板.innerHTML = `
    <div class="舞台布">
      <div class="大画框 拍照框">
        <div class="拍照台" id="拍照台">
          <canvas class="拍照布" id="拍照布"></canvas>
          <div class="座位钮们" id="座位钮们"></div>
        </div>
      </div>
      <div class="照片排" id="照片排"></div>
      <div class="进度点挂" id="拍照进度"></div>
    </div>`;
  const 台 = 面板.querySelector('#拍照台');
  const 布 = 面板.querySelector('#拍照布');
  const 照片排 = 面板.querySelector('#照片排');
  const 点 = 做进度点(面板.querySelector('#拍照进度'), 座位们.length);

  const 宽 = 620;
  const 高 = 400;
  const 画笔 = new THREE.WebGLRenderer({ canvas: 布, antialias: true });

  /**
   * 画布背后有多少真像素 —— `devicePixelRatio` **乘上舞台系数**。
   *
   * 画布这一层是 CSS 缩放帮不了的地方：舞台把整块画面 scale() 了，可 canvas 量到的
   * clientWidth 仍是 620 舞台px，只按 devicePixelRatio 定密度的话，桌面上系数大于 1
   * 时等于把一张小图放大了糊给孩子看（见 /shared/js/舞台.js 头注释那一段）。
   *
   * setSize 的第三个参数用默认的 true：CSS 尺寸得锁在 620×400 舞台px 上。传 false
   * 的话画布连布局尺寸也跟着密度涨，620 的画框里会塞进一块 1240 宽的布。
   */
  function 定密度() {
    画笔.setPixelRatio(window.devicePixelRatio * 舞台系数());
    画笔.setSize(宽, 高);
  }
  定密度();
  // 系数一变就重定。挂在 订阅舞台 上而不是「每次进关补一次」：孩子正玩着这一关时
  // 转个屏（或大人拉了下窗口），画面当场就该重新变锐，不该一直糊到他退出去再进来。
  // 退订函数扔掉不管是有意的 —— 面板从生到死都挂在文档里（家规：只 visibility 让位，
  // 不卸载），这个订阅和这块画布同寿。
  订阅舞台(定密度);
  const 场 = 搭场景();

  // 主相机：斜上方全景
  const 全景机 = new THREE.PerspectiveCamera(50, 宽 / 高, 0.1, 50);
  const 全景位 = new THREE.Vector3(2.8, 4.2, 5.2);
  全景机.position.copy(全景位);
  全景机.lookAt(0, 1.2, 0);
  let 相机 = 全景机;

  // 每个座位真拍一张快照当照片
  const 快照们 = {};
  {
    const 小画笔 = new THREE.WebGLRenderer({ antialias: true });
    // 照片显示出来是 116 舞台px（.照片卡 img），拍成 360 是留足两头的余量：
    // 桌面上舞台可能放大到一点五倍、屏幕又是二倍屏，240 那会儿就开始糊 ——
    // 而「照片里小鸭的嘴朝哪边」正是这一关要看清的东西。四张，多拍点不费什么。
    小画笔.setSize(360, 360, false);
    for (const { 名, 角 } of 座位们) {
      小画笔.render(场, 座位相机(角, 1));
      快照们[名] = 小画笔.domElement.toDataURL('image/png');
    }
    小画笔.dispose();
  }

  // 座位按钮：摆在画布四边，跟 3D 里的座位方向一致（红南=下，蓝东=右，黄北=上，绿西=左）
  const 钮位 = { 红红: ['50%', '92%'], 蓝蓝: ['93%', '50%'], 黄黄: ['50%', '8%'], 绿绿: ['7%', '50%'] };
  const 座位钮们 = {};
  let 点了座位 = null;
  for (const { 名, 色 } of 座位们) {
    // 热区不动位：钮已经放大到 80 舞台px（34pt）还差一截，再补一圈隐形外扩到约 54pt。
    // 这一关敢外扩：四个钮分踞画布四边，中心相隔两百多舞台px，谁也伸不到谁身上
    //（钮自己 absolute + translate 钉在边上，那个类不许动它的 position）
    const 钮 = 元('button', '座位钮 热区不动位');
    钮.append(画实体('小朋友', '🧒', { 类名: '座娃图' }), 色点(色));
    钮.style.left = 钮位[名][0];
    钮.style.top = 钮位[名][1];
    面板.querySelector('#座位钮们').appendChild(钮);
    钮.onclick = () => { if (点了座位) 点了座位(名); };
    座位钮们[名] = 钮;
  }

  // 镜头飞行
  let 飞行号 = 0;
  function 飞到(角) {
    飞行号 += 1;
    const 本次 = 飞行号;
    const 目标机 = 角 === null ? null : 座位相机(角, 宽 / 高);
    const 起 = 相机.position.clone();
    const 终 = 目标机 ? 目标机.position : 全景位;
    const 看 = 目标机 ? new THREE.Vector3(0, 1.8, 0) : new THREE.Vector3(0, 1.2, 0);
    const 起看 = new THREE.Vector3(0, 1.5, 0);
    const 机 = new THREE.PerspectiveCamera(50, 宽 / 高, 0.1, 50);
    相机 = 机;
    const 起时 = performance.now();
    return new Promise((好) => {
      (function 走(now) {
        if (飞行号 !== 本次) { 好(); return; }
        const t = Math.min(1, (now - 起时) / 900);
        const 缓 = t * t * (3 - 2 * t);
        机.position.lerpVectors(起, 终, 缓);
        机.lookAt(起看.clone().lerp(看, 缓));
        if (t < 1) requestAnimationFrame(走);
        else 好();
      })(起时);
    });
  }

  // 渲染循环：面板在前才画
  (function 画() {
    if (面板.classList.contains('在前')) 画笔.render(场, 相机);
    requestAnimationFrame(画);
  })();

  let 局 = 0;

  async function 进入() {
    const 本局 = ++局;
    const 还在 = () => 局 === 本局 && 面板.classList.contains('在前');
    点.清零();
    收起麦克风();
    照片排.innerHTML = '';
    相机 = 全景机;

    await 说(话.开场);
    if (!还在()) return;

    // 自由探索：15 秒里点谁飞谁
    let 探索中 = true;
    点了座位 = async (名) => {
      if (!探索中) return;
      音效.点一下();
      const 座 = 座位们.find((z) => z.名 === 名);
      await 飞到(座.角);
    };
    await 歇(15000);
    if (!还在()) return;
    探索中 = false;
    点了座位 = null;
    await 飞到(null);

    await 说(话.洗出来了);
    if (!还在()) return;

    // 快照卡一字排开
    const 顺序 = 洗牌([...座位们]);
    const 卡们 = {};
    for (const { 名 } of 顺序) {
      const 卡 = 元('div', '照片卡');
      卡.innerHTML = `<img src="${快照们[名]}" alt="照片">`;
      照片排.appendChild(卡);
      卡们[名] = 卡;
    }

    let 做到 = 0;
    for (const 座 of 顺序) {
      if (!还在()) return;
      const 卡 = 卡们[座.名];
      卡.classList.add('在猜');
      let 错过 = 0;
      await new Promise((好) => {
        点了座位 = async (点名) => {
          if (点名 === 座.名) { 好(); return; }
          错过 += 1;
          音效.答错();
          if (错过 === 1) {
            说(话.错一次);
          } else if (错过 === 2) {
            const 点座 = 座位们.find((z) => z.名 === 点名);
            说(话.坐过去比一比);
            await 飞到(点座.角);
            await 歇(1600);
            await 飞到(null);
            说(话.一样吗);
          } else {
            座位钮们[座.名].classList.add('提示中');
            说(话.错三次);
            setTimeout(() => 座位钮们[座.名].classList.remove('提示中'), 3000);
          }
        };
        说(话.问谁拍的);
      });
      点了座位 = null;
      if (!还在()) return;
      音效.答对();
      卡.classList.remove('在猜');
      卡.classList.add('猜完');
      卡.querySelector('img').after(色点(座.色, '照片主'));
      const 座位 = 座位们.find((z) => z.名 === 座.名);
      await 飞到(座位.角);
      await 说(模.对了(名说(座)));
      await 飞到(null);
      点.点亮(做到++);
    }

    if (!还在()) return;
    await 工具.完成('拍照');
    if (!还在()) return;
    await 说(话.收尾);
  }

  return { 进入 };
}
