import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Background,
  Controls,
  ReactFlow,
  applyNodeChanges,
  useReactFlow,
  type Node,
  type Edge,
  type NodeChange,
  type OnSelectionChangeParams,
} from '@xyflow/react';

import { useMindMap } from '../store/mindmap';
import { layoutMultiRoot } from '../layout/balanced';
import { RootQNode } from './nodes/RootQNode';
import { ANode } from './nodes/ANode';
import { QEdge } from './edges/QEdge';
import { FollowUpInput } from './FollowUpInput';
import { streamAnswer } from '../api/llm';
import { t } from '../i18n';
import type { NodeId } from '../types';

const nodeTypes = { rootQ: RootQNode, a: ANode };
const edgeTypes = { q: QEdge };

interface Props {
  onRequestNewTopic: () => void;
}

export function MindMap({ onRequestNewTopic }: Props) {
  const rootIds = useMindMap((s) => s.rootIds);
  const nodes = useMindMap((s) => s.nodes);
  const structureRev = useMindMap((s) => s.structureRev);
  const deleteNode = useMindMap((s) => s.deleteNode);
  const rf = useReactFlow();
  const initialized = useRef(false);

  const [rfNodes, setRfNodes] = useState<Node[]>([]);
  const [rfEdges, setRfEdges] = useState<Edge[]>([]);
  const [pendingParentId, setPendingParentId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const resizeDebounce = useRef<number>(0);

  const onAddChild = useCallback((parentId: string) => {
    setPendingParentId(parentId);
  }, []);

  const onDelete = useCallback(
    (id: string) => {
      const n = useMindMap.getState().getNode(id);
      if (!n) return;
      deleteNode(id);
      setSelectedNodeId((cur) => (cur === id ? null : cur));
    },
    [deleteNode],
  );

  const onRegenerateRoot = useCallback((rootQId: string) => {
    const store = useMindMap.getState();
    const root = store.getNode(rootQId);
    if (!root || root.kind !== 'rootQ') return;
    if (root.childrenIds.length > 0) return;
    const newId = store.addAChild(rootQId, '');
    if (!newId) return;
    streamAnswer(newId).catch((err) => {
      console.error('streamAnswer failed:', err);
      useMindMap
        .getState()
        .appendAContent(newId, `\n\n_(${t.api_genFailed}: ${(err as Error).message})_`);
      useMindMap.getState().setStreaming(newId, false);
    });
  }, []);

  // Tracks heights we asked React Flow to reserve for each node, so the ResizeObserver
  // below can compare against actual DOM size.
  const reservedHeights = useRef(new Map<NodeId, number>());
  // Tracks actual DOM heights of the inner .node-a / .node-root (since React Flow's
  // wrapper is fixed-size, its .measured is useless for detecting drift).
  const actualHeights = useRef(new Map<NodeId, { width: number; height: number }>());
  // Tracks the rootIds we last laid out, to detect document-level changes (load, new file, new topic)
  // and trigger fit-view only on those — not on every structural change.
  const prevRootIds = useRef<string[]>([]);

  // Recompute layout when structure changes — using whatever measurements React Flow has.
  useEffect(() => {
    let cancelled = false;
    const state = useMindMap.getState();
    if (state.rootIds.length === 0) {
      setRfNodes([]);
      setRfEdges([]);
      reservedHeights.current.clear();
      initialized.current = false;
      return;
    }

    // Prefer the actual measured-from-DOM heights captured by ResizeObserver;
    // fall back to React Flow's measured (which may be the fixed wrapper size) for entries we haven't seen yet.
    const measured = new Map<NodeId, { width: number; height: number }>();
    for (const n of rf.getNodes()) {
      const m = (n as { measured?: { width?: number; height?: number } }).measured;
      if (m && m.width && m.height) {
        measured.set(n.id, { width: m.width, height: m.height });
      }
    }
    for (const [id, h] of actualHeights.current) {
      measured.set(id, h);
    }

    layoutMultiRoot(state.rootIds, state.nodes, measured).then(({ nodes: ns, edges }) => {
      if (cancelled) return;
      const decorated = ns.map((n) => ({
        ...n,
        data: {
          ...(n.data as object),
          onAddChild,
          onDelete,
          onRegenerateRoot,
        },
      }));
      reservedHeights.current = new Map(
        decorated.map((n) => [n.id, (n.height as number) ?? 0]),
      );
      setRfNodes(decorated);
      setRfEdges(edges);
      // Fit view on first init OR when the set of root IDs differs from the previous layout
      // (file open, new file, new topic added). Pure structural changes inside the same roots
      // (follow-up A nodes) keep prevRootIds the same and don't trigger fit.
      const cur = state.rootIds;
      const prev = prevRootIds.current;
      const rootsChanged =
        cur.length !== prev.length || cur.some((id, i) => id !== prev[i]);
      prevRootIds.current = [...cur];
      if (!initialized.current || rootsChanged) {
        initialized.current = true;
        // Camera target:
        //   X = horizontal centroid of all nodes (so content is balanced left/right of viewport)
        //   Y = root Q's vertical center (so the root is on the vertical midline)
        //   Zoom = 1.0 (so text is full size & legible — fitView would zoom way out for tall trees)
        setTimeout(() => {
          const firstRoot = decorated.find((n) => n.type === 'rootQ');
          if (!firstRoot) return;
          let minX = Infinity;
          let maxX = -Infinity;
          for (const n of decorated) {
            const w = (n.width as number) ?? 200;
            if (n.position.x < minX) minX = n.position.x;
            if (n.position.x + w > maxX) maxX = n.position.x + w;
          }
          const cx = isFinite(minX) ? (minX + maxX) / 2 : firstRoot.position.x;
          const rh = (firstRoot.height as number) ?? 60;
          const cy = firstRoot.position.y + rh / 2;
          rf.setCenter(cx, cy, { zoom: 1.0, duration: 400 });
        }, 200);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootIds, structureRev]);

  // Dynamic adjustment: watch the inner node DOM (which sizes to content) and compare
  // to the height we reserved. React Flow sets a fixed-size wrapper around our node,
  // so we have to observe .node-a / .node-root directly — the wrapper never resizes.
  useEffect(() => {
    if (rfNodes.length === 0) return;

    const observer = new ResizeObserver((entries) => {
      // Update actualHeights map with every observed size (regardless of streaming).
      let drifted = false;
      for (const entry of entries) {
        const innerEl = entry.target as HTMLElement;
        const wrapper = innerEl.closest('.react-flow__node');
        if (!wrapper) continue;
        const id = wrapper.getAttribute('data-id');
        if (!id) continue;
        const blockSize = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        const inlineSize = entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
        actualHeights.current.set(id, { width: inlineSize, height: blockSize });
        const reserved = reservedHeights.current.get(id);
        if (reserved != null && Math.abs(blockSize - reserved) > 16) {
          drifted = true;
        }
      }

      // Skip relayout during streaming (avoid jitter); we still keep actualHeights updated.
      const state = useMindMap.getState();
      for (const n of Object.values(state.nodes)) {
        if (n.kind === 'A' && n.streaming) return;
      }
      if (!drifted) return;

      if (resizeDebounce.current) window.clearTimeout(resizeDebounce.current);
      resizeDebounce.current = window.setTimeout(() => {
        const s = useMindMap.getState();
        for (const n of Object.values(s.nodes)) {
          if (n.kind === 'A' && n.streaming) return;
        }
        s.forceRelayout();
      }, 200);
    });

    let raf = requestAnimationFrame(() => {
      const els = document.querySelectorAll<HTMLElement>('.node-a, .node-root');
      els.forEach((el) => observer.observe(el));
    });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [rfNodes]);

  // Live data sync: reflect content changes (e.g. streaming) into existing React Flow nodes
  useEffect(() => {
    const unsub = useMindMap.subscribe((state) => {
      setRfNodes((prev) =>
        prev.map((n) => {
          const live = state.nodes[n.id];
          if (!live) return n;
          return { ...n, data: { ...(n.data as object), node: live } };
        }),
      );
    });
    return unsub;
  }, []);

  // Clear selection if the selected node no longer exists (e.g., cascade-deleted)
  useEffect(() => {
    if (selectedNodeId && !nodes[selectedNodeId]) {
      setSelectedNodeId(null);
    }
  }, [nodes, selectedNodeId]);

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    const sel = params.nodes[0];
    setSelectedNodeId(sel ? sel.id : null);
  }, []);

  // Required for controlled mode — without this, drag/select/etc. don't persist
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setRfNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  // Keyboard: Tab (follow-up — only on A nodes), Delete/Backspace (delete selected)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) return;
      if (!selectedNodeId) return;

      const n = useMindMap.getState().getNode(selectedNodeId);
      if (!n) return;

      if (e.key === 'Tab') {
        // Tab follow-up only applies to A nodes — root Q is itself a question
        if (n.kind === 'A') {
          e.preventDefault();
          setPendingParentId(selectedNodeId);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteNode(selectedNodeId);
        setSelectedNodeId(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedNodeId, deleteNode]);

  // Double-click on empty pane → open new-topic dialog
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.classList.contains('react-flow__pane')) {
        onRequestNewTopic();
      }
    },
    [onRequestNewTopic],
  );

  return (
    <>
      <div onDoubleClick={handleDoubleClick} style={{ width: '100%', height: '100%' }}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
          onNodesChange={onNodesChange}
          onSelectionChange={onSelectionChange}
          deleteKeyCode={null}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          fitView={false}
        >
          <Background gap={20} size={1} color="#e5e7eb" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      {pendingParentId && (
        <FollowUpInput
          parentId={pendingParentId}
          onClose={() => setPendingParentId(null)}
        />
      )}
    </>
  );
}
