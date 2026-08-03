import test from 'node:test';
import assert from 'node:assert/strict';

import { foldResult } from '../src/domain/net.js';
import { 失败视角, 压进极角范围, 面法线 } from '../src/render/failureCue.js';
import { allHexominoes } from './hexominoes.js';

/**
 * 「重叠和漏洞两个都要指出来」这条，光把两处染上色是不够的 ——
 * 孩子转不到看得见的角度，等于没指。这里验的就是那个角度真的存在、也真的选对了。
 *
 * 镜头的极角被 scene.js 卡在 [0.12, π/2 − 0.28] 之间：转不到正下方，
 * 所以底面上的毛病孩子永远看不见。下面第一条测的就是底面上不会有毛病。
 */

const 极角最小 = 0.12;
const 极角最大 = Math.PI / 2 - 0.28;

const 穿不上的 = allHexominoes().filter((cells) => !foldResult(cells).valid);

/** 这个方向看过去，某个面看得见吗（正对着，或者透过一个正对着的漏洞看进去） */
function 看得见(方向, 面, 漏洞面) {
  const n = 面法线(面);
  if (方向.dot(n) > 0.1) return true;
  return 漏洞面.some((洞) => 面法线(洞).dot(n) < -0.9 && 方向.dot(面法线(洞)) > 0.3);
}

test('穿不上的 24 种，毛病从来不落在底面上 —— 落在底面孩子就永远看不见了', () => {
  assert.equal(穿不上的.length, 24);
  for (const cells of 穿不上的) {
    const { faces, overlaps, holes } = foldResult(cells);
    // 根格子折起来就是底面，所以底面永远有人盖，不可能是漏洞
    assert.ok(!holes.includes('-y'), `漏洞落到底面了：${JSON.stringify(cells)}`);
    for (const 一组 of overlaps) {
      assert.notEqual(faces[一组[0]], '-y', `重叠落到底面了：${JSON.stringify(cells)}`);
    }
  }
});

test('穿不上的 24 种，每一种都挑得出同时看得见红和黄的角度', () => {
  for (const cells of 穿不上的) {
    const { faces, overlaps, holes } = foldResult(cells);
    const 重叠面 = overlaps.map((一组) => faces[一组[0]]);
    const 方向 = 失败视角(重叠面, holes);

    assert.ok(
      重叠面.some((面) => 看得见(方向, 面, holes)),
      `看不见红的：${JSON.stringify(cells)} 重叠在 ${重叠面} 方向 ${方向.toArray()}`,
    );
    assert.ok(
      holes.some((面) => 看得见(方向, 面, holes)),
      `看不见黄的：${JSON.stringify(cells)} 漏洞在 ${holes} 方向 ${方向.toArray()}`,
    );
  }
});

test('挑出来的角度镜头真的转得过去（在极角范围里）', () => {
  for (const cells of 穿不上的) {
    const { faces, overlaps, holes } = foldResult(cells);
    const 方向 = 失败视角(overlaps.map((一组) => faces[一组[0]]), holes);
    assert.ok(Math.abs(方向.length() - 1) < 1e-9, '得是个单位向量');
    const 极角 = Math.acos(方向.y);
    assert.ok(
      极角 >= 极角最小 - 1e-9 && 极角 <= 极角最大 + 1e-9,
      `极角 ${极角} 超出镜头能转到的范围：${JSON.stringify(cells)}`,
    );
  }
});

test('红和黄正好落在一对对面上时，从漏洞那边看进去 —— 洞是真窟窿，看得见对面的红', () => {
  // 这种形状（一横排三格 + 错开的一横排三格）重叠在 +z、漏洞在 -z，正好是一对对面
  const 方向 = 失败视角(['+z'], ['-z']);
  assert.ok(方向.z < -0.5, `应该站到漏洞那一侧去看，实际 ${方向.toArray()}`);
});

test('压进极角范围：太低的压回来，本来就合规的原样不动', () => {
  const 贴地 = 压进极角范围(面法线('+z'), 极角最小, 极角最大);
  assert.ok(Math.acos(贴地.y) <= 极角最大 + 1e-9);
  assert.ok(贴地.z > 0.9, '方位角不能被改掉');

  const 正上方 = 压进极角范围(面法线('+y'), 极角最小, 极角最大);
  assert.ok(Math.acos(正上方.y) >= 极角最小 - 1e-9);

  const 斜的 = 面法线('+y').add(面法线('+x')).normalize();
  const 没动 = 压进极角范围(斜的, 极角最小, 极角最大);
  assert.ok(没动.distanceTo(斜的) < 1e-9, '本来就在范围里就不该动它');
});
