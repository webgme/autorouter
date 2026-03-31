# Autorouter — Architecture & API Summary

## Overview

The autorouter is a **JavaScript orthogonal (right-angle) path routing library** for visual diagramming tools. It computes non-overlapping, right-angled connection paths between boxes (nodes) through their ports (connection points), automatically avoiding obstacles. It was originally built for [WebGME](https://webgme.org/) by Brian Broll.

- **Module system**: CommonJS (`require`/`module.exports`)
- **Entry point**: `index.js` → `src/AutoRouter.js`
- **License**: MIT
- **Dependencies**: `debug`, `lodash.assign`

## Core Classes (Layered Architecture)

```
┌─────────────────────────────────────────────┐
│              AutoRouter (API)               │  <-- Public facade
├─────────────────────────────────────────────┤
│           AutoRouterGraph (Engine)          │  <-- Routing engine
├──────────────┬──────────────┬───────────────┤
│ AutoRouterBox│AutoRouterPort│AutoRouterPath │  <-- Domain objects
├──────────────┴──────────────┴───────────────┤
│ ArRect  │ ArPoint │ ArSize │ Edge/EdgeList  │  <-- Geometry primitives
└─────────────────────────────────────────────┘
```

1. **`AutoRouter`** (`src/AutoRouter.js`) — The public-facing facade. Manages dictionaries of paths, ports, and box-to-port mappings. Delegates to `AutoRouterGraph`.

2. **`AutoRouterGraph`** (`src/AutoRouter.Graph.js`) — The routing engine. Maintains horizontal/vertical edge lists, buffer boxes (inflated bounding regions for collision), and performs the actual pathfinding, connection, simplification, and optimization.

3. **`AutoRouterBox`** (`src/AutoRouter.Box.js`) — A rectangular obstacle. Supports parent/child hierarchies (`addChild`/`removeChild`), owns ports, and tracks self-points (corners).

4. **`AutoRouterPort`** (`src/AutoRouter.Port.js`) — A connection region on a box edge. Tracks which directions connections can enter/exit, manages available (non-overlapped) areas, and creates start/end points for paths.

5. **`AutoRouterPath`** (`src/AutoRouter.Path.js`) — A connection between two ports. Stores the point list (the routed polyline), start/end ports, auto-routing state, and custom path data.

6. **`AutoRouterActionApplier`** (`src/AutoRouter.ActionApplier.js`) — A higher-level wrapper that translates string-based commands (like `"addBox"`, `"addPath"`) into AutoRouter API calls. Used for replay/debugging of recorded action sequences.

7. **Primitives**: `ArPoint`, `ArRect`, `ArSize`, `AutoRouterEdge`, `AutoRouterEdgeList`, `AutoRouterPointList`.

## Public API (`AutoRouter`)

### Core Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `addBox` | `(size) → ArBoxObject` | Add a rectangular box/node. `size` has `{x1, y1, x2, y2}` or `{x1, y1, width, height}` plus an optional `ports` array. |
| `addPort` | `(boxObject, portInfo) → port` | Add a port to an existing box. `portInfo` = `{id, area: [[x1,y1],[x2,y2]], angles: [min, max]}` |
| `addPath` | `(params) → pathId` | Create a routed connection. `params` = `{src, dst, startDirection?, endDirection?}` where src/dst are ports or port maps. Returns a string path ID. |
| `routeSync` | `()` | Compute all routes synchronously (blocks until done). |
| `routeAsync` | `(options)` | Compute routes asynchronously. `options` = `{first, update, callback, time}` |
| `getPathPoints` | `(pathId) → [{x, y}, ...]` | Get the computed polyline points for a path. |
| `setPathCustomPoints` | `({path, points})` | Override autorouting with custom waypoints. `points` = `[[x,y], ...]` |
| `move` | `(box, {dx, dy} or {x, y})` | Move a box (and its children) by delta or to absolute position. |
| `setBoxRect` | `(boxObject, size)` | Resize/reposition a box. |
| `remove` | `(boxObject or pathId)` | Delete a box (and children/ports) or a path. |
| `removePort` | `(port)` | Remove a specific port from its box. |
| `updatePort` | `(boxObject, portInfo) → port` | Replace a port with new geometry. Re-attaches all paths. |
| `setComponent` | `(parent, child)` | Declare a parent-child box relationship (moves together). |
| `setMinimumGap` | `(min)` | Set the minimum gap between paths and boxes (buffer). |
| `clear` | `()` | Remove all boxes, paths, and ports. |

## Box/Port Definition Format

```javascript
{
  x1: 100, y1: 100, x2: 250, y2: 200,   // bounding rect
  ports: [
    {
      id: 'east',
      area: [[250, 120], [250, 180]],     // line segment on box edge
      angles: [0, 0]                       // 0=right, 90=bottom, 180=left, 270=top
    },
    {
      id: 'south',
      area: [[120, 200], [230, 200]],
      angles: [90, 90]
    }
  ]
}
```

## Routing Modes

### Synchronous

```javascript
router.routeSync();
```

Blocks, connects all paths, then runs optimization passes (simplification, edge scanning, stair centering).

### Asynchronous

```javascript
router.routeAsync({
  first(disconnected) { /* instant straight-line preview */ },
  update(paths)       { /* called each optimization tick */ },
  callback(paths)     { /* called when routing is complete */ },
  time: 5             // ms delay between ticks (default 5)
});
```

- `first`: Called immediately with quick straight-line connections for instant visual feedback.
- `update`: Called each optimization tick.
- `callback`: Called when routing is complete.
- `time`: Milliseconds between optimization ticks.

## Minimal Integration Example

```javascript
const AutoRouter = require('autorouter');
const router = new AutoRouter();

// 1. Add boxes with ports
const box1 = router.addBox({
  x1: 100, y1: 100, x2: 200, y2: 200,
  ports: [{ id: 'right', area: [[200, 130], [200, 170]], angles: [0, 0] }]
});
const box2 = router.addBox({
  x1: 500, y1: 300, x2: 600, y2: 400,
  ports: [{ id: 'left', area: [[500, 330], [500, 370]], angles: [180, 180] }]
});

// 2. Connect them
const pathId = router.addPath({
  src: box1.ports,   // can pass all ports or a single port
  dst: box2.ports
});

// 3. Route
router.routeSync();

// 4. Read the result
const points = router.getPathPoints(pathId);
// -> [{x: 200, y: 150}, {x: 350, y: 150}, {x: 350, y: 350}, {x: 500, y: 350}]

// 5. Render `points` as a polyline in your visualizer
```

## Notes for Visualizer Integration

**What you get back**: `getPathPoints()` returns an array of `{x, y}` objects representing an orthogonal polyline. Render this as a series of connected line segments.

**Coordinate system**: Uses an integer coordinate space with `ED_MINCOORD = -2` to `ED_MAXCOORD = 100000`. Boxes must be at least 3×3 pixels.

**Reactive updates**: After any mutation (`move`, `setBoxRect`, `addBox`, `remove`, `addPort`, `updatePort`), you must call `routeSync()` or `routeAsync()` again to recompute paths. The graph tracks dirty state internally.

**The `ArBoxObject` wrapper**: `addBox` returns `{box, ports}` — not a raw `AutoRouterBox`. You pass this wrapper to `move`, `setBoxRect`, `remove`, `setComponent`, etc.

**Port IDs are prefixed**: Internally, port IDs are prefixed with the box ID and `__` separator. Use `router.getPortId(portId, boxObject)` to resolve the absolute port ID if needed.

**ActionApplier (replay system)**: `AutoRouter.ActionApplier` provides a string-command interface (`_invokeAutoRouterMethod('addBox', [...])`) useful for recording and replaying interactions. The test suite uses JSON action sequences (see `test/test-cases/*.json`).

## Opportunities for Streamlining

1. **No event/callback system for path changes** — The visualizer must poll `getPathPoints()` after routing. Adding an event emitter (e.g., `router.on('pathUpdated', fn)`) would simplify reactive rendering.

2. **Port definition is verbose** — The `area`/`angles` format is low-level. A higher-level API like `addBox({..., ports: {east: true, south: true}})` that auto-generates port geometries from box edges would reduce boilerplate.

3. **No batch API** — Each `addBox`/`addPath` triggers internal edge list updates. A `router.batch(() => { ... })` that defers edge recalculation would improve performance for bulk operations.

4. **CommonJS-only** — Could benefit from ESM exports and TypeScript definitions for modern toolchains.

5. **`routeAsync` uses `setTimeout` chains** — Could be modernized to return a `Promise` or use `requestAnimationFrame` for browser contexts.

6. **Output is points-only** — The API doesn't expose which edges were simplified or what direction each segment runs. A richer output format (e.g., `{segments: [{start, end, direction}]}`) could help visualizers draw arrowheads, labels, or curved corners more easily.
