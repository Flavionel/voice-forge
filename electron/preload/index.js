import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  setAllSettings: (settings) => ipcRenderer.invoke('settings:setAll', settings),

  // ElevenLabs
  getVoices: () => ipcRenderer.invoke('elevenlabs:getVoices'),
  getModels: () => ipcRenderer.invoke('elevenlabs:getModels'),
  testElevenLabsApiKey: (apiKey) => ipcRenderer.invoke('elevenlabs:testApiKey', apiKey),
  testTTS: (options) => ipcRenderer.invoke('elevenlabs:testTTS', options),

  // OpenAI / GPT
  testOpenAIApiKey: (apiKey) => ipcRenderer.invoke('openai:testApiKey', apiKey),
  getOpenAIModels: () => ipcRenderer.invoke('openai:getModels'),
  testGPTProcessing: (text, voiceAlias) => ipcRenderer.invoke('gpt:testProcess', { text, voiceAlias }),
  isEmotionCapableModel: (modelId) => ipcRenderer.invoke('gpt:isEmotionCapable', modelId),
  getModerationRuleDefinitions: () => ipcRenderer.invoke('moderation:getRuleDefinitions'),

  // Queue
  getQueue: () => ipcRenderer.invoke('queue:get'),
  clearQueue: () => ipcRenderer.invoke('queue:clear'),
  pauseQueue: () => ipcRenderer.invoke('queue:pause'),
  resumeQueue: () => ipcRenderer.invoke('queue:resume'),
  cancelQueueItem: (id) => ipcRenderer.invoke('queue:cancel', id),
  moderateQueueItem: (id, action, position) => ipcRenderer.invoke('queue:moderate', { id, action, position }),

  // Audio
  audioFinished: (id, duration) => ipcRenderer.invoke('audio:finished', { id, duration }),

  // Connection controls
  getWsServerStatus: () => ipcRenderer.invoke('ws-server:getStatus'),
  restartWsServer: () => ipcRenderer.invoke('ws-server:restart'),
  getStreamerbotStatus: () => ipcRenderer.invoke('streamerbot:getStatus'),
  reconnectStreamerbot: () => ipcRenderer.invoke('streamerbot:reconnect'),

  // History
  getHistory: () => ipcRenderer.invoke('history:get'),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  refundHistoryItem: (id) => ipcRenderer.invoke('history:refund', id),
  replayHistoryItem: (id, position, useShowHide) => ipcRenderer.invoke('history:replay', { id, position, useShowHide }),
  getLogDirectory: () => ipcRenderer.invoke('history:getLogDirectory'),
  browseLogDirectory: () => ipcRenderer.invoke('history:browseLogDirectory'),
  openLogDirectory: () => ipcRenderer.invoke('history:openLogDirectory'),

  // App info
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  getChangelog: () => ipcRenderer.invoke('app:getChangelog'),

  // Shell
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // Text Processing
  testTextProcessing: (text, voiceAlias) => ipcRenderer.invoke('textProcessing:test', { text, voiceAlias }),
  testSingleRule: (text, rule) => ipcRenderer.invoke('textProcessing:testRule', { text, rule }),
  validateRegexPattern: (pattern) => ipcRenderer.invoke('textProcessing:validatePattern', pattern),

  // Event listeners
  onQueueUpdate: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('queue:update', handler)
    return () => ipcRenderer.removeListener('queue:update', handler)
  },

  onAudioPlay: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('audio:play', handler)
    return () => ipcRenderer.removeListener('audio:play', handler)
  },

  onWsServerStatus: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('ws-server:status', handler)
    return () => ipcRenderer.removeListener('ws-server:status', handler)
  },

  onStreamerbotStatus: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('streamerbot:status', handler)
    return () => ipcRenderer.removeListener('streamerbot:status', handler)
  },

  onHistoryUpdate: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('history:update', handler)
    return () => ipcRenderer.removeListener('history:update', handler)
  },

  // Auto-updates
  installUpdate: () => ipcRenderer.invoke('update:install'),

  onUpdateStatus: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('update:status', handler)
    return () => ipcRenderer.removeListener('update:status', handler)
  }
})
