import test from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from '/shared/vendor/three/three.module.js';
import { FoldedNet } from '../src/render/foldedNet.js';
import { buildHingeTree, cellCenters } from '../src/domain/net.js';

/**
 * 折叠引擎（three.js 那一层）和纯数学模型必须算出同一个结果。
 * 材质在这里换成不碰 canvas 的假货，好让测试在 node 里跑。
 */

const NET_141 = [
  { row: 0, col: 1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
  { row: 1, col: 2 },
  { row: 1, col: 3 },
  { row: 2, col: 2 },
];

const BLOCK_2x3 = [
  { row: 0, col: 0 },
  { row: 0, col: 1 },
  { row: 0, col: 2 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
  { row: 1, col: 2 },
];

const L_SHAPE = [
  { row: 0, col: 0 },
  { row: 1, col: 0 },
  { row: 2, col: 0 },
  { row: 3, col: 0 },
  { row: 3, col: 1 },
  { row: 3, col: 2 },
];

const makeFoldedNet = (cells) =>
  new FoldedNet(cells, { makeCellMaterial: () => new THREE.MeshBasicMaterial() });

test('变换是嵌套的：折痕组一转，它下面的子孙格子跟着走', () => {
  const folded = makeFoldedNet(NET_141);
  const tree = folded.tree;

  // 每个非根格子组，必须真的挂在父格子组的折痕组底下
  for (const node of tree.nodes) {
    if (node.parent === null) continue;
    const hingeGroup = folded.cellGroups[node.index].parent;
    assert.equal(hingeGroup, folded.hingeGroups[node.index]);
    assert.equal(hingeGroup.parent, folded.cellGroups[node.parent]);
  }

  // 有格子挂在深处，不是所有格子都直接挂在根上 —— 否则就不是嵌套了
  const depth = (i) => (tree.nodes[i].parent === null ? 0 : depth(tree.nodes[i].parent) + 1);
  assert.ok(Math.max(...tree.nodes.map((n) => depth(n.index))) >= 2);
});

test('three.js 场景树算出来的格子位置，跟纯数学模型一致', () => {
  for (const cells of [NET_141, BLOCK_2x3, L_SHAPE]) {
    const folded = makeFoldedNet(cells);
    const tree = buildHingeTree(cells);

    for (const fold of [0, 0.2, 0.4, 0.55, 0.8, 1]) {
      folded.setFold(fold);
      folded.object3D.updateMatrixWorld(true);
      const expected = cellCenters(tree, fold);

      cells.forEach((_, i) => {
        const actual = folded.cellGroups[i].getWorldPosition(new THREE.Vector3());
        // 纯模型把根格子放在原点，场景里整张衣服还额外挪了一下让它居中
        actual.sub(folded.object3D.position);
        const [x, y, z] = expected[i];
        assert.ok(
          actual.distanceTo(new THREE.Vector3(x, y, z)) < 1e-9,
          `折叠度 ${fold} 时格子 ${i} 对不上：${actual.toArray()} vs ${expected[i]}`,
        );
      });
    }
  }
});

test('折叠度到 1 时六个面严丝合缝：24 个角点正好落在正方体的 8 个顶点上', () => {
  const folded = makeFoldedNet(NET_141);
  folded.setFold(1);
  folded.object3D.updateMatrixWorld(true);

  const localCorners = [
    new THREE.Vector3(-0.5, -0.5, 0),
    new THREE.Vector3(0.5, -0.5, 0),
    new THREE.Vector3(0.5, 0.5, 0),
    new THREE.Vector3(-0.5, 0.5, 0),
  ];

  const corners = new Set();
  for (const mesh of folded.cellMeshes) {
    for (const local of localCorners) {
      const p = local.clone().applyMatrix4(mesh.matrixWorld);
      [p.x, p.y, p.z].forEach((v) => {
        assert.ok(Math.abs(v - Math.round(v * 2) / 2) < 1e-9, `角点不在格点上：${v}`);
      });
      assert.ok(Math.abs(Math.abs(p.x) - 0.5) < 1e-9, `x 应该是 ±0.5，实际 ${p.x}`);
      assert.ok(Math.abs(Math.abs(p.z) - 0.5) < 1e-9, `z 应该是 ±0.5，实际 ${p.z}`);
      assert.ok(Math.abs(p.y) < 1e-9 || Math.abs(p.y - 1) < 1e-9, `y 应该是 0 或 1，实际 ${p.y}`);
      corners.add([p.x, p.y, p.z].map((v) => Math.round(v * 2) / 2).join(','));
    }
  }
  // 6 个面 × 4 个角 = 24 个角点，但正方体只有 8 个顶点 —— 说明面和面是拼死的
  assert.equal(corners.size, 8);
});

test('折叠度到 1 时没有两个面重合（141 型能合上，六个面朝向各不相同）', () => {
  const folded = makeFoldedNet(NET_141);
  folded.setFold(1);
  folded.object3D.updateMatrixWorld(true);

  const normals = folded.cellMeshes.map((mesh) => {
    const n = new THREE.Vector3(0, 0, 1).transformDirection(mesh.matrixWorld);
    return [n.x, n.y, n.z].map((v) => Math.round(v)).join(',');
  });
  assert.equal(new Set(normals).size, 6);
});

test('折叠度可以来回蹭：0 → 0.4 → 1 → 0.4 → 0 回到同一个状态', () => {
  const folded = makeFoldedNet(NET_141);
  const snapshot = () => {
    folded.object3D.updateMatrixWorld(true);
    return folded.cellGroups.map((g) => g.getWorldPosition(new THREE.Vector3()).toArray());
  };

  folded.setFold(0);
  const flat = snapshot();
  folded.setFold(0.4);
  const half = snapshot();

  folded.setFold(1);
  folded.setFold(0.4);
  assert.deepEqual(snapshot(), half, '蹭回 0.4 应该跟第一次到 0.4 一模一样');
  folded.setFold(0);
  assert.deepEqual(snapshot(), flat);
});

test('折叠度超出 0–1 会被夹住', () => {
  const folded = makeFoldedNet(NET_141);
  folded.setFold(-3);
  assert.equal(folded.fold, 0);
  folded.setFold(9);
  assert.equal(folded.fold, 1);
});

test('引擎吃任意 6 格图形，不认死那张 141', () => {
  for (const cells of [NET_141, BLOCK_2x3, L_SHAPE]) {
    const folded = makeFoldedNet(cells);
    assert.equal(folded.cellGroups.filter(Boolean).length, 6);

    // 穿不上的形状也照折不误，只是折完会有两个格子撞在同一个面上
    folded.setFold(1);
    folded.object3D.updateMatrixWorld(true);

    const 面心 = folded.cellGroups.map((g) => {
      const p = g.getWorldPosition(new THREE.Vector3()).sub(folded.object3D.position);
      return [p.x, p.y - 0.5, p.z].map((v) => Math.round(v * 2) / 2).join(',');
    });
    // 不管合不合得上，六个格子都必须落在正方体的面心上（只是可能重叠）
    面心.forEach((面, i) => {
      const 分量 = 面.split(',').map(Number);
      assert.equal(分量.filter((v) => v !== 0).length, 1, `格子 ${i} 落点不对：${面}`);
      assert.equal(Math.abs(分量.find((v) => v !== 0)), 0.5, `格子 ${i} 落点不对：${面}`);
    });
    const 不同的面 = new Set(面心).size;
    assert.equal(不同的面 === 6, cells === NET_141, `${不同的面} 个不同的面`);
  }
});

test('摊平居中的位移只是整体平移，不影响格子之间的相对关系', () => {
  const folded = makeFoldedNet(L_SHAPE);
  folded.setFold(0);
  folded.object3D.updateMatrixWorld(true);

  // 摊平时整张衣服的外接盒应该正好以原点为中心
  const 盒 = folded.boundingBox();
  const 中心 = 盒.getCenter(new THREE.Vector3());
  assert.ok(中心.length() < 1e-9, `摊平时没居中：${中心.toArray()}`);

  // 而且每个格子仍然停在它自己的网格位置上（相对关系没被平移搞乱）
  const 根 = L_SHAPE[folded.tree.root];
  L_SHAPE.forEach((cell, i) => {
    const p = folded.cellGroups[i].getWorldPosition(new THREE.Vector3()).sub(folded.object3D.position);
    assert.ok(Math.abs(p.x - (cell.col - 根.col)) < 1e-9, `格子 ${i} 的 x`);
    assert.ok(Math.abs(p.z - (cell.row - 根.row)) < 1e-9, `格子 ${i} 的 z`);
    assert.ok(Math.abs(p.y) < 1e-9, `格子 ${i} 应该贴着地`);
  });
});
