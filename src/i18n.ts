type Lang = 'zh' | 'en';

function detectLang(): Lang {
  const raw = (navigator.language || 'en').toLowerCase();
  return raw.startsWith('zh') ? 'zh' : 'en';
}

export const currentLang: Lang = detectLang();

const zh = {
  // toolbar
  unsaved: '未保存',
  toolbar_new: '新建',
  toolbar_newTopic: '新主题',
  toolbar_newTopicTitle: '为当前文档添加新主题（也可双击空白处）',
  toolbar_open: '打开',
  toolbar_save: '保存',
  toolbar_relayout: '重排',
  toolbar_relayoutTitle: '重新布局（Shift+L）',
  toolbar_settings: '设置',

  // new doc dialog
  newDoc_title: '新建思维导图',
  newDoc_titleTopic: '新增主题',
  newDoc_hint:
    '输入你想探索的问题或主题。AI 会基于这个根问题给出初始回答，你之后可以继续追问发散。',
  newDoc_hintTopic: '输入一个新主题。它会作为一棵独立的子树加入当前文档。',
  newDoc_placeholder: '例如：什么是宏观经济学？',
  newDoc_create: '创建（⌘+Enter）',
  cancel: '取消',
  save: '保存',

  // settings
  settings_title: '设置',
  settings_desc: '选择当前使用的 provider。所有设置（含 API Key）存储在本机：',
  settings_apiKey: 'API Key',
  settings_stored: '✓ 已存储',
  settings_storedPlaceholder: '已存储（如需替换，重新输入）',
  settings_model: '模型',
  settings_baseUrl: 'Base URL',
  settings_clear: '清除',
  settings_setActive: '设为当前',
  settings_active: '当前使用',
  settings_loadFailed: '设置加载失败：',
  settings_saveFailed: '保存失败：',
  settings_verifyFailed: '保存后读取设置失败。',

  // follow-up input
  followup_placeholder: '输入追问...',
  followup_hint: 'Enter 提交 · Shift+Enter 换行 · Esc 取消',

  // nodes
  node_regenerate: '重新生成回答',
  node_regenerateTitle: '生成回答',
  node_add: '追问 (Tab)',
  node_delete: '删除 (Delete)',

  // api / streaming
  api_noKey_anthropic: '未设置 Anthropic API Key',
  api_noKey_deepseek: '未设置 DeepSeek API Key',
  api_emptyContext: '上下文为空',
  api_noBody: '响应没有 body',
  api_genFailed: '生成失败',

  // system prompt
  systemPrompt:
    '你是一个善于解释和发散思考的研究助手。回答应清晰、有结构（适当使用 markdown 列表和小标题），通常 150-400 字。回答中可以指出值得进一步探讨的方向，但不要主动罗列"问题清单"。',

};

const en: typeof zh = {
  unsaved: 'Unsaved',
  toolbar_new: 'New',
  toolbar_newTopic: 'New Topic',
  toolbar_newTopicTitle: 'Add a new topic to current doc (or double-click empty area)',
  toolbar_open: 'Open',
  toolbar_save: 'Save',
  toolbar_relayout: 'Relayout',
  toolbar_relayoutTitle: 'Re-run auto layout (Shift+L)',
  toolbar_settings: 'Settings',

  newDoc_title: 'New Mind Map',
  newDoc_titleTopic: 'Add Topic',
  newDoc_hint:
    'Enter a question or topic to explore. The AI will generate an initial answer as the root, and you can branch off with follow-ups.',
  newDoc_hintTopic: 'Enter a new topic. It will become an independent subtree in this doc.',
  newDoc_placeholder: 'e.g., What is macroeconomics?',
  newDoc_create: 'Create (⌘+Enter)',
  cancel: 'Cancel',
  save: 'Save',

  settings_title: 'Settings',
  settings_desc: 'Choose the active provider. All settings (incl. API keys) are stored locally at:',
  settings_apiKey: 'API Key',
  settings_stored: '✓ stored',
  settings_storedPlaceholder: 'Stored (enter a new value to replace)',
  settings_model: 'Model',
  settings_baseUrl: 'Base URL',
  settings_clear: 'Clear',
  settings_setActive: 'Use this',
  settings_active: 'Active',
  settings_loadFailed: 'Failed to load settings: ',
  settings_saveFailed: 'Failed to save: ',
  settings_verifyFailed: 'Could not read back saved settings.',

  followup_placeholder: 'Type a follow-up question...',
  followup_hint: 'Enter to submit · Shift+Enter for newline · Esc to cancel',

  node_regenerate: 'Generate answer',
  node_regenerateTitle: 'Generate answer',
  node_add: 'Ask follow-up (Tab)',
  node_delete: 'Delete (Delete)',

  api_noKey_anthropic: 'Anthropic API key not set',
  api_noKey_deepseek: 'DeepSeek API key not set',
  api_emptyContext: 'Empty context',
  api_noBody: 'Response has no body',
  api_genFailed: 'Generation failed',

  systemPrompt:
    'You are a research assistant skilled at explanation and divergent thinking. Answers should be clear and structured (use markdown lists and small headings when appropriate), typically 150-400 words. You may suggest directions worth deeper exploration, but do NOT proactively list "question lists".',

};

export const t = currentLang === 'zh' ? zh : en;
