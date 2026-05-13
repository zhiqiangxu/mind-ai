import { fetch } from '@tauri-apps/plugin-http';

import { getApiKey, getBaseUrl, getModel } from '../config';
import { useMindMap } from '../store/mindmap';
import { t } from '../i18n';
import { SYSTEM_PROMPT, buildChatHistory } from './common';

export async function streamDeepseek(nodeId: string): Promise<void> {
  const apiKey = await getApiKey('deepseek');
  if (!apiKey) throw new Error(t.api_noKey_deepseek);
  const model = await getModel('deepseek');
  const baseUrl = await getBaseUrl('deepseek');

  const chat = buildChatHistory(nodeId);
  if (chat.length === 0) throw new Error(t.api_emptyContext);

  // OpenAI-compatible: system goes into messages array
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...chat,
  ];

  const store = useMindMap.getState();

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      stream: true,
      messages,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek API ${res.status}: ${text}`);
  }
  if (!res.body) throw new Error(t.api_noBody);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        // OpenAI SSE: one or more `data: ...` lines per event
        for (const line of raw.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const data = JSON.parse(payload);
            const delta = data?.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta) {
              store.appendAContent(nodeId, delta);
            }
          } catch {
            /* ignore parse errors */
          }
        }
      }
    }
  } finally {
    useMindMap.getState().setStreaming(nodeId, false);
  }
}
