import { useEffect, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';

import { useMindMap } from '../store/mindmap';
import { streamAnswer } from '../api/llm';
import { t } from '../i18n';

interface Props {
  parentId: string;
  onClose: () => void;
}

export function FollowUpInput({ parentId, onClose }: Props) {
  const [text, setText] = useState('');
  const rf = useReactFlow();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  // Position the input next to the parent node
  useEffect(() => {
    const parent = rf.getNode(parentId);
    if (!parent) return;
    const w = parent.measured?.width ?? (parent as { width?: number }).width ?? 200;
    const h = parent.measured?.height ?? (parent as { height?: number }).height ?? 60;

    // Determine direction: for root, default to right; for A nodes, use their side
    const storeNode = useMindMap.getState().getNode(parentId);
    let dir: 1 | -1 = 1;
    if (storeNode) {
      if (storeNode.kind === 'A') {
        dir = storeNode.side === 'left' ? -1 : 1;
      }
      // for rootQ, pick side with fewer current children
      if (storeNode.kind === 'rootQ') {
        let left = 0;
        let right = 0;
        for (const cid of storeNode.childrenIds) {
          const c = useMindMap.getState().getNode(cid);
          if (c && c.kind === 'A') {
            if (c.side === 'left') left++;
            else right++;
          }
        }
        dir = left < right ? -1 : 1;
      }
    }

    const flowAnchorX = dir === 1 ? parent.position.x + w + 40 : parent.position.x - 40 - 280;
    const flowAnchorY = parent.position.y + h / 2;
    const screen = rf.flowToScreenPosition({ x: flowAnchorX, y: flowAnchorY });
    setPos({ x: screen.x, y: screen.y });
  }, [parentId, rf]);

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    const store = useMindMap.getState();
    const newId = store.addAChild(parentId, trimmed);
    onClose();
    if (newId) {
      streamAnswer(newId).catch((err) => {
        console.error('streamAnswer failed:', err);
        useMindMap
          .getState()
          .appendAContent(newId, `\n\n_(${t.api_genFailed}: ${(err as Error).message})_`);
        useMindMap.getState().setStreaming(newId, false);
      });
    }
  }

  if (!pos) return null;

  return (
    <div
      ref={ref}
      className="followup-wrap"
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        transform: 'translateY(-50%)',
        zIndex: 50,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
        onBlur={() => {
          // Slight delay so click on submit area still works
          setTimeout(() => onClose(), 100);
        }}
        placeholder={t.followup_placeholder}
      />
      <div className="followup-hint">{t.followup_hint}</div>
    </div>
  );
}
