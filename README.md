# Mind AI

English | [简体中文](README.zh-CN.md)

A mind-map style AI exploration tool. Ask a question, get an answer as a node, then branch off with follow-ups — your conversation becomes a tree, not a chat log.

Built for non-linear thinking: research, learning, exploring a topic from multiple angles. Local-first — your data stays on your machine.

## Features

- **Xmind-style balanced map**: root in the center, branches both sides
- **Strict Q–A tree**: each follow-up question becomes the label on the edge to a new answer node
- **Streaming responses**: see the AI write the answer in real time
- **Multiple topics per file**: explore several questions in one mind map
- **BYOK** (Bring Your Own Key): use your Anthropic or DeepSeek API key
- **Local-first**: `.mind` files saved on disk as plain JSON, no cloud
- **i18n**: auto-detects Chinese / English from system locale

## Install

Pre-built binaries (when available) are on the [Releases](https://github.com/zhiqiangxu/mind-ai/releases) page.

## Build from source

Requirements: Node 22+, Rust 1.85+

```bash
git clone https://github.com/zhiqiangxu/mind-ai
cd mind-ai
npm install
npm run tauri dev          # development
npm run tauri build        # production bundle
```

## Configuration

On first launch, open Settings (`⌘+,`) and paste your API key:

- **Anthropic**: get one at <https://console.anthropic.com/>
- **DeepSeek**: get one at <https://platform.deepseek.com/> (much cheaper for testing)

All settings (including API keys) are stored locally at:

```
~/Library/Application Support/com.mindai.app/settings.json
```

Keys never leave your machine.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `⌘+N` | New file |
| `⌘+O` | Open file |
| `⌘+S` | Save |
| `⌘+,` | Settings |
| `Tab` | Add follow-up to selected A node |
| `Delete` / `Backspace` | Delete selected node (cascade) |
| `⌘+Z` / `⌘+Shift+Z` | Undo / redo |
| `Shift+L` | Force re-layout |
| Double-click empty canvas | Add a new topic to current doc |

## File format

`.mind` files are plain JSON:

```json
{
  "version": 1,
  "rootIds": ["abc"],
  "nodes": {
    "abc": { "id": "abc", "kind": "rootQ", "question": "...", "childrenIds": [...], "collapsed": false },
    "xyz": { "id": "xyz", "kind": "A", "parentId": "abc", "parentEdgeLabel": "...", "content": "...", "side": "right", ... }
  },
  "createdAt": 0,
  "updatedAt": 0
}
```

You can open/edit them with any text editor.

## Tech stack

- [Tauri 2](https://tauri.app/) + [React 19](https://react.dev/) + TypeScript
- [@xyflow/react](https://reactflow.dev/) for the canvas
- [elkjs](https://github.com/kieler/elkjs) for auto-layout
- [Zustand](https://github.com/pmndrs/zustand) for state with undo/redo
- Anthropic & DeepSeek streaming via `@tauri-apps/plugin-http` (bypasses browser CORS)

## License

MIT — see [LICENSE](LICENSE).

## Contributing

PRs welcome. Open an issue first for anything non-trivial.
