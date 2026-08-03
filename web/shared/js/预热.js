// 预热 —— 进讲后的空闲时段，把本讲会用到的实体图静静拉进浏览器缓存，
// 消灭孩子首次进环节时图片一张张迟到弹入的那一下。
//
// 这一层只管「怎么灌」——空闲起步、并发 ≤4、new Image() 拉取、任何失败静默；
// 「灌哪些图」由 实体图.js 的纯函数 图清单() 算出来，两处分工，测试也各归各的席：
// 图清单() 是纯逻辑，进 node 测试席；这儿是 Image() + idle 的 UI-shaped 活儿，手工验。
//
// 与 TTS 预热（说话.js 的 备话）互不排队：那个吃 DashScope 合成，这个吃静态带宽，
// 不共享瓶颈。语言切换也不必重跑：URL 不带语种，同一张图第二次 Image() 直接命中
// 浏览器缓存，不会重复下载。

import { 图清单 } from './实体图.js';

/** 同时最多拉几张。留着别把孩子这会儿真要的请求（开场白之外的按需图）挤没了 */
const 并发上限 = 4;

/** 空闲起步：有 requestIdleCallback 就用，没有（Safari 老版本）就退化成 setTimeout */
function 空闲里(活) {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => 活());
  else setTimeout(活, 300);
}

/**
 * 拉一张图进浏览器缓存。
 * 成也好、败也好都当「这一张处理完了」resolve —— 预热挂了孩子无感，
 * 那张图等他真进环节时再按需加载，绝不因为一张 404 就把整趟预热拖停。
 */
function 拉一张(url) {
  return new Promise((停) => {
    const 图 = new Image();
    图.onload = () => 停();
    图.onerror = () => 停();
    图.src = url;
  });
}

/** 一串 URL，并发 ≤4 地灌进缓存：开 min(4, 张数) 个工人，各自领了下一张接着拉 */
async function 灌(url们) {
  let 下一个 = 0;
  async function 工人() {
    while (下一个 < url们.length) {
      await 拉一张(url们[下一个++]);
    }
  }
  const 人数 = Math.min(并发上限, url们.length);
  await Promise.all(Array.from({ length: 人数 }, 工人));
}

/**
 * 预热实体图(取名单) —— 每讲启动调一次。
 *
 * 取名单: () => 名单 | Promise<名单>，名单是一串规范名。放成**函数**是有意的：
 * 第 3 讲要把 14 个环节模块 import 进来才读得到各自的 实体们（跟覆盖测试同一接缝），
 * 这件重活也一并推迟到空闲里做，绝不占开场那一下；第 2 讲的供货就轻，
 * 直接把调色板花名册递回来即可。
 *
 * 时序：空闲才起步（requestIdleCallback）→ 取名单 → 图清单 去重过滤 → 并发 ≤4 拉。
 * 全程任何一步抛了都安静作罢（某个环节没盖好、名单取不到……），课程照旧按需加载 ——
 * 预热是白得的便利，不是孩子这一局的依赖。
 */
export function 预热实体图(取名单) {
  空闲里(async () => {
    let 名单;
    try {
      名单 = await 取名单();
    } catch {
      return; // 名单都取不到，整趟安静收场
    }
    try {
      await 灌(图清单(名单 ?? []));
    } catch {
      // 灌到一半出了意外也不冒泡：孩子这一局跟预热没有依赖关系
    }
  });
}
