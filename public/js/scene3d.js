// Grafica 3D (doar decor).
// Prima pagină: o sferă lucioasă în mijloc, înconjurată de un lanț cromat pe orbită, cu posterele
// filmelor agățate de el. Autentificarea: un lanț roșiatic, pe diagonală, în spatele formularului.
import {
  ACESFilmicToneMapping,
  AmbientLight,
  BackSide,
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from '/vendor/three/three.module.js';

const UP = new Vector3(0, 1, 0);
const FOV = 35;
const FRAME_SAMPLES = 600;

export function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch {
    return false;
  }
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmallScreen = () => window.innerWidth < 700;

// Poziția unui element în pagină (nu pe ecran).
function pageBox(element) {
  const rect = element.getBoundingClientRect();
  const top = rect.top + window.scrollY;
  return { top, bottom: top + rect.height, height: rect.height, centerX: rect.left + rect.width / 2, width: rect.width };
}

// Coordonatele 3D sunt pixeli din pagină: x față de mijlocul ecranului, iar y în jos devine y negativ.
const toWorld = ([x, y, z]) => new Vector3(x, -y, z);

// Un „studio” virtual: o cameră gri cu panouri luminoase. Metalul și sfera îl reflectă;
// fără el, cromul ar ieși negru.
function studioEnvironment(renderer) {
  const studio = new Scene();
  studio.add(new Mesh(new BoxGeometry(10, 10, 10), new MeshBasicMaterial({ color: new Color(0.32, 0.32, 0.36), side: BackSide })));

  const panels = [
    [6, 2, 3.2, [0, 4.9, 0]],
    [3, 4, 2.4, [-4.9, 0.5, 1]],
    [3, 4, 1.8, [4.9, 1, -1]],
    [4, 1.5, 2.8, [0, 1, 4.9]],
    [2, 2, 1.2, [0, -1, -4.9]],
  ];
  for (const [width, height, intensity, position] of panels) {
    const panel = new Mesh(
      new PlaneGeometry(width, height),
      new MeshBasicMaterial({ color: new Color(intensity, intensity, intensity), side: DoubleSide }),
    );
    panel.position.set(...position);
    panel.lookAt(0, 0, 0);
    studio.add(panel);
  }

  const pmrem = new PMREMGenerator(renderer);
  const texture = pmrem.fromScene(studio, 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Un lanț de-a lungul unei curbe. Toate zalele lui sunt desenate dintr-o dată (InstancedMesh).
// O za este un tor (inel) întins pe verticală; fiecare a doua za e rotită cu 90°, ca să se prindă.
function createChainLine(scene, { linkSize, maxLinks, material, closed }) {
  const geometry = new TorusGeometry(0.5, 0.13, 12, 36);
  geometry.scale(linkSize, linkSize * 1.6, linkSize);
  const mesh = new InstancedMesh(geometry, material, maxLinks);
  mesh.frustumCulled = false;
  scene.add(mesh);

  // Distanța dintre zale e puțin mai mică decât golul din interiorul unei zale.
  const pitch = linkSize * 1.05;
  const point = new Vector3();
  const basis = new Matrix4();
  const matrix = new Matrix4();
  const quaternion = new Quaternion();
  const quarterTurn = new Quaternion().setFromAxisAngle(UP, Math.PI / 2);
  const unit = new Vector3(1, 1, 1);
  const line = { curve: null, frames: null, length: 1, count: 0 };

  line.setPath = (points) => {
    line.curve = new CatmullRomCurve3(points, closed, 'centripetal');
    line.curve.arcLengthDivisions = 2000;
    line.length = line.curve.getLength();
    line.frames = line.curve.computeFrenetFrames(FRAME_SAMPLES, closed);
    // Pe o buclă închisă, numărul de zale e par, ca alternanța să se lege la capăt.
    const count = Math.round(line.length / pitch);
    line.count = Math.min(maxLinks, closed ? count - (count % 2) : count);
  };

  // offset ∈ [0, 1): cât de mult au alunecat zalele de-a lungul curbei.
  line.place = (offset) => {
    const { curve, frames, count } = line;
    for (let i = 0; i < count; i += 1) {
      const t = (((i / count + offset) % 1) + 1) % 1;
      const frame = Math.round(t * FRAME_SAMPLES);
      curve.getPointAt(t, point);
      // Axa lungă a zalei (y) urmează curba. Ordinea (binormală, tangentă, normală) dă o rotație
      // corectă; cu (normală, tangentă, binormală) baza ar fi în oglindă.
      basis.makeBasis(frames.binormals[frame], frames.tangents[frame], frames.normals[frame]);
      quaternion.setFromRotationMatrix(basis);
      if (i % 2) quaternion.multiply(quarterTurn);
      matrix.compose(point, quaternion, unit);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  };

  return line;
}

// Motorul comun: randare, lumini și camera care urmărește scroll-ul.
// `tint` e culoarea cromului: reflexiile lanțului o preiau, iar o strălucire slabă o întărește.
function createStage(canvas, tint, build) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new Scene();
  scene.environment = studioEnvironment(renderer);
  scene.add(new AmbientLight('#ffffff', 0.6));
  const keyLight = new DirectionalLight('#ffffff', 1.3);
  keyLight.position.set(300, 500, 600);
  scene.add(keyLight);
  const rimLight = new DirectionalLight('#ffffff', 0.8);
  rimLight.position.set(-400, 200, -500);
  scene.add(rimLight);

  const camera = new PerspectiveCamera(FOV, 1, 1, 6000);
  const chainMaterial = new MeshStandardMaterial({
    color: tint,
    metalness: 1,
    roughness: 0.2,
    emissive: new Color(tint).multiplyScalar(0.08),
  });
  const still = reducedMotion();
  const parts = build({ scene, chainMaterial, still });

  const clock = { elapsed: 0 };
  let viewport = { width: 1, height: 1 };

  function layout() {
    viewport = { width: canvas.clientWidth, height: canvas.clientHeight };
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmallScreen() ? 1 : 1.75));
    renderer.setSize(viewport.width, viewport.height, false);
    camera.aspect = viewport.width / viewport.height;
    camera.position.z = viewport.height / 2 / Math.tan((FOV * Math.PI) / 360);
    camera.updateProjectionMatrix();
    parts.layout(viewport);
  }

  function update(delta) {
    if (!still) clock.elapsed += delta;
    camera.position.set(0, -(window.scrollY + viewport.height / 2), camera.position.z);
    parts.update({ time: clock.elapsed, scrollY: window.scrollY });
  }

  let last = performance.now();
  let scheduled = false;
  function render(now = performance.now()) {
    scheduled = false;
    const delta = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(delta);
    renderer.render(scene, camera);
    if (!still) requestAnimationFrame(render);
  }
  function requestRender() {
    if (still && !scheduled) {
      scheduled = true;
      requestAnimationFrame(render);
    }
  }

  let relayoutPending = false;
  function relayout() {
    if (relayoutPending) return;
    relayoutPending = true;
    requestAnimationFrame(() => {
      relayoutPending = false;
      layout();
      requestRender();
    });
  }

  layout();
  window.addEventListener('resize', relayout);
  new ResizeObserver(relayout).observe(document.body);
  window.addEventListener('scroll', requestRender, { passive: true });
  canvas.classList.add('is-ready');
  render();
}

// ---------- Prima pagină ----------

// Posterele agățate de lanțul de pe orbită: o ramă închisă, imaginea și un cârlig metalic.
function createHangingPosters(scene, posterUrls, count) {
  const loader = new TextureLoader();
  const frameMaterial = new MeshBasicMaterial({ color: '#0c0c0f', side: DoubleSide });
  const hookMaterial = new MeshStandardMaterial({ color: '#d4d4d8', metalness: 1, roughness: 0.25 });
  const imageGeometry = new PlaneGeometry(1, 1.5);
  const frameGeometry = new PlaneGeometry(1.08, 1.58);
  const hookGeometry = new CylinderGeometry(0.02, 0.02, 1, 8);

  const materials = posterUrls.map((url) => {
    const texture = loader.load(url);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    return new MeshBasicMaterial({ map: texture, side: DoubleSide });
  });

  return Array.from({ length: count }, (_, i) => {
    const card = new Group();
    const frame = new Mesh(frameGeometry, frameMaterial);
    frame.position.z = -0.6;
    const image = new Mesh(imageGeometry, materials[i % materials.length]);
    card.add(frame, image);

    const hook = new Mesh(hookGeometry, hookMaterial);
    scene.add(card, hook);
    return { card, hook };
  });
}

export function startHomeScene({ canvas, stage, posterUrls }) {
  const small = isSmallScreen();
  const linkSize = small ? 18 : 28;

  createStage(canvas, '#ffffff', ({ scene, chainMaterial, still }) => {
    // Sfera din mijloc: netedă, ca o perlă închisă la culoare, cu irizații fine.
    const sphere = new Mesh(
      new SphereGeometry(1, 96, 64),
      new MeshPhysicalMaterial({
        color: '#15151c',
        metalness: 0.9,
        roughness: 0.22,
        clearcoat: 1,
        clearcoatRoughness: 0.18,
        iridescence: 0.7,
        iridescenceIOR: 1.6,
      }),
    );
    scene.add(sphere);

    // Două inele subțiri, luminoase, în jurul sferei (ca liniile de orbită ale unei planete).
    const ringMaterial = new MeshBasicMaterial({ color: '#e63946', transparent: true, opacity: 0.4 });
    const rings = [new Mesh(new TorusGeometry(1, 0.006, 8, 160), ringMaterial), new Mesh(new TorusGeometry(1, 0.004, 8, 160), ringMaterial)];
    scene.add(...rings);

    const orbit = createChainLine(scene, { linkSize, maxLinks: 160, material: chainMaterial, closed: true });
    const posters = createHangingPosters(scene, posterUrls, small ? 6 : 8);

    const center = new Vector3();
    const spot = new Vector3();
    let radius = 1;
    let orbitRadius = 1;
    let posterWidth = 1;

    return {
      layout(viewport) {
        const vw = viewport.width;
        const box = pageBox(stage);
        radius = Math.min(box.width, box.height) * 0.27;
        orbitRadius = Math.min(radius * 2.05, vw * (small ? 0.34 : 0.42));
        posterWidth = radius * (small ? 0.5 : 0.56);
        center.set(box.centerX - vw / 2, -(box.top + box.height * 0.4), 0);

        sphere.position.copy(center);
        sphere.scale.setScalar(radius);
        rings[0].position.copy(center);
        rings[0].scale.setScalar(radius * 1.35);
        rings[0].rotation.set(Math.PI / 2 - 0.35, 0.15, 0);
        rings[1].position.copy(center);
        rings[1].scale.setScalar(radius * 2.25);
        rings[1].rotation.set(Math.PI / 2 - 0.2, -0.25, 0);

        // Orbita lanțului: un cerc înclinat, cu partea din față mai jos și mai aproape de privitor.
        const tilt = new Matrix4().makeRotationX(0.38).multiply(new Matrix4().makeRotationZ(-0.12));
        const points = Array.from({ length: 24 }, (_, k) => {
          const angle = (k / 24) * Math.PI * 2;
          return new Vector3(Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius)
            .applyMatrix4(tilt)
            .add(center);
        });
        orbit.setPath(points);

        for (const { card } of posters) card.scale.set(posterWidth, posterWidth, 1);
      },

      update({ time, scrollY }) {
        if (!still) {
          sphere.rotation.y = time * 0.15;
          rings[0].rotation.z = time * 0.05;
          rings[1].rotation.z = -time * 0.035;
        }

        // Orbita se rotește încet; scroll-ul o împinge puțin mai repede.
        const orbitOffset = still ? 0 : time * 0.02 + scrollY * 0.00012;
        orbit.place(orbitOffset);

        // Posterele stau agățate la distanțe egale pe orbită, mereu cu fața spre privitor.
        const hookLength = posterWidth * 0.35;
        posters.forEach(({ card, hook }, j) => {
          const t = (((j / posters.length + orbitOffset) % 1) + 1) % 1;
          orbit.curve.getPointAt(t, spot);
          hook.position.set(spot.x, spot.y - hookLength / 2, spot.z);
          hook.scale.set(posterWidth, hookLength, posterWidth);
          card.position.set(spot.x, spot.y - hookLength - posterWidth * 0.75, spot.z);
          const angle = t * Math.PI * 2;
          card.rotation.set(0, -Math.cos(angle) * 0.45, still ? 0 : Math.sin(time * 1.3 + j) * 0.05);
        });
      },
    };
  });
}

// ---------- Autentificare și cont nou ----------

// Doar un lanț roșiatic, pe diagonală, în spatele formularului.
export function startAuthScene({ canvas }) {
  const small = isSmallScreen();
  createStage(canvas, '#ff4655', ({ scene, chainMaterial, still }) => {
    const chain = createChainLine(scene, { linkSize: small ? 20 : 32, maxLinks: 200, material: chainMaterial, closed: false });
    return {
      layout(viewport) {
        const vw = viewport.width;
        const height = Math.max(document.documentElement.scrollHeight, viewport.height);
        chain.setPath(
          [
            [-vw * 0.8, height * 0.12, -120],
            [-vw * 0.15, height * 0.28, 160],
            [vw * 0.32, height * 0.42, -140],
            [-vw * 0.25, height * 0.68, 140],
            [vw * 0.2, height * 0.86, -60],
            [vw * 0.85, height * 0.98, 0],
          ].map(toWorld),
        );
      },
      update({ time, scrollY }) {
        chain.place(still ? 0 : (scrollY * 0.6 + time * 40) / chain.length);
      },
    };
  });
}
