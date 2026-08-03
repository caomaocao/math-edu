import { test } from 'node:test';
import assert from 'node:assert/strict';

// 语言模块把「当前语言」记在 localStorage 里，是页面级的单例状态。
// 每个用例要的是一张白纸：带 query 重新 import 一次拿到全新的模块实例，
// 顺便把这一局的假存储装上（存储 === null 表示这台机器根本没有 localStorage）。
let 第几次 = 0;
async function 装模块(存储) {
  if (存储 === null) delete globalThis.localStorage;
  else globalThis.localStorage = 存储;
  return import(`../js/语言.js?第${++第几次}次`);
}

function 假存储(初值 = {}, { 读就炸 = false, 写就炸 = false } = {}) {
  const 里 = new Map(Object.entries(初值));
  return {
    getItem(键) {
      if (读就炸) throw new Error('隐私模式：读不了');
      return 里.has(键) ? 里.get(键) : null;
    },
    setItem(键, 值) {
      if (写就炸) throw new Error('存储满了：写不进');
      里.set(键, String(值));
    },
    removeItem(键) {
      if (写就炸) throw new Error('存储满了：删不掉');
      里.delete(键);
    },
    看(键) { return 里.has(键) ? 里.get(键) : null; },
  };
}

const 键 = '站点:语言';

test('没选过就是中文', async () => {
  const { 当前语言 } = await 装模块(假存储());
  assert.equal(当前语言(), 'cn');
});

test('存过英文就是英文', async () => {
  const { 当前语言 } = await 装模块(假存储({ [键]: 'en' }));
  assert.equal(当前语言(), 'en');
});

test('存了看不懂的值当没选过', async () => {
  for (const 脏 of ['de', '', 'CN', 'null']) {
    const { 当前语言 } = await 装模块(假存储({ [键]: 脏 }));
    assert.equal(当前语言(), 'cn', `${脏} 应该被当成没选过`);
  }
});

test('隐私模式读不出来也不抛，按中文算', async () => {
  const { 当前语言 } = await 装模块(假存储({ [键]: 'en' }, { 读就炸: true }));
  assert.equal(当前语言(), 'cn');
});

test('压根没有 localStorage 也不抛，按中文算', async () => {
  const { 当前语言 } = await 装模块(null);
  assert.equal(当前语言(), 'cn');
});

test('切成英文，当场就是英文', async () => {
  const { 当前语言, 设语言 } = await 装模块(假存储());
  设语言('en');
  assert.equal(当前语言(), 'en');
});

test('选择留得住：重开一次页面还是那个语言', async () => {
  const 存储 = 假存储();
  const { 设语言 } = await 装模块(存储);
  设语言('en');
  const { 当前语言 } = await 装模块(存储); // 同一份存储、全新的模块 = 重开浏览器
  assert.equal(当前语言(), 'en');
});

test('存不下也不抛，这一局照样是英文', async () => {
  for (const 存储 of [假存储({}, { 写就炸: true }), null]) {
    const { 当前语言, 设语言 } = await 装模块(存储);
    assert.doesNotThrow(() => 设语言('en'));
    assert.equal(当前语言(), 'en');
  }
});

test('切换时所有订阅者都被叫醒，带着新语言', async () => {
  const { 订阅语言, 设语言 } = await 装模块(假存储());
  const 甲 = [];
  const 乙 = [];
  订阅语言((语) => 甲.push(语));
  订阅语言((语) => 乙.push(语));
  设语言('en');
  设语言('cn');
  assert.deepEqual(甲, ['en', 'cn']);
  assert.deepEqual(乙, ['en', 'cn']);
});

test('订阅本身不出声：没切换就不通知', async () => {
  const { 订阅语言, 设语言 } = await 装模块(假存储());
  const 收到 = [];
  订阅语言((语) => 收到.push(语));
  assert.deepEqual(收到, []);
  设语言('cn'); // 本来就是中文，不算切换
  设语言('de'); // 认都不认得
  assert.deepEqual(收到, []);
});

test('退订之后不再被叫醒', async () => {
  const { 订阅语言, 设语言 } = await 装模块(假存储());
  const 收到 = [];
  const 退订 = 订阅语言((语) => 收到.push(语));
  设语言('en');
  退订();
  设语言('cn');
  assert.deepEqual(收到, ['en']);
});

test('一个订阅者摔了，后面的照样收到', async () => {
  const { 订阅语言, 设语言, 当前语言 } = await 装模块(假存储());
  const 收到 = [];
  订阅语言(() => { throw new Error('这个面板重绘时炸了'); });
  订阅语言((语) => 收到.push(语));
  assert.doesNotThrow(() => 设语言('en'));
  assert.deepEqual(收到, ['en']);
  assert.equal(当前语言(), 'en');
});

test('订阅者看到的已经是新语言', async () => {
  const { 订阅语言, 设语言, 当前语言 } = await 装模块(假存储());
  let 回调里读到的 = null;
  订阅语言(() => { 回调里读到的 = 当前语言(); });
  设语言('en');
  assert.equal(回调里读到的, 'en');
});

test('看不懂的语言一概不理', async () => {
  const 存储 = 假存储({ [键]: 'en' });
  const { 当前语言, 设语言 } = await 装模块(存储);
  for (const 脏 of ['de', '', null, undefined, 'EN']) 设语言(脏);
  assert.equal(当前语言(), 'en');
  assert.equal(存储.看(键), 'en');
});

test('选()：按当前语言从同构条目里取', async () => {
  const { 选, 设语言 } = await 装模块(假存储());
  const 条 = { cn: '选一讲开始', en: 'Pick a lesson' };
  assert.equal(选(条), '选一讲开始');
  设语言('en');
  assert.equal(选(条), 'Pick a lesson');
});

test('选()：缺英文回落中文（漏译至少不留白）', async () => {
  const { 选, 设语言 } = await 装模块(假存储());
  设语言('en');
  assert.equal(选({ cn: '还没翻' }), '还没翻');
  assert.equal(选({ cn: '也没翻', en: null }), '也没翻');
  assert.equal(选({ cn: '空串是有意为之', en: '' }), '');
});

test('选()：不是同构条目的原样奉还', async () => {
  const { 选, 设语言 } = await 装模块(假存储());
  设语言('en');
  assert.equal(选('两语通用的 🇬🇧'), '两语通用的 🇬🇧');
  assert.equal(选(7), 7);
  assert.equal(选(null), null);
  assert.equal(选(undefined), undefined);
  const 别的对象 = { 标题: '不归我管' };
  assert.equal(选(别的对象), 别的对象);
});

test('选()：只有英文没中文也照给', async () => {
  const { 选 } = await 装模块(假存储()); // 中文模式
  assert.equal(选({ en: 'EAST' }), 'EAST');
});
