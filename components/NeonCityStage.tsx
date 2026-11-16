import React, { useEffect, useRef } from 'react';
import type * as ThreeTypes from 'three';

type Props = {
  /** Height of the stage in CSS pixels. The width follows its parent. */
  height?: number;
  className?: string;
};

const ASSETS = {
  road: '/models/kenney/city-roads/road-straight.glb',
  light: '/models/kenney/city-roads/light-square.glb',
  building: '/models/kenney/city-commercial/building-a.glb',
  tower: '/models/kenney/city-commercial/building-skyscraper-a.glb',
  car: '/models/kenney/car/race-future.glb',
  cat: '/models/vuena/animal_cat.glb',
} as const;

/**
 * A lightweight 3D establishing shot for the menu.
 *
 * The gameplay renderer remains Canvas 2D, but the menu can afford a small
 * WebGL scene. Keeping this stage isolated means the CC0 kit adds depth and a
 * premium first impression without putting a WebGL dependency in the game
 * loop. If WebGL or a model download is unavailable, the surrounding menu
 * still renders normally.
 */
const NeonCityStage: React.FC<Props> = ({ height = 150, className }) => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let frame = 0;
    let cleanupViewer: (() => void) | undefined;

    const boot = async () => {
      try {
        const THREE = await import('three');
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        if (disposed) return;

        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: 'low-power',
          preserveDrawingBuffer: false,
        });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        renderer.domElement.style.display = 'block';
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        host.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.fog = new THREE.Fog(0x081022, 6, 18);
        const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
        camera.position.set(6.4, 4.1, 8.4);

        scene.add(new THREE.HemisphereLight(0x9edcff, 0x070b18, 1.7));
        const key = new THREE.DirectionalLight(0xffffff, 3.2);
        key.position.set(-3, 7, 5);
        scene.add(key);
        const cyan = new THREE.PointLight(0x2beeff, 5, 10);
        cyan.position.set(-3.5, 1.5, 2.5);
        scene.add(cyan);
        const magenta = new THREE.PointLight(0xff4fa3, 4, 12);
        magenta.position.set(3.5, 2.8, -3.5);
        scene.add(magenta);

        const floor = new THREE.Mesh(
          new THREE.PlaneGeometry(18, 18),
          new THREE.MeshStandardMaterial({
            color: 0x071322,
            roughness: 0.72,
            metalness: 0.28,
            transparent: true,
            opacity: 0.94,
          }),
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.025;
        scene.add(floor);

        const grid = new THREE.GridHelper(16, 32, 0x2beeff, 0x18314b);
        grid.position.y = -0.01;
        const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
        for (const material of gridMaterials) {
          material.transparent = true;
          material.opacity = 0.22;
        }
        scene.add(grid);

        const loader = new GLTFLoader();
        const load = (url: string) => loader.loadAsync(url);
        const [roadGltf, lightGltf, buildingGltf, towerGltf, carGltf, catGltf] = await Promise.all([
          load(ASSETS.road),
          load(ASSETS.light),
          load(ASSETS.building),
          load(ASSETS.tower),
          load(ASSETS.car),
          load(ASSETS.cat),
        ]);
        if (disposed) {
          renderer.dispose();
          renderer.domElement.remove();
          return;
        }

        const city = new THREE.Group();
        city.rotation.y = -0.22;
        scene.add(city);

        const tuneMaterials = (root: ThreeTypes.Object3D, metalness: number, roughness: number) => {
          root.traverse((object) => {
            const mesh = object as ThreeTypes.Mesh;
            const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
            for (const material of materials) {
              const standard = material as ThreeTypes.MeshStandardMaterial;
              if ('metalness' in standard) standard.metalness = metalness;
              if ('roughness' in standard) standard.roughness = roughness;
              standard.needsUpdate = true;
            }
          });
        };

        const add = (
          object: ThreeTypes.Object3D,
          scale: number,
          x: number,
          y: number,
          z: number,
          rotationY = 0,
        ) => {
          object.scale.setScalar(scale);
          object.position.set(x, y, z);
          object.rotation.y = rotationY;
          city.add(object);
          return object;
        };

        // The kit is intentionally assembled rather than used as a static
        // backdrop: these are separate CC0 models, so replacing or recolouring
        // a tower, car or street light later does not require a new illustration.
        add(roadGltf.scene, 7.2, 0, 0, -0.55);
        add(buildingGltf.scene, 4.3, -2.8, 0, -2.55, 0.08);
        add(towerGltf.scene, 3.35, 1.25, 0, -3.25, -0.12);
        add(carGltf.scene, 1.45, 1.25, 0.04, 0.35, -0.45);
        add(lightGltf.scene, 4.1, -2.15, 0, -0.05);
        const secondLight = lightGltf.scene.clone(true);
        add(secondLight, 4.1, 2.6, 0, -0.95, Math.PI);
        const cat = add(catGltf.scene, 1.05, -0.85, 0.02, 0.58, -0.7);
        // The Vuena file is authored at 1 unit = 1 metre. Keep its paws on the
        // shared city floor even if a future export changes the scene origin.
        const catBounds = new THREE.Box3().setFromObject(cat);
        cat.position.y -= catBounds.min.y;

        tuneMaterials(roadGltf.scene, 0.38, 0.66);
        tuneMaterials(buildingGltf.scene, 0.18, 0.54);
        tuneMaterials(towerGltf.scene, 0.22, 0.5);
        tuneMaterials(carGltf.scene, 0.75, 0.28);
        tuneMaterials(lightGltf.scene, 0.42, 0.34);
        tuneMaterials(catGltf.scene, 0.08, 0.58);

        // The CC0 Vuena cat ships with named idle/run/jump clips. A small idle
        // loop gives the scene a heartbeat without distracting from the live-run
        // preview.
        const idleClip = catGltf.animations.find((clip) => clip.name === 'idle') ?? catGltf.animations[0];
        const mixer = idleClip ? new THREE.AnimationMixer(cat) : null;
        if (idleClip && mixer) mixer.clipAction(idleClip).play();

        // A cyan ring anchors the hero in the scene and makes the silhouette
        // readable against the dark tower materials.
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.55, 0.59, 48),
          new THREE.MeshBasicMaterial({ color: 0x2beeff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(-0.85, 0.018, 0.58);
        city.add(ring);

        const resize = () => {
          const width = Math.max(1, host.clientWidth || 320);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(host);

        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        camera.lookAt(0, 0.8, -1.15);
        renderer.render(scene, camera);
        if (!reducedMotion) {
          let last = performance.now();
          const render = (now: number) => {
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            mixer?.update(dt);
            city.rotation.y += dt * 0.035;
            ring.rotation.z -= dt * 0.9;
            renderer.render(scene, camera);
            frame = requestAnimationFrame(render);
          };
          frame = requestAnimationFrame(render);
        }

        cleanupViewer = () => {
          cancelAnimationFrame(frame);
          observer.disconnect();
          scene.traverse((object) => {
            const mesh = object as ThreeTypes.Mesh;
            mesh.geometry?.dispose?.();
            const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
            for (const material of materials) material.dispose?.();
          });
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch {
        // The stage is decorative. Keep the menu usable on browsers without
        // WebGL, on low-memory phones, and when an asset request is blocked.
        if (!disposed) host.dataset.stageFailed = 'true';
      }
    };

    void boot();
    return () => {
      disposed = true;
      cleanupViewer?.();
    };
  }, [height]);

  return (
    <div
      ref={hostRef}
      className={`relative overflow-hidden ${className ?? ''}`}
      style={{ height }}
      aria-label="CC0 neon city 3D preview"
      role="img"
    >
      <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(115deg,rgba(43,238,255,0.08),transparent_42%,rgba(255,79,163,0.1))]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1/2 bg-gradient-to-t from-[#050b18]/60 to-transparent" />
      <span className="pointer-events-none absolute right-2 top-2 z-20 rounded-full border border-cyan-200/20 bg-[#071322]/75 px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-cyan-100/75 backdrop-blur-sm">
        CC0 · city kit
      </span>
    </div>
  );
};

export default NeonCityStage;
