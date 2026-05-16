# Mind map layout algorithm

This document describes how `src/layout/balanced.ts` turns a tree of `MindNode`s
into positioned React Flow nodes and edges. The simple fallback in
`src/layout/simple.ts` is no longer wired in (see `MindMap.tsx`); `balanced.ts`
is the production path.

## Node model recap

- **`rootQ`** — the user's seed question. Drawn at the center of its tree.
- **`A`** — an answer node. Each `A` carries a `parentEdgeLabel` (the follow-up
  question that produced it) and a `side: 'left' | 'right'` for the first level
  under `rootQ`. Deeper `A` nodes inherit the side from their first-level
  ancestor implicitly (they live in that side's subtree).

Edges from `rootQ → first-level A` are unlabeled. Edges from `A → A` are
labeled with the child's `parentEdgeLabel`.

## Top-level shape

For a single root: a horizontal "mind map" with the root in the middle, a
subtree growing left, and a subtree growing right. Each side is laid out
independently with [elkjs] then mirrored / offset into final coordinates.

For multiple roots: each root tree is laid out independently and stacked
vertically with a fixed gap.

[elkjs]: https://github.com/kieler/elkjs

## Pipeline

```
layoutMultiRoot(rootIds, nodes, measuredSizes)
  └─ for each root:
       layoutBalanced(rootId, nodes, measuredSizes)
         ├─ partition root's children into left / right by node.side
         ├─ layoutOneSide(left)   ┐
         ├─ layoutOneSide(right)  ┘ run in parallel
         ├─ mirror left side across x = 0
         ├─ offset both sides outward past the root node
         └─ emit React Flow nodes + edges
```

### 1. Size estimation

`sizeOf(node)` returns a `{ width, height }`:

- If `measuredSizes` has a real DOM measurement for this node, use it.
  React Flow measures nodes after first render and we feed those measurements
  back in on the next layout pass so positioning matches reality.
- Otherwise fall back to `estimateSize` (`balanced.ts:44`), which is a rough
  character-count → height heuristic. The fallback is intentionally generous
  on the height side and capped at `A_MAX_H = 500` to match the
  `.a-content { max-height: 440 }` cap in CSS plus padding.

Streaming answers (`node.streaming && content.length < 200`) get a fixed
`300 × 380` placeholder so the layout doesn't collapse and re-expand as the
text streams in.

### 2. Per-side layout via elkjs

`layoutOneSide(parentId, sideChildIds, ...)` builds an elkjs graph for one
half of the tree:

- **Nodes**: every reachable descendant of the side's first-level children
  (`collectSubtree`, respecting `collapsed` flags) plus a single 1×1 virtual
  node `__side_root__`.
- **Edges**:
  - virtual root → each first-level child (unlabeled)
  - every `A → A` edge inside the subtree, with `labels: [{ text, width, height }]`
    when the child has a `parentEdgeLabel`. The label dimensions come from
    `estimateLabelSize` and influence node-to-node spacing only — we no longer
    consume elkjs's computed label coordinates (see "Label positioning" below).

The virtual root exists because elkjs's `layered` algorithm needs a single
source to produce a balanced tree-like layout. The real root lives in
`layoutBalanced` and is positioned manually after both sides return.

elkjs options of note (`ELK_OPTS`, `balanced.ts:8`):

| Key | Why |
|---|---|
| `elk.algorithm: layered` | Levelled tree layout, one column per depth. |
| `elk.direction: RIGHT` | Layers grow left → right; we mirror the left side after. |
| `elk.layered.nodePlacement.strategy: BRANDES_KOEPF` | Better vertical balance for siblings. |
| `elk.edgeRouting: ORTHOGONAL` | Right-angle routing (matches the smooth-step look of RF). |
| `elk.layered.spacing.nodeNodeBetweenLayers: 180` | Horizontal gap between depth levels. |
| `elk.spacing.nodeNode: 64` | Vertical gap between siblings. |
| `elk.spacing.labelNode`, `elk.spacing.edgeLabel` | Reserve room for edge labels even though we re-position them ourselves. |

After elkjs returns positions, we:

1. Translate everything so `__side_root__` is at `(0, 0)`.
2. Drop the virtual node.
3. Vertically re-center: shift so the bounding-box center y is `0`. This is
   what keeps each side's subtree vertically centered on the root regardless
   of how unbalanced the subtree is.

### 3. Mirroring the left side

elkjs only knows how to lay out left → right. For the left half of the tree
we mirror each node's box across `x = 0`:

```
mirrorXNode(p):  p.x = -p.x - p.width
```

The `- p.width` accounts for elkjs giving top-left coordinates while the
mirror reflects the whole box.

### 4. Stitching root + sides

In `layoutBalanced`:

- Root is placed at `(-rootW/2, -rootH/2)` so its center is the origin.
- Right side gets `rightOffsetX = rootW/2 + 60` added to every x.
- Left side gets `leftOffsetX = -rootW/2 - 60` added (its boxes are already
  on the negative side after mirroring).

The fixed `60` is the gutter between the root node and its first-level
children. elkjs's first layer starts at `x ≈ 1` (just past the virtual root),
so this gutter is what visually separates root from the side trees.

### 5. Edges

Edges are emitted independently of elkjs's routed paths — React Flow re-draws
them using the registered edge component (`QEdge`). What we set:

- **Handles**: root edges use `sourceHandle: 'r' | 'l'` (right or left of the
  root) and `targetHandle: 't'` (the side-appropriate handle on the A node,
  which `ANode` chooses based on `node.side`). Inner edges use `'s' → 't'`
  (each A has both a source `'s'` and target `'t'` on the side that faces its
  parent).
- **Label**: the child's `parentEdgeLabel`, or empty string for root-edges.

`QEdge` renders the path with `getSmoothStepPath` and places the label on
the **final horizontal segment** of the path (`labelX = (midX + targetX) / 2`,
`labelY = targetY`). This puts the chip on the section unique to that edge
instead of the shared vertical "trunk" siblings overlap on. We deliberately
do not use elkjs's computed label coordinates — elkjs and React Flow route
paths differently, so elkjs's coords drift off the visible line.

### 6. Multi-root stacking

`layoutMultiRoot` runs `layoutBalanced` on each root concurrently, then
stacks the resulting trees top-to-bottom:

```
cursorY = 0
for each tree:
  compute its [minY, maxY] bounding box
  shift = cursorY - minY            // align top of this tree to cursor
  apply shift to every node.y
  cursorY += (maxY - minY) + 80     // ROOT_TREE_GAP_Y
```

The 80px gap between root trees is fixed. Trees keep their internal
left/right balance — the stacking only moves them vertically.

## Coordinate system

- Origin `(0, 0)` is the center of the (first / only) root node.
- Positive x = right, positive y = down (React Flow convention).
- All `Node.position` values are **top-left** of the node box, as React Flow
  expects.

## Re-layout triggers

Layout is re-run when:

- The node tree changes (add/remove/collapse).
- DOM measurements update (React Flow reports new sizes after content
  changes — long answers, streaming completing, etc.).

See `MindMap.tsx` for the wiring. Because `layoutBalanced` is async, callers
should debounce or ignore stale results when scheduling multiple runs.

## Known limitations

- **Estimated sizes during streaming.** While an answer streams, we use a
  fixed `300 × 380`. The first post-stream layout may shift neighbors as the
  real measurement arrives. This is intentional — laying out on every token
  would be jittery.
- **Label collisions.** Two sibling edges with long labels and similar
  vertical separation can have their chips overlap, since label x is the
  midpoint of `[midX, targetX]` and that's the same for siblings sharing a
  source handle. We rely on elkjs's `spacing.labelNode` / `spacing.edgeLabel`
  to fan siblings vertically far enough apart that this is rare in practice.
- **Mirrored side uses estimated label widths.** elkjs sees label sizes for
  spacing but doesn't know we'll mirror — fine in practice because the layout
  is symmetric x-wise, but worth knowing if you tune asymmetric spacing
  options later.
