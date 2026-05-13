import type { Edge, Node } from '@xyflow/react';
import type { MindNode, NodeId } from '../types';

/**
 * Placeholder layout — basic side-aware tree positioning.
 * Replaced by the elkjs-driven balanced map in src/layout/balanced.ts (task #7).
 */

const NODE_W = 260;
const NODE_H = 110;
const ROOT_W = 200;
const ROOT_H = 60;
const H_GAP = 90;
const V_GAP = 24;

interface SubtreeMetrics {
  height: number;
}

function measureSubtree(
  id: NodeId,
  nodes: Record<NodeId, MindNode>,
  isRoot: boolean,
): SubtreeMetrics {
  const n = nodes[id];
  if (!n) return { height: 0 };
  if (n.collapsed || n.childrenIds.length === 0) {
    return { height: isRoot ? ROOT_H : NODE_H };
  }
  const childHeights = n.childrenIds.map((cid) => measureSubtree(cid, nodes, false).height);
  const totalChildHeight =
    childHeights.reduce((s, h) => s + h, 0) + V_GAP * (childHeights.length - 1);
  const selfHeight = isRoot ? ROOT_H : NODE_H;
  return { height: Math.max(selfHeight, totalChildHeight) };
}

function placeSubtree(
  id: NodeId,
  nodes: Record<NodeId, MindNode>,
  cx: number,
  cy: number,
  dir: 1 | -1, // 1 = right, -1 = left
  outNodes: Node[],
  outEdges: Edge[],
  isRoot: boolean,
) {
  const n = nodes[id];
  if (!n) return;

  const w = isRoot ? ROOT_W : NODE_W;
  const h = isRoot ? ROOT_H : NODE_H;
  // (cx, cy) is the center; convert to top-left for React Flow position
  const position = { x: cx - w / 2, y: cy - h / 2 };

  outNodes.push({
    id,
    type: isRoot ? 'rootQ' : 'a',
    position,
    data: { node: n },
    // size hint helps React Flow; will be overridden by measured DOM size
    width: w,
    height: h,
    draggable: false,
  });

  if (n.collapsed || n.childrenIds.length === 0) return;

  const children = n.childrenIds;
  const childMetrics = children.map((cid) => measureSubtree(cid, nodes, false));
  const totalH = childMetrics.reduce((s, m) => s + m.height, 0) + V_GAP * (children.length - 1);

  let yCursor = cy - totalH / 2;
  for (let i = 0; i < children.length; i++) {
    const cid = children[i];
    const m = childMetrics[i];
    const childCy = yCursor + m.height / 2;
    const childCx = cx + dir * (w / 2 + H_GAP + NODE_W / 2);

    placeSubtree(cid, nodes, childCx, childCy, dir, outNodes, outEdges, false);

    const childNode = nodes[cid];
    const isRootEdge = n.kind === 'rootQ';
    outEdges.push({
      id: `${id}->${cid}`,
      source: id,
      target: cid,
      type: 'q',
      data: {
        label:
          !isRootEdge && childNode && childNode.kind === 'A' ? childNode.parentEdgeLabel : '',
      },
      sourceHandle: isRootEdge ? (dir === 1 ? 'r' : 'l') : undefined,
    });

    yCursor += m.height + V_GAP;
  }
}

export function layoutTree(
  rootId: NodeId,
  nodes: Record<NodeId, MindNode>,
): { nodes: Node[]; edges: Edge[] } {
  const root = nodes[rootId];
  if (!root || root.kind !== 'rootQ') return { nodes: [], edges: [] };

  const outNodes: Node[] = [];
  const outEdges: Edge[] = [];

  // Root at origin
  outNodes.push({
    id: root.id,
    type: 'rootQ',
    position: { x: -ROOT_W / 2, y: -ROOT_H / 2 },
    data: { node: root },
    width: ROOT_W,
    height: ROOT_H,
    draggable: false,
  });

  if (root.collapsed) return { nodes: outNodes, edges: outEdges };

  // Partition direct children by side
  const left: NodeId[] = [];
  const right: NodeId[] = [];
  for (const cid of root.childrenIds) {
    const c = nodes[cid];
    if (!c || c.kind !== 'A') continue;
    if (c.side === 'left') left.push(cid);
    else right.push(cid);
  }

  function placeSide(ids: NodeId[], dir: 1 | -1) {
    if (ids.length === 0) return;
    const metrics = ids.map((id) => measureSubtree(id, nodes, false));
    const totalH = metrics.reduce((s, m) => s + m.height, 0) + V_GAP * (ids.length - 1);
    let yCursor = -totalH / 2;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const m = metrics[i];
      const cy = yCursor + m.height / 2;
      const cx = dir * (ROOT_W / 2 + H_GAP + NODE_W / 2);

      placeSubtree(id, nodes, cx, cy, dir, outNodes, outEdges, false);

      const child = nodes[id];
      outEdges.push({
        id: `${root.id}->${id}`,
        source: root.id,
        target: id,
        type: 'q',
        data: { label: '' }, // root edge has no label
        sourceHandle: dir === 1 ? 'r' : 'l',
      });

      // child node receives default target handle on the appropriate side; the ANode component sets its target Handle based on `side`
      yCursor += m.height + V_GAP;
      void child;
    }
  }

  placeSide(left, -1);
  placeSide(right, 1);

  return { nodes: outNodes, edges: outEdges };
}
