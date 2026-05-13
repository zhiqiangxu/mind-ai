export type NodeId = string;

export type Side = 'left' | 'right';

export interface RootQNode {
  id: NodeId;
  kind: 'rootQ';
  question: string;
  childrenIds: NodeId[];
  collapsed: boolean;
}

export interface ANode {
  id: NodeId;
  kind: 'A';
  parentId: NodeId;
  parentEdgeLabel: string;
  content: string;
  side: Side;
  childrenIds: NodeId[];
  collapsed: boolean;
  streaming: boolean;
}

export type MindNode = RootQNode | ANode;

export interface MindMapDoc {
  version: 1;
  rootIds: NodeId[];
  nodes: Record<NodeId, MindNode>;
  createdAt: number;
  updatedAt: number;
}
