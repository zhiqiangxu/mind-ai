import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';

interface QEdgeData {
  label?: string;
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
  const [edgePath] = getSmoothStepPath({
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

  // Place the label on the final horizontal segment going into the target —
  // the part unique to this edge — instead of the shared vertical trunk that
  // siblings overlap on. Midpoint between the bend (midX) and targetX, at targetY.
  const midX = (sourceX + targetX) / 2;
  const labelX = (midX + targetX) / 2;
  const labelY = targetY;

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
