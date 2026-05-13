# Mind AI

[English](README.md) | 简体中文

一款思维导图式的 AI 探索工具。提一个问题，AI 的回答作为一个节点；从任意节点继续追问，对话长成一棵树而不是聊天记录。

为非线性思考设计：调研、学习、从多个角度探索一个话题。**本地优先**——你的数据不离开你的电脑。

## 特性

- **Xmind 风格平衡布局**：根节点居中，分支向两侧展开
- **严格的 Q–A 树**：每次追问作为边上的 label，回答作为新节点
- **流式响应**：实时看到 AI 写出回答
- **一份文档多个主题**：可以在同一张图里探索多个相关问题
- **BYOK**（自带 API Key）：支持 Anthropic 和 DeepSeek
- **本地优先**：`.mind` 文件是纯 JSON，存在你的硬盘上
- **国际化**：根据系统语言自动切换中英文

## 安装

预编译版本（如有）在 [Releases](https://github.com/zhiqiangxu/mind-ai/releases) 页面。

## 从源码构建

环境要求：Node 22+、Rust 1.85+

```bash
git clone https://github.com/zhiqiangxu/mind-ai
cd mind-ai
npm install
npm run tauri dev          # 开发模式
npm run tauri build        # 生产打包
```

## 配置

首次启动后，按 `⌘+,` 打开设置，粘贴你的 API Key：

- **Anthropic**：[console.anthropic.com](https://console.anthropic.com/) 申请
- **DeepSeek**：[platform.deepseek.com](https://platform.deepseek.com/) 申请（测试便宜很多）

所有设置（含 API Key）存在本地：

```
~/Library/Application Support/com.mindai.app/settings.json
```

Key 永远不会离开你的机器。

## 快捷键

| 键 | 操作 |
|---|---|
| `⌘+N` | 新建文件 |
| `⌘+O` | 打开文件 |
| `⌘+S` | 保存 |
| `⌘+,` | 设置 |
| `Tab` | 在选中的 A 节点上追问 |
| `Delete` / `Backspace` | 删除选中节点（级联） |
| `⌘+Z` / `⌘+Shift+Z` | 撤销 / 重做 |
| `Shift+L` | 强制重新布局 |
| 双击空白画布 | 给当前文档新增一个主题 |

## 文件格式

`.mind` 文件是纯 JSON：

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

任何文本编辑器都能打开和修改。

## 技术栈

- [Tauri 2](https://tauri.app/) + [React 19](https://react.dev/) + TypeScript
- [@xyflow/react](https://reactflow.dev/) —— 画布
- [elkjs](https://github.com/kieler/elkjs) —— 自动布局
- [Zustand](https://github.com/pmndrs/zustand) —— 状态管理 + 撤销/重做
- Anthropic / DeepSeek 流式调用走 `@tauri-apps/plugin-http`（绕过浏览器 CORS）

## 协议

MIT，详见 [LICENSE](LICENSE)。

## 贡献

欢迎 PR。重大改动请先开 issue 讨论。
