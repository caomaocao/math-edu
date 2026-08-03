import * as THREE from '/shared/vendor/three/three.module.js';

import { CELL_SIZE } from '../domain/net.js';

/**
 * 方方 —— 被折的那只正方体本身，不是旁边的向导。
 *
 * 前代的沙盒里，被折的是一块没有眼睛的几何体：折上了没人欢呼，折错了没人喊疼，
 * 孩子只是在操作一个物件。给它一张脸，这件事就变成「我在帮方方穿衣服」。
 *
 * 脸是一张 Sprite，永远正对镜头 —— 孩子把镜头转到哪儿，方方就看着他到哪儿。
 * 脸摆在哪儿整个交给 main.js 算（见 方方站哪儿）—— 那件事要同时知道折痕树的根在哪、
 * 现在折到几分、镜头站在哪个角度，三样都在 main.js 手里。这里只管长相和情绪。
 *
 * **脸不是一直挂着的**：main.js 只在纸停稳的时候（摊平／穿好）给得出站位，
 * 正在折的半路上给的是 null，这儿就把脸淡出去。故事上讲得通 ——
 * 换衣服的时候脸埋在衣服里，穿好了才探出来朝孩子笑。
 *
 * 情绪由折叠结果驱动（合上/重叠/漏洞），不管这一下是点出来的、拖出来的还是喊出来的。
 */

/** 脸画在多大的一张 canvas 上。眼睛里有渐变和高光，384 才不糊 */
const 画布边长 = 384;

/** 情绪各自持续多久（秒），过了自己回到发呆 */
const 情绪时长 = { 跳舞: 2.6, 发抖: 2.2, 喷嚏: 2.2 };

/** 露脸／收脸淡多久（秒）。快，但别是「啪」地闪现 —— 那看着像画面出了毛病 */
const 淡入淡出 = 0.22;

/*
  脸的比例照「婴儿脸」来 —— 那是让人觉得可爱的那套长相，不是随手摆的：
    · 眼睛占的地方要大（半径接近脸宽的十分之一），而且要**压得低**，
      放在脸的中线偏下。眼睛摆在正中间是成年人的比例，画出来会显得凶。
    · 两只眼睛离得开一些，中间留出空白。挤在一起就成了斗鸡眼。
    · 眼睛里要有两处高光：左上一大点、右下一小点。只有一点高光是塑料珠子，
      两点才有湿润的、活的感觉。
    · 腮红要柔，边界得化开；一块实心的粉色像两块补丁。
    · 嘴要小。五官里嘴一大，脸立刻就长大了。
  没有鼻子是故意的：这一路画法（三丽鸥那一类）鼻子一加就抢戏，
  而方方最要紧的是那双眼睛在看着孩子。
*/

const 眼色深 = '#2a3355';
const 眼色浅 = '#4a5580';

/**
 * 把方方的脸画出来。
 * @param {CanvasRenderingContext2D} 笔
 * @param {{眯眼: number, 嘴: '笑'|'哦'|'扁'}} 表情 眯眼 0=睁着 1=闭上
 */
function 画脸(笔, { 眯眼 = 0, 嘴 = '笑' } = {}) {
  const 边 = 画布边长;
  const 中 = 边 / 2;
  笔.clearRect(0, 0, 边, 边);

  const 眼距 = 边 * 0.178;
  const 眼高 = 边 * 0.47;
  const 眼半径 = 边 * 0.099;

  /*
    腮红：先画，让眼睛压在上面。
    垫一层柔白再上粉 —— 衣服的颜色是孩子自己涂的，粉腮红画在红格子上会整个消失
    （粉压粉），而腮红没了，方方就只剩一对眼睛，看着发愣。白底把它从任何底色里托出来。
  */
  for (const 侧 of [-1, 1]) {
    const x = 中 + 侧 * 边 * 0.268;
    const y = 边 * 0.6;
    const 半径 = 边 * 0.088;

    const 垫 = 笔.createRadialGradient(x, y, 0, x, y, 半径);
    垫.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
    垫.addColorStop(1, 'rgba(255, 255, 255, 0)');
    笔.fillStyle = 垫;
    笔.beginPath();
    笔.ellipse(x, y, 半径, 半径 * 0.7, 0, 0, Math.PI * 2);
    笔.fill();

    const 渐 = 笔.createRadialGradient(x, y, 0, x, y, 半径 * 0.86);
    渐.addColorStop(0, 'rgba(255, 122, 152, 0.72)');
    渐.addColorStop(0.55, 'rgba(255, 140, 168, 0.42)');
    渐.addColorStop(1, 'rgba(255, 160, 185, 0)');
    笔.fillStyle = 渐;
    笔.beginPath();
    笔.ellipse(x, y, 半径 * 0.86, 半径 * 0.6, 0, 0, Math.PI * 2);
    笔.fill();
  }

  // --- 眼睛 -----------------------------------------------------------
  for (const 侧 of [-1, 1]) {
    const x = 中 + 侧 * 眼距;

    if (眯眼 > 0.72) {
      /*
        闭眼那一下画成向上弯的月牙（∩），不是向下弯，也不是一条直线：
        向上弯是「笑眯眯」，向下弯是「困了」，直线是「晕过去了」。
      */
      笔.strokeStyle = 眼色深;
      笔.lineWidth = 边 * 0.028;
      笔.lineCap = 'round';
      笔.beginPath();
      笔.arc(x, 眼高 + 眼半径 * 0.5, 眼半径 * 0.95, Math.PI * 1.12, Math.PI * 1.88);
      笔.stroke();
      continue;
    }

    const 压扁 = 1 - 眯眼 * 0.82; // 眨到一半是压扁的椭圆
    const 高 = 眼半径 * 压扁;

    // 眼白衬底：眼珠外面一圈很浅的白，眼睛才不像贴在脸上的两个洞
    笔.fillStyle = 'rgba(255,255,255,0.62)';
    笔.beginPath();
    笔.ellipse(x, 眼高, 眼半径 * 1.1, 高 * 1.1, 0, 0, Math.PI * 2);
    笔.fill();

    // 眼珠：上浅下深的渐变，看着是个球，不是一块色板
    const 珠 = 笔.createRadialGradient(
      x - 眼半径 * 0.25,
      眼高 - 高 * 0.3,
      眼半径 * 0.1,
      x,
      眼高,
      眼半径,
    );
    珠.addColorStop(0, 眼色浅);
    珠.addColorStop(1, 眼色深);
    笔.fillStyle = 珠;
    笔.beginPath();
    笔.ellipse(x, 眼高, 眼半径, 高, 0, 0, Math.PI * 2);
    笔.fill();

    // 两处高光，左上一大点、右下一小点
    笔.fillStyle = 'rgba(255,255,255,0.96)';
    笔.beginPath();
    笔.ellipse(
      x - 眼半径 * 0.32,
      眼高 - 高 * 0.36,
      眼半径 * 0.3,
      高 * 0.3,
      0,
      0,
      Math.PI * 2,
    );
    笔.fill();

    笔.fillStyle = 'rgba(255,255,255,0.62)';
    笔.beginPath();
    笔.ellipse(
      x + 眼半径 * 0.34,
      眼高 + 高 * 0.34,
      眼半径 * 0.15,
      高 * 0.15,
      0,
      0,
      Math.PI * 2,
    );
    笔.fill();
  }

  // --- 嘴：小，而且离眼睛近 --------------------------------------------
  笔.strokeStyle = 眼色深;
  笔.lineWidth = 边 * 0.021;
  笔.lineCap = 'round';
  笔.lineJoin = 'round';

  if (嘴 === '笑') {
    // 猫嘴 ω：两个小弧背靠背，比一道弧甜得多
    const y = 边 * 0.615;
    const 半 = 边 * 0.032;
    笔.beginPath();
    笔.arc(中 - 半, y, 半, Math.PI * 0.08, Math.PI * 0.92);
    笔.stroke();
    笔.beginPath();
    笔.arc(中 + 半, y, 半, Math.PI * 0.08, Math.PI * 0.92);
    笔.stroke();
  } else if (嘴 === '哦') {
    // 惊讶／打喷嚏：一个圆嘟嘟的小口，填上暖色才有厚度
    笔.fillStyle = 'rgba(214, 108, 128, 0.9)';
    笔.beginPath();
    笔.ellipse(中, 边 * 0.635, 边 * 0.036, 边 * 0.047, 0, 0, Math.PI * 2);
    笔.fill();
    笔.stroke();
  } else {
    // 扁嘴：画成一道小波浪。一条直线太冷，波浪才是「不太舒服」
    const y = 边 * 0.635;
    const 宽 = 边 * 0.055;
    笔.beginPath();
    笔.moveTo(中 - 宽, y);
    笔.quadraticCurveTo(中 - 宽 / 2, y - 边 * 0.018, 中, y);
    笔.quadraticCurveTo(中 + 宽 / 2, y + 边 * 0.018, 中 + 宽, y);
    笔.stroke();
  }
}

/**
 * 造一个方方。
 *
 * @param {THREE.Scene} 场景
 * @param {THREE.Group} 衣架 衣服挂在这个组里。情绪（转圈、发抖、打喷嚏）动的是**衣架**，
 *   折叠引擎动的是衣架里面那件衣服 —— 两边各写各的变换，不会每帧互相覆盖。
 * @returns 方方的把手
 */
export function 创建方方(场景, 衣架) {
  const 画布 = document.createElement('canvas');
  画布.width = 画布边长;
  画布.height = 画布边长;
  const 笔 = 画布.getContext('2d');

  const 贴图 = new THREE.CanvasTexture(画布);
  const 材质 = new THREE.SpriteMaterial({
    map: 贴图,
    transparent: true,
    depthTest: false, // 永远画在最上层：方方的脸不该被自己的身子挡住
    toneMapped: false,
  });
  const 脸 = new THREE.Sprite(材质);
  脸.renderOrder = 999;
  脸.visible = false;
  场景.add(脸);

  /** 衣架上有没有挂着衣服。空舞台上不该浮着一张脸 */
  let 有衣服 = false;
  /** 脸这会儿露出来几分（0 藏着，1 全露）。淡入淡出用 */
  let 露脸 = 0;
  let 情绪 = '发呆';
  let 情绪走了 = 0;
  let 上一次眯眼 = -1;
  let 上一次嘴 = null;
  /** 下一次眨眼在什么时候。随机，别让两只方方同时眨 */
  let 下次眨眼 = 1.4 + Math.random() * 2.6;
  let 走过的 = 0;

  function 重画(眯眼, 嘴) {
    // canvas 重画要传显卡，一样就别传了 —— 每帧传一次贴图会白烧一块 GPU
    if (Math.abs(眯眼 - 上一次眯眼) < 0.02 && 嘴 === 上一次嘴) return;
    上一次眯眼 = 眯眼;
    上一次嘴 = 嘴;
    画脸(笔, { 眯眼, 嘴 });
    贴图.needsUpdate = true;
  }

  function 设情绪(名) {
    情绪 = 名;
    情绪走了 = 0;
  }

  /** 每帧从零开始摆衣架，情绪的偏移都加在这份干净的底子上 */
  function 衣架归位() {
    衣架.position.set(0, 0, 0);
    衣架.rotation.set(0, 0, 0);
    衣架.scale.setScalar(1);
  }

  return {
    /**
     * 孩子改了格子，衣服重建了。方方不跟着重建 —— 它就是这只正方体本身，
     * 换的只是身上那件衣服。
     * @param {boolean} 穿着没有 衣架上还有没有衣服
     */
    换身子(穿着没有) {
      有衣服 = Boolean(穿着没有);
      // 从头淡进来：孩子改了格子，新衣服是新的一件，脸别在旧位置上留着
      露脸 = 0;
      脸.visible = false;
      材质.opacity = 0;
      设情绪('发呆');
      衣架归位();
    },

    /**
     * 演一个情绪。
     * @param {'跳舞'|'发抖'|'喷嚏'|'发呆'} 名 跳舞=衣服穿上了，发抖=两片叠一起，喷嚏=漏了个洞
     */
    情绪: 设情绪,

    get 当前情绪() {
      return 情绪;
    },

    /**
     * 每帧叫一次。
     * @param {number} 秒 距上一帧多久
     * @param {THREE.Vector3|null} 站位 脸就摆在这个世界坐标上（见 main.js 的 方方站哪儿），
     *   null = 这一帧不该露脸（没衣服，或者衣服正折到半路）—— 脸淡出去，位置留在原地不动。
     *   位置整个交给 main.js 算 —— 只有它同时知道折痕树的根在哪、现在折到几分、
     *   镜头站在哪个角度。Sprite 自己会转过来对着镜头，这里不用管朝向。
     */
    更新(秒, 站位) {
      走过的 += 秒;
      if (!有衣服) {
        露脸 = 0;
        脸.visible = false;
        return;
      }
      /*
        身子的动作（发抖、打喷嚏）照走不误，跟脸露不露没关系 ——
        摊回平地那几秒脸是收着的，可衣架还在打那个喷嚏的余震，不能停在半路上。
      */
      衣架归位();

      // --- 眨眼和呼吸 ---------------------------------------------------
      let 眯眼 = 0;
      if (走过的 >= 下次眨眼) {
        const 眨了多久 = 走过的 - 下次眨眼;
        眯眼 = 眨了多久 < 0.16 ? Math.sin((眨了多久 / 0.16) * Math.PI) : 0;
        if (眨了多久 >= 0.16) 下次眨眼 = 走过的 + 1.6 + Math.random() * 3;
      }

      let 嘴 = '笑';
      let 脸大小 = CELL_SIZE * 0.78;
      情绪走了 += 秒;

      // --- 情绪 ---------------------------------------------------------
      if (情绪 === '跳舞') {
        const t = 情绪走了;
        衣架.rotation.y = t * 5.2; // 转圈
        衣架.position.y = Math.abs(Math.sin(t * 7)) * CELL_SIZE * 0.16; // 蹦跶
        脸大小 *= 1 + Math.abs(Math.sin(t * 7)) * 0.08;
        眯眼 = 0.85; // 笑得眯起来
        if (情绪走了 > 情绪时长.跳舞) 设情绪('发呆');
      } else if (情绪 === '发抖') {
        const t = 情绪走了;
        衣架.position.x = Math.sin(t * 46) * CELL_SIZE * 0.035; // 痒得直哆嗦
        衣架.rotation.y = Math.sin(t * 38) * 0.06;
        嘴 = '扁';
        if (情绪走了 > 情绪时长.发抖) 设情绪('发呆');
      } else if (情绪 === '喷嚏') {
        const t = 情绪走了;
        if (t < 0.75) {
          // 吸气：慢慢仰起来、鼓起来
          const k = t / 0.75;
          衣架.scale.setScalar(1 + k * 0.1);
          衣架.position.y = k * CELL_SIZE * 0.05;
          嘴 = '哦';
          眯眼 = k * 0.8;
        } else {
          // 阿嚏！猛地一缩，然后余震
          const k = Math.min(1, (t - 0.75) / 0.5);
          const 抖 = (1 - k) * Math.sin((t - 0.75) * 40);
          衣架.scale.setScalar(1 - (1 - k) * 0.12);
          衣架.position.y = 抖 * CELL_SIZE * 0.05;
          衣架.position.z = 抖 * CELL_SIZE * 0.04;
          嘴 = '哦';
        }
        if (情绪走了 > 情绪时长.喷嚏) 设情绪('发呆');
      } else {
        // 发呆：一起一伏地呼吸，很轻，只是别让它像块死石头
        const 呼吸 = Math.sin(走过的 * 1.7) * 0.5 + 0.5;
        脸大小 *= 1 + 呼吸 * 0.012;
        衣架.position.y = 呼吸 * CELL_SIZE * 0.008;
      }

      // --- 露脸还是收脸 ---------------------------------------------------
      const 一步 = Math.max(0, 秒) / 淡入淡出;
      露脸 = 站位 ? Math.min(1, 露脸 + 一步) : Math.max(0, 露脸 - 一步);
      if (站位) 脸.position.copy(站位);

      材质.opacity = 露脸;
      脸.visible = 露脸 > 0.02;
      if (!脸.visible) return; // 藏着的时候不用重画 canvas，也不用摆脸

      // 淡进来的同时长大一点：探出头来的那下带点弹，比单纯变亮有精神
      脸.scale.setScalar(脸大小 * (0.72 + 0.28 * 露脸));
      重画(眯眼, 嘴);
    },

    dispose() {
      衣架归位();
      脸.removeFromParent();
      材质.dispose();
      贴图.dispose();
    },
  };
}
