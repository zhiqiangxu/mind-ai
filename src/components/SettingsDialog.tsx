import { useEffect, useState } from 'react';
import {
  PROVIDER_DEFAULTS,
  type Provider,
  deleteApiKey,
  getActiveProvider,
  getApiKey,
  getBaseUrl,
  getModel,
  setActiveProvider,
  setApiKey,
  setBaseUrl,
  setModel,
} from '../config';
import { t } from '../i18n';

interface Props {
  onClose: () => void;
}

interface ProviderState {
  apiKey: string;
  hasKey: boolean;
  model: string;
  baseUrl: string;
}

const EMPTY: ProviderState = { apiKey: '', hasKey: false, model: '', baseUrl: '' };

export function SettingsDialog({ onClose }: Props) {
  const [provider, setProvider] = useState<Provider>('anthropic');
  const [anthropic, setAnthropic] = useState<ProviderState>(EMPTY);
  const [deepseek, setDeepseek] = useState<ProviderState>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const active = await getActiveProvider();
        setProvider(active);
        const aKey = await getApiKey('anthropic');
        const aModel = await getModel('anthropic');
        const aBase = await getBaseUrl('anthropic');
        setAnthropic({ apiKey: '', hasKey: !!aKey, model: aModel, baseUrl: aBase });
        const dKey = await getApiKey('deepseek');
        const dModel = await getModel('deepseek');
        const dBase = await getBaseUrl('deepseek');
        setDeepseek({ apiKey: '', hasKey: !!dKey, model: dModel, baseUrl: dBase });
        console.log('[settings load]', {
          active,
          anthropicHasKey: !!aKey,
          deepseekHasKey: !!dKey,
          anthropicModel: aModel,
          deepseekModel: dModel,
        });
      } catch (e) {
        console.error('[settings load failed]', e);
        alert(t.settings_loadFailed + (e as Error).message);
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    let ok = false;
    try {
      const hasA = anthropic.hasKey || anthropic.apiKey.trim().length > 0;
      const hasD = deepseek.hasKey || deepseek.apiKey.trim().length > 0;
      let effective: Provider = provider;
      if (provider === 'anthropic' && !hasA && hasD) effective = 'deepseek';
      else if (provider === 'deepseek' && !hasD && hasA) effective = 'anthropic';

      console.log('[settings save] effective provider:', effective);

      await setActiveProvider(effective);
      for (const [p, s] of [
        ['anthropic', anthropic] as const,
        ['deepseek', deepseek] as const,
      ]) {
        if (s.apiKey.trim()) {
          await setApiKey(p, s.apiKey.trim());
        }
        await setModel(p, s.model);
        await setBaseUrl(p, s.baseUrl.trim() || PROVIDER_DEFAULTS[p].baseUrl);
      }

      const verifyActive = await getActiveProvider();
      const verifyKey = await getApiKey(effective);
      console.log('[settings save] verify:', {
        active: verifyActive,
        keyExists: !!verifyKey,
      });
      if (!verifyKey && (effective === 'anthropic' ? hasA : hasD)) {
        throw new Error(t.settings_verifyFailed);
      }

      ok = true;
    } catch (e) {
      console.error('[settings save failed]', e);
      alert(t.settings_saveFailed + (e as Error).message);
    } finally {
      setSaving(false);
      if (ok) onClose();
    }
  }

  async function clearKey(p: Provider) {
    await deleteApiKey(p);
    if (p === 'anthropic') setAnthropic((s) => ({ ...s, hasKey: false, apiKey: '' }));
    else setDeepseek((s) => ({ ...s, hasKey: false, apiKey: '' }));
  }

  function renderProviderSection(
    p: Provider,
    state: ProviderState,
    setState: (s: ProviderState) => void,
    label: string,
  ) {
    const defaults = PROVIDER_DEFAULTS[p];
    const isActive = provider === p;
    const placeholderEmpty = p === 'anthropic' ? 'sk-ant-...' : 'sk-...';
    return (
      <div
        style={{
          padding: 14,
          border: isActive ? '2px solid var(--a-accent)' : '1px solid #e5e7eb',
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <strong style={{ fontSize: 14 }}>{label}</strong>
          <label style={{ fontSize: 12, color: isActive ? 'var(--a-accent)' : 'var(--muted)' }}>
            <input
              type="radio"
              name="provider"
              checked={isActive}
              onChange={() => setProvider(p)}
              style={{ marginRight: 4 }}
            />
            {isActive ? t.settings_active : t.settings_setActive}
          </label>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 3 }}>
            {t.settings_apiKey}
            {state.hasKey && <span style={{ color: '#10b981', marginLeft: 6 }}>{t.settings_stored}</span>}
          </label>
          <input
            type="password"
            value={state.apiKey}
            onChange={(e) => {
              const v = e.target.value;
              setState({ ...state, apiKey: v });
              if (v.trim() && provider !== p) setProvider(p);
            }}
            placeholder={state.hasKey ? t.settings_storedPlaceholder : placeholderEmpty}
            autoComplete="off"
          />
          {state.hasKey && (
            <button
              className="btn"
              onClick={() => clearKey(p)}
              style={{ padding: '2px 8px', fontSize: 11, marginTop: 4 }}
            >
              {t.settings_clear}
            </button>
          )}
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 3 }}>{t.settings_model}</label>
          <select
            value={state.model}
            onChange={(e) => setState({ ...state, model: e.target.value })}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              fontSize: 13,
            }}
          >
            {defaults.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 3 }}>{t.settings_baseUrl}</label>
          <input
            type="text"
            value={state.baseUrl}
            onChange={(e) => setState({ ...state, baseUrl: e.target.value })}
            placeholder={defaults.baseUrl}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="dialog-overlay">
      <div className="dialog" style={{ width: 560 }}>
        <h2>{t.settings_title}</h2>
        <p style={{ marginBottom: 14 }}>
          {t.settings_desc}
          <br />
          <code style={{ fontSize: 11 }}>~/Library/Application Support/com.mindai.app/settings.json</code>
        </p>

        {renderProviderSection('anthropic', anthropic, setAnthropic, 'Anthropic')}
        {renderProviderSection('deepseek', deepseek, setDeepseek, 'DeepSeek')}

        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>
            {t.cancel}
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
