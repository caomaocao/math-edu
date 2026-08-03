import * as THREE from '/shared/vendor/three/three.module.js';

import { CELL_SIZE, buildHingeTree, 选根格子 } from '../domain/net.js';
import { cellStyle } from '../domain/palette.js';
import { makeCellTexture } from './cellTexture.js';

/**
 * 折叠引擎 —— 把一张衣服（任意 6 个边边相连的格子，其实任意连通图形都行）
 * 变成一堆嵌套的 Object3D，然后用折叠度驱动它。
 *
 * 按 ADR-0001：折痕树上每个非根格子挂在父格子下面，绕两者共用的折痕转
 * 90° × 折叠度。这里的父子关系就是 three.js 的 Object3D 父子关系 ——
 * 父格子转了，子孙跟着走，跟真实折纸一模一样。
 *
 * 场景树长这样：
 *   衣服组 netGroup
 *     └ 格子组 cellGroup(根)
 *         ├ mesh（一张纸，正反两面都印着颜色和水果）
 *         └ 折痕组 hingeGroup ← 只有它转
 *             └ 格子组 cellGroup(子)
 *                 ├ mesh
 *                 └ 折痕组 …（继续嵌套）
 *
 * 折叠度是 0→1 的连续值，不是动画：setFold(0.4) 就静止在 0.4。
 */

const RIGHT_ANGLE = Math.PI / 2;

/** 默认的格子材质：颜色 + 水果，正反两面都有（拆开时看得见是同一张纸） */
function defaultCellMaterial(index) {
  const material = new THREE.MeshBasicMaterial({
    map: makeCellTexture(cellStyle(index)),
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  material.userData.自己造的 = true; // dispose() 只收自己造的，见下面
  return material;
}

export class FoldedNet {
  /**
   * @param {Array<{row:number, col:number}>} cells 一张衣服的格子（不硬编码形状，来什么折什么）
   * @param {{rootIndex?: number, makeCellMaterial?: (index:number)=>THREE.Material}} options
   *   rootIndex 不给就自己挑一个居中的格子当根，折起来左右均衡
   */
  constructor(cells, { rootIndex = 选根格子(cells), makeCellMaterial = defaultCellMaterial } = {}) {
    this.cells = cells;
    this.tree = buildHingeTree(cells, rootIndex);
    this.fold = 0;

    this.object3D = new THREE.Group();
    this.object3D.name = '衣服';

    this.cellGroups = new Array(cells.length).fill(null);
    this.hingeGroups = new Array(cells.length).fill(null);
    this.cellMeshes = new Array(cells.length).fill(null);
    this._materials = [];
    this._geometry = new THREE.PlaneGeometry(CELL_SIZE, CELL_SIZE);
    this._bbox = new THREE.Box3();

    for (const index of this.tree.order) {
      const node = this.tree.nodes[index];
      const cellGroup = new THREE.Group();
      cellGroup.name = `格子${index}`;

      const material = makeCellMaterial(index);
      this._materials.push(material);
      const mesh = new THREE.Mesh(this._geometry, material);
      // PlaneGeometry 默认立在 XY 平面上，转 -90° 让它平躺在地面，正面朝上
      mesh.rotation.x = -RIGHT_ANGLE;
      mesh.userData.cellIndex = index;
      cellGroup.add(mesh);

      this.cellGroups[index] = cellGroup;
      this.cellMeshes[index] = mesh;

      if (node.parent === null) {
        this.object3D.add(cellGroup);
        continue;
      }

      // 折痕组坐落在父格子和子格子共用的那条边上；转的是它，不是格子本身
      const hingeGroup = new THREE.Group();
      hingeGroup.name = `折痕${node.parent}-${index}`;
      hingeGroup.position.set(...node.hinge.offset);
      this.cellGroups[node.parent].add(hingeGroup);

      // 从折痕再走半格，就是子格子的中心
      cellGroup.position.set(...node.hinge.offset);
      hingeGroup.add(cellGroup);

      this.hingeGroups[index] = hingeGroup;
    }

    this._flatOffset = this._computeFlatOffset();
    this.setFold(0);
  }

  /**
   * 摊平时把整张衣服挪到画面中间；折起来时正方体正好坐在原点上。
   * 这只是整体平移，不影响格子之间的嵌套关系。
   */
  _computeFlatOffset() {
    const root = this.cells[this.tree.root];
    const xs = this.cells.map((c) => (c.col - root.col) * CELL_SIZE);
    const zs = this.cells.map((c) => (c.row - root.row) * CELL_SIZE);
    return new THREE.Vector3(
      -(Math.min(...xs) + Math.max(...xs)) / 2,
      0,
      -(Math.min(...zs) + Math.max(...zs)) / 2,
    );
  }

  /**
   * 设置折叠度。0 = 完全摊平，1 = 完全折起，中间任意值都是合法的静止状态。
   * 这里只写属性，不启动任何动画 —— 滑块停在哪就停在哪。
   */
  setFold(fold) {
    this.fold = Math.min(1, Math.max(0, fold));

    for (const index of this.tree.order) {
      const node = this.tree.nodes[index];
      if (node.parent === null) continue;
      const { axis, angleSign } = node.hinge;
      this.hingeGroups[index].rotation[axis] = angleSign * RIGHT_ANGLE * this.fold;
    }

    // 摊平居中 → 正方体居中，跟着折叠度一起连续变化
    this.object3D.position.copy(this._flatOffset).multiplyScalar(1 - this.fold);
  }

  /**
   * 每条折痕各折各的 —— 孩子点一个格子，就只有那一片弹起来。
   *
   * `setFold` 是「六个面一起收拢」，滑块和自动试穿用它；这个是逐面点击折用的。
   * 折痕树的父子关系照旧管着：折父格子，子孙跟着一起走，跟真纸一样。
   *
   * @param {(格子下标: number) => number} 取值 这条折痕现在折到哪（0–1，允许弹性略微过 1）
   * @param {number} 整体 平均折叠度，只用来把衣服从「摊平居中」挪到「正方体居中」
   */
  设各折痕(取值, 整体) {
    this.fold = Math.min(1, Math.max(0, 整体));

    for (const index of this.tree.order) {
      const node = this.tree.nodes[index];
      if (node.parent === null) continue;
      const { axis, angleSign } = node.hinge;
      this.hingeGroups[index].rotation[axis] = angleSign * RIGHT_ANGLE * (取值(index) || 0);
    }

    this.object3D.position.copy(this._flatOffset).multiplyScalar(1 - this.fold);
  }

  /**
   * 当前折叠度下衣服占的那块空间 —— 镜头靠它决定站多远、看哪儿。
   * 摊平时是一大张薄纸，合上时只有一个正方体那么小。
   */
  boundingBox() {
    return this._bbox.setFromObject(this.object3D);
  }

  /**
   * 孩子每改一格，整张衣服就重建一次，所以这里必须收干净。
   * 但只收自己造的材质 —— 外面传进来的那份是几张衣服共用的（02 票：六个颜色槽位
   * 各有一份材质，重建时反复用），收了下次就没得用了。
   */
  dispose() {
    this.object3D.removeFromParent();
    this._geometry.dispose();
    for (const material of this._materials) {
      if (!material.userData?.自己造的) continue;
      material.map?.dispose();
      material.dispose();
    }
  }
}
