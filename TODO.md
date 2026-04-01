# TODO — Alternative Routing Libraries

Research into browser-side libraries that solve the same core problem as autorouter: routing lines/connections between points with obstacle avoidance and various heuristics.

## Standalone Routers

### libavoid-js
- **npm**: `libavoid-js`
- **License**: LGPL
- **What**: WebAssembly port (Emscripten) of the C++ libavoid library from the Adaptagrams project. Dedicated connector routing with obstacle avoidance.
- **Routing modes**: Polyline, orthogonal.
- **Browser/Node**: Both. Zero dependencies, ships a ~480KB `.wasm` file.
- **Status**: Active, v0.5.0-beta.5, ~1.6K weekly downloads.
- **Notes**: Closest functional match to autorouter. Same core problem, different algorithm lineage (visibility graph). Could be a near drop-in alternative with an adapted API surface. LGPL license may be a concern for some consumers.

### PathFinding.js
- **npm**: `pathfinding`
- **License**: MIT
- **What**: General-purpose 2D grid pathfinding library. A*, Dijkstra, BFS, Jump Point Search, bidirectional variants.
- **Routing modes**: Grid-based, any direction (constrainable to orthogonal).
- **Browser/Node**: Both.
- **Status**: Stable, ~80K weekly downloads.
- **Notes**: Lowest-level option. You'd build the diagram routing layer yourself (convert boxes to blocked grid cells, snap results to clean orthogonal segments). Full control over algorithm and heuristics. Good foundation for a custom routing engine.

## Layout Engines (routing as byproduct)

### ELKjs
- **npm**: `elkjs`
- **License**: EPL-2.0
- **What**: JavaScript port of the Eclipse Layout Kernel. Full graph layout engine (Sugiyama/layered) that also computes edge routing.
- **Routing modes**: Orthogonal, polyline, splines (configurable via `elk.edgeRouting`).
- **Obstacle avoidance**: Implicit (edges routed as part of full layout pass).
- **Browser/Node**: Both. Pure JS or Web Worker variant.
- **Status**: Active, v0.11.1, ~1.5M weekly downloads.
- **Notes**: Heavier — wants to lay out the entire graph, not just route edges for pre-positioned nodes. Excellent port support (designed for port-based diagrams). Best if you're willing to let ELK position nodes too, or use its edge routing as a post-layout step.

### dagre
- **npm**: `@dagrejs/dagre`
- **License**: MIT
- **What**: Directed graph layout library using Sugiyama-based algorithm. Computes node positions and edge routes.
- **Routing modes**: Polyline control points. No explicit orthogonal mode.
- **Obstacle avoidance**: Implicit via layout.
- **Browser/Node**: Both. Pure JS.
- **Status**: Maintained fork at `@dagrejs/dagre`, ~1.8M weekly downloads. Original `dagre` is unmaintained.
- **Notes**: Layout-first — edge routes are a byproduct of graph layout. Less control over routing heuristics. Good if you also need node positioning.

## Routers Embedded in Frameworks

### JointJS (manhattan router)
- **npm**: `jointjs`
- **License**: MPL-2.0 (open source edition)
- **What**: Full diagramming framework with pluggable routers. The `manhattan` router does A*-based orthogonal routing with obstacle avoidance.
- **Configuration**: `step` (grid size), `padding`, `maximumLoops`, `startDirections`/`endDirections`, custom `isPointObstacle`.
- **Notes**: The manhattan router is very close in purpose to autorouter. Extracting just the router requires pulling in JointJS dependencies. Their commercial Rappid toolkit adds libavoid integration.

### maxGraph (successor to mxGraph)
- **npm**: `maxgraph`
- **License**: Apache-2.0
- **What**: Open-source successor to mxGraph (the engine behind draw.io). Full diagramming library with built-in edge routing.
- **Routing modes**: `ManhattanConnector` (shortest orthogonal path), `OrthogonalConnector`, `EntityRelation`.
- **Notes**: Full framework — routing is part of a larger toolkit. The ManhattanConnector does obstacle-aware orthogonal routing.

## Summary Table

| Library | Standalone? | Orthogonal | Obstacle avoidance | License | Weekly DL |
|---|---|---|---|---|---|
| **autorouter** (this) | Yes | Yes | Yes | MIT | — |
| **libavoid-js** | Yes | Yes | Yes | LGPL | ~1.6K |
| **PathFinding.js** | Yes (generic) | Configurable | Yes (grid) | MIT | ~80K |
| **ELKjs** | No (layout engine) | Yes | Implicit | EPL-2.0 | ~1.5M |
| **dagre** | No (layout engine) | Partial | Implicit | MIT | ~1.8M |
| **JointJS** | No (framework) | Yes | Yes (A*) | MPL-2.0 | ~100K |
| **maxGraph** | No (framework) | Yes | Yes | Apache-2.0 | ~10K |

## Recommendations

- **libavoid-js** is the strongest candidate to offer alongside autorouter — standalone, same problem domain, different algorithm (visibility graph vs edge-list sweeping).
- **PathFinding.js** is worth considering as a lightweight MIT-licensed building block if we want full control over heuristics.
- **ELKjs** is the go-to if a visualizer also needs node layout, not just edge routing.
