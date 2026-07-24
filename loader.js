// ce-comp loader - fetch and mount components FROM THE MESH. The one file a host has locally
// (the browser of the component world); everything it mounts arrives over ce.comp at runtime.
//
//   import { init } from "./loader.js";
//   const ceComp = await init({ nodeUrl: `${location.origin}/node` });
//   await ceComp.mountAll(document.getElementById("grid"));      // emergent dashboard: no hardcoded cells
//   await ceComp.mountByApp("ce-debug", "log-stream", el, {});   // targeted (components use this to recurse)
//
// init() also sets window.ceComp so MESH-FETCHED components can themselves mesh-mount further
// components - the recursion. Module constraint (v1): components are self-contained ES modules.

const SERVICE = "ce.comp";
const CTL_TOPIC = "ce.comp/ctl";

const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (s) => new Uint8Array((s.match(/../g) || []).map((x) => parseInt(x, 16)));

async function meshRequest(nodeUrl, token, to, payloadObj, timeoutMs = 60000) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${nodeUrl}/mesh/request`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      to,
      topic: CTL_TOPIC,
      payload_hex: hex(new TextEncoder().encode(JSON.stringify(payloadObj))),
      timeout_ms: timeoutMs,
    }),
  });
  if (!res.ok) throw new Error(`mesh request: ${res.status} ${await res.text()}`);
  const out = JSON.parse(new TextDecoder().decode(unhex((await res.json()).payload_hex)) || "{}");
  if (out.error) throw new Error(out.error);
  return out.result;
}

export async function init({ nodeUrl, token } = {}) {
  nodeUrl = (nodeUrl || "http://127.0.0.1:8844").replace(/\/$/, "");
  const loadedCids = new Map(); // cid -> Promise<void> (module imported)

  async function providers() {
    const found = await fetch(`${nodeUrl}/discovery/find/${encodeURIComponent(SERVICE)}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    let list = found?.providers ?? [];
    // prefer this node when it transmits (several transmitters may coexist)
    try {
      const me = (await fetch(`${nodeUrl}/status`).then((r) => r.json())).node_id;
      if (list.includes(me)) list = [me, ...list.filter((p) => p !== me)];
      else if (!list.length) list = [me];
    } catch (_) { /* discovery-only */ }
    return list;
  }

  /** Everything the mesh currently offers: [{provider, app, version, components:[...]}] */
  async function discover() {
    const offers = [];
    for (const p of await providers()) {
      try {
        const { apps } = await meshRequest(nodeUrl, token, p, { op: "index" });
        for (const a of apps) offers.push({ provider: p, ...a });
      } catch (_) { /* a dead transmitter is not an error - the mesh's shape IS the content */ }
    }
    return offers;
  }

  async function ensureModule(provider, comp) {
    if (!loadedCids.has(comp.cid)) {
      loadedCids.set(
        comp.cid,
        (async () => {
          const { module_hex } = await meshRequest(nodeUrl, token, provider, { op: "fetch", args: { cid: comp.cid } });
          const url = URL.createObjectURL(new Blob([unhex(module_hex)], { type: "text/javascript" }));
          try {
            await import(url);
          } finally {
            URL.revokeObjectURL(url);
          }
        })(),
      );
    }
    return loadedCids.get(comp.cid);
  }

  async function mount(offer, comp, target, props = {}) {
    await ensureModule(offer.provider, comp);
    const el = document.createElement(comp.tag);
    el.setAttribute("node-url", nodeUrl);
    if (token) el.setAttribute("token", token);
    for (const [k, v] of Object.entries(props)) if (v != null) el.setAttribute(k, String(v));
    target.appendChild(el);
    return el;
  }

  /** Targeted mount by app/component name - what components call to RECURSE. */
  async function mountByApp(appName, compName, target, props = {}) {
    const offers = await discover();
    const offer = offers.find((o) => o.app === appName && o.components.some((c) => c.name === compName));
    if (!offer) throw new Error(`no transmitter offers ${appName}/${compName}`);
    return mount(offer, offer.components.find((c) => c.name === compName), target, props);
  }

  /** The emergent dashboard: mount EVERY component the mesh offers into `target`.
   *  Calls decorate(cellEl, offer, comp) so hosts can add chrome - never selection. */
  async function mountAll(target, { decorate, props } = {}) {
    const offers = await discover();
    let mounted = 0;
    for (const offer of offers) {
      for (const comp of offer.components) {
        const cell = document.createElement("div");
        target.appendChild(cell);
        if (decorate) decorate(cell, offer, comp);
        try {
          await mount(offer, comp, cell, props);
          mounted += 1;
        } catch (e) {
          const err = document.createElement("div");
          err.textContent = `${offer.app}/${comp.name}: ${e.message}`;
          err.style.color = "#e0715f";
          cell.appendChild(err);
        }
      }
    }
    return { offers, mounted };
  }

  const api = { nodeUrl, discover, mount, mountByApp, mountAll };
  window.ceComp = api; // mesh-fetched components recurse through this
  return api;
}
