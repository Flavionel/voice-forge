<template>
  <div class="row items-center q-gutter-md">
    <q-chip
      :color="wsServerStatus.connected ? 'positive' : 'negative'"
      text-color="white"
      icon="dns"
      size="sm"
    >
      WS Server {{ wsServerStatus.connected ? 'ON' : 'OFF' }}
    </q-chip>

    <q-chip
      :color="streamerbotStatus.connected ? 'positive' : 'negative'"
      text-color="white"
      icon="smart_toy"
      size="sm"
    >
      Streamerbot {{ streamerbotStatus.connected ? 'Connected' : 'Disconnected' }}
    </q-chip>
  </div>
</template>

<script setup>
defineProps({
  wsServerStatus: {
    type: Object,
    default: () => ({ connected: false })
  },
  streamerbotStatus: {
    type: Object,
    default: () => ({ connected: false })
  }
})
</script>
