import React, { useEffect, useRef, useState } from 'react';

/**
 * Photo booth for the toon cat, used by the shop's studio panel.
 *
 * The rig's only clip is a walk loop, so instead of walking on the spot it
 * stands on a slow turntable. The whole 3D stack is
 * loaded on demand: the chunk with three.js only arrives when this component is
 * first shown, so the menu and the game never pay for it.
 *
 * Attribution is required by the model's licence (CC BY 4.0) and is rendered by
 * the parent, always, whether or not the model finished loading.
 */

type Props = {
  /** Pixel size of the square stage. */
  size?: number;
  className?: string;
  /** Told when the model is actually on screen, so the parent can hide its 2D stand-in. */
  onReady?: () => void;
};

const MODEL_URL = 'models/toon_cat_free.glb';

const Cat3DPreview: React.FC<Props> = ({ size = 260, className, onReady }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  // Kept in a ref so a new callback identity on the parent's render does not
  // tear down and rebuild the whole scene.
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Respect the player's motion preference: a still pose on a static camera.
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let disposed = false;
    let frame = 0;
    let cleanupViewer: (() => void) | undefined;

    const boot = async () => {
      try {
        const THREE = await import('three');
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        if (disposed) return;

        // preserveDrawingBuffer lets a test harness read the painted frame back.
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: true });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        renderer.setSize(size, size, false);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        host.appendChild(renderer.domElement);
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        renderer.domElement.style.display = 'block';

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);

        // Three-point neon rig: cool key, warm rim, soft fill from the floor.
        // The loader normalises the sculpt to roughly one unit tall.
        scene.add(new THREE.HemisphereLight(0x9fe8ff, 0x102014, 1.4));
        const key = new THREE.DirectionalLight(0xffffff, 2.4);
        key.position.set(1.2, 2.4, 2);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0x2bee79, 3);
        rim.position.set(-2, 0.8, -1.6);
        scene.add(rim);
        const fill = new THREE.PointLight(0xff5f8a, 1.6, 4);
        fill.position.set(0, -0.6, 1.2);
        scene.add(fill);

        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(MODEL_URL);
        if (disposed) return;

        const model = gltf.scene;
        // Frame the model from its own bounds so a different download still fits.
        const box = new THREE.Box3().setFromObject(model);
        const sphere = box.getBoundingSphere(new THREE.Sphere());
        // The toon sculpt ships in centimetres, so normalise it to a unit
        // sphere; otherwise the camera ends up past its far plane.
        const distance = 1 / Math.sin((camera.fov * Math.PI) / 360);

        const turntable = new THREE.Group();
        turntable.add(model);
        // Centre the sculpt so the turntable spins around its own middle
        // instead of swinging it around the origin.
        const centre = box.getCenter(new THREE.Vector3());
        model.position.sub(centre);
        turntable.scale.setScalar(1 / sphere.radius);
        scene.add(turntable);

        // The rig's only clip is a walk loop; playing it keeps the sculpt in a
        // natural stance instead of whatever pose it was bound in.
        const clip = gltf.animations[0];
        const mixer = clip ? new THREE.AnimationMixer(model) : null;
        if (clip && mixer) {
          mixer.clipAction(clip).play();
          mixer.setTime(0);
        }

        // Keep a little air around the sculpt; 1.0 exactly touches the edges.
        const framed = distance * 1.12;
        // Look slightly down at the cat so the profile reads.
        camera.position.set(framed * 0.55, framed * 0.18, framed * 0.9);
        camera.lookAt(0, 0, 0);
        // Start on a three-quarter view rather than dead-on at the face.
        turntable.rotation.y = -0.85;

        let last = performance.now();
        const render = (now: number) => {
          const dt = Math.min(0.05, (now - last) / 1000);
          last = now;
          if (!still) {
            turntable.rotation.y += dt * 0.45;
            mixer?.update(dt);
          }
          renderer.render(scene, camera);
          frame = requestAnimationFrame(render);
        };
        renderer.render(scene, camera);
        frame = requestAnimationFrame(render);
        // Exposed for the offline/visual checks; it holds no player data.
        (window as unknown as { __sp3d?: unknown }).__sp3d = { box: { min: box.min.toArray(), max: box.max.toArray() }, sphere: { radius: sphere.radius, centre: sphere.center.toArray() }, distance: framed, camera: camera.position.toArray() };
        setState('ready');
        readyRef.current?.();

        cleanupViewer = () => {
          cancelAnimationFrame(frame);
          renderer.dispose();
          scene.traverse((obj) => {
            const mesh = obj as unknown as { geometry?: { dispose?: () => void }; material?: unknown };
            mesh.geometry?.dispose?.();
            const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
            for (const material of materials as Array<{ dispose?: () => void }>) material.dispose?.();
          });
          renderer.domElement.remove();
        };
      } catch {
        // No WebGL, a blocked download or a broken file: the parent keeps the
        // 2D sprite visible, so this only removes the extra layer.
        if (!disposed) setState('failed');
      }
    };

    void boot();
    return () => {
      disposed = true;
      cleanupViewer?.();
    };
  }, [size]);

  return (
    <div
      ref={hostRef}
      className={`${className ?? ''} transition-opacity duration-500 ${state === 'ready' ? 'opacity-100' : 'opacity-0'}`}
      style={{ width: size, height: size, maxWidth: '100%' }}
      aria-hidden="true"
    />
  );
};

export default Cat3DPreview;
