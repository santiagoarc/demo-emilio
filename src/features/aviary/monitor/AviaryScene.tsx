"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Box, Minus, Plus, RotateCcw } from "lucide-react";
import {
  FOOTPRINT,
  INNER_RATIO,
  LEVEL_BY_ID,
  MONITOR_ZONES,
  MONITOR_ZONE_BY_ID,
  type AviaryTree,
  type LevelId,
  type MonitorZone,
  type Vec3,
} from "@/domain/aviaryTracking";
import { LAGOON, WATERFALL_POOL, type STRUCTURES } from "@/data/aviaryTrackingSimulate";
import { hashSeed, mulberry32 } from "@/logic/rng";
import { cx } from "@/components/ui/primitives";

/**
 * Markers keep the same size on screen at any zoom, like the penguin map dots.
 * MARK is the share of the view height (perspective); LIFT floats them just above the point.
 */
const MARK = 0.026;
const LIFT = 0.4;

/** Round dot in one colour with a thin white edge, drawn once per colour. */
function dotTexture(color: string, cache: Map<string, THREE.CanvasTexture>) {
  const hit = cache.get(color);
  if (hit) return hit;
  const S = 64;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(3,16,28,0.55)";
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = color;
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 9, 0, Math.PI * 2);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(color, tex);
  return tex;
}


export interface ScenePoint {
  id: string;
  pos: Vec3;
  /** Dot colour: the colour of the bird's species. */
  color: string;
  dim: boolean;
  label: string;
}

export interface SceneLayers {
  zones: boolean;
  labels: boolean;
  dome: boolean;
}

export const DEFAULT_SCENE_LAYERS: SceneLayers = { zones: true, labels: true, dome: true };

export interface AviarySceneProps {
  trees: AviaryTree[];
  structures: typeof STRUCTURES;
  points: ScenePoint[];
  selectedBirdId: string | null;
  selectedTreeId: string | null;
  /** Zones to emphasise (filter, or the zone of a zone-only bird). */
  highlightZoneId: string | null;
  /** Uncertainty sphere around the selected bird. */
  precision: { pos: Vec3; r: number } | null;
  trail: Vec3[] | null;
  level: LevelId | "all";
  mode: "3d" | "2d";
  /** Change `key` to fly the camera to `pos`. */
  focus: { pos: Vec3; key: number } | null;
  dimTrees: boolean;
  /** Glide markers to their new position instead of jumping. */
  smooth?: boolean;
  layers?: SceneLayers;
  onSelectBird: (id: string) => void;
  onSelectTree: (id: string) => void;
  onSelectZone: (id: string) => void;
}

/* ---------- geometry helpers (shape space: x → x, y → −z) ---------- */

function ellipseShape(rx: number, rz: number, cx = 0, cz = 0) {
  const s = new THREE.Shape();
  s.absellipse(cx, -cz, rx, rz, 0, Math.PI * 2, false, 0);
  return s;
}

function zoneShape(zone: MonitorZone) {
  const { rx, rz } = FOOTPRINT;
  const s = new THREE.Shape();
  if (!zone.sector) {
    s.absellipse(0, 0, rx * INNER_RATIO, rz * INNER_RATIO, 0, Math.PI * 2, false, 0);
    return s;
  }
  const [a0, a1] = zone.sector;
  const pts: [number, number][] = [];
  for (let d = a0; d <= a1 + 0.01; d += 2) pts.push([Math.cos((d * Math.PI) / 180), Math.sin((d * Math.PI) / 180)]);
  pts.forEach(([c, sn], i) => (i ? s.lineTo(c * rx, -sn * rz) : s.moveTo(c * rx, -sn * rz)));
  [...pts].reverse().forEach(([c, sn]) => s.lineTo(c * rx * INNER_RATIO, -sn * rz * INNER_RATIO));
  s.closePath();
  return s;
}

function zoneAnchor(zone: MonitorZone): THREE.Vector3 {
  if (!zone.sector) return new THREE.Vector3(0, 0.5, -LAGOON.rz - 2);
  const mid = (((zone.sector[0] + zone.sector[1]) / 2) * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(mid) * FOOTPRINT.rx * 0.74, 0.5, Math.sin(mid) * FOOTPRINT.rz * 0.74);
}

/** Flat ribbon along an elliptical arc, in world space. */
function ribbon(r: number, width: number, a0: number, a1: number, y: number) {
  const { rx, rz } = FOOTPRINT;
  const pos: number[] = [];
  const idx: number[] = [];
  const steps = Math.max(8, Math.round((a1 - a0) / 2));
  for (let i = 0; i <= steps; i++) {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
    const c = Math.cos(a), sn = Math.sin(a);
    pos.push(c * (rx * r - width / 2), y, sn * (rz * r - width / 2), c * (rx * r + width / 2), y, sn * (rz * r + width / 2));
    if (i) {
      const k = i * 2;
      idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function ringTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.strokeStyle = "#ffffff";
  g.lineWidth = 10;
  g.beginPath();
  g.arc(64, 64, 52, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = "#0b2440";
  g.lineWidth = 4;
  g.beginPath();
  g.arc(64, 64, 52, 0, Math.PI * 2);
  g.stroke();
  return new THREE.CanvasTexture(c);
}

interface Rig {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  persp: THREE.PerspectiveCamera;
  ortho: THREE.OrthographicCamera;
  ctl3: OrbitControls;
  ctl2: OrbitControls;
  markers: THREE.Group;
  pool: THREE.Sprite[];
  spriteMat: (key: string, make: () => THREE.SpriteMaterial) => THREE.SpriteMaterial;
  dotTex: Map<string, THREE.CanvasTexture>;
  treeParts: Map<string, THREE.Mesh[]>;
  zoneFills: Map<string, THREE.Mesh>;
  dome: THREE.Group;
  levelBand: THREE.Group;
  selRing: THREE.Sprite;
  selDrop: THREE.Line;
  precision: THREE.Mesh;
  treeRing: THREE.Mesh;
  trail: THREE.Line;
  zoneEdges: THREE.Object3D[];
  /** Bird markers: shown position glides toward the target position. */
  marks: { ids: string[]; cur: Float32Array; tgt: Float32Array; scale: Float32Array };
  fly: { from: THREE.Vector3; to: THREE.Vector3; camFrom: THREE.Vector3; camTo: THREE.Vector3; t0: number } | null;
}

const HOME_TARGET = new THREE.Vector3(0, 4, 4);
const HOME_CAM = new THREE.Vector3(0, 92, 118);

export function AviaryScene(props: AviarySceneProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const rigRef = useRef<Rig | null>(null);
  const propsRef = useRef(props);
  const tipRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef(props.mode);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    propsRef.current = props;
  });

  /* ---------- build the scene once ---------- */
  useEffect(() => {
    const wrap = wrapRef.current!;
    const { trees, structures } = propsRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    wrap.prepend(renderer.domElement);
    renderer.domElement.className = "block h-full w-full outline-none";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e6efec");
    scene.fog = new THREE.Fog("#e6efec", 170, 320);
    scene.add(new THREE.HemisphereLight("#ffffff", "#8c7d5c", 1.25));
    const sun = new THREE.DirectionalLight("#fff6e6", 1.7);
    sun.position.set(40, 90, 30);
    scene.add(sun);

    const persp = new THREE.PerspectiveCamera(38, 1, 0.5, 600);
    persp.position.copy(HOME_CAM);
    const ortho = new THREE.OrthographicCamera(-60, 60, 40, -40, 0.1, 400);
    ortho.position.set(0, 160, 0);
    ortho.up.set(0, 0, -1);
    ortho.lookAt(0, 0, 0);

    const ctl3 = new OrbitControls(persp, renderer.domElement);
    ctl3.target.copy(HOME_TARGET);
    ctl3.enableDamping = true;
    ctl3.maxPolarAngle = 1.48;
    ctl3.minDistance = 12;
    ctl3.maxDistance = 240;
    const ctl2 = new OrbitControls(ortho, renderer.domElement);
    ctl2.enableRotate = false;
    ctl2.screenSpacePanning = true;
    ctl2.enableDamping = true;
    ctl2.minZoom = 0.6;
    ctl2.maxZoom = 8;
    ctl2.enabled = false;

    const rng = mulberry32(hashSeed("scene-decor", 7));
    const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...extra });
    const flat = (g: THREE.BufferGeometry, y: number) => {
      g.rotateX(-Math.PI / 2);
      g.translate(0, y, 0);
      return g;
    };

    // Terrain slab
    const slab = new THREE.ExtrudeGeometry(ellipseShape(FOOTPRINT.rx + 3, FOOTPRINT.rz + 3), { depth: 3, bevelEnabled: false, curveSegments: 72 });
    slab.rotateX(-Math.PI / 2);
    slab.translate(0, -3.02, 0);
    scene.add(new THREE.Mesh(slab, std("#8f7f62")));
    scene.add(new THREE.Mesh(flat(new THREE.ShapeGeometry(ellipseShape(FOOTPRINT.rx + 3, FOOTPRINT.rz + 3), 72), 0), std("#c9dcb6")));

    // Zones: tint + outline
    const zoneFills = new Map<string, THREE.Mesh>();
    const zoneEdges: THREE.Object3D[] = [];
    for (const z of MONITOR_ZONES) {
      const g = flat(new THREE.ShapeGeometry(zoneShape(z), 24), 0.03);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: z.color, transparent: true, opacity: 0.1, depthWrite: false }));
      m.userData.zoneId = z.id;
      zoneFills.set(z.id, m);
      scene.add(m);
      const edge = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(zoneShape(z).getPoints(24).map((p) => new THREE.Vector3(p.x, 0.06, -p.y))),
        new THREE.LineBasicMaterial({ color: z.color, transparent: true, opacity: 0.45 }),
      );
      zoneEdges.push(edge);
      scene.add(edge);
    }

    // Water
    const water = std("#4aaecb", { roughness: 0.25, metalness: 0.1, flatShading: false });
    scene.add(new THREE.Mesh(flat(new THREE.ShapeGeometry(ellipseShape(LAGOON.rx, LAGOON.rz), 64), 0.08), water));
    scene.add(new THREE.Mesh(flat(new THREE.ShapeGeometry(ellipseShape(WATERFALL_POOL.r, WATERFALL_POOL.r * 0.85, WATERFALL_POOL.x, WATERFALL_POOL.z), 32), 0.08), water));
    scene.add(new THREE.Mesh(flat(new THREE.ShapeGeometry(ellipseShape(6, 4, -30, -22), 32), 0.08), water));
    scene.add(new THREE.Mesh(flat(new THREE.ShapeGeometry(ellipseShape(4.5, 3, -18, -30), 32), 0.08), water));

    // Waterfall cliff
    const rock = std("#8a8f94");
    for (let i = 0; i < 7; i++) {
      const r = 2.5 + rng() * 2.5;
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rock);
      m.position.set(WATERFALL_POOL.x + 6 + rng() * 3, r * 0.6 + (i % 3) * 2.6, WATERFALL_POOL.z - 6 + i * 2);
      m.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      scene.add(m);
    }
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 8), new THREE.MeshBasicMaterial({ color: "#d8f3fb", transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    fall.position.set(WATERFALL_POOL.x + 4.2, 4, WATERFALL_POOL.z);
    fall.rotation.y = Math.PI / 2;
    scene.add(fall);

    // Paths, walkway and platform
    const path = std("#dcc9a2");
    scene.add(new THREE.Mesh(ribbon(0.445, 2.6, 0, 360, 0.1), path));
    const entry = new THREE.Mesh(new THREE.BoxGeometry(FOOTPRINT.rx * (1 - 0.445) + 3, 0.08, 2.6), path);
    entry.position.set(-(FOOTPRINT.rx * 0.445 + (FOOTPRINT.rx * (1 - 0.445) + 3) / 2), 0.1, 0);
    scene.add(entry);
    const wood = std("#a5835a");
    for (const st of structures) {
      if (st.kind === "walkway") {
        scene.add(new THREE.Mesh(ribbon(0.7, 2.2, 238, 302, st.heightM), wood));
        for (let a = 240; a <= 300; a += 6) {
          const r = (a * Math.PI) / 180;
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, st.heightM, 6), wood);
          post.position.set(Math.cos(r) * FOOTPRINT.rx * 0.7, st.heightM / 2, Math.sin(r) * FOOTPRINT.rz * 0.7);
          scene.add(post);
        }
      } else {
        const deck = new THREE.Mesh(new THREE.BoxGeometry(9, 0.4, 4), wood);
        deck.position.set(st.x, st.heightM, st.z);
        scene.add(deck);
        for (const [dx, dz] of [[-4, -1.6], [4, -1.6], [-4, 1.6], [4, 1.6]]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, st.heightM, 6), wood);
          post.position.set(st.x + dx, st.heightM / 2, st.z + dz);
          scene.add(post);
        }
      }
    }

    // Undergrowth (decor only)
    const shrubGeo = new THREE.IcosahedronGeometry(1, 0);
    const shrubs = new THREE.InstancedMesh(shrubGeo, std("#5f9e58"), 170);
    const m4 = new THREE.Matrix4();
    let n = 0;
    for (let tries = 0; n < 170 && tries < 3000; tries++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(0.12 + rng() * 0.85);
      const x = Math.cos(a) * r * FOOTPRINT.rx, z = Math.sin(a) * r * FOOTPRINT.rz;
      if ((x / LAGOON.rx) ** 2 + (z / LAGOON.rz) ** 2 < 1.2) continue;
      if (Math.abs(Math.hypot(x / FOOTPRINT.rx, z / FOOTPRINT.rz) - 0.445) < 0.04) continue;
      if (x < -30 && Math.abs(z) < 3) continue;
      const s = 0.9 + rng() * 1.3;
      m4.compose(new THREE.Vector3(x, s * 0.45, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rng() * 6, 0)), new THREE.Vector3(s, s * 0.7, s));
      shrubs.setMatrixAt(n++, m4);
    }
    shrubs.count = n;
    scene.add(shrubs);

    // Trees
    const treeParts = new Map<string, THREE.Mesh[]>();
    const trunkGeo = new THREE.CylinderGeometry(0.32, 0.55, 1, 7);
    const crownGeo = new THREE.IcosahedronGeometry(1, 1);
    const frondGeo = new THREE.ConeGeometry(0.6, 1, 4);
    for (const t of trees) {
      const tr = mulberry32(hashSeed(t.id, 3));
      const green = new THREE.Color().setHSL(0.3 + tr() * 0.06, 0.42, 0.34 + tr() * 0.1);
      const crownMat = std(`#${green.getHexString()}`, { transparent: true });
      const trunkMat = std("#7a5b3d", { transparent: true });
      const parts: THREE.Mesh[] = [];
      const add = (m: THREE.Mesh) => {
        m.userData.treeId = t.id;
        parts.push(m);
        scene.add(m);
      };
      const trunkH = t.form === "palm" ? t.heightM - 0.6 : t.heightM * 0.7;
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.scale.set(t.form === "palm" ? 0.7 : 1 + t.heightM / 30, trunkH, t.form === "palm" ? 0.7 : 1 + t.heightM / 30);
      trunk.position.set(t.x, trunkH / 2, t.z);
      add(trunk);
      if (t.form === "palm") {
        for (let k = 0; k < 7; k++) {
          const f = new THREE.Mesh(frondGeo, crownMat);
          const a = (k / 7) * Math.PI * 2;
          f.scale.set(1, t.crownRadiusM * 1.1, 0.25);
          f.position.set(t.x + Math.cos(a) * t.crownRadiusM * 0.45, t.heightM - 0.5, t.z + Math.sin(a) * t.crownRadiusM * 0.45);
          f.rotation.set(0, -a, 0);
          f.rotateZ(-Math.PI / 2 + 0.35);
          add(f);
        }
      } else {
        // Crown blobs at the branch tiers. The tiers are schematic.
        const tiers = t.branchTiersM.slice(-3);
        tiers.forEach((h, k) => {
          const r = t.crownRadiusM * (k === tiers.length - 1 ? 0.95 : 0.7);
          const blob = new THREE.Mesh(crownGeo, crownMat);
          const a = tr() * Math.PI * 2;
          const off = k === tiers.length - 1 ? 0 : t.crownRadiusM * 0.35;
          blob.position.set(t.x + Math.cos(a) * off, Math.min(t.heightM - r * 0.5, h + r * 0.15), t.z + Math.sin(a) * off);
          blob.scale.set(r, r * 0.62, r);
          add(blob);
        });
      }
      treeParts.set(t.id, parts);
    }

    // Dome (conceptual enclosure)
    const dome = new THREE.Group();
    const domeGeo = new THREE.SphereGeometry(1, 40, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const lattice = new THREE.Mesh(domeGeo, new THREE.MeshBasicMaterial({ color: "#45667a", wireframe: true, transparent: true, opacity: 0.14, depthWrite: false }));
    const glass = new THREE.Mesh(domeGeo, new THREE.MeshBasicMaterial({ color: "#bfe3f0", transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false }));
    for (const m of [lattice, glass]) {
      m.scale.set(FOOTPRINT.rx + 3, FOOTPRINT.domeHeight, FOOTPRINT.rz + 3);
      dome.add(m);
    }
    scene.add(dome);

    // Level band (shown when a level is chosen)
    const levelBand = new THREE.Group();
    const bandGeo = flat(new THREE.ShapeGeometry(ellipseShape(FOOTPRINT.rx, FOOTPRINT.rz), 64), 0);
    for (let k = 0; k < 2; k++) {
      const m = new THREE.Mesh(bandGeo, new THREE.MeshBasicMaterial({ color: "#0891b2", transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }));
      levelBand.add(m);
      const edge = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(ellipseShape(FOOTPRINT.rx, FOOTPRINT.rz).getPoints(64).map((p) => new THREE.Vector3(p.x, 0, -p.y))),
        new THREE.LineBasicMaterial({ color: "#0891b2", transparent: true, opacity: 0.55 }),
      );
      m.add(edge);
    }
    levelBand.visible = false;
    scene.add(levelBand);

    // Birds: always drawn on top of foliage so they stay visible.
    // Birds: species-image sprites, always drawn over the foliage so they stay visible.
    const markers = new THREE.Group();
    scene.add(markers);
    const mats = new Map<string, THREE.SpriteMaterial>();
    const spriteMat = (key: string, make: () => THREE.SpriteMaterial) => {
      let m = mats.get(key);
      if (!m) mats.set(key, (m = make()));
      return m;
    };

    const selRing = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTexture(), depthTest: false, transparent: true, sizeAttenuation: false }));
    selRing.renderOrder = 12;
    selRing.visible = false;
    scene.add(selRing);
    const selDrop = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: "#0b2440", dashSize: 0.6, gapSize: 0.4, depthTest: false }));
    selDrop.renderOrder = 11;
    selDrop.visible = false;
    scene.add(selDrop);
    const precision = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: "#2563eb", transparent: true, opacity: 0.16, depthWrite: false, depthTest: false }));
    precision.renderOrder = 9;
    precision.visible = false;
    scene.add(precision);
    const treeRing = new THREE.Mesh(flat(new THREE.RingGeometry(0.92, 1, 48), 0), new THREE.MeshBasicMaterial({ color: "#0e9f95", transparent: true, opacity: 0.9, depthWrite: false }));
    treeRing.position.y = 0.15;
    treeRing.visible = false;
    scene.add(treeRing);
    const trail = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: "#2563eb", transparent: true, opacity: 0.85, depthTest: false }));
    trail.renderOrder = 8;
    trail.visible = false;
    scene.add(trail);

    const rig: Rig = { renderer, scene, persp, ortho, ctl3, ctl2, markers, pool: [], spriteMat, dotTex: new Map(), treeParts, zoneFills, dome, levelBand, selRing, selDrop, precision, treeRing, trail, zoneEdges, marks: { ids: [], cur: new Float32Array(0), tgt: new Float32Array(0), scale: new Float32Array(0) }, fly: null };
    rigRef.current = rig;

    // Size
    const resize = () => {
      const w = wrap.clientWidth, h = wrap.clientHeight;
      renderer.setSize(w, h, false);
      persp.aspect = w / Math.max(1, h);
      persp.updateProjectionMatrix();
      const half = Math.max(FOOTPRINT.rz + 6, (FOOTPRINT.rx + 6) / (w / Math.max(1, h)));
      ortho.top = half;
      ortho.bottom = -half;
      ortho.left = -half * (w / Math.max(1, h));
      ortho.right = half * (w / Math.max(1, h));
      ortho.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    // Loop: controls, fly-to, HTML labels
    const v = new THREE.Vector3();
    const dropPos = selDrop.geometry.getAttribute("position") as THREE.BufferAttribute;
    let lastT = 0;
    renderer.setAnimationLoop((time) => {
      const p = propsRef.current;
      // Markers glide toward their latest position (time constant ~0.35 s).
      const dt = lastT ? Math.min(100, time - lastT) : 16;
      lastT = time;
      const k = p.smooth === false ? 1 : 1 - Math.exp(-dt / 350);
      const { ids, cur, tgt, scale } = rig.marks;
      // Perspective: size as a share of the view. Orthographic has no distance, so convert to metres.
      const unit = p.mode === "2d" ? MARK * ((ortho.top - ortho.bottom) / ortho.zoom) : MARK * 2 * Math.tan(((persp.fov / 2) * Math.PI) / 180);
      selRing.scale.setScalar(unit * 2.6);
      let selIdx = -1;
      for (let i = 0; i < ids.length; i++) {
        const o = i * 3;
        cur[o] += (tgt[o] - cur[o]) * k;
        cur[o + 1] += (tgt[o + 1] - cur[o + 1]) * k;
        cur[o + 2] += (tgt[o + 2] - cur[o + 2]) * k;
        const mk = rig.pool[i];
        mk.position.set(cur[o], cur[o + 1] + LIFT, cur[o + 2]);
        const sz = unit * scale[i];
        mk.scale.set(sz, sz, 1);
        if (ids[i] === p.selectedBirdId) selIdx = i;
      }
      if (selIdx >= 0) {
        const o = selIdx * 3;
        selRing.position.set(cur[o], cur[o + 1] + LIFT, cur[o + 2]);
        dropPos.setXYZ(0, cur[o], cur[o + 1] + LIFT, cur[o + 2]);
        dropPos.setXYZ(1, cur[o], 0.1, cur[o + 2]);
        dropPos.needsUpdate = true;
        selDrop.computeLineDistances();
        if (precision.visible) precision.position.set(cur[o], cur[o + 1] + 0.4, cur[o + 2]);
        const lbl = wrap.querySelector<HTMLElement>("[data-follow]");
        if (lbl) {
          lbl.dataset.x = String(cur[o]);
          lbl.dataset.y = String(cur[o + 1] + LIFT);
          lbl.dataset.z = String(cur[o + 2]);
        }
      }
      const cam = p.mode === "2d" ? ortho : persp;
      const ctl = p.mode === "2d" ? ctl2 : ctl3;
      if (rig.fly) {
        const k = Math.min(1, (time - rig.fly.t0) / 700);
        const e = 1 - (1 - k) ** 3;
        ctl.target.lerpVectors(rig.fly.from, rig.fly.to, e);
        cam.position.lerpVectors(rig.fly.camFrom, rig.fly.camTo, e);
        if (k >= 1) rig.fly = null;
      }
      ctl.update();
      renderer.render(scene, cam);
      const w = wrap.clientWidth, h = wrap.clientHeight;
      wrap.querySelectorAll<HTMLElement>("[data-x]").forEach((el) => {
        v.set(+el.dataset.x!, +el.dataset.y!, +el.dataset.z!).project(cam);
        const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
        el.style.opacity = visible ? "" : "0";
        el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h + Number(el.dataset.dy ?? 0)}px) translate(-50%, -50%)`;
      });
    });

    // Picking: birds in screen space (they are small), trees by raycast.
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pick = (cx: number, cy: number): { type: "bird" | "tree"; id: string; label: string } | null => {
      const p = propsRef.current;
      const cam = p.mode === "2d" ? ortho : persp;
      const rect = renderer.domElement.getBoundingClientRect();
      const x = cx - rect.left, y = cy - rect.top;
      let best: ScenePoint | null = null;
      let bestD = 16;
      for (const pt of p.points) {
        v.set(pt.pos.x, pt.pos.y + LIFT, pt.pos.z).project(cam);
        if (v.z > 1) continue;
        const d = Math.hypot(((v.x + 1) / 2) * rect.width - x, ((1 - v.y) / 2) * rect.height - y) - (pt.dim ? 3 : 0);
        if (d < bestD) {
          bestD = d;
          best = pt;
        }
      }
      if (best) return { type: "bird", id: best.id, label: best.label };
      ndc.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, cam);
      const hit = ray.intersectObjects([...treeParts.values()].flat(), false)[0];
      if (hit) {
        const t = p.trees.find((tt) => tt.id === hit.object.userData.treeId);
        if (t) return { type: "tree", id: t.id, label: `${t.id} · ${t.heightM.toFixed(1)} m` };
      }
      return null;
    };

    const el = renderer.domElement;
    let down: { x: number; y: number } | null = null;
    let hoverQueued = false;
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      down = null;
      const hit = pick(e.clientX, e.clientY);
      if (hit?.type === "bird") propsRef.current.onSelectBird(hit.id);
      else if (hit?.type === "tree") propsRef.current.onSelectTree(hit.id);
    };
    const onMove = (e: PointerEvent) => {
      if (hoverQueued || e.buttons) return;
      hoverQueued = true;
      requestAnimationFrame(() => {
        hoverQueued = false;
        const hit = pick(e.clientX, e.clientY);
        el.style.cursor = hit ? "pointer" : "grab";
        const tip = tipRef.current;
        if (!tip) return;
        if (!hit) {
          tip.style.opacity = "0";
          return;
        }
        const rect = el.getBoundingClientRect();
        tip.textContent = hit.label;
        tip.style.opacity = "1";
        tip.style.transform = `translate(${e.clientX - rect.left + 12}px, ${e.clientY - rect.top + 12}px)`;
      });
    };
    const onLeave = () => tipRef.current && (tipRef.current.style.opacity = "0");
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    // Plain wheel scrolls the page; Ctrl/⌘ + wheel zooms the map (caught before OrbitControls sees it).
    let hintTimer = 0;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      e.stopPropagation();
      const hint = hintRef.current;
      if (!hint) return;
      hint.style.opacity = "1";
      window.clearTimeout(hintTimer);
      hintTimer = window.setTimeout(() => (hint.style.opacity = "0"), 1200);
    };
    wrap.addEventListener("wheel", onWheel, { capture: true });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);

    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      wrap.removeEventListener("wheel", onWheel, { capture: true });
      window.clearTimeout(hintTimer);
      ro.disconnect();
      renderer.setAnimationLoop(null);
      ctl3.dispose();
      ctl2.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((mm) => {
          (mm as THREE.MeshBasicMaterial).map?.dispose();
          mm.dispose();
        });
      });
      renderer.dispose();
      el.remove();
      rigRef.current = null;
    };
  }, []);

  /* ---------- birds ---------- */
  const { points, selectedBirdId } = props;
  useEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    // Keep each bird's shown position so it glides from where it was; new birds appear in place.
    const prev = rig.marks;
    const prevIdx = new Map(prev.ids.map((id, i) => [id, i]));
    const n = points.length;
    const cur = new Float32Array(n * 3);
    const tgt = new Float32Array(n * 3);
    const scale = new Float32Array(n);
    points.forEach((p, i) => {
      tgt.set([p.pos.x, p.pos.y, p.pos.z], i * 3);
      const j = prevIdx.get(p.id);
      cur.set(j === undefined ? [p.pos.x, p.pos.y, p.pos.z] : prev.cur.subarray(j * 3, j * 3 + 3), i * 3);
      scale[i] = p.id === selectedBirdId ? 1.6 : p.dim ? 0.6 : 1;
      while (rig.pool.length <= i) {
        const dot = new THREE.Sprite();
        rig.markers.add(dot);
        rig.pool.push(dot);
      }
      const mk = rig.pool[i];
      mk.material = rig.spriteMat(`${p.color}:${p.dim ? "d" : ""}`, () => new THREE.SpriteMaterial({ map: dotTexture(p.color, rig.dotTex), depthTest: false, transparent: true, sizeAttenuation: false, opacity: p.dim ? 0.22 : 1 }));
      mk.renderOrder = p.id === selectedBirdId ? 15 : p.dim ? 9 : 11;
      mk.visible = true;
      if (j === undefined) mk.position.set(p.pos.x, p.pos.y + LIFT, p.pos.z);
    });
    for (let i = n; i < rig.pool.length; i++) rig.pool[i].visible = false;
    rig.marks = { ids: points.map((p) => p.id), cur, tgt, scale };
    const sel = points.some((p) => p.id === selectedBirdId);
    rig.selRing.visible = rig.selDrop.visible = sel;
  }, [points, selectedBirdId, ready]);

  /* ---------- selection overlays ---------- */
  const { precision, trail, selectedTreeId, highlightZoneId, trees, dimTrees, level, mode } = props;
  const layers = props.layers ?? DEFAULT_SCENE_LAYERS;
  useEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    rig.precision.visible = !!precision;
    if (precision) {
      rig.precision.position.set(precision.pos.x, precision.pos.y + 0.4, precision.pos.z);
      rig.precision.scale.setScalar(Math.max(0.6, precision.r));
    }
    rig.trail.visible = !!trail && trail.length > 1;
    if (trail && trail.length > 1) rig.trail.geometry.setFromPoints(trail.map((p) => new THREE.Vector3(p.x, p.y + 0.4, p.z)));
  }, [precision, trail, ready]);

  useEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    const tree = trees.find((t) => t.id === selectedTreeId);
    rig.treeRing.visible = !!tree;
    if (tree) {
      rig.treeRing.position.set(tree.x, 0.15, tree.z);
      rig.treeRing.scale.set(tree.crownRadiusM + 1, 1, tree.crownRadiusM + 1);
    }
    rig.treeParts.forEach((parts, id) => {
      const on = id === selectedTreeId;
      for (const mesh of parts) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissive.set(on ? "#0e9f95" : "#000000");
        mat.emissiveIntensity = on ? 0.35 : 0;
        mat.opacity = on || !dimTrees ? 1 : 0.35;
        mat.depthWrite = mat.opacity === 1;
      }
    });
  }, [selectedTreeId, trees, dimTrees, ready]);

  useEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    rig.zoneFills.forEach((m, id) => ((m.material as THREE.MeshBasicMaterial).opacity = id === highlightZoneId ? 0.42 : highlightZoneId ? 0.05 : 0.1));
  }, [highlightZoneId, ready]);

  useEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    rig.levelBand.visible = level !== "all";
    if (level !== "all") {
      const L = LEVEL_BY_ID[level];
      const [lo, hi] = [Math.max(0.05, L.min === -Infinity ? 0.05 : L.min), Math.min(FOOTPRINT.domeHeight, L.max === Infinity ? FOOTPRINT.domeHeight : L.max)];
      rig.levelBand.children[0].position.y = lo;
      rig.levelBand.children[1].position.y = level === "ground" ? 0.5 : hi;
      rig.levelBand.children.forEach((c) => (((c as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(L.color)));
    }
  }, [level, ready]);

  useEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    rig.ctl3.enabled = mode === "3d";
    rig.ctl2.enabled = mode === "2d";
    // Switching 2D/3D cancels a fly-to of the other camera; the first run must not.
    if (modeRef.current !== mode) rig.fly = null;
    modeRef.current = mode;
  }, [mode, ready]);

  useEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    rig.dome.visible = mode === "3d" && layers.dome;
    rig.zoneFills.forEach((m) => (m.visible = layers.zones));
    rig.zoneEdges.forEach((e) => (e.visible = layers.zones));
  }, [mode, layers.dome, layers.zones, ready]);

  /* ---------- fly-to ---------- */
  const { focus } = props;
  useEffect(() => {
    const rig = rigRef.current;
    if (!rig || !focus) return;
    const to = new THREE.Vector3(focus.pos.x, focus.pos.y, focus.pos.z);
    if (propsRef.current.mode === "2d") {
      rig.ortho.zoom = Math.max(rig.ortho.zoom, 2.2);
      rig.ortho.updateProjectionMatrix();
      rig.fly = { from: rig.ctl2.target.clone(), to: new THREE.Vector3(to.x, 0, to.z), camFrom: rig.ortho.position.clone(), camTo: new THREE.Vector3(to.x, 160, to.z), t0: performance.now() };
    } else {
      const dir = rig.persp.position.clone().sub(rig.ctl3.target).normalize();
      rig.fly = { from: rig.ctl3.target.clone(), to, camFrom: rig.persp.position.clone(), camTo: to.clone().add(dir.multiplyScalar(68)), t0: performance.now() };
    }
  }, [focus]);

  const zoom = (f: number) => {
    const rig = rigRef.current;
    if (!rig) return;
    if (mode === "2d") {
      rig.ortho.zoom = THREE.MathUtils.clamp(rig.ortho.zoom * f, 0.6, 8);
      rig.ortho.updateProjectionMatrix();
    } else {
      const off = rig.persp.position.clone().sub(rig.ctl3.target);
      const len = THREE.MathUtils.clamp(off.length() / f, 12, 240);
      rig.persp.position.copy(rig.ctl3.target).add(off.setLength(len));
    }
  };
  const reset = () => {
    const rig = rigRef.current;
    if (!rig) return;
    if (mode === "2d") {
      rig.ortho.zoom = 1;
      rig.ortho.updateProjectionMatrix();
      rig.fly = { from: rig.ctl2.target.clone(), to: new THREE.Vector3(), camFrom: rig.ortho.position.clone(), camTo: new THREE.Vector3(0, 160, 0), t0: performance.now() };
    } else {
      rig.fly = { from: rig.ctl3.target.clone(), to: HOME_TARGET.clone(), camFrom: rig.persp.position.clone(), camTo: HOME_CAM.clone(), t0: performance.now() };
    }
  };

  const selBird = points.find((p) => p.id === selectedBirdId);
  const selTree = trees.find((t) => t.id === selectedTreeId);

  return (
    <div ref={wrapRef} className="relative h-full w-full touch-none overflow-hidden" role="application" aria-label="Interactive aviary map. Drag to rotate, scroll to zoom, click a bird or a tree to open its details.">
      {/* Labels are kept to zone codes; details open on selection. */}
      <div className="pointer-events-none absolute inset-0">
        {layers.labels && MONITOR_ZONES.map((z) => {
          const a = zoneAnchor(z);
          return (
            <button
              key={z.id}
             
              data-x={a.x}
              data-y={a.y}
              data-z={a.z}
              onClick={() => props.onSelectZone(z.id)}
              title={`${z.code} · ${z.name}`}
              className={cx(
                "pointer-events-auto absolute left-0 top-0 rounded-md border bg-panel-solid/90 px-1.5 py-0.5 text-[10px] font-semibold shadow-sm backdrop-blur transition-opacity hover:bg-panel-solid",
                highlightZoneId === z.id ? "border-ink/40 text-ink" : "border-line-strong text-muted",
              )}
              style={{ borderLeft: `3px solid ${z.color}` }}
            >
              {z.code}
              <span className={cx("ml-1 font-medium", highlightZoneId === z.id ? "inline" : "hidden xl:inline")}>{z.name}</span>
            </button>
          );
        })}
        {selTree && (
          <span key={`tree-${selTree.id}`} data-x={selTree.x} data-y={selTree.heightM + 1.5} data-z={selTree.z} className="absolute left-0 top-0 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
            {selTree.id}
          </span>
        )}
        {selBird && (
          <span key={`bird-${selBird.id}`} data-follow data-dy={-30} data-x={selBird.pos.x} data-y={selBird.pos.y} data-z={selBird.pos.z} className="absolute left-0 top-0 rounded-md bg-panel-solid px-1.5 py-0.5 text-[10px] font-semibold text-ink shadow ring-1 ring-line-strong">
            {selBird.id}
          </span>
        )}
        <div ref={hintRef} className="absolute inset-0 grid place-items-center bg-ink/25 text-sm font-medium text-white opacity-0 transition-opacity">Use Ctrl + scroll to zoom the map</div>
        <div ref={tipRef} className="absolute left-0 top-0 rounded-md bg-ink/90 px-2 py-1 text-[11px] text-white opacity-0 shadow transition-opacity" />
      </div>

      <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-xl border border-line-strong bg-panel-solid/90 shadow-sm backdrop-blur">
        <button onClick={() => zoom(1.25)} className="grid h-9 w-9 place-items-center text-muted hover:bg-ink/5 hover:text-ink" aria-label="Zoom in"><Plus size={16} /></button>
        <button onClick={() => zoom(0.8)} className="grid h-9 w-9 place-items-center border-t border-line text-muted hover:bg-ink/5 hover:text-ink" aria-label="Zoom out"><Minus size={16} /></button>
        <button onClick={reset} className="grid h-9 w-9 place-items-center border-t border-line text-muted hover:bg-ink/5 hover:text-ink" aria-label="Reset view"><RotateCcw size={15} /></button>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-panel-solid/85 px-2 py-1 text-[10px] text-muted shadow-sm backdrop-blur">
        <Box size={12} /> {FOOTPRINT.label} · {mode === "3d" ? "drag to rotate · Ctrl + scroll to zoom · right-drag to pan" : "drag to pan · Ctrl + scroll to zoom"}
      </div>
      {highlightZoneId && <span className="sr-only">Zone {MONITOR_ZONE_BY_ID[highlightZoneId]?.name} highlighted</span>}
    </div>
  );
}
