import test from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from '/shared/vendor/three/three.module.js';
import { FoldedNet } from '../src/render/foldedNet.js';
import { 创建对面高亮 } from '../src/render/oppositeGlow.js';
import { foldResult, 对面格子对 } from '../src/domain/net.js';

/**
 * 点面看对面的三维那一半。
 *
 * 最要紧的两条：
 * 1. 被点的那一对亮、其余四个面淡到看得穿 —— 看不穿就看不见背面那个在亮，
 *    这一票就白做了；
 * 2. 材质是几张衣服**共用**的（main.js 的材质池），半透明只是借用。
 *    清除时还不干净，孩子下一次画的衣服就会莫名其妙是半透明的。
 */

const NET_141 = [
  { row: 0, col: 1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
  { row: 1, col: 2 },
  { row: 1, col: 3 },
  { row: 2, col: 2 },
];

/** 贴图要画 canvas，node 里没有，换成一张假的 */
const 假贴图 = () => new THREE.Texture();

const 做一张 = (cells = NET_141) =>
  new FoldedNet(cells, { makeCellMaterial: () => new THREE.MeshBasicMaterial() });

const 记下材质 = (衣服) =>
  衣服.cellMeshes.map((mesh) => ({
    transparent: mesh.material.transparent,
    opacity: mesh.material.opacity,
    depthWrite: mesh.material.depthWrite,
  }));

const 发光膜数 = (衣服) =>
  衣服.cellMeshes.reduce(
    (n, mesh) => n + mesh.children.filter((c) => c.name === '发光膜').length,
    0,
  );

test('亮一对对面：这两片发光，其余四片淡到看得穿', () => {
  const 衣服 = 做一张();
  const 高亮 = 创建对面高亮(衣服, { 做贴图: 假贴图 });
  const [一对] = 对面格子对(foldResult(NET_141, 衣服.tree.root));

  高亮.显示(一对.格子, 一对.序);

  assert.equal(发光膜数(衣服), 2, '发光的必须恰好是两片：被点的那个和它的对面');
  衣服.cellMeshes.forEach((mesh, 下标) => {
    const 亮 = 一对.格子.includes(下标);
    assert.equal(mesh.material.transparent, true);
    assert.ok(
      亮 ? mesh.material.opacity > 0.6 : mesh.material.opacity < 0.3,
      `格子 ${下标} 的不透明度不对：${mesh.material.opacity}`,
    );
    assert.equal(mesh.material.depthWrite, false, '写了深度就挡住背面那片光了');
  });
});

test('换一对：上一对的光收干净，不会两对一起亮着', () => {
  const 衣服 = 做一张();
  const 高亮 = 创建对面高亮(衣服, { 做贴图: 假贴图 });
  const 三对 = 对面格子对(foldResult(NET_141, 衣服.tree.root));

  高亮.显示(三对[0].格子, 三对[0].序);
  高亮.显示(三对[1].格子, 三对[1].序);

  assert.equal(发光膜数(衣服), 2);
  assert.deepEqual(高亮.对子.格子对, 三对[1].格子);
  for (const 下标 of 三对[0].格子) {
    assert.equal(衣服.cellMeshes[下标].children.length, 0, '上一对的膜还挂在那儿');
  }
});

test('清除以后材质一字不差地还回去 —— 材质是几张衣服共用的', () => {
  const 衣服 = 做一张();
  const 原样 = 记下材质(衣服);
  const 高亮 = 创建对面高亮(衣服, { 做贴图: 假贴图 });
  const 三对 = 对面格子对(foldResult(NET_141, 衣服.tree.root));

  高亮.显示(三对[2].格子, 三对[2].序);
  assert.equal(高亮.在显示, true);

  高亮.清除();
  assert.equal(高亮.在显示, false);
  assert.equal(发光膜数(衣服), 0);
  assert.deepEqual(记下材质(衣服), 原样);

  // dispose 走的是同一条路，重复叫也不该出事
  高亮.显示(三对[0].格子, 三对[0].序);
  高亮.dispose();
  高亮.dispose();
  assert.deepEqual(记下材质(衣服), 原样);
  assert.equal(发光膜数(衣服), 0);
});

test('发光会一呼一吸，但始终看得见', () => {
  const 衣服 = 做一张();
  const 高亮 = 创建对面高亮(衣服, { 做贴图: 假贴图 });
  const [一对] = 对面格子对(foldResult(NET_141, 衣服.tree.root));
  高亮.显示(一对.格子, 一对.序);

  const 膜 = 衣服.cellMeshes.flatMap((m) => m.children.filter((c) => c.name === '发光膜'));
  const 取样 = [];
  for (let 秒 = 0; 秒 < 2; 秒 += 0.05) {
    高亮.更新(秒);
    取样.push(膜[0].material.opacity);
    for (const 一片 of 膜) assert.ok(一片.material.opacity > 0.4, '呼吸不能吸到看不见');
  }
  assert.ok(Math.max(...取样) - Math.min(...取样) > 0.2, '得看得出在呼吸');
});
