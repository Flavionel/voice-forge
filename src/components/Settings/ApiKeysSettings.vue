<template>
  <div>
    <div class="text-h6 q-mb-md">API Keys</div>

    <!-- ElevenLabs API Key -->
    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle1 q-mb-sm">ElevenLabs API Key</div>
        <div class="row items-center q-gutter-sm">
          <q-input
            v-model="elevenLabsKey"
            :type="showElevenLabsKey ? 'text' : 'password'"
            outlined
            dense
            class="col"
            placeholder="Enter your ElevenLabs API key"
            @blur="saveElevenLabsKey"
          >
            <template v-slot:append>
              <q-icon
                :name="showElevenLabsKey ? 'visibility_off' : 'visibility'"
                class="cursor-pointer"
                @click="showElevenLabsKey = !showElevenLabsKey"
              />
            </template>
          </q-input>
          <q-btn
            :loading="testingElevenLabs"
            :color="elevenLabsTestResult === true ? 'positive' : elevenLabsTestResult === false ? 'negative' : 'primary'"
            :icon="elevenLabsTestResult === true ? 'check' : elevenLabsTestResult === false ? 'close' : 'science'"
            label="Test"
            @click="testElevenLabsKey"
          />
        </div>
        <div class="text-caption text-grey-6 q-mt-sm">
          Get your API key from
          <a href="https://elevenlabs.io" target="_blank" class="text-primary">elevenlabs.io</a>
        </div>
      </q-card-section>
    </q-card>

    <!-- ChatGPT / OpenAI API Key -->
    <q-card flat bordered>
      <q-card-section>
        <div class="text-subtitle1 q-mb-sm">OpenAI API Key</div>
        <div class="row items-center q-gutter-sm">
          <q-input
            v-model="chatGptKey"
            :type="showChatGptKey ? 'text' : 'password'"
            outlined
            dense
            class="col"
            placeholder="Enter your OpenAI API key"
            @blur="saveChatGptKey"
          >
            <template v-slot:append>
              <q-icon
                :name="showChatGptKey ? 'visibility_off' : 'visibility'"
                class="cursor-pointer"
                @click="showChatGptKey = !showChatGptKey"
              />
            </template>
          </q-input>
          <q-btn
            :loading="testingOpenAI"
            :color="openAITestResult === true ? 'positive' : openAITestResult === false ? 'negative' : 'primary'"
            :icon="openAITestResult === true ? 'check' : openAITestResult === false ? 'close' : 'science'"
            label="Test"
            @click="testOpenAIKey"
          />
        </div>
        <div class="text-caption text-grey-6 q-mt-sm">
          Get your API key from
          <a href="https://platform.openai.com" target="_blank" class="text-primary">platform.openai.com</a>
          - Used for optional ChatGPT text pre-processing.
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useQuasar } from 'quasar'

const props = defineProps({
  settings: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update'])
const $q = useQuasar()

const elevenLabsKey = ref('')
const chatGptKey = ref('')
const showElevenLabsKey = ref(false)
const showChatGptKey = ref(false)
const testingElevenLabs = ref(false)
const elevenLabsTestResult = ref(null)
const testingOpenAI = ref(false)
const openAITestResult = ref(null)

// Watch for settings changes
watch(() => props.settings, (newSettings) => {
  if (newSettings) {
    elevenLabsKey.value = newSettings.elevenLabsApiKey || ''
    chatGptKey.value = newSettings.chatGptApiKey || ''
  }
}, { immediate: true })

function saveElevenLabsKey() {
  if (elevenLabsKey.value !== props.settings.elevenLabsApiKey) {
    emit('update', 'elevenLabsApiKey', elevenLabsKey.value)
    elevenLabsTestResult.value = null
  }
}

function saveChatGptKey() {
  if (chatGptKey.value !== props.settings.chatGptApiKey) {
    emit('update', 'chatGptApiKey', chatGptKey.value)
    openAITestResult.value = null
  }
}

async function testElevenLabsKey() {
  if (!elevenLabsKey.value) {
    $q.notify({
      type: 'warning',
      message: 'Please enter an API key first'
    })
    return
  }

  testingElevenLabs.value = true
  elevenLabsTestResult.value = null

  try {
    const result = await window.electronAPI.testElevenLabsApiKey(elevenLabsKey.value)
    elevenLabsTestResult.value = result.valid

    $q.notify({
      type: result.valid ? 'positive' : 'negative',
      message: result.valid ? 'ElevenLabs API key is valid!' : `API key invalid: ${result.error || 'Unknown error'}`,
      timeout: result.valid ? 2000 : 5000
    })
  } catch (error) {
    elevenLabsTestResult.value = false
    $q.notify({
      type: 'negative',
      message: `Error testing API key: ${error.message}`,
      timeout: 5000
    })
  } finally {
    testingElevenLabs.value = false
  }
}

async function testOpenAIKey() {
  if (!chatGptKey.value) {
    $q.notify({
      type: 'warning',
      message: 'Please enter an API key first'
    })
    return
  }

  testingOpenAI.value = true
  openAITestResult.value = null

  try {
    const result = await window.electronAPI.testOpenAIApiKey(chatGptKey.value)
    openAITestResult.value = result.valid

    $q.notify({
      type: result.valid ? 'positive' : 'negative',
      message: result.valid ? 'OpenAI API key is valid!' : `API key invalid: ${result.error || 'Unknown error'}`,
      timeout: result.valid ? 2000 : 5000
    })
  } catch (error) {
    openAITestResult.value = false
    $q.notify({
      type: 'negative',
      message: `Error testing API key: ${error.message}`,
      timeout: 5000
    })
  } finally {
    testingOpenAI.value = false
  }
}
</script>
