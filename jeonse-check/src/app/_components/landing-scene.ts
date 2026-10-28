// 랜딩 3D 장면(three.js). 떠 있는 섬 위의 집이 스크롤 진행도 F에 따라
// 위험 신호 → 공공데이터 분석 → 결과 게이지 → 마지막 장면으로 바뀐다.
// three는 LandingStory에서 동적으로 불러와 이 클래스에 넘긴다. 색은 globals.css 토큰을 읽어 쓴다.

import type * as Three from "three";
import type { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import type { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { JEONSE_RATIO_THRESHOLD } from "@/consts/policy";
import { CAMERA_KEYS, DATA_CARDS, RISK_MARKERS } from "./landing-data";
import { clamp, lerp, riskAppear, smoothstep, type StoryFactors } from "./landing-timeline";

type ThreeModule = typeof Three;

export type PostModules = {
  EffectComposer: typeof EffectComposer;
  RenderPass: typeof import("three/addons/postprocessing/RenderPass.js").RenderPass;
  UnrealBloomPass: typeof UnrealBloomPass;
  OutputPass: typeof import("three/addons/postprocessing/OutputPass.js").OutputPass;
};

export type SceneFrame = {
  F: number;
  fx: StoryFactors;
  t: number; // 초
  dt: number; // 초
  jeonseRatio: number; // 슬라이더 보증금의 전세가율(0~)
  pointer: { x: number; y: number }; // -1~1
  dragging: boolean;
};

export type ScreenPoint = { x: number; y: number; visible: boolean; distance: number };

type Palette = Record<"danger" | "data" | "ink" | "canvas" | "surface" | "surfaceStrong" | "hairline" | "muted" | "amber" | "window", string>;

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(`--color-${name}`).trim();
  return {
    danger: v("primary"),
    data: v("data"),
    ink: v("ink"),
    canvas: v("canvas"),
    surface: v("surface-soft"),
    surfaceStrong: v("surface-strong"),
    hairline: v("hairline"),
    muted: v("muted"),
    amber: v("scene-amber"),
    window: v("scene-window"),
  };
}

// globals.css --breakpoint-tablet과 같은 값. 이보다 좁으면 입자 수를 줄이고 카메라를 뒤로 뺀다.
const MOBILE_WIDTH = 744;
// 게이지 눈금은 전세가율 30%~120%를 그린다.
const GAUGE_MIN = 0.3;
const GAUGE_SPAN = 0.9;

export class LandingScene {
  private T: ThreeModule;
  private renderer: Three.WebGLRenderer;
  private scene: Three.Scene;
  readonly camera: Three.PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private c: Record<"danger" | "data" | "calm" | "amber" | "window" | "dim" | "bg" | "bgRisk" | "bgCalm" | "ink", Three.Color>;
  private tmp: Three.Color;
  private tmp2: Three.Color;
  // 매 프레임 새로 만들지 않도록 재사용하는 벡터
  private v: Record<"a" | "b" | "c" | "d" | "e" | "f" | "p" | "h", Three.Vector3>;
  private up: Three.Vector3;

  private island!: Three.Group;
  private house!: Three.Group;
  private edgeMat!: Three.LineBasicMaterial;
  private rimMat!: Three.MeshBasicMaterial;
  private rimMat2!: Three.MeshBasicMaterial;
  private windows!: Three.InstancedMesh;
  private windowSeeds: number[] = [];
  private crackMat!: Three.LineBasicMaterial;
  private particles!: { meta: { r: number; a: number; h: number; s: number; ph: number }[]; pos: Float32Array; geo: Three.BufferGeometry; mat: Three.PointsMaterial };
  private docs: Three.Mesh[] = [];
  private q!: [Three.Quaternion, Three.Quaternion, Three.Quaternion];
  private euler!: Three.Euler;
  private helper!: Three.Object3D;
  private rings: Three.Mesh<Three.TorusGeometry, Three.MeshBasicMaterial>[] = [];
  private waves: Three.Mesh<Three.RingGeometry, Three.MeshBasicMaterial>[] = [];
  private riskGroup!: Three.Group;
  private alerts: Three.Sprite[] = [];
  private scanGroup!: Three.Group;
  private scanMat!: Three.MeshBasicMaterial;
  private scanEdgeMat!: Three.LineBasicMaterial;
  private radar!: Three.Mesh;
  private radarMat!: Three.MeshBasicMaterial;
  private dataAnchors: Three.Object3D[] = [];
  private gaugeGroup!: Three.Group;
  private ticks!: Three.InstancedMesh;
  private needle!: Three.Group;
  private gaugeLabel!: Three.Object3D;
  private dome!: Three.Mesh;
  private domeMat!: Three.ShaderMaterial;
  private redLight!: Three.PointLight;
  private blueLight!: Three.PointLight;
  private warmLight!: Three.PointLight;

  private jr: number;
  private calm = 0;
  private auto = 0;
  private dragRot = 0;
  private dragVel = 0;
  private windowTime = 0;
  private introStart: number | null = null;
  private smoothPointer = { x: 0, y: 0 };

  private static readonly TICKS = 44;
  private static readonly ARC_START = (Math.PI * 7) / 6;
  private static readonly ARC_SWEEP = (Math.PI * 4) / 3;

  constructor(T: ThreeModule, post: PostModules | null, host: HTMLElement, initialRatio: number) {
    this.T = T;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const palette = readPalette();
    const col = (css: string) => new T.Color(css);
    const bg = col(palette.canvas);
    this.c = {
      danger: col(palette.danger),
      data: col(palette.data),
      calm: col(palette.data).lerp(col(palette.canvas), 0.25),
      amber: col(palette.amber),
      window: col(palette.window),
      dim: col(palette.surfaceStrong),
      bg,
      bgRisk: bg.clone().lerp(col(palette.danger), 0.035),
      bgCalm: bg.clone().lerp(col(palette.data), 0.03),
      ink: col(palette.ink),
    };
    this.tmp = new T.Color();
    this.tmp2 = new T.Color();
    this.v = { a: new T.Vector3(), b: new T.Vector3(), c: new T.Vector3(), d: new T.Vector3(), e: new T.Vector3(), f: new T.Vector3(), p: new T.Vector3(), h: new T.Vector3() };
    this.up = new T.Vector3(0, 1, 0);
    this.jr = initialRatio;

    const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(dpr);
    // 크기는 CSS(100%)가 맡고 그리기 버퍼만 맞춘다(updateStyle false).
    renderer.setSize(W, H, false);
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.setClearColor(bg, 1);
    renderer.domElement.style.cssText = "display:block;width:100%;height:100%";
    host.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene = new T.Scene();
    this.scene.fog = new T.FogExp2(bg.getHex(), 0.034);
    this.camera = new T.PerspectiveCamera(40, W / H, 0.1, 200);

    this.build(palette, W);

    if (post) {
      try {
        const composer = new post.EffectComposer(renderer);
        composer.setPixelRatio(dpr);
        composer.setSize(W, H);
        composer.addPass(new post.RenderPass(this.scene, this.camera));
        this.bloom = new post.UnrealBloomPass(new T.Vector2(W, H), 0.8, 0.6, 0.32);
        composer.addPass(this.bloom);
        composer.addPass(new post.OutputPass());
        this.composer = composer;
      } catch {
        this.composer = null;
        this.bloom = null;
      }
    }
  }

  private texture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): Three.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    draw(canvas.getContext("2d") as CanvasRenderingContext2D, w, h);
    const tx = new this.T.CanvasTexture(canvas);
    tx.colorSpace = this.T.SRGBColorSpace;
    tx.anisotropy = 4;
    return tx;
  }

  private glow(color: Three.Color, extra: Partial<Three.MeshBasicMaterialParameters> = {}) {
    return new this.T.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: this.T.AdditiveBlending, depthWrite: false, toneMapped: false, ...extra });
  }

  private build(palette: Palette, W: number) {
    const T = this.T;
    const scene = this.scene;
    const c = this.c;
    const add = <O extends Three.Object3D>(parent: Three.Object3D, o: O): O => {
      parent.add(o);
      return o;
    };

    scene.add(new T.HemisphereLight(0x9fb2d6, 0x0b0b12, 0.6));
    const key = new T.DirectionalLight(0xffe6cc, 1.6);
    key.position.set(6, 10, 7);
    scene.add(key);
    const rim = new T.DirectionalLight(0x6f8cff, 0.7);
    rim.position.set(-8, 4, -6);
    scene.add(rim);
    this.redLight = add(scene, new T.PointLight(c.danger, 0, 20, 1.5));
    this.redLight.position.set(-3.5, 3, 3.5);
    this.blueLight = add(scene, new T.PointLight(c.data, 0, 20, 1.5));
    this.blueLight.position.set(3.5, 5, 3.5);
    this.warmLight = add(scene, new T.PointLight(c.window, 0, 9, 1.8));
    this.warmLight.position.set(0, 1.2, 3.2);

    // 섬과 집
    const island = add(scene, new T.Group());
    this.island = island;
    const platform = add(island, new T.Mesh(new T.CylinderGeometry(4.2, 3.6, 0.5, 96), new T.MeshStandardMaterial({ color: palette.surface, roughness: 0.35, metalness: 0.7 })));
    platform.position.y = 0.05;
    this.rimMat = new T.MeshBasicMaterial({ color: c.amber, toneMapped: false });
    const rimRing = add(island, new T.Mesh(new T.TorusGeometry(4.2, 0.028, 8, 240), this.rimMat));
    rimRing.rotation.x = Math.PI / 2;
    rimRing.position.y = 0.3;
    this.rimMat2 = new T.MeshBasicMaterial({ color: c.amber, transparent: true, opacity: 0.45, toneMapped: false, side: T.DoubleSide });
    const inner = add(island, new T.Mesh(new T.RingGeometry(2.05, 2.08, 160), this.rimMat2));
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.305;

    const house = add(island, new T.Group());
    this.house = house;
    const bodyMat = new T.MeshStandardMaterial({ color: palette.surfaceStrong, roughness: 0.5, metalness: 0.4 });
    const body = add(house, new T.Mesh(new T.BoxGeometry(3, 4.2, 2.4), bodyMat));
    body.position.y = 2.4;
    const ledgeMat = new T.MeshStandardMaterial({ color: palette.hairline, roughness: 0.4, metalness: 0.5 });
    for (let k = 1; k <= 4; k++) add(house, new T.Mesh(new T.BoxGeometry(3.12, 0.05, 2.52), ledgeMat)).position.y = 0.3 + k * 0.84;
    const roof = add(house, new T.Mesh(new T.BoxGeometry(3.25, 0.16, 2.65), ledgeMat));
    roof.position.y = 4.58;
    const tank = add(house, new T.Mesh(new T.BoxGeometry(0.7, 0.45, 0.6), bodyMat));
    tank.position.set(0.75, 4.88, -0.45);
    this.edgeMat = new T.LineBasicMaterial({ color: c.amber, transparent: true, opacity: 0.95, toneMapped: false });
    for (const mesh of [body, roof, tank]) add(house, new T.LineSegments(new T.EdgesGeometry(mesh.geometry), this.edgeMat)).position.copy(mesh.position);

    const windowSpots: [number, number, number, number][] = [];
    for (let k = 0; k < 5; k++) {
      const y = 0.3 + 0.84 * k + 0.47;
      for (const x of [-1.05, -0.35, 0.35, 1.05]) windowSpots.push([x, y, 1.206, 0], [x, y, -1.206, Math.PI]);
      for (const z of [-0.75, 0, 0.75]) windowSpots.push([1.506, y, z, Math.PI / 2], [-1.506, y, z, -Math.PI / 2]);
    }
    this.windows = add(house, new T.InstancedMesh(new T.PlaneGeometry(0.4, 0.5), new T.MeshBasicMaterial({ toneMapped: false }), windowSpots.length));
    this.helper = new T.Object3D();
    windowSpots.forEach(([x, y, z, ry], i) => {
      this.helper.position.set(x, y, z);
      this.helper.rotation.set(0, ry, 0);
      this.helper.updateMatrix();
      this.windows.setMatrixAt(i, this.helper.matrix);
      this.windows.setColorAt(i, c.window);
    });
    this.windowSeeds = windowSpots.map(() => Math.random());

    // 벽의 균열
    const crackPoints: number[] = [];
    const crack = (x: number, y: number, ang: number, len: number, depth: number) => {
      let cx = x;
      let cy = y;
      for (let s = 0; s < len; s++) {
        const a = ang + (Math.random() - 0.5) * 1.1;
        const nx = clamp(cx + Math.cos(a) * 0.18, -1.45, 1.45);
        const ny = clamp(cy + Math.sin(a) * 0.18, 0.35, 4.45);
        crackPoints.push(cx, cy, 0, nx, ny, 0);
        cx = nx;
        cy = ny;
        if (depth < 2 && Math.random() < 0.2) crack(cx, cy, ang + (Math.random() < 0.5 ? -1 : 1) * 0.9, Math.floor(len / 2), depth + 1);
      }
    };
    crack(-0.9, 4.1, -1.2, 10, 0);
    crack(1.1, 2.8, -2.2, 8, 0);
    crack(-0.2, 1.5, -0.5, 7, 0);
    this.crackMat = new T.LineBasicMaterial({ color: c.danger, transparent: true, opacity: 0, toneMapped: false, blending: T.AdditiveBlending });
    const crackGeo = new T.BufferGeometry();
    crackGeo.setAttribute("position", new T.Float32BufferAttribute(crackPoints, 3));
    add(house, new T.LineSegments(crackGeo, this.crackMat)).position.z = 1.212;

    // 떠다니는 입자와 먼 별
    const dot = this.texture(64, 64, (ctx) => {
      const gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, "rgba(255,255,255,1)");
      gr.addColorStop(0.25, "rgba(255,255,255,.75)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, 64, 64);
    });
    const count = W < MOBILE_WIDTH ? 700 : 1400;
    const pos = new Float32Array(count * 3);
    const meta = Array.from({ length: count }, () => ({
      r: 2.7 + Math.pow(Math.random(), 0.8) * 6.5,
      a: Math.random() * Math.PI * 2,
      h: -0.4 + Math.random() * 7.4,
      s: (0.04 + Math.random() * 0.16) * (Math.random() < 0.5 ? -1 : 1),
      ph: Math.random() * 6.28,
    }));
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    const mat = new T.PointsMaterial({ size: 0.085, map: dot, transparent: true, depthWrite: false, blending: T.AdditiveBlending, color: c.danger, toneMapped: false, sizeAttenuation: true });
    add(scene, new T.Points(geo, mat));
    this.particles = { meta, pos, geo, mat };

    const starCount = 600;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = Math.random() * Math.PI * 2;
      const vv = Math.acos(2 * Math.random() - 1);
      const r = 16 + Math.random() * 30;
      starPos[i * 3] = Math.sin(vv) * Math.cos(u) * r;
      starPos[i * 3 + 1] = Math.abs(Math.cos(vv)) * r * 0.6 - 2;
      starPos[i * 3 + 2] = Math.sin(vv) * Math.sin(u) * r;
    }
    const starGeo = new T.BufferGeometry();
    starGeo.setAttribute("position", new T.BufferAttribute(starPos, 3));
    add(scene, new T.Points(starGeo, new T.PointsMaterial({ size: 0.08, map: dot, transparent: true, depthWrite: false, color: palette.muted, opacity: 0.55 })));
    const grid = add(scene, new T.GridHelper(120, 120, palette.hairline, palette.surfaceStrong));
    grid.position.y = -3.2;
    (grid.material as Three.Material).transparent = true;
    (grid.material as Three.Material).opacity = 0.55;

    // 떠다니다 정리되는 서류
    const docTex = ["전세 계약서", "등기사항증명서", "건축물대장"].map((title, k) =>
      this.texture(256, 340, (ctx, w, h) => {
        ctx.fillStyle = palette.ink;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = palette.surfaceStrong;
        ctx.fillRect(0, 0, w, 46);
        ctx.fillStyle = palette.ink;
        ctx.font = "700 22px sans-serif";
        ctx.fillText(title, 18, 31);
        ctx.fillStyle = palette.muted;
        for (let i = 0; i < 11; i++) ctx.fillRect(18, 70 + i * 22, 60 + ((i * 37 + k * 23) % 160), 6);
        if (k === 0) {
          ctx.strokeStyle = palette.danger;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(200, 300, 22, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (k === 1) {
          ctx.strokeStyle = palette.muted;
          ctx.lineWidth = 2;
          ctx.strokeRect(18, 66, 220, 120);
          ctx.beginPath();
          ctx.moveTo(18, 106);
          ctx.lineTo(238, 106);
          ctx.moveTo(18, 146);
          ctx.lineTo(238, 146);
          ctx.stroke();
        }
      }),
    );
    const docGeo = new T.PlaneGeometry(0.72, 0.96);
    for (let j = 0; j < 9; j++) {
      const tex = docTex[j % 3];
      const m = add(island, new T.Mesh(docGeo, new T.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0x6a6f78, side: T.DoubleSide, roughness: 0.7, metalness: 0, transparent: true, opacity: 0.92 })));
      m.userData = {
        r: 3.7 + Math.random() * 2.1,
        a: (j / 9) * Math.PI * 2 + Math.random() * 0.4,
        h: 1.0 + Math.random() * 4.2,
        sp: (0.08 + Math.random() * 0.08) * (j % 2 ? 1 : -1),
        rs: [0.5 + Math.random() * 1.5, 0.5 + Math.random() * 1.5, Math.random()],
      };
      this.docs.push(m);
    }
    this.q = [new T.Quaternion(), new T.Quaternion(), new T.Quaternion()];
    this.euler = new T.Euler();

    // 01 위험: 고리, 퍼지는 파동, 경고 표식
    this.rings = [2.75, 3.25, 3.85].map((r, k) => {
      const m = add(island, new T.Mesh(new T.TorusGeometry(r, 0.016, 8, 220), this.glow(c.danger)));
      m.position.y = 2.4;
      m.userData = { bx: Math.PI / 2 + (k - 1) * 0.35, bz: (k - 1) * 0.25 };
      return m;
    });
    this.waves = [0, 1, 2].map(() => {
      const m = add(island, new T.Mesh(new T.RingGeometry(0.985, 1, 160), this.glow(c.danger, { side: T.DoubleSide })));
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.31;
      return m;
    });
    const alertTex = this.texture(128, 128, (ctx) => {
      ctx.shadowColor = palette.danger;
      ctx.shadowBlur = 18;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(64, 18);
      ctx.lineTo(112, 104);
      ctx.lineTo(16, 104);
      ctx.closePath();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = palette.danger;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 7;
      ctx.strokeStyle = palette.danger;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = palette.ink;
      ctx.font = "800 52px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("!", 64, 94);
    });
    this.riskGroup = add(island, new T.Group());
    this.alerts = RISK_MARKERS.map((_, i) => {
      const s = add(this.riskGroup, new T.Sprite(new T.SpriteMaterial({ map: alertTex, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 })));
      const a = (i / RISK_MARKERS.length) * Math.PI * 2 + 0.3;
      const r = 2.9 + (i % 2) * 0.6;
      s.position.set(Math.cos(a) * r, 1.4 + ((i * 0.67) % 3.6), Math.sin(a) * r);
      s.userData.by = s.position.y;
      s.scale.setScalar(0.001);
      return s;
    });

    // 02 분석: 오르내리는 스캔 면과 레이더
    this.scanGroup = add(island, new T.Group());
    this.scanMat = this.glow(c.data, { side: T.DoubleSide });
    add(this.scanGroup, new T.Mesh(new T.PlaneGeometry(3.7, 3.1), this.scanMat)).rotation.x = -Math.PI / 2;
    this.scanEdgeMat = new T.LineBasicMaterial({ color: c.data, transparent: true, opacity: 0, toneMapped: false });
    add(this.scanGroup, new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(3.7, 3.1)), this.scanEdgeMat)).rotation.x = -Math.PI / 2;
    const radarTex = this.texture(512, 512, (ctx) => {
      ctx.translate(256, 256);
      ctx.strokeStyle = palette.data;
      ctx.fillStyle = palette.data;
      if ("createConicGradient" in ctx) {
        const gr = ctx.createConicGradient(0, 0, 0);
        gr.addColorStop(0, "rgba(255,255,255,0.6)");
        gr.addColorStop(0.16, "rgba(255,255,255,0)");
        gr.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(0, 0, 250, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 2;
      for (const r of [90, 170, 248]) {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    this.radarMat = new T.MeshBasicMaterial({ map: radarTex, color: c.data, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.radar = add(island, new T.Mesh(new T.PlaneGeometry(8.3, 8.3), this.radarMat));
    this.radar.rotation.x = -Math.PI / 2;
    this.radar.position.y = 0.32;
    this.dataAnchors = DATA_CARDS.map((d) => {
      const o = add(island, new T.Object3D());
      o.position.set(...d.p);
      return o;
    });

    // 03 결과: 전세가율 게이지
    this.gaugeGroup = add(scene, new T.Group());
    this.gaugeGroup.position.set(-3.4, 3.4, 1.4);
    this.ticks = add(this.gaugeGroup, new T.InstancedMesh(new T.BoxGeometry(0.05, 0.26, 0.04), new T.MeshBasicMaterial({ toneMapped: false }), LandingScene.TICKS));
    for (let k = 0; k < LandingScene.TICKS; k++) {
      const th = LandingScene.ARC_START - (k / (LandingScene.TICKS - 1)) * LandingScene.ARC_SWEEP;
      this.helper.position.set(Math.cos(th) * 1.3, Math.sin(th) * 1.3, 0);
      this.helper.rotation.set(0, 0, th - Math.PI / 2);
      this.helper.updateMatrix();
      this.ticks.setMatrixAt(k, this.helper.matrix);
      this.ticks.setColorAt(k, c.dim);
    }
    add(this.gaugeGroup, new T.Mesh(new T.CircleGeometry(1.62, 64), new T.MeshBasicMaterial({ color: palette.canvas, transparent: true, opacity: 0.55, depthWrite: false }))).position.z = -0.05;
    add(this.gaugeGroup, new T.Mesh(new T.TorusGeometry(1.62, 0.008, 6, 128), new T.MeshBasicMaterial({ color: c.data, transparent: true, opacity: 0.5, toneMapped: false })));
    this.needle = add(this.gaugeGroup, new T.Group());
    this.needle.position.z = 0.03;
    add(this.needle, new T.Mesh(new T.BoxGeometry(0.045, 1.0, 0.03).translate(0, 0.5, 0), new T.MeshBasicMaterial({ color: c.ink, toneMapped: false })));
    add(this.gaugeGroup, new T.Mesh(new T.CircleGeometry(0.08, 24), new T.MeshBasicMaterial({ color: c.ink, toneMapped: false }))).position.z = 0.05;
    this.gaugeLabel = add(this.gaugeGroup, new T.Object3D());
    this.gaugeLabel.position.set(0, -0.62, 0);

    // 04 마지막 장면: 집을 감싸는 데이터 돔
    this.domeMat = new T.ShaderMaterial({
      // 돔 위에 마지막 장면 글이 올라가므로 밝기를 낮춘다.
      uniforms: { uColor: { value: c.calm.clone().multiplyScalar(0.45) }, uOp: { value: 0 }, uT: { value: 0 } },
      vertexShader:
        "varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = position.y; gl_Position = projectionMatrix * mv; }",
      fragmentShader:
        "uniform vec3 uColor; uniform float uOp; uniform float uT; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2); float band = smoothstep(0.92, 1.0, sin(vY * 5.0 - uT * 1.6) * 0.5 + 0.5); float a = (f * 0.85 + band * 0.18) * uOp; gl_FragColor = vec4(uColor * (1.0 + band), a); }",
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
      blending: T.AdditiveBlending,
    });
    this.dome = add(island, new T.Mesh(new T.SphereGeometry(4.5, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2), this.domeMat));
    this.dome.position.y = 0.3;
  }

  drag(dx: number) {
    this.dragRot += dx * 0.006;
    this.dragVel = dx * 0.006;
  }

  resize(W: number, H: number) {
    this.renderer.setSize(W, H, false);
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(W, H);
  }

  // 현재 게이지가 가리키는 전세가율(애니메이션 중간값)
  get gaugeRatio() {
    return this.jr;
  }

  render({ F, fx, t, dt, jeonseRatio, pointer, dragging }: SceneFrame) {
    const { c } = this;
    const W = window.innerWidth;
    const mobile = W < MOBILE_WIDTH;
    if (this.introStart === null) this.introStart = t;
    const intro = 1 - smoothstep(0, 3.2, t - this.introStart);
    const k = 1 - Math.exp(-dt * 5);
    this.jr += (jeonseRatio - this.jr) * k;
    const sliderCalm = this.jr < JEONSE_RATIO_THRESHOLD.caution ? 1 : this.jr < JEONSE_RATIO_THRESHOLD.danger ? 0.5 : 0.05;
    this.calm += (fx.calm * lerp(sliderCalm, 1, fx.fin) - this.calm) * k;
    const { calm } = this;
    const { risk, scan } = fx;

    // 장면 색: 주황 윤곽 → 위험 레드 → 분석 블루 → 가라앉은 블루
    this.tmp.copy(c.amber).lerp(c.danger, Math.min(1, risk * 1.2)).lerp(c.data, scan * 0.8).lerp(c.calm, calm);
    this.edgeMat.color.copy(this.tmp);
    this.rimMat.color.copy(this.tmp);
    this.rimMat2.color.copy(this.tmp);
    this.particles.mat.color.copy(this.tmp2.copy(c.danger).lerp(c.amber, 0.3).lerp(c.data, Math.max(scan * 0.7, calm)));
    this.particles.mat.size = 0.085 + risk * 0.03;
    this.tmp.copy(c.bg).lerp(c.bgRisk, risk).lerp(c.bgCalm, calm);
    this.renderer.setClearColor(this.tmp, 1);
    (this.scene.fog as Three.FogExp2).color.copy(this.tmp);
    this.redLight.intensity = 60 * (0.25 + risk) * (1 - calm);
    this.blueLight.intensity = 70 * (scan * 0.8 + calm * 0.7);
    this.warmLight.intensity = 8 + 8 * fx.fin;

    // 카메라: 장면 키 사이를 부드럽게 옮기고, 포인터로 살짝 시차를 준다
    const i0 = Math.min(CAMERA_KEYS.length - 2, Math.floor(F));
    const fr = F - i0;
    const e = fr * fr * fr * (fr * (fr * 6 - 15) + 10);
    const A = CAMERA_KEYS[i0];
    const B = CAMERA_KEYS[i0 + 1];
    const P = this.v.a.set(lerp(A.p[0], B.p[0], e), lerp(A.p[1], B.p[1], e), lerp(A.p[2], B.p[2], e));
    const center = this.v.b.set(0, lerp(A.ty, B.ty, e), 0);
    let shift = lerp(A.sh, B.sh, e);
    if (mobile) {
      shift = 0;
      center.y -= 1.0;
    }
    const dist = (1 + intro * 0.8 + (mobile ? 0.4 : 0)) * (1 + 0.03 * Math.sin(t * 0.25));
    P.sub(center).multiplyScalar(dist).add(center);
    const fwd = this.v.c.copy(center).sub(P).normalize();
    const right = this.v.d.crossVectors(fwd, this.up).normalize();
    const upv = this.v.e.crossVectors(right, fwd);
    const pk = 1 - Math.exp(-dt * 3);
    this.smoothPointer.x += (pointer.x - this.smoothPointer.x) * pk;
    this.smoothPointer.y += (pointer.y - this.smoothPointer.y) * pk;
    this.camera.position.copy(P).add(this.v.f.copy(right).multiplyScalar(-shift + this.smoothPointer.x * 0.7).addScaledVector(upv, -this.smoothPointer.y * 0.45));
    center.addScaledVector(right, -shift);
    this.camera.lookAt(center);

    // 섬 흔들림과 집 회전
    this.island.position.y = Math.sin(t * 0.9) * 0.09 * (1 - fx.fin * 0.6);
    this.island.rotation.z = Math.sin(t * 1.9) * 0.014 * risk;
    this.island.rotation.x = Math.cos(t * 1.5) * 0.01 * risk;
    if (!dragging) {
      this.dragRot += this.dragVel;
      this.dragVel *= Math.pow(0.9, dt * 60);
    }
    this.auto += dt * 0.07 * (1 - scan) * (1 - fx.result * (1 - fx.fin) * 0.8);
    this.house.rotation.y = -0.35 + this.auto + this.dragRot;

    // 창문: 위험 장면에서 깜빡이고 마지막 장면에서 모두 켜진다
    if (t - this.windowTime > 0.09) {
      this.windowTime = t;
      this.windowSeeds.forEach((seed, i) => {
        let lit = seed > 0.38 ? 1 : 0.12;
        if (risk > 0.2 && Math.sin(t * (7 + seed * 17) + seed * 50) > 0.8) lit = 0.04;
        lit = lerp(lit, 1, calm);
        this.tmp.copy(c.window).multiplyScalar(lit * lerp(0.6, 1.3, calm));
        if (seed > 0.82) this.tmp.lerp(c.danger, risk * 0.6);
        this.windows.setColorAt(i, this.tmp);
      });
      if (this.windows.instanceColor) this.windows.instanceColor.needsUpdate = true;
    }

    // 입자: 위험할수록 흩어지고 빨라지며, 가라앉으면 바닥 고리로 모인다
    const chaos = 1 - calm * 0.85;
    const spin = 1 + risk * 1.6 - calm * 0.5;
    const { meta, pos, geo } = this.particles;
    meta.forEach((m, i) => {
      const ang = m.a + t * m.s * spin;
      const rr = lerp(m.r, 5.4 + (i % 9) * 0.09, calm * 0.85);
      const hh = lerp(m.h + Math.sin(t * 0.6 + m.ph) * 0.4 * chaos, 0.55 + (i % 7) * 0.035 + Math.sin(ang * 3 + t) * 0.06, calm * 0.85);
      pos[i * 3] = Math.cos(ang) * rr;
      pos[i * 3 + 1] = hh;
      pos[i * 3 + 2] = Math.sin(ang) * rr;
    });
    geo.attributes.position.needsUpdate = true;

    // 서류: 흩날리다 → 둘레에 정렬 → 집 옆에 쌓인다
    const stack = smoothstep(2.55, 3.25, F);
    const order = fx.order;
    const jitter = risk * 0.02;
    this.docs.forEach((d, j) => {
      const p = d.userData as { r: number; a: number; h: number; sp: number; rs: number[] };
      const a = p.a + t * p.sp;
      const cx = Math.cos(a) * p.r;
      const cy = p.h + Math.sin(t * 0.7 + j) * 0.3;
      const cz = Math.sin(a) * p.r;
      const oa = (j / this.docs.length) * Math.PI * 2 + t * 0.06;
      const ox = Math.cos(oa) * 4.5;
      const oy = 2.5 + ((j % 3) - 1) * 1.05;
      const oz = Math.sin(oa) * 4.5;
      const sx = 2.75 + (j % 2) * 0.05;
      const sy = 0.34 + j * 0.022;
      d.position.set(lerp(lerp(cx, ox, order), sx, stack) + (Math.random() - 0.5) * jitter, lerp(lerp(cy, oy, order), sy, stack), lerp(lerp(cz, oz, order), 2.0, stack));
      this.euler.set(t * 0.3 * p.rs[0] + j, t * 0.4 * p.rs[1] + j * 2, t * 0.2 * p.rs[2]);
      this.q[0].setFromEuler(this.euler);
      this.helper.position.set(ox, oy, oz);
      this.helper.lookAt(ox * 2, oy, oz * 2);
      this.q[1].copy(this.helper.quaternion);
      this.euler.set(-Math.PI / 2, 0, j * 0.18 - 0.7);
      this.q[2].setFromEuler(this.euler);
      d.quaternion.copy(this.q[0]).slerp(this.q[1], order).slerp(this.q[2], stack);
    });

    this.rings.forEach((m, k2) => {
      m.rotation.x = (m.userData.bx as number) + Math.sin(t * 0.5 + k2) * 0.18;
      m.rotation.z = (m.userData.bz as number) + t * (0.25 + k2 * 0.12) * (k2 % 2 ? -1 : 1);
      m.scale.setScalar(1 + Math.sin(t * 2.4 + k2 * 1.3) * 0.025 * (1 + risk));
      m.material.opacity = risk * (0.55 + 0.35 * Math.sin(t * 3 + k2));
      m.material.color.copy(c.danger).lerp(c.data, scan);
      m.visible = m.material.opacity > 0.005;
    });
    const waveAmount = risk * 0.85 + fx.fin * 0.5;
    this.waves.forEach((m, k2) => {
      const ph = (t * 0.42 + k2 / 3) % 1;
      m.scale.setScalar(1 + ph * 6.6);
      m.material.opacity = (1 - ph) * (1 - ph) * waveAmount;
      m.material.color.copy(c.danger).lerp(c.calm, calm);
      m.visible = waveAmount > 0.01;
    });
    this.riskGroup.rotation.y = t * 0.09;
    this.alerts.forEach((s, i) => {
      const ap = riskAppear(i, F);
      s.material.opacity = ap;
      s.visible = ap > 0.01;
      s.scale.setScalar(Math.max(0.001, 0.62 * ap * (1 + Math.sin(t * 4 + i) * 0.06)));
      s.position.y = (s.userData.by as number) + Math.sin(t * 1.3 + i) * 0.12;
    });
    this.crackMat.opacity = risk * (0.55 + 0.45 * Math.abs(Math.sin(t * 7.3))) * (1 - scan * 0.6);

    this.scanGroup.visible = scan > 0.01;
    this.scanGroup.position.y = 0.45 + (0.5 + 0.5 * Math.sin(t * 1.5)) * 4.15;
    this.scanGroup.rotation.y = this.house.rotation.y;
    this.scanMat.opacity = scan * 0.14;
    this.scanEdgeMat.opacity = scan;
    this.radar.visible = scan > 0.01;
    this.radar.rotation.z -= dt * 1.9;
    this.radarMat.opacity = scan * 0.95;

    // 게이지: 주의 기준 미만 블루, 주의 잉크, 위험 레드
    const gaugeScale = fx.result * (1 - fx.fin);
    // 좁은 폭에서는 게이지가 화면 밖으로 잘리고 글과 겹쳐 그리지 않는다.
    this.gaugeGroup.visible = gaugeScale > 0.01 && !mobile;
    this.gaugeGroup.scale.setScalar(Math.max(0.001, gaugeScale));
    this.gaugeGroup.quaternion.copy(this.camera.quaternion);
    this.gaugeGroup.position.y = 3.4 + Math.sin(t * 1.1) * 0.08 - (1 - gaugeScale) * 0.6;
    const frac = clamp((this.jr - GAUGE_MIN) / GAUGE_SPAN);
    const cautionAt = (JEONSE_RATIO_THRESHOLD.caution - GAUGE_MIN) / GAUGE_SPAN;
    const dangerAt = (JEONSE_RATIO_THRESHOLD.danger - GAUGE_MIN) / GAUGE_SPAN;
    for (let k2 = 0; k2 < LandingScene.TICKS; k2++) {
      const p = k2 / (LandingScene.TICKS - 1);
      const zone = p < cautionAt ? c.data : p < dangerAt ? c.ink : c.danger;
      if (p <= frac) this.tmp.copy(zone).multiplyScalar(1.4);
      else this.tmp.copy(c.dim);
      this.ticks.setColorAt(k2, this.tmp);
    }
    if (this.ticks.instanceColor) this.ticks.instanceColor.needsUpdate = true;
    this.needle.rotation.z = LandingScene.ARC_START - frac * LandingScene.ARC_SWEEP - Math.PI / 2;

    this.dome.visible = fx.fin > 0.01;
    this.domeMat.uniforms.uOp.value = fx.fin;
    this.domeMat.uniforms.uT.value = t;
    if (this.bloom) this.bloom.strength = 0.7 + risk * 0.35 - fx.fin * 0.2;

    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  // 3D 표식의 화면 좌표. 집보다 뒤에 있으면 distance가 houseDistance보다 크다.
  project(target: "risk" | "data" | "gauge", i = 0): ScreenPoint {
    const obj = target === "risk" ? this.alerts[i] : target === "data" ? this.dataAnchors[i] : this.gaugeLabel;
    const p = this.v.p;
    obj.getWorldPosition(p);
    const distance = p.distanceTo(this.camera.position);
    p.project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight, visible: p.z < 1, distance };
  }

  get houseDistance() {
    return this.v.h.set(0, 2.4, 0).distanceTo(this.camera.position);
  }

  dispose() {
    this.renderer.dispose();
    this.composer?.dispose();
    this.renderer.domElement.remove();
  }
}
