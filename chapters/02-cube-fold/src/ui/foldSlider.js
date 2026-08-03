/**
 * 折叠滑块 —— 直接驱动折叠度，不是播放按钮。
 * 拖到哪停到哪：滑块停在 0.4，衣服就静止在 0.4，孩子可以来回蹭着看半折状态。
 */

export function createFoldSlider(element, { onFold, onGrab }) {
  /**
   * 把已折起来的那一段染蓝。
   * 算的是把手圆心走到哪儿，不是轨道的百分之几 —— 把手只在两端各留半个身位的范围里跑，
   * 直接用百分比的话，滑到两头颜色就会跟把手错开半个把手那么多。
   */
  const 刷新进度条 = () => {
    const 把手 = parseFloat(getComputedStyle(element).getPropertyValue('--把手大小')) || 0;
    const 可走 = Math.max(element.clientWidth - 把手, 0);
    element.style.setProperty('--进度', `${把手 / 2 + 可走 * element.valueAsNumber}px`);
  };

  const 变了 = () => {
    刷新进度条();
    onFold(element.valueAsNumber);
  };

  element.addEventListener('input', 变了);
  window.addEventListener('resize', 刷新进度条); // 滑块变宽了，蓝色那段也得跟着重算

  // 孩子一上手就得听他的：正在自动弹回平地的话，立刻停下来把把手还给他
  const 抓住了 = () => onGrab?.();
  element.addEventListener('pointerdown', 抓住了);
  element.addEventListener('keydown', 抓住了);

  刷新进度条();

  return {
    get 折叠度() {
      return element.valueAsNumber;
    },
    /**
     * 只把把手挪过去，不回调 onFold。
     *
     * 逐面点击折之后，衣服的折叠度不再由滑块说了算 —— 滑块降级成一块仪表盘，
     * 得跟着衣服走。要是这儿也回调 onFold，就成了「衣服通知滑块、滑块又去改衣服」，
     * 孩子点一片，六片一起跟着动。
     */
    跟着走(值) {
      element.valueAsNumber = Math.min(1, Math.max(0, 值));
      刷新进度条();
    },
    设可用(可以) {
      element.disabled = !可以;
      element.closest('.折叠条')?.classList.toggle('停用', !可以);
    },
  };
}
