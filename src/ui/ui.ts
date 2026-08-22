/**
 * DOM UI: time controls, body navigator, info panel, hints.
 */
import { BODIES, type CelestialBodyDef } from "../data/celestialBodies";
import {
  SPEED_PRESETS,
  type Simulation,
  type SpeedPresetId,
} from "../sim/simulation";

const SWATCH: Record<string, string> = {
  sun: "#ffc94d",
  mercury: "#9c9490",
  venus: "#e8c98a",
  earth: "#4d8fd1",
  mars: "#d1694a",
  jupiter: "#d3a982",
  saturn: "#e0cfa4",
  uranus: "#9ad4e0",
  neptune: "#4a6fd8",
  moon: "#b8b8bd",
};

const KIND_LABEL: Record<string, string> = {
  star: "G-type main-sequence star",
  planet: "Planet",
  moon: "Natural satellite",
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export class UI {
  private dateEl: HTMLElement;
  private speedButtons = new Map<SpeedPresetId, HTMLButtonElement>();
  private navButtons = new Map<string, HTMLButtonElement>();
  private infoPanel: HTMLElement;

  constructor(private sim: Simulation) {
    const app = document.getElementById("app")!;

    this.dateEl = el("div", "date-readout", this.formatDate(sim.currentDate));

    const timeRow = el("div", "time-controls");
    for (const preset of SPEED_PRESETS) {
      const btn = el("button", "speed-btn", preset.label);
      btn.addEventListener("click", () => sim.setSpeed(preset.id));
      this.speedButtons.set(preset.id, btn);
      timeRow.appendChild(btn);
    }

    const dateJump = el("div", "date-jump");
    const dateInput = el("input", "date-input");
    dateInput.type = "date";
    dateInput.max = "2100-12-31";
    dateInput.min = "1900-01-01";
    const goBtn = el("button", "go-btn", "Jump");
    goBtn.addEventListener("click", () => {
      const value = dateInput.value;
      if (!value) return;
      sim.setDate(new Date(`${value}T12:00:00Z`));
    });
    dateJump.append(dateInput, goBtn);

    const header = el("div", "panel header-panel");
    header.appendChild(el("h1", "title", "Solar System"));
    header.appendChild(
      el(
        "div",
        "subtitle",
        "True-scale 3D simulation · JPL J2000 orbital elements",
      ),
    );
    header.appendChild(this.dateEl);
    header.appendChild(timeRow);
    header.appendChild(dateJump);
    app.appendChild(header);

    const nav = el("div", "panel nav-panel");
    nav.appendChild(el("div", "panel-title", "Celestial Bodies"));
    for (const def of BODIES) {
      const btn = el("button", `nav-btn${def.parent ? " sub" : ""}`, def.name);
      const dot = el("span", "dot");
      dot.style.background = SWATCH[def.id] ?? "#888";
      btn.prepend(dot);
      btn.addEventListener("click", () => sim.selectBody(def.id));
      this.navButtons.set(def.id, btn);
      nav.appendChild(btn);
    }
    const resetBtn = el("button", "nav-btn reset", "Reset view (R)");
    resetBtn.addEventListener("click", () => sim.resetView());
    nav.appendChild(resetBtn);
    app.appendChild(nav);

    this.infoPanel = el("div", "panel info-panel hidden");
    app.appendChild(this.infoPanel);

    const hints = el("div", "hints");
    hints.appendChild(
      el(
        "span",
        undefined,
        "bodies & orbits at true scale · drag to orbit · scroll to zoom · click a body to fly to it · Space pause · R reset",
      ),
    );
    app.appendChild(hints);

    sim.onDateChange = (d) => {
      this.dateEl.textContent = this.formatDate(d);
      if (document.activeElement !== dateInput)
        dateInput.value = this.isoDate(d);
    };
    sim.onBodySelected = (id) =>
      this.showInfo(id ? BODIES.find((b) => b.id === id)! : null);
    sim.onSpeedToggle = () => this.syncSpeed();
    this.syncSpeed();
  }

  private formatDate(d: Date): string {
    return (
      d.toLocaleDateString("en-US", {
        timeZone: "UTC",
        year: "numeric",
        month: "long",
        day: "numeric",
      }) +
      " " +
      d.toLocaleTimeString("en-US", {
        timeZone: "UTC",
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  }

  private isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private syncSpeed(): void {
    for (const [id, btn] of this.speedButtons) {
      btn.classList.toggle("active", id === this.sim.currentSpeedId);
    }
  }

  private showInfo(def: CelestialBodyDef | null): void {
    if (!def) {
      this.infoPanel.classList.add("hidden");
      for (const btn of this.navButtons.values())
        btn.classList.remove("active");
      return;
    }
    this.infoPanel.classList.remove("hidden");

    this.infoPanel.textContent = "";
    const close = el("button", "close-btn", "×");
    close.addEventListener("click", () => this.sim.selectBody(null));
    this.infoPanel.appendChild(close);

    this.infoPanel.appendChild(el("h2", "info-name", def.name));
    this.infoPanel.appendChild(el("div", "info-kind", KIND_LABEL[def.kind]));

    const f = def.facts;
    const rows: [string, string][] = [
      ["Diameter", `${f.diameterKm.toLocaleString()} km`],
      ["Mass", f.massKg],
      ["Distance from Sun", f.distanceFromSun],
      ["Orbital period", f.orbitalPeriod],
      ["Day length", f.dayLength],
      ["Axial tilt", `${f.axialTiltDeg}°`],
      ["Mean temperature", f.temperature],
      ["Known moons", String(f.moons)],
    ];
    const table = el("table", "facts");
    for (const [k, v] of rows) {
      const tr = el("tr");
      tr.appendChild(el("th", undefined, k));
      tr.appendChild(el("td", undefined, v));
      table.appendChild(tr);
    }
    this.infoPanel.appendChild(table);
    this.infoPanel.appendChild(el("p", "info-desc", f.description));

    for (const [id, btn] of this.navButtons)
      btn.classList.toggle("active", id === def.id);
  }
}
