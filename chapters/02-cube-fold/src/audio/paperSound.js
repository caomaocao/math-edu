import { 解锁 } from '/shared/js/音效.js';

/**
 * 折纸的声音 —— 一下短促的「唰」。
 *
 * 共享的 `音效` 里全是叮叮当当的正弦音（点一下、答对、星星），
 * 拿它当折纸声，孩子听见的是「点了个按钮」，不是「折了一下纸」。
 * 纸的声音是一小撮噪声：宽频、来得快、去得更快。
 *
 * 借的是 `解锁()` 交出来的那只 AudioContext —— 全站只该有一只，
 * 而且它已经在开始遮罩那一下被用户手势解过锁了。这里不新开、也不改九件套。
 */

/** 噪声样本存一份反复用：每折一次现造一段 buffer 太浪费 */
let 噪声 = null;
let 造它的台 = null;

function 取噪声(台) {
  if (噪声 && 造它的台 === 台) return 噪声;
  const 长度 = Math.floor(台.sampleRate * 0.25);
  噪声 = 台.createBuffer(1, 长度, 台.sampleRate);
  const 数 = 噪声.getChannelData(0);
  for (let i = 0; i < 长度; i += 1) 数[i] = Math.random() * 2 - 1;
  造它的台 = 台;
  return 噪声;
}

/**
 * 折一下的声音。
 * @param {{轻重?: number}} [选项] 轻重 0–1：点一下折是脆的一下，按住慢慢折是轻轻的沙沙
 */
export function 折纸声({ 轻重 = 1 } = {}) {
  let 台;
  try {
    台 = 解锁();
  } catch {
    return; // 没有 AudioContext（浏览器不给）就安静地不出声，别打断孩子
  }
  if (!台) return;

  const 源 = 台.createBufferSource();
  源.buffer = 取噪声(台);
  源.loop = true;

  // 带通把噪声收成「纸」的音色：太低像打雷，太高像电流
  const 滤 = 台.createBiquadFilter();
  滤.type = 'bandpass';
  滤.frequency.value = 1900 + Math.random() * 700; // 每次略有不同，连折六次才不像复读机
  滤.Q.value = 0.9;

  const 幅 = 台.createGain();
  const 此刻 = 台.currentTime;
  const 长 = 0.1 + 轻重 * 0.06;
  幅.gain.setValueAtTime(0, 此刻);
  幅.gain.linearRampToValueAtTime(0.16 * 轻重, 此刻 + 0.008); // 起音要快，纸是「唰」不是「呜」
  幅.gain.exponentialRampToValueAtTime(0.0008, 此刻 + 长);

  源.connect(滤).connect(幅).connect(台.destination);
  源.start(此刻);
  源.stop(此刻 + 长 + 0.02);
}
