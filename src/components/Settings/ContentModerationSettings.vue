<template>
  <q-card flat bordered class="q-mb-lg" :class="{ 'disabled-card': !enabled }">
    <q-card-section>
      <div class="row items-center justify-between q-mb-md">
        <div class="text-subtitle1">Content Moderation</div>
        <q-toggle
          :model-value="enabled"
          :disable="!hasApiKey"
          label="Enable"
          @update:model-value="$emit('update:enabled', $event)"
        />
      </div>

      <div class="text-caption text-grey-6 q-mb-md">
        GPT evaluates messages against your configured rules before TTS playback.
        Blocked messages won't be spoken. Profanity can be replaced with a fun word.
      </div>

      <!-- AI Accuracy Warning Banner -->
      <div v-if="enabled && hasApiKey" class="ai-warning q-mb-lg">
        <q-icon name="warning" size="xs" class="q-mr-xs" />
        <span class="text-caption">
          <strong>AI moderation is not 100% accurate.</strong>
          Some content may slip through, and false positives can occur.
        </span>
      </div>

      <div v-if="enabled && hasApiKey" class="q-gutter-md">
        <!-- Safety Rules Section -->
        <div>
          <div class="text-subtitle2 q-mb-sm">Safety Rules</div>
          <div class="text-caption text-grey-6 q-mb-md">
            Protect your stream from harmful content. Each rule can be Off, Standard, or Strict.
          </div>

          <div class="q-gutter-sm">
            <q-expansion-item
              v-for="rule in safetyRules"
              :key="rule.key"
              :icon="rule.icon"
              :label="rule.name"
              :caption="getRuleLevelDescription(rule.key)"
              header-class="rule-header"
              :class="getRuleCardClass(rule.key)"
              dense
            >
              <q-card flat class="bg-grey-10">
                <q-card-section>
                  <div class="row items-center q-gutter-md q-mb-md">
                    <q-btn-toggle
                      :model-value="getRuleLevel(rule.key)"
                      :options="strictnessOptions"
                      color="grey-8"
                      toggle-color="primary"
                      unelevated
                      rounded
                      size="sm"
                      @update:model-value="setRuleLevel(rule.key, $event)"
                    />
                  </div>

                  <!-- Level descriptions -->
                  <div class="level-descriptions">
                    <div v-if="rule.levels.standard" class="q-mb-sm">
                      <q-badge color="primary" class="q-mr-sm">Standard</q-badge>
                      <span class="text-grey-5">{{ rule.levels.standard.description }}</span>
                    </div>
                    <div v-if="rule.levels.strict">
                      <q-badge color="deep-orange" class="q-mr-sm">Strict</q-badge>
                      <span class="text-grey-5">{{ rule.levels.strict.description }}</span>
                    </div>
                  </div>
                </q-card-section>
              </q-card>
            </q-expansion-item>
          </div>
        </div>

        <!-- Profanity Handling Section -->
        <div>
          <div class="text-subtitle2 q-mb-sm">Profanity Handling</div>

          <!-- Mode: Block / Replace / Allow -->
          <div class="row items-center q-gutter-md q-mb-sm">
            <q-btn-toggle
              :model-value="rules.profanity?.mode || 'replace'"
              :options="[
                { label: 'Block', value: 'block' },
                { label: 'Replace', value: 'replace' },
                { label: 'Allow', value: 'allow' }
              ]"
              color="grey-8"
              toggle-color="primary"
              unelevated
              rounded
              size="sm"
              @update:model-value="updateProfanityMode"
            />
            <q-input
              v-if="rules.profanity?.mode === 'replace'"
              :model-value="rules.profanity?.replacementWord || 'quack'"
              outlined
              dense
              label="Replacement word"
              style="max-width: 150px;"
              @update:model-value="updateReplacementWord"
            />
          </div>

          <!-- Strictness Level (only when not "allow") -->
          <div v-if="rules.profanity?.mode !== 'allow'" class="row items-center q-gutter-md q-mb-sm">
            <span class="text-caption text-grey-5">Strictness:</span>
            <q-btn-toggle
              :model-value="rules.profanity?.level || 'standard'"
              :options="[
                { label: 'Standard', value: 'standard' },
                { label: 'Strict', value: 'strict' }
              ]"
              color="grey-8"
              toggle-color="primary"
              unelevated
              rounded
              size="sm"
              @update:model-value="updateProfanityLevel"
            />
          </div>

          <div class="text-caption text-grey-6 q-mb-sm">
            <span v-if="rules.profanity?.mode === 'block'">
              <q-icon name="block" size="xs" class="q-mr-xs" />
              Messages with swear words will be blocked
            </span>
            <span v-else-if="rules.profanity?.mode === 'replace'">
              <q-icon name="find_replace" size="xs" class="q-mr-xs" />
              Swear words become "{{ rules.profanity?.replacementWord || 'quack' }}"
            </span>
            <span v-else>
              <q-icon name="warning" color="warning" size="xs" class="q-mr-xs" />
              Profanity will be spoken as-is
            </span>
            <span v-if="rules.profanity?.mode !== 'allow'" class="q-ml-sm">
              ({{ rules.profanity?.level === 'strict' ? 'all profanity including mild' : 'strong profanity only' }})
            </span>
          </div>

          <!-- Exception Words (only when not "allow") -->
          <div v-if="rules.profanity?.mode !== 'allow'" class="q-mt-sm">
            <div class="row items-center q-gutter-sm">
              <span class="text-caption text-grey-5">Allowed words:</span>
              <q-chip
                v-for="(word, index) in rules.profanity?.exceptions || []"
                :key="index"
                color="green-8"
                text-color="white"
                removable
                dense
                size="sm"
                @remove="removeProfanityException(index)"
              >
                {{ word }}
              </q-chip>
              <q-btn
                flat
                dense
                round
                icon="add"
                color="primary"
                size="sm"
                @click="showAddExceptionDialog = true"
              />
            </div>
            <div class="text-caption text-grey-6 q-mt-xs">
              These words will be allowed even if detected as profanity.
            </div>
          </div>
        </div>

        <q-separator />

        <!-- Copyright Protection Section -->
        <div>
          <div class="text-subtitle2 q-mb-sm">Copyright Protection</div>
          <div class="text-caption text-grey-6 q-mb-md">
            Protect against copyrighted content. Rules are organized by DMCA risk level.
          </div>

          <div class="q-gutter-sm">
            <q-expansion-item
              v-for="rule in copyrightRules"
              :key="rule.key"
              :icon="rule.icon"
              :label="rule.name"
              :caption="getRuleLevelDescription(rule.key)"
              header-class="rule-header"
              :class="getRuleCardClass(rule.key)"
              dense
            >
              <template v-slot:header>
                <q-item-section avatar>
                  <q-icon :name="rule.icon" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>
                    {{ rule.name }}
                    <q-badge
                      :color="getRiskBadgeColor(rule.riskLevel)"
                      class="q-ml-sm"
                    >
                      {{ rule.riskLevel?.toUpperCase() }} RISK
                    </q-badge>
                  </q-item-label>
                  <q-item-label caption>{{ getRuleLevelDescription(rule.key) }}</q-item-label>
                </q-item-section>
              </template>

              <q-card flat class="bg-grey-10">
                <q-card-section>
                  <!-- Risk explanation -->
                  <div class="text-caption q-mb-md" :class="getRiskTextClass(rule.riskLevel)">
                    <q-icon name="info" size="xs" class="q-mr-xs" />
                    {{ rule.riskDescription }}
                  </div>

                  <div class="row items-center q-gutter-md q-mb-md">
                    <q-btn-toggle
                      :model-value="getRuleLevel(rule.key)"
                      :options="strictnessOptions"
                      color="grey-8"
                      toggle-color="primary"
                      unelevated
                      rounded
                      size="sm"
                      @update:model-value="setRuleLevel(rule.key, $event)"
                    />
                  </div>

                  <!-- Level descriptions -->
                  <div class="level-descriptions">
                    <div v-if="rule.levels.standard" class="q-mb-sm">
                      <q-badge color="primary" class="q-mr-sm">Standard</q-badge>
                      <span class="text-grey-5">{{ rule.levels.standard.description }}</span>
                    </div>
                    <div v-if="rule.levels.strict">
                      <q-badge color="deep-orange" class="q-mr-sm">Strict</q-badge>
                      <span class="text-grey-5">{{ rule.levels.strict.description }}</span>
                    </div>
                  </div>
                </q-card-section>
              </q-card>
            </q-expansion-item>
          </div>
        </div>

        <q-separator />

        <!-- Blocked Topics Section -->
        <div>
          <div class="text-subtitle2 q-mb-sm">Blocked Topics</div>
          <div class="text-caption text-grey-6 q-mb-md">
            Block messages primarily about these subjects. Good for maintaining focus and avoiding drama.
          </div>

          <div class="row q-gutter-sm q-mb-md">
            <q-chip
              v-for="topic in topicPresets"
              :key="topic.key"
              :color="blockedTopics.presets?.[topic.key] ? 'orange' : 'grey-8'"
              :text-color="blockedTopics.presets?.[topic.key] ? 'white' : 'grey-5'"
              clickable
              @click="toggleTopic(topic.key)"
            >
              {{ topic.label }}
              <q-tooltip>{{ topic.description }}</q-tooltip>
            </q-chip>
          </div>

          <!-- Custom Topics -->
          <div class="row items-center q-gutter-sm q-mb-sm">
            <div class="text-caption text-grey-5">Custom topics:</div>
            <q-chip
              v-for="(topic, index) in blockedTopics.custom || []"
              :key="index"
              color="deep-orange"
              text-color="white"
              removable
              @remove="removeCustomTopic(index)"
            >
              {{ topic }}
            </q-chip>
            <q-btn
              flat
              dense
              round
              icon="add"
              color="primary"
              size="sm"
              @click="showAddTopicDialog = true"
            />
          </div>
        </div>

        <q-separator />

        <!-- Custom Instructions Section -->
        <div>
          <div class="text-subtitle2 q-mb-sm">Custom Instructions</div>
          <div class="text-caption text-grey-6 q-mb-sm">
            Add any additional rules in natural language. These are sent directly to GPT.
          </div>
          <q-input
            :model-value="customInstructions"
            outlined
            type="textarea"
            autogrow
            placeholder="Example: Allow mild swearing but block strong profanity. Block any mention of my ex-boyfriend named Dave."
            @update:model-value="$emit('update:customInstructions', $event)"
          />
        </div>

        <q-separator />

        <!-- Failure Behavior -->
        <div>
          <div class="text-subtitle2 q-mb-sm">When moderation fails (API error)</div>
          <q-btn-toggle
            :model-value="onFailure"
            :options="[
              { label: 'Block message', value: 'block' },
              { label: 'Allow message', value: 'skip' }
            ]"
            color="grey-8"
            toggle-color="primary"
            unelevated
            rounded
            @update:model-value="$emit('update:onFailure', $event)"
          />
          <div class="text-caption text-grey-6 q-mt-xs">
            <span v-if="onFailure === 'block'">
              <q-icon name="security" color="positive" size="xs" class="q-mr-xs" />
              Safer: Messages won't play if moderation is unavailable
            </span>
            <span v-else>
              <q-icon name="warning" color="warning" size="xs" class="q-mr-xs" />
              Messages will play without moderation if API fails
            </span>
          </div>
        </div>
      </div>
    </q-card-section>

    <!-- Add Custom Topic Dialog -->
    <q-dialog v-model="showAddTopicDialog">
      <q-card style="min-width: 300px;">
        <q-card-section>
          <div class="text-h6">Add Custom Topic</div>
        </q-card-section>
        <q-card-section>
          <q-input
            v-model="newTopicName"
            outlined
            label="Topic name"
            placeholder="e.g., my ex, that one game"
            autofocus
            @keyup.enter="addCustomTopic"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            label="Add"
            :disable="!newTopicName.trim()"
            @click="addCustomTopic"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Add Profanity Exception Dialog -->
    <q-dialog v-model="showAddExceptionDialog">
      <q-card style="min-width: 300px;">
        <q-card-section>
          <div class="text-h6">Add Allowed Word</div>
        </q-card-section>
        <q-card-section>
          <q-input
            v-model="newExceptionWord"
            outlined
            label="Word to allow"
            placeholder="e.g., damn, hell"
            autofocus
            @keyup.enter="addProfanityException"
          />
          <div class="text-caption text-grey-6 q-mt-sm">
            This word will not be blocked or replaced, even if detected as profanity.
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            label="Add"
            :disable="!newExceptionWord.trim()"
            @click="addProfanityException"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-card>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  enabled: {
    type: Boolean,
    default: true
  },
  onFailure: {
    type: String,
    default: 'block'
  },
  rules: {
    type: Object,
    default: () => ({})
  },
  blockedTopics: {
    type: Object,
    default: () => ({ presets: {}, custom: [] })
  },
  customInstructions: {
    type: String,
    default: ''
  },
  hasApiKey: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'update:enabled',
  'update:onFailure',
  'update:rules',
  'update:blockedTopics',
  'update:customInstructions'
])

// Dialog state
const showAddTopicDialog = ref(false)
const newTopicName = ref('')
const showAddExceptionDialog = ref(false)
const newExceptionWord = ref('')

// Rule definitions loaded from backend
const ruleDefinitions = ref({})
const strictnessLevels = ref(['off', 'standard', 'strict'])

// Strictness level options for toggle
const strictnessOptions = [
  { label: 'Off', value: 'off' },
  { label: 'Standard', value: 'standard' },
  { label: 'Strict', value: 'strict' }
]

// Load rule definitions from backend
onMounted(async () => {
  try {
    const result = await window.electronAPI.getModerationRuleDefinitions()
    ruleDefinitions.value = result.ruleDefinitions
    strictnessLevels.value = result.strictnessLevels
  } catch (error) {
    console.error('Failed to load rule definitions:', error)
  }
})

// Computed: Safety rules (non-copyright rules)
const safetyRules = computed(() => {
  const rules = []
  for (const [key, def] of Object.entries(ruleDefinitions.value)) {
    if (def.category === 'safety') {
      rules.push({ key, ...def })
    }
  }
  return rules
})

// Computed: Copyright rules (sorted by risk level)
const copyrightRules = computed(() => {
  const rules = []
  for (const [key, def] of Object.entries(ruleDefinitions.value)) {
    if (def.category === 'copyright') {
      rules.push({ key, ...def })
    }
  }
  // Sort by risk: high, medium, low
  const riskOrder = { high: 0, medium: 1, low: 2 }
  return rules.sort((a, b) => (riskOrder[a.riskLevel] || 99) - (riskOrder[b.riskLevel] || 99))
})

// Topic presets definitions
const topicPresets = [
  { key: 'politics', label: 'Politics', description: 'Political parties, elections, government policies' },
  { key: 'religion', label: 'Religion', description: 'Religious beliefs, faith debates, proselytizing' },
  { key: 'streamerDrama', label: 'Streamer Drama', description: 'Controversies involving other creators' },
  { key: 'spoilers', label: 'Spoilers', description: 'Plot spoilers, game solutions, backseating' },
  { key: 'traumaDumping', label: 'Trauma Dumping', description: 'Heavy personal trauma shared publicly' },
  { key: 'cryptoFinance', label: 'Crypto/Finance', description: 'Cryptocurrency, NFTs, financial schemes' },
  { key: 'consoleWars', label: 'Console Wars', description: 'Platform tribalism, console superiority debates' },
  { key: 'bodyImage', label: 'Body Image', description: 'Comments about appearance, body shaming' },
  { key: 'relationshipStatus', label: 'Relationships', description: 'Questions about dating, parasocial inquiries' },
  { key: 'ageLocation', label: 'Age/Location', description: 'Personal identifying questions' },
  { key: 'competitorMentions', label: 'Competitors', description: 'Promoting other streamers/channels' },
  { key: 'realWorldTragedies', label: 'Tragedies', description: 'Current disasters, mass shootings, attacks' }
]

// Helper to deep clone reactive objects to plain objects (required for IPC)
function toPlain(obj) {
  return JSON.parse(JSON.stringify(obj))
}

// Get rule level (with legacy support)
function getRuleLevel(ruleKey) {
  const ruleConfig = props.rules[ruleKey]
  if (!ruleConfig) return 'off'

  // New format: level property
  if (ruleConfig.level !== undefined) {
    return ruleConfig.level
  }

  // Legacy format: enabled boolean -> standard/off
  if (ruleConfig.enabled !== undefined) {
    return ruleConfig.enabled ? 'standard' : 'off'
  }

  return 'off'
}

// Set rule level
function setRuleLevel(ruleKey, level) {
  const newRules = toPlain(props.rules)
  newRules[ruleKey] = { level }
  emit('update:rules', newRules)
}

// Get description for current rule level
function getRuleLevelDescription(ruleKey) {
  const level = getRuleLevel(ruleKey)
  if (level === 'off') return 'Disabled'

  const def = ruleDefinitions.value[ruleKey]
  if (!def || !def.levels[level]) return level.charAt(0).toUpperCase() + level.slice(1)

  return def.levels[level].description
}

// Get card class based on level
function getRuleCardClass(ruleKey) {
  const level = getRuleLevel(ruleKey)
  if (level === 'off') return 'rule-off'
  if (level === 'strict') return 'rule-strict'
  return 'rule-standard'
}

// Get risk badge color
function getRiskBadgeColor(riskLevel) {
  if (riskLevel === 'high') return 'red'
  if (riskLevel === 'medium') return 'orange'
  return 'green'
}

// Get risk text class
function getRiskTextClass(riskLevel) {
  if (riskLevel === 'high') return 'text-red-4'
  if (riskLevel === 'medium') return 'text-orange-4'
  return 'text-green-4'
}

function updateProfanityMode(mode) {
  const newRules = toPlain(props.rules)
  if (!newRules.profanity) {
    newRules.profanity = { mode, replacementWord: 'quack' }
  } else {
    newRules.profanity.mode = mode
  }
  emit('update:rules', newRules)
}

function updateReplacementWord(word) {
  const newRules = toPlain(props.rules)
  if (!newRules.profanity) {
    newRules.profanity = { mode: 'replace', replacementWord: word }
  } else {
    newRules.profanity.replacementWord = word
  }
  emit('update:rules', newRules)
}

function updateProfanityLevel(level) {
  const newRules = toPlain(props.rules)
  if (!newRules.profanity) {
    newRules.profanity = { mode: 'replace', level, replacementWord: 'quack', exceptions: [] }
  } else {
    newRules.profanity.level = level
  }
  emit('update:rules', newRules)
}

function addProfanityException() {
  if (!newExceptionWord.value.trim()) return

  const newRules = toPlain(props.rules)
  if (!newRules.profanity) {
    newRules.profanity = { mode: 'replace', level: 'standard', replacementWord: 'quack', exceptions: [] }
  }
  if (!newRules.profanity.exceptions) {
    newRules.profanity.exceptions = []
  }
  // Avoid duplicates
  const word = newExceptionWord.value.trim().toLowerCase()
  if (!newRules.profanity.exceptions.includes(word)) {
    newRules.profanity.exceptions.push(word)
  }
  emit('update:rules', newRules)
  newExceptionWord.value = ''
  showAddExceptionDialog.value = false
}

function removeProfanityException(index) {
  const newRules = toPlain(props.rules)
  if (newRules.profanity?.exceptions) {
    newRules.profanity.exceptions.splice(index, 1)
  }
  emit('update:rules', newRules)
}

function toggleTopic(topicKey) {
  const newTopics = toPlain(props.blockedTopics)
  if (!newTopics.presets) {
    newTopics.presets = {}
  }
  newTopics.presets[topicKey] = !newTopics.presets[topicKey]
  emit('update:blockedTopics', newTopics)
}

function addCustomTopic() {
  if (!newTopicName.value.trim()) return

  const newTopics = toPlain(props.blockedTopics)
  if (!newTopics.custom) {
    newTopics.custom = []
  }
  newTopics.custom.push(newTopicName.value.trim())
  emit('update:blockedTopics', newTopics)
  newTopicName.value = ''
  showAddTopicDialog.value = false
}

function removeCustomTopic(index) {
  const newTopics = toPlain(props.blockedTopics)
  if (newTopics.custom) {
    newTopics.custom.splice(index, 1)
  }
  emit('update:blockedTopics', newTopics)
}
</script>

<style scoped>
.disabled-card {
  opacity: 0.6;
}

.ai-warning {
  background: rgba(255, 87, 34, 0.15);
  border-left: 3px solid var(--q-deep-orange);
  padding: 8px 12px;
  border-radius: 4px;
  color: #ffab91;
}

.rule-header {
  background: transparent;
}

.rule-off :deep(.q-item__section--avatar) {
  color: var(--q-grey-6);
}

.rule-off :deep(.q-item__label) {
  color: var(--q-grey-6);
}

.rule-standard :deep(.q-item__section--avatar) {
  color: var(--q-primary);
}

.rule-strict :deep(.q-item__section--avatar) {
  color: #ff5722; /* Deep orange - more prominent than standard */
}

.rule-strict :deep(.q-item__label) {
  color: #ff5722;
}

.level-descriptions {
  font-size: 0.85em;
}
</style>
