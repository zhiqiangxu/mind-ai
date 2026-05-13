import { Handle, Position, type NodeProps } from '@xyflow/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ANode as AType } from '../../types';
import { t } from '../../i18n';

type Data = {
  node: AType;
  onAddChild: (id: string) => void;
  onDelete: (id: string) => void;
};

export function ANode({ data }: NodeProps & { data: Data }) {
  const { node, onAddChild, onDelete } = data;
  const isLeft = node.side === 'left';

  const targetPos = isLeft ? Position.Right : Position.Left;
  const sourcePos = isLeft ? Position.Left : Position.Right;

  return (
    <div className={`node-a nowheel ${node.streaming ? 'streaming' : ''}`}>
      <Handle type="target" position={targetPos} id="t" style={{ opacity: 0 }} />
      <Handle type="source" position={sourcePos} id="s" style={{ opacity: 0 }} />
      <div className="a-content">
        {node.content ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{node.content}</ReactMarkdown>
        ) : (
          <span style={{ color: 'var(--muted)' }}>{node.streaming ? '...' : '—'}</span>
        )}
      </div>
      <div className="node-actions">
        <button
          className="node-add-btn"
          title={t.node_add}
          onClick={(e) => {
            e.stopPropagation();
            onAddChild(node.id);
          }}
        >
          +
        </button>
        <button
          className="node-del-btn"
          title={t.node_delete}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(node.id);
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
