import ELK from 'elkjs/lib/elk.bundled.js';
import type { Edge, Node } from '@xyflow/react';

import type { MindNode, NodeId } from '../types';

const elk = new ELK();

const ELK_OPTS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  // Generous spacing so the rendered node — which may be slightly taller than our estimate — doesn't crash into siblings
  'elk.layered.spacing.nodeNodeBetweenLayers': '180',
  'elk.spacing.nodeNode': '64',
  'elk.layered.spacing.edgeNodeBetweenLayers': '48',
  'elk.layered.spacing.edgeEdgeBetweenLayers': '24',
  'elk.layered.crossingMinimization.semiInteractive': 'true',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.edgeLabels.placement': 'CENTER',
  'elk.layered.edgeLabels.sideSelection': 'SMART_DOWN',
  'elk.spacing.labelNode': '16',
  'elk.spacing.edgeLabel': '12',
  // Orthogonal edge routing so elkjs's computed paths route around nodes cleanly
  'elk.edgeRouting': 'ORTHOGONAL',
};

function estimateLabelSize(text: string): { width: number; height: number } {
  if (!text) return { width: 0, height: 0 };
  const maxInnerWidth = 320;
  const padX = 24;
  const padY = 12;
  const charW = 10;
  const lineH = 21;
  const rawW = text.length * charW;
  if (rawW <= maxInnerWidth) {
    return { width: rawW + padX, height: lineH + padY };
  }
  const lines = Math.ceil(rawW / maxInnerWidth);
  return { width: maxInnerWidth + padX, height: lines * lineH + padY };
}

// Cap matches .a-content's max-height (440) + .node-a padding/border (~30) + buffer
const A_MAX_H = 500;

function estimateSize(node: MindNode): { width: number; height: number } {
  if (node.kind === 'rootQ') {
    const len = Math.max(node.question.length, 6);
    return { width: Math.min(Math.max(len * 16, 140), 320), height: 70 };
  }
  if (node.streaming && node.content.length < 200) {
    return { width: 300, height: 380 };
  }
  const cLen = node.content.length;
  const lines = Math.max(2, Math.ceil(cLen / 30));
  const h = Math.min(80 + lines * 22, A_MAX_H);
  return { width: 300, height: h };
}

interface Pos {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SideLayout {
  nodes: Map<NodeId, Pos>;
}

function collectSubtree(rootChildId: NodeId, nodes: Record<NodeId, MindNode>): NodeId[] {
  const out: NodeId[] = [];
  const stack: NodeId[] = [rootChildId];
  while (stack.length) {
    const id = stack.pop()!;
    const n = nodes[id];
    if (!n) continue;
    out.push(id);
    if (n.collapsed) continue;
    for (const c of n.childrenIds) stack.push(c);
  }
  return out;
}

async function layoutOneSide(
  parentId: NodeId,
  sideChildIds: NodeId[],
  nodes: Record<NodeId, MindNode>,
  sizeOf: (n: MindNode) => { width: number; height: number },
): Promise<SideLayout> {
  const allIds = new Set<NodeId>();
  for (const cid of sideChildIds) {
    for (const id of collectSubtree(cid, nodes)) allIds.add(id);
  }

  if (allIds.size === 0) return { nodes: new Map() };

  const VIRTUAL = '__side_root__';
  const elkChildren = [
    { id: VIRTUAL, width: 1, height: 1 },
    ...Array.from(allIds).map((id) => {
      const sz = sizeOf(nodes[id]);
      return { id, width: sz.width, height: sz.height };
    }),
  ];

  type ElkEdge = {
    id: string;
    sources: string[];
    targets: string[];
    labels?: { text: string; width: number; height: number }[];
  };

  const elkEdges: ElkEdge[] = [];
  // Virtual root → first-level edges (no label). Use rootId-based id so we can match in result if needed.
  for (const cid of sideChildIds) {
    elkEdges.push({
      id: `${parentId}->${cid}`,
      sources: [VIRTUAL],
      targets: [cid],
    });
  }
  // Inner edges, labeled with the user's follow-up question
  for (const id of allIds) {
    const n = nodes[id];
    if (!n || n.collapsed) continue;
    for (const c of n.childrenIds) {
      if (!allIds.has(c)) continue;
      const child = nodes[c];
      const labelText = child && child.kind === 'A' ? child.parentEdgeLabel : '';
      const edge: ElkEdge = { id: `${id}->${c}`, sources: [id], targets: [c] };
      if (labelText) {
        const sz = estimateLabelSize(labelText);
        edge.labels = [{ text: labelText, width: sz.width, height: sz.height }];
      }
      elkEdges.push(edge);
    }
  }

  const graph = {
    id: 'root',
    layoutOptions: ELK_OPTS,
    children: elkChildren,
    edges: elkEdges,
  };

  const result = (await elk.layout(graph)) as {
    children?: { id: string; x?: number; y?: number; width?: number; height?: number }[];
  };

  const nodesOut = new Map<NodeId, Pos>();
  for (const c of result.children ?? []) {
    nodesOut.set(c.id, {
      x: c.x ?? 0,
      y: c.y ?? 0,
      width: c.width ?? 0,
      height: c.height ?? 0,
    });
  }

  // Normalize so virtual side root is at (0,0)
  const vp = nodesOut.get(VIRTUAL);
  if (vp) {
    for (const p of nodesOut.values()) {
      p.x -= vp.x;
      p.y -= vp.y;
    }
  }
  nodesOut.delete(VIRTUAL);

  // Re-center vertically: shift so center y of bbox is 0
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of nodesOut.values()) {
    if (p.y < minY) minY = p.y;
    if (p.y + p.height > maxY) maxY = p.y + p.height;
  }
  if (isFinite(minY) && isFinite(maxY)) {
    const shiftY = -(minY + maxY) / 2;
    for (const p of nodesOut.values()) p.y += shiftY;
  }

  return { nodes: nodesOut };
}

function mirrorXNode(p: Pos) {
  p.x = -p.x - p.width;
}

export interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

export async function layoutBalanced(
  rootId: NodeId,
  nodes: Record<NodeId, MindNode>,
  measuredSizes?: Map<NodeId, { width: number; height: number }>,
): Promise<LayoutResult> {
  const root = nodes[rootId];
  if (!root || root.kind !== 'rootQ') return { nodes: [], edges: [] };

  const sizeOf = (n: MindNode) => {
    if (measuredSizes) {
      const m = measuredSizes.get(n.id);
      if (m && m.width > 0 && m.height > 0) return m;
    }
    return estimateSize(n);
  };

  const rootSize = sizeOf(root);

  const leftChildren: NodeId[] = [];
  const rightChildren: NodeId[] = [];
  if (!root.collapsed) {
    for (const cid of root.childrenIds) {
      const c = nodes[cid];
      if (!c || c.kind !== 'A') continue;
      if (c.side === 'left') leftChildren.push(cid);
      else rightChildren.push(cid);
    }
  }

  const [left, right] = await Promise.all([
    layoutOneSide(rootId, leftChildren, nodes, sizeOf),
    layoutOneSide(rootId, rightChildren, nodes, sizeOf),
  ]);

  // Mirror left side nodes
  for (const p of left.nodes.values()) mirrorXNode(p);

  const outNodes: Node[] = [];
  const outEdges: Edge[] = [];

  outNodes.push({
    id: rootId,
    type: 'rootQ',
    position: { x: -rootSize.width / 2, y: -rootSize.height / 2 },
    data: { node: root },
    width: rootSize.width,
    height: rootSize.height,
    draggable: true,
  });

  const rightOffsetX = rootSize.width / 2 + 60;
  const leftOffsetX = -rootSize.width / 2 - 60;

  for (const [id, p] of right.nodes) {
    const n = nodes[id];
    if (!n) continue;
    outNodes.push({
      id,
      type: 'a',
      position: { x: p.x + rightOffsetX, y: p.y },
      data: { node: n },
      width: p.width,
      height: p.height,
      draggable: true,
    });
  }
  for (const [id, p] of left.nodes) {
    const n = nodes[id];
    if (!n) continue;
    outNodes.push({
      id,
      type: 'a',
      position: { x: p.x + leftOffsetX, y: p.y },
      data: { node: n },
      width: p.width,
      height: p.height,
      draggable: true,
    });
  }

  // Root → side child edges (no label)
  for (const cid of rightChildren) {
    outEdges.push({
      id: `${rootId}->${cid}`,
      source: rootId,
      target: cid,
      type: 'q',
      data: { label: '' },
      sourceHandle: 'r',
      targetHandle: 't',
    });
  }
  for (const cid of leftChildren) {
    outEdges.push({
      id: `${rootId}->${cid}`,
      source: rootId,
      target: cid,
      type: 'q',
      data: { label: '' },
      sourceHandle: 'l',
      targetHandle: 't',
    });
  }
  // Inner edges (label = follow-up question)
  const subtreeIds = new Set<NodeId>();
  for (const id of left.nodes.keys()) subtreeIds.add(id);
  for (const id of right.nodes.keys()) subtreeIds.add(id);
  for (const id of subtreeIds) {
    const n = nodes[id];
    if (!n || n.kind === 'rootQ' || n.collapsed) continue;
    for (const cid of n.childrenIds) {
      const c = nodes[cid];
      if (!c || c.kind !== 'A' || !subtreeIds.has(cid)) continue;
      outEdges.push({
        id: `${id}->${cid}`,
        source: id,
        target: cid,
        type: 'q',
        data: { label: c.parentEdgeLabel },
        sourceHandle: 's',
        targetHandle: 't',
      });
    }
  }

  return { nodes: outNodes, edges: outEdges };
}

const ROOT_TREE_GAP_Y = 80;

export async function layoutMultiRoot(
  rootIds: NodeId[],
  nodes: Record<NodeId, MindNode>,
  measuredSizes?: Map<NodeId, { width: number; height: number }>,
): Promise<LayoutResult> {
  if (rootIds.length === 0) return { nodes: [], edges: [] };

  const trees = await Promise.all(
    rootIds.map((rid) => layoutBalanced(rid, nodes, measuredSizes)),
  );

  const allNodes: Node[] = [];
  const allEdges: Edge[] = [];
  let cursorY = 0;

  for (const tree of trees) {
    if (tree.nodes.length === 0) continue;

    let minY = Infinity;
    let maxY = -Infinity;
    for (const n of tree.nodes) {
      const h = (n.height ?? 60) as number;
      const y = n.position.y;
      if (y < minY) minY = y;
      if (y + h > maxY) maxY = y + h;
    }
    const shift = cursorY - minY;
    for (const n of tree.nodes) {
      n.position = { x: n.position.x, y: n.position.y + shift };
    }
    allNodes.push(...tree.nodes);
    allEdges.push(...tree.edges);

    cursorY += maxY - minY + ROOT_TREE_GAP_Y;
  }

  return { nodes: allNodes, edges: allEdges };
}
