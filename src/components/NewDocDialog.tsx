import { useState } from 'react';
import { useMindMap } from '../store/mindmap';
import { streamAnswer } from '../api/llm';
import { t } from '../i18n';

type Mode = 'newDoc' | 'newTopic';

interface Props {
  mode: Mode;
  onClose: () => void;
}

function streamSafely(newId: string) {
  streamAnswer(newId).catch((err) => {
    console.error('streamAnswer failed:', err);
    useMindMap
      .getState()
      .appendAContent(newId, `\n\n_(${t.api_genFailed}: ${(err as Error).message})_`);
    useMindMap.getState().setStreaming(newId, false);
  });
}

export function NewDocDialog({ mode, onClose }: Props) {
  const [text, setText] = useState('');

  function submit() {
    const s = text.trim();
    if (!s) return;
    const store = useMindMap.getState();
    let rootQId: string;
    if (mode === 'newDoc') {
      store.initNewDoc(s);
      rootQId = useMindMap.getState().rootIds[0];
    } else {
      rootQId = store.addRootQ(s);
    }
    onClose();
    if (rootQId) {
      const aId = useMindMap.getState().addAChild(rootQId, '');
      if (aId) streamSafely(aId);
    }
  }

  const title = mode === 'newDoc' ? t.newDoc_title : t.newDoc_titleTopic;
  const hint = mode === 'newDoc' ? t.newDoc_hint : t.newDoc_hintTopic;

  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <h2>{title}</h2>
        <p>{hint}</p>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
          }}
          placeholder={t.newDoc_placeholder}
        />
        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>
            {t.cancel}
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={!text.trim()}>
            {t.newDoc_create}
          </button>
        </div>
      </div>
    </div>
  );
}
