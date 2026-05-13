import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';

interface QEdgeData {
  label?: string;
  labelPos?: { x: number; y: number };
}

export function QEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps) {
  const [edgePath, pathLabelX, pathLabelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 12,
  });

  const d = data as QEdgeData | undefined;
  const label = d?.label ?? '';
  // Prefer elkjs-computed label position; fall back to path midpoint
  const labelX = d?.labelPos?.x ?? pathLabelX;
  const labelY = d?.labelPos?.y ?? pathLabelY;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{ stroke: '#cbd5e1', strokeWidth: 1.5 }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="edge-label nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            title={label}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
