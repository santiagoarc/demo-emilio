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
import { GREAT_TREE, PAVILIONS, PLATFORMS, ROCKS, WALKWAYS, WATER, WATERFALLS, distToWalkways, nearPavilion, nearRocks, nearWater, type XZ } from "@/domain/aviaryLayout";
import { hashSeed, mulberry32 } from "@/logic/rng";
import { cx } from "@/components/ui/primitives";

/**
 * The demo aviary in three.js, built from the layout in aviaryLayout.ts. The
 * 3D view (perspective, oblique) and the top view (orthographic, from above)
 * render the same scene, so every tree and feature matches between them.
 *
 * Birds are small dots in their species colour. Dots that overlap on screen
 * fold into a counter, which splits as the camera gets closer.
 */

export interface ScenePoint {
  id: string;
  pos: Vec3;
  /** Species colour. */
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
  points: ScenePoint[];
  selectedBirdId: string | null;
  selectedTreeId: string | null;
  /** Zone to emphasise (filter, or the zone of a zone-only bird). */
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
  /** Fold dots that overlap on screen into a counter; they split when zooming in. */
  cluster?: boolean;
  onSelectBird: (id: string) => void;
  onSelectTree: (id: string) => void;
  onSelectZone: (id: string) => void;
  /** Birds that still overlap at the closest zoom (same estimated spot). */
  onSelectGroup?: (ids: string[]) => void;
}

/** Dot size as a share of the view height, and how far above the point it floats. */
const MARK = 0.017;
const LIFT = 0.3;
/** Screen cell (px) inside which nearby dots are grouped. */
const CLUSTER_CELL = 22;
/** Trees show their ID once the camera is this close (3D) or zoomed this far (2D). */
const TREE_LABEL_DIST = 85;
const TREE_LABEL_ZOOM = 1.7;
/** Closest the camera gets; at this distance a group can no longer be split by zooming. */
const MIN_DIST = 12;

const HOME_TARGET = new THREE.Vector3(0, 2, 4);
const HOME_CAM = new THREE.Vector3(0, 104, 118);

/* ---------- textures ---------- */

/** Round dot in one colour with a thin white edge and a dark outline. */
function dotTexture(color: string, cache: Map<string, THREE.CanvasTexture>) {
  const hit = cache.get(color);
  if (hit) return hit;
  const S = 64;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(3,16,28,0.6)";
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = color;
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 10, 0, Math.PI * 2);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(color, tex);
  return tex;
}

/** Counter for dots that overlap on screen. */
function clusterTexture(label: string, cache: Map<string, THREE.CanvasTexture>) {
  const key = `c:${label}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const S = 96;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.strokeStyle = "#0b2440";
  g.lineWidth = 5;
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 5, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = "#0b2440";
  g.font = `700 ${label.length > 2 ? 30 : 38}px system-ui, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(label, S / 2, S / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

function ringTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.strokeStyle = "#ffffff";
  g.lineWidth = 12;
  g.beginPath();
  g.arc(64, 64, 50, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = "#0b2440";
  g.lineWidth = 5;
  g.beginPath();
  g.arc(64, 64, 50, 0, Math.PI * 2);
  g.stroke();
  return new THREE.CanvasTexture(c);
}

/* ---------- geometry helpers (shape space: x → x, y → −z) ---------- */

function ellipseShape(rx: number, rz: number, cx = 0, cz = 0) {
  const s = new THREE.Shape();
  s.absellipse(cx, -cz, rx, rz, 0, Math.PI * 2, false, 0);
  return s;
}

/** Smooth closed outline through plan points (optionally grown around its centre). */
function smoothShape(outline: XZ[], scale = 1) {
  const cx = outline.reduce((a, p) => a + p[0], 0) / outline.length;
  const cz = outline.reduce((a, p) => a + p[1], 0) / outline.length;
  const pts = outline.map(([x, z]) => new THREE.Vector2(cx + (x - cx) * scale, -(cz + (z - cz) * scale)));
  const curve = new THREE.SplineCurve([...pts, pts[0], pts[1]]);
  const all = curve.getPoints((outline.length + 2) * 10);
  return new THREE.Shape(all.slice(0, all.length - 20));
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
  if (!zone.sector) return new THREE.Vector3(GREAT_TREE.x - 9, 0.5, GREAT_TREE.z + 9);
  const mid = (((zone.sector[0] + zone.sector[1]) / 2) * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(mid) * FOOTPRINT.rx * 0.8, 0.5, Math.sin(mid) * FOOTPRINT.rz * 0.8);
}

/** Smooth 3D path through plan points at a height. */
function pathCurve(path: XZ[], y: number) {
  return new THREE.CatmullRomCurve3(path.map(([x, z]) => new THREE.Vector3(x, y, z)), false, "centripetal");
}

/** Flat strip along a curve (boardwalk deck). */
function deckGeometry(curve: THREE.CatmullRomCurve3, width: number) {
  const n = Math.max(16, Math.round(curve.getLength() * 1.5));
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const nx = -tan.z, nz = tan.x;
    const l = Math.hypot(nx, nz) || 1;
    pos.push(p.x + (nx / l) * (width / 2), p.y, p.z + (nz / l) * (width / 2), p.x - (nx / l) * (width / 2), p.y, p.z - (nz / l) * (width / 2));
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

/** Geodesic hemisphere: icosphere triangles above the ground. */
function geodesicDome() {
  const ico = new THREE.IcosahedronGeometry(1, 4).toNonIndexed();
  const p = ico.getAttribute("position");
  const keep: number[] = [];
  for (let i = 0; i < p.count; i += 3) {
    if (p.getY(i) >= -0.02 && p.getY(i + 1) >= -0.02 && p.getY(i + 2) >= -0.02) for (let k = 0; k < 3; k++) keep.push(p.getX(i + k), p.getY(i + k), p.getZ(i + k));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(keep, 3));
  ico.dispose();
  return g;
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
  clusterPool: THREE.Sprite[];
  /** Groups shown in the last frame, in screen pixels, for picking. */
  clusters: { sx: number; sy: number; pos: Vec3; ids: string[] }[];
  /** Birds folded into a group in the last frame (not pickable on their own). */
  hidden: Set<string>;
  spriteMat: (key: string, make: () => THREE.SpriteMaterial) => THREE.SpriteMaterial;
  tex: Map<string, THREE.CanvasTexture>;
  treeParts: Map<string, THREE.Mesh[]>;
  zoneFills: Map<string, THREE.Mesh>;
  zoneEdges: THREE.Object3D[];
  dome: THREE.Group;
  levelBand: THREE.Group;
  selRing: THREE.Sprite;
  selDrop: THREE.Line;
  precision: THREE.Mesh;
  treeRing: THREE.Mesh;
  trail: THREE.Line;
  /** Bird markers: shown position glides toward the target position. */
  marks: { ids: string[]; cur: Float32Array; tgt: Float32Array; scale: Float32Array; dim: Uint8Array };
  fly: { from: THREE.Vector3; to: THREE.Vector3; camFrom: THREE.Vector3; camTo: THREE.Vector3; t0: number } | null;
}

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
    const { trees } = propsRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    wrap.prepend(renderer.domElement);
    renderer.domElement.className = "block h-full w-full outline-none";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e8f0f2");
    scene.fog = new THREE.Fog("#e8f0f2", 200, 380);
    scene.add(new THREE.HemisphereLight("#ffffff", "#7d8a5c", 1.35));
    const sun = new THREE.DirectionalLight("#fff4df", 1.8);
    sun.position.set(-40, 90, 50);
    scene.add(sun);

    const persp = new THREE.PerspectiveCamera(38, 1, 0.5, 700);
    persp.position.copy(HOME_CAM);
    const ortho = new THREE.OrthographicCamera(-60, 60, 40, -40, 0.1, 400);
    ortho.position.set(0, 160, 0);
    ortho.up.set(0, 0, -1);
    ortho.lookAt(0, 0, 0);

    const ctl3 = new OrbitControls(persp, renderer.domElement);
    ctl3.target.copy(HOME_TARGET);
    ctl3.enableDamping = true;
    ctl3.maxPolarAngle = 1.48;
    ctl3.minDistance = MIN_DIST;
    ctl3.maxDistance = 260;
    const ctl2 = new OrbitControls(ortho, renderer.domElement);
    ctl2.enableRotate = false;
    ctl2.screenSpacePanning = true;
    ctl2.enableDamping = true;
    ctl2.minZoom = 0.6;
    ctl2.maxZoom = 10;
    ctl2.enabled = false;

    const rng = mulberry32(hashSeed("scene-decor", 11));
    const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...extra });
    const flat = (g: THREE.BufferGeometry, y: number) => {
      g.rotateX(-Math.PI / 2);
      g.translate(0, y, 0);
      return g;
    };
    const { rx, rz, domeHeight } = FOOTPRINT;

    // Ground: a slab under a lush floor.
    const slab = new THREE.ExtrudeGeometry(ellipseShape(rx + 4, rz + 4), { depth: 3, bevelEnabled: false, curveSegments: 72 });
    slab.rotateX(-Math.PI / 2);
    slab.translate(0, -3.02, 0);
    scene.add(new THREE.Mesh(slab, std("#8a7a5c")));
    scene.add(new THREE.Mesh(flat(new THREE.ShapeGeometry(ellipseShape(rx + 4, rz + 4), 72), 0), std("#9cc47a")));

    // Zones: light tint + outline (layer).
    const zoneFills = new Map<string, THREE.Mesh>();
    const zoneEdges: THREE.Object3D[] = [];
    for (const z of MONITOR_ZONES) {
      const m = new THREE.Mesh(flat(new THREE.ShapeGeometry(zoneShape(z), 24), 0.03), new THREE.MeshBasicMaterial({ color: z.color, transparent: true, opacity: 0.07, depthWrite: false }));
      zoneFills.set(z.id, m);
      scene.add(m);
      const edge = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(zoneShape(z).getPoints(24).map((p) => new THREE.Vector3(p.x, 0.06, -p.y))),
        new THREE.LineBasicMaterial({ color: z.color, transparent: true, opacity: 0.35 }),
      );
      zoneEdges.push(edge);
      scene.add(edge);
    }

    // Water: turquoise lagoons with a stony shore.
    const shore = std("#cbb98e");
    const water = new THREE.MeshStandardMaterial({ color: "#3dbccb", roughness: 0.15, metalness: 0.05 });
    for (const w of WATER) {
      scene.add(new THREE.Mesh(flat(new THREE.ShapeGeometry(smoothShape(w.outline, 1.1), 8), 0.05), shore));
      scene.add(new THREE.Mesh(flat(new THREE.ShapeGeometry(smoothShape(w.outline), 8), 0.09), water));
    }

    // Rock formations and waterfalls.
    const rockMats = [std("#8d8f8a"), std("#a39b8a"), std("#7b7a73")];
    for (const r of ROCKS) {
      const n = Math.round(4 + r.r * 1.6);
      for (let i = 0; i < n; i++) {
        const s = 1.2 + rng() * (r.r * 0.55);
        const a = rng() * Math.PI * 2;
        const d = rng() * r.r * 0.8;
        const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMats[i % 3]);
        m.position.set(r.x + Math.cos(a) * d, s * 0.5 + rng() * Math.max(0, r.h - s) * (1 - d / (r.r + 0.1)), r.z + Math.sin(a) * d);
        m.rotation.set(rng() * 3, rng() * 3, rng() * 3);
        m.scale.y = 0.8 + rng() * 0.6;
        scene.add(m);
      }
    }
    const fallMat = new THREE.MeshBasicMaterial({ color: "#e6f8fc", transparent: true, opacity: 0.88, side: THREE.DoubleSide });
    const foamMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.75 });
    for (const f of WATERFALLS) {
      const fall = new THREE.Mesh(new THREE.PlaneGeometry(f.width, f.h), fallMat);
      fall.position.set(f.x, f.h / 2, f.z);
      fall.rotation.y = -f.facing + Math.PI / 2;
      scene.add(fall);
      const foam = new THREE.Mesh(flat(new THREE.CircleGeometry(f.width * 0.9, 20), 0.12), foamMat);
      foam.position.set(f.x + Math.cos(f.facing) * 1.2, 0, f.z + Math.sin(f.facing) * 1.2);
      scene.add(foam);
    }

    // Boardwalks: decks, posts and rails.
    // Decks are flat strips seen from above and below: draw both faces.
    const wood = std("#cf9d61", { side: THREE.DoubleSide });
    const woodDark = std("#8a6440");
    const groundPath = std("#d9c49b", { side: THREE.DoubleSide });
    const railMat = new THREE.LineBasicMaterial({ color: "#7a5a3c" });
    for (const w of WALKWAYS) {
      const curve = pathCurve(w.path, w.y);
      scene.add(new THREE.Mesh(deckGeometry(curve, w.width), w.y > 0.5 ? wood : groundPath));
      if (w.y <= 0.5) continue;
      const len = curve.getLength();
      const posts = Math.round(len / 5);
      const steps = Math.round(len * 1.2);
      const rails: THREE.Vector3[][] = [[], []];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const p = curve.getPointAt(t);
        const tan = curve.getTangentAt(t);
        const nx = -tan.z, nz = tan.x;
        const l = Math.hypot(nx, nz) || 1;
        rails[0].push(new THREE.Vector3(p.x + (nx / l) * (w.width / 2), p.y + 1, p.z + (nz / l) * (w.width / 2)));
        rails[1].push(new THREE.Vector3(p.x - (nx / l) * (w.width / 2), p.y + 1, p.z - (nz / l) * (w.width / 2)));
      }
      for (const r of rails) scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(r), railMat));
      for (let i = 0; i <= posts; i++) {
        const p = curve.getPointAt(i / posts);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, w.y, 6), woodDark);
        post.position.set(p.x, w.y / 2, p.z);
        scene.add(post);
      }
    }

    // Glass pavilions.
    const glass = new THREE.MeshStandardMaterial({ color: "#cfe9f1", transparent: true, opacity: 0.45, roughness: 0.1 });
    const frame = new THREE.LineBasicMaterial({ color: "#6f8793" });
    for (const p of PAVILIONS) {
      const g = new THREE.BoxGeometry(p.w, p.h, p.d);
      const box = new THREE.Mesh(g, glass);
      box.position.set(p.x, p.h / 2, p.z);
      box.rotation.y = p.rot;
      scene.add(box);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), frame);
      e.position.copy(box.position);
      e.rotation.copy(box.rotation);
      scene.add(e);
    }

    // Undergrowth (decor only), kept off water, rocks and paths.
    const shrubs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), std("#5a9a4f"), 320);
    const m4 = new THREE.Matrix4();
    let ns = 0;
    for (let tries = 0; ns < 320 && tries < 6000; tries++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * 0.97;
      const x = Math.cos(a) * r * rx, z = Math.sin(a) * r * rz;
      if (nearWater(x, z, 0.8) || nearRocks(x, z, 0.5) || distToWalkways(x, z) < 1 || nearPavilion(x, z, 1)) continue;
      const s = 0.8 + rng() * 1.4;
      m4.compose(new THREE.Vector3(x, s * 0.4, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rng() * 6, 0)), new THREE.Vector3(s, s * 0.7, s));
      shrubs.setMatrixAt(ns++, m4);
    }
    shrubs.count = ns;
    scene.add(shrubs);

    // Trees.
    const treeParts = new Map<string, THREE.Mesh[]>();
    const trunkGeo = new THREE.CylinderGeometry(0.32, 0.55, 1, 8);
    const crownGeo = new THREE.IcosahedronGeometry(1, 1);
    const frondGeo = new THREE.ConeGeometry(0.6, 1, 4);
    for (const t of trees) {
      const tr = mulberry32(hashSeed(t.id, 5));
      const great = Math.hypot(t.x - GREAT_TREE.x, t.z - GREAT_TREE.z) < 0.5 && t.heightM >= GREAT_TREE.heightM - 0.5;
      const green = new THREE.Color().setHSL(0.27 + tr() * 0.08, 0.45, 0.3 + tr() * 0.12);
      const crownMat = std(`#${green.getHexString()}`, { transparent: true });
      const trunkMat = std(great ? "#8b6b4a" : "#7a5b3d", { transparent: true });
      const parts: THREE.Mesh[] = [];
      const add = (m: THREE.Mesh) => {
        m.userData.treeId = t.id;
        parts.push(m);
        scene.add(m);
      };
      if (great) {
        // Massive trunk with buttress roots and a broad, layered crown.
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.6, t.heightM * 0.72, 12), trunkMat);
        trunk.position.set(t.x, (t.heightM * 0.72) / 2, t.z);
        add(trunk);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + tr() * 0.3;
          const root = new THREE.Mesh(new THREE.BoxGeometry(0.9, 4.5, 4.5), trunkMat);
          root.position.set(t.x + Math.cos(a) * 2.6, 1.6, t.z + Math.sin(a) * 2.6);
          root.rotation.y = -a;
          add(root);
        }
        const r = t.crownRadiusM;
        const blobs = 16;
        for (let k = 0; k < blobs; k++) {
          const a = (k / blobs) * Math.PI * 2 + tr();
          const ring = k % 2 ? 0.6 : 0.95;
          const y = t.heightM * (k % 3 === 0 ? 0.62 : k % 3 === 1 ? 0.78 : 0.9);
          const b = new THREE.Mesh(crownGeo, crownMat);
          const s = r * (0.32 + tr() * 0.12);
          b.position.set(t.x + Math.cos(a) * r * ring * 0.75, y, t.z + Math.sin(a) * r * ring * 0.75);
          b.scale.set(s, s * 0.6, s);
          add(b);
        }
        const top = new THREE.Mesh(crownGeo, crownMat);
        top.position.set(t.x, t.heightM - r * 0.25, t.z);
        top.scale.set(r * 0.55, r * 0.35, r * 0.55);
        add(top);
        // Ring platforms around the trunk.
        for (const pl of PLATFORMS) {
          const deck = new THREE.Mesh(flat(new THREE.RingGeometry(pl.r - 1.3, pl.r, 40), 0), wood);
          deck.position.set(t.x, pl.y, t.z);
          scene.add(deck);
          const rail = new THREE.Mesh(new THREE.TorusGeometry(pl.r, 0.07, 6, 48), woodDark);
          rail.rotation.x = Math.PI / 2;
          rail.position.set(t.x, pl.y + 1, t.z);
          scene.add(rail);
        }
        treeParts.set(t.id, parts);
        continue;
      }
      const trunkH = t.form === "palm" ? t.heightM - 0.6 : t.heightM * 0.7;
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.scale.set(t.form === "palm" ? 0.7 : 1 + t.heightM / 30, trunkH, t.form === "palm" ? 0.7 : 1 + t.heightM / 30);
      trunk.position.set(t.x, trunkH / 2, t.z);
      add(trunk);
      if (t.form === "palm") {
        for (let k = 0; k < 8; k++) {
          const f = new THREE.Mesh(frondGeo, crownMat);
          const a = (k / 8) * Math.PI * 2;
          f.scale.set(1, t.crownRadiusM * 1.15, 0.25);
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

    // Glass geodesic dome with its main arches.
    const dome = new THREE.Group();
    const lattice = new THREE.LineSegments(new THREE.WireframeGeometry(geodesicDome()), new THREE.LineBasicMaterial({ color: "#7d97a6", transparent: true, opacity: 0.3 }));
    const glassDome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#d6eef6", transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false }));
    for (const m of [lattice, glassDome]) {
      m.scale.set(rx + 4, domeHeight, rz + 4);
      dome.add(m);
    }
    const archMat = new THREE.MeshStandardMaterial({ color: "#e4ecef", roughness: 0.5 });
    for (const z0 of [-24, -10, 4]) {
      const k = Math.sqrt(Math.max(0, 1 - (z0 / (rz + 4)) ** 2));
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * Math.PI;
        pts.push(new THREE.Vector3(Math.cos(a) * (rx + 4) * k, Math.sin(a) * domeHeight * k, z0));
      }
      dome.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.45, 6), archMat));
    }
    scene.add(dome);

    // Level band (shown when a level is chosen).
    const levelBand = new THREE.Group();
    const bandGeo = flat(new THREE.ShapeGeometry(ellipseShape(rx, rz), 64), 0);
    for (let k = 0; k < 2; k++) {
      const m = new THREE.Mesh(bandGeo, new THREE.MeshBasicMaterial({ color: "#0891b2", transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }));
      levelBand.add(m);
      m.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ellipseShape(rx, rz).getPoints(64).map((p) => new THREE.Vector3(p.x, 0, -p.y))), new THREE.LineBasicMaterial({ color: "#0891b2", transparent: true, opacity: 0.55 })));
    }
    levelBand.visible = false;
    scene.add(levelBand);

    // Bird dots: always drawn over the foliage so they stay visible.
    const markers = new THREE.Group();
    scene.add(markers);
    const mats = new Map<string, THREE.SpriteMaterial>();
    const spriteMat = (key: string, make: () => THREE.SpriteMaterial) => {
      let m = mats.get(key);
      if (!m) mats.set(key, (m = make()));
      return m;
    };

    const selRing = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTexture(), depthTest: false, transparent: true, sizeAttenuation: false }));
    selRing.renderOrder = 14;
    selRing.visible = false;
    scene.add(selRing);
    const selDrop = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: "#0b2440", dashSize: 0.6, gapSize: 0.4, depthTest: false }));
    selDrop.renderOrder = 11;
    selDrop.visible = false;
    scene.add(selDrop);
    const precision = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: "#2563eb", transparent: true, opacity: 0.14, depthWrite: false, depthTest: false }));
    precision.renderOrder = 9;
    precision.visible = false;
    scene.add(precision);
    const treeRing = new THREE.Mesh(flat(new THREE.RingGeometry(0.9, 1, 48), 0), new THREE.MeshBasicMaterial({ color: "#0e9f95", transparent: true, opacity: 0.9, depthWrite: false }));
    treeRing.position.y = 0.15;
    treeRing.visible = false;
    scene.add(treeRing);
    const trail = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: "#2563eb", transparent: true, opacity: 0.85, depthTest: false }));
    trail.renderOrder = 8;
    trail.visible = false;
    scene.add(trail);

    const rig: Rig = {
      renderer, scene, persp, ortho, ctl3, ctl2, markers, pool: [], clusterPool: [], clusters: [], hidden: new Set(), spriteMat, tex: new Map(),
      treeParts, zoneFills, zoneEdges, dome, levelBand, selRing, selDrop, precision, treeRing, trail,
      marks: { ids: [], cur: new Float32Array(0), tgt: new Float32Array(0), scale: new Float32Array(0), dim: new Uint8Array(0) },
      fly: null,
    };
    rigRef.current = rig;

    // Size
    const resize = () => {
      // A stale hover tip would stay where the layout used to be.
      if (tipRef.current) tipRef.current.style.opacity = "0";
      const w = wrap.clientWidth, h = wrap.clientHeight;
      renderer.setSize(w, h, false);
      persp.aspect = w / Math.max(1, h);
      persp.updateProjectionMatrix();
      const half = Math.max(rz + 6, (rx + 6) / (w / Math.max(1, h)));
      ortho.top = half;
      ortho.bottom = -half;
      ortho.left = -half * (w / Math.max(1, h));
      ortho.right = half * (w / Math.max(1, h));
      ortho.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    // Loop: glide dots, fold overlaps into groups, camera, labels.
    const v = new THREE.Vector3();
    const dropPos = selDrop.geometry.getAttribute("position") as THREE.BufferAttribute;
    let lastT = 0;
    renderer.setAnimationLoop((time) => {
      const p = propsRef.current;
      const dt = lastT ? Math.min(100, time - lastT) : 16;
      lastT = time;
      const k = p.smooth === false ? 1 : 1 - Math.exp(-dt / 350);
      const { ids, cur, tgt, scale, dim } = rig.marks;
      const cam = p.mode === "2d" ? ortho : persp;
      const ctl = p.mode === "2d" ? ctl2 : ctl3;
      // Perspective: size as a share of the view. Orthographic has no distance, so convert to metres.
      const unit = p.mode === "2d" ? MARK * ((ortho.top - ortho.bottom) / ortho.zoom) : MARK * 2 * Math.tan(((persp.fov / 2) * Math.PI) / 180);
      selRing.scale.setScalar(unit * 2.8);
      const W0 = wrap.clientWidth, H0 = wrap.clientHeight;
      const grouping = p.cluster !== false;
      const cells = new Map<number, number[]>();
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
        mk.visible = true;
        if (ids[i] === p.selectedBirdId) {
          selIdx = i;
          continue;
        }
        if (!grouping || dim[i]) continue;
        v.copy(mk.position).project(cam);
        if (v.z > 1) continue;
        const key = Math.floor((((v.x + 1) / 2) * W0) / CLUSTER_CELL) * 4096 + Math.floor((((1 - v.y) / 2) * H0) / CLUSTER_CELL);
        const cell = cells.get(key);
        if (cell) cell.push(i);
        else cells.set(key, [i]);
      }
      // Four or more dots in one screen cell become a counter; zooming in splits them.
      rig.hidden.clear();
      let ci = 0;
      for (const list of cells.values()) {
        if (list.length < 4) continue;
        let x = 0, y = 0, z = 0;
        for (const i of list) {
          const pos = rig.pool[i].position;
          x += pos.x;
          y += pos.y;
          z += pos.z;
          rig.pool[i].visible = false;
          rig.hidden.add(ids[i]);
        }
        x /= list.length;
        y /= list.length;
        z /= list.length;
        let cs = rig.clusterPool[ci];
        if (!cs) {
          cs = new THREE.Sprite();
          cs.renderOrder = 12;
          markers.add(cs);
          rig.clusterPool.push(cs);
        }
        const label = list.length > 99 ? "99+" : String(list.length);
        cs.material = spriteMat(`c:${label}`, () => new THREE.SpriteMaterial({ map: clusterTexture(label, rig.tex), depthTest: false, transparent: true, sizeAttenuation: false }));
        cs.position.set(x, y, z);
        cs.scale.setScalar(unit * (1.9 + Math.min(1, list.length / 25)));
        cs.visible = true;
        v.set(x, y, z).project(cam);
        rig.clusters[ci] = { sx: ((v.x + 1) / 2) * W0, sy: ((1 - v.y) / 2) * H0, pos: { x, y, z }, ids: list.map((i) => ids[i]) };
        ci++;
      }
      for (let j = ci; j < rig.clusterPool.length; j++) rig.clusterPool[j].visible = false;
      rig.clusters.length = ci;

      if (selIdx >= 0) {
        const o = selIdx * 3;
        selRing.position.set(cur[o], cur[o + 1] + LIFT, cur[o + 2]);
        dropPos.setXYZ(0, cur[o], cur[o + 1] + LIFT, cur[o + 2]);
        dropPos.setXYZ(1, cur[o], 0.1, cur[o + 2]);
        dropPos.needsUpdate = true;
        selDrop.computeLineDistances();
        if (precision.visible) precision.position.set(cur[o], cur[o + 1] + LIFT, cur[o + 2]);
        const lbl = wrap.querySelector<HTMLElement>("[data-follow]");
        if (lbl) {
          lbl.dataset.x = String(cur[o]);
          lbl.dataset.y = String(cur[o + 1] + LIFT);
          lbl.dataset.z = String(cur[o + 2]);
        }
      }

      if (rig.fly) {
        const f = Math.min(1, (time - rig.fly.t0) / 700);
        const e = 1 - (1 - f) ** 3;
        ctl.target.lerpVectors(rig.fly.from, rig.fly.to, e);
        cam.position.lerpVectors(rig.fly.camFrom, rig.fly.camTo, e);
        if (f >= 1) rig.fly = null;
      }
      ctl.update();
      renderer.render(scene, cam);

      // HTML labels: zone codes always; tree IDs only when close and not overlapping.
      const w = wrap.clientWidth, h = wrap.clientHeight;
      const near = p.mode === "2d" ? ortho.zoom > TREE_LABEL_ZOOM : persp.position.distanceTo(ctl3.target) < TREE_LABEL_DIST;
      const placed: number[] = [];
      wrap.querySelectorAll<HTMLElement>("[data-x]").forEach((el) => {
        v.set(+el.dataset.x!, +el.dataset.y!, +el.dataset.z!).project(cam);
        let visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
        if (el.dataset.tree !== undefined && visible) {
          const X = ((v.x + 1) / 2) * w, Y = ((1 - v.y) / 2) * h;
          let free = near;
          for (let q = 0; free && q < placed.length; q += 2) if (Math.abs(placed[q] - X) < 34 && Math.abs(placed[q + 1] - Y) < 18) free = false;
          if (free) placed.push(X, Y);
          visible = free;
        }
        el.style.opacity = visible ? "" : "0";
        el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h + Number(el.dataset.dy ?? 0)}px) translate(-50%, -50%)`;
      });
    });

    /** Clicking a group flies closer to it, so its birds split apart. */
    const zoomInto = (pos: Vec3) => {
      const to = new THREE.Vector3(pos.x, pos.y, pos.z);
      if (propsRef.current.mode === "2d") {
        ortho.zoom = Math.min(10, ortho.zoom * 2);
        ortho.updateProjectionMatrix();
        rig.fly = { from: ctl2.target.clone(), to: new THREE.Vector3(to.x, 0, to.z), camFrom: ortho.position.clone(), camTo: new THREE.Vector3(to.x, 160, to.z), t0: performance.now() };
      } else {
        const off = persp.position.clone().sub(ctl3.target);
        const len = Math.max(MIN_DIST, off.length() * 0.45);
        rig.fly = { from: ctl3.target.clone(), to, camFrom: persp.position.clone(), camTo: to.clone().add(off.setLength(len)), t0: performance.now() };
      }
    };
    const atClosest = () => (propsRef.current.mode === "2d" ? ortho.zoom >= 9.5 : persp.position.distanceTo(ctl3.target) <= MIN_DIST + 1);

    // Picking: groups first, then visible dots (screen space), then trees (raycast).
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pick = (cx: number, cy: number): { type: "bird" | "tree" | "cluster"; id: string; label: string; pos?: Vec3; ids?: string[] } | null => {
      const p = propsRef.current;
      const cam = p.mode === "2d" ? ortho : persp;
      const rect = renderer.domElement.getBoundingClientRect();
      const x = cx - rect.left, y = cy - rect.top;
      for (const c of rig.clusters) {
        if (Math.hypot(c.sx - x, c.sy - y) < 14) return { type: "cluster", id: "", label: atClosest() ? `${c.ids.length} birds at about the same spot · click to list them` : `${c.ids.length} birds here · click to zoom in`, pos: c.pos, ids: c.ids };
      }
      let best: ScenePoint | null = null;
      let bestD = 10;
      for (const pt of p.points) {
        if (rig.hidden.has(pt.id)) continue;
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
        if (t) return { type: "tree", id: t.id, label: `${t.id}${t.plantSpecies ? ` · ${t.plantSpecies}` : ""} · ${t.heightM.toFixed(1)} m` };
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
      else if (hit?.type === "cluster" && hit.pos) {
        // At the closest zoom the birds share an estimated spot: list them instead of inventing a spread.
        if (atClosest() && hit.ids && propsRef.current.onSelectGroup) propsRef.current.onSelectGroup(hit.ids);
        else zoomInto(hit.pos);
      }
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
        const ms = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        ms.forEach((mm) => {
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
    const dim = new Uint8Array(n);
    points.forEach((p, i) => {
      dim[i] = p.dim ? 1 : 0;
      tgt.set([p.pos.x, p.pos.y, p.pos.z], i * 3);
      const j = prevIdx.get(p.id);
      cur.set(j === undefined ? [p.pos.x, p.pos.y, p.pos.z] : prev.cur.subarray(j * 3, j * 3 + 3), i * 3);
      scale[i] = p.id === selectedBirdId ? 1.7 : p.dim ? 0.75 : 1;
      while (rig.pool.length <= i) {
        const dot = new THREE.Sprite();
        rig.markers.add(dot);
        rig.pool.push(dot);
      }
      const mk = rig.pool[i];
      mk.material = rig.spriteMat(`d:${p.color}:${p.dim ? "d" : ""}`, () => new THREE.SpriteMaterial({ map: dotTexture(p.color, rig.tex), depthTest: false, transparent: true, sizeAttenuation: false, opacity: p.dim ? 0.2 : 1 }));
      mk.renderOrder = p.id === selectedBirdId ? 15 : p.dim ? 9 : 11;
      if (j === undefined) mk.position.set(p.pos.x, p.pos.y + LIFT, p.pos.z);
    });
    for (let i = n; i < rig.pool.length; i++) rig.pool[i].visible = false;
    rig.marks = { ids: points.map((p) => p.id), cur, tgt, scale, dim };
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
      rig.precision.position.set(precision.pos.x, precision.pos.y + LIFT, precision.pos.z);
      rig.precision.scale.setScalar(Math.max(0.6, precision.r));
    }
    rig.trail.visible = !!trail && trail.length > 1;
    if (trail && trail.length > 1) rig.trail.geometry.setFromPoints(trail.map((p) => new THREE.Vector3(p.x, p.y + LIFT, p.z)));
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
    rig.zoneFills.forEach((m, id) => ((m.material as THREE.MeshBasicMaterial).opacity = id === highlightZoneId ? 0.36 : highlightZoneId ? 0.03 : 0.07));
  }, [highlightZoneId, ready]);

  useEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    rig.levelBand.visible = level !== "all";
    if (level !== "all") {
      const L = LEVEL_BY_ID[level];
      const lo = Math.max(0.05, L.min === -Infinity ? 0.05 : L.min);
      const hi = Math.min(FOOTPRINT.domeHeight, L.max === Infinity ? FOOTPRINT.domeHeight : L.max);
      rig.levelBand.children[0].position.y = lo;
      rig.levelBand.children[1].position.y = level === "ground" ? 0.5 : hi;
      rig.levelBand.children.forEach((c) => ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(L.color));
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
      rig.ortho.zoom = Math.max(rig.ortho.zoom, 2.4);
      rig.ortho.updateProjectionMatrix();
      rig.fly = { from: rig.ctl2.target.clone(), to: new THREE.Vector3(to.x, 0, to.z), camFrom: rig.ortho.position.clone(), camTo: new THREE.Vector3(to.x, 160, to.z), t0: performance.now() };
    } else {
      const dir = rig.persp.position.clone().sub(rig.ctl3.target).normalize();
      rig.fly = { from: rig.ctl3.target.clone(), to, camFrom: rig.persp.position.clone(), camTo: to.clone().add(dir.multiplyScalar(60)), t0: performance.now() };
    }
  }, [focus]);

  const zoom = (f: number) => {
    const rig = rigRef.current;
    if (!rig) return;
    if (mode === "2d") {
      rig.ortho.zoom = THREE.MathUtils.clamp(rig.ortho.zoom * f, 0.6, 10);
      rig.ortho.updateProjectionMatrix();
    } else {
      const off = rig.persp.position.clone().sub(rig.ctl3.target);
      const len = THREE.MathUtils.clamp(off.length() / f, MIN_DIST, 260);
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
    <div ref={wrapRef} className="relative h-full w-full touch-none overflow-hidden" role="application" aria-label="Interactive aviary map. Drag to rotate, Ctrl + scroll to zoom, click a bird or a tree to open its details.">
      <div className="pointer-events-none absolute inset-0">
        {layers.labels &&
          MONITOR_ZONES.map((z) => {
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
        {layers.labels &&
          trees
            .filter((t) => t.id !== selectedTreeId)
            .map((t) => (
              <span key={t.id} data-tree data-x={t.x} data-y={t.heightM + 0.6} data-z={t.z} className="absolute left-0 top-0 rounded bg-white/90 px-1 text-[9px] font-semibold text-ink shadow-sm ring-1 ring-line transition-opacity duration-200">
                {t.id}
              </span>
            ))}
        {selTree && (
          <span key={`tree-${selTree.id}`} data-x={selTree.x} data-y={selTree.heightM + 1.5} data-z={selTree.z} className="absolute left-0 top-0 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
            {selTree.id}
          </span>
        )}
        {selBird && (
          <span key={`bird-${selBird.id}`} data-follow data-dy={-22} data-x={selBird.pos.x} data-y={selBird.pos.y} data-z={selBird.pos.z} className="absolute left-0 top-0 rounded-md bg-panel-solid px-1.5 py-0.5 text-[10px] font-semibold text-ink shadow ring-1 ring-line-strong">
            {selBird.id}
          </span>
        )}
        <div ref={hintRef} className="absolute inset-0 grid place-items-center bg-ink/25 text-sm font-medium text-white opacity-0 transition-opacity">Use Ctrl + scroll to zoom the map</div>
        <div ref={tipRef} className="absolute left-0 top-0 rounded-md bg-ink/90 px-2 py-1 text-[11px] text-white opacity-0 shadow transition-opacity" />
      </div>

      <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-xl border border-line-strong bg-panel-solid/90 shadow-sm backdrop-blur">
        <button onClick={() => zoom(1.25)} className="grid h-9 w-9 place-items-center text-muted hover:bg-ink/5 hover:text-ink" aria-label="Zoom in">
          <Plus size={16} />
        </button>
        <button onClick={() => zoom(0.8)} className="grid h-9 w-9 place-items-center border-t border-line text-muted hover:bg-ink/5 hover:text-ink" aria-label="Zoom out">
          <Minus size={16} />
        </button>
        <button onClick={reset} className="grid h-9 w-9 place-items-center border-t border-line text-muted hover:bg-ink/5 hover:text-ink" aria-label="Reset view">
          <RotateCcw size={15} />
        </button>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-panel-solid/85 px-2 py-1 text-[10px] text-muted shadow-sm backdrop-blur">
        <Box size={12} /> Illustrative reconstruction · not to scale · {mode === "3d" ? "drag to rotate · Ctrl + scroll to zoom · right-drag to pan" : "top view · drag to pan · Ctrl + scroll to zoom"}
      </div>
      {highlightZoneId && <span className="sr-only">Zone {MONITOR_ZONE_BY_ID[highlightZoneId]?.name} highlighted</span>}
    </div>
  );
}
