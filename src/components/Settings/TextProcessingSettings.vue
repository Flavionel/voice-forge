<template>
  <div>
    <div class="text-h6 q-mb-md">Text Processing</div>

    <q-banner class="bg-grey-9 text-grey-5 q-mb-lg">
      <template v-slot:avatar>
        <q-icon name="info" color="grey-6" />
      </template>
      Text processing happens in order: <strong>Sanitization → Replacements → Max Length</strong>.
      Use the test section below to preview how text will be processed.
    </q-banner>

    <!-- Input Sanitization Section (runs FIRST) -->
    <q-card flat bordered class="q-mb-lg">
      <q-card-section>
        <div class="text-subtitle1 q-mb-md">Input Sanitization</div>

        <div class="text-caption text-grey-6 q-mb-md">
          Sanitization runs <strong>first</strong>, cleaning up input before any other processing.
          This helps prevent unwanted content from reaching TTS.
        </div>

        <div class="q-gutter-sm">
          <q-toggle
            :model-value="sanitization.stripHtmlTags"
            label="Strip HTML tags"
            @update:model-value="val => updateSanitization('stripHtmlTags', val)"
          />
          <div class="text-caption text-grey-6 q-ml-xl q-mb-md">
            Removes &lt;html&gt; tags and decodes entities like &amp;nbsp;
          </div>

          <q-toggle
            :model-value="sanitization.stripCodeBlocks"
            label="Strip code blocks"
            @update:model-value="val => updateSanitization('stripCodeBlocks', val)"
          />
          <div class="text-caption text-grey-6 q-ml-xl q-mb-md">
            Removes fenced code blocks (```code```) and inline code (`code`)
          </div>

          <q-toggle
            :model-value="sanitization.stripZalgoText"
            label="Strip Zalgo text"
            @update:model-value="val => updateSanitization('stripZalgoText', val)"
          />
          <div class="text-caption text-grey-6 q-ml-xl q-mb-md">
            Removes Unicode combining marks used to create corrupted/glitchy text.
            <strong>Individual voices can override this.</strong>
          </div>

          <q-toggle
            :model-value="sanitization.replaceEmojis"
            label="Replace emojis with text"
            @update:model-value="val => updateSanitization('replaceEmojis', val)"
          />
          <div class="text-caption text-grey-6 q-ml-xl q-mb-md">
            Converts emojis to fun spoken descriptions (e.g., 😂 → "crying laughing").
            Prevents TTS issues with unsupported characters.
            <strong>Individual voices can override this.</strong>
          </div>

          <q-toggle
            :model-value="sanitization.stripUserBracketTags"
            label="Strip user bracket tags"
            @update:model-value="val => updateSanitization('stripUserBracketTags', val)"
          />
          <div class="text-caption text-grey-6 q-ml-xl q-mb-md">
            Removes user-added [tags] to prevent TTS injection.
            Valid V3 emotion tags (like [laugh], [sigh]) are preserved.
            <strong>Individual voices can override this.</strong>
          </div>

          <q-separator class="q-my-sm" />

          <div class="q-mt-md">
            <div class="text-body2 q-mb-xs">Spam &amp; Repetition Handling</div>
            <div class="text-caption text-grey-6 q-mb-sm">
              Controls how repetitive content is handled — long number strings, repeated words,
              and emoji spam.
            </div>
            <q-btn-toggle
              :model-value="sanitization.spamMode"
              @update:model-value="val => updateSanitization('spamMode', val)"
              spread
              no-caps
              rounded
              toggle-color="primary"
              color="grey-9"
              text-color="grey-5"
              :options="[
                { value: 'allow', label: 'Allow', icon: 'check_circle' },
                { value: 'troll', label: 'Troll', icon: 'sentiment_very_satisfied' },
                { value: 'block', label: 'Block', icon: 'block' }
              ]"
              class="q-mb-xs"
            />
            <div class="text-caption text-grey-6">
              <span v-if="sanitization.spamMode === 'allow'">
                Spam passes through unchanged. TTS will read it as-is.
              </span>
              <span v-else-if="sanitization.spamMode === 'troll'">
                Spam gets replaced with sarcastic commentary. Entertaining for viewers!
              </span>
              <span v-else>
                Messages containing spam are blocked entirely and refunded.
              </span>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Global Replacements Section -->
    <q-card flat bordered class="q-mb-lg">
      <q-card-section>
        <div class="row items-center justify-between q-mb-md">
          <div class="text-subtitle1">Global Replacements</div>
          <q-btn
            color="primary"
            icon="add"
            label="Add Rule"
            size="sm"
            @click="openAddDialog"
          />
        </div>

        <div class="text-caption text-grey-6 q-mb-md">
          These rules apply to all voices (unless a voice has "Ignore Global Replacements" enabled).
        </div>

        <q-list v-if="replacements.length > 0" bordered separator class="rounded-borders">
          <q-item v-for="(rule, index) in replacements" :key="rule.id">
            <q-item-section side>
              <div class="column q-gutter-xs">
                <q-btn
                  flat
                  dense
                  round
                  icon="arrow_upward"
                  size="xs"
                  :disable="index === 0"
                  @click="moveRule(index, -1)"
                >
                  <q-tooltip>Move up</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  dense
                  round
                  icon="arrow_downward"
                  size="xs"
                  :disable="index === replacements.length - 1"
                  @click="moveRule(index, 1)"
                >
                  <q-tooltip>Move down</q-tooltip>
                </q-btn>
              </div>
            </q-item-section>

            <q-item-section>
              <q-item-label>
                <code class="bg-grey-9 q-pa-xs rounded-borders">{{ rule.pattern }}</code>
                <q-icon name="arrow_forward" class="q-mx-sm" size="xs" />
                <code v-if="rule.replacement" class="bg-grey-9 q-pa-xs rounded-borders">{{ rule.replacement }}</code>
                <span v-else class="text-grey-6 text-italic">(remove)</span>
              </q-item-label>
              <q-item-label caption>
                <q-badge v-if="rule.isRegex" color="purple" class="q-mr-xs">regex</q-badge>
                <q-badge v-if="rule.caseSensitive" color="orange" class="q-mr-xs">case-sensitive</q-badge>
                <q-badge v-if="!rule.enabled" color="grey">disabled</q-badge>
              </q-item-label>
            </q-item-section>

            <q-item-section side>
              <div class="row q-gutter-xs">
                <q-toggle
                  :model-value="rule.enabled"
                  dense
                  @update:model-value="toggleRule(index, $event)"
                >
                  <q-tooltip>{{ rule.enabled ? 'Enabled' : 'Disabled' }}</q-tooltip>
                </q-toggle>
                <q-btn
                  flat
                  dense
                  icon="edit"
                  color="primary"
                  @click="openEditDialog(rule, index)"
                />
                <q-btn
                  flat
                  dense
                  icon="delete"
                  color="negative"
                  @click="deleteRule(index)"
                />
              </div>
            </q-item-section>
          </q-item>
        </q-list>

        <div v-else class="text-center text-grey-6 q-pa-lg">
          No replacement rules configured. Click "Add Rule" to get started.
        </div>
      </q-card-section>
    </q-card>

    <!-- Max Message Length Section -->
    <q-card flat bordered class="q-mb-lg">
      <q-card-section>
        <div class="text-subtitle1 q-mb-md">Max Message Length</div>

        <div class="text-caption text-grey-6 q-mb-md">
          Truncate messages that exceed length limits before sending to TTS.
          Both limits can be enabled simultaneously - whichever triggers first wins.
          Individual voices can ignore or override these settings.
        </div>

        <!-- Character Limit -->
        <div class="row items-center q-gutter-md q-mb-md">
          <q-toggle
            :model-value="maxLength.characters?.enabled"
            label="Character limit"
            @update:model-value="updateCharLimitEnabled"
          />
          <q-input
            v-if="maxLength.characters?.enabled"
            :model-value="maxLength.characters?.value"
            type="number"
            outlined
            dense
            label="Max characters"
            style="width: 140px"
            :min="1"
            @update:model-value="updateCharLimitValue"
          />
        </div>

        <!-- Word Limit -->
        <div class="row items-center q-gutter-md">
          <q-toggle
            :model-value="maxLength.words?.enabled"
            label="Word limit"
            @update:model-value="updateWordLimitEnabled"
          />
          <q-input
            v-if="maxLength.words?.enabled"
            :model-value="maxLength.words?.value"
            type="number"
            outlined
            dense
            label="Max words"
            style="width: 140px"
            :min="1"
            @update:model-value="updateWordLimitValue"
          />
        </div>

        <div v-if="maxLength.characters?.enabled || maxLength.words?.enabled" class="text-caption text-grey-6 q-mt-md">
          <span v-if="maxLength.characters?.enabled && maxLength.words?.enabled">
            Messages exceeding {{ maxLength.characters.value }} characters OR {{ maxLength.words.value }} words will be truncated.
          </span>
          <span v-else-if="maxLength.characters?.enabled">
            Messages exceeding {{ maxLength.characters.value }} characters will be truncated (at word boundary when possible).
          </span>
          <span v-else>
            Messages exceeding {{ maxLength.words.value }} words will be truncated.
          </span>
        </div>
      </q-card-section>
    </q-card>

    <!-- Test Section -->
    <q-card flat bordered>
      <q-card-section>
        <div class="text-subtitle1 q-mb-md">Test Text Processing</div>

        <q-input
          v-model="testInput"
          outlined
          label="Enter text to test"
          type="textarea"
          autogrow
          class="q-mb-md"
          @update:model-value="runTest"
        />

        <div v-if="testInput && testResult" class="q-mb-md">
          <!-- Stats row -->
          <div class="row q-gutter-md q-mb-sm">
            <q-chip dense outline color="grey">
              {{ testResult.charCount }} characters
            </q-chip>
            <q-chip dense outline color="grey">
              {{ testResult.wordCount }} words
            </q-chip>
            <q-chip v-if="testResult.sanitizationApplied?.length > 0" dense color="cyan">
              Sanitized: {{ testResult.sanitizationApplied.join(', ') }}
            </q-chip>
            <q-chip v-if="testResult.appliedRules?.length > 0" dense color="purple">
              {{ testResult.appliedRules.length }} rule set(s) applied
            </q-chip>
            <q-chip v-if="testResult.wasTruncated" dense color="warning" text-color="dark">
              Truncated by {{ testResult.truncatedBy }}
            </q-chip>
          </div>

          <!-- Result -->
          <q-input
            :model-value="testResult.processedText"
            outlined
            readonly
            label="Final result (sent to TTS)"
            type="textarea"
            autogrow
            :class="testResult.wasModified ? 'result-modified' : ''"
          />
        </div>

        <div v-if="testInput && testResult?.wasModified" class="text-caption text-green q-mt-sm">
          Text was modified
          <span v-if="testResult.sanitizationApplied?.length > 0"> by sanitization</span>
          <span v-if="testResult.appliedRules?.length > 0">{{ testResult.sanitizationApplied?.length > 0 ? ',' : '' }} by replacements</span>
          <span v-if="testResult.wasTruncated">{{ (testResult.sanitizationApplied?.length > 0 || testResult.appliedRules?.length > 0) ? ',' : '' }} truncated by {{ testResult.truncatedBy }} limit</span>
        </div>
        <div v-else-if="testInput && !testResult?.wasModified" class="text-caption text-grey-6 q-mt-sm">
          No modifications - text unchanged
        </div>
      </q-card-section>
    </q-card>

    <!-- Add/Edit Rule Dialog -->
    <q-dialog v-model="showDialog" persistent>
      <q-card style="min-width: 450px">
        <q-card-section>
          <div class="text-h6">{{ isEditing ? 'Edit Rule' : 'Add Rule' }}</div>
        </q-card-section>

        <q-card-section class="q-gutter-md">
          <q-input
            v-model="editingRule.pattern"
            outlined
            label="Pattern *"
            :hint="editingRule.isRegex ? 'Regular expression pattern' : 'Text to find (plain text)'"
            :error="!!patternError"
            :error-message="patternError"
            @update:model-value="validatePattern"
          />

          <q-input
            v-model="editingRule.replacement"
            outlined
            label="Replacement"
            hint="Leave empty to remove matched text"
          />

          <div class="row q-gutter-md">
            <q-toggle
              v-model="editingRule.isRegex"
              label="Use Regular Expression"
              @update:model-value="validatePattern"
            />
            <q-toggle
              v-model="editingRule.caseSensitive"
              label="Case Sensitive"
            />
          </div>

          <q-toggle
            v-model="editingRule.enabled"
            label="Enabled"
          />

          <!-- Live preview -->
          <div v-if="editingRule.pattern" class="q-mt-md">
            <q-input
              v-model="previewInput"
              outlined
              dense
              label="Test this rule"
              hint="Enter text to see preview"
            />
            <div v-if="previewInput && previewResult" class="q-mt-sm">
              <div class="text-caption text-grey-6">Preview:</div>
              <code :class="previewResult.matched ? 'text-green' : 'text-grey-6'">
                {{ previewResult.result || '(empty)' }}
              </code>
              <span v-if="previewResult.error" class="text-negative q-ml-sm">
                Error: {{ previewResult.error }}
              </span>
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" v-close-popup />
          <q-btn
            flat
            :label="isEditing ? 'Save' : 'Add'"
            color="primary"
            :disable="!editingRule.pattern || !!patternError"
            @click="saveRule"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, toRaw } from 'vue'
import { useQuasar } from 'quasar'
import { v4 as uuidv4 } from 'uuid'

const props = defineProps({
  settings: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update'])
const $q = useQuasar()

// Replacement rules
const replacements = computed(() => props.settings.globalReplacements || [])

// Sanitization settings
const sanitization = computed(() => {
  const s = props.settings.sanitization || {}
  return {
    stripHtmlTags: s.stripHtmlTags ?? true,
    stripCodeBlocks: s.stripCodeBlocks ?? true,
    stripZalgoText: s.stripZalgoText ?? true,
    replaceEmojis: s.replaceEmojis ?? true,
    stripUserBracketTags: s.stripUserBracketTags ?? true,
    spamMode: s.spamMode ?? 'troll'
  }
})

// Max message length settings (dual limits) - ensure all nested properties have defaults
const maxLength = computed(() => {
  const settings = props.settings.maxMessageLength || {}
  return {
    characters: {
      enabled: settings.characters?.enabled ?? false,
      value: settings.characters?.value ?? 500
    },
    words: {
      enabled: settings.words?.enabled ?? false,
      value: settings.words?.value ?? 50
    }
  }
})

// Dialog state
const showDialog = ref(false)
const isEditing = ref(false)
const editingIndex = ref(-1)
const editingRule = ref({
  id: '',
  pattern: '',
  replacement: '',
  isRegex: false,
  caseSensitive: false,
  enabled: true
})
const patternError = ref('')
const previewInput = ref('')
const previewResult = ref(null)

// Test section state
const testInput = ref('')
const testResult = ref(null)

// Watch for preview changes
watch([() => editingRule.value.pattern, () => editingRule.value.replacement, () => editingRule.value.isRegex, () => editingRule.value.caseSensitive, previewInput], async () => {
  if (previewInput.value && editingRule.value.pattern) {
    try {
      // Convert Vue reactive object to plain object for IPC
      const plainRule = JSON.parse(JSON.stringify(toRaw(editingRule.value)))
      previewResult.value = await window.electronAPI.testSingleRule(previewInput.value, plainRule)
    } catch (error) {
      previewResult.value = { result: previewInput.value, matched: false, error: error.message }
    }
  } else {
    previewResult.value = null
  }
})

function openAddDialog() {
  isEditing.value = false
  editingIndex.value = -1
  editingRule.value = {
    id: uuidv4(),
    pattern: '',
    replacement: '',
    isRegex: false,
    caseSensitive: false,
    enabled: true
  }
  patternError.value = ''
  previewInput.value = ''
  previewResult.value = null
  showDialog.value = true
}

function openEditDialog(rule, index) {
  isEditing.value = true
  editingIndex.value = index
  editingRule.value = { ...rule }
  patternError.value = ''
  previewInput.value = ''
  previewResult.value = null
  showDialog.value = true
}

async function validatePattern() {
  if (!editingRule.value.pattern) {
    patternError.value = ''
    return
  }

  if (editingRule.value.isRegex) {
    const result = await window.electronAPI.validateRegexPattern(editingRule.value.pattern)
    patternError.value = result.valid ? '' : result.error
  } else {
    patternError.value = ''
  }
}

function saveRule() {
  const newReplacements = [...replacements.value]

  if (isEditing.value) {
    newReplacements[editingIndex.value] = { ...editingRule.value }
  } else {
    newReplacements.push({ ...editingRule.value })
  }

  emit('update', 'globalReplacements', newReplacements)
  showDialog.value = false

  $q.notify({
    type: 'positive',
    message: `Rule ${isEditing.value ? 'updated' : 'added'} successfully`
  })
}

function deleteRule(index) {
  $q.dialog({
    title: 'Delete Rule',
    message: 'Are you sure you want to delete this replacement rule?',
    cancel: true
  }).onOk(() => {
    const newReplacements = replacements.value.filter((_, i) => i !== index)
    emit('update', 'globalReplacements', newReplacements)

    $q.notify({
      type: 'positive',
      message: 'Rule deleted'
    })
  })
}

function toggleRule(index, enabled) {
  const newReplacements = [...replacements.value]
  newReplacements[index] = { ...newReplacements[index], enabled }
  emit('update', 'globalReplacements', newReplacements)
}

function moveRule(index, direction) {
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= replacements.value.length) return

  const newReplacements = [...replacements.value]
  const [removed] = newReplacements.splice(index, 1)
  newReplacements.splice(newIndex, 0, removed)
  emit('update', 'globalReplacements', newReplacements)
}

async function runTest() {
  if (!testInput.value) {
    testResult.value = null
    return
  }

  try {
    testResult.value = await window.electronAPI.testTextProcessing(testInput.value, null)
  } catch (error) {
    testResult.value = {
      processedText: testInput.value,
      wasModified: false,
      charCount: testInput.value.length,
      wordCount: testInput.value.split(/\s+/).filter(Boolean).length
    }
  }
}

// Sanitization update function
function getPlainSanitization() {
  const current = props.settings.sanitization || {}
  return JSON.parse(JSON.stringify(current))
}

function updateSanitization(key, value) {
  const current = getPlainSanitization()
  emit('update', 'sanitization', {
    ...current,
    [key]: value
  })
}

// Max message length functions (dual limits)
function getMaxLengthWithDefaults() {
  // Always return a complete structure with defaults
  return {
    characters: {
      enabled: maxLength.value.characters?.enabled ?? false,
      value: maxLength.value.characters?.value ?? 500
    },
    words: {
      enabled: maxLength.value.words?.enabled ?? false,
      value: maxLength.value.words?.value ?? 50
    }
  }
}

function updateCharLimitEnabled(enabled) {
  const current = getMaxLengthWithDefaults()
  current.characters.enabled = enabled
  emit('update', 'maxMessageLength', current)
}

function updateCharLimitValue(value) {
  const numValue = parseInt(value, 10)
  if (numValue > 0) {
    const current = getMaxLengthWithDefaults()
    current.characters.value = numValue
    emit('update', 'maxMessageLength', current)
  }
}

function updateWordLimitEnabled(enabled) {
  const current = getMaxLengthWithDefaults()
  current.words.enabled = enabled
  emit('update', 'maxMessageLength', current)
}

function updateWordLimitValue(value) {
  const numValue = parseInt(value, 10)
  if (numValue > 0) {
    const current = getMaxLengthWithDefaults()
    current.words.value = numValue
    emit('update', 'maxMessageLength', current)
  }
}
</script>

<style scoped>
code {
  font-family: 'Consolas', 'Monaco', monospace;
}

.result-modified :deep(.q-field__control) {
  background: rgba(33, 186, 69, 0.1);
}
</style>
