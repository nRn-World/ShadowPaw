// Named exports keep the optional 3D shop chunk tree-shakeable. Importing the
// whole `three` namespace would retain the entire library even though the shop
// only needs this small set of scene primitives.
export {
  AnimationMixer,
  Box3,
  CircleGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  RingGeometry,
  SRGBColorSpace,
  Scene,
  Sphere,
  Vector3,
  WebGLRenderer,
} from 'three';
