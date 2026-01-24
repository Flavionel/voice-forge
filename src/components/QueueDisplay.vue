<template>
  <div>
    <div class="row items-center justify-between q-mb-md">
      <div class="text-h6">TTS Queue</div>
      <div class="row items-center" style="gap: 12px;">
        <!-- Manual Moderation Toggle -->
        <q-toggle
          :model-value="settings.manualModerationEnabled || false"
          label="Manual Moderation"
          @update:model-value="$emit('update-setting', 'manualModerationEnabled', $event)"
        >
          <q-tooltip max-width="300px">
            When enabled, messages blocked by AI moderation stay in this Queue for your review
            instead of being auto-refunded. You can then Allow (generate TTS bypassing moderation)
            or Refund each message individually.
          </q-tooltip>
        </q-toggle>

        <q-separator vertical />

        <q-btn
          :flat="!queue.isPaused"
          :color="queue.isPaused ? 'warning' : 'primary'"
          :label="queue.isPaused ? 'Resume' : 'Pause'"
          :icon="queue.isPaused ? 'play_arrow' : 'pause'"
          @click="queue.isPaused ? $emit('resume') : $emit('pause')"
        />
        <q-btn
          v-if="queue.items.length > 0"
          flat
          color="negative"
          label="Clear Queue"
          icon="delete_sweep"
          @click="$emit('clear')"
        />
      </div>
    </div>

    <q-banner v-if="queue.isPaused && queueItems.length === 0" class="bg-warning text-dark q-mb-md">
      <template v-slot:avatar>
        <q-icon name="pause_circle" />
      </template>
      Queue is paused. New items will accumulate but won't be processed until resumed.
    </q-banner>

    <q-banner v-if="!queue.isPaused && queueItems.length === 0" class="bg-grey-9 text-grey-5">
      <template v-slot:avatar>
        <q-icon name="queue_music" color="grey-6" />
      </template>
      Queue is empty. Waiting for TTS requests...
    </q-banner>

    <!-- Main Queue -->
    <q-list v-if="queueItems.length > 0" bordered separator class="rounded-borders">
      <q-item
        v-for="item in queueItems"
        :key="item.id"
      >
        <q-item-section avatar>
          <q-avatar :color="getStatusColor(item.status)" text-color="white">
            <q-icon :name="getStatusIcon(item.status)" />
          </q-avatar>
        </q-item-section>

        <q-item-section>
          <q-item-label>{{ truncateText(item.text, 80) }}</q-item-label>
          <q-item-label caption>
            <span>Voice: {{ item.alias || 'default' }}</span>
            <span v-if="item.username" class="q-ml-sm">&bull; User: {{ item.username }}</span>
          </q-item-label>
        </q-item-section>

        <q-item-section side>
          <div class="row q-gutter-xs items-center">
            <!-- Cancel button: only when paused and item is queued -->
            <q-btn
              v-if="queue.isPaused && item.status === 'queued'"
              flat
              dense
              round
              color="negative"
              icon="cancel"
              size="sm"
              @click.stop="$emit('cancel', item.id)"
            >
              <q-tooltip>Cancel & Refund</q-tooltip>
            </q-btn>

            <q-badge :color="getStatusColor(item.status)">
              {{ getStatusLabel(item.status) }}
            </q-badge>
          </div>
        </q-item-section>

        <q-item-section v-if="item.status === 'playing'" side>
          <q-spinner-audio color="primary" size="24px" />
        </q-item-section>
      </q-item>
    </q-list>

    <div class="q-mt-md text-grey-6">
      <q-icon name="info" class="q-mr-xs" />
      Items in queue: {{ queueItems.length }}
      <span v-if="queue.isPaused" class="q-ml-md">
        <q-icon name="pause_circle" color="warning" class="q-mr-xs" />
        Paused
      </span>
      <span v-else-if="queue.isProcessing" class="q-ml-md">
        <q-icon name="play_circle" color="positive" class="q-mr-xs" />
        Processing...
      </span>
    </div>

    <!-- Moderation Panel -->
    <div v-if="moderationItems.length > 0" class="q-mt-lg">
      <div class="text-subtitle2 text-amber-5 q-mb-sm">
        <q-icon name="gavel" class="q-mr-xs" />
        Awaiting Moderation ({{ moderationItems.length }})
      </div>
      <q-list bordered separator class="rounded-borders moderation-list">
        <q-item
          v-for="item in moderationItems"
          :key="item.id"
        >
          <q-item-section avatar>
            <q-avatar color="amber-9" text-color="white">
              <q-icon name="gavel" />
            </q-avatar>
          </q-item-section>

          <q-item-section>
            <q-item-label>{{ truncateText(item.text, 80) }}</q-item-label>
            <q-item-label caption>
              <span>Voice: {{ item.alias || 'default' }}</span>
              <span v-if="item.username" class="q-ml-sm">&bull; User: {{ item.username }}</span>
            </q-item-label>
            <q-item-label v-if="item.blockReason" caption class="text-amber-4">
              Reason: {{ item.blockReason }}
            </q-item-label>
          </q-item-section>

          <q-item-section side>
            <div class="row q-gutter-xs items-center">
              <q-btn-dropdown
                flat
                dense
                color="light-blue"
                icon="check"
                size="sm"
                split
                @click="$emit('moderate', item.id, 'allow', 'back')"
              >
                <q-tooltip anchor="top middle" self="bottom middle">Allow</q-tooltip>
                <q-list dense>
                  <q-item clickable v-close-popup @click="$emit('moderate', item.id, 'allow', 'front')">
                    <q-item-section>Add to Front</q-item-section>
                  </q-item>
                  <q-item clickable v-close-popup @click="$emit('moderate', item.id, 'allow', 'back')">
                    <q-item-section>Add to Back</q-item-section>
                  </q-item>
                </q-list>
              </q-btn-dropdown>
              <q-btn
                flat
                dense
                round
                color="red-4"
                icon="money_off"
                size="sm"
                @click.stop="$emit('moderate', item.id, 'refund')"
              >
                <q-tooltip>Refund</q-tooltip>
              </q-btn>
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  queue: {
    type: Object,
    default: () => ({ items: [], isProcessing: false, isPaused: false, currentId: null, isLingering: false })
  },
  settings: {
    type: Object,
    default: () => ({})
  }
})

defineEmits(['clear', 'pause', 'resume', 'cancel', 'moderate', 'update-setting'])

const queueItems = computed(() =>
  (props.queue.items || []).filter(i => i.status !== 'pending_moderation')
)

const moderationItems = computed(() =>
  (props.queue.items || []).filter(i => i.status === 'pending_moderation')
)

function getStatusColor(status) {
  switch (status) {
    case 'queued': return 'grey-7'
    case 'processing': return 'warning'
    case 'ready': return 'info'
    case 'playing': return 'positive'
    case 'lingering': return 'amber'
    case 'error': return 'negative'
    case 'pending_moderation': return 'orange'
    default: return 'grey'
  }
}

function getStatusIcon(status) {
  switch (status) {
    case 'queued': return 'schedule'
    case 'processing': return 'sync'
    case 'ready': return 'check_circle'
    case 'playing': return 'volume_up'
    case 'lingering': return 'hourglass_top'
    case 'error': return 'error'
    case 'pending_moderation': return 'gavel'
    default: return 'help'
  }
}

function getStatusLabel(status) {
  if (status === 'pending_moderation') return 'awaiting moderation'
  return status
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}
</script>

<style scoped>
.moderation-list {
  border-color: rgba(255, 193, 7, 0.3);
}
</style>
