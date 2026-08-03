import test from 'node:test';
import assert from 'node:assert/strict';

import { 算挪了的位移 } from '../src/render/指针容差.js';

/*
  折纸手和点面共用的那个门槛。要盯的不是具体的数，是这条不对称：
  手指那一档必须明显比鼠标宽 —— 窄了的话孩子每一次「点这片」都被判成「转镜头」，
  屏幕上什么都不发生，而他不认字，问不出为什么。
*/

test('手指的门槛比鼠标宽出一截', () => {
  assert.ok(算挪了的位移('touch') > 算挪了的位移('mouse') * 2);
});

test('手写笔跟手指同一档：拿笔的手一样会抖', () => {
  assert.equal(算挪了的位移('pen'), 算挪了的位移('touch'));
});

test('认不出来的指针按鼠标算 —— 宁可严一点，别把拖拽误判成点', () => {
  for (const 认不出 of [undefined, '', 'weird']) {
    assert.equal(算挪了的位移(认不出), 算挪了的位移('mouse'));
  }
});

test('两档都是几个像素的量级，不许有人手滑写成 0 或者半个屏幕', () => {
  for (const 指 of ['mouse', 'touch']) {
    const 值 = 算挪了的位移(指);
    assert.ok(值 >= 4 && 值 <= 40, `${指} 那一档是 ${值}，不像个手抖的量`);
  }
});
