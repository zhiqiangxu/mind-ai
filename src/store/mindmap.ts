import { create } from 'zustand';
import { newId } from '../lib/id';
import type { ANode, MindMapDoc, MindNode, NodeId, RootQNode, Side } from '../types';

const UNDO_LIMIT = 50;

type Snapshot = { rootIds: NodeId[]; nodes: Record<NodeId, MindNode> };

interface MindMapState {
  rootIds: NodeId[];
  nodes: Record<NodeId, MindNode>;
  filePath: string | null;
  dirty: boolean;
  /** Bumped on structural changes (add/delete/fold/streaming-complete). Used to gate layout recomputation. */
  structureRev: number;

  undoStack: Snapshot[];
  redoStack: Snapshot[];

  // Queries
  getNode(id: NodeId): MindNode | undefined;
  getAncestorChain(id: NodeId): MindNode[];

  // Mutations (each one pushes undo)
  initNewDoc(question: string): void;
  loadDoc(doc: MindMapDoc, filePath: string | null): void;
  addRootQ(question: string): NodeId;
  addAChild(parentId: NodeId, question: string): NodeId;
  appendAContent(id: NodeId, chunk: string): void;
  setStreaming(id: NodeId, streaming: boolean): void;
  deleteNode(id: NodeId): void;
  toggleCollapsed(id: NodeId): void;
  forceRelayout(): void;
  setFilePath(path: string | null): void;
  markClean(): void;

  // Undo/redo
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;

  // Export
  toDoc(): MindMapDoc;
}

function snapshot(state: { rootIds: NodeId[]; nodes: Record<NodeId, MindNode> }): Snapshot {
  return {
    rootIds: [...state.rootIds],
    nodes: structuredClone(state.nodes),
  };
}

function chooseSide(rootNode: RootQNode, nodes: Record<NodeId, MindNode>): Side {
  let left = 0;
  let right = 0;
  for (const childId of rootNode.childrenIds) {
    const c = nodes[childId];
    if (c && c.kind === 'A') {
      if (c.side === 'left') left++;
      else right++;
    }
  }
  return left < right ? 'left' : 'right';
}

function makeRootQ(question: string): RootQNode {
  return {
    id: newId(),
    kind: 'rootQ',
    question,
    childrenIds: [],
    collapsed: false,
  };
}

export const useMindMap = create<MindMapState>((set, get) => ({
  rootIds: [],
  nodes: {},
  filePath: null,
  dirty: false,
  structureRev: 0,
  undoStack: [],
  redoStack: [],

  getNode(id) {
    return get().nodes[id];
  },

  getAncestorChain(id) {
    const { nodes } = get();
    const chain: MindNode[] = [];
    let current: MindNode | undefined = nodes[id];
    while (current) {
      chain.unshift(current);
      if (current.kind === 'rootQ') break;
      current = nodes[current.parentId];
    }
    return chain;
  },

  initNewDoc(question) {
    const root = makeRootQ(question);
    set((s) => ({
      rootIds: [root.id],
      nodes: { [root.id]: root },
      filePath: null,
      dirty: true,
      undoStack: [],
      redoStack: [],
      structureRev: s.structureRev + 1,
    }));
  },

  loadDoc(doc, filePath) {
    // Backward compat: tolerate old files that had `rootId` instead of `rootIds`.
    const legacy = doc as unknown as { rootId?: NodeId };
    const rootIds =
      doc.rootIds && doc.rootIds.length > 0
        ? doc.rootIds
        : legacy.rootId
          ? [legacy.rootId]
          : [];
    set((s) => ({
      rootIds,
      nodes: doc.nodes,
      filePath,
      dirty: false,
      undoStack: [],
      redoStack: [],
      structureRev: s.structureRev + 1,
    }));
  },

  addRootQ(question) {
    const state = get();
    const root = makeRootQ(question);
    const undoStack = [...state.undoStack, snapshot(state)].slice(-UNDO_LIMIT);
    set((s) => ({
      rootIds: [...state.rootIds, root.id],
      nodes: { ...state.nodes, [root.id]: root },
      undoStack,
      redoStack: [],
      dirty: true,
      structureRev: s.structureRev + 1,
    }));
    return root.id;
  },

  addAChild(parentId, question) {
    const state = get();
    const parent = state.nodes[parentId];
    if (!parent) return '';

    let side: Side;
    if (parent.kind === 'rootQ') {
      side = chooseSide(parent, state.nodes);
    } else {
      side = parent.side;
    }

    const id = newId();
    const child: ANode = {
      id,
      kind: 'A',
      parentId,
      parentEdgeLabel: parent.kind === 'rootQ' ? '' : question,
      content: '',
      side,
      childrenIds: [],
      collapsed: false,
      streaming: true,
    };

    const undoStack = [...state.undoStack, snapshot(state)].slice(-UNDO_LIMIT);

    const newNodes = { ...state.nodes };
    newNodes[id] = child;
    const updatedParent: MindNode = { ...parent, childrenIds: [...parent.childrenIds, id] };
    newNodes[parentId] = updatedParent;

    set((s) => ({
      nodes: newNodes,
      undoStack,
      redoStack: [],
      dirty: true,
      structureRev: s.structureRev + 1,
    }));
    return id;
  },

  appendAContent(id, chunk) {
    const state = get();
    const n = state.nodes[id];
    if (!n || n.kind !== 'A') return;
    set({
      nodes: { ...state.nodes, [id]: { ...n, content: n.content + chunk } },
      dirty: true,
    });
  },

  setStreaming(id, streaming) {
    const state = get();
    const n = state.nodes[id];
    if (!n || n.kind !== 'A') return;
    set((s) => ({
      nodes: { ...state.nodes, [id]: { ...n, streaming } },
      structureRev: streaming === false ? s.structureRev + 1 : s.structureRev,
    }));
  },

  deleteNode(id) {
    const state = get();
    const target = state.nodes[id];
    if (!target) return;

    const undoStack = [...state.undoStack, snapshot(state)].slice(-UNDO_LIMIT);

    const toDelete = new Set<NodeId>();
    const queue = [id];
    while (queue.length) {
      const cur = queue.pop()!;
      toDelete.add(cur);
      const n = state.nodes[cur];
      if (n) queue.push(...n.childrenIds);
    }

    const newNodes: Record<NodeId, MindNode> = {};
    for (const [nid, n] of Object.entries(state.nodes)) {
      if (toDelete.has(nid)) continue;
      newNodes[nid] = n;
    }

    let newRootIds = state.rootIds;
    if (target.kind === 'rootQ') {
      // Remove from rootIds list
      newRootIds = state.rootIds.filter((rid) => rid !== id);
    } else {
      // For A nodes, update parent's childrenIds
      const parent = newNodes[(target as ANode).parentId];
      if (parent) {
        newNodes[parent.id] = {
          ...parent,
          childrenIds: parent.childrenIds.filter((c) => c !== id),
        };
      }
    }

    set((s) => ({
      rootIds: newRootIds,
      nodes: newNodes,
      undoStack,
      redoStack: [],
      dirty: true,
      structureRev: s.structureRev + 1,
    }));
  },

  toggleCollapsed(id) {
    const state = get();
    const n = state.nodes[id];
    if (!n) return;
    const undoStack = [...state.undoStack, snapshot(state)].slice(-UNDO_LIMIT);
    set((s) => ({
      nodes: { ...state.nodes, [id]: { ...n, collapsed: !n.collapsed } },
      undoStack,
      redoStack: [],
      dirty: true,
      structureRev: s.structureRev + 1,
    }));
  },

  forceRelayout() {
    set((s) => ({ structureRev: s.structureRev + 1 }));
  },

  setFilePath(path) {
    set({ filePath: path });
  },

  markClean() {
    set({ dirty: false });
  },

  undo() {
    const state = get();
    const top = state.undoStack[state.undoStack.length - 1];
    if (!top) return;
    const redo = snapshot(state);
    set((s) => ({
      nodes: top.nodes,
      rootIds: top.rootIds,
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, redo].slice(-UNDO_LIMIT),
      dirty: true,
      structureRev: s.structureRev + 1,
    }));
  },

  redo() {
    const state = get();
    const top = state.redoStack[state.redoStack.length - 1];
    if (!top) return;
    const undo = snapshot(state);
    set((s) => ({
      nodes: top.nodes,
      rootIds: top.rootIds,
      undoStack: [...state.undoStack, undo].slice(-UNDO_LIMIT),
      redoStack: state.redoStack.slice(0, -1),
      dirty: true,
      structureRev: s.structureRev + 1,
    }));
  },

  canUndo() {
    return get().undoStack.length > 0;
  },

  canRedo() {
    return get().redoStack.length > 0;
  },

  toDoc() {
    const { rootIds, nodes } = get();
    return {
      version: 1,
      rootIds,
      nodes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  },
}));
