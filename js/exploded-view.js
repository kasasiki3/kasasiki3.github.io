// ヒーローの3D分解ビュー（exploded-proto.html からの統合版）
// GLB 読み込みに失敗した場合は、フォールバック画像（.hero-media 内の img）が表示されたまま残る
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// idではなくクラスで引く。id は節の追加で移動しうるが、キャンバスの基準は常にヒーロー節そのもの
const hero = document.querySelector('.hero');
const wrap = document.getElementById('stage-wrap');
const stage = document.getElementById('stage');
const fallbackImg = document.getElementById('stage-fallback');
const explodeCtrl = document.getElementById('explode-ctrl');
const explodeInput = document.getElementById('explode');
const explodeVal = document.getElementById('explode-val');

// レンダラー（サイズはコンテナ基準。後述の resize() で実サイズを反映する）
// preserveDrawingBuffer は常時オンにすると描画のたびにバッファを保持してコストになる。
// OGP画像をこの3Dから書き出すときだけ ?export を付けて有効化する（読み出しは合成後になるため必須）
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: location.search.includes('export') });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
stage.appendChild(renderer.domElement);

// シーン背景と環境光（背景はページ地 --bg #fbfaf7 に合わせ、枠なしでも馴染ませる）
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfbfaf7);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const BASE_FOV = 22;
const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.01, 100);

// 分解するほど部品が枠の外へ広がるので、その分だけ画角を広げて全体を収める。
// e=0 では 1.0 倍なので、組立状態の見え方（オーナー確認済み）は変わらない。
// setViewOffset の平行移動はピクセル単位なので、fov を変えても枠中心に載ったままになる
const EXPLODE_ZOOM = 0.35;
let fitFov = BASE_FOV;  // resize() が決める「基準枠にちょうど収まる」画角
let zoomOut = 1;        // 分解量ぶんの広げ幅
function applyFov() { camera.fov = fitFov * zoomOut; camera.updateProjectionMatrix(); }

// デスクトップではキャンバスをヒーロー全体に広げる（＝ズームしても太鼓を切る枠がない）。
// 太鼓の見え位置・サイズは基準枠 .hero-media のまま: fov を高さ比で広げて見えサイズを保ち、
// 投影を平行移動して枠の中心へ寄せる。setViewOffset は width/height をキャンバスと同値にしているので拡大もクリップもしない。
// モバイル（style.css の 880px ブレークポイントと対）は縦積みで hero が本文の高さになり fov が破綻するため、従来どおり枠内に描く
const mobile = matchMedia('(max-width:880px)');
function resize() {
  const hr = hero.getBoundingClientRect(), br = wrap.getBoundingClientRect();
  if (!hr.height || !br.height) return;
  const wide = !mobile.matches;
  // デスクトップはビューポート全幅 × ヒーロー高。ヒーロー幅で止めると、その左右端が新しい枠になって
  // ズーム時に太鼓がそこで切れ、外側にページ地の帯（白枠）が残る
  const cl = wide ? 0 : br.left, ct = wide ? hr.top : br.top;
  const w = wide ? document.documentElement.clientWidth : br.width;
  const h = wide ? hr.height : br.height;
  stage.style.left = (cl - hr.left) + 'px';
  stage.style.top = (ct - hr.top) + 'px';
  stage.style.width = w + 'px';
  stage.style.height = h + 'px';
  camera.aspect = w / h;
  fitFov = wide ? BASE_FOV * (h / br.height) : BASE_FOV;
  camera.fov = fitFov * zoomOut;
  if (wide) camera.setViewOffset(w, h, w / 2 - (br.left - cl + br.width / 2), h / 2 - (br.top - ct + br.height / 2), w, h);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
resize();
// 枠も観測する。フォールバック画像を display:none にすると枠だけ縮み、ヒーロー高さは本文で決まるため変化しない
const ro = new ResizeObserver(resize);
ro.observe(hero);
ro.observe(wrap);

// ---- lighting（試作からそのまま）----
const key = new THREE.DirectionalLight(0xfff2e6, 2.1);
key.position.set(2.5, 4.5, 4);
scene.add(key);

const rim = new THREE.DirectionalLight(0x2bb7e2, 1.0);
rim.position.set(-4, 2, -3);
scene.add(rim);

const warm = new THREE.DirectionalLight(0xffd8a8, 0.3);
warm.position.set(2, 1.5, -4);
scene.add(warm);

const fill = new THREE.HemisphereLight(0xffffff, 0xd8d4cc, 0.55);
scene.add(fill);

// ---- 木目テクスチャ（合板／ベニヤ風：まっすぐ平行に走る直線グレイン）----
function woodTexture() {
  const s = 1024, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const g = cv.getContext('2d');
  g.fillStyle = '#a1703c'; g.fillRect(0, 0, s, s);
  for (let x = 0; x < s; x += 26 + Math.random() * 70) {
    const w = 24 + Math.random() * 80, l = (Math.random() - 0.5) * 0.4;
    g.fillStyle = `rgba(${(150 + l * 120) | 0},${(104 + l * 90) | 0},${(56 + l * 60) | 0},0.16)`;
    g.fillRect(x, 0, w, s);
  }
  for (let i = 0; i < 520; i++) {
    let px = Math.random() * s;
    const dark = Math.random() < 0.55;
    g.beginPath();
    g.lineWidth = 0.5 + Math.random() * 1.5;
    g.strokeStyle = dark ? `rgba(74,46,22,${0.10 + Math.random() * 0.30})`
                         : `rgba(202,162,104,${0.05 + Math.random() * 0.16})`;
    g.moveTo(px, 0);
    for (let y = 0; y <= s; y += 18) { px += (Math.random() - 0.5) * 1.5; g.lineTo(px, y); }
    g.stroke();
  }
  const img = g.getImageData(0, 0, s, s), dt = img.data;
  for (let i = 0; i < dt.length; i += 4) { const n = (Math.random() - 0.5) * 12; dt[i] += n; dt[i + 1] += n * 0.7; dt[i + 2] += n * 0.4; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// ---- materials（試作からそのまま）----
const MAT = {
  face: new THREE.MeshStandardMaterial({ color: 0x241d18, roughness: 0.6, metalness: 0.1, envMapIntensity: 0.5 }),
  rim:  new THREE.MeshStandardMaterial({ color: 0x2bb7e2, roughness: 0.3, metalness: 0.2, envMapIntensity: 1.2 }),
  body: new THREE.MeshStandardMaterial({ color: 0xffffff, map: woodTexture(), roughness: 0.62, metalness: 0.04, envMapIntensity: 0.55 }),
  bolt: new THREE.MeshStandardMaterial({ color: 0xc6c6ce, roughness: 0.3, metalness: 1.0, envMapIntensity: 1.4 }),
  mic:  new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.32, metalness: 0.6, envMapIntensity: 1.5 }),
  metal:new THREE.MeshStandardMaterial({ color: 0x8f9298, roughness: 0.42, metalness: 0.9, envMapIntensity: 1.2 }),
  case: new THREE.MeshStandardMaterial({ color: 0xe8e6e1, roughness: 0.55, metalness: 0.05, envMapIntensity: 0.6 }),
  pcb:  new THREE.MeshStandardMaterial({ color: 0x1f5f4a, roughness: 0.5,  metalness: 0.1, envMapIntensity: 0.6 }),
};

function triCount(mesh) {
  const g = mesh.geometry;
  return g.index ? g.index.count / 3 : g.attributes.position.count / 3;
}

// 木目の胴に平面投影UVを生成（ワールドX-Z＝打面平面。指定メッシュで共有スケール＝継ぎ目連続）
function projectWoodUV(bodyMeshes) {
  const tmp = new THREE.Vector3(), bb = new THREE.Box3();
  bodyMeshes.forEach(m => {
    const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { bb.expandByPoint(tmp.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld)); }
  });
  const minx = bb.min.x, minz = bb.min.z, sx = 1 / ((bb.max.x - bb.min.x) || 1), sz = 1 / ((bb.max.z - bb.min.z) || 1);
  bodyMeshes.forEach(m => {
    const p = m.geometry.attributes.position, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      tmp.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld);
      uv[i * 2] = (tmp.x - minx) * sx; uv[i * 2 + 1] = (tmp.z - minz) * sz;
    }
    m.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  });
}

// GLB読み込み直後に、サブアセンブリ階層を持つ全メッシュを root 直下へフラット化する
function flattenMeshes(root) {
  root.updateMatrixWorld(true);
  const meshes = [];
  root.traverse(o => { if (o.isMesh) meshes.push(o); });
  meshes.forEach(m => { root.attach(m); m.userData.home = m.position.clone(); });
  return meshes;
}

// ノード名の先頭／部分一致でパーツを分類し、分解方向とマテリアル、表示ラベルを設定
// 分解量は「積層のY順」ではなく実測した組立関係に従う（exploded-proto と同じ）
function classifyMeshes(meshes) {
  const bodyMeshes = [];
  meshes.forEach(o => {
    const n = o.name;
    let mat = null, dy = 0, xOut = false;
    if (n.includes('21-02-0103-0060')) {            mat = MAT.bolt;  dy = 0.30; }
    else if (n.startsWith('左縁') || n.startsWith('右縁')) { mat = MAT.body; dy = 0.22; bodyMeshes.push(o); }
    else if (n.startsWith('左面') || n.startsWith('右面')) { mat = MAT.body; dy = 0.22; bodyMeshes.push(o); }
    else if (n.startsWith('コンポーネント11')) {    mat = MAT.bolt;  dy = 0.15; }
    else if (n.startsWith('コンポーネント29')) {    mat = MAT.metal; dy = 0.05; }
    else if (n.startsWith('AT3040')) {              mat = MAT.mic;   dy = 0.07; }
    else if (n.startsWith('下板')) {                mat = MAT.body;  dy = 0; bodyMeshes.push(o); }
    else if (n.startsWith('コンポーネント8')) {     mat = MAT.metal; dy = -0.09; }
    else if (n.includes('21-02-0103-0050')) {       mat = MAT.bolt;  dy = -0.09; xOut = true; }
    else if (n.startsWith('左足') || n.startsWith('右足')) { mat = MAT.body; dy = -0.22; bodyMeshes.push(o); }
    else {
      mat = MAT.metal;
      console.warn('未分類パーツ:', n, 'triangles:', triCount(o));
    }
    o.material = mat;
    o.userData.dy = dy;
    if (xOut) {
      o.geometry.computeBoundingBox();
      const cx = o.position.x + o.geometry.boundingBox.getCenter(new THREE.Vector3()).x;
      o.userData.dx = Math.sign(cx) * 0.06;
    }
  });
  projectWoodUV(bodyMeshes);
}

// 接続器（RP2040）のパーツを分類し、マテリアルと分解オフセットを設定する（単位 mm、scale=0.001 で 1/1000 になる）
function classifyConnectorMeshes(meshes) {
  meshes.forEach(o => {
    if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
    const n = o.name;
    let mat = MAT.metal, dy = 0;
    if (n.startsWith('Node2')) { mat = MAT.case; dy = -15; }
    else if (n.startsWith('Node4')) { mat = MAT.pcb; dy = 12; }
    else if (n.startsWith('Node6') || n.startsWith('Node8')) { mat = MAT.metal; dy = 30; }
    else {
      console.warn('未分類接続器パーツ:', n, 'triangles:', triCount(o));
    }
    o.material = mat;
    o.userData.dy = dy;
  });
}

// カメラの注視点と距離（OrbitControls.target とも共用）
let target = new THREE.Vector3();
let dist = 0;

// モデルのバウンディング球からカメラ距離と注視点を決定する。
// 0.5 係数で初期表示を大きく見せる（分解時はパーツが画面外に出るが、ズームアウトで全体に戻せる）
function frame(box) {
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const r = sphere.center.length() + sphere.radius;
  // 基準は BASE_FOV（＝枠 .hero-media いっぱいの画角）。広げた実 fov で測ると枠の外まで使って大きく写ってしまう
  const vfov = THREE.MathUtils.degToRad(BASE_FOV);
  // 距離係数: 3/5縮小をもう一度適用（2026-08-06）。0.3 = 0.18 × 5/3。小さいほど拡大
  dist = r / Math.sin(vfov / 2) * 0.3;
  // 初期視点: 参照画像（オーナー提供 2026-08-06）に合わせ、正面から右20°・水平+32°の見下ろし
  const dir = new THREE.Vector3(0.342, 0.530, 0.940).normalize();
  camera.near = r / 50; camera.far = dist + r * 8; camera.updateProjectionMatrix();
  target.set(0, 0, 0);
  camera.position.copy(dir.multiplyScalar(dist));
  camera.lookAt(target);
}

// 足の輪郭の接地辺はZ軸に対して -55°／+35°（直角）の2本。実機の設置角55°側で立たせる
const TILT = THREE.MathUtils.degToRad(-55);
let yawG = null;
let meshes = [];
let e = 0;   // 分解量（0=組立, 1=完全分解）

let connRoot = null;

const loader = new GLTFLoader();

// GLB を1つ読み込み、GLTF オブジェクトで解決する Promise
function loadGLB(url) {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });
}

// 分解量 e（0=組立, 1=完全分解）を各パーツのhomeから再計算（累積加算しない）
function applyExplode(e) {
  meshes.forEach(m => {
    const home = m.userData.home;
    const dy = m.userData.dy || 0;
    if (!home) return;
    const dx = m.userData.dx || 0;
    m.position.set(home.x + dx * e, home.y + dy * e, home.z);
  });
  meshes.forEach(m => m.updateMatrixWorld(true));
}

// ドラッグ／ホイールによる自由視点
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.enableZoom = true;
controls.minPolarAngle = 0.15;
controls.maxPolarAngle = Math.PI * 0.85;

// 2つのモデルが揃ってからシーンを組み立てる
Promise.all([
  // GLB にもキャッシュバスターを付ける。付けていなかったため、索引を UINT16 に落として
  // 2221KB → 1821KB にした後もブラウザは古い 2221KB を使い続けていた（2026-08-17 に実測で発覚）。
  // モデルを差し替えたときだけこの日付を上げる
  loadGLB('models/HIDtaiko_v2.glb?v=20260817'),
  loadGLB('models/RP2040_ver1.1.glb?v=20260817')
]).then(([taikoGLTF, connGLTF]) => {
  // ---- 太鼓 ----
  const taikoRoot = taikoGLTF.scene;
  meshes = flattenMeshes(taikoRoot);
  classifyMeshes(meshes);
  taikoRoot.updateMatrixWorld(true);
  const faceMesh = meshes.find(m => m.name.startsWith('下板'));
  const c = new THREE.Box3().setFromObject(faceMesh).getCenter(new THREE.Vector3());
  taikoRoot.position.sub(c);
  const tiltG = new THREE.Group(); tiltG.add(taikoRoot); tiltG.rotation.x = TILT;
  yawG = new THREE.Group(); yawG.add(tiltG); scene.add(yawG);
  yawG.rotation.y = Math.PI;

  // ---- 接続器 ----
  connRoot = connGLTF.scene;
  connRoot.scale.setScalar(0.001);
  const connMeshes = flattenMeshes(connRoot);
  classifyConnectorMeshes(connMeshes);
  meshes.push(...connMeshes);

  // 接続器は右足の接地辺の前端のすぐ手前に、足と同じ列（X中心を揃える）・足と平行（＝ケースの広い面の
  // 法線がX＝足の板と同じ向き）で床に置く。足の真横（X方向にずらす）だと視線方向に重なって埋まって見える。
  // 足の前に出すと同じ「すぐそば」でも重ならない。
  // 右足を選ぶのは、初期視点（camera dir 0.342,0.530,0.940・正面から右20°）で +X 側の足が画面右に見えるから。
  // tilt/yaw を反映した world 行列で測る（親の回転を入れ忘れると足の位置が回転前の座標になる）
  yawG.updateMatrixWorld(true);
  const legMesh = meshes.find(m => m.name.startsWith('右足'));
  const legBox = new THREE.Box3().setFromObject(legMesh);
  // 置く高さは足の接地辺（前半分 z>=0 の最下点）。足は背面へ長く傾斜して下がるので bbox の最下点を使うと
  // 前から見て太鼓より10cm以上沈み、宙に浮いたように見える
  const lp = legMesh.geometry.attributes.position, lv = new THREE.Vector3();
  let groundY = Infinity, groundFrontZ = -Infinity;
  for (let i = 0; i < lp.count; i++) {
    lv.fromBufferAttribute(lp, i).applyMatrix4(legMesh.matrixWorld);
    if (lv.z >= 0 && lv.y < groundY) groundY = lv.y;
  }
  // 接地辺の前端（＝足の前下がりの角）。接続器はこの前に置く
  for (let i = 0; i < lp.count; i++) {
    lv.fromBufferAttribute(lp, i).applyMatrix4(legMesh.matrixWorld);
    if (lv.y < groundY + 0.002 && lv.z > groundFrontZ) groundFrontZ = lv.z;
  }
  connRoot.rotation.y = Math.PI / 2;
  connRoot.updateMatrixWorld(true);
  const connBox = new THREE.Box3().setFromObject(connRoot);
  const GAP = 0.014;
  connRoot.position.x += legBox.getCenter(new THREE.Vector3()).x - connBox.getCenter(new THREE.Vector3()).x;
  connRoot.position.y += groundY - connBox.min.y;
  connRoot.position.z += (groundFrontZ + GAP) - connBox.min.z;
  scene.add(connRoot);

  // 画角は最も嵩張る「完全分解」の姿勢で測定する（tiltは固定されたまま）
  applyExplode(1);
  connRoot.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(yawG);
  box.expandByObject(connRoot);
  applyExplode(0);
  frame(box);

  controls.target.copy(target);
  // 初期位置（0.108d）のさらに半分までズームインできるようにする（初期位置が5倍拡大なので下限も引き下げ）
  controls.minDistance = dist * 0.05;
  controls.maxDistance = dist * 2.2;
  controls.update();

  // 3D表示に切り替え: フォールバック画像をフェードアウトし、ステージをフェードイン、スライダーを表示する
  fallbackImg.style.opacity = '0';
  stage.classList.add('ready');
  explodeCtrl.style.display = 'flex';
  // 3Dが操作できることの案内。フォールバック画像のときは操作できないので出さない
  const hint = document.getElementById('stage-hint');
  if (hint) hint.style.display = 'block';
  // フェード完了後に画像をDOMから外す（opacity:0 のまま残すとATに読み上げられる）
  setTimeout(() => { fallbackImg.style.display = 'none'; }, 600);
}).catch(err => {
  // GLB 読み込み失敗時はフォールバック画像（img）を表示したままにする
  console.error('3Dモデル読み込みに失敗:', err && err.stack ? err.stack : err);
  fallbackImg.style.display = '';
});

// スライダー操作で分解量を即時反映する
explodeInput.addEventListener('input', () => {
  e = parseInt(explodeInput.value, 10) / 100;
  explodeVal.textContent = explodeInput.value + '%';
  zoomOut = 1 + e * EXPLODE_ZOOM;
  applyFov();
});

renderer.setAnimationLoop(() => {
  if (yawG) applyExplode(e);
  controls.update();
  renderer.render(scene, camera);
});



