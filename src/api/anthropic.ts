import { fetch } from '@tauri-apps/plugin-http';

import { getApiKey, getBaseUrl, getModel } from '../config';
import { useMindMap } from '../store/mindmap';
import { t } from '../i18n';
import { SYSTEM_PROMPT, buildChatHistory } from './common';

export async function streamAnthropic(nodeId: string): Promise<void> {
  const apiKey = await getApiKey('anthropic');
  if (!apiKey) throw new Error(t.api_noKey_anthropic);
  const model = await getModel('anthropic');
  const baseUrl = await getBaseUrl('anthropic');

  const messages = buildChatHistory(nodeId);
  if (messages.length === 0) throw new Error(t.api_emptyContext);

  const store = useMindMap.getState();

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      stream: true,
      messages,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${text}`);
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
        const event = parseSSE(raw);
        if (!event) continue;
        if (event.event === 'content_block_delta') {
          try {
            const data = JSON.parse(event.data);
            const text = data?.delta?.text;
            if (typeof text === 'string' && text) {
              store.appendAContent(nodeId, text);
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

function parseSSE(raw: string): { event: string; data: string } | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}
