<template>
  <div>
    <div class="text-h6 q-mb-md">General Settings</div>

    <!-- Playback Volume -->
    <div class="text-subtitle2 text-grey-7 q-mb-sm">Playback</div>

    <q-card flat bordered class="q-mb-lg">
      <q-card-section>
        <div class="text-subtitle1 q-mb-sm">Volume</div>
        <div class="text-caption text-grey-6 q-mb-md">
          Master playback volume. Set above 100% to boost quiet voices.
          Per-voice overrides can be set in the Voices tab.
        </div>
        <div class="row items-center q-gutter-md">
          <q-slider
            v-model="globalVolume"
            :min="0"
            :max="200"
            :step="5"
            label
            :label-value="`${globalVolume}%`"
            class="col"
            @change="saveGlobalVolume"
          />
          <q-input
            v-model.number="globalVolume"
            type="number"
            outlined
            dense
            suffix="%"
            style="width: 100px"
            @blur="saveGlobalVolume"
          />
        </div>
      </q-card-section>
    </q-card>

    <!-- OBS Text Overlay Settings -->
    <div class="text-subtitle2 text-grey-7 q-mb-sm">OBS Text Overlay (Optional)</div>
    <div class="text-caption text-grey-6 q-mb-md">
      These settings control timing for an optional OBS text panel that displays TTS messages.
      If you're not using a text overlay in OBS, you can skip this section.
      The overlay is triggered via Streamerbot actions configured in the Connections tab.
    </div>

    <q-card flat bordered>
      <q-card-section class="q-gutter-lg">
        <!-- Minimum Linger Time -->
        <div>
          <div class="text-subtitle1 q-mb-sm">Minimum Linger Time</div>
          <div class="text-caption text-grey-6 q-mb-md">
            How long the text overlay stays visible after TTS finishes (when queue is empty).
            Prevents short messages from disappearing too quickly.
          </div>
          <div class="row items-center q-gutter-md">
            <q-slider
              v-model="minimumLingerMs"
              :min="0"
              :max="5000"
              :step="100"
              label
              :label-value="`${minimumLingerMs}ms`"
              class="col"
              @change="saveMinimumLinger"
            />
            <q-input
              v-model.number="minimumLingerMs"
              type="number"
              outlined
              dense
              suffix="ms"
              style="width: 120px"
              @blur="saveMinimumLinger"
            />
          </div>
        </div>

        <q-separator />

        <!-- Animation Duration -->
        <div>
          <div class="text-subtitle1 q-mb-sm">Animation Duration</div>
          <div class="text-caption text-grey-6 q-mb-md">
            How long your OBS show/hide animation takes.
            Set this to match your OBS source animation duration for proper timing.
          </div>
          <div class="row items-center q-gutter-md">
            <q-slider
              v-model="animationDurationMs"
              :min="0"
              :max="3000"
              :step="100"
              label
              :label-value="`${animationDurationMs}ms`"
              class="col"
              @change="saveAnimationDuration"
            />
            <q-input
              v-model.number="animationDurationMs"
              type="number"
              outlined
              dense
              suffix="ms"
              style="width: 120px"
              @blur="saveAnimationDuration"
            />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- History / Logging Settings -->
    <div class="text-h6 q-mt-lg q-mb-md">History & Logging</div>

    <q-card flat bordered>
      <q-card-section class="q-gutter-lg">
        <!-- Enable File Logging -->
        <div>
          <q-toggle
            v-model="historyFileLoggingEnabled"
            label="Enable file logging"
            @update:model-value="saveFileLoggingEnabled"
          />
          <div class="text-caption text-grey-6 q-ml-xl">
            Write TTS history to JSONL files (one file per day, easy to parse)
          </div>
        </div>

        <q-separator />

        <!-- Log Directory -->
        <div>
          <div class="text-subtitle1 q-mb-sm">Log Directory</div>
          <div class="text-caption text-grey-6 q-mb-md">
            Where to save history log files. Leave empty to use the default app data location.
          </div>
          <div class="row items-center q-gutter-sm">
            <q-input
              v-model="historyLogDir"
              outlined
              dense
              class="col"
              placeholder="Default: app data/logs"
              readonly
            />
            <q-btn
              flat
              icon="folder_open"
              label="Browse"
              @click="browseLogDir"
            />
            <q-btn
              flat
              icon="open_in_new"
              label="Open"
              @click="openLogDir"
            />
          </div>
          <div v-if="currentLogDir" class="text-caption text-grey-6 q-mt-sm">
            Current: {{ currentLogDir }}
          </div>
        </div>

        <q-separator />

        <!-- In-App History Limit -->
        <div>
          <div class="text-subtitle1 q-mb-sm">In-App History Limit</div>
          <div class="text-caption text-grey-6 q-mb-md">
            Maximum number of entries to show in the History tab. File logging is not affected.
          </div>
          <div class="row items-center q-gutter-md">
            <q-slider
              v-model="historyInAppLimit"
              :min="10"
              :max="500"
              :step="10"
              label
              :label-value="historyInAppLimit"
              class="col"
              @change="saveHistoryLimit"
            />
            <q-input
              v-model.number="historyInAppLimit"
              type="number"
              outlined
              dense
              style="width: 100px"
              @blur="saveHistoryLimit"
            />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Application Behavior -->
    <div class="text-subtitle2 text-grey-7 q-mt-lg q-mb-sm">Application</div>

    <q-card flat bordered>
      <q-card-section>
        <q-toggle
          v-model="minimizeToTray"
          label="Minimize to tray on close"
          @update:model-value="saveMinimizeToTray"
        />
        <div class="text-caption text-grey-6 q-ml-xl">
          When enabled, closing the window hides the app to the system tray instead of quitting.
          Right-click the tray icon to show the window or quit.
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'

const props = defineProps({
  settings: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update'])
const $q = useQuasar()

const minimizeToTray = ref(false)
const globalVolume = ref(100)
const minimumLingerMs = ref(1500)
const animationDurationMs = ref(1200)
const historyFileLoggingEnabled = ref(true)
const historyLogDir = ref('')
const historyInAppLimit = ref(100)
const currentLogDir = ref('')

// Load current log directory on mount
onMounted(async () => {
  currentLogDir.value = await window.electronAPI.getLogDirectory()
})

// Watch for settings changes
watch(() => props.settings, (newSettings) => {
  if (newSettings) {
    minimizeToTray.value = newSettings.minimizeToTray ?? false
    globalVolume.value = newSettings.globalVolume ?? 100
    minimumLingerMs.value = newSettings.minimumLingerMs ?? 1500
    animationDurationMs.value = newSettings.animationDurationMs ?? 1200
    historyFileLoggingEnabled.value = newSettings.historyFileLoggingEnabled ?? true
    historyLogDir.value = newSettings.historyLogDir ?? ''
    historyInAppLimit.value = newSettings.historyInAppLimit ?? 100
  }
}, { immediate: true })

function saveMinimizeToTray() {
  emit('update', 'minimizeToTray', minimizeToTray.value)
}

function saveGlobalVolume() {
  const clamped = Math.max(0, Math.min(200, globalVolume.value))
  globalVolume.value = clamped
  emit('update', 'globalVolume', clamped)
}

function saveMinimumLinger() {
  if (minimumLingerMs.value !== props.settings.minimumLingerMs) {
    emit('update', 'minimumLingerMs', minimumLingerMs.value)
  }
}

function saveAnimationDuration() {
  if (animationDurationMs.value !== props.settings.animationDurationMs) {
    emit('update', 'animationDurationMs', animationDurationMs.value)
  }
}

function saveFileLoggingEnabled() {
  emit('update', 'historyFileLoggingEnabled', historyFileLoggingEnabled.value)
}

async function browseLogDir() {
  try {
    const dir = await window.electronAPI.browseLogDirectory()
    if (dir) {
      historyLogDir.value = dir
      emit('update', 'historyLogDir', dir)
      currentLogDir.value = await window.electronAPI.getLogDirectory()
    }
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Failed to browse: ${error.message}`
    })
  }
}

async function openLogDir() {
  try {
    await window.electronAPI.openLogDirectory()
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Failed to open folder: ${error.message}`
    })
  }
}

function saveHistoryLimit() {
  if (historyInAppLimit.value !== props.settings.historyInAppLimit) {
    emit('update', 'historyInAppLimit', historyInAppLimit.value)
  }
}
</script>
