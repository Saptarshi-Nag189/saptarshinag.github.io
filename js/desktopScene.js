import * as THREE from 'three';

export function createDesktopScene({ canvas, bus }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 2.2, 9.6);

  const ambientLight = new THREE.AmbientLight(0x4fbfc8, 1.3);
  scene.add(ambientLight);

  const keyLight = new THREE.PointLight(0x8ef8ff, 12, 28, 2);
  keyLight.position.set(0, 4, 7);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x7ca8ff, 1.2);
  fillLight.position.set(-3, 2, 2);
  scene.add(fillLight);

  const desktopPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 11, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0x081116,
      metalness: 0.15,
      roughness: 0.92,
      transparent: true,
      opacity: 0.94,
    }),
  );
  desktopPlane.position.set(0, -1.3, -1.6);
  desktopPlane.rotation.x = -1.12;
  scene.add(desktopPlane);

  const deskFrame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(18, 11)),
    new THREE.LineBasicMaterial({
      color: 0x4fd4da,
      transparent: true,
      opacity: 0.18,
    }),
  );
  deskFrame.position.copy(desktopPlane.position);
  deskFrame.rotation.copy(desktopPlane.rotation);
  scene.add(deskFrame);

  const proxies = new Map();
  const pointer = { x: 0, y: 0 };
  let focusedId = null;
  let renderAvailable = true;

  function setCanvasSize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  function createWindowProxy(windowId) {
    const group = new THREE.Group();
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: 0x0d1d24,
        emissive: 0x14313b,
        emissiveIntensity: 0.26,
        metalness: 0.08,
        roughness: 0.68,
        transparent: true,
        opacity: 0.72,
      }),
    );
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)),
      new THREE.LineBasicMaterial({
        color: 0x89f4f8,
        transparent: true,
        opacity: 0.35,
      }),
    );

    group.add(plate);
    group.add(edge);
    scene.add(group);
    proxies.set(windowId, {
      group,
      plate,
      edge,
      record: null,
    });
  }

  function removeWindowProxy(windowId) {
    const proxy = proxies.get(windowId);

    if (!proxy) {
      return;
    }

    scene.remove(proxy.group);
    proxy.plate.geometry.dispose();
    proxy.plate.material.dispose();
    proxy.edge.geometry.dispose();
    proxy.edge.material.dispose();
    proxies.delete(windowId);
  }

  function updateWindowProxy(record) {
    if (!proxies.has(record.id)) {
      createWindowProxy(record.id);
    }

    const proxy = proxies.get(record.id);
    proxy.record = record;
  }

  function updateDomDepth(proxy, emphasis = 0) {
    const element = document.querySelector(`[data-window-id="${proxy.record.id}"]`);

    if (!element) {
      return;
    }

    const tiltX = (-pointer.y * 1.4) + emphasis * 0.5;
    const tiltY = (pointer.x * 1.8) + emphasis * 0.7;
    const depth = proxy.group.position.z * 24;
    const shadow = 0.28 + emphasis * 0.24;

    element.style.setProperty('--window-tilt-x', `${tiltX.toFixed(2)}deg`);
    element.style.setProperty('--window-tilt-y', `${tiltY.toFixed(2)}deg`);
    element.style.setProperty('--window-depth', `${depth.toFixed(1)}px`);
    element.style.setProperty('--window-shadow-strength', shadow.toFixed(2));
  }

  function syncProxies() {
    proxies.forEach((proxy) => {
      const { record, group, plate } = proxy;

      if (!record) {
        return;
      }

      const viewportWidth = Math.max(window.innerWidth, 1);
      const viewportHeight = Math.max(window.innerHeight, 1);
      const normalisedX = (record.position.x + record.size.w / 2) / viewportWidth - 0.5;
      const normalisedY = (record.position.y + record.size.h / 2) / viewportHeight - 0.5;
      const focusBoost = record.id === focusedId ? 0.7 : 0;
      const zDepth = record.state === 'minimised' ? -1.2 : 0.3 + (record.zIndex / 200) + focusBoost;
      const scaleX = Math.max(1.4, record.size.w / 170);
      const scaleY = Math.max(1.1, record.size.h / 190);

      group.visible = record.state !== 'minimised';
      group.position.x += (((normalisedX * 10) + (pointer.x * 0.45)) - group.position.x) * 0.12;
      group.position.y += ((-(normalisedY * 5) + (pointer.y * 0.22)) - group.position.y) * 0.12;
      group.position.z += (zDepth - group.position.z) * 0.14;
      group.rotation.x += ((-0.12 - pointer.y * 0.06) - group.rotation.x) * 0.08;
      group.rotation.y += ((pointer.x * 0.1) - group.rotation.y) * 0.08;
      plate.scale.set(scaleX, scaleY, 1);
      proxy.edge.scale.copy(plate.scale);

      if (record.id === focusedId) {
        plate.material.emissive.setHex(0x1b5b64);
        plate.material.opacity = 0.84;
      } else {
        plate.material.emissive.setHex(0x14313b);
        plate.material.opacity = 0.68;
      }

      updateDomDepth(proxy, focusBoost);
    });
  }

  function animate() {
    requestAnimationFrame(animate);
    syncProxies();

    const focusProxy = focusedId ? proxies.get(focusedId) : null;
    const focusX = focusProxy ? focusProxy.group.position.x * 0.09 : 0;
    const focusY = focusProxy ? focusProxy.group.position.y * 0.05 : 0;

    camera.position.x += (((pointer.x * 0.55) + focusX) - camera.position.x) * 0.04;
    camera.position.y += (((-pointer.y * 0.35) + 2.2 + focusY) - camera.position.y) * 0.04;
    camera.lookAt(new THREE.Vector3(0, -0.8, -1.4));

    keyLight.position.x += ((pointer.x * 5) - keyLight.position.x) * 0.08;
    keyLight.position.y += ((3.4 - pointer.y * 2) - keyLight.position.y) * 0.08;

    if (!renderAvailable) {
      return;
    }

    try {
      renderer.render(scene, camera);
    } catch (error) {
      renderAvailable = false;
      canvas.dataset.renderMode = 'fallback';
      console.warn('Three.js renderer unavailable; continuing without live 3D rendering.', error);
    }
  }

  document.addEventListener('pointermove', (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
    document.documentElement.style.setProperty('--cursor-glow-x', `${event.clientX}px`);
    document.documentElement.style.setProperty('--cursor-glow-y', `${event.clientY}px`);
  });

  window.addEventListener('resize', setCanvasSize);

  bus.addEventListener('window:created', (event) => updateWindowProxy(event.detail.record));
  bus.addEventListener('window:updated', (event) => updateWindowProxy(event.detail.record));
  bus.addEventListener('window:maximised', (event) => updateWindowProxy(event.detail.record));
  bus.addEventListener('window:restored', (event) => updateWindowProxy(event.detail.record));
  bus.addEventListener('window:minimised', (event) => updateWindowProxy(event.detail.record));
  bus.addEventListener('window:focused', (event) => {
    focusedId = event.detail.record.id;
    updateWindowProxy(event.detail.record);
  });
  bus.addEventListener('window:closed', (event) => {
    if (focusedId === event.detail.record.id) {
      focusedId = event.detail.focusedId || null;
    }

    removeWindowProxy(event.detail.record.id);
  });

  setCanvasSize();
  animate();

  return {
    notifyAppLaunch(windowId) {
      focusedId = windowId;
    },
    dispose() {
      window.removeEventListener('resize', setCanvasSize);
      renderer.dispose();
    },
  };
}
