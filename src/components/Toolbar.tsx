import { useMindMap } from '../store/mindmap';
import { t } from '../i18n';

interface Props {
  onNew: () => void;
  onNewTopic: () => void;
  onOpenSettings: () => void;
  onOpen: () => void;
  onSave: () => void;
}

export function Toolbar({ onNew, onNewTopic, onOpenSettings, onOpen, onSave }: Props) {
  const filePath = useMindMap((s) => s.filePath);
  const dirty = useMindMap((s) => s.dirty);
  const hasDoc = useMindMap((s) => s.rootIds.length > 0);
  const forceRelayout = useMindMap((s) => s.forceRelayout);

  const fileName = filePath ? filePath.split('/').pop() : hasDoc ? t.unsaved : '';

  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        zIndex: 10,
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(8px)',
        padding: '6px 10px',
        borderRadius: 8,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        fontSize: 12,
      }}
    >
      {fileName && (
        <span style={{ color: 'var(--muted)', marginRight: 8 }}>
          {fileName}
          {dirty && ' •'}
        </span>
      )}
      <button className="btn" onClick={onNew} style={{ padding: '4px 10px', fontSize: 12 }}>
        {t.toolbar_new}
      </button>
      <button
        className="btn"
        onClick={onNewTopic}
        disabled={!hasDoc}
        style={{ padding: '4px 10px', fontSize: 12 }}
        title={t.toolbar_newTopicTitle}
      >
        {t.toolbar_newTopic}
      </button>
      <button className="btn" onClick={onOpen} style={{ padding: '4px 10px', fontSize: 12 }}>
        {t.toolbar_open}
      </button>
      <button
        className="btn"
        onClick={onSave}
        disabled={!hasDoc}
        style={{ padding: '4px 10px', fontSize: 12 }}
      >
        {t.toolbar_save}
      </button>
      <button
        className="btn"
        onClick={() => forceRelayout()}
        disabled={!hasDoc}
        style={{ padding: '4px 10px', fontSize: 12 }}
        title={t.toolbar_relayoutTitle}
      >
        {t.toolbar_relayout}
      </button>
      <button
        className="btn"
        onClick={onOpenSettings}
        style={{ padding: '4px 10px', fontSize: 12 }}
      >
        {t.toolbar_settings}
      </button>
    </div>
  );
}
