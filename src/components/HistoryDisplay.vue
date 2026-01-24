<template>
  <div>
    <div class="row items-center justify-between q-mb-md">
      <div class="text-h6">TTS History</div>
      <div class="row items-center" style="gap: 12px;">
        <!-- Use OBS Overlay for Replays -->
        <q-checkbox
          v-model="replayUseShowHide"
          label="OBS Overlay on Replay"
          dense
        >
          <q-tooltip>When checked, replayed audio will trigger OBS show/hide overlay actions</q-tooltip>
        </q-checkbox>

        <q-separator vertical />

        <q-btn
          flat
          color="primary"
          label="Open Log Folder"
          icon="folder_open"
          @click="openLogFolder"
        />
        <q-btn
          v-if="history.length > 0"
          flat
          color="negative"
          label="Clear History"
          icon="delete_sweep"
          @click="$emit('clear')"
        />
      </div>
    </div>

    <q-banner v-if="history.length === 0" class="bg-grey-9 text-grey-5">
      <template v-slot:avatar>
        <q-icon name="history" color="grey-6" />
      </template>
      No TTS history yet. Play some TTS to see the history here.
    </q-banner>

    <q-table
      v-else
      :rows="history"
      :columns="columns"
      row-key="id"
      flat
      bordered
      dense
      :pagination="{ rowsPerPage: 20 }"
      class="history-table"
    >
      <template v-slot:body="props">
        <q-tr :props="props" @click="props.expand = !props.expand" class="cursor-pointer">
          <q-td key="timestamp" :props="props">
            {{ formatTime(props.row.timestamp) }}
          </q-td>
          <q-td key="text" :props="props">
            <div class="ellipsis" style="max-width: 300px;">
              {{ props.row.text }}
            </div>
          </q-td>
          <q-td key="voiceAlias" :props="props">
            {{ props.row.voiceAlias }}
          </q-td>
          <q-td key="username" :props="props">
            {{ props.row.username || '-' }}
          </q-td>
          <q-td key="durationMs" :props="props">
            {{ formatDuration(props.row.durationMs) }}
          </q-td>
          <q-td key="status" :props="props">
            <q-badge :color="props.row.status === 'completed' ? 'positive' : 'negative'">
              {{ props.row.status }}
            </q-badge>
          </q-td>
        </q-tr>
        <q-tr v-show="props.expand" :props="props">
          <q-td colspan="100%">
            <div class="q-pa-md bg-grey-10 rounded-borders">
              <!-- Processing badges -->
              <div class="row q-gutter-sm q-mb-md">
                <q-badge v-if="props.row.wasTruncated" color="warning">
                  Truncated ({{ props.row.truncatedBy }})
                </q-badge>
                <q-badge v-if="props.row.sanitizationApplied?.length > 0" color="purple">
                  Sanitized ({{ props.row.sanitizationApplied.join(', ') }})
                </q-badge>
                <q-badge v-if="props.row.gptUsed" color="cyan">
                  GPT Processed
                </q-badge>
                <q-badge v-if="props.row.gptTagsAdded?.length > 0" color="info">
                  Tags: {{ props.row.gptTagsAdded.join(', ') }}
                </q-badge>
                <q-badge v-if="props.row.blockReason" color="negative">
                  Blocked
                </q-badge>
                <q-badge v-if="props.row.moderationOverride" color="light-blue">
                  Manually Approved
                </q-badge>
                <q-badge v-if="props.row.refunded" color="orange">
                  Refunded
                </q-badge>
              </div>

              <!-- Processing Pipeline - dynamic numbering based on visible steps -->
              <!-- Order: Source → Sanitization → Replacements → Max Length → GPT → Final -->
              <div class="text-subtitle2 q-mb-xs">{{ getStepNumber(props.row, 'source') }}. Source (raw input):</div>
              <div class="q-mb-md pipeline-text">{{ props.row.originalText }}</div>

              <div v-if="props.row.afterSanitization && props.row.afterSanitization !== props.row.originalText">
                <div class="text-subtitle2 q-mb-xs text-purple">{{ getStepNumber(props.row, 'sanitization') }}. After Sanitization:</div>
                <div class="q-mb-md pipeline-text">{{ props.row.afterSanitization }}</div>
              </div>

              <div v-if="props.row.afterReplacements && props.row.afterReplacements !== (props.row.afterSanitization || props.row.originalText)">
                <div class="text-subtitle2 q-mb-xs text-amber">{{ getStepNumber(props.row, 'replacements') }}. After Replacements:</div>
                <div class="q-mb-md pipeline-text">{{ props.row.afterReplacements }}</div>
              </div>

              <div v-if="props.row.afterTruncation && props.row.wasTruncated">
                <div class="text-subtitle2 q-mb-xs text-orange">{{ getStepNumber(props.row, 'truncation') }}. After Truncation ({{ props.row.truncatedBy }}):</div>
                <div class="q-mb-md pipeline-text">{{ props.row.afterTruncation }}</div>
              </div>

              <div v-if="props.row.afterGPT && props.row.afterGPT !== (props.row.afterTruncation || props.row.afterReplacements || props.row.afterSanitization || props.row.originalText)">
                <div class="text-subtitle2 q-mb-xs text-cyan">{{ getStepNumber(props.row, 'gpt') }}. After GPT Processing:</div>
                <div class="q-mb-md pipeline-text">{{ props.row.afterGPT }}</div>
              </div>

              <div v-if="props.row.blockReason" class="q-mb-md">
                <div class="text-subtitle2 q-mb-xs text-negative">
                  {{ getStepNumber(props.row, 'blocked') }}. Blocked by Moderation:
                </div>
                <div class="pipeline-text text-negative">{{ props.row.blockReason }}</div>
              </div>

              <div v-if="props.row.finalText && (!props.row.blockReason || props.row.moderationOverride)">
                <div class="text-subtitle2 q-mb-xs text-positive">
                  {{ getStepNumber(props.row, 'final') }}. Final (sent to ElevenLabs{{ props.row.moderationOverride ? ' — manually approved' : '' }}):
                </div>
                <div class="q-mb-md pipeline-text final-text">{{ props.row.finalText }}</div>
              </div>

              <q-separator class="q-my-md" />

              <!-- AI Processing Stats -->
              <div v-if="props.row.gptUsed || props.row.charactersUsed" class="q-mb-md">
                <div class="text-subtitle2 q-mb-xs text-cyan">AI Processing Stats:</div>
                <div class="row q-gutter-md text-caption">
                  <div v-if="props.row.gptTiming" class="ai-stat">
                    <q-icon name="smart_toy" size="xs" class="q-mr-xs" />
                    <strong>GPT:</strong> {{ props.row.gptTiming.totalMs }}ms
                    <span class="text-grey-6">
                      ({{ props.row.gptTiming.promptTokens }} + {{ props.row.gptTiming.completionTokens }} = {{ props.row.gptTiming.totalTokens || (props.row.gptTiming.promptTokens + props.row.gptTiming.completionTokens) }} tokens)
                    </span>
                    <span v-if="props.row.gptModel" class="text-grey-7"> · {{ props.row.gptModel }}</span>
                  </div>
                  <div v-if="props.row.charactersUsed" class="ai-stat">
                    <q-icon name="record_voice_over" size="xs" class="q-mr-xs" />
                    <strong>ElevenLabs:</strong> {{ props.row.charactersUsed }} characters
                  </div>
                </div>
              </div>

              <div class="row q-gutter-md text-caption text-grey-5">
                <div><strong>Voice ID:</strong> {{ props.row.voiceId || 'N/A' }}</div>
                <div><strong>ElevenLabs Model:</strong> {{ props.row.modelId || 'N/A' }}</div>
                <div><strong>Full Timestamp:</strong> {{ props.row.timestamp }}</div>
              </div>

              <div v-if="props.row.redemptionId || props.row.rewardId" class="row q-gutter-md text-caption text-grey-5 q-mt-sm">
                <div><strong>Redemption ID:</strong> {{ props.row.redemptionId || 'N/A' }}</div>
                <div><strong>Reward ID:</strong> {{ props.row.rewardId || 'N/A' }}</div>
              </div>

              <div v-if="props.row.gptError" class="q-mt-md text-warning">
                <strong>GPT Error:</strong> {{ props.row.gptError }}
              </div>

              <div v-if="props.row.error" class="q-mt-md text-negative">
                <strong>Error:</strong> {{ props.row.error }}
              </div>

              <!-- Action Buttons -->
              <q-separator v-if="showActions(props.row)" class="q-my-md" />
              <div v-if="showActions(props.row)" class="row q-gutter-md items-center">
                <!-- Refund Button -->
                <q-btn
                  v-if="props.row.redemptionId && !props.row.refunded"
                  flat
                  dense
                  color="orange"
                  icon="money_off"
                  label="Refund"
                  :disable="!settings.refundActionId"
                  @click.stop="refundItem(props.row)"
                >
                  <q-tooltip v-if="!settings.refundActionId">
                    Refund Action ID not configured. Set it in the Connections tab.
                  </q-tooltip>
                </q-btn>
                <q-badge v-if="props.row.refunded" color="orange" class="q-pa-xs">
                  Already Refunded
                </q-badge>

                <!-- Replay Button -->
                <q-btn-dropdown
                  v-if="props.row.historyItemId && props.row.status === 'completed'"
                  flat
                  dense
                  color="primary"
                  icon="replay"
                  label="Replay"
                  split
                  @click="replayItem(props.row, 'back')"
                >
                  <q-list dense>
                    <q-item clickable v-close-popup @click="replayItem(props.row, 'front')">
                      <q-item-section avatar>
                        <q-icon name="vertical_align_top" />
                      </q-item-section>
                      <q-item-section>Add to Front</q-item-section>
                    </q-item>
                    <q-item clickable v-close-popup @click="replayItem(props.row, 'back')">
                      <q-item-section avatar>
                        <q-icon name="vertical_align_bottom" />
                      </q-item-section>
                      <q-item-section>Add to Back</q-item-section>
                    </q-item>
                  </q-list>
                </q-btn-dropdown>
              </div>
            </div>
          </q-td>
        </q-tr>
      </template>
    </q-table>

    <div class="q-mt-md text-grey-6">
      <q-icon name="info" class="q-mr-xs" />
      Showing {{ history.length }} entries (in-app limit: {{ limit }})
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useQuasar } from 'quasar'

const props = defineProps({
  history: {
    type: Array,
    default: () => []
  },
  settings: {
    type: Object,
    default: () => ({})
  },
  limit: {
    type: Number,
    default: 100
  }
})

defineEmits(['clear'])

const $q = useQuasar()

// Local toggle for OBS overlay on replay (not persisted)
const replayUseShowHide = ref(false)

const columns = [
  { name: 'timestamp', label: 'Time', field: 'timestamp', align: 'left', sortable: true },
  { name: 'text', label: 'Message', field: 'text', align: 'left' },
  { name: 'voiceAlias', label: 'Voice', field: 'voiceAlias', align: 'left', sortable: true },
  { name: 'username', label: 'User', field: 'username', align: 'left', sortable: true },
  { name: 'durationMs', label: 'Duration', field: 'durationMs', align: 'left', sortable: true },
  { name: 'status', label: 'Status', field: 'status', align: 'center', sortable: true }
]

function formatTime(isoString) {
  if (!isoString) return '-'
  const date = new Date(isoString)
  return date.toLocaleTimeString()
}

function formatDuration(ms) {
  if (!ms) return '-'
  return (ms / 1000).toFixed(1) + 's'
}

/**
 * Get dynamic step number based on which steps are actually visible
 * This ensures sequential numbering (1, 2, 3) instead of hardcoded (1, 4, 5)
 * Order: Source → Sanitization → Replacements → Truncation → GPT → Blocked → Final
 */
function getStepNumber(row, stepName) {
  let stepNum = 0

  // Source is always step 1
  stepNum++
  if (stepName === 'source') return stepNum

  // Sanitization - only if different from source
  if (row.afterSanitization && row.afterSanitization !== row.originalText) {
    stepNum++
    if (stepName === 'sanitization') return stepNum
  }

  // Replacements - only if different from previous
  const prevTextForReplacements = row.afterSanitization || row.originalText
  if (row.afterReplacements && row.afterReplacements !== prevTextForReplacements) {
    stepNum++
    if (stepName === 'replacements') return stepNum
  }

  // Truncation - only if text was truncated
  if (row.afterTruncation && row.wasTruncated) {
    stepNum++
    if (stepName === 'truncation') return stepNum
  }

  // GPT Processing - only if different from previous
  const prevTextForGpt = row.afterTruncation || row.afterReplacements || row.afterSanitization || row.originalText
  if (row.afterGPT && row.afterGPT !== prevTextForGpt) {
    stepNum++
    if (stepName === 'gpt') return stepNum
  }

  // Blocked - if moderation blocked it
  if (row.blockReason) {
    stepNum++
    if (stepName === 'blocked') return stepNum
  }

  // Final - shown if not blocked, or if manually approved
  if (row.finalText && (!row.blockReason || row.moderationOverride)) {
    stepNum++
    if (stepName === 'final') return stepNum
  }

  return stepNum
}

async function openLogFolder() {
  try {
    await window.electronAPI.openLogDirectory()
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Failed to open log folder: ${error.message}`
    })
  }
}

function showActions(row) {
  // Show actions section if refund or replay is available
  return (row.redemptionId && !row.refunded) ||
         row.refunded ||
         (row.historyItemId && row.status === 'completed')
}

async function refundItem(row) {
  try {
    const result = await window.electronAPI.refundHistoryItem(row.id)
    if (result.success) {
      $q.notify({
        type: 'positive',
        message: `Refunded channel points for ${row.username || 'user'}`
      })
    } else {
      $q.notify({
        type: 'warning',
        message: result.error || 'Refund failed'
      })
    }
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Refund error: ${error.message}`
    })
  }
}

async function replayItem(row, position) {
  try {
    $q.notify({
      type: 'info',
      message: 'Downloading audio for replay...',
      timeout: 1500
    })
    const result = await window.electronAPI.replayHistoryItem(row.id, position, replayUseShowHide.value)
    if (result.success) {
      $q.notify({
        type: 'positive',
        message: `Replay queued (${position === 'front' ? 'front' : 'back'} of queue)`
      })
    } else {
      $q.notify({
        type: 'warning',
        message: result.error || 'Replay failed'
      })
    }
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Replay error: ${error.message}`
    })
  }
}
</script>

<style scoped>
.history-table {
  background: transparent;
}

.history-table .q-table__top,
.history-table .q-table__bottom {
  background: transparent;
}

.pipeline-text {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.9em;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  border-left: 3px solid #666;
}

.pipeline-text.final-text {
  border-left-color: #21ba45;
  background: rgba(33, 186, 69, 0.1);
}

.ai-stat {
  background: rgba(0, 188, 212, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
}
</style>
