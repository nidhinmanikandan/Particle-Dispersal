import React, { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const DEFAULT_IMAGE = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 360 360"><rect width="360" height="360" fill="#050606"/><defs><radialGradient id="g"><stop stop-color="#ffffff"/><stop offset=".56" stop-color="#d8e2e3"/><stop offset="1" stop-color="#263334"/></radialGradient></defs><circle cx="180" cy="180" r="112" fill="url(#g)"/><circle cx="144" cy="148" r="10" fill="#101414"/><circle cx="216" cy="148" r="10" fill="#101414"/><path d="M135 205 Q180 255 225 205" fill="none" stroke="#101414" stroke-width="8" stroke-linecap="round"/></svg>`)}`;

function makeParticles(image, density, depth) {
  const canvas = document.createElement("canvas");
  const aspect = image.naturalWidth / image.naturalHeight;
  const imageScale = Math.min(
    1024 / image.naturalWidth,
    1024 / image.naturalHeight,
  );
  canvas.width = Math.max(1, Math.round(image.naturalWidth * imageScale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * imageScale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const columns = Math.max(1, Math.floor(Math.sqrt(density * aspect)));
  const rows = Math.max(1, Math.ceil(density / columns));
  const positions = new Float32Array(density * 3);
  const colors = new Float32Array(density * 4);
  const originals = new Float32Array(density * 3);
  const phases = new Float32Array(density);
  let count = 0;
  const linearize = (value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  for (let sample = 0; sample < density; sample++) {
    const column = sample % columns,
      row = Math.floor(sample / columns);
    const x = Math.min(
      canvas.width - 1,
      Math.floor(((column + 0.5) * canvas.width) / columns),
    );
    const y = Math.min(
      canvas.height - 1,
      Math.floor(((row + 0.5) * canvas.height) / rows),
    );
    const i = (y * canvas.width + x) * 4;
    const r = pixels[i],
      g = pixels[i + 1],
      b = pixels[i + 2],
      a = pixels[i + 3] / 255;
    const lum = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
    if (a < 0.08) continue;
    const px = ((column + 0.5) / columns - 0.5) * aspect;
    const py = -((row + 0.5) / rows - 0.5);
    const pz = (lum - 0.5) * depth * 0.18;
    const i3 = count * 3,
      i4 = count * 4;
    positions[i3] = px;
    positions[i3 + 1] = py;
    positions[i3 + 2] = pz;
    originals[i3] = px;
    originals[i3 + 1] = py;
    originals[i3 + 2] = pz;
    colors[i4] = linearize(r / 255);
    colors[i4 + 1] = linearize(g / 255);
    colors[i4 + 2] = linearize(b / 255);
    colors[i4 + 3] = a;
    phases[count] = Math.random() * Math.PI * 2;
    count++;
  }
  const trackCount = Math.min(24, count);
  const trackIndices = new Uint32Array(trackCount);
  const shuffledIndices = new Uint32Array(count);
  for (let i = 0; i < count; i++) shuffledIndices[i] = i;
  for (let i = 0; i < trackCount; i++) {
    const selected = i + Math.floor(Math.random() * (count - i));
    [shuffledIndices[i], shuffledIndices[selected]] = [
      shuffledIndices[selected],
      shuffledIndices[i],
    ];
    trackIndices[i] = shuffledIndices[i];
  }
  return {
    positions: positions.subarray(0, count * 3),
    colors: colors.subarray(0, count * 4),
    originals: originals.subarray(0, count * 3),
    phases: phases.subarray(0, count),
    trackIndices,
    aspect,
  };
}

export default function App() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cloudRef = useRef(null);
  const pointsDataRef = useRef(null);
  const rebuildIdRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0 });
  const hudRef = useRef(null);
  const trackRefs = useRef([]);
  const trackLabelRefs = useRef([]);
  const connectionRef = useRef(null);
  const zoomSliderRef = useRef(null);
  const zoomTargetDistanceRef = useRef(null);
  const fileRef = useRef(null);
  const [density, setDensity] = useState(50000);
  const [particleSize, setParticleSize] = useState(0.9);
  const particleSizeRef = useRef(particleSize);
  const [depth, setDepth] = useState(1.25);
  const [motion, setMotion] = useState(0.55);
  const [uploadedName, setUploadedName] = useState("SAMPLE_FORM.svg");
  const [isPaused, setIsPaused] = useState(false);
  const [hudOn, setHudOn] = useState(true);
  const [pointCount, setPointCount] = useState(0);
  const [imageSrc, setImageSrc] = useState(DEFAULT_IMAGE);
  const settingsRef = useRef({ density, depth, motion, isPaused, hudOn });
  useEffect(() => {
    settingsRef.current = { density, depth, motion, isPaused, hudOn };
  }, [density, depth, motion, isPaused, hudOn]);
  useEffect(() => {
    particleSizeRef.current = particleSize;
    if (cloudRef.current) cloudRef.current.material.size = particleSize;
  }, [particleSize]);

  const rebuild = useCallback(
    (src, d = settingsRef.current.density, z = settingsRef.current.depth) => {
      const rebuildId = ++rebuildIdRef.current;
      const image = new Image();
      image.onload = () => {
        if (rebuildId !== rebuildIdRef.current) return;
        const scene = sceneRef.current?.scene;
        if (!scene) return;
        const { camera, initialCameraDistance } = sceneRef.current;
        const baseViewHeight =
          2 *
          Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
          initialCameraDistance;
        const fitScale = Math.min(
          baseViewHeight * 0.7,
          (baseViewHeight * camera.aspect * 0.7) /
            (image.naturalWidth / image.naturalHeight),
        );
        const data = makeParticles(image, d, z);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(data.positions, 3),
        );
        geometry.setAttribute(
          "color",
          new THREE.BufferAttribute(data.colors, 4),
        );
        const material = new THREE.PointsMaterial({
          size: particleSizeRef.current,
          vertexColors: true,
          transparent: true,
          opacity: 1,
          sizeAttenuation: false,
          depthWrite: false,
        });
        const next = new THREE.Points(geometry, material);
        next.frustumCulled = false;
        if (cloudRef.current) {
          scene.remove(cloudRef.current);
          cloudRef.current.geometry.dispose();
          cloudRef.current.material.dispose();
        }
        next.scale.setScalar(fitScale);
        scene.add(next);
        cloudRef.current = next;
        pointsDataRef.current = data;
        setPointCount(data.positions.length / 3);
      };
      image.src = src;
    },
    [],
  );

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050606");
    const camera = new THREE.PerspectiveCamera(
      43,
      host.clientWidth / host.clientHeight,
      0.1,
      100,
    );
    camera.position.set(0, 0, 8.8);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    const initialCameraDistance = camera.position.distanceTo(controls.target);
    controls.minDistance = initialCameraDistance / 15;
    controls.maxDistance = initialCameraDistance * 2;
    controls.addEventListener("start", () => {
      zoomTargetDistanceRef.current = null;
    });
    const grid = new THREE.Group();
    const gridMat = new THREE.LineBasicMaterial({
      color: 0x273032,
      transparent: true,
      opacity: 0.45,
    });
    const addLine = (a, b) => {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...a),
        new THREE.Vector3(...b),
      ]);
      grid.add(new THREE.Line(geo, gridMat));
    };
    for (let i = -5; i <= 5; i++) {
      const p = i * 0.52;
      addLine([p, -3.1, -2.5], [p, 3.1, -2.5]);
      addLine([-5.1, p * 0.57, -2.5], [5.1, p * 0.57, -2.5]);
    }
    scene.add(grid);
    sceneRef.current = {
      scene,
      camera,
      renderer,
      controls,
      initialCameraDistance,
    };
    rebuild(imageSrc);
    let raf;
    const projectedTracks = Array.from({ length: 24 }, () => ({
      world: new THREE.Vector3(),
      point: new THREE.Vector3(),
      x: 0,
      y: 0,
      visible: false,
    }));
    const connectionFlags = new Uint8Array(24 * 24);
    const labelCandidates = [
      { x: 10, y: -9, anchor: "start" },
      { x: -10, y: -9, anchor: "end" },
      { x: 10, y: 11, anchor: "start" },
      { x: -10, y: 11, anchor: "end" },
      { x: 10, y: -18, anchor: "start" },
      { x: -10, y: -18, anchor: "end" },
      { x: 10, y: 20, anchor: "start" },
      { x: -10, y: 20, anchor: "end" },
    ];
    const clock = new THREE.Clock();
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const settings = settingsRef.current;
      controls.update();
      const zoomTargetDistance = zoomTargetDistanceRef.current;
      if (zoomTargetDistance !== null) {
        const offset = camera.position.clone().sub(controls.target);
        const currentDistance = offset.length();
        const nextDistance = THREE.MathUtils.lerp(
          currentDistance,
          zoomTargetDistance,
          0.22,
        );
        offset.setLength(nextDistance);
        camera.position.copy(controls.target).add(offset);
        if (Math.abs(nextDistance - zoomTargetDistance) < 0.001) {
          offset.setLength(zoomTargetDistance);
          camera.position.copy(controls.target).add(offset);
          zoomTargetDistanceRef.current = null;
        }
      }
      if (zoomSliderRef.current) {
        const zoomFactor =
          initialCameraDistance / camera.position.distanceTo(controls.target);
        zoomSliderRef.current.value = String(
          THREE.MathUtils.clamp(zoomFactor, 0.5, 15),
        );
      }
      const cloud = cloudRef.current,
        data = pointsDataRef.current;
      if (cloud && data) {
        const attr = cloud.geometry.attributes.position;
        if (!settings.isPaused) {
          for (let i = 0; i < data.originals.length; i += 3) {
            const p = i / 3,
              phase = data.phases[p];
            const ox = data.originals[i],
              oy = data.originals[i + 1],
              oz = data.originals[i + 2];
            const drift = settings.motion;
            attr.array[i] =
              ox + Math.sin(t * 0.7 + phase + oy * 2) * 0.018 * drift;
            attr.array[i + 1] =
              oy + Math.cos(t * 0.55 + phase + ox * 1.5) * 0.02 * drift;
            attr.array[i + 2] = oz + Math.sin(t * 0.9 + phase) * 0.08 * drift;
          }
          attr.needsUpdate = true;
          cloud.rotation.y =
            Math.sin(t * 0.18) * 0.12 + pointerRef.current.x * 0.18;
          cloud.rotation.x =
            Math.cos(t * 0.16) * 0.07 - pointerRef.current.y * 0.12;
        }
        if (hudRef.current)
          hudRef.current.style.display = settings.hudOn ? "" : "none";
        if (settings.hudOn && data.trackIndices.length) {
          cloud.updateMatrixWorld(true);
          camera.updateMatrixWorld();
          const w = host.clientWidth,
            h = host.clientHeight;
          const count = data.trackIndices.length;
          const placedLabels = [];
          for (let n = 0; n < count; n++) {
            const idx = data.trackIndices[n];
            const i = idx * 3;
            const tracked = projectedTracks[n];
            tracked.world
              .set(attr.array[i], attr.array[i + 1], attr.array[i + 2])
              .applyMatrix4(cloud.matrixWorld);
            tracked.point.copy(tracked.world).project(camera);
            tracked.x = (tracked.point.x * 0.5 + 0.5) * w;
            tracked.y = (-tracked.point.y * 0.5 + 0.5) * h;
            tracked.visible =
              tracked.point.z >= -1 &&
              tracked.point.z <= 1 &&
              tracked.x >= 0 &&
              tracked.x <= w &&
              tracked.y >= 0 &&
              tracked.y <= h;
            const marker = trackRefs.current[n];
            if (marker) {
              marker.style.display = tracked.visible ? "" : "none";
              if (tracked.visible)
                marker.setAttribute(
                  "transform",
                  `translate(${tracked.x.toFixed(1)} ${tracked.y.toFixed(1)})`,
                );
            }
            const label = trackLabelRefs.current[n];
            if (label && tracked.visible) {
              const text = `${String(n + 1).padStart(2, "0")}  ${tracked.point.x.toFixed(2)} ${tracked.point.y.toFixed(2)} ${tracked.point.z.toFixed(2)}`;
              const width = text.length * 4.2;
              let chosen = labelCandidates[0];
              let bestOverlap = Infinity;
              for (const candidate of labelCandidates) {
                const left =
                  candidate.anchor === "start"
                    ? tracked.x + candidate.x
                    : tracked.x + candidate.x - width;
                const top = tracked.y + candidate.y - 8;
                const right = left + width,
                  bottom = top + 10;
                let overlap = 0;
                for (const placed of placedLabels) {
                  const overlapX = Math.max(
                    0,
                    Math.min(right, placed.right) - Math.max(left, placed.left),
                  );
                  const overlapY = Math.max(
                    0,
                    Math.min(bottom, placed.bottom) - Math.max(top, placed.top),
                  );
                  overlap += overlapX * overlapY;
                }
                const outside =
                  Math.max(0, 2 - left) +
                  Math.max(0, right - (w - 2)) +
                  Math.max(0, 2 - top) +
                  Math.max(0, bottom - (h - 2));
                overlap += outside * width;
                if (overlap < bestOverlap) {
                  bestOverlap = overlap;
                  chosen = candidate;
                }
                if (overlap === 0) break;
              }
              const left =
                chosen.anchor === "start"
                  ? tracked.x + chosen.x
                  : tracked.x + chosen.x - width;
              const top = tracked.y + chosen.y - 8;
              placedLabels.push({
                left,
                right: left + width,
                top,
                bottom: top + 10,
              });
              label.textContent = text;
              label.setAttribute("x", String(chosen.x));
              label.setAttribute("y", String(chosen.y));
              label.setAttribute("text-anchor", chosen.anchor);
            }
          }
          if (connectionRef.current) {
            connectionFlags.fill(0);
            for (let i = 0; i < count; i++) {
              const nearest = [-1, -1];
              const distances = [Infinity, Infinity];
              const from = projectedTracks[i].world;
              for (let j = 0; j < count; j++) {
                if (i === j) continue;
                const distance = from.distanceToSquared(
                  projectedTracks[j].world,
                );
                if (distance < distances[0]) {
                  distances[1] = distances[0];
                  nearest[1] = nearest[0];
                  distances[0] = distance;
                  nearest[0] = j;
                } else if (distance < distances[1]) {
                  distances[1] = distance;
                  nearest[1] = j;
                }
              }
              for (const neighbor of nearest) {
                if (neighbor >= 0) {
                  connectionFlags[i * count + neighbor] = 1;
                  connectionFlags[neighbor * count + i] = 1;
                }
              }
            }
            const paths = [];
            for (let i = 0; i < count; i++) {
              for (let j = i + 1; j < count; j++) {
                if (!connectionFlags[i * count + j]) continue;
                const from = projectedTracks[i],
                  to = projectedTracks[j];
                if (from.visible && to.visible)
                  paths.push(
                    `M${from.x.toFixed(1)},${from.y.toFixed(1)}L${to.x.toFixed(1)},${to.y.toFixed(1)}`,
                  );
              }
            }
            connectionRef.current.setAttribute("d", paths.join(""));
          }
        } else if (connectionRef.current) {
          connectionRef.current.setAttribute("d", "");
        }
      }
      renderer.render(scene, camera);
    };
    animate();
    const resize = () => {
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
      if (cloudRef.current && pointsDataRef.current) {
        const viewHeight =
          2 *
          Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
          initialCameraDistance;
        const data = pointsDataRef.current;
        cloudRef.current.scale.setScalar(
          Math.min(
            viewHeight * 0.7,
            (viewHeight * camera.aspect * 0.7) / data.aspect,
          ),
        );
      }
    };
    const move = (e) => {
      const r = host.getBoundingClientRect();
      pointerRef.current = {
        x: ((e.clientX - r.left) / r.width - 0.5) * 2,
        y: ((e.clientY - r.top) / r.height - 0.5) * 2,
      };
    };
    window.addEventListener("resize", resize);
    host.addEventListener("pointermove", move);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      host.removeEventListener("pointermove", move);
      controls.dispose();
      if (cloudRef.current) {
        scene.remove(cloudRef.current);
        cloudRef.current.geometry.dispose();
        cloudRef.current.material.dispose();
        cloudRef.current = null;
        pointsDataRef.current = null;
      }
      renderer.dispose();
      if (renderer.domElement.parentNode === host)
        host.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, [rebuild]);

  useEffect(() => {
    if (sceneRef.current) rebuild(imageSrc, density, depth);
  }, [density, depth, imageSrc, rebuild]);

  const onUpload = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result);
      setUploadedName(file.name.toUpperCase().slice(0, 28));
    };
    reader.readAsDataURL(file);
  };
  const setZoomFactor = (factor) => {
    const view = sceneRef.current;
    if (!view) return;
    const nextFactor = THREE.MathUtils.clamp(factor, 0.5, 15);
    zoomTargetDistanceRef.current = THREE.MathUtils.clamp(
      view.initialCameraDistance / nextFactor,
      view.controls.minDistance,
      view.controls.maxDistance,
    );
  };
  const zoom = (factor) => {
    const view = sceneRef.current;
    if (!view) return;
    const distance = view.camera.position.distanceTo(view.controls.target);
    setZoomFactor((view.initialCameraDistance / distance) * factor);
  };
  const resetView = () => {
    zoomTargetDistanceRef.current = null;
    sceneRef.current?.controls.reset();
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">✳</span>
          <span>
            FIELD<span className="muted"> / </span>STUDIES
          </span>
          <small>PARTICLE RESEARCH UNIT</small>
        </div>
        <div className="top-meta">
          <span className="live-dot" /> LIVE SIMULATION{" "}
          <span className="divider-v" /> WEBGL / 01
        </div>
      </header>
      <section className="workspace">
        <div className="scene-head">
          <div>
            <p className="eyebrow">IMAGE → SPATIAL DATA</p>
            <h1>
              Particle <em>observatory</em>
            </h1>
          </div>
          <div className="scene-status">
            <span className="status-square" /> SYSTEM ONLINE
            <br />
            <small>{pointCount.toLocaleString()} POINTS GENERATED</small>
          </div>
        </div>
        <div className="viewer-frame">
          <div className="viewport" ref={mountRef}>
            <svg className="hud-layer" ref={hudRef} aria-hidden="true">
              <path className="track-network" ref={connectionRef} />
              {Array.from({ length: 24 }, (_, i) => (
                <g
                  className="track"
                  key={i}
                  ref={(element) => {
                    trackRefs.current[i] = element;
                  }}
                >
                  <path
                    className="track-brackets"
                    d="M-8 -3V-8H-3 M3 -8H8V-3 M8 3V8H3 M-3 8H-8V3"
                  />
                  <text
                    className="track-label"
                    x="11"
                    y="-8"
                    ref={(element) => {
                      trackLabelRefs.current[i] = element;
                    }}
                  />
                </g>
              ))}
            </svg>
            <div className="frame-corner tl" />
            <div className="frame-corner tr" />
            <div className="frame-corner bl" />
            <div className="frame-corner br" />
            <div className="ruler ruler-top" />
            <div className="ruler ruler-left" />
            <div className="view-label top-left">
              FIG. 01 <span>/</span> DEPTH FIELD
            </div>
            <div className="view-label top-right">X / Y / Z</div>
            <div className="view-controls" aria-label="View controls">
              <button
                type="button"
                onClick={() => zoom(1.2)}
                aria-label="Zoom in"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => zoom(1 / 1.2)}
                aria-label="Zoom out"
              >
                −
              </button>
              <label className="zoom-slider" aria-label="Zoom level">
                <input
                  ref={zoomSliderRef}
                  type="range"
                  min=".5"
                  max="15"
                  step=".1"
                  defaultValue="1"
                  onChange={(event) =>
                    setZoomFactor(Number(event.target.value))
                  }
                />
                <span>15×</span>
              </label>
              <button type="button" onClick={resetView}>
                RESET VIEW
              </button>
            </div>
            <div className="view-label bottom-left">SOURCE: {uploadedName}</div>
            <div className="view-label bottom-right">
              DRIFT{" "}
              {Math.round(motion * 100)
                .toString()
                .padStart(2, "0")}
            </div>
            <div className="crosshair">
              <span />
              <i />
            </div>
          </div>
          <div className="viewer-footer">
            <span>
              <b className="mini-dot" /> PARTICLE FIELD ACTIVE
            </span>
            <span>DRAG TO ORBIT · SCROLL TO ZOOM</span>
            <span>LOCAL RENDER / NO API</span>
          </div>
        </div>
        <div className="lower-grid">
          <section className="panel source-panel">
            <div className="panel-title">
              <span>01 / INPUT SOURCE</span>
              <span className="tiny-icon">↗</span>
            </div>
            <div
              className="upload-zone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onUpload(e.dataTransfer.files?.[0]);
              }}
            >
              <div className="upload-symbol">＋</div>
              <div>
                <strong>Drop an image to scan</strong>
                <p>PNG · JPG · WEBP · SVG</p>
              </div>
              <button
                className="outline-btn"
                onClick={() => fileRef.current?.click()}
              >
                BROWSE
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => onUpload(e.target.files?.[0])}
              />
            </div>
            <div className="source-foot">
              <span>IMAGE IS PROCESSED LOCALLY</span>
              <span>MAX RECOMMENDED 12 MB</span>
            </div>
          </section>
          <section className="panel controls-panel">
            <div className="panel-title">
              <span>02 / FIELD PARAMETERS</span>
              <span className="tiny-icon">⌘</span>
            </div>
            <label className="range-row">
              <span>Particle density</span>
              <output>{density.toLocaleString()}</output>
              <input
                type="range"
                min="50000"
                max="100000"
                step="5000"
                value={density}
                onChange={(e) => setDensity(Number(e.target.value))}
              />
              <span className="range-minmax">
                <i>50,000</i>
                <i>100,000</i>
              </span>
            </label>
            <label className="range-row">
              <span>Particle size</span>
              <output>{particleSize.toFixed(1)} px</output>
              <input
                type="range"
                min=".5"
                max="1.5"
                step=".1"
                value={particleSize}
                onChange={(e) => setParticleSize(Number(e.target.value))}
              />
              <span className="range-minmax">
                <i>FINE</i>
                <i>SOFT</i>
              </span>
            </label>
            <label className="range-row">
              <span>Depth displacement</span>
              <output>{depth.toFixed(2)}×</output>
              <input
                type="range"
                min="0"
                max="3"
                step=".05"
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
              />
              <span className="range-minmax">
                <i>FLAT</i>
                <i>DEEP</i>
              </span>
            </label>
            <label className="range-row">
              <span>Particle drift</span>
              <output>{Math.round(motion * 100)}%</output>
              <input
                type="range"
                min="0"
                max="1.5"
                step=".05"
                value={motion}
                onChange={(e) => setMotion(Number(e.target.value))}
              />
              <span className="range-minmax">
                <i>STILL</i>
                <i>FLUID</i>
              </span>
            </label>
          </section>
          <section className="panel tracking-panel">
            <div className="panel-title">
              <span>03 / TRACKING</span>
              <span className="tracking-symbol">⌗</span>
            </div>
            <div className="tracking-preview">
              <div className="target-box">
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="tracking-copy">
                <strong>POINT LOCK</strong>
                <p>SCREEN-SPACE PROJECTION</p>
                <p>CONTINUOUS POSITION UPDATE</p>
              </div>
            </div>
            <div className="toggle-row">
              <span>Tracking annotations</span>
              <button
                className={`toggle ${hudOn ? "on" : ""}`}
                onClick={() => setHudOn((v) => !v)}
                aria-label="Toggle tracking annotations"
              >
                <span />
              </button>
            </div>
            <div className="toggle-row">
              <span>Pause particle field</span>
              <button
                className={`toggle ${isPaused ? "on" : ""}`}
                onClick={() => setIsPaused((v) => !v)}
                aria-label="Pause particle field"
              >
                <span />
              </button>
            </div>
          </section>
        </div>
        <footer className="page-footer">
          <span>FIELD STUDIES © 2026</span>
          <span>
            GENERATIVE VISUAL SYSTEMS <i>•</i> EXPERIMENT 001
          </span>
          <span>BUILT WITH THREE.JS</span>
        </footer>
      </section>
    </main>
  );
}
