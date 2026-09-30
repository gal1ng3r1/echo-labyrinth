export function clearGameObjects(scene) {
  const toRemove = [];
  scene.traverse(obj => { if (obj.userData?.gameObj) toRemove.push(obj); });
  toRemove.forEach(o => {
    o.parent?.remove(o);
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
      else o.material.dispose();
    }
  });
}

export function createExit(scene, pos) {
  const group = new THREE.Group();
  group.userData.gameObj = true;
  const mat = new THREE.MeshStandardMaterial({ color: 0x444444, emissive: 0x444444, emissiveIntensity: 0.5 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.2, 8, 24), mat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.5;
  group.add(ring);
  const light = new THREE.PointLight(0x444444, 0.5, 6);
  light.position.y = 1.5;
  group.add(light);
  group.position.set(pos.x, 0, pos.z);
  scene.add(group);
  return { group, ring, light, mat };
}

export function createCore(scene, pos) {
  const group = new THREE.Group();
  group.userData.gameObj = true;
  const mat = new THREE.MeshStandardMaterial({ color: 0xccaaff, emissive: 0x8844ff, emissiveIntensity: 1, transparent: true, opacity: 0.8 });
  const obj = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), mat);
  obj.position.y = 1.5;
  group.add(obj);
  const light = new THREE.PointLight(0x8844ff, 1, 8);
  light.position.y = 1.5;
  group.add(light);
  group.position.set(pos.x, 0, pos.z);
  scene.add(group);
  return { group, obj, light, mat };
}

export function createCrystal(scene, pos) {
  const group = new THREE.Group();
  group.userData.gameObj = true;
  const mat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 1, transparent: true, opacity: 0.9 });
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), mat);
  mesh.position.y = 1;
  group.add(mesh);
  const light = new THREE.PointLight(0x00ffff, 0.5, 4);
  light.position.y = 1;
  group.add(light);
  group.position.set(pos.x, 0, pos.z);
  scene.add(group);
  return { mesh: group, obj: mesh, light, mat, collected: false, pulse: Math.random() * Math.PI * 2 };
}

export function createEnemy(scene, pos, patrolPoints) {
  const group = new THREE.Group();
  group.userData.gameObj = true;
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x110011, emissive: 0x330022, emissiveIntensity: 0.5, roughness: 0.3 })
  );
  body.position.y = 0.9;
  group.add(body);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff0044, emissive: 0xff0044, emissiveIntensity: 2 });
  const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), eyeMat);
  eye1.position.set(-0.2, 1.0, 0.55);
  group.add(eye1);
  const eye2 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), eyeMat);
  eye2.position.set(0.2, 1.0, 0.55);
  group.add(eye2);

  const light = new THREE.PointLight(0xff0044, 0.3, 3);
  light.position.y = 1;
  group.add(light);

  group.position.set(pos.x, 0, pos.z);
  scene.add(group);
  return { mesh: group, body, eyeMat, light, patrolPoints, patrolIndex: 0, chasing: false, pulse: Math.random() * Math.PI * 2 };
}

export function createButton(scene, pos, id) {
  const group = new THREE.Group();
  group.userData.gameObj = true;
  const mat = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xffaa00, emissiveIntensity: 0.5 });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.3, 16), mat);
  mesh.position.y = 0.15;
  group.add(mesh);
  group.position.set(pos.x, 0, pos.z);
  scene.add(group);
  return { mesh: group, obj: mesh, mat, pressed: false, id };
}

export function createDoor(scene, pos) {
  const group = new THREE.Group();
  group.userData.gameObj = true;
  const mat = new THREE.MeshStandardMaterial({ color: 0x884400, emissive: 0x442200, emissiveIntensity: 0.3 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 0.3), mat);
  mesh.position.y = 1.5;
  group.add(mesh);
  group.position.set(pos.x, 0, pos.z);
  scene.add(group);
  return { mesh: group, obj: mesh, mat, open: false, requiredButtons: 3 };
}

export function createItem(scene, pos, type, name, color) {
  const group = new THREE.Group();
  group.userData.gameObj = true;
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 });
  const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35, 0), mat);
  mesh.position.y = 1;
  group.add(mesh);
  group.position.set(pos.x, 0, pos.z);
  scene.add(group);
  return { mesh: group, obj: mesh, mat, type, name, collected: false };
}

export function createCompanion(scene) {
  const group = new THREE.Group();
  group.userData.gameObj = true;
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffaa, emissive: 0xffdd44, emissiveIntensity: 2 });
  group.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), mat));
  const light = new THREE.PointLight(0xffdd44, 0.6, 4);
  group.add(light);
  scene.add(group);
  return { mesh: group, light, mat, angle: 0, x: 0, z: 0, visible: true, scared: 0 };
}

export function createEchoMesh(scene) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x88ccff, emissive: 0x4488ff, emissiveIntensity: 0.8,
    transparent: true, opacity: 0.35, depthWrite: false
  });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.8, 4, 8), mat);
  body.position.y = 0.8;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), mat);
  head.position.y = 1.5;
  group.add(head);
  scene.add(group);
  return group;
}