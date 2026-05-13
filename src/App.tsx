import { useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { MindMap } from './components/MindMap';
import { NewDocDialog } from './components/NewDocDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { Toolbar } from './components/Toolbar';
import { useMindMap } from './store/mindmap';
import { autoSave, openDocFile, saveDocFile } from './storage/file';
import './App.css';

type DialogMode = 'newDoc' | 'newTopic';

function App() {
  const rootIds = useMindMap((s) => s.rootIds);
  const undo = useMindMap((s) => s.undo);
  const redo = useMindMap((s) => s.redo);
  const dirty = useMindMap((s) => s.dirty);
  const [dialog, setDialog] = useState<DialogMode | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // First-launch: prompt to create a new doc if none exists
  useEffect(() => {
    if (rootIds.length === 0 && dialog === null) {
      setDialog('newDoc');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === 's') {
        e.preventDefault();
        saveDocFile().catch((err) => console.error(err));
      } else if (e.key === 'o') {
        e.preventDefault();
        openDocFile().catch((err) => console.error(err));
      } else if (e.key === 'n') {
        e.preventDefault();
        setDialog('newDoc');
      } else if (e.key === ',') {
        e.preventDefault();
        setShowSettings(true);
      } else if (e.shiftKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault();
        useMindMap.getState().forceRelayout();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // Autosave every 5s when dirty
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => {
      autoSave().catch((err) => console.error('autoSave:', err));
    }, 5000);
    return () => clearTimeout(t);
  }, [dirty]);

  return (
    <div className="app-root">
      <ReactFlowProvider>
        <MindMap onRequestNewTopic={() => setDialog('newTopic')} />
      </ReactFlowProvider>
      <Toolbar
        onNew={() => setDialog('newDoc')}
        onNewTopic={() => setDialog('newTopic')}
        onOpen={() => openDocFile().catch((err) => console.error(err))}
        onSave={() => saveDocFile().catch((err) => console.error(err))}
        onOpenSettings={() => setShowSettings(true)}
      />
      {dialog && <NewDocDialog mode={dialog} onClose={() => setDialog(null)} />}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </div>
  );
}

export default App;
