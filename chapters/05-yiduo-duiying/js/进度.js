// 进度 —— 第5讲在 localStorage 里那一份带版本号的 JSON。
// 读到版本对不上的旧数据一律当没有；存不下（无痕模式、存满）绝不抛错。
//
// 每讲一份自己的进度模块、自己的键（第2讲 cube-fold:进度:v*、第3讲 fangwei:进度:v1、
// 第4讲 shuzi:进度:v1），不共用。这一讲用 yiduo:进度:v1，形状与合并语义跟第 3/4 讲同源
// （合并 的 node 测试归票 09 的收尾一并补）。
//
// 云端同步三处挂钩（见 /shared/js/云同步.js 头的三条硬约束）：
//   · 每次本地写入落盘后同步 记脏(存储键)；收编走同一写路径，靠云同步的 正在收编 guard 咽掉；
//   · 重来（清空）不删键，写带新重置戳的空包，由 主.js 紧接着 立即推；
//   · 合并(本地, 云端) 纯函数供同步引擎逐键调度（星并集只增不减 / 柜冲突本地胜 / 整包重置戳胜出）。

import { 记脏 } from '/shared/js/云同步.js';

const 钥匙 = 'yiduo:进度:v1';

/** 这一讲进度在 localStorage 里的键，交给 云同步 的 登记() 用。 */
export const 存储键 = 钥匙;

function 读全部() {
  try {
    const 生 = JSON.parse(localStorage.getItem(钥匙) || 'null');
    if (生 && 生.版本 === 1) return 生;
  } catch { /* 坏数据当没有 */ }
  return { 版本: 1, 星: {}, 柜: {} };
}

function 写全部(数) {
  try {
    localStorage.setItem(钥匙, JSON.stringify(数));
    记脏(存储键); // 落盘成功后才记脏（同步）；收编期间这一记被云同步的 正在收编 guard 咽掉
  } catch { /* 存不下照样玩 */ }
}

// ── 云同步用的纯函数（不碰 localStorage / DOM / 网络，进 node --test）─────────────

function 空包() {
  return { 版本: 1, 星: {}, 柜: {}, 重置戳: 0 };
}

function 净整包(包) {
  if (!包 || typeof 包 !== 'object' || 包.版本 !== 1) return null;
  const 星 = (包.星 && typeof 包.星 === 'object' && !Array.isArray(包.星)) ? 包.星 : {};
  const 柜 = (包.柜 && typeof 包.柜 === 'object' && !Array.isArray(包.柜)) ? 包.柜 : {};
  const 重置戳 = (typeof 包.重置戳 === 'number' && Number.isFinite(包.重置戳)) ? 包.重置戳 : 0;
  return { 版本: 1, 星, 柜, 重置戳 };
}

/**
 * 合并(本地, 云端) —— 云同步逐键调度调的纯函数。语义见第 3/4 讲：整包重置戳先行、
 * 戳同才字段合（星并集只增不减、柜同格冲突本地胜）、坏形状当没有不炸。
 */
export function 合并(本地, 云端) {
  const 甲 = 净整包(本地);
  const 乙 = 净整包(云端);
  if (!甲 && !乙) return 空包();
  if (!甲) return 乙;
  if (!乙) return 甲;
  if (甲.重置戳 > 乙.重置戳) return 甲;
  if (乙.重置戳 > 甲.重置戳) return 乙;
  const 星 = { ...乙.星, ...甲.星 };
  const 柜 = { ...乙.柜, ...甲.柜 };
  return { 版本: 1, 星, 柜, 重置戳: 甲.重置戳 };
}

// ── 讲内接口 ────────────────────────────────────────────────────────────────

export const 进度 = {
  有星(号) { return !!读全部().星[号]; },
  点星(号) {
    const 数 = 读全部();
    if (数.星[号]) return false;
    数.星[号] = true;
    写全部(数);
    return true; // 新点亮才 true，庆祝只放一次
  },
  数星() { return Object.keys(读全部().星).length; },
  读柜(格) { return 读全部().柜[格]; },
  写柜(格, 值) { const 数 = 读全部(); 数.柜[格] = 值; 写全部(数); },
  清空() {
    try {
      localStorage.setItem(钥匙, JSON.stringify({ 版本: 1, 星: {}, 柜: {}, 重置戳: Date.now() }));
    } catch { /* 存不下照样玩 */ }
  },
  落整包(数) {
    if (数 && 数.版本 === 1) 写全部(数);
  },
};
