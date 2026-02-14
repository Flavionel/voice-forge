import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, safeStorage, dialog, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import Store from 'electron-store'
import { WebSocketServer } from 'ws'
import WebSocket from 'ws'
import { v4 as uuidv4 } from 'uuid'
import {
  processText,
  testSingleRule,
  validateRegexPattern,
  applyMaxLength,
  getEffectiveMaxLength,
  sanitizeInput,
  getEffectiveSanitization
} from '../services/textProcessor.js'
import {
  processWithGPTParallel,
  isEmotionCapableModel,
  getEffectiveGPTConfig,
  AVAILABLE_OPENAI_MODELS,
  RULE_DEFINITIONS,
  STRICTNESS_LEVELS
} from '../services/gptProcessor.js'
import { initAutoUpdater } from '../services/autoUpdater.js'

// Set app name for userData path (%APPDATA%/VoiceForge/)
app.name = 'VoiceForge'

// Single-instance lock — prevent multiple copies from running
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  dialog.showErrorBox('VoiceForge', 'VoiceForge is already running. Check the system tray or taskbar.')
  app.quit()
}

// Initialize settings store (non-sensitive data)
const store = new Store({
  defaults: {
    // Encrypted API keys stored as base64
    elevenLabsApiKeyEncrypted: '',
    chatGptApiKeyEncrypted: '',
    // Non-sensitive settings
    wsServerPort: 7591,
    streamerbotHost: 'localhost',
    streamerbotPort: 7590,
    showActionId: '',
    hideActionId: '',
    refundActionId: '',
    globalVolume: 100, // Playback volume 0-200%
    minimizeToTray: false, // When true, closing the window minimizes to system tray
    manualModerationEnabled: false, // When true, blocked items stay for manual review
    voices: [],
    defaultVoiceAlias: '',
    minimumLingerMs: 1500,
    animationDurationMs: 1200,
    // Window bounds (remembered on resize/move)
    windowBounds: {
      width: 1280,
      height: 940,
      x: undefined,
      y: undefined
    },
    // History/logging settings
    historyLogDir: '',  // Empty = use app's userData/logs
    historyFileLoggingEnabled: true,
    historyInAppLimit: 100,
    // Text processing / replacements
    globalReplacements: [],  // Array of { id, pattern, replacement, isRegex, caseSensitive, enabled }
    // Max message length settings (dual limits - both can be enabled)
    maxMessageLength: {
      characters: {
        enabled: false,
        value: 500
      },
      words: {
        enabled: false,
        value: 50
      }
    },
    // Input sanitization settings
    sanitization: {
      stripHtmlTags: true,
      stripCodeBlocks: true,
      stripZalgoText: true,  // Remove Zalgo/combining Unicode marks
      stripUserBracketTags: true  // Remove user's [tags] - can be disabled per-voice
    },
    // OpenAI/GPT settings
    openAIDefaultModel: 'gpt-5-nano',  // Default model for GPT processing
    openAIReasoningEffort: 'minimal',  // For GPT-5 reasoning models: minimal, low, medium, high
    gptProcessing: {
      enabled: false,  // Master toggle - requires valid API key
      contentModeration: {
        enabled: true,  // Master toggle for all moderation features
        onFailure: 'block',  // 'block' = fail-closed (safe), 'skip' = proceed without moderation
        // Granular moderation rules - using strictness levels
        // Safety rules: 'off' | 'standard' | 'strict'
        // Copyright rules: based on risk level (high risk = on by default)
        rules: {
          // Safety rules - standard by default
          sexualContent: { level: 'standard' },
          hateSpeech: { level: 'standard' },
          violence: { level: 'standard' },
          doxxing: { level: 'standard' },
          misinformation: { level: 'standard' },
          // Profanity: mode + level + exceptions
          profanity: {
            mode: 'replace',       // 'block', 'replace', or 'allow'
            level: 'standard',     // 'standard' (strong only) or 'strict' (all profanity)
            replacementWord: 'quack',
            exceptions: []         // Words to allow even if profanity
          },
          // Copyright rules - based on risk level
          songLyrics: { level: 'standard' },      // HIGH risk - enabled by default
          mediaQuotes: { level: 'off' }           // MEDIUM risk - disabled by default
        },
        // Topic blocking - empty by default, user chooses what to block
        blockedTopics: {
          presets: {},  // No topics blocked by default
          custom: []  // User-added topics as strings
        },
        // Free-form custom instructions
        customInstructions: ''
      },
      emotionEnhancement: {
        enabled: true  // Add V3 emotion tags (only applies to V3 ElevenLabs models)
      }
    }
  }
})

// ============ SECURE STORAGE HELPERS ============
function encryptApiKey(plainText) {
  if (!plainText) return ''
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('Encryption not available, storing in plain text')
    return plainText
  }
  const encrypted = safeStorage.encryptString(plainText)
  return encrypted.toString('base64')
}

function decryptApiKey(encryptedBase64) {
  if (!encryptedBase64) return ''
  if (!safeStorage.isEncryptionAvailable()) {
    // Assume it's plain text if encryption wasn't available
    return encryptedBase64
  }
  try {
    const buffer = Buffer.from(encryptedBase64, 'base64')
    return safeStorage.decryptString(buffer)
  } catch (error) {
    console.error('Failed to decrypt API key:', error.message)
    return ''
  }
}

// Getters for API keys (decrypted)
function getElevenLabsApiKey() {
  return decryptApiKey(store.get('elevenLabsApiKeyEncrypted'))
}

function getChatGptApiKey() {
  return decryptApiKey(store.get('chatGptApiKeyEncrypted'))
}

// Setters for API keys (encrypted)
function setElevenLabsApiKey(plainText) {
  store.set('elevenLabsApiKeyEncrypted', encryptApiKey(plainText))
}

function setChatGptApiKey(plainText) {
  store.set('chatGptApiKeyEncrypted', encryptApiKey(plainText))
}

let mainWindow = null
let tray = null
let wsServer = null
let streamerbotWs = null
let streamerbotReconnectTimeout = null

// TTS Queue
const ttsQueue = []
let isProcessing = false
let isPaused = false
let currentTtsId = null
let lingerTimeoutId = null // Tracks if we're currently lingering (timeout ID or null)

// TTS History (in-memory for UI display)
const ttsHistory = []

// ============ HISTORY/LOGGING ============
function getLogDirectory() {
  const customDir = store.get('historyLogDir')
  if (customDir && customDir.trim()) {
    return customDir
  }
  // Default to app's userData/logs
  return path.join(app.getPath('userData'), 'logs')
}

function getLogFilePath() {
  const logDir = getLogDirectory()
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  return path.join(logDir, `tts-history-${today}.jsonl`)
}

function ensureLogDirectory() {
  const logDir = getLogDirectory()
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
  }
}

function loadHistoryFromLogs() {
  try {
    const logDir = getLogDirectory()
    if (!fs.existsSync(logDir)) return

    const limit = store.get('historyInAppLimit') || 100

    // Get all JSONL files sorted by date (newest first)
    const files = fs.readdirSync(logDir)
      .filter(f => f.startsWith('tts-history-') && f.endsWith('.jsonl'))
      .sort((a, b) => b.localeCompare(a)) // Reverse chronological

    let loaded = 0

    for (const file of files) {
      if (loaded >= limit) break

      const filePath = path.join(logDir, file)
      const content = fs.readFileSync(filePath, 'utf8')
      const lines = content.trim().split('\n').filter(Boolean)

      // Read lines in reverse order (newest entries last in file, we want newest first)
      for (let i = lines.length - 1; i >= 0; i--) {
        if (loaded >= limit) break
        try {
          const entry = JSON.parse(lines[i])
          ttsHistory.push(entry)
          loaded++
        } catch {
          // Skip corrupted lines silently
        }
      }
    }

    if (loaded > 0) {
      console.log(`[History] Loaded ${loaded} entries from log files`)
    }
  } catch (error) {
    console.error('[History] Failed to load from logs:', error.message)
  }
}

function addToHistory(entry) {
  // Add to in-memory history (for UI)
  const limit = store.get('historyInAppLimit') || 100
  ttsHistory.unshift(entry) // Add to beginning (newest first)
  while (ttsHistory.length > limit) {
    ttsHistory.pop() // Remove oldest
  }

  // Write to file if enabled
  if (store.get('historyFileLoggingEnabled')) {
    try {
      ensureLogDirectory()
      const logPath = getLogFilePath()
      const line = JSON.stringify(entry) + '\n'
      fs.appendFileSync(logPath, line, 'utf8')
    } catch (error) {
      console.error('Failed to write to history log:', error.message)
    }
  }

  // Notify renderer of history update
  sendToRenderer('history:update', ttsHistory)
}

function createHistoryEntry(queueItem, status, durationMs = null, error = null) {
  // Get voice config for additional details
  const voices = store.get('voices') || []
  const voiceConfig = voices.find(v => v.alias === queueItem.alias)

  return {
    id: queueItem.id,
    timestamp: new Date().toISOString(),
    // Display text for History table (shows final result or original if blocked)
    text: queueItem.processedText || queueItem.text,
    // Full text processing pipeline (for debugging/logging)
    originalText: queueItem.originalText || queueItem.text,  // 1. Source (raw input)
    afterReplacements: queueItem.afterReplacements || null,  // 2. After text replacements
    afterSanitization: queueItem.afterSanitization || null,  // 3. After HTML/code/bracket stripping
    afterTruncation: queueItem.afterTruncation || null,       // 3b. After max-length truncation
    afterGPT: queueItem.afterGPT || null,                    // 4. After GPT processing (moderation + emotion)
    finalText: queueItem.processedText || queueItem.text,    // 5. FINAL (sent to ElevenLabs, after truncation)
    // Processing metadata
    moderationOverride: queueItem.moderationOverride || false, // Manually approved by streamer
    wasTruncated: queueItem.wasTruncated || false,
    truncatedBy: queueItem.truncatedBy || null,
    sanitizationApplied: queueItem.sanitizationApplied || [],
    gptUsed: queueItem.gptUsed || false,
    gptTagsAdded: queueItem.gptTagsAdded || [],
    gptTiming: queueItem.gptTiming || null,  // { totalMs, promptTokens, completionTokens, totalTokens }
    gptModel: queueItem.gptModel || null,
    gptError: queueItem.gptError || null,
    blockReason: queueItem.blockReason || null,
    charactersUsed: queueItem.charactersUsed || 0,  // Characters sent to ElevenLabs
    // Voice/model info
    voiceAlias: queueItem.alias || 'unknown',
    voiceId: voiceConfig?.elevenLabsVoiceId || null,
    modelId: voiceConfig?.elevenLabsModelId || 'eleven_multilingual_v2',
    // Result info
    durationMs: durationMs,
    status: status, // 'completed', 'error', or 'blocked'
    error: error,
    username: queueItem.username || null, // If provided by Streamerbot
    redemptionId: queueItem.redemptionId || null,
    rewardId: queueItem.rewardId || null,
    refunded: queueItem.refunded || false, // Channel points refund was triggered
    historyItemId: queueItem.historyItemId || null // ElevenLabs history ID for replay
  }
}

function clearHistory() {
  ttsHistory.length = 0
  sendToRenderer('history:update', ttsHistory)
}

// ============ SYSTEM TRAY ============
function createTray() {
  if (tray) return

  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '../../build/icon.png')

  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(trayIcon)
  tray.setToolTip('VoiceForge')

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show', click: () => { mainWindow?.show() } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit() } }
  ])
  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => { mainWindow?.show() })
}

function destroyTray() {
  if (tray) {
    tray.destroy()
    tray = null
  }
}

// ============ WINDOW CREATION ============
function createWindow() {
  // Hide the menu bar
  Menu.setApplicationMenu(null)

  // Get saved window bounds or use defaults
  const savedBounds = store.get('windowBounds')
  const windowOptions = {
    width: savedBounds.width || 1100,
    height: savedBounds.height || 800,
    minWidth: 900,
    minHeight: 700,
    autoHideMenuBar: true,
    icon: app.isPackaged
      ? path.join(process.resourcesPath, 'icon.png')
      : path.join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false // Needed for some Node.js features
    }
  }

  // Only set position if we have saved values (otherwise let OS decide)
  if (savedBounds.x !== undefined && savedBounds.y !== undefined) {
    windowOptions.x = savedBounds.x
    windowOptions.y = savedBounds.y
  }

  mainWindow = new BrowserWindow(windowOptions)

  // Save window bounds when resized or moved (debounced to avoid excessive writes)
  let boundsTimeout = null
  const saveBounds = () => {
    if (boundsTimeout) clearTimeout(boundsTimeout)
    boundsTimeout = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isMinimized()) {
        const bounds = mainWindow.getBounds()
        store.set('windowBounds', bounds)
      }
    }, 500)
  }

  mainWindow.on('resize', saveBounds)
  mainWindow.on('move', saveBounds)

  // Load the app
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('close', (event) => {
    if (store.get('minimizeToTray') && !app.isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // // Register F12 to toggle DevTools (disabled for production)
  // mainWindow.webContents.on('before-input-event', (event, input) => {
  //   if (input.key === 'F12') {
  //     mainWindow.webContents.toggleDevTools()
  //     event.preventDefault()
  //   }
  // })
}

// ============ SETTINGS IPC HANDLERS ============
ipcMain.handle('settings:get', () => {
  const settings = { ...store.store }

  // Decrypt API keys (returns '' if decryption fails)
  settings.elevenLabsApiKey = getElevenLabsApiKey()
  settings.chatGptApiKey = getChatGptApiKey()

  // Remove encrypted versions from response
  delete settings.elevenLabsApiKeyEncrypted
  delete settings.chatGptApiKeyEncrypted

  return settings
})

ipcMain.handle('settings:set', (event, key, value) => {
  // Handle API keys specially - encrypt them
  if (key === 'elevenLabsApiKey') {
    setElevenLabsApiKey(value)
  } else if (key === 'chatGptApiKey') {
    setChatGptApiKey(value)
  } else {
    store.set(key, value)
  }

  // Handle specific settings changes
  if (key === 'wsServerPort') {
    restartWebSocketServer()
  } else if (key === 'streamerbotHost' || key === 'streamerbotPort') {
    reconnectToStreamerbot()
  } else if (key === 'minimizeToTray') {
    value ? createTray() : destroyTray()
  }

  return true
})

ipcMain.handle('settings:setAll', (event, settings) => {
  Object.entries(settings).forEach(([key, value]) => {
    if (key === 'elevenLabsApiKey') {
      setElevenLabsApiKey(value)
    } else if (key === 'chatGptApiKey') {
      setChatGptApiKey(value)
    } else {
      store.set(key, value)
    }
  })
  return true
})

// ============ ELEVENLABS API ============
ipcMain.handle('elevenlabs:getVoices', async () => {
  const apiKey = getElevenLabsApiKey()
  console.log('getVoices - API key retrieved, length:', apiKey?.length || 0)

  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured. Please save your API key first.')
  }

  const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: {
      'xi-api-key': apiKey
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.log('getVoices error:', response.status, errorText)
    throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  return data.voices
})

ipcMain.handle('elevenlabs:getModels', async () => {
  const apiKey = getElevenLabsApiKey()

  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured. Please save your API key first.')
  }

  const response = await fetch('https://api.elevenlabs.io/v1/models', {
    headers: {
      'xi-api-key': apiKey
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.log('getModels error:', response.status, errorText)
    throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  // Filter to only TTS models and sort by name
  return data
    .filter(model => model.can_do_text_to_speech)
    .map(model => ({
      model_id: model.model_id,
      name: model.name,
      description: model.description,
      languages: model.languages?.map(l => l.name) || []
    }))
})

// Test TTS - generate audio without queuing (for voice preview)
ipcMain.handle('elevenlabs:testTTS', async (event, { text, voiceId, modelId, settings }) => {
  const apiKey = getElevenLabsApiKey()

  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured')
  }

  if (!text || !voiceId) {
    throw new Error('Text and voice ID are required')
  }

  // Build voice settings
  const voiceSettings = {
    stability: settings?.stability ?? 0.5,
    similarity_boost: settings?.similarityBoost ?? 0.75,
    use_speaker_boost: settings?.useSpeakerBoost ?? true
  }

  // Only include style for multilingual v2
  const model = modelId || 'eleven_multilingual_v2'
  if (model === 'eleven_multilingual_v2' && settings?.style != null && settings.style > 0) {
    voiceSettings.style = settings.style
  }

  // Only include speed if different from default
  if (settings?.speed != null && settings.speed !== 1.0) {
    voiceSettings.speed = settings.speed
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        model_id: model,
        voice_settings: voiceSettings
      })
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`ElevenLabs TTS error: ${response.status} - ${error}`)
  }

  // Return audio as base64
  const buffer = await response.arrayBuffer()
  return Buffer.from(buffer).toString('base64')
})

ipcMain.handle('elevenlabs:testApiKey', async (event, apiKey) => {
  try {
    // Trim whitespace from key
    const cleanKey = apiKey?.trim()
    if (!cleanKey) {
      return { valid: false, error: 'No API key provided' }
    }

    console.log('Testing ElevenLabs API key (length:', cleanKey.length, ')')

    const response = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: {
        'xi-api-key': cleanKey
      }
    })

    console.log('ElevenLabs API response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.log('ElevenLabs API error:', errorText)
      return { valid: false, error: `API returned ${response.status}: ${errorText}` }
    }

    // If valid, save the key automatically
    setElevenLabsApiKey(cleanKey)
    console.log('ElevenLabs API key saved after successful test')

    return { valid: true }
  } catch (error) {
    console.error('ElevenLabs API test error:', error.message)
    return { valid: false, error: error.message }
  }
})

// ============ OPENAI API ============
ipcMain.handle('openai:testApiKey', async (event, apiKey) => {
  try {
    // Trim whitespace from key
    const cleanKey = apiKey?.trim()
    if (!cleanKey) {
      return { valid: false, error: 'No API key provided' }
    }

    console.log('Testing OpenAI API key (length:', cleanKey.length, ')')

    // Test by fetching models list - simple and doesn't cost anything
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${cleanKey}`
      }
    })

    console.log('OpenAI API response status:', response.status)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || `API returned ${response.status}`
      console.log('OpenAI API error:', errorMessage)
      return { valid: false, error: errorMessage }
    }

    // If valid, save the key automatically
    setChatGptApiKey(cleanKey)
    console.log('OpenAI API key saved after successful test')

    return { valid: true }
  } catch (error) {
    console.error('OpenAI API test error:', error.message)
    return { valid: false, error: error.message }
  }
})

// Get available OpenAI models
ipcMain.handle('openai:getModels', () => {
  return AVAILABLE_OPENAI_MODELS
})

// Get moderation rule definitions and strictness levels (for UI)
ipcMain.handle('moderation:getRuleDefinitions', () => {
  return { ruleDefinitions: RULE_DEFINITIONS, strictnessLevels: STRICTNESS_LEVELS }
})

// Test GPT processing on text
ipcMain.handle('gpt:testProcess', async (event, { text, voiceAlias }) => {
  const apiKey = getChatGptApiKey()
  if (!apiKey) {
    return { success: false, error: 'No OpenAI API key configured', text }
  }

  const voices = store.get('voices') || []
  const voiceConfig = voiceAlias ? voices.find(v => v.alias === voiceAlias) : null
  const globalGptConfig = store.get('gptProcessing') || {}
  const globalModel = store.get('openAIDefaultModel') || 'gpt-5-nano'
  const globalSanitization = store.get('sanitization') || {}
  const reasoningEffort = store.get('openAIReasoningEffort') || 'minimal'

  // Step 1: Sanitize input
  const effectiveSanitization = getEffectiveSanitization(voiceConfig, globalSanitization)
  const { result: sanitizedText, sanitizationApplied } = sanitizeInput(text, effectiveSanitization)

  // Step 2: Determine effective GPT config
  const effectiveConfig = getEffectiveGPTConfig(voiceConfig, globalGptConfig, apiKey)
  const model = voiceConfig?.openAIModelOverride || globalModel

  // For testing: if emotion enhancement is enabled, assume V3 model so user can see the tags
  // In real processing, we check the actual ElevenLabs model
  const isEmotionCapable = effectiveConfig.emotionEnhancement.enabled ? true : false

  // Build config for GPT processing (include full moderation config for granular rules)
  const gptConfig = {
    contentModeration: effectiveConfig.contentModeration.enabled,
    moderationConfig: effectiveConfig.contentModeration,  // Full config for granular rules
    emotionEnhancement: effectiveConfig.emotionEnhancement.enabled,
    isEmotionCapable
  }

  // Step 3: Run GPT processing (parallel mode for better reliability)
  const gptResult = await processWithGPTParallel(sanitizedText, apiKey, model, gptConfig, reasoningEffort)

  // Return combined result
  return {
    ...gptResult,
    sanitizationApplied,
    isEmotionCapable,
    tagsAdded: gptResult.tagsAdded || [],
    moderationConfig: effectiveConfig.contentModeration  // Include for UI display
  }
})

// Check if an ElevenLabs model supports emotion tags
ipcMain.handle('gpt:isEmotionCapable', (event, modelId) => {
  return isEmotionCapableModel(modelId)
})

async function generateTTS(text, voiceAlias) {
  const apiKey = getElevenLabsApiKey()
  const voices = store.get('voices')
  const defaultAlias = store.get('defaultVoiceAlias')

  // Find voice config by alias
  const voiceConfig = voices.find(v => v.alias === voiceAlias) ||
                      voices.find(v => v.alias === defaultAlias) ||
                      voices[0]

  if (!voiceConfig) {
    throw new Error(`No voice found for alias: ${voiceAlias}`)
  }

  // Build voice settings object
  const voiceSettings = {
    stability: voiceConfig.stability ?? 0.5,
    similarity_boost: voiceConfig.similarityBoost ?? 0.75,
    use_speaker_boost: voiceConfig.useSpeakerBoost ?? true
  }

  // Only include style if it's set and > 0 (style increases latency)
  // Style only works with eleven_multilingual_v2
  const modelId = voiceConfig.elevenLabsModelId || 'eleven_multilingual_v2'
  if (modelId === 'eleven_multilingual_v2' && voiceConfig.style != null && voiceConfig.style > 0) {
    voiceSettings.style = voiceConfig.style
  }

  // Only include speed if it's different from default (1.0)
  if (voiceConfig.speed != null && voiceConfig.speed !== 1.0) {
    voiceSettings.speed = voiceConfig.speed
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceConfig.elevenLabsVoiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        model_id: modelId,
        voice_settings: voiceSettings
      })
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`ElevenLabs TTS error: ${response.status} - ${error}`)
  }

  // Capture history-item-id from response headers (for replay feature)
  const historyItemId = response.headers.get('history-item-id') || null

  // Return audio as base64 and history item ID
  const buffer = await response.arrayBuffer()
  const audioBase64 = Buffer.from(buffer).toString('base64')
  return { audioBase64, historyItemId }
}

// ============ WEBSOCKET SERVER (Receive TTS requests) ============
function startWebSocketServer() {
  const port = store.get('wsServerPort')

  if (wsServer) {
    wsServer.close()
  }

  wsServer = new WebSocketServer({ port })

  wsServer.on('listening', () => {
    console.log(`WebSocket server listening on port ${port}`)
    sendToRenderer('ws-server:status', { connected: true, port })
  })

  wsServer.on('connection', (ws) => {
    console.log('Client connected to TTS server')

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString())

        if (message.type === 'TTS') {
          const id = uuidv4()
          const queueItem = {
            id,
            text: message.text,
            alias: message.alias || store.get('defaultVoiceAlias'),
            username: message.username || null, // Optional: who requested the TTS
            redemptionId: message.redemptionId || null, // For channel points refund
            rewardId: message.rewardId || null, // For channel points refund
            status: 'queued',
            timestamp: Date.now()
          }

          ttsQueue.push(queueItem)
          sendToRenderer('queue:update', getQueueState())

          // Send acknowledgment
          ws.send(JSON.stringify({
            type: 'TTS_QUEUED',
            id,
            position: ttsQueue.length,
            status: 'queued'
          }))

          // Process queue if not already processing
          if (!isProcessing) {
            processQueue()
          }
        }
      } catch (error) {
        console.error('Error processing message:', error)
        ws.send(JSON.stringify({ type: 'ERROR', message: error.message }))
      }
    })

    ws.on('close', () => {
      console.log('Client disconnected from TTS server')
    })
  })

  wsServer.on('error', (error) => {
    console.error('WebSocket server error:', error)
    sendToRenderer('ws-server:status', { connected: false, error: error.message })
  })
}

function restartWebSocketServer() {
  if (wsServer) {
    wsServer.close(() => {
      startWebSocketServer()
    })
  } else {
    startWebSocketServer()
  }
}

// ============ STREAMERBOT CLIENT (Send SHOW/HIDE) ============
function connectToStreamerbot() {
  const host = store.get('streamerbotHost')
  const port = store.get('streamerbotPort')

  if (streamerbotWs) {
    streamerbotWs.close()
  }

  const url = `ws://${host}:${port}/`
  streamerbotWs = new WebSocket(url)

  streamerbotWs.on('open', () => {
    console.log('Connected to Streamerbot')
    sendToRenderer('streamerbot:status', { connected: true })
  })

  streamerbotWs.on('close', () => {
    console.log('Disconnected from Streamerbot')
    sendToRenderer('streamerbot:status', { connected: false })
    scheduleStreamerbotReconnect()
  })

  streamerbotWs.on('error', (error) => {
    console.error('Streamerbot connection error:', error.message)
    sendToRenderer('streamerbot:status', { connected: false, error: error.message })
  })
}

function scheduleStreamerbotReconnect() {
  if (streamerbotReconnectTimeout) {
    clearTimeout(streamerbotReconnectTimeout)
  }
  streamerbotReconnectTimeout = setTimeout(() => {
    console.log('Attempting to reconnect to Streamerbot...')
    connectToStreamerbot()
  }, 5000)
}

function reconnectToStreamerbot() {
  if (streamerbotReconnectTimeout) {
    clearTimeout(streamerbotReconnectTimeout)
  }
  connectToStreamerbot()
}

let requestIdCounter = 0

function sendShowAction(text) {
  const showActionId = store.get('showActionId')
  if (!showActionId || !streamerbotWs || streamerbotWs.readyState !== WebSocket.OPEN) {
    console.log('Cannot send SHOW - not connected or no action ID')
    return
  }

  const message = {
    request: 'DoAction',
    id: `show-${++requestIdCounter}`,
    action: { id: showActionId },
    args: { rawInput: text }
  }

  streamerbotWs.send(JSON.stringify(message))
  console.log('Sent SHOW action:', text)
}

function sendHideAction() {
  const hideActionId = store.get('hideActionId')
  if (!hideActionId || !streamerbotWs || streamerbotWs.readyState !== WebSocket.OPEN) {
    console.log('Cannot send HIDE - not connected or no action ID')
    return
  }

  const message = {
    request: 'DoAction',
    id: `hide-${++requestIdCounter}`,
    action: { id: hideActionId }
  }

  streamerbotWs.send(JSON.stringify(message))
  console.log('Sent HIDE action')
}

function sendRefundAction(item, reason) {
  const refundActionId = store.get('refundActionId')
  if (!refundActionId || !streamerbotWs || streamerbotWs.readyState !== WebSocket.OPEN) {
    return false
  }

  if (!item.redemptionId || !item.rewardId) {
    console.log('Cannot refund - no redemptionId/rewardId on queue item')
    return false
  }

  const message = {
    request: 'DoAction',
    id: `refund-${++requestIdCounter}`,
    action: { id: refundActionId },
    args: {
      redemptionId: item.redemptionId,
      rewardId: item.rewardId,
      username: item.username || '',
      reason: reason || 'TTS request failed'
    }
  }

  streamerbotWs.send(JSON.stringify(message))
  console.log(`Sent REFUND action for user "${item.username}" - reason: ${reason}`)
  return true
}

// ============ QUEUE PROCESSING ============
async function processQueue() {
  if (isProcessing || ttsQueue.length === 0) {
    return
  }

  if (isPaused) {
    return
  }

  // Find the first queued item (skip lingering items and pending_moderation items)
  const item = ttsQueue.find(i => i.status === 'queued')
  if (!item) {
    return // No queued items to process (only lingering item in queue)
  }

  isProcessing = true
  item.status = 'processing'
  currentTtsId = item.id
  sendToRenderer('queue:update', getQueueState())

  // Handle replay/moderated items - skip all processing, play directly
  if (item.source === 'replay' || item.source === 'moderated') {
    item.status = 'playing'
    sendToRenderer('queue:update', getQueueState())

    // Determine volume
    const voices = store.get('voices') || []
    const voiceConfig = voices.find(v => v.alias === item.alias)
    const effectiveVolume = voiceConfig?.volume != null ? voiceConfig.volume : (store.get('globalVolume') ?? 100)

    // Moderated items always show/hide; replay items only if explicitly requested
    if (item.source === 'moderated' || item.useShowHide) {
      sendShowAction(item.text)
    }

    sendToRenderer('audio:play', { id: item.id, audioBase64: item.audioBase64, volume: effectiveVolume })
    return
  }

  try {
    // Apply text processing / replacements BEFORE generating TTS
    const voices = store.get('voices') || []
    const defaultAlias = store.get('defaultVoiceAlias')
    const voiceConfig = voices.find(v => v.alias === item.alias) ||
                        voices.find(v => v.alias === defaultAlias) ||
                        voices[0]
    const globalReplacements = store.get('globalReplacements') || []
    const globalMaxLength = store.get('maxMessageLength') || { enabled: false }

    // ========== TEXT PROCESSING PIPELINE ==========
    // Order: Sanitization → Replacements → Max Length → GPT
    console.log('\n========== TTS Processing Pipeline ==========')
    console.log(`[1/6] SOURCE (raw input):`)
    console.log(`      "${item.text}"`)

    // Step 1: Sanitize input FIRST (strip HTML, code, user bracket tags)
    const globalSanitization = store.get('sanitization') || {}
    const effectiveSanitization = getEffectiveSanitization(voiceConfig, globalSanitization)
    const { result: sanitizedText, sanitizationApplied } = sanitizeInput(item.text, effectiveSanitization)

    console.log(`[2/6] AFTER SANITIZATION${sanitizationApplied.length > 0 ? ` (${sanitizationApplied.join(', ')})` : ' (no changes)'}:`)
    console.log(`      "${sanitizedText}"`)

    // Step 2: Apply text replacements
    const { processedText, appliedRules } = processText(sanitizedText, voiceConfig, globalReplacements)

    console.log(`[3/6] AFTER REPLACEMENTS${appliedRules.length > 0 ? ` (${appliedRules.length} rule set(s) applied)` : ' (no changes)'}:`)
    console.log(`      "${processedText}"`)

    // Step 3: Apply max length limit BEFORE GPT (so AI can work with final input length)
    // AI output can be longer due to tags/annotations - that's fine and expected
    const effectiveMaxLength = getEffectiveMaxLength(voiceConfig, globalMaxLength)
    const { result: truncatedText, wasTruncated, truncatedBy } = applyMaxLength(processedText, effectiveMaxLength)

    console.log(`[4/6] AFTER MAX LENGTH${wasTruncated ? ` (truncated by ${truncatedBy})` : ' (no truncation)'}:`)
    console.log(`      "${truncatedText}"`)

    // Step 4: GPT Processing (if enabled)
    let gptProcessedText = truncatedText
    let gptResult = null
    let gptBlocked = false
    let gptBlockReason = null

    const globalGptConfig = store.get('gptProcessing') || {}
    const openAIApiKey = getChatGptApiKey()
    const effectiveGptConfig = getEffectiveGPTConfig(voiceConfig, globalGptConfig, openAIApiKey)

    if (effectiveGptConfig.enabled && openAIApiKey) {
      // Determine if this voice uses Eleven v3 Alpha (the only model that supports audio tags)
      const elevenLabsModelId = voiceConfig?.elevenLabsModelId || 'eleven_multilingual_v2'
      const isEmotionCapable = isEmotionCapableModel(elevenLabsModelId)

      const gptConfig = {
        contentModeration: effectiveGptConfig.contentModeration.enabled,
        moderationConfig: effectiveGptConfig.contentModeration,  // Full config for granular rules
        emotionEnhancement: effectiveGptConfig.emotionEnhancement.enabled,
        isEmotionCapable
      }

      // Only call GPT if at least one feature is enabled
      if (gptConfig.contentModeration || gptConfig.emotionEnhancement) {
        const openAIModel = voiceConfig?.openAIModelOverride || store.get('openAIDefaultModel') || 'gpt-5-nano'
        const reasoningEffort = store.get('openAIReasoningEffort') || 'minimal'

        console.log(`[5/6] GPT PROCESSING (PARALLEL mode, model: ${openAIModel}, reasoning: ${reasoningEffort}, moderation: ${gptConfig.contentModeration}, audioTags: ${gptConfig.emotionEnhancement}, v3Model: ${isEmotionCapable})...`)

        gptResult = await processWithGPTParallel(truncatedText, openAIApiKey, openAIModel, gptConfig, reasoningEffort)

        if (gptResult.blocked) {
          // Content was blocked by moderation
          gptBlocked = true
          gptBlockReason = gptResult.blockReason
          console.log(`      BLOCKED: ${gptBlockReason}`)
        } else if (gptResult.success) {
          gptProcessedText = gptResult.text
          const tagsInfo = gptResult.tagsAdded.length > 0 ? ` (tags added: ${gptResult.tagsAdded.join(', ')})` : ''
          console.log(`      "${gptProcessedText}"${tagsInfo}`)
        } else {
          // GPT failed - check failure behavior
          console.error(`      GPT ERROR: ${gptResult.error}`)
          item.gptError = gptResult.error

          if (effectiveGptConfig.contentModeration.enabled &&
              effectiveGptConfig.contentModeration.onFailure === 'block') {
            // Fail-closed: Block message if moderation was enabled and GPT failed
            gptBlocked = true
            gptBlockReason = `Content moderation unavailable: ${gptResult.error}`
            console.log(`      BLOCKED (fail-closed mode): ${gptBlockReason}`)
          } else {
            console.log(`      Continuing with unmodified text (fail-open mode)`)
          }
        }
      } else {
        console.log(`[5/6] GPT PROCESSING (skipped - no features enabled):`)
        console.log(`      "${gptProcessedText}"`)
      }
    } else {
      const reason = !effectiveGptConfig.enabled ? 'disabled' : 'no API key'
      console.log(`[5/6] GPT PROCESSING (skipped - ${reason}):`)
      console.log(`      "${gptProcessedText}"`)
    }

    // If content was blocked, skip TTS generation
    if (gptBlocked) {
      console.log(`[6/6] FINAL: BLOCKED - not sending to ElevenLabs`)
      console.log('=============================================')
      console.log(`>>> MESSAGE BLOCKED: ${gptBlockReason}`)
      console.log('=============================================\n')

      item.blockReason = gptBlockReason
      item.originalText = item.text
      item.afterReplacements = processedText
      item.afterSanitization = sanitizedText
      item.afterTruncation = truncatedText
      item.afterGPT = null
      item.processedText = null
      item.sanitizationApplied = sanitizationApplied
      item.gptUsed = true
      item.gptTiming = gptResult?.timing || null
      item.gptModel = gptResult?.model || null
      item.gptTagsAdded = []
      item.wasTruncated = wasTruncated
      item.truncatedBy = truncatedBy
      // Store pre-GPT text for potential "Allow" action
      item.preGptText = truncatedText

      const manualModeration = store.get('manualModerationEnabled')
      if (manualModeration) {
        // Manual moderation: keep in queue for streamer review
        item.status = 'pending_moderation'
        console.log(`Item held for manual moderation (user: ${item.username || 'unknown'})`)
        sendToRenderer('queue:update', getQueueState())
        isProcessing = false
        processQueue()
        return
      }

      // Auto mode: refund and remove
      item.status = 'blocked'
      const refunded = sendRefundAction(item, `Content blocked: ${gptBlockReason}`)
      item.refunded = refunded

      // Log to history as blocked
      const historyEntry = createHistoryEntry(item, 'blocked', null, gptBlockReason)
      addToHistory(historyEntry)

      sendToRenderer('queue:update', getQueueState())

      // Remove blocked item and continue with queue
      const blockedIndex = ttsQueue.findIndex(i => i.id === item.id)
      if (blockedIndex !== -1) {
        ttsQueue.splice(blockedIndex, 1)
      }
      isProcessing = false
      processQueue()
      return
    }

    // Step 5: Final output (GPT output is sent as-is, AI output can be longer due to tags)
    const finalText = gptProcessedText

    console.log(`[6/6] FINAL (sent to ElevenLabs):`)
    console.log(`      "${finalText}"`)
    console.log('=============================================')
    console.log(`>>> SENDING TO ELEVENLABS (voice: ${item.alias}):`)
    console.log(`    "${finalText}"`)
    console.log('=============================================\n')

    // Store processing info
    item.originalText = item.text
    item.afterReplacements = processedText
    item.afterSanitization = sanitizedText
    item.afterTruncation = truncatedText  // Text after max length limit, before GPT
    item.afterGPT = gptProcessedText
    item.processedText = finalText
    item.sanitizationApplied = sanitizationApplied
    item.gptUsed = gptResult !== null && gptResult.success
    item.gptTagsAdded = gptResult?.tagsAdded || []
    item.gptTiming = gptResult?.timing || null  // GPT processing time and token usage
    item.gptModel = gptResult?.model || null
    item.wasTruncated = wasTruncated
    item.truncatedBy = truncatedBy
    item.charactersUsed = finalText.length  // Characters sent to ElevenLabs

    // Generate TTS audio
    const { audioBase64, historyItemId } = await generateTTS(finalText, item.alias)

    item.status = 'ready'
    item.audioBase64 = audioBase64
    item.historyItemId = historyItemId
    sendToRenderer('queue:update', getQueueState())

    // NOW that audio is ready, check if we need to interrupt lingering
    if (lingerTimeoutId) {
      console.log('Audio ready - interrupting linger, sending HIDE')
      clearTimeout(lingerTimeoutId)
      lingerTimeoutId = null

      // Remove the lingering item from queue
      const lingeringIndex = ttsQueue.findIndex(i => i.status === 'lingering')
      if (lingeringIndex !== -1) {
        ttsQueue.splice(lingeringIndex, 1)
        sendToRenderer('queue:update', getQueueState())
      }

      // Send HIDE and wait for animation to complete
      sendHideAction()
      const animationDuration = store.get('animationDurationMs')
      await new Promise(resolve => setTimeout(resolve, animationDuration))
    }

    // Now show and play
    item.status = 'playing'
    sendToRenderer('queue:update', getQueueState())

    // Send SHOW action
    sendShowAction(item.text)

    // Determine effective volume (per-voice override or global)
    const effectiveVolume = voiceConfig?.volume != null ? voiceConfig.volume : (store.get('globalVolume') ?? 100)

    // Tell renderer to play audio and wait for completion
    sendToRenderer('audio:play', { id: item.id, audioBase64, volume: effectiveVolume })

  } catch (error) {
    console.error('TTS generation error:', error)
    item.status = 'error'
    item.error = error.message

    // Attempt channel points refund
    const refunded = sendRefundAction(item, `TTS error: ${error.message}`)
    item.refunded = refunded

    sendToRenderer('queue:update', getQueueState())

    // Log to history as error
    const historyEntry = createHistoryEntry(item, 'error', null, error.message)
    addToHistory(historyEntry)

    // Remove failed item and continue
    const failedIndex = ttsQueue.findIndex(i => i.id === item.id)
    if (failedIndex !== -1) {
      ttsQueue.splice(failedIndex, 1)
    }
    isProcessing = false
    processQueue()
  }
}

// Called when audio finishes playing in renderer
ipcMain.handle('audio:finished', async (event, { id, duration }) => {
  console.log(`Audio finished: ${id}, duration: ${duration}ms`)

  const minimumLinger = store.get('minimumLingerMs')

  // Find the completed item
  const index = ttsQueue.findIndex(item => item.id === id)
  const item = index !== -1 ? ttsQueue[index] : null

  // This item is done processing
  isProcessing = false
  currentTtsId = null

  if (item) {
    // Replay items: no history logging (already have a history entry from original play)
    // Moderated items: log to history as completed
    if (item.source === 'replay' || item.source === 'moderated') {
      if (item.source === 'moderated') {
        const historyEntry = createHistoryEntry(item, 'completed', duration)
        addToHistory(historyEntry)
      }

      if (item.source === 'moderated' || item.useShowHide) {
        // Linger and hide like normal items
        item.status = 'lingering'
        sendToRenderer('queue:update', getQueueState())

        const minimumLingerReplay = store.get('minimumLingerMs')
        lingerTimeoutId = setTimeout(() => {
          sendHideAction()
          lingerTimeoutId = null
          const idx = ttsQueue.findIndex(i => i.id === id)
          if (idx !== -1) {
            ttsQueue.splice(idx, 1)
          }
          sendToRenderer('queue:update', getQueueState())
        }, minimumLingerReplay)
      } else {
        // Just remove immediately (replay without overlay)
        ttsQueue.splice(index, 1)
        sendToRenderer('queue:update', getQueueState())
      }
      processQueue()
      return true
    }

    // Log to history as completed
    const historyEntry = createHistoryEntry(item, 'completed', duration)
    addToHistory(historyEntry)

    // Always set to lingering - overlay stays visible
    item.status = 'lingering'
    sendToRenderer('queue:update', getQueueState())

    console.log(`Audio finished, lingering for up to ${minimumLinger}ms`)

    // Start linger timeout - will be cancelled if next item becomes ready sooner
    lingerTimeoutId = setTimeout(() => {
      console.log('Linger timeout finished, hiding overlay')
      sendHideAction()
      lingerTimeoutId = null

      // Remove the lingering item from queue
      const idx = ttsQueue.findIndex(i => i.id === id)
      if (idx !== -1) {
        ttsQueue.splice(idx, 1)
      }
      sendToRenderer('queue:update', getQueueState())
    }, minimumLinger)
  }

  // Check if there are queued items waiting to be processed
  const hasQueuedItems = ttsQueue.some(i => i.status === 'queued')
  if (hasQueuedItems) {
    // Start processing next item while current one lingers
    // The linger will be interrupted when next item becomes "ready"
    processQueue()
  }

  return true
})

function getQueueState() {
  return {
    items: ttsQueue.map(item => ({
      id: item.id,
      text: item.text,
      alias: item.alias,
      status: item.status,
      error: item.error,
      username: item.username || null,
      blockReason: item.blockReason || null,
      source: item.source || null
    })),
    isProcessing,
    isPaused,
    currentId: currentTtsId,
    isLingering: lingerTimeoutId !== null
  }
}

ipcMain.handle('queue:get', () => {
  return getQueueState()
})

ipcMain.handle('queue:clear', () => {
  ttsQueue.length = 0
  sendToRenderer('queue:update', getQueueState())
  return true
})

ipcMain.handle('queue:pause', () => {
  isPaused = true
  console.log('Queue PAUSED')
  sendToRenderer('queue:update', getQueueState())
  return true
})

ipcMain.handle('queue:resume', () => {
  isPaused = false
  console.log('Queue RESUMED')
  sendToRenderer('queue:update', getQueueState())
  processQueue()
  return true
})

ipcMain.handle('queue:moderate', async (event, { id, action, position }) => {
  const index = ttsQueue.findIndex(i => i.id === id)
  if (index === -1) {
    return { success: false, error: 'Item not found in queue' }
  }

  const item = ttsQueue[index]
  if (item.status !== 'pending_moderation') {
    return { success: false, error: 'Item is not pending moderation' }
  }

  if (action === 'refund') {
    // Refund and remove
    const refunded = sendRefundAction(item, 'Manually refunded by streamer')
    item.refunded = refunded
    item.status = 'blocked'

    // Log to history
    const historyEntry = createHistoryEntry(item, 'blocked', null, item.blockReason)
    addToHistory(historyEntry)

    ttsQueue.splice(index, 1)
    sendToRenderer('queue:update', getQueueState())
    console.log(`Moderation: REFUNDED item from ${item.username || 'unknown'}`)
    return { success: true, refunded }
  }

  if (action === 'allow') {
    try {
      // Generate TTS from pre-GPT text (bypasses moderation)
      const textToSpeak = item.preGptText || item.afterReplacements || item.text
      console.log(`Moderation: ALLOWING item from ${item.username || 'unknown'}: "${textToSpeak}"`)

      const { audioBase64, historyItemId } = await generateTTS(textToSpeak, item.alias)

      // Update item to be a moderated playback item
      item.source = 'moderated'
      item.moderationOverride = true
      item.status = 'queued'
      item.audioBase64 = audioBase64
      item.historyItemId = historyItemId
      item.processedText = textToSpeak
      item.charactersUsed = textToSpeak.length

      // Move to requested position
      ttsQueue.splice(index, 1) // Remove from current position
      if (position === 'front') {
        const insertIndex = ttsQueue.findIndex(i => i.status === 'queued')
        if (insertIndex !== -1) {
          ttsQueue.splice(insertIndex, 0, item)
        } else {
          ttsQueue.push(item)
        }
      } else {
        ttsQueue.push(item)
      }

      sendToRenderer('queue:update', getQueueState())

      // Start processing if not paused
      if (!isPaused && !isProcessing) {
        processQueue()
      }

      return { success: true }
    } catch (error) {
      console.error('Moderation allow error:', error)
      return { success: false, error: error.message }
    }
  }

  return { success: false, error: 'Unknown action' }
})

ipcMain.handle('queue:cancel', (event, id) => {
  const index = ttsQueue.findIndex(i => i.id === id)
  if (index === -1) {
    return { success: false, error: 'Item not found in queue' }
  }

  const item = ttsQueue[index]
  if (item.status !== 'queued' && item.status !== 'pending_moderation') {
    return { success: false, error: 'Can only cancel queued or pending items' }
  }

  // Attempt channel points refund
  const refunded = sendRefundAction(item, 'Cancelled by streamer')
  item.refunded = refunded

  // Log to history as cancelled
  const historyEntry = createHistoryEntry(item, 'cancelled', null, 'Cancelled by streamer')
  addToHistory(historyEntry)

  // Remove from queue
  ttsQueue.splice(index, 1)
  sendToRenderer('queue:update', getQueueState())
  console.log(`Queue item cancelled: ${item.id} (user: ${item.username || 'unknown'})`)
  return { success: true, refunded }
})

// ============ CONNECTION CONTROL IPC ============
ipcMain.handle('ws-server:getStatus', () => {
  return {
    connected: wsServer !== null && wsServer.address() !== null,
    port: store.get('wsServerPort')
  }
})

ipcMain.handle('ws-server:restart', () => {
  restartWebSocketServer()
  return true
})

ipcMain.handle('streamerbot:getStatus', () => {
  return {
    connected: streamerbotWs !== null && streamerbotWs.readyState === WebSocket.OPEN
  }
})

ipcMain.handle('streamerbot:reconnect', () => {
  reconnectToStreamerbot()
  return true
})

// ============ HISTORY IPC ============
ipcMain.handle('history:get', () => {
  return ttsHistory
})

ipcMain.handle('history:clear', () => {
  clearHistory()
  return true
})

ipcMain.handle('history:getLogDirectory', () => {
  return getLogDirectory()
})

ipcMain.handle('history:browseLogDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Log Directory'
  })

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})

ipcMain.handle('history:openLogDirectory', () => {
  const logDir = getLogDirectory()
  ensureLogDirectory()
  shell.openPath(logDir)
  return true
})

ipcMain.handle('app:getVersion', () => {
  return app.getVersion()
})

ipcMain.handle('shell:openExternal', (event, url) => {
  // Only allow http/https URLs for security
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url)
  }
})

ipcMain.handle('history:refund', (event, id) => {
  const entry = ttsHistory.find(e => e.id === id)
  if (!entry) {
    return { success: false, error: 'History entry not found' }
  }
  if (entry.refunded) {
    return { success: false, error: 'Already refunded' }
  }
  if (!entry.redemptionId || !entry.rewardId) {
    return { success: false, error: 'No redemption data available' }
  }

  const refunded = sendRefundAction(entry, 'Manual refund by streamer')
  if (refunded) {
    entry.refunded = true
    sendToRenderer('history:update', ttsHistory)
  }
  return { success: refunded }
})

ipcMain.handle('history:replay', async (event, { id, position, useShowHide }) => {
  const entry = ttsHistory.find(e => e.id === id)
  if (!entry) {
    return { success: false, error: 'History entry not found' }
  }
  if (!entry.historyItemId) {
    return { success: false, error: 'No ElevenLabs history ID available' }
  }

  const apiKey = getElevenLabsApiKey()
  if (!apiKey) {
    return { success: false, error: 'ElevenLabs API key not configured' }
  }

  try {
    // Download audio from ElevenLabs history
    const response = await fetch(
      `https://api.elevenlabs.io/v1/history/${entry.historyItemId}/audio`,
      {
        headers: {
          'xi-api-key': apiKey
        }
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`ElevenLabs history API error: ${response.status} - ${errorText}`)
    }

    const buffer = await response.arrayBuffer()
    const audioBase64 = Buffer.from(buffer).toString('base64')

    // Create replay queue item
    const replayItem = {
      id: uuidv4(),
      text: entry.text || entry.finalText || '(replay)',
      alias: entry.voiceAlias || 'unknown',
      username: entry.username || null,
      source: 'replay',
      useShowHide: useShowHide || false,
      status: 'queued',
      audioBase64,
      timestamp: Date.now()
    }

    // Insert at position
    if (position === 'front') {
      // Find first queued item (after any currently playing/processing)
      const insertIndex = ttsQueue.findIndex(i => i.status === 'queued')
      if (insertIndex !== -1) {
        ttsQueue.splice(insertIndex, 0, replayItem)
      } else {
        ttsQueue.push(replayItem)
      }
    } else {
      ttsQueue.push(replayItem)
    }

    sendToRenderer('queue:update', getQueueState())
    console.log(`Replay queued: ${entry.historyItemId} (position: ${position})`)

    // Start processing if not paused
    if (!isPaused && !isProcessing) {
      processQueue()
    }

    return { success: true }
  } catch (error) {
    console.error('Replay error:', error)
    return { success: false, error: error.message }
  }
})

// ============ TEXT PROCESSING IPC ============
ipcMain.handle('textProcessing:test', (event, { text, voiceAlias }) => {
  // Test text processing with optional voice alias
  const voices = store.get('voices') || []
  const defaultAlias = store.get('defaultVoiceAlias')
  const globalReplacements = store.get('globalReplacements') || []
  const globalSanitization = store.get('sanitization') || {}
  const globalMaxLength = store.get('maxMessageLength') || {
    characters: { enabled: false, value: 500 },
    words: { enabled: false, value: 50 }
  }

  let voiceConfig = null
  if (voiceAlias) {
    voiceConfig = voices.find(v => v.alias === voiceAlias)
  } else if (defaultAlias) {
    voiceConfig = voices.find(v => v.alias === defaultAlias)
  }

  // Step 1: Sanitize input (runs FIRST)
  const effectiveSanitization = getEffectiveSanitization(voiceConfig, globalSanitization)
  const { result: sanitizedText, sanitizationApplied } = sanitizeInput(text, effectiveSanitization)

  // Step 2: Apply replacements
  const { processedText, appliedRules } = processText(sanitizedText, voiceConfig, globalReplacements)

  // Step 3: Apply max length
  const effectiveMaxLength = getEffectiveMaxLength(voiceConfig, globalMaxLength)
  const { result: finalText, wasTruncated, truncatedBy, charCount, wordCount } = applyMaxLength(processedText, effectiveMaxLength)

  return {
    originalText: text,
    afterSanitization: sanitizedText,
    afterReplacements: processedText,
    processedText: finalText,
    sanitizationApplied,
    appliedRules,
    voiceUsed: voiceConfig?.alias || null,
    wasModified: text !== finalText,
    wasTruncated,
    truncatedBy,
    charCount,
    wordCount
  }
})

ipcMain.handle('textProcessing:testRule', (event, { text, rule }) => {
  // Test a single replacement rule
  return testSingleRule(text, rule)
})

ipcMain.handle('textProcessing:validatePattern', (event, pattern) => {
  // Validate a regex pattern
  return validateRegexPattern(pattern)
})

// ============ HELPER FUNCTIONS ============
function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

// ============ APP LIFECYCLE ============
app.isQuitting = false

app.on('before-quit', () => {
  app.isQuitting = true
})

app.on('second-instance', () => {
  // Someone tried to open a second copy — focus the existing window
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.whenReady().then(() => {
  createWindow()
  loadHistoryFromLogs()
  if (store.get('minimizeToTray')) createTray()
  initAutoUpdater(mainWindow)
  startWebSocketServer()
  connectToStreamerbot()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  destroyTray()
  if (wsServer) {
    wsServer.close()
  }
  if (streamerbotWs) {
    streamerbotWs.close()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
