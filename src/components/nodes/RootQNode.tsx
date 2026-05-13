import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { RootQNode as RootQType } from '../../types';
import { t } from '../../i18n';

type Data = {
  node: RootQType;
  onRegenerateRoot: (id: string) => void;
};

export function RootQNode({ data }: NodeProps & { data: Data }) {
  const { node, onRegenerateRoot } = data;
  const hasNoChildren = node.childrenIds.length === 0;

  return (
    <div className="node-root">
      <Handle type="source" position={Position.Right} id="r" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Left} id="l" style={{ opacity: 0 }} />
      <div>{node.question}</div>
      {hasNoChildren && (
        <button
          className="node-regen-btn"
          title={t.node_regenerateTitle}
          onClick={(e) => {
            e.stopPropagation();
            onRegenerateRoot(node.id);
          }}
        >
          {t.node_regenerate}
        </button>
      )}
    </div>
  );
}
