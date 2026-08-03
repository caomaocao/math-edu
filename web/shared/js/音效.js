// 音效 —— 全站的小声音，WebAudio 现场合成，零素材文件。
// Chrome 规定音频要用户先动一下手才能出声：开始遮罩点下去时调 解锁()。

let 台;

export function 解锁() {
  if (!台) 台 = new (window.AudioContext || window.webkitAudioContext)();
  if (台.state === 'suspended') 台.resume();
  return 台;
}

function 叮(频率, 起, 长 = 0.18, 音量 = 0.22, 形 = 'sine') {
  if (!台) return;
  // 自愈：bfcache 恢复、系统打断等会把音频台挂起（Safari 挂起态是 'interrupted'，不是 'suspended'），
  // 而开始遮罩那一次性解锁监听早已消耗。发声本就由孩子的点击/拖拽触发，此刻正在手势调用栈里，
  // 就地趁当次手势 resume——幂等、失败静默，两讲主控一行都不用改。
  if (台.state !== 'running') {
    try { const p = 台.resume(); if (p && p.catch) p.catch(() => {}); } catch { /* 唤醒失败就退化成静默，绝不打断孩子 */ }
  }
  const 振 = 台.createOscillator();
  const 幅 = 台.createGain();
  振.type = 形;
  振.frequency.value = 频率;
  幅.gain.setValueAtTime(0, 台.currentTime + 起);
  幅.gain.linearRampToValueAtTime(音量, 台.currentTime + 起 + 0.015);
  幅.gain.exponentialRampToValueAtTime(0.001, 台.currentTime + 起 + 长);
  振.connect(幅).connect(台.destination);
  振.start(台.currentTime + 起);
  振.stop(台.currentTime + 起 + 长 + 0.05);
}

export const 音效 = {
  点一下() { 叮(660, 0, 0.08, 0.12, 'triangle'); },
  答对() { 叮(523, 0); 叮(659, 0.09); 叮(784, 0.18, 0.3); },
  答错() { 叮(330, 0, 0.2, 0.12); 叮(262, 0.15, 0.3, 0.12); }, // 温柔的「哦哦」，不吓人
  星星() { 叮(880, 0, 0.12, 0.16); 叮(1175, 0.08, 0.12, 0.16); 叮(1568, 0.16, 0.35, 0.18); },
  开录() { 叮(440, 0, 0.09, 0.14, 'triangle'); 叮(587, 0.08, 0.09, 0.14, 'triangle'); },
  收录() { 叮(587, 0, 0.09, 0.12, 'triangle'); 叮(440, 0.08, 0.09, 0.12, 'triangle'); },
  大烟花() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => 叮(f, i * 0.11, 0.4, 0.2));
    for (let i = 0; i < 8; i++) 叮(200 + Math.random() * 900, 0.6 + i * 0.13, 0.3, 0.1, 'sawtooth');
  },
};
