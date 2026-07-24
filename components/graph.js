// <ce-flow-graph> - the reusable graph engine of ce-flow. Self-contained ES module (travels
// over ce-comp). It renders ANY descriptor an app feeds it and knows nothing about any app.
//
// Attributes:
//   descriptor    JSON (required):
//     { title, nodes:[{id,label,sub?,kind?,x,y}], edges:[{from,to,label?}],
//       steps?:[{name, detail, path:[[from,to],...]}] }
//     kind: machine|service|app|page|data (colors); x,y: abstract grid coords (engine scales).
//   autoplay      "true" to run the step tour once on mount
// Methods (for live visualizations):
//   el.pulse(from, to [, color])   animate one packet along an edge
//   el.setDescriptor(obj)          replace the descriptor programmatically
// Events: "step-shown" {name}, "node-clicked" {id}

const KIND_COLOR = {
  machine: "#8ab4f8", service: "#7bc98a", app: "#d4b106", page: "#c792ea", data: "#e0715f",
  default: "#9aa3af",
};

const CSS = `
  :host { display:block; font: 12.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
          background:#101216; border:1px solid #2a2d34; border-radius:10px; color:#e6e6e6; }
  header { padding: 8px 12px; border-bottom: 1px solid #2a2d34; color:#9aa3af; display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  header b { color:#e6e6e6; }
  .steps { display:flex; gap:6px; flex-wrap:wrap; margin-left:auto; }
  .steps button { font:inherit; font-size:11px; background:#1a1e26; color:#b7bec9; border:1px solid #2a2d34;
                  border-radius:5px; padding:2px 8px; cursor:pointer; }
  .steps button:hover { background:#24304a; }
  .steps button.active { border-color:#8ab4f8; color:#e6e6e6; }
  svg { display:block; width:100%; }
  .node rect { fill:#171b22; stroke:#3a4252; stroke-width:1; rx:7; }
  .node.hot rect { stroke-width:2; }
  .node text.lbl { fill:#e6e6e6; font-size:12px; font-weight:600; }
  .node text.sub { fill:#6b7280; font-size:10px; }
  .node { cursor:pointer; }
  path.edge { fill:none; stroke:#39404d; stroke-width:1.4; }
  path.edge.hot { stroke:#8ab4f8; stroke-width:2; }
  text.elbl { fill:#566070; font-size:10px; }
  text.elbl.hot { fill:#8ab4f8; }
  .detail { padding: 8px 12px; color:#9aa3af; border-top:1px solid #2a2d34; min-height:1.4em; }
  .detail b { color:#e6e6e6; }
`;

class FlowGraph extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: "open" });
    try {
      this.d = JSON.parse(this.getAttribute("descriptor") || "{}");
    } catch (e) {
      this.shadowRoot.innerHTML = `<div style="color:#e0715f;padding:10px">bad descriptor: ${e.message}</div>`;
      return;
    }
    this.render();
    if (this.getAttribute("autoplay") === "true" && (this.d.steps || []).length) this.tour();
  }

  setDescriptor(d) {
    this.d = d;
    this.render();
  }

  layout() {
    const ns = this.d.nodes || [];
    const maxX = Math.max(1, ...ns.map((n) => n.x || 0));
    const maxY = Math.max(1, ...ns.map((n) => n.y || 0));
    const W = 940, NW = 148, NH = 46, PX = 30, PY = 26;
    const H = PY * 2 + (maxY + 1) * (NH + 34);
    const px = (gx) => PX + (gx / Math.max(maxX, 1)) * (W - NW - PX * 2);
    const py = (gy) => PY + gy * (NH + 34);
    this.pos = Object.fromEntries(ns.map((n) => [n.id, { x: px(n.x || 0), y: py(n.y || 0), w: NW, h: NH }]));
    return { W, H, NW, NH };
  }

  edgePath(e) {
    const a = this.pos[e.from], b = this.pos[e.to];
    if (!a || !b) return "";
    const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
    const mx = (ax + bx) / 2;
    return `M ${ax} ${ay} C ${mx} ${ay}, ${mx} ${by}, ${bx} ${by}`;
  }

  render() {
    const { W, H } = this.layout();
    const nodes = (this.d.nodes || []).map((n) => {
      const p = this.pos[n.id];
      const color = KIND_COLOR[n.kind] || KIND_COLOR.default;
      return `<g class="node" data-id="${n.id}" transform="translate(${p.x},${p.y})">
        <rect width="${p.w}" height="${p.h}" rx="7" style="stroke:${color}66"></rect>
        <circle cx="10" cy="12" r="3.5" fill="${color}"></circle>
        <text class="lbl" x="20" y="16">${esc(n.label)}</text>
        <text class="sub" x="20" y="32">${esc(n.sub || n.kind || "")}</text>
      </g>`;
    }).join("");
    const edges = (this.d.edges || []).map((e, i) => {
      const dpath = this.edgePath(e);
      const lbl = e.label ? (() => {
        const a = this.pos[e.from], b = this.pos[e.to];
        return `<text class="elbl" data-e="${i}" x="${(a.x + b.x) / 2 + 74}" y="${(a.y + b.y) / 2 + 18}" text-anchor="middle">${esc(e.label)}</text>`;
      })() : "";
      return `<path class="edge" data-e="${i}" d="${dpath}"></path>${lbl}`;
    }).join("");
    const steps = (this.d.steps || []).map((s, i) => `<button data-s="${i}">${i + 1} ${esc(s.name)}</button>`).join("");
    this.shadowRoot.innerHTML = `<style>${CSS}</style>
      <header><b>${esc(this.d.title || "flow")}</b>
        <div class="steps">${steps}${steps ? `<button data-s="tour">play all</button>` : ""}</div></header>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"><g id="edges">${edges}</g><g id="pulses"></g>${nodes}</svg>
      <div class="detail" id="detail">${esc(this.d.intro || "")}</div>`;
    this.shadowRoot.querySelectorAll(".node").forEach((g) =>
      g.addEventListener("click", () => this.dispatchEvent(new CustomEvent("node-clicked", { detail: { id: g.dataset.id }, bubbles: true, composed: true }))));
    this.shadowRoot.querySelectorAll(".steps button").forEach((b) =>
      b.addEventListener("click", () => (b.dataset.s === "tour" ? this.tour() : this.showStep(Number(b.dataset.s)))));
  }

  edgeIndex(from, to) {
    return (this.d.edges || []).findIndex((e) => e.from === from && e.to === to);
  }

  /** Animate one packet from->to. Returns a promise resolving when it lands. */
  pulse(from, to, color = "#8ab4f8") {
    const i = this.edgeIndex(from, to);
    if (i < 0) return Promise.resolve();
    const path = this.shadowRoot.querySelector(`path.edge[data-e="${i}"]`);
    if (!path) return Promise.resolve();
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("r", "4");
    dot.setAttribute("fill", color);
    this.shadowRoot.getElementById("pulses").appendChild(dot);
    const len = path.getTotalLength();
    const dur = 650;
    return new Promise((done) => {
      const t0 = performance.now();
      const frame = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        const p = path.getPointAtLength(k * len);
        dot.setAttribute("cx", p.x);
        dot.setAttribute("cy", p.y);
        if (k < 1) requestAnimationFrame(frame);
        else { dot.remove(); done(); }
      };
      requestAnimationFrame(frame);
    });
  }

  highlight(pairs, on) {
    for (const [from, to] of pairs) {
      const i = this.edgeIndex(from, to);
      this.shadowRoot.querySelector(`path.edge[data-e="${i}"]`)?.classList.toggle("hot", on);
      this.shadowRoot.querySelector(`text.elbl[data-e="${i}"]`)?.classList.toggle("hot", on);
      for (const id of [from, to]) this.shadowRoot.querySelector(`.node[data-id="${id}"]`)?.classList.toggle("hot", on);
    }
  }

  async showStep(i) {
    const s = (this.d.steps || [])[i];
    if (!s) return;
    this.shadowRoot.querySelectorAll(".steps button").forEach((b) => b.classList.toggle("active", b.dataset.s === String(i)));
    this.shadowRoot.getElementById("detail").innerHTML = `<b>${esc(s.name)}</b> - ${esc(s.detail)}`;
    this.highlight(s.path, true);
    for (const [from, to] of s.path) await this.pulse(from, to);
    this.highlight(s.path, false);
    this.dispatchEvent(new CustomEvent("step-shown", { detail: { name: s.name }, bubbles: true, composed: true }));
  }

  async tour() {
    for (let i = 0; i < (this.d.steps || []).length; i++) await this.showStep(i);
  }
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

customElements.define("ce-flow-graph", FlowGraph);
