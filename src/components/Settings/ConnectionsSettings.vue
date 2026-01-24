<template>
  <div>
    <div class="text-h6 q-mb-md">Connection Settings</div>

    <div class="text-caption text-grey-6 q-mb-md">
      VoiceForge connects to Streamerbot in two ways: it receives TTS requests via a WebSocket server,
      and can optionally send commands back to Streamerbot to control an OBS text overlay.
    </div>

    <!-- WebSocket Server -->
    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="row items-center justify-between q-mb-sm">
          <div class="text-subtitle1">WebSocket Server (TTS Requests)</div>
          <q-chip
            :color="wsServerConnected ? 'positive' : 'negative'"
            text-color="white"
            size="sm"
          >
            {{ wsServerConnected ? 'Running' : 'Stopped' }}
          </q-chip>
        </div>
        <div class="text-caption text-grey-6 q-mb-md">
          Streamerbot sends TTS requests to this port. Make sure this matches your Streamerbot action.
        </div>
        <div class="row items-center q-gutter-md">
          <q-input
            v-model.number="wsServerPort"
            type="number"
            outlined
            dense
            label="Port"
            style="max-width: 150px"
          />
          <q-btn
            :loading="restartingWsServer"
            color="primary"
            icon="refresh"
            label="Apply & Restart"
            @click="restartWsServer"
          />
        </div>
      </q-card-section>
    </q-card>

    <!-- Streamerbot Connection -->
    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="row items-center justify-between q-mb-sm">
          <div class="text-subtitle1">Streamerbot Connection</div>
          <q-chip
            :color="streamerbotConnected ? 'positive' : 'negative'"
            text-color="white"
            size="sm"
          >
            {{ streamerbotConnected ? 'Connected' : 'Disconnected' }}
          </q-chip>
        </div>
        <div class="text-caption text-grey-6 q-mb-md">
          Optional: Connect back to Streamerbot to trigger SHOW/HIDE actions for OBS text overlay.
          Leave disconnected if you're not using an overlay.
        </div>
        <div class="row items-center q-gutter-md">
          <q-input
            v-model="streamerbotHost"
            outlined
            dense
            label="Host"
            style="max-width: 180px"
          />
          <q-input
            v-model.number="streamerbotPort"
            type="number"
            outlined
            dense
            label="Port"
            style="max-width: 120px"
          />
          <q-btn
            :loading="reconnectingStreamerbot"
            color="primary"
            icon="link"
            label="Apply & Connect"
            @click="reconnectStreamerbot"
          />
        </div>
      </q-card-section>
    </q-card>

    <!-- Streamerbot Action IDs -->
    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle1 q-mb-sm">OBS Overlay Actions (Optional)</div>
        <div class="text-caption text-grey-6 q-mb-md">
          If using an OBS text overlay, enter the action IDs for showing/hiding it.
          Find these in Streamerbot: Actions > Right-click action > Copy Action Id
        </div>
        <div class="column q-gutter-md">
          <q-input
            v-model="showActionId"
            outlined
            dense
            label="SHOW Action ID"
            placeholder="e.g., a49a9d8c-f769-4975-b7b1-ef15270dd50a"
            @blur="saveShowActionId"
          />
          <q-input
            v-model="hideActionId"
            outlined
            dense
            label="HIDE Action ID"
            placeholder="e.g., 13e04d95-095b-42ce-b9be-0149548a2515"
            @blur="saveHideActionId"
          />
        </div>
      </q-card-section>
    </q-card>

    <!-- Channel Points Refund -->
    <q-card flat bordered>
      <q-card-section>
        <div class="text-subtitle1 q-mb-sm">Channel Points Refund (Optional)</div>
        <div class="text-caption text-grey-6 q-mb-md">
          Automatically refund channel points when TTS is blocked or fails.
          Create a Streamerbot action that calls "Update Redemption Status" (set to Canceled)
          and optionally sends a chat message.
        </div>
        <div class="column q-gutter-md">
          <q-input
            v-model="refundActionId"
            outlined
            dense
            label="REFUND Action ID"
            placeholder="e.g., 8f3a1b2c-4d5e-6f7a-8b9c-0d1e2f3a4b5c"
            @blur="saveRefundActionId"
          >
            <template v-slot:hint>
              Your Streamerbot action will receive: <code>redemptionId</code>, <code>rewardId</code>, <code>username</code>, <code>reason</code>
            </template>
          </q-input>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useQuasar } from 'quasar'

const props = defineProps({
  settings: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update'])
const $q = useQuasar()

const wsServerPort = ref(7591)
const wsServerConnected = ref(false)
const restartingWsServer = ref(false)

const streamerbotHost = ref('localhost')
const streamerbotPort = ref(7590)
const streamerbotConnected = ref(false)
const reconnectingStreamerbot = ref(false)

const showActionId = ref('')
const hideActionId = ref('')
const refundActionId = ref('')

const cleanupFns = []

onMounted(async () => {
  // Get initial status
  await refreshStatuses()

  // Listen for status updates
  cleanupFns.push(
    window.electronAPI.onWsServerStatus((data) => {
      wsServerConnected.value = data.connected
    })
  )

  cleanupFns.push(
    window.electronAPI.onStreamerbotStatus((data) => {
      streamerbotConnected.value = data.connected
    })
  )
})

onUnmounted(() => {
  cleanupFns.forEach(fn => fn())
})

async function refreshStatuses() {
  try {
    const wsStatus = await window.electronAPI.getWsServerStatus()
    wsServerConnected.value = wsStatus.connected

    const sbStatus = await window.electronAPI.getStreamerbotStatus()
    streamerbotConnected.value = sbStatus.connected
  } catch (error) {
    console.error('Failed to get statuses:', error)
  }
}

// Watch for settings changes
watch(() => props.settings, (newSettings) => {
  if (newSettings) {
    wsServerPort.value = newSettings.wsServerPort || 7591
    streamerbotHost.value = newSettings.streamerbotHost || 'localhost'
    streamerbotPort.value = newSettings.streamerbotPort || 7590
    showActionId.value = newSettings.showActionId || ''
    hideActionId.value = newSettings.hideActionId || ''
    refundActionId.value = newSettings.refundActionId || ''
  }
}, { immediate: true })

async function restartWsServer() {
  restartingWsServer.value = true
  try {
    // Save the port first
    if (wsServerPort.value !== props.settings.wsServerPort) {
      emit('update', 'wsServerPort', wsServerPort.value)
    }

    // Wait a bit for the setting to be saved
    await new Promise(resolve => setTimeout(resolve, 100))

    // Restart the server
    await window.electronAPI.restartWsServer()

    // Refresh status after a short delay
    await new Promise(resolve => setTimeout(resolve, 500))
    await refreshStatuses()

    $q.notify({
      type: 'positive',
      message: `WebSocket server restarted on port ${wsServerPort.value}`
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Failed to restart server: ${error.message}`
    })
  } finally {
    restartingWsServer.value = false
  }
}

async function reconnectStreamerbot() {
  reconnectingStreamerbot.value = true
  try {
    // Save settings first
    if (streamerbotHost.value !== props.settings.streamerbotHost) {
      emit('update', 'streamerbotHost', streamerbotHost.value)
    }
    if (streamerbotPort.value !== props.settings.streamerbotPort) {
      emit('update', 'streamerbotPort', streamerbotPort.value)
    }

    // Wait a bit for settings to be saved
    await new Promise(resolve => setTimeout(resolve, 100))

    // Reconnect
    await window.electronAPI.reconnectStreamerbot()

    // Refresh status after a short delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    await refreshStatuses()

    if (streamerbotConnected.value) {
      $q.notify({
        type: 'positive',
        message: 'Connected to Streamerbot!'
      })
    } else {
      $q.notify({
        type: 'warning',
        message: 'Could not connect to Streamerbot. Is it running?'
      })
    }
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Connection failed: ${error.message}`
    })
  } finally {
    reconnectingStreamerbot.value = false
  }
}

function saveShowActionId() {
  if (showActionId.value !== props.settings.showActionId) {
    emit('update', 'showActionId', showActionId.value)
  }
}

function saveHideActionId() {
  if (hideActionId.value !== props.settings.hideActionId) {
    emit('update', 'hideActionId', hideActionId.value)
  }
}

function saveRefundActionId() {
  if (refundActionId.value !== props.settings.refundActionId) {
    emit('update', 'refundActionId', refundActionId.value)
  }
}
</script>
