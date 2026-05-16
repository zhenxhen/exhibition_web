import * as THREE from 'three';

// 1. Scene Setup
const canvasContainer = document.getElementById('canvas-container');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 3000);
camera.position.set(0, 0, 300);

// 1.5. Mouse Interaction (hover only)
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(-9999, -9999);

window.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener('touchmove', (event) => {
  if (event.touches.length > 0) {
    mouse.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
  }
}, { passive: true });

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
canvasContainer.appendChild(renderer.domElement);

// 2. Colors
const palette = [
  '#0088cc',
  '#e63946',
  '#d48a00',
  '#2a9d8f',
  '#c85a17'
];
const rootColor = '#cccccc';

// 3. Reusable Geometries
const nodeGeometry = new THREE.BoxGeometry(1, 1, 1);

function createNodeMesh(size, colorHex) {
  const mat = new THREE.MeshBasicMaterial({ color: colorHex });
  const mesh = new THREE.Mesh(nodeGeometry, mat);
  mesh.scale.set(size, size, size);
  return mesh;
}

function createCircleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.arc(32, 32, 31, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}
const circleTex = createCircleTexture();

function createBillboardCircle(size, colorHex) {
  const mat = new THREE.SpriteMaterial({ map: circleTex, color: colorHex });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size * 2.5, size * 2.5, 1);
  return sprite;
}

function getRandomSurfacePoint(radius) {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const x = radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.sin(phi) * Math.sin(theta);
  const z = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

function getCirclePointAtAngle(radius, normalVector, angle) {
  const n = normalVector.clone().normalize();
  let u = new THREE.Vector3(1, 0, 0);
  if (Math.abs(n.x) > 0.9) {
    u.set(0, 1, 0);
  }
  u.cross(n).normalize();
  const v = new THREE.Vector3().crossVectors(n, u).normalize();

  const point = new THREE.Vector3();
  point.addScaledVector(u, Math.cos(angle) * radius);
  point.addScaledVector(v, Math.sin(angle) * radius);
  return point;
}

function createLinesToChildren(childrenPositions, parentColor, childrenColors) {
  const geom = new THREE.BufferGeometry();
  const pos = new Float32Array(childrenPositions.length * 6);
  const col = new Float32Array(childrenPositions.length * 6);

  const pColor = new THREE.Color(parentColor);

  for (let i = 0; i < childrenPositions.length; i++) {
    let childPos = childrenPositions[i];
    let cColor = new THREE.Color(childrenColors[i]);

    pos[i * 6] = 0; pos[i * 6 + 1] = 0; pos[i * 6 + 2] = 0;
    pos[i * 6 + 3] = childPos.x; pos[i * 6 + 4] = childPos.y; pos[i * 6 + 5] = childPos.z;

    col[i * 6] = pColor.r; col[i * 6 + 1] = pColor.g; col[i * 6 + 2] = pColor.b;
    col[i * 6 + 3] = cColor.r; col[i * 6 + 4] = cColor.g; col[i * 6 + 5] = cColor.b;
  }

  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(col, 3));

  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.45 });
  return new THREE.LineSegments(geom, mat);
}

function createSegmentLines(starts, ends, startColor, endColor) {
  const geom = new THREE.BufferGeometry();
  const pos = new Float32Array(starts.length * 6);
  const col = new Float32Array(starts.length * 6);
  const sCol = new THREE.Color(startColor);
  const eCol = new THREE.Color(endColor);

  for (let i = 0; i < starts.length; i++) {
    pos[i * 6] = starts[i].x; pos[i * 6 + 1] = starts[i].y; pos[i * 6 + 2] = starts[i].z;
    pos[i * 6 + 3] = ends[i].x; pos[i * 6 + 4] = ends[i].y; pos[i * 6 + 5] = ends[i].z;
    col[i * 6] = sCol.r; col[i * 6 + 1] = sCol.g; col[i * 6 + 2] = sCol.b;
    col[i * 6 + 3] = eCol.r; col[i * 6 + 4] = eCol.g; col[i * 6 + 5] = eCol.b;
  }
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.35 });
  return new THREE.LineSegments(geom, mat);
}

function createOrbitRingGapped(radius, colorHex, opacity, halfGap) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity });
  const gapAngles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
  const totalSteps = 400;

  const isInGap = (angle) => gapAngles.some(ga => {
    let diff = (angle - ga) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff) < halfGap;
  });

  const segments = [];
  let current = [];
  for (let i = 0; i < totalSteps; i++) {
    const angle = (i / totalSteps) * Math.PI * 2;
    if (!isInGap(angle)) {
      current.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
    } else {
      if (current.length >= 2) segments.push([...current]);
      current = [];
    }
  }
  if (current.length >= 2) segments.push(current);

  segments.forEach(pts => {
    const curve = new THREE.CatmullRomCurve3(pts);
    const tubeGeom = new THREE.TubeGeometry(curve, Math.max(pts.length, 4), 0.4, 8, false);
    group.add(new THREE.Mesh(tubeGeom, mat));
  });
  return group;
}

// 4. Build The Graph Structure

const mainSystem = new THREE.Group();
scene.add(mainSystem);

const MAIN_RADIUS = 200;
const RING_HALF_GAP = 10 / (MAIN_RADIUS * 1.05);
mainSystem.add(createOrbitRingGapped(MAIN_RADIUS * 1.05, '#000', 0.05, RING_HALF_GAP).rotateX(Math.PI / 2));
mainSystem.add(createOrbitRingGapped(MAIN_RADIUS * 1.05, '#000', 0.05, RING_HALF_GAP).rotateY(Math.PI / 2));
mainSystem.add(createOrbitRingGapped(MAIN_RADIUS * 1.05, '#000', 0.05, RING_HALF_GAP));

{
  const R_RING = MAIN_RADIUS * 1.05;
  const arrowLen = 10;
  const arrowRadius = 3;
  const offset = 8;
  const arrowMat = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.05 });
  const coneGeom = new THREE.ConeGeometry(arrowRadius, arrowLen, 8);
  const yAxis = new THREE.Vector3(0, 1, 0);

  const arrowPairs = [
    { pos: new THREE.Vector3(R_RING, 0, 0), dir: new THREE.Vector3(0, 0, 1) },
    { pos: new THREE.Vector3(R_RING, 0, 0), dir: new THREE.Vector3(0, 1, 0) },
    { pos: new THREE.Vector3(-R_RING, 0, 0), dir: new THREE.Vector3(0, 0, 1) },
    { pos: new THREE.Vector3(-R_RING, 0, 0), dir: new THREE.Vector3(0, 1, 0) },
    { pos: new THREE.Vector3(0, R_RING, 0), dir: new THREE.Vector3(0, 0, 1) },
    { pos: new THREE.Vector3(0, R_RING, 0), dir: new THREE.Vector3(1, 0, 0) },
    { pos: new THREE.Vector3(0, -R_RING, 0), dir: new THREE.Vector3(0, 0, 1) },
    { pos: new THREE.Vector3(0, -R_RING, 0), dir: new THREE.Vector3(1, 0, 0) },
    { pos: new THREE.Vector3(0, 0, R_RING), dir: new THREE.Vector3(1, 0, 0) },
    { pos: new THREE.Vector3(0, 0, R_RING), dir: new THREE.Vector3(0, 1, 0) },
    { pos: new THREE.Vector3(0, 0, -R_RING), dir: new THREE.Vector3(1, 0, 0) },
    { pos: new THREE.Vector3(0, 0, -R_RING), dir: new THREE.Vector3(0, 1, 0) },
  ];

  arrowPairs.forEach(({ pos, dir }) => {
    const dirNeg = dir.clone().negate();

    const a1 = new THREE.Mesh(coneGeom, arrowMat);
    a1.quaternion.setFromUnitVectors(yAxis, dirNeg);
    a1.position.copy(pos).addScaledVector(dir, offset);
    mainSystem.add(a1);

    const a2 = new THREE.Mesh(coneGeom, arrowMat);
    a2.quaternion.setFromUnitVectors(yAxis, dir);
    a2.position.copy(pos).addScaledVector(dirNeg, offset);
    mainSystem.add(a2);
  });
}

const animGroups = [];

const DEPTH1_COUNT = 18;
const R1 = MAIN_RADIUS;

const DEPTH2_COUNT = 80;
const R2 = 55;
const R3_OFFSET = 12;
const R4_HEIGHT = 5;

for (let i = 0; i < DEPTH1_COUNT; i++) {
  const depth1Group = new THREE.Group();

  const R1_random = R1 * (0.8 + Math.random() * 0.2);
  const depth1Pos = getRandomSurfacePoint(R1_random);
  depth1Group.position.copy(depth1Pos);

  depth1Group.userData = {
    rotAxis: depth1Pos.clone().normalize(),
    rotSpeed: (Math.random()) * 0.005
  };

  const randomScale = 0.5 + Math.random() * 0.7;
  depth1Group.scale.setScalar(randomScale);

  const orbitGroup = new THREE.Group();
  orbitGroup.userData = {
    rotAxis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
    rotSpeed: (Math.random() - 0.5) * 0.005
  };
  orbitGroup.add(depth1Group);
  mainSystem.add(orbitGroup);
  animGroups.push(orbitGroup);
  animGroups.push(depth1Group);

  const depth1Col = palette[i % palette.length];

  const rootLine = createLinesToChildren([depth1Pos], rootColor, [depth1Col]);
  rootLine.material = new THREE.LineDashedMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.45,
    dashSize: 5,
    gapSize: 3
  });
  rootLine.computeLineDistances();
  orbitGroup.add(rootLine);

  const bgMat = new THREE.MeshBasicMaterial({
    color: depth1Col,
    transparent: true,
    opacity: 0.5,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneMinusDstColorFactor,
    blendDst: THREE.OneMinusSrcColorFactor,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const bgGeom = new THREE.BufferGeometry();
  const bgPositions = new Float32Array((DEPTH2_COUNT + 1) * 3);
  const bgIndices = [];

  bgPositions[0] = 0; bgPositions[1] = 0; bgPositions[2] = 0;

  for (let j = 0; j < DEPTH2_COUNT; j++) {
    const current = j + 1;
    const next = (j + 1 === DEPTH2_COUNT) ? 1 : j + 2;
    bgIndices.push(0, current, next);
  }

  bgGeom.setIndex(bgIndices);
  bgGeom.setAttribute('position', new THREE.BufferAttribute(bgPositions, 3));

  const bgMesh = new THREE.Mesh(bgGeom, bgMat);
  depth1Group.add(bgMesh);
  depth1Group.userData.bgGeometry = bgGeom;

  const waveLayers = [
    { freq: 1 + Math.floor(Math.random() * 3), amp: 0.04, phase: Math.random() * Math.PI * 2, speed: 0.5 + Math.random() * 1.5 },
    { freq: 4 + Math.floor(Math.random() * 4), amp: 0.04, phase: Math.random() * Math.PI * 2, speed: -0.8 - Math.random() * 2.0 },
    { freq: 8 + Math.floor(Math.random() * 6), amp: 0.02, phase: Math.random() * Math.PI * 2, speed: 1.2 + Math.random() * 2.5 }
  ];

  const localR2 = R2 * (0.6 + Math.random() * 0.6);

  depth1Group.userData.isDepth1 = true;
  depth1Group.userData.waveLayers = waveLayers;
  depth1Group.userData.depth2Nodes = [];
  depth1Group.userData.depth3Nodes = [];
  depth1Group.userData.depth4Nodes = [];
  depth1Group.userData.depth1Pos = depth1Pos;
  depth1Group.userData.localR2 = localR2;

  let depth2Positions = [];
  let depth3Positions = [];
  let depthCol = depth1Col;

  const verticalDir = depth1Pos.clone().normalize();

  for (let j = 0; j < DEPTH2_COUNT; j++) {
    const depth2Group = new THREE.Group();
    const angle = (j / DEPTH2_COUNT) * Math.PI * 2;
    depth2Group.userData.angle = angle;
    depth2Group.userData.currentRepulsion = 0;

    let waveValue = 0;
    waveLayers.forEach(layer => {
      waveValue += Math.sin(angle * layer.freq + layer.phase) * layer.amp;
    });

    const organicR2 = localR2 * (0.9 + waveValue);
    const depth2Pos = getCirclePointAtAngle(organicR2, depth1Pos, angle);
    depth2Group.position.copy(depth2Pos);
    depth1Group.add(depth2Group);
    animGroups.push(depth2Group);
    depth1Group.userData.depth2Nodes.push(depth2Group);

    const depth3Group = new THREE.Group();
    const organicR3 = organicR2 + R3_OFFSET;
    const depth3Pos = getCirclePointAtAngle(organicR3, depth1Pos, angle);
    depth3Group.position.copy(depth3Pos);
    depth1Group.add(depth3Group);
    depth1Group.userData.depth3Nodes.push(depth3Group);

    const depth4Group = new THREE.Group();
    const depth4Pos = depth2Pos.clone().add(verticalDir.clone().multiplyScalar(R4_HEIGHT));
    depth4Group.position.copy(depth4Pos);
    depth1Group.add(depth4Group);
    depth1Group.userData.depth4Nodes.push(depth4Group);

    depth2Positions.push(depth2Pos);
    depth3Positions.push(depth3Pos);

    depth2Group.add(createBillboardCircle(0.3, depthCol));
    depth3Group.add(createBillboardCircle(0.2, depthCol));
    depth4Group.add(createBillboardCircle(0.3, depthCol));
  }

  const lines2 = createLinesToChildren(depth2Positions, depth1Col, Array(DEPTH2_COUNT).fill(depthCol));
  depth1Group.add(lines2);
  depth1Group.userData.lineSegments = lines2;

  const lines3 = createSegmentLines(depth2Positions, depth3Positions, depth1Col, depthCol);
  depth1Group.add(lines3);
  depth1Group.userData.lineSegments3 = lines3;
}

// 5. Animation Loop
const clock = new THREE.Clock();
const tempVector = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const elapsedTime = clock.getElapsedTime();
  clock.getDelta();

  raycaster.setFromCamera(mouse, camera);

  mainSystem.rotation.y += 0.002;
  mainSystem.rotation.x += 0.0008;

  mainSystem.traverse(group => {
    if (group.userData && group.userData.isDepth1) {
      const { waveLayers, depth2Nodes, depth3Nodes, depth4Nodes, lineSegments, lineSegments3, bgGeometry, depth1Pos, localR2 } = group.userData;
      const linePositions2 = lineSegments.geometry.attributes.position.array;
      const linePositions3 = lineSegments3.geometry.attributes.position.array;
      const bgPositions = bgGeometry.attributes.position.array;
      const verticalDir = depth1Pos.clone().normalize();

      depth2Nodes.forEach((node2, j) => {
        const node3 = depth3Nodes[j];
        const node4 = depth4Nodes[j];
        const angle = node2.userData.angle;

        let waveValue = 0;
        waveLayers.forEach(layer => {
          waveValue += Math.sin(angle * layer.freq + layer.phase + elapsedTime * layer.speed) * layer.amp;
        });

        node2.getWorldPosition(tempVector);
        const distToRay = raycaster.ray.distanceToPoint(tempVector);
        let targetRepulsion = 0;

        if (distToRay < 200) {
          targetRepulsion = (200 - distToRay) * 0.15;
        }

        node2.userData.currentRepulsion += (targetRepulsion - node2.userData.currentRepulsion) * 0.04;

        const activeR2 = (localR2 * (0.9 + waveValue)) + node2.userData.currentRepulsion;
        const organicR3 = activeR2 + R3_OFFSET;

        const newPos2 = getCirclePointAtAngle(activeR2, depth1Pos, angle);
        const newPos3 = getCirclePointAtAngle(organicR3, depth1Pos, angle);
        const newPos4 = newPos2.clone().add(verticalDir.clone().multiplyScalar(R4_HEIGHT));

        node2.position.copy(newPos2);
        node3.position.copy(newPos3);
        node4.position.copy(newPos4);

        linePositions2[j * 6 + 3] = newPos2.x;
        linePositions2[j * 6 + 4] = newPos2.y;
        linePositions2[j * 6 + 5] = newPos2.z;

        linePositions3[j * 6 + 0] = newPos2.x;
        linePositions3[j * 6 + 1] = newPos2.y;
        linePositions3[j * 6 + 2] = newPos2.z;
        linePositions3[j * 6 + 3] = newPos3.x;
        linePositions3[j * 6 + 4] = newPos3.y;
        linePositions3[j * 6 + 5] = newPos3.z;

        bgPositions[(j + 1) * 3] = newPos2.x;
        bgPositions[(j + 1) * 3 + 1] = newPos2.y;
        bgPositions[(j + 1) * 3 + 2] = newPos2.z;
      });

      lineSegments.geometry.attributes.position.needsUpdate = true;
      lineSegments3.geometry.attributes.position.needsUpdate = true;
      bgGeometry.attributes.position.needsUpdate = true;
    }
  });

  for (let i = 0; i < animGroups.length; i++) {
    let g = animGroups[i];
    if (g.userData && g.userData.rotAxis) {
      g.rotateOnAxis(g.userData.rotAxis, g.userData.rotSpeed);
    }
  }

  renderer.render(scene, camera);
}

// 6. Handle resizing
function handleResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;

  const BASE_Z = 350;
  const BASE_ASPECT = 16 / 9;

  if (camera.aspect < BASE_ASPECT) {
    const ratio = BASE_ASPECT / camera.aspect;
    camera.position.z = BASE_Z * Math.pow(ratio, 0.5);
  } else {
    camera.position.z = BASE_Z;
  }

  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

window.addEventListener('resize', handleResize);
handleResize();

animate();
