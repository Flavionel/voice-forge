<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated class="bg-dark">
      <q-toolbar>
        <q-toolbar-title class="app-title">
          <span>VoiceForge</span>
          <div class="app-subtitle">by <a class="app-author-link" @click.prevent="openExternal('https://www.twitch.tv/flavionel')">Flavionel</a></div>
        </q-toolbar-title>
        <q-btn
          v-if="updateStatus.ready"
          dense
          no-caps
          color="positive"
          icon="system_update"
          :label="`Update ${updateStatus.version}`"
          class="q-mr-md update-btn"
          @click="installUpdate"
        />
        <StatusIndicators
          :ws-server-status="wsServerStatus"
          :streamerbot-status="streamerbotStatus"
        />
      </q-toolbar>
    </q-header>

    <q-page-container>
      <q-page padding>
        <q-tabs
          v-model="activeTab"
          dense
          class="text-grey"
          active-color="primary"
          indicator-color="primary"
          align="left"
          narrow-indicator
        >
          <q-tab name="queue" label="Queue" icon="queue_music" />
          <q-tab name="history" label="History" icon="history" />
          <q-tab name="api-keys" label="API Keys" icon="vpn_key" />
          <q-tab name="connections" label="Connections" icon="settings_ethernet" />
          <q-tab name="voices" label="Voices" icon="record_voice_over" />
          <q-tab name="text-processing" label="Text Processing" icon="find_replace" />
          <q-tab name="ai-processing" label="AI Processing" icon="psychology" />
          <q-tab name="general" label="General" icon="tune" />
          <q-tab name="about" label="About" icon="info" />
        </q-tabs>

        <q-separator />

        <q-tab-panels v-model="activeTab" animated class="bg-transparent">
          <q-tab-panel name="queue">
            <QueueDisplay
              :queue="queue"
              :settings="settings"
              @clear="clearQueue"
              @pause="pauseQueue"
              @resume="resumeQueue"
              @cancel="cancelQueueItem"
              @moderate="moderateQueueItem"
              @update-setting="updateSetting"
            />
          </q-tab-panel>

          <q-tab-panel name="history">
            <HistoryDisplay
              :history="history"
              :settings="settings"
              :limit="settings.historyInAppLimit || 100"
              @clear="clearHistory"
            />
          </q-tab-panel>

          <q-tab-panel name="api-keys">
            <ApiKeysSettings
              :settings="settings"
              @update="updateSetting"
            />
          </q-tab-panel>

          <q-tab-panel name="connections">
            <ConnectionsSettings
              :settings="settings"
              @update="updateSetting"
            />
          </q-tab-panel>

          <q-tab-panel name="voices">
            <VoicesSettings
              :settings="settings"
              @update="updateSetting"
            />
          </q-tab-panel>

          <q-tab-panel name="text-processing">
            <TextProcessingSettings
              :settings="settings"
              @update="updateSetting"
            />
          </q-tab-panel>

          <q-tab-panel name="ai-processing">
            <AIProcessingSettings
              :settings="settings"
              @update="updateSetting"
            />
          </q-tab-panel>

          <q-tab-panel name="general">
            <GeneralSettings
              :settings="settings"
              @update="updateSetting"
            />
          </q-tab-panel>

          <q-tab-panel name="about">
            <AboutTab />
          </q-tab-panel>
        </q-tab-panels>
      </q-page>
    </q-page-container>
  </q-layout>

  <!-- Hidden audio player -->
  <audio ref="audioPlayer" @ended="onAudioEnded" @loadedmetadata="onAudioLoaded"></audio>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useQuasar } from 'quasar'
import StatusIndicators from './components/StatusIndicators.vue'
import QueueDisplay from './components/QueueDisplay.vue'
import HistoryDisplay from './components/HistoryDisplay.vue'
import ApiKeysSettings from './components/Settings/ApiKeysSettings.vue'
import ConnectionsSettings from './components/Settings/ConnectionsSettings.vue'
import VoicesSettings from './components/Settings/VoicesSettings.vue'
import TextProcessingSettings from './components/Settings/TextProcessingSettings.vue'
import AIProcessingSettings from './components/Settings/AIProcessingSettings.vue'
import GeneralSettings from './components/Settings/GeneralSettings.vue'
import AboutTab from './components/AboutTab.vue'

const $q = useQuasar()

const activeTab = ref('queue')
const settings = ref({})
const queue = ref({ items: [], isProcessing: false, currentId: null })
const history = ref([])
const wsServerStatus = ref({ connected: false })
const streamerbotStatus = ref({ connected: false })
const updateStatus = ref({ ready: false, version: '' })
const audioPlayer = ref(null)

let currentAudioId = null
let audioStartTime = 0

// Web Audio API for volume control (allows > 100%)
let audioContext = null
let gainNode = null

// Cleanup functions for event listeners
const cleanupFns = []

onMounted(async () => {
  // Load settings
  settings.value = await window.electronAPI.getSettings()

  // Load initial queue state
  queue.value = await window.electronAPI.getQueue()

  // Load initial history
  history.value = await window.electronAPI.getHistory()

  // Load initial connection statuses
  try {
    wsServerStatus.value = await window.electronAPI.getWsServerStatus()
    streamerbotStatus.value = await window.electronAPI.getStreamerbotStatus()
  } catch (error) {
    console.error('Failed to get initial statuses:', error)
  }

  // Set up Web Audio API for volume control (GainNode allows > 100%)
  audioContext = new (window.AudioContext || window.webkitAudioContext)()
  const source = audioContext.createMediaElementSource(audioPlayer.value)
  gainNode = audioContext.createGain()
  source.connect(gainNode)
  gainNode.connect(audioContext.destination)

  // Set up event listeners
  cleanupFns.push(
    window.electronAPI.onQueueUpdate((data) => {
      queue.value = data
    })
  )

  cleanupFns.push(
    window.electronAPI.onAudioPlay(({ id, audioBase64, volume }) => {
      playAudio(id, audioBase64, volume)
    })
  )

  cleanupFns.push(
    window.electronAPI.onWsServerStatus((data) => {
      wsServerStatus.value = data
      if (data.connected) {
        $q.notify({
          type: 'positive',
          message: `WebSocket server listening on port ${data.port}`
        })
      } else if (data.error) {
        $q.notify({
          type: 'negative',
          message: `WebSocket server error: ${data.error}`
        })
      }
    })
  )

  cleanupFns.push(
    window.electronAPI.onStreamerbotStatus((data) => {
      streamerbotStatus.value = data
    })
  )

  cleanupFns.push(
    window.electronAPI.onHistoryUpdate((data) => {
      history.value = data
    })
  )

  cleanupFns.push(
    window.electronAPI.onUpdateStatus((data) => {
      if (data.status === 'downloaded') {
        updateStatus.value = { ready: true, version: data.version }
      }
    })
  )
})

onUnmounted(() => {
  cleanupFns.forEach(fn => fn())
})

async function updateSetting(key, value) {
  await window.electronAPI.setSetting(key, value)
  // Create a new object to ensure Vue detects the change
  settings.value = { ...settings.value, [key]: value }
  console.log('updateSetting:', key, 'new voices count:', settings.value.voices?.length)
}

async function clearQueue() {
  await window.electronAPI.clearQueue()
}

async function pauseQueue() {
  await window.electronAPI.pauseQueue()
}

async function resumeQueue() {
  await window.electronAPI.resumeQueue()
}

async function cancelQueueItem(id) {
  await window.electronAPI.cancelQueueItem(id)
}

async function moderateQueueItem(id, action, position) {
  await window.electronAPI.moderateQueueItem(id, action, position)
}

async function clearHistory() {
  await window.electronAPI.clearHistory()
}

function openExternal(url) {
  window.electronAPI.openExternal(url)
}

function installUpdate() {
  window.electronAPI.installUpdate()
}

function playAudio(id, audioBase64, volume = 100) {
  currentAudioId = id
  const audio = audioPlayer.value

  // Apply volume via Web Audio API GainNode (allows > 100%)
  if (gainNode) {
    gainNode.gain.value = volume / 100
  }

  // Resume AudioContext if suspended (browsers require user gesture)
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume()
  }

  // Create blob URL from base64
  const byteCharacters = atob(audioBase64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  const blob = new Blob([byteArray], { type: 'audio/mpeg' })
  const url = URL.createObjectURL(blob)

  // Helper to start playback
  const startPlayback = () => {
    audioStartTime = Date.now()
    audio.play().catch(error => {
      console.error('Audio playback error:', error)
      onAudioEnded() // Treat as finished
    })
  }

  audio.src = url

  // Wait for audio to be ready before playing to prevent first-second cutoff
  // Check if already ready (blob URLs can load instantly)
  if (audio.readyState >= 3) { // HAVE_FUTURE_DATA or HAVE_ENOUGH_DATA
    startPlayback()
  } else {
    // Wait for enough data to be buffered
    audio.oncanplaythrough = () => {
      audio.oncanplaythrough = null // Cleanup
      startPlayback()
    }
  }
}

function onAudioLoaded() {
  console.log('Audio loaded, duration:', audioPlayer.value.duration)
}

function onAudioEnded() {
  if (currentAudioId) {
    const duration = Date.now() - audioStartTime
    window.electronAPI.audioFinished(currentAudioId, duration)
    currentAudioId = null

    // Revoke the blob URL
    if (audioPlayer.value.src) {
      URL.revokeObjectURL(audioPlayer.value.src)
    }
  }
}
</script>

<style scoped>
.q-tab-panels {
  min-height: 400px;
}

.app-title {
  font-family: 'Rajdhani', sans-serif;
  font-weight: 600;
  font-size: 1.4rem;
  letter-spacing: 1px;
  line-height: 1.1;
}

.app-subtitle {
  font-family: sans-serif;
  font-size: 0.6rem;
  font-weight: 400;
  letter-spacing: 0;
  color: #9e9e9e;
  margin-top: 1px;
}

.app-author-link {
  color: #42a5f5;
  cursor: pointer;
  text-decoration: none;
}

.app-author-link:hover {
  text-decoration: underline;
}

.update-btn {
  animation: gentle-pulse 2s ease-in-out infinite;
}

@keyframes gentle-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
</style>
