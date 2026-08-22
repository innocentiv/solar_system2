/**
 * Simulation core: time propagation, per-frame position updates,
 * camera fly-to / follow, and raycast picking.
 */
import * as THREE from "three";
import type { SceneRefs, BodyScene } from "./scene";
import { AU_IN_SCENE_UNITS } from "../data/celestialBodies";
import { daysSinceJ2000, heliocentricPosition, toScene } from "./kepler";

export type SpeedPresetId =
  | "paused"
  | "1h"
  | "1d"
  | "1w"
  | "1mo"
  | "3mo"
  | "1y"
  | "5y"
  | "50y";

export const SPEED_PRESETS: {
  id: SpeedPresetId;
  label: string;
  daysPerSec: number;
}[] = [
  { id: "paused", label: "⏸ Paused", daysPerSec: 0 },
  { id: "1h", label: "1 hour/s", daysPerSec: 1 / 24 },
  { id: "1d", label: "1 day/s", daysPerSec: 1 },
  { id: "1w", label: "1 week/s", daysPerSec: 7 },
  { id: "1mo", label: "1 month/s", daysPerSec: 30.44 },
  { id: "3mo", label: "3 months/s", daysPerSec: 91.3 },
  { id: "1y", label: "1 year/s", daysPerSec: 365.25 },
  { id: "5y", label: "5 years/s", daysPerSec: 1826.25 },
  { id: "50y", label: "50 years/s", daysPerSec: 18262.5 },
];

const TWEEN_MS = 1600;
const ease = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

interface CameraTween {
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  startMs: number;
  durationMs: number;
}

export class Simulation {
  private refs: SceneRefs;
  private simDays = 0; // days since J2000
  private daysPerSec = 1; // default: 1 day per second
  private selectedId: string | null = null;
  private tween: CameraTween | null = null;
  private lastFrameMs = performance.now();
  private previousPositions = new Map<string, THREE.Vector3>();
  onDateChange?: (date: Date) => void;
  onBodySelected?: (id: string | null) => void;

  constructor(
    private container: HTMLElement,
    refs: SceneRefs,
  ) {
    this.refs = refs;
    // Prime positions before the first frame
    const days = this.simDays;
    for (const [id, bs] of refs.bodies) {
      this.placeBody(bs, days);
      this.previousPositions.set(id, bs.group.position.clone());
    }
    this.container.addEventListener("click", this.handlePointer);
    this.container.addEventListener("pointermove", this.handleHover);
    this.container.addEventListener("pointerdown", this.handlePointerDown);
    window.addEventListener("keydown", this.handleKey);
  }

  dispose(): void {
    this.container.removeEventListener("click", this.handlePointer);
    this.container.removeEventListener("pointermove", this.handleHover);
    this.container.removeEventListener("pointerdown", this.handlePointerDown);
    window.removeEventListener("keydown", this.handleKey);
  }

  // --- Time ---------------------------------------------------------------

  get currentSpeedId(): SpeedPresetId {
    const p = SPEED_PRESETS.find((s) => s.daysPerSec === this.daysPerSec);
    return p ? p.id : "1d";
  }

  setSpeed(id: SpeedPresetId): void {
    const p = SPEED_PRESETS.find((s) => s.id === id);
    this.daysPerSec = p ? p.daysPerSec : 0;
  }

  get currentDate(): Date {
    return new Date(Date.UTC(2000, 0, 1, 12, 0, 0) + this.simDays * 86400000);
  }

  setDate(date: Date): void {
    this.simDays = daysSinceJ2000(date.getTime());
  }

  // --- Selection / camera ---------------------------------------------------

  selectBody(id: string | null): void {
    this.selectedId = id;
    this.tween = null;
    if (!id) {
      this.onBodySelected?.(null);
      return;
    }
    const bs = this.refs.bodies.get(id)!;
    const target = bs.group.position.clone();
    // True scale: approach at ~9 body radii
    const dist = Math.max(bs.radius * 9, 0.001);
    this.refs.controls.minDistance = Math.max(0.0002, dist * 0.02);

    // Approach from a direction that keeps the Sun mostly behind the camera
    const dir = this.refs.camera.position.clone().sub(target);
    if (dir.lengthSq() < 1e-6) dir.set(-1, 0.6, 1);
    dir.normalize();
    dir.y = Math.max(dir.y, 0.35); // never fly straight through the ecliptic plane
    dir.normalize();

    this.tween = {
      fromPos: this.refs.camera.position.clone(),
      fromTarget: this.refs.controls.target.clone(),
      toTarget: target,
      toPos: target.clone().addScaledVector(dir, dist),
      startMs: performance.now(),
      durationMs: TWEEN_MS,
    };
    this.onBodySelected?.(id);
  }

  get selected(): string | null {
    return this.selectedId;
  }

  // --- Frame loop -----------------------------------------------------------

  tick(nowMs: number): void {
    const dtSec = Math.min((nowMs - this.lastFrameMs) / 1000, 0.1); // clamp tab-switch spikes
    this.lastFrameMs = nowMs;

    this.frameDeltaDays = this.daysPerSec * dtSec;
    this.simDays += this.frameDeltaDays;
    this.updateBodies();
    this.updateCamera(nowMs);

    this.updateMarkers();
    this.refs.controls.update();
    this.refs.composer.render();
    this.refs.labelRenderer.render(this.refs.scene, this.refs.camera);

    this.onDateChange?.(this.currentDate);
  }

  private updateBodies(): void {
    const days = this.simDays;
    const dDays = this.frameDeltaDays;
    for (const [id, bs] of this.refs.bodies) {
      this.placeBody(bs, days);
      const prev = this.previousPositions.get(id) ?? bs.group.position.clone();
      const delta = bs.group.position.clone().sub(prev);

      // Axial spin (sign of rotationPeriodDays handles retrograde spin)
      const rotSpeed =
        bs.def.rotationPeriodDays !== 0
          ? (2 * Math.PI * dDays) / bs.def.rotationPeriodDays
          : 0;
      bs.mesh.rotation.y += rotSpeed;
      if (bs.cloudMesh) bs.cloudMesh.rotation.y += rotSpeed * 1.15;

      // Follow mode: keep the selected body centered
      if (this.selectedId === id) {
        this.refs.camera.position.add(delta);
        this.refs.controls.target.add(delta);
      }

      this.previousPositions.set(id, bs.group.position.clone());
    }
  }

  private frameDeltaDays = 0;

  private placeBody(bs: BodyScene, days: number): void {
    const def = bs.def;
    if (!def.elements) {
      bs.group.position.set(0, 0, 0);
      return;
    }
    // True scale: positions come out of the orbital elements in AU.
    // For a moon the elements are parent-centered (geocentric for the Moon),
    // so we add the parent's position after converting to scene units.
    const pos = heliocentricPosition(def.elements, days);
    const s = toScene(pos, AU_IN_SCENE_UNITS);
    if (def.parent === null) {
      bs.group.position.set(s.x, s.y, s.z);
    } else {
      const parent = this.refs.bodies.get(def.parent)!;
      bs.group.position.set(
        parent.group.position.x + s.x,
        parent.group.position.y + s.y,
        parent.group.position.z + s.z,
      );
    }
  }

  /** Keep the marker dots on their bodies; hide the selected body's dot (black + additive = invisible). */
  private updateMarkers(): void {
    const posAttr = this.refs.markers.geometry.getAttribute("position") as THREE.BufferAttribute;
    const colAttr = this.refs.markers.geometry.getAttribute("color") as THREE.BufferAttribute;
    let i = 0;
    for (const [id, bs] of this.refs.bodies) {
      posAttr.setXYZ(i, bs.group.position.x, bs.group.position.y, bs.group.position.z);
      const black = id === this.selectedId;
      colAttr.setXYZ(i, black ? 0 : colAttr.getX(i), black ? 0 : colAttr.getY(i), black ? 0 : colAttr.getZ(i));
      i++;
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }

  private updateCamera(nowMs: number): void {
    if (!this.tween) return;
    const t = Math.min((nowMs - this.tween.startMs) / this.tween.durationMs, 1);
    const k = ease(t);

    // For a selected body, re-anchor the destination to its live position
    let toPos = this.tween.toPos;
    let toTarget = this.tween.toTarget;
    if (this.selectedId) {
      const bs = this.refs.bodies.get(this.selectedId);
      if (bs) {
        const offset = this.tween.toTarget.clone().sub(this.tween.fromTarget);
        toTarget = bs.group.position;
        toPos = bs.group.position.clone().add(offset);
      }
    }

    this.refs.camera.position.lerpVectors(this.tween.fromPos, toPos, k);
    this.refs.controls.target.lerpVectors(this.tween.fromTarget, toTarget, k);

    if (t >= 1) this.tween = null;
  }

  // --- Input ----------------------------------------------------------------

  /**
   * Screen-space picking: true-scale spheres are often sub-pixel, so a
   * raycast against them is unreliable. Instead, project every body to the
   * screen and pick the one closest to the pointer (within 24 px), breaking
   * ties by camera distance.
   */
  private projected = new THREE.Vector3();

  private pickBody(ev: MouseEvent): string | null {
    const rect = this.container.getBoundingClientRect();
    const mouseX = ev.clientX - rect.left;
    const mouseY = ev.clientY - rect.top;
    const height = rect.height;

    let bestId: string | null = null;
    let bestPx = 24;
    let bestDist = Infinity;
    for (const [id, bs] of this.refs.bodies) {
      this.projected.copy(bs.group.position).project(this.refs.camera);
      if (this.projected.z > 1) continue; // behind the camera
      const px = (this.projected.x * 0.5 + 0.5) * rect.width;
      const py = (-this.projected.y * 0.5 + 0.5) * height;
      const d = Math.hypot(px - mouseX, py - mouseY);
      const camDist = this.refs.camera.position.distanceTo(bs.group.position);
      if (d < bestPx || (d === bestPx && camDist < bestDist)) {
        bestPx = d;
        bestDist = camDist;
        bestId = id;
      }
    }
    return bestId;
  }

  private downPos: { x: number; y: number } | null = null;

  private handlePointerDown = (ev: PointerEvent): void => {
    this.downPos = { x: ev.clientX, y: ev.clientY };
  };

  private handlePointer = (ev: MouseEvent): void => {
    // Ignore clicks that were actually orbit drags
    if (this.downPos) {
      const dx = ev.clientX - this.downPos.x;
      const dy = ev.clientY - this.downPos.y;
      if (dx * dx + dy * dy > 25) return;
    }
    const id = this.pickBody(ev);
    if (id) this.selectBody(id);
  };

  private handleHover = (ev: PointerEvent): void => {
    const id = this.pickBody(ev as MouseEvent);
    this.container.style.cursor = id ? "pointer" : "grab";
  };

  private handleKey = (ev: KeyboardEvent): void => {
    if (
      ev.target instanceof HTMLInputElement ||
      ev.target instanceof HTMLSelectElement
    )
      return;
    if (ev.code === "Space") {
      ev.preventDefault();
      this.selectSpeedToggle();
    } else if (ev.key === "Escape") {
      this.selectBody(null);
    } else if (ev.key === "r" || ev.key === "R") {
      this.resetView();
    }
  };

  /** Space toggles pause / previous speed. */
  private pausedSpeedFallback: number | null = null;
  selectSpeedToggle(): void {
    if (this.daysPerSec === 0) {
      this.daysPerSec = this.pausedSpeedFallback ?? 1;
      this.pausedSpeedFallback = null;
    } else {
      this.pausedSpeedFallback = this.daysPerSec;
      this.daysPerSec = 0;
    }
    this.onSpeedToggle?.();
  }
  onSpeedToggle?: () => void;

  resetView(): void {
    this.selectedId = null;
    this.onBodySelected?.(null);
    this.tween = {
      fromPos: this.refs.camera.position.clone(),
      fromTarget: this.refs.controls.target.clone(),
      toTarget: new THREE.Vector3(0, 0, 0),
      toPos: new THREE.Vector3(-140, 95, 210),
      startMs: performance.now(),
      durationMs: TWEEN_MS,
    };
  }
}
