// 录音 —— 全站唯一的耳朵。
//
// 点一下开始，出声之后静音约 1.2 秒（或满 6 秒）自动停 —— 5 岁的手不用学「按住」。
// 产出 16kHz 单声道 WAV（浏览器里现拼，不依赖 MediaRecorder 的容器格式，后端不用装 ffmpeg）。

let 流 = null; // 麦克风流开一次就留着：不闪权限弹窗，起录零延迟

async function 开耳朵() {
  if (流 && 流.active) return 流;
  流 = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  return 流;
}

function 拼WAV(样本, 采样率) {
  const 数 = 样本.length;
  const 缓 = new ArrayBuffer(44 + 数 * 2);
  const 视 = new DataView(缓);
  const 写字 = (至, 字) => { for (let i = 0; i < 字.length; i++) 视.setUint8(至 + i, 字.charCodeAt(i)); };
  写字(0, 'RIFF'); 视.setUint32(4, 36 + 数 * 2, true); 写字(8, 'WAVE');
  写字(12, 'fmt '); 视.setUint32(16, 16, true); 视.setUint16(20, 1, true);
  视.setUint16(22, 1, true); 视.setUint32(24, 采样率, true);
  视.setUint32(28, 采样率 * 2, true); 视.setUint16(32, 2, true); 视.setUint16(34, 16, true);
  写字(36, 'data'); 视.setUint32(40, 数 * 2, true);
  for (let i = 0; i < 数; i++) {
    const s = Math.max(-1, Math.min(1, 样本[i]));
    视.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([缓], { type: 'audio/wav' });
}

function 降采样(片们, 原率, 目标率 = 16000) {
  const 总 = 片们.reduce((n, 片) => n + 片.length, 0);
  const 全 = new Float32Array(总);
  let 至 = 0;
  for (const 片 of 片们) { 全.set(片, 至); 至 += 片.length; }
  if (原率 === 目标率) return 全;
  const 出长 = Math.floor(全.length * 目标率 / 原率);
  const 出 = new Float32Array(出长);
  for (let i = 0; i < 出长; i++) {
    const 起 = Math.floor(i * 原率 / 目标率);
    const 止 = Math.min(Math.floor((i + 1) * 原率 / 目标率), 全.length);
    let 和 = 0;
    for (let j = 起; j < 止; j++) 和 += 全[j];
    出[i] = 和 / Math.max(1, 止 - 起);
  }
  return 出;
}

/**
 * 听答案({音量回调}) → {blob} 或 null（一直没出声）。
 * 规则：出声前最多等 5 秒；出声后静 1.2 秒收工；总长封顶 8 秒。
 */
export async function 听答案({ 音量回调 } = {}) {
  const 流 = await 开耳朵();
  const 台 = new (window.AudioContext || window.webkitAudioContext)();
  const 源 = 台.createMediaStreamSource(流);
  const 采 = 台.createScriptProcessor(4096, 1, 1);
  const 片们 = [];
  let 说过话 = false;
  let 静了 = 0; // 连续静音的采样数
  let 收了 = false;
  let 断线 = false; // 兜底腿收的场：回调停了，当「没听到」处理
  let 定 = null;
  const 完 = new Promise((好) => { 定 = 好; });
  const 起始 = 台.currentTime;

  // 收()：幂等收场。正常由 onaudioprocess 触发；兜底=true（看门狗/轨道掉线）时标记断线，
  // 最终返回 null 走既有的听不清流程。收过一次后再调用是 no-op。
  const 收 = (兜底 = false) => {
    if (收了) return;
    收了 = true;
    if (兜底) 断线 = true;
    定();
  };

  // 兜底腿①：墙钟看门狗。不看音频时钟——蓝牙断/权限收回/切后台标签页 suspend 会让 onaudioprocess
  // 停摆，那条写在回调里的 8 秒总长上限便永远等不到；这条腿到点（10 秒，比总长上限略宽）强制收场。
  const 看门狗 = setTimeout(() => 收(true), 10000);

  // 兜底腿②：麦克风轨道被系统收回（拔外接麦、蓝牙耳机断）时浏览器发 ended，立即收场。
  const 轨们 = 流.getAudioTracks();
  for (const 轨 of 轨们) 轨.onended = () => 收(true);

  采.onaudioprocess = (e) => {
    const 片 = e.inputBuffer.getChannelData(0);
    片们.push(new Float32Array(片));
    let 平方和 = 0;
    for (let i = 0; i < 片.length; i++) 平方和 += 片[i] * 片[i];
    const 响度 = Math.sqrt(平方和 / 片.length);
    if (音量回调) 音量回调(Math.min(1, 响度 * 12));
    const 出声 = 响度 > 0.015;
    if (出声) { 说过话 = true; 静了 = 0; } else 静了 += 片.length;
    const 秒 = 台.currentTime - 起始;
    const 静秒 = 静了 / 台.sampleRate;
    if ((说过话 && 静秒 > 1.2) || 秒 > 8 || (!说过话 && 秒 > 5)) 收();
  };

  源.connect(采);
  采.connect(台.destination); // ScriptProcessor 不接输出端就不跑（各家实现的老规矩）
  await 完;
  clearTimeout(看门狗);            // 收尾：清掉看门狗、解绑轨道回调，别泄漏
  for (const 轨 of 轨们) 轨.onended = null;
  采.onaudioprocess = null;
  源.disconnect();
  采.disconnect();
  const 率 = 台.sampleRate;
  台.close();
  if (断线 || !说过话) return null; // 断线（回调停了）当没听到，走听不清
  return { blob: 拼WAV(降采样(片们, 率), 16000) };
}

/** 提前要麦克风权限：开始遮罩点下去时顺手办了，别在第一道题前弹窗吓孩子。 */
export function 先要权限() {
  开耳朵().catch(() => {});
}
