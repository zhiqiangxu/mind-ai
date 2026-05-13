import { useMindMap } from '../store/mindmap';
import { streamAnswer } from '../api/llm';

/**
 * Placeholder follow-up flow — minimal version using window.prompt().
 * Task #6 will replace this with a proper inline input UI.
 */
export async function askFollowUp(parentId: string) {
  const store = useMindMap.getState();
  const parent = store.getNode(parentId);
  if (!parent) return;

  const question = window.prompt('追问：');
  if (!question || !question.trim()) return;

  const newId = store.addAChild(parentId, question.trim());
  if (!newId) return;

  try {
    await streamAnswer(newId);
  } catch (err) {
    console.error('streamAnswer failed:', err);
    useMindMap.getState().appendAContent(newId, `\n\n_（生成失败：${(err as Error).message}）_`);
    useMindMap.getState().setStreaming(newId, false);
  }
}
