// 取 —— 带超时的 fetch，是全站请求的安全网。
//
// 全站的降级都只在 catch 里触发（说() 落回 Web Speech、坞亮备选、看见保底夸奖……）。
// 可 fetch 碰上「TCP 连上了、却一个字节都不回」这种失败形状（后端/nginx 自己挂死、
// 弱网 stall）时，它既不 resolve 也不 reject —— await 永久 pending，catch 永远等不到，
// 读不懂任何报错的 5 岁孩子只能对着静默的屏幕干等，等于「网站坏了」。
//
// 这一层给每次请求按一个上限：到点就 abort，把「卡住」翻译成一次 throw，让调用方
// 现成的 catch 接住，走它本来就有的那条降级路。**不新建降级逻辑，只是让「卡住」也能
// 进既有的 catch。**
//
// 超时值由各调用点自己传常量进来，不做全局配置、不进 .env —— 每条管子正常耗时不一样
// （TTS 合成慢、GET 探测快），一个数管不了所有人。取值原则见各调用点：都比后端(票 06)
// 的对应上限略长几秒，好让「后端正常的慢」先由后端回一个干净的 502（既有 catch 已接住
// 降级），这一层只兜「后端/nginx 自己挂死、连 502 都发不出」那种彻底的沉默 —— 略长的余量
// 就是为了不误杀正常的慢请求。
//
// 网络模块，按家规不加 mock 测试，浏览器手验。

/**
 * fetch，但到点不回就 abort 并抛错（AbortError），交给调用方现有的 catch。
 *
 * @param {string} 网址
 * @param {RequestInit} [选项]     原样透传给 fetch，signal 由本函数接管
 * @param {number} [超时毫秒]       到点就 abort；由调用点传常量。默认 30s 只是防呆兜底 ——
 *                                  没有它，漏传等于 setTimeout(…, undefined) = 0ms 立即 abort，
 *                                  一个手滑就把整条管子变成永远失败。取现有调用点的最大值：
 *                                  兜底宁可偏慢，也不能误杀哪条正常的管子。
 * @param {typeof fetch} [底层取]   注入口（默认 globalThis.fetch），给 看见.js 的可测接口留着
 * @returns {Promise<Response>}
 */
export async function 带超时取(网址, 选项 = {}, 超时毫秒 = 30_000, 底层取 = globalThis.fetch?.bind(globalThis)) {
  const 控 = new AbortController();
  const 闹钟 = setTimeout(() => 控.abort(), 超时毫秒);
  try {
    return await 底层取(网址, { ...选项, signal: 控.signal });
  } finally {
    // 正常返回、报错、被 abort，三种收场都把闹钟撤了：别让一个已经没人等的请求
    // 过一会儿还去 abort 一个早已解开的 AbortController（无害，但没必要）。
    clearTimeout(闹钟);
  }
}
