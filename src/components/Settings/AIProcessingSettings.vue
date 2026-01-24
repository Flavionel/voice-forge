<template>
  <div>
    <div class="text-h6 q-mb-md">AI Processing</div>

    <q-banner class="bg-grey-9 text-grey-5 q-mb-lg">
      <template v-slot:avatar>
        <q-icon name="info" color="grey-6" />
      </template>
      AI processing uses OpenAI GPT as an Audio Performance Director - moderating content and adding
      rich expressive tags to guide ElevenLabs v3's vocal delivery. GPT analyzes emotional intent
      and adds detailed performance notes like <code>[voice trembling]</code> or <code>[bursting with joy]</code>.
      <strong>Requires an OpenAI API key</strong> configured in the API Keys tab.
    </q-banner>

    <!-- GPT Processing Master Section -->
    <q-card flat bordered class="q-mb-lg">
      <q-card-section>
        <div class="row items-center justify-between q-mb-md">
          <div class="text-subtitle1">GPT Processing</div>
          <q-toggle
            :model-value="gptEnabled"
            label="Enable"
            @update:model-value="updateGptEnabled"
          />
        </div>

        <div v-if="!hasApiKey" class="q-mb-md">
          <q-banner class="bg-warning text-dark">
            <template v-slot:avatar>
              <q-icon name="warning" />
            </template>
            No OpenAI API key configured. Add one in the API Keys tab to enable GPT processing.
          </q-banner>
        </div>

        <div v-if="gptEnabled && hasApiKey" class="q-gutter-md">
          <!-- Model Selection -->
          <div>
            <div class="text-caption text-grey-6 q-mb-sm">Default OpenAI Model</div>
            <q-select
              :model-value="openAIModel"
              :options="openAIModels"
              option-value="id"
              option-label="name"
              emit-value
              map-options
              outlined
              dense
              @update:model-value="updateOpenAIModel"
            >
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.name }}</q-item-label>
                    <q-item-label caption>{{ scope.opt.description }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <div class="text-caption text-grey-6 q-mt-xs">
              Individual voices can override this in their settings.
            </div>
          </div>

          <!-- Reasoning Effort (GPT-5 models only) -->
          <div v-if="isReasoningModel">
            <div class="text-caption text-grey-6 q-mb-sm">Reasoning Effort (GPT-5 only)</div>
            <q-select
              :model-value="reasoningEffort"
              :options="reasoningEffortOptions"
              option-value="value"
              option-label="label"
              emit-value
              map-options
              outlined
              dense
              @update:model-value="updateReasoningEffort"
            >
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption>{{ scope.opt.description }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <div class="text-caption text-grey-6 q-mt-xs">
              <q-icon name="psychology" size="xs" class="q-mr-xs" />
              GPT-5 models use internal "thinking" which consumes tokens. Lower effort = faster + cheaper.
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Content Moderation Section (new granular component) -->
    <ContentModerationSettings
      v-if="gptEnabled && hasApiKey"
      :enabled="contentModeration.enabled"
      :on-failure="contentModeration.onFailure"
      :rules="contentModeration.rules"
      :blocked-topics="contentModeration.blockedTopics"
      :custom-instructions="contentModeration.customInstructions"
      :has-api-key="hasApiKey"
      @update:enabled="updateContentModerationEnabled"
      @update:on-failure="updateContentModerationOnFailure"
      @update:rules="updateContentModerationRules"
      @update:blocked-topics="updateContentModerationTopics"
      @update:custom-instructions="updateContentModerationInstructions"
    />
    <q-card v-else flat bordered class="q-mb-lg disabled-card">
      <q-card-section>
        <div class="row items-center justify-between q-mb-md">
          <div class="text-subtitle1">Content Moderation</div>
          <q-toggle
            :model-value="false"
            disable
            label="Enable"
          />
        </div>
        <div class="text-caption text-grey-6">
          Enable GPT Processing above to configure content moderation rules.
        </div>
      </q-card-section>
    </q-card>

    <!-- Audio Performance Direction Section -->
    <q-card flat bordered class="q-mb-lg" :class="{ 'disabled-card': !gptEnabled || !hasApiKey }">
      <q-card-section>
        <div class="row items-center justify-between q-mb-md">
          <div class="text-subtitle1">Audio Performance Direction</div>
          <q-toggle
            :model-value="emotionEnhancement.enabled"
            :disable="!gptEnabled || !hasApiKey"
            label="Enable"
            @update:model-value="updateEmotionEnhancementEnabled"
          />
        </div>

        <div class="text-caption text-grey-6 q-mb-md">
          GPT acts as an Audio Performance Director, adding rich expressive tags to guide vocal delivery.
          Tags are placed <strong>before</strong> the text they affect. Examples:
          <code>[whispering conspiratorially]</code>, <code>[voice trembling with emotion]</code>,
          <code>[a dry, humorless chuckle]</code>, <code>[bursting with excitement]</code>.
        </div>

        <q-banner v-if="emotionEnhancement.enabled && gptEnabled && hasApiKey" class="bg-blue-grey-9 q-mt-md">
          <template v-slot:avatar>
            <q-icon name="tips_and_updates" color="info" />
          </template>
          <strong>V3 Only:</strong> Performance tags only work with <strong>Eleven v3 Alpha</strong>.
          V3 interprets rich directions like <code>[singing in heroic tenor]</code> and vocalizations like
          <code>*gasp*</code>, <code>*laughs*</code>, <code>*sighs*</code>. Special symbols:
          <code>~</code> (sustain final word), <code>♪</code> (singing). Other models will pronounce these literally.
        </q-banner>
      </q-card-section>
    </q-card>

    <!-- Test Section -->
    <q-card flat bordered>
      <q-card-section>
        <div class="text-subtitle1 q-mb-md">Test AI Processing</div>

        <q-input
          v-model="testInput"
          outlined
          label="Enter text to test"
          type="textarea"
          autogrow
          class="q-mb-md"
        />

        <q-btn
          :loading="testing"
          :disable="!testInput || !gptEnabled || !hasApiKey"
          color="primary"
          label="Test GPT Processing"
          icon="smart_toy"
          class="q-mb-md"
          @click="runTest"
        />

        <div v-if="testResult" class="q-mt-md">
          <!-- Status indicators -->
          <div class="row q-gutter-sm q-mb-md">
            <q-chip
              v-if="testResult.blocked"
              dense
              color="negative"
              text-color="white"
              icon="block"
            >
              Blocked
            </q-chip>
            <q-chip
              v-else-if="testResult.success"
              dense
              color="positive"
              text-color="white"
              icon="check"
            >
              Processed
            </q-chip>
            <q-chip
              v-else
              dense
              color="warning"
              text-color="dark"
              icon="warning"
            >
              Error
            </q-chip>

            <!-- Triggered rule category when blocked -->
            <q-chip
              v-if="testResult.blocked && parseBlockCategory(testResult.blockReason)"
              dense
              color="deep-orange"
              text-color="white"
              :icon="getBlockCategoryIcon(parseBlockCategory(testResult.blockReason))"
            >
              {{ parseBlockCategory(testResult.blockReason) }}
            </q-chip>

            <q-chip
              v-if="testResult.sanitizationApplied?.length > 0"
              dense
              color="purple"
            >
              Sanitized: {{ testResult.sanitizationApplied.join(', ') }}
            </q-chip>

            <q-chip
              v-if="testResult.tagsAdded?.length > 0"
              dense
              color="info"
            >
              Tags: {{ testResult.tagsAdded.join(', ') }}
            </q-chip>

            <q-chip v-if="testResult.isEmotionCapable" dense color="cyan" outline>
              V3 (Audio Tags)
            </q-chip>

            <!-- Timing info -->
            <q-chip
              v-if="testResult.timing"
              dense
              outline
              color="grey"
            >
              {{ testResult.timing.totalMs }}ms &bull; {{ testResult.timing.totalTokens }} tokens
            </q-chip>
          </div>

          <!-- Block reason -->
          <q-banner v-if="testResult.blocked" class="bg-negative text-white q-mb-md">
            <template v-slot:avatar>
              <q-icon name="gpp_bad" />
            </template>
            <strong>Blocked:</strong> {{ parseBlockReason(testResult.blockReason) }}
          </q-banner>

          <!-- Error message -->
          <q-banner v-if="testResult.error" class="bg-warning text-dark q-mb-md">
            <template v-slot:avatar>
              <q-icon name="error" />
            </template>
            <strong>GPT Error:</strong> {{ testResult.error }}
          </q-banner>

          <!-- Result -->
          <q-input
            v-if="!testResult.blocked"
            :model-value="testResult.text"
            outlined
            readonly
            label="Final result (sent to TTS)"
            type="textarea"
            autogrow
            :class="testResult.text !== testInput ? 'result-modified' : ''"
          />

          <!-- Debug info (collapsible) -->
          <q-expansion-item
            v-if="testResult.debug"
            dense
            icon="bug_report"
            label="Debug Info"
            header-class="text-grey-6"
            class="q-mt-md"
          >
            <q-card flat bordered class="bg-grey-10">
              <q-card-section class="q-pa-sm">
                <!-- Parallel mode prompts (new format) -->
                <template v-if="testResult.debug.prompts">
                  <div v-if="testResult.debug.prompts.safety" class="q-mb-md">
                    <div class="text-caption text-red-4 q-mb-xs">Safety Prompt:</div>
                    <pre class="debug-prompt">{{ testResult.debug.prompts.safety }}</pre>
                  </div>
                  <div v-if="testResult.debug.prompts.topics" class="q-mb-md">
                    <div class="text-caption text-purple-4 q-mb-xs">Topics Prompt:</div>
                    <pre class="debug-prompt">{{ testResult.debug.prompts.topics }}</pre>
                  </div>
                  <div v-if="testResult.debug.prompts.copyright" class="q-mb-md">
                    <div class="text-caption text-orange-4 q-mb-xs">Copyright Prompt:</div>
                    <pre class="debug-prompt">{{ testResult.debug.prompts.copyright }}</pre>
                  </div>
                  <div v-if="testResult.debug.prompts.voice" class="q-mb-md">
                    <div class="text-caption text-teal-4 q-mb-xs">Voice Direction Prompt:</div>
                    <pre class="debug-prompt">{{ testResult.debug.prompts.voice }}</pre>
                  </div>
                  <!-- Task results -->
                  <div v-if="testResult.debug.results" class="q-mb-md">
                    <div class="text-caption text-blue-4 q-mb-xs">Task Results:</div>
                    <div v-for="task in testResult.debug.results" :key="task.label" class="text-caption q-ml-sm">
                      <span :class="task.success ? 'text-positive' : 'text-negative'">{{ task.success ? '✓' : '✗' }}</span>
                      <span class="text-grey-5"> {{ task.label }}:</span>
                      <span class="text-grey-6"> "{{ task.output?.substring(0, 60) }}{{ task.output?.length > 60 ? '...' : '' }}"</span>
                      <span class="text-grey-7"> ({{ task.timing?.totalMs || 0 }}ms)</span>
                    </div>
                  </div>
                </template>
                <!-- Legacy single prompt (old format) -->
                <template v-else-if="testResult.debug.systemPrompt">
                  <div class="text-caption text-grey-5 q-mb-xs">System Prompt:</div>
                  <pre class="debug-prompt">{{ testResult.debug.systemPrompt }}</pre>
                </template>
              </q-card-section>
            </q-card>
          </q-expansion-item>
        </div>

        <div v-if="!gptEnabled || !hasApiKey" class="text-caption text-grey-6 q-mt-sm">
          <span v-if="!hasApiKey">Add an OpenAI API key to test GPT processing.</span>
          <span v-else>Enable GPT processing above to test.</span>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import ContentModerationSettings from './ContentModerationSettings.vue'

const props = defineProps({
  settings: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update'])
const $q = useQuasar()

// OpenAI models list
const openAIModels = ref([])

// GPT-5 reasoning models (use reasoning_effort parameter)
const REASONING_MODELS = ['gpt-5-nano', 'gpt-5-mini', 'gpt-5', 'gpt-5.1', 'gpt-5.2', 'gpt-5.2-pro']

// Reasoning effort options with descriptions
const reasoningEffortOptions = [
  { value: 'minimal', label: 'Minimal', description: 'Fastest & cheapest - almost no internal thinking, best for simple text processing' },
  { value: 'low', label: 'Low', description: 'Fast - light reasoning, good balance for most TTS tasks' },
  { value: 'medium', label: 'Medium', description: 'Balanced - moderate reasoning, better context understanding' },
  { value: 'high', label: 'High', description: 'Thorough - deep reasoning, slowest and most expensive' }
]

// Load models on mount
onMounted(async () => {
  try {
    openAIModels.value = await window.electronAPI.getOpenAIModels()
  } catch (error) {
    console.error('Failed to load OpenAI models:', error)
  }
})

// Check if API key exists
const hasApiKey = computed(() => {
  return !!props.settings.chatGptApiKey
})

// GPT Processing enabled state
const gptEnabled = computed(() => {
  return props.settings.gptProcessing?.enabled ?? false
})

// OpenAI model
const openAIModel = computed(() => {
  return props.settings.openAIDefaultModel || 'gpt-5-nano'
})

// Check if selected model is a reasoning model (GPT-5 series)
const isReasoningModel = computed(() => {
  return REASONING_MODELS.includes(openAIModel.value)
})

// Reasoning effort setting
const reasoningEffort = computed(() => {
  return props.settings.openAIReasoningEffort || 'minimal'
})

// Content moderation settings (full config for granular rules)
const contentModeration = computed(() => {
  const cm = props.settings.gptProcessing?.contentModeration || {}
  return {
    enabled: cm.enabled ?? true,
    onFailure: cm.onFailure ?? 'block',
    rules: cm.rules || {
      sexualContent: { enabled: true },
      hateSpeech: { enabled: true },
      violence: { enabled: true },
      profanity: { mode: 'replace', replacementWord: 'quack' },
      doxxing: { enabled: true },
      misinformation: { enabled: true },
      copyrightedContent: { enabled: false }
    },
    blockedTopics: cm.blockedTopics || {
      presets: {},
      custom: []
    },
    customInstructions: cm.customInstructions || ''
  }
})

// Emotion enhancement settings
const emotionEnhancement = computed(() => {
  const ee = props.settings.gptProcessing?.emotionEnhancement || {}
  return {
    enabled: ee.enabled ?? true
  }
})

// Test state
const testInput = ref('')
const testResult = ref(null)
const testing = ref(false)

// Helper to get plain object from reactive props
function getPlainGptProcessing() {
  const current = props.settings.gptProcessing || {}
  return JSON.parse(JSON.stringify(current))
}

// Update functions
function updateGptEnabled(enabled) {
  const current = getPlainGptProcessing()
  emit('update', 'gptProcessing', {
    ...current,
    enabled
  })
}

function updateOpenAIModel(model) {
  emit('update', 'openAIDefaultModel', model)
}

function updateReasoningEffort(effort) {
  emit('update', 'openAIReasoningEffort', effort)
}

function updateContentModerationEnabled(enabled) {
  const current = getPlainGptProcessing()
  emit('update', 'gptProcessing', {
    ...current,
    contentModeration: {
      ...(current.contentModeration || {}),
      enabled
    }
  })
}

function updateContentModerationOnFailure(onFailure) {
  const current = getPlainGptProcessing()
  emit('update', 'gptProcessing', {
    ...current,
    contentModeration: {
      ...(current.contentModeration || {}),
      onFailure
    }
  })
}

function updateContentModerationRules(rules) {
  const current = getPlainGptProcessing()
  emit('update', 'gptProcessing', {
    ...current,
    contentModeration: {
      ...(current.contentModeration || {}),
      rules
    }
  })
}

function updateContentModerationTopics(blockedTopics) {
  const current = getPlainGptProcessing()
  emit('update', 'gptProcessing', {
    ...current,
    contentModeration: {
      ...(current.contentModeration || {}),
      blockedTopics
    }
  })
}

function updateContentModerationInstructions(customInstructions) {
  const current = getPlainGptProcessing()
  emit('update', 'gptProcessing', {
    ...current,
    contentModeration: {
      ...(current.contentModeration || {}),
      customInstructions
    }
  })
}

function updateEmotionEnhancementEnabled(enabled) {
  const current = getPlainGptProcessing()
  emit('update', 'gptProcessing', {
    ...current,
    emotionEnhancement: {
      ...(current.emotionEnhancement || {}),
      enabled
    }
  })
}

async function runTest() {
  if (!testInput.value) return

  testing.value = true
  testResult.value = null

  try {
    const result = await window.electronAPI.testGPTProcessing(testInput.value, null)
    testResult.value = result

    // Log detailed info to browser console (F12)
    console.log('%c[GPT Result]', 'color: #4fc3f7; font-weight: bold')
    console.log(`  Model: ${result.model || 'unknown'}`)
    if (result.parallelMode) {
      console.log(`  Mode: Parallel (${result.timing?.parallelTasks || 0} tasks)`)
    }
    if (result.timing) {
      console.log(`  Time: ${result.timing.totalMs}ms`)
      console.log(`  Tokens: ${result.timing.promptTokens} prompt + ${result.timing.completionTokens} completion = ${result.timing.totalTokens} total`)
    }
    if (result.debug) {
      console.log(`  Input: ${result.debug.inputLength} chars → Output: ${result.debug.outputLength} chars`)
    }
    if (result.rawOutput) {
      console.log('%c[GPT Raw Output]', 'color: #ffb74d; font-weight: bold')
      console.log(result.rawOutput)
    }
    // Handle parallel mode prompts (new format)
    if (result.debug?.prompts) {
      const prompts = result.debug.prompts
      if (prompts.safety) {
        console.log('%c[Safety Prompt]', 'color: #ef5350; font-weight: bold')
        console.log(prompts.safety)
      }
      if (prompts.topics) {
        console.log('%c[Topics Prompt]', 'color: #ab47bc; font-weight: bold')
        console.log(prompts.topics)
      }
      if (prompts.copyright) {
        console.log('%c[Copyright Prompt]', 'color: #ff7043; font-weight: bold')
        console.log(prompts.copyright)
      }
      if (prompts.voice) {
        console.log('%c[Voice Direction Prompt]', 'color: #26a69a; font-weight: bold')
        console.log(prompts.voice)
      }
    }
    // Handle legacy single prompt (old format)
    if (result.debug?.systemPrompt) {
      console.log('%c[GPT System Prompt]', 'color: #81c784; font-weight: bold')
      console.log(result.debug.systemPrompt)
    }
    // Log parallel task results
    if (result.debug?.results) {
      console.log('%c[Parallel Task Results]', 'color: #42a5f5; font-weight: bold')
      for (const task of result.debug.results) {
        const status = task.success ? '✓' : '✗'
        const time = task.timing?.totalMs || 0
        console.log(`  ${status} ${task.label}: "${task.output?.substring(0, 80)}${task.output?.length > 80 ? '...' : ''}" (${time}ms)`)
      }
    }
    if (result.error) {
      console.log('%c[GPT Error]', 'color: #ff5252; font-weight: bold', result.error)
    }
  } catch (error) {
    console.log('%c[GPT Error]', 'color: #ff5252; font-weight: bold', error.message)
    testResult.value = {
      success: false,
      error: error.message,
      text: testInput.value
    }
  } finally {
    testing.value = false
  }
}

// Clear test result when input changes
watch(testInput, () => {
  testResult.value = null
})

// Parse block category from block reason string (e.g., "HATE SPEECH - Contains slur" -> "HATE SPEECH")
function parseBlockCategory(blockReason) {
  if (!blockReason) return null
  const match = blockReason.match(/^([A-Z\s&]+)\s*[-:]/i)
  return match ? match[1].trim() : null
}

// Parse block reason (everything after the category)
function parseBlockReason(blockReason) {
  if (!blockReason) return 'Content flagged as inappropriate'
  const parts = blockReason.split(/\s*[-:]\s*/)
  if (parts.length > 1) {
    return parts.slice(1).join(' - ').trim() || blockReason
  }
  return blockReason
}

// Get icon for block category
function getBlockCategoryIcon(category) {
  if (!category) return 'block'
  const lowerCategory = category.toLowerCase()
  if (lowerCategory.includes('sexual')) return 'no_adult_content'
  if (lowerCategory.includes('hate')) return 'report'
  if (lowerCategory.includes('violence') || lowerCategory.includes('threat')) return 'dangerous'
  if (lowerCategory.includes('dox') || lowerCategory.includes('personal')) return 'privacy_tip'
  if (lowerCategory.includes('misinformation') || lowerCategory.includes('fake')) return 'fact_check'
  if (lowerCategory.includes('copyright')) return 'copyright'
  if (lowerCategory.includes('profanity')) return 'explicit'
  if (lowerCategory.includes('politic') || lowerCategory.includes('religion') || lowerCategory.includes('topic')) return 'topic'
  return 'block'
}
</script>

<style scoped>
code {
  font-family: 'Consolas', 'Monaco', monospace;
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.disabled-card {
  opacity: 0.6;
}

.result-modified :deep(.q-field__control) {
  background: rgba(33, 186, 69, 0.1);
}

.debug-prompt {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.3);
  padding: 8px;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 400px;
  overflow-y: auto;
  margin: 0;
  color: #b0b0b0;
}
</style>
