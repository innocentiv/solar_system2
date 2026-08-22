/**
 * Application entry point.
 */
import { buildScene } from "./sim/scene";
import { Simulation } from "./sim/simulation";
import { UI } from "./ui/ui";

const container = document.getElementById("app");
if (!container) throw new Error("Missing #app container");

const refs = buildScene(container);
const sim = new Simulation(container, refs);
const ui = new UI(sim);
void ui;

// Resize handling
const onResize = (): void => {
 const w = container.clientWidth;
 const h = container.clientHeight;
 refs.camera.aspect = w / h;
 refs.camera.updateProjectionMatrix();
 refs.renderer.setSize(w, h);
 refs.labelRenderer.setSize(w, h);
 refs.composer.setSize(w, h);
};
window.addEventListener("resize", onResize);

const frame = (nowMs: number): void => {
 sim.tick(nowMs);
 requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
