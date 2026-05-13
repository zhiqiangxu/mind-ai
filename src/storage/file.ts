import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

import { useMindMap } from '../store/mindmap';
import type { MindMapDoc } from '../types';

export const FILE_EXT = 'mind';

export async function openDocFile(): Promise<void> {
  const path = await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'Mind Map', extensions: [FILE_EXT, 'json'] }],
  });
  if (!path || typeof path !== 'string') return;

  const text = await readTextFile(path);
  const doc = JSON.parse(text) as MindMapDoc & { rootId?: string };
  // Accept both new (rootIds: []) and legacy (rootId: '...') formats
  const hasRoots =
    (Array.isArray(doc.rootIds) && doc.rootIds.length > 0) || typeof doc.rootId === 'string';
  if (!doc || doc.version !== 1 || !hasRoots || !doc.nodes) {
    throw new Error('文件格式无效');
  }
  useMindMap.getState().loadDoc(doc, path);
}

export async function saveDocFile(): Promise<void> {
  const store = useMindMap.getState();
  if (store.rootIds.length === 0) return;

  let path = store.filePath;
  if (!path) {
    const picked = await save({
      defaultPath: `untitled.${FILE_EXT}`,
      filters: [{ name: 'Mind Map', extensions: [FILE_EXT] }],
    });
    if (!picked) return;
    // Defensive: ensure .mind extension even if dialog dropped it
    path = picked.toLowerCase().endsWith(`.${FILE_EXT}`)
      ? picked
      : `${picked}.${FILE_EXT}`;
  }

  console.log('[save] writing to:', path);
  const doc = store.toDoc();
  try {
    await writeTextFile(path, JSON.stringify(doc, null, 2));
  } catch (err) {
    console.error('[save] failed:', err);
    alert(`保存失败：\n${(err as Error).message}\n\n目标路径：${path}`);
    throw err;
  }
  console.log('[save] success at:', path);
  useMindMap.getState().setFilePath(path);
  useMindMap.getState().markClean();
}

export async function autoSave(): Promise<void> {
  const store = useMindMap.getState();
  if (store.rootIds.length === 0 || !store.filePath || !store.dirty) return;
  // Skip autosave while any node is streaming — wait for completion.
  for (const n of Object.values(store.nodes)) {
    if (n.kind === 'A' && n.streaming) return;
  }
  const doc = store.toDoc();
  await writeTextFile(store.filePath, JSON.stringify(doc, null, 2));
  useMindMap.getState().markClean();
}
