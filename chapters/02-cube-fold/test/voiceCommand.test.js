import test from 'node:test';
import assert from 'node:assert/strict';

import { 听口令, 口令词表 } from '../src/domain/voiceCommand.js';

/**
 * 沙盒里孩子能喊的两句话：「穿衣服！」整体折拢，「脱衣服！」摊平。
 *
 * 五岁孩子不会按提示词说话，他会说「给它穿上」「快点合起来」「脱掉脱掉」。
 * 听不懂就当没听见（返回 null）交给上层重试 —— 绝不能猜，猜错了衣服自己动起来，
 * 孩子会以为这东西坏了。
 */

test('穿：各种说法都听得懂', () => {
  for (const 说的 of [
    '穿衣服',
    '穿上',
    '给它穿上',
    '穿起来',
    '合上',
    '合起来',
    '变身',
    '穿衣服！',
    '快穿衣服呀',
  ]) {
    assert.equal(听口令(说的), '穿衣服', `「${说的}」该听成穿衣服`);
  }
});

test('脱：各种说法都听得懂', () => {
  for (const 说的 of [
    '脱衣服',
    '脱掉',
    '脱下来',
    '打开',
    '摊平',
    '摊开',
    '脱衣服吧',
    '把衣服脱了',
  ]) {
    assert.equal(听口令(说的), '脱衣服', `「${说的}」该听成脱衣服`);
  }
});

test('听不懂就说听不懂，绝不瞎猜', () => {
  for (const 说的 of ['', null, undefined, '妈妈', '我要吃饭', '啊啊啊', '这个正方体好大']) {
    assert.equal(听口令(说的), null, `「${说的}」不该被猜成口令`);
  }
});

test('孩子自我纠正：最后说的那句算数', () => {
  assert.equal(听口令('脱衣服……不对，穿衣服！'), '穿衣服');
  assert.equal(听口令('穿上，啊不，脱掉'), '脱衣服');
});

test('长词优先：「穿衣服」不会被「穿」抢先吃掉，两条口令不打架', () => {
  assert.equal(听口令('穿衣服'), '穿衣服');
  assert.equal(听口令('脱衣服'), '脱衣服');
  // 「脱衣服」里也有「衣服」两个字，不能因此被认成穿
  assert.notEqual(听口令('脱衣服'), '穿衣服');
});

test('口令词表是给共享判对用的形状', () => {
  assert.deepEqual(Object.keys(口令词表).sort(), ['穿衣服', '脱衣服']);
  for (const 说法们 of Object.values(口令词表)) {
    assert.ok(Array.isArray(说法们) && 说法们.length > 0);
  }
});

// ---------------------------------------------------------------------------
// 英文课
//
// 规范名永远是中文（判对.js 那条规矩）：英文只是词条里多出来的说法。
// 接受集合恒为两语并集 —— 英文课上喊「穿衣服」照样灵，中文课上喊 "close it" 也灵。
// ---------------------------------------------------------------------------

test('穿：英文的各种说法都听得懂', () => {
  for (const 说的 of [
    'Get dressed!',
    'get dressed',
    'Close it!',
    'close',
    'Fold it up!',
    'fold up',
    'Wear it!',
    'Put it on!',
    'Um, close it please',
    'I think you should fold it up',
  ]) {
    assert.equal(听口令(说的), '穿衣服', `「${说的}」该听成穿衣服`);
  }
});

test('脱：英文的各种说法都听得懂', () => {
  for (const 说的 of [
    'Take it off!',
    'take off',
    'Open it!',
    'open',
    'Unfold it!',
    'unfold',
    'Lay it flat!',
    'flatten it',
    'Undress!',
  ]) {
    assert.equal(听口令(说的), '脱衣服', `「${说的}」该听成脱衣服`);
  }
});

test('英文长词优先：unfold 不会被 fold 抢先吃掉', () => {
  assert.equal(听口令('unfold it'), '脱衣服');
  assert.equal(听口令('undress'), '脱衣服');
  assert.equal(听口令('take it off'), '脱衣服');
});

test('英文的自我纠正：最后说的那句算数', () => {
  assert.equal(听口令('open it, no wait, close it'), '穿衣服');
  assert.equal(听口令('close it, um, actually take it off'), '脱衣服');
});

test('两语并集：中文课上说英文、英文课上说中文，都听得懂', () => {
  // 判定跟现在上的是哪门课无关 —— 判的是他要方方干什么，不是他用哪种语言说的
  assert.equal(听口令('穿衣服'), '穿衣服');
  assert.equal(听口令('get dressed'), '穿衣服');
  assert.equal(听口令('脱衣服'), '脱衣服');
  assert.equal(听口令('take it off'), '脱衣服');
});

test('英文里听不懂的照样说听不懂', () => {
  for (const 说的 of ['hello', 'I want a biscuit', 'this cube is big', 'mummy']) {
    assert.equal(听口令(说的), null, `「${说的}」不该被猜成口令`);
  }
});
