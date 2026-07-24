---
name: ce-flow
description: The reusable graph engine - data-driven SVG flow graphs (nodes/edges/pulses/narrated steps) that apps feed their own "how I work" descriptors; viewers mount every flow the mesh offers. Read before visualizing any system.
---
# ce-flow usage
Engine: `<ce-flow-graph descriptor='<json>' [autoplay="true"]>` - descriptor
{title,intro,nodes[{id,label,sub,kind:machine|service|app|page|data,x,y}],edges[{from,to,label}],
steps[{name,detail,path:[[from,to],...]}]}; x/y are grid hints. Element API: `pulse(from,to,color?)`
(animate a packet; await it), `setDescriptor(obj)`; events step-shown, node-clicked. OWNERSHIP LAW:
the engine knows no app - each app ships its own self-contained `flow` component (exported in ITS
cecomponents.toml) that mesh-mounts the engine via `window.ceComp.mountByApp("ce-flow","graph",el,
{descriptor})` and drives live pulses from its own real service. Viewer (`examples/viewer`, :8979)
mounts every component named `flow` on the mesh - hardcode nothing, ever (Leif's law). Shipped
flows: ce-onboard (live discover), ce-debug (live event pulses), ce-comp (recursion), ce-showcase
(the big picture incl. the sell story).
