import { LazyStore } from '@tauri-apps/plugin-store';

export type Provider = 'anthropic' | 'deepseek';

interface ProviderDefaults {
  model: string;
  baseUrl: string;
  models: { id: string; label: string }[];
}

export const PROVIDER_DEFAULTS: Record<Provider, ProviderDefaults> = {
  anthropic: {
    model: 'claude-sonnet-4-6',
    baseUrl: 'https://api.anthropic.com',
    models: [
      { id: 'claude-opus-4-7', label: 'Claude Opus 4.7' },
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    ],
  },
  deepseek: {
    model: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek Chat (V3)' },
      { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner (R1)' },
    ],
  },
};

const STORE_KEY_PROVIDER = 'active_provider';

function apiKeyKey(p: Provider) {
  return `api_key_${p}`;
}
function modelKey(p: Provider) {
  return `model_${p}`;
}
function baseUrlKey(p: Provider) {
  return `base_url_${p}`;
}

const store = new LazyStore('settings.json');

export async function getActiveProvider(): Promise<Provider> {
  const v = await store.get<Provider>(STORE_KEY_PROVIDER);
  return v ?? 'anthropic';
}

export async function setActiveProvider(p: Provider): Promise<void> {
  await store.set(STORE_KEY_PROVIDER, p);
  await store.save();
}

export async function getApiKey(p: Provider): Promise<string | null> {
  const v = await store.get<string>(apiKeyKey(p));
  return v ?? null;
}

export async function setApiKey(p: Provider, value: string): Promise<void> {
  await store.set(apiKeyKey(p), value);
  await store.save();
}

export async function deleteApiKey(p: Provider): Promise<void> {
  await store.delete(apiKeyKey(p));
  await store.save();
}

export async function getModel(p: Provider): Promise<string> {
  const v = await store.get<string>(modelKey(p));
  return v ?? PROVIDER_DEFAULTS[p].model;
}

export async function setModel(p: Provider, value: string): Promise<void> {
  await store.set(modelKey(p), value);
  await store.save();
}

export async function getBaseUrl(p: Provider): Promise<string> {
  const v = await store.get<string>(baseUrlKey(p));
  return v ?? PROVIDER_DEFAULTS[p].baseUrl;
}

export async function setBaseUrl(p: Provider, value: string): Promise<void> {
  await store.set(baseUrlKey(p), value);
  await store.save();
}
