// Galería de objetos: una pieza cada vez sobre peana, con cámara orbital y ficha.
import * as THREE from 'three';
import { GALLERY_BUILDERS } from '../models/galleryModels.js';
import { flyTo } from '../core/scene.js';

const VIEW_DIR = {
  mask: new THREE.Vector3(0.35, 0.25, 1),
  innerCoffin: new THREE.Vector3(0.7, 0.9, 1),
  sandals: new THREE.Vector3(0.2, 1.1, 1),
  default: new THREE.Vector3(0.3, 0.45, 1),
};

export class Gallery {
  constructor({ stage, controls, items, resolveInfo }) {
    this.stage = stage;
    this.controls = controls;
    this.items = items;
    this.resolveInfo = resolveInfo;
    this.cache = new Map();
    this.current = null;
    this.holder = new THREE.Group();
    stage.scene.add(this.holder);
    // tarima baja para piezas grandes (el ataúd no cabe en la peana)
    this.dais = new THREE.Mesh(new THREE.BoxGeometry(1, 0.16, 1), new THREE.MeshStandardMaterial({ color: 0x1f1913, roughness: 0.8 }));
    this.dais.receiveShadow = true; this.dais.castShadow = true;
    this.dais.visible = false;
    stage.scene.add(this.dais);
    this.plinth = stage.scene.children.filter((o) => o.isMesh && o.geometry.type === 'CylinderGeometry');
  }

  _build(item) {
    if (this.cache.has(item.id)) return this.cache.get(item.id);
    const obj = GALLERY_BUILDERS[item.builder]();
    obj.traverse((o) => { if (o.isMesh) o.userData.galleryId = item.id; });
    // apoyar el objeto y centrarlo
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const big = Math.max(size.x, size.z) > 1.0;
    const baseY = big ? 0.16 : this.stage.plinthTop;
    obj.position.set(-(box.min.x + box.max.x) / 2, baseY - box.min.y, -(box.min.z + box.max.z) / 2);
    const wrapper = new THREE.Group();
    wrapper.add(obj);
    const entry = { wrapper, big, size, baseY };
    this.cache.set(item.id, entry);
    return entry;
  }

  show(id, duration = 1.1) {
    const item = this.items.find((i) => i.id === id) || this.items[0];
    const entry = this._build(item);
    this.holder.clear();
    this.holder.add(entry.wrapper);
    this.current = item;
    this.dais.visible = entry.big;
    this.plinth.forEach((p) => { p.visible = !entry.big; });
    if (entry.big) { this.dais.scale.set(entry.size.x + 0.4, 1, entry.size.z + 0.4); this.dais.position.set(0, 0.08, 0); }
    // la luz principal sigue a la pieza
    const key = this.stage.lights.key;
    const cy = entry.baseY + entry.size.y / 2;
    key.target.position.set(0, cy, 0);
    key.position.set(1.4, cy + 2.6, 2.2);
    key.angle = entry.big ? 0.75 : 0.42;
    const box = new THREE.Box3().setFromObject(entry.wrapper);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const dir = VIEW_DIR[item.builder] || VIEW_DIR.default;
    this.controls.autoRotateSpeed = 0.8;
    return flyTo(this.stage.camera, this.controls, sphere.center, sphere.radius * 1.15, dir, duration);
  }

  info(id = this.current?.id) { return this.resolveInfo(this.items.find((i) => i.id === id)); }
}
