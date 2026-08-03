import test from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from '/shared/vendor/three/three.module.js';
import { 拟合镜头 } from '../src/render/scene.js';
import { FoldedNet } from '../src/render/foldedNet.js';

/**
 * 镜头拟合的纯数学部分。
 *
 * 最要紧的一条：孩子来回蹭滑块时这个函数会被叫上千次，
 * 每次都必须把镜头摆回同一个方向。摆偏一点点，蹭一会儿画面就自己转跑了。
 */

const NET_141 = [
  { row: 0, col: 1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
  { row: 1, col: 2 },
  { row: 1, col: 3 },
  { row: 2, col: 2 },
];

const 视野 = 40;
const 宽高比 = 16 / 9;

const 盒子 = (最小, 最大) =>
  new THREE.Box3(new THREE.Vector3(...最小), new THREE.Vector3(...最大));

test('拟合出来的镜头，方向就是原来那个方向', () => {
  const 原位置 = new THREE.Vector3(0, 4.6, 6.4);
  const 原目标 = new THREE.Vector3(0, 0, 0);
  const 原方向 = 原位置.clone().sub(原目标).normalize();

  const { 看向 } = 拟合镜头(盒子([-2, 0, -1.5], [2, 0, 1.5]), 原位置, 原目标, 视野, 宽高比);
  assert.ok(看向.distanceTo(原方向) < 1e-12);
});

test('同一个盒子连叫两次，镜头一动不动（幂等）', () => {
  const 位置 = new THREE.Vector3(0, 4.6, 6.4);
  const 目标 = new THREE.Vector3();
  const b = 盒子([-2, 0, -1.5], [2, 1, 1.5]);

  const 一 = 拟合镜头(b, 位置, 目标, 视野, 宽高比);
  const 位置1 = 一.目标.clone().addScaledVector(一.看向, 一.距离);

  const 二 = 拟合镜头(b, 位置1, 一.目标, 视野, 宽高比);
  const 位置2 = 二.目标.clone().addScaledVector(二.看向, 二.距离);

  assert.ok(位置1.distanceTo(位置2) < 1e-12, `${位置1.toArray()} vs ${位置2.toArray()}`);
  assert.ok(一.目标.distanceTo(二.目标) < 1e-12);
});

test('来回蹭滑块几十趟，镜头角度一点都不偏', () => {
  const 衣服 = new FoldedNet(NET_141, {
    makeCellMaterial: () => new THREE.MeshBasicMaterial(),
  });

  let 位置 = new THREE.Vector3(0, 4.6, 6.4);
  let 目标 = new THREE.Vector3();
  const 起始方向 = 位置.clone().sub(目标).normalize();

  const 蹭一下 = (折叠度) => {
    衣服.setFold(折叠度);
    衣服.object3D.updateMatrixWorld(true);
    const { 目标: 新目标, 看向, 距离 } = 拟合镜头(
      衣服.boundingBox(),
      位置,
      目标,
      视野,
      宽高比,
    );
    目标 = 新目标;
    位置 = 新目标.clone().addScaledVector(看向, 距离);
  };

  for (let 趟 = 0; 趟 < 20; 趟++) {
    for (let i = 0; i <= 100; i++) 蹭一下(i / 100);
    for (let i = 100; i >= 0; i--) 蹭一下(i / 100);
  }

  const 结束方向 = 位置.clone().sub(目标).normalize();
  assert.ok(
    结束方向.distanceTo(起始方向) < 1e-9,
    `蹭了 20 趟之后镜头方向偏了：${起始方向.toArray()} → ${结束方向.toArray()}`,
  );
});

test('镜头正好压在目标点上也能自己爬出来，不会卡死在原地', () => {
  const 重合 = new THREE.Vector3(0, 0.5, 0);
  const { 看向, 距离 } = 拟合镜头(盒子([-0.5, 0, -0.5], [0.5, 1, 0.5]), 重合, 重合, 视野, 宽高比);
  assert.ok(Math.abs(看向.length() - 1) < 1e-12, '兜底方向必须是个单位向量');
  assert.ok(距离 > 0, '距离必须是正的，否则镜头永远爬不出来');
});

test('摊平的薄纸（盒子高度为 0）也框得住', () => {
  const 位置 = new THREE.Vector3(0, 4.6, 6.4);
  const 目标 = new THREE.Vector3();
  const { 距离 } = 拟合镜头(盒子([-2, 0, -1.5], [2, 0, 1.5]), 位置, 目标, 视野, 宽高比);
  assert.ok(Number.isFinite(距离) && 距离 > 0);
});

test('东西越小镜头站得越近：正方体比摊平的衣服近', () => {
  const 位置 = new THREE.Vector3(0, 4.6, 6.4);
  const 目标 = new THREE.Vector3();
  const 摊平 = 拟合镜头(盒子([-2, 0, -1.5], [2, 0, 1.5]), 位置, 目标, 视野, 宽高比).距离;
  const 正方体 = 拟合镜头(盒子([-0.5, 0, -0.5], [0.5, 1, 0.5]), 位置, 目标, 视野, 宽高比).距离;
  assert.ok(正方体 < 摊平, `正方体 ${正方体} 应该比摊平 ${摊平} 近`);
});
