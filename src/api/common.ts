import { useMindMap } from '../store/mindmap';
import { t } from '../i18n';
import type { MindNode } from '../types';

export const SYSTEM_PROMPT = t.systemPrompt;

export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Build the chat history for a node that's about to be generated.
 * Linearizes the ancestor chain (root Q + alternating edge-questions + A contents)
 * into a list of user/assistant messages.
 */
export function buildChatHistory(nodeId: string): ChatMsg[] {
  const store = useMindMap.getState();
  const chain = store.getAncestorChain(nodeId);
  if (chain.length === 0) return [];

  const msgs: ChatMsg[] = [];
  const root = chain[0];
  if (root.kind === 'rootQ') {
    msgs.push({ role: 'user', content: root.question });
  }

  for (let i = 1; i < chain.length; i++) {
    const n = chain[i] as Extract<MindNode, { kind: 'A' }>;
    if (i === chain.length - 1) {
      // The target node — being generated. Its parentEdgeLabel (if any) is the question.
      // For root A (no parentEdgeLabel), root Q already serves as the prompt.
      if (n.parentEdgeLabel) {
        msgs.push({ role: 'user', content: n.parentEdgeLabel });
      }
    } else {
      if (n.parentEdgeLabel) {
        msgs.push({ role: 'user', content: n.parentEdgeLabel });
      }
      msgs.push({ role: 'assistant', content: n.content });
    }
  }

  return msgs;
}
