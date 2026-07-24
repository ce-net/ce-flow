# ce-flow — the reusable graph engine: every app explains itself, visually

STATUS: WORKING (v1). One data-driven SVG graph component (`<ce-flow-graph>`), transmitted over
the mesh like everything else, that renders ANY app's "how I work" story — nodes, labeled edges,
animated packet pulses, and clickable narrated steps. The engine knows no app; each app OWNS its
descriptor and serves its own flow component. Built for reuse across demos, dashboards, and the
future fleet-monitoring app.

## The contract (who owns what)

- **ce-flow owns the ENGINE only**: `components/graph.js` exports `<ce-flow-graph descriptor='...'>`
  — pure renderer, no backing service. Methods for live visualizations: `el.pulse(from, to, color?)`
  animates a packet along an edge; `el.setDescriptor(obj)` swaps the story. Steps play as a
  narrated tour (`autoplay="true"` or the built-in buttons).
- **Each app owns its STORY**: a self-contained `flow` component in the app's own repo (exported in
  its cecomponents.toml) that mesh-mounts the engine via `window.ceComp.mountByApp("ce-flow",
  "graph", el, { descriptor })` and drives live pulses from its OWN real service. Shipped today:
  ce-onboard (with a run-live-discover button), ce-debug (pulses as real fleet events arrive),
  ce-comp (the recursion explaining itself — this graph and its engine both arrive by the
  mechanism they describe).
- **Viewers hardcode NOTHING**: `examples/viewer/` mounts every component named `flow` the mesh
  currently offers. A new app that transmits a flow appears automatically; that is the whole page.

## Descriptor

```json
{ "title": "...", "intro": "...",
  "nodes": [{ "id": "a", "label": "operator", "sub": "CLI / page", "kind": "page", "x": 0, "y": 1 }],
  "edges": [{ "from": "a", "to": "b", "label": "one envelope" }],
  "steps": [{ "name": "discover", "detail": "...", "path": [["a","b"]] }] }
```

`kind` colors: machine, service, app, page, data. `x`/`y` are abstract grid coordinates — the
engine scales them; predictable layout beats clever layout for being understood.

## Run

```bash
ce-comp serve --app ../ce-flow --app ../ce-onboard --app ../ce-debug --app ../ce-comp
python3 examples/viewer/serve.py     # http://127.0.0.1:8979/examples/viewer/
```

v1 honesty: layout is grid-hint based (no force layout); pulses are fire-and-forget animations;
descriptors are trusted (they arrive from your own transmitters — same trust story as ce-comp).
