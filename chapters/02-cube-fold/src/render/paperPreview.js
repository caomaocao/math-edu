import * as THREE from '/shared/vendor/three/three.module.js';

import { CELL_SIZE } from '../domain/net.js';

/**
 * 还没画成一张衣服时，把孩子涂的格子原样摊在舞台上。
 *
 * 少于 6 格、或者格子没有边边相连，都建不出折痕树（也不该折）——
 * 但舞台不能因此空着：孩子每点一格，就要立刻在三维里看见同一个颜色同一个水果，
 * 「格子和面是同一张纸」这句话才立得住。
 *
 * 摆放和 FoldedNet 摊平时用的是同一个居中算法，所以第 6 格一点上、
 * 换成真正的折叠引擎的那一瞬间，画面不会跳。
 */
export class PaperPreview {
  /**
   * @param {Array<{row:number, col:number}>} cells 涂了的格子，可以不相连
   * @param {{makeCellMaterial: (index:number)=>THREE.Material}} options
   */
  constructor(cells, { makeCellMaterial }) {
    this.cells = cells;
    this.fold = 0;

    this.object3D = new THREE.Group();
    this.object3D.name = '格子纸预览';

    this._geometry = new THREE.PlaneGeometry(CELL_SIZE, CELL_SIZE);
    this._materials = [];
    this._bbox = new THREE.Box3();
    this.cellMeshes = [];

    const 中心列 = 居中(cells.map((c) => c.col));
    const 中心行 = 居中(cells.map((c) => c.row));

    cells.forEach((cell, index) => {
      const material = makeCellMaterial(index);
      this._materials.push(material);
      const mesh = new THREE.Mesh(this._geometry, material);
      mesh.rotation.x = -Math.PI / 2; // PlaneGeometry 立在 XY 平面上，转下来平躺在地面
      mesh.position.set((cell.col - 中心列) * CELL_SIZE, 0, (cell.row - 中心行) * CELL_SIZE);
      mesh.userData.cellIndex = index;
      this.object3D.add(mesh);
      this.cellMeshes.push(mesh);
    });
  }

  /** 还不是一张衣服，折不动 —— 滑块这时候本来也是灰的 */
  setFold() {
    this.fold = 0;
  }

  boundingBox() {
    return this._bbox.setFromObject(this.object3D);
  }

  dispose() {
    this.object3D.removeFromParent();
    this._geometry.dispose();
    // 只收自己造的材质：外面传进来的那份是共用的，收了别人下次就没得用了
    for (const material of this._materials) {
      if (!material.userData?.自己造的) continue;
      material.map?.dispose();
      material.dispose();
    }
  }
}

function 居中(值们) {
  if (值们.length === 0) return 0;
  return (Math.min(...值们) + Math.max(...值们)) / 2;
}
