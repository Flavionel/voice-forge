<template>
  <div>
    <div class="row items-center justify-between q-mb-md">
      <div class="text-h6">Voice Aliases</div>
      <q-btn
        color="primary"
        icon="add"
        label="Add Voice"
        @click="openAddDialog"
      />
    </div>

    <q-banner v-if="!settings.elevenLabsApiKey" class="bg-warning text-dark q-mb-md">
      <template v-slot:avatar>
        <q-icon name="warning" />
      </template>
      Please configure your ElevenLabs API key first in the API Keys tab.
    </q-banner>

    <q-banner v-else-if="voices.length === 0" class="bg-grey-9 text-grey-5 q-mb-md">
      <template v-slot:avatar>
        <q-icon name="record_voice_over" color="grey-6" />
      </template>
      No voice aliases configured. Add a voice to get started.
    </q-banner>

    <q-list v-else bordered class="rounded-borders">
      <q-expansion-item
        v-for="voice in voices"
        :key="voice.alias"
        expand-separator
        :caption="getVoiceName(voice.elevenLabsVoiceId)"
        header-class="bg-grey-10"
      >
        <template v-slot:header>
          <q-item-section avatar>
            <q-avatar color="primary" text-color="white">
              <q-icon name="record_voice_over" />
            </q-avatar>
          </q-item-section>

          <q-item-section>
            <q-item-label>
              {{ voice.alias }}
              <q-badge v-if="voice.alias === settings.defaultVoiceAlias" color="positive" class="q-ml-sm">
                Default
              </q-badge>
              <!-- Override badges - condensed view -->
              <q-badge v-if="voice.ignoreGPTProcessing" color="red" class="q-ml-sm">
                No AI
              </q-badge>
              <q-badge v-else-if="hasAnyAIOverride(voice)" color="deep-purple" class="q-ml-sm">
                AI Override
              </q-badge>
              <q-badge v-if="hasAnyTextOverride(voice)" color="orange" class="q-ml-sm">
                Text Override
              </q-badge>
              <q-badge v-if="hasAnySafetyOverride(voice)" color="pink" class="q-ml-sm">
                Safety Override
              </q-badge>
            </q-item-label>
            <q-item-label caption>
              {{ getVoiceName(voice.elevenLabsVoiceId) }} &bull; {{ getModelName(voice.elevenLabsModelId) }}
            </q-item-label>
            <q-item-label caption class="text-grey-6">
              Stability: {{ (voice.stability ?? 0.5).toFixed(2) }} &bull;
              Similarity: {{ (voice.similarityBoost ?? 0.75).toFixed(2) }}
              <span v-if="voice.speed && voice.speed !== 1.0"> &bull; Speed: {{ voice.speed.toFixed(2) }}x</span>
              <span v-if="voice.volume != null"> &bull; Volume: {{ voice.volume }}%</span>
            </q-item-label>
          </q-item-section>

          <q-item-section side>
            <div class="row q-gutter-sm">
              <q-btn
                flat
                dense
                icon="play_arrow"
                color="green"
                @click.stop="openTestDialog(voice)"
              >
                <q-tooltip>Test voice</q-tooltip>
              </q-btn>
              <q-btn
                v-if="voice.alias !== settings.defaultVoiceAlias"
                flat
                dense
                icon="star_outline"
                color="grey"
                @click.stop="setAsDefault(voice.alias)"
              >
                <q-tooltip>Set as default</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                icon="edit"
                color="primary"
                @click.stop="openEditDialog(voice)"
              />
              <q-btn
                flat
                dense
                icon="delete"
                color="negative"
                @click.stop="deleteVoice(voice.alias)"
              />
            </div>
          </q-item-section>
        </template>

        <!-- Expanded content: Tabbed settings for this voice -->
        <q-card flat class="bg-grey-10">
          <q-tabs
            v-model="voiceSettingsTab[voice.alias]"
            dense
            class="text-grey-7"
            active-color="primary"
            indicator-color="primary"
            narrow-indicator
          >
            <q-tab name="text" label="Text Processing" icon="text_fields" />
            <q-tab name="ai" label="AI Processing" icon="psychology" />
            <q-tab name="safety" label="Safety" icon="security" :disable="voice.ignoreGPTProcessing" />
          </q-tabs>

          <q-separator />

          <q-tab-panels v-model="voiceSettingsTab[voice.alias]" animated class="bg-grey-10">
            <!-- ==================== TEXT PROCESSING TAB ==================== -->
            <q-tab-panel name="text">
              <div class="q-gutter-md">
                <!-- Sanitization -->
                <div>
                  <div class="text-subtitle2 q-mb-sm">Input Sanitization</div>
                  <q-toggle
                    :model-value="voice.ignoreSanitization || false"
                    label="Ignore All Sanitization"
                    color="orange"
                    @update:model-value="toggleIgnoreSanitization(voice, $event)"
                  />
                  <div class="text-caption text-grey-6 q-ml-xl">
                    Skip HTML stripping, code block removal, Zalgo stripping, emoji replacement, and bracket tag cleaning.
                  </div>

                  <div v-if="!voice.ignoreSanitization" class="q-mt-sm">
                    <q-toggle
                      :model-value="voice.allowZalgoText || false"
                      label="Allow Zalgo Text"
                      color="cyan"
                      @update:model-value="toggleAllowZalgoText(voice, $event)"
                    />
                    <div class="text-caption text-grey-6 q-ml-xl">
                      Don't strip Unicode combining marks for this voice.
                    </div>

                    <q-toggle
                      :model-value="voice.allowEmojis || false"
                      label="Allow Emojis (skip replacement)"
                      color="cyan"
                      @update:model-value="toggleAllowEmojis(voice, $event)"
                    />
                    <div class="text-caption text-grey-6 q-ml-xl">
                      Don't replace emojis with text descriptions for this voice.
                    </div>
                  </div>
                </div>

                <q-separator />

                <!-- Global Replacements -->
                <div>
                  <div class="text-subtitle2 q-mb-sm">Replacement Rules</div>
                  <q-toggle
                    :model-value="voice.ignoreGlobalReplacements || false"
                    label="Ignore Global Replacements"
                    color="orange"
                    @update:model-value="toggleIgnoreGlobal(voice, $event)"
                  />
                  <div class="text-caption text-grey-6 q-ml-xl q-mb-md">
                    Skip all global replacement rules configured in Text Processing tab.
                  </div>

                  <!-- Custom Replacements -->
                  <div class="row items-center justify-between q-mb-sm">
                    <span class="text-body2">Custom Replacements for this Voice</span>
                    <q-btn
                      color="primary"
                      icon="add"
                      label="Add Rule"
                      size="sm"
                      flat
                      @click="openVoiceRuleDialog(voice)"
                    />
                  </div>

                  <q-list v-if="voice.replacements?.length > 0" bordered separator dense class="rounded-borders">
                    <q-item v-for="(rule, ruleIndex) in voice.replacements" :key="rule.id" dense>
                      <q-item-section side>
                        <div class="column q-gutter-xs">
                          <q-btn flat dense round icon="arrow_upward" size="xs" :disable="ruleIndex === 0" @click="moveVoiceRule(voice, ruleIndex, -1)" />
                          <q-btn flat dense round icon="arrow_downward" size="xs" :disable="ruleIndex === voice.replacements.length - 1" @click="moveVoiceRule(voice, ruleIndex, 1)" />
                        </div>
                      </q-item-section>
                      <q-item-section>
                        <q-item-label>
                          <code class="bg-grey-9 q-pa-xs rounded-borders text-caption">{{ rule.pattern }}</code>
                          <q-icon name="arrow_forward" class="q-mx-sm" size="xs" />
                          <code v-if="rule.replacement" class="bg-grey-9 q-pa-xs rounded-borders text-caption">{{ rule.replacement }}</code>
                          <span v-else class="text-grey-6 text-italic text-caption">(remove)</span>
                        </q-item-label>
                        <q-item-label caption>
                          <q-badge v-if="rule.isRegex" color="purple" size="xs" class="q-mr-xs">regex</q-badge>
                          <q-badge v-if="rule.caseSensitive" color="orange" size="xs" class="q-mr-xs">case-sensitive</q-badge>
                          <q-badge v-if="!rule.enabled" color="grey" size="xs">disabled</q-badge>
                        </q-item-label>
                      </q-item-section>
                      <q-item-section side>
                        <div class="row q-gutter-xs">
                          <q-toggle :model-value="rule.enabled" dense size="xs" @update:model-value="toggleVoiceRule(voice, ruleIndex, $event)" />
                          <q-btn flat dense icon="edit" color="primary" size="sm" @click="openVoiceRuleDialog(voice, rule, ruleIndex)" />
                          <q-btn flat dense icon="delete" color="negative" size="sm" @click="deleteVoiceRule(voice, ruleIndex)" />
                        </div>
                      </q-item-section>
                    </q-item>
                  </q-list>
                  <div v-else class="text-center text-grey-6 q-pa-sm text-caption">
                    No custom rules. Global rules will apply (unless ignored above).
                  </div>
                </div>

                <q-separator />

                <!-- Max Message Length -->
                <div>
                  <div class="text-subtitle2 q-mb-sm">Max Message Length</div>
                  <q-toggle
                    :model-value="voice.ignoreMaxMessageLength || false"
                    label="Ignore Global Max Length"
                    color="orange"
                    @update:model-value="toggleIgnoreMaxLength(voice, $event)"
                  />
                  <div class="text-caption text-grey-6 q-ml-xl q-mb-sm">
                    No message length limits for this voice.
                  </div>

                  <div v-if="!voice.ignoreMaxMessageLength">
                    <q-toggle
                      :model-value="!!voice.maxMessageLengthOverride"
                      label="Use Custom Max Length"
                      color="primary"
                      @update:model-value="toggleMaxLengthOverride(voice, $event)"
                    />

                    <div v-if="voice.maxMessageLengthOverride" class="q-mt-sm q-ml-lg q-gutter-sm">
                      <div class="row items-center q-gutter-sm q-mb-sm">
                        <q-toggle :model-value="voice.maxMessageLengthOverride.characters?.enabled || false" label="Character limit" dense @update:model-value="updateVoiceCharLimitEnabled(voice, $event)" />
                        <q-input v-if="voice.maxMessageLengthOverride.characters?.enabled" :model-value="voice.maxMessageLengthOverride.characters?.value" type="number" outlined dense label="Max" style="width: 90px" :min="1" @update:model-value="updateVoiceCharLimitValue(voice, $event)" />
                      </div>
                      <div class="row items-center q-gutter-sm">
                        <q-toggle :model-value="voice.maxMessageLengthOverride.words?.enabled || false" label="Word limit" dense @update:model-value="updateVoiceWordLimitEnabled(voice, $event)" />
                        <q-input v-if="voice.maxMessageLengthOverride.words?.enabled" :model-value="voice.maxMessageLengthOverride.words?.value" type="number" outlined dense label="Max" style="width: 90px" :min="1" @update:model-value="updateVoiceWordLimitValue(voice, $event)" />
                      </div>
                    </div>
                  </div>
                </div>

                <q-separator />

                <!-- Test Section -->
                <div>
                  <div class="text-subtitle2 q-mb-sm">Test Text Processing</div>
                  <q-input
                    v-model="voiceTestInputs[voice.alias]"
                    outlined
                    dense
                    label="Enter text to test"
                    @update:model-value="runVoiceTextTest(voice.alias)"
                  />
                  <div v-if="voiceTestInputs[voice.alias] && voiceTestResults[voice.alias]" class="q-mt-sm">
                    <div class="row q-gutter-sm q-mb-sm">
                      <q-chip dense outline color="grey" size="sm">{{ voiceTestResults[voice.alias].charCount }} chars</q-chip>
                      <q-chip dense outline color="grey" size="sm">{{ voiceTestResults[voice.alias].wordCount }} words</q-chip>
                      <q-chip v-if="voiceTestResults[voice.alias].wasTruncated" dense color="warning" text-color="dark" size="sm">Truncated</q-chip>
                    </div>
                    <q-input :model-value="voiceTestResults[voice.alias].processedText" outlined dense readonly label="Result" :class="voiceTestResults[voice.alias].wasModified ? 'result-modified' : ''" />
                  </div>
                </div>
              </div>
            </q-tab-panel>

            <!-- ==================== AI PROCESSING TAB ==================== -->
            <q-tab-panel name="ai">
              <div class="q-gutter-md">
                <!-- Master GPT Bypass -->
                <div class="bypass-section">
                  <q-toggle
                    :model-value="voice.ignoreGPTProcessing || false"
                    label="Skip ALL AI Processing"
                    color="red"
                    left-label
                    @update:model-value="toggleIgnoreGPTProcessing(voice, $event)"
                  />
                  <div class="text-caption text-grey-6 q-ml-xl">
                    Completely bypass GPT - no moderation, no emotion tags. Use for trusted sources.
                  </div>
                </div>

                <q-banner v-if="voice.ignoreGPTProcessing" class="bg-red-10 text-red-4">
                  <template v-slot:avatar>
                    <q-icon name="warning" color="red" />
                  </template>
                  AI processing is completely disabled for this voice. Safety tab settings have no effect.
                </q-banner>

                <!-- GPT Overrides (disabled when bypassing) -->
                <div :class="{ 'disabled-section': voice.ignoreGPTProcessing }">
                  <q-separator class="q-my-md" />

                  <!-- Allow Bracket Tags -->
                  <div>
                    <q-toggle
                      :model-value="voice.allowUserBracketTags || false"
                      :disable="voice.ignoreGPTProcessing"
                      label="Allow User Bracket Tags"
                      color="cyan"
                      @update:model-value="toggleAllowUserBracketTags(voice, $event)"
                    />
                    <div class="text-caption text-grey-6 q-ml-xl">
                      Don't strip [tags] from input. Only enable for trusted sources.
                    </div>
                  </div>

                  <q-separator class="q-my-md" />

                  <!-- Emotion Enhancement Override -->
                  <div>
                    <div class="text-subtitle2 q-mb-sm">Audio Performance Direction</div>
                    <q-btn-toggle
                      :model-value="getEmotionEnhancementMode(voice)"
                      :disable="voice.ignoreGPTProcessing"
                      :options="[
                        { label: 'Use Global', value: 'inherit' },
                        { label: 'Force On', value: 'on' },
                        { label: 'Force Off', value: 'off' }
                      ]"
                      color="grey-8"
                      toggle-color="primary"
                      unelevated
                      rounded
                      size="sm"
                      @update:model-value="setEmotionEnhancementMode(voice, $event)"
                    />
                    <div class="text-caption text-grey-6 q-mt-xs">
                      Add V3 emotion tags for expressive speech.
                    </div>
                  </div>

                  <q-separator class="q-my-md" />

                  <!-- OpenAI Model Override -->
                  <div>
                    <div class="text-subtitle2 q-mb-sm">OpenAI Model</div>
                    <q-toggle
                      :model-value="!!voice.openAIModelOverride"
                      :disable="voice.ignoreGPTProcessing"
                      label="Use Different Model for this Voice"
                      color="blue"
                      @update:model-value="toggleOpenAIModelOverride(voice, $event)"
                    />
                    <q-select
                      v-if="voice.openAIModelOverride"
                      :model-value="voice.openAIModelOverride"
                      :disable="voice.ignoreGPTProcessing"
                      :options="openAIModels"
                      option-value="id"
                      option-label="name"
                      emit-value
                      map-options
                      outlined
                      dense
                      class="q-ml-lg q-mt-sm"
                      style="max-width: 300px"
                      @update:model-value="updateVoiceOpenAIModel(voice, $event)"
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
                  </div>
                </div>
              </div>
            </q-tab-panel>

            <!-- ==================== SAFETY TAB ==================== -->
            <q-tab-panel name="safety">
              <div v-if="voice.ignoreGPTProcessing" class="text-center text-grey-6 q-pa-lg">
                <q-icon name="block" size="xl" class="q-mb-md" />
                <div>AI Processing is disabled for this voice.</div>
                <div class="text-caption">Enable AI Processing in the AI tab to configure safety settings.</div>
              </div>

              <div v-else class="q-gutter-md">
                <!-- Content Moderation Master Toggle -->
                <div>
                  <div class="text-subtitle2 q-mb-sm">Content Moderation</div>
                  <q-btn-toggle
                    :model-value="getContentModerationMode(voice)"
                    :options="[
                      { label: 'Use Global', value: 'inherit' },
                      { label: 'Force On', value: 'on' },
                      { label: 'Force Off', value: 'off' }
                    ]"
                    color="grey-8"
                    toggle-color="primary"
                    unelevated
                    rounded
                    size="sm"
                    @update:model-value="setContentModerationMode(voice, $event)"
                  />
                  <div class="text-caption text-grey-6 q-mt-xs">
                    Check messages against safety rules before TTS.
                  </div>
                </div>

                <!-- Safety Rules Override (only when moderation is not forced off) -->
                <div v-if="getContentModerationMode(voice) !== 'off'">
                  <q-separator class="q-my-md" />

                  <!-- Individual Rule Overrides -->
                  <div>
                    <div class="text-subtitle2 q-mb-sm">Safety Rule Overrides</div>
                    <div class="text-caption text-grey-6 q-mb-sm">Click to cycle: Global -> Off -> Standard -> Strict</div>
                    <div class="row q-gutter-xs">
                      <q-chip
                        v-for="rule in protectionRuleOptions"
                        :key="rule.key"
                        :color="getVoiceRuleOverrideColor(voice, rule.key)"
                        :text-color="getVoiceRuleOverrideTextColor(voice, rule.key)"
                        clickable
                        dense
                        size="sm"
                        @click="cycleVoiceRuleOverride(voice, rule.key)"
                      >
                        {{ rule.label }}
                        <span v-if="getVoiceRuleOverrideLabel(voice, rule.key)" class="q-ml-xs text-weight-bold">
                          {{ getVoiceRuleOverrideLabel(voice, rule.key) }}
                        </span>
                        <q-icon v-else :name="getVoiceRuleOverrideIcon(voice, rule.key)" size="xs" class="q-ml-xs" />
                        <q-tooltip>{{ rule.description }}</q-tooltip>
                      </q-chip>
                    </div>
                    <div class="text-caption text-grey-6 q-mt-xs">
                      <q-icon name="settings" size="xs" /> = Global &nbsp;
                      <span class="text-negative">OFF</span> = Disabled &nbsp;
                      <span class="text-primary">STD</span> = Standard &nbsp;
                      <span class="text-deep-orange">MAX</span> = Strict
                    </div>
                  </div>

                  <q-separator class="q-my-md" />

                  <!-- Profanity Override -->
                  <div>
                    <div class="text-subtitle2 q-mb-sm">Profanity Handling</div>
                    <q-btn-toggle
                      :model-value="getVoiceProfanityMode(voice)"
                      :options="[
                        { label: 'Use Global', value: 'inherit' },
                        { label: 'Block', value: 'block' },
                        { label: 'Replace', value: 'replace' },
                        { label: 'Allow', value: 'allow' }
                      ]"
                      color="grey-8"
                      toggle-color="primary"
                      unelevated
                      rounded
                      size="sm"
                      @update:model-value="setVoiceProfanityMode(voice, $event)"
                    />

                    <!-- Profanity details (when not inherit) -->
                    <div v-if="getVoiceProfanityMode(voice) !== 'inherit'" class="q-mt-sm q-ml-md">
                      <!-- Replacement word -->
                      <div v-if="getVoiceProfanityMode(voice) === 'replace'" class="row items-center q-gutter-sm q-mb-sm">
                        <span class="text-caption text-grey-5">Replace with:</span>
                        <q-input
                          :model-value="getVoiceProfanityReplacementWord(voice)"
                          outlined
                          dense
                          style="max-width: 120px"
                          @update:model-value="setVoiceProfanityReplacementWord(voice, $event)"
                        />
                      </div>

                      <!-- Strictness level (when not allow) -->
                      <div v-if="getVoiceProfanityMode(voice) !== 'allow'" class="row items-center q-gutter-sm q-mb-sm">
                        <span class="text-caption text-grey-5">Strictness:</span>
                        <q-btn-toggle
                          :model-value="getVoiceProfanityLevel(voice)"
                          :options="[
                            { label: 'Standard', value: 'standard' },
                            { label: 'Strict', value: 'strict' }
                          ]"
                          color="grey-8"
                          toggle-color="primary"
                          unelevated
                          rounded
                          size="sm"
                          @update:model-value="setVoiceProfanityLevel(voice, $event)"
                        />
                      </div>

                      <!-- Exception words -->
                      <div v-if="getVoiceProfanityMode(voice) !== 'allow'" class="row items-center q-gutter-sm">
                        <span class="text-caption text-grey-5">Allowed words:</span>
                        <q-chip
                          v-for="(word, idx) in getVoiceProfanityExceptions(voice)"
                          :key="idx"
                          color="green-8"
                          text-color="white"
                          removable
                          dense
                          size="sm"
                          @remove="removeVoiceProfanityException(voice, idx)"
                        >
                          {{ word }}
                        </q-chip>
                        <q-btn flat dense round icon="add" color="primary" size="sm" @click="openAddProfanityExceptionDialog(voice)" />
                      </div>
                    </div>
                  </div>

                  <q-separator class="q-my-md" />

                  <!-- Blocked Topics Override -->
                  <div>
                    <div class="text-subtitle2 q-mb-sm">Blocked Topics</div>
                    <q-btn-toggle
                      :model-value="getVoiceBlockedTopicsMode(voice)"
                      :options="[
                        { label: 'Use Global', value: 'inherit' },
                        { label: 'Add to Global', value: 'additive' },
                        { label: 'Override', value: 'override' }
                      ]"
                      color="grey-8"
                      toggle-color="primary"
                      unelevated
                      rounded
                      size="sm"
                      @update:model-value="setVoiceBlockedTopicsMode(voice, $event)"
                    />
                    <div class="text-caption text-grey-6 q-mt-xs">
                      <span v-if="getVoiceBlockedTopicsMode(voice) === 'inherit'">Using global blocked topics list.</span>
                      <span v-else-if="getVoiceBlockedTopicsMode(voice) === 'additive'">Global topics + voice-specific topics below.</span>
                      <span v-else>Only topics selected below (ignores global).</span>
                    </div>

                    <!-- Topic selection (when not inherit) -->
                    <div v-if="getVoiceBlockedTopicsMode(voice) !== 'inherit'" class="q-mt-sm">
                      <div class="row q-gutter-xs q-mb-sm">
                        <q-chip
                          v-for="topic in topicPresets"
                          :key="topic.key"
                          :color="isVoiceTopicBlocked(voice, topic.key) ? 'orange' : 'grey-8'"
                          :text-color="isVoiceTopicBlocked(voice, topic.key) ? 'white' : 'grey-5'"
                          clickable
                          dense
                          size="sm"
                          @click="toggleVoiceBlockedTopic(voice, topic.key)"
                        >
                          {{ topic.label }}
                          <q-tooltip>{{ topic.description }}</q-tooltip>
                        </q-chip>
                      </div>
                      <!-- Custom topics for this voice -->
                      <div class="row items-center q-gutter-sm">
                        <span class="text-caption text-grey-5">Custom:</span>
                        <q-chip
                          v-for="(topic, idx) in getVoiceCustomBlockedTopics(voice)"
                          :key="idx"
                          color="deep-orange"
                          text-color="white"
                          removable
                          dense
                          size="sm"
                          @remove="removeVoiceCustomBlockedTopic(voice, idx)"
                        >
                          {{ topic }}
                        </q-chip>
                        <q-btn flat dense round icon="add" color="primary" size="sm" @click="openAddBlockedTopicDialog(voice)" />
                      </div>
                    </div>
                  </div>

                  <q-separator class="q-my-md" />

                  <!-- Custom Instructions Override -->
                  <div>
                    <div class="text-subtitle2 q-mb-sm">Custom AI Instructions</div>
                    <q-btn-toggle
                      :model-value="getVoiceCustomInstructionsMode(voice)"
                      :options="[
                        { label: 'Use Global', value: 'inherit' },
                        { label: 'Append', value: 'append' },
                        { label: 'Override', value: 'override' }
                      ]"
                      color="grey-8"
                      toggle-color="primary"
                      unelevated
                      rounded
                      size="sm"
                      @update:model-value="setVoiceCustomInstructionsMode(voice, $event)"
                    />
                    <div class="text-caption text-grey-6 q-mt-xs">
                      <span v-if="getVoiceCustomInstructionsMode(voice) === 'inherit'">Using global custom instructions.</span>
                      <span v-else-if="getVoiceCustomInstructionsMode(voice) === 'append'">Global instructions + voice-specific below.</span>
                      <span v-else>Only voice-specific instructions (ignores global).</span>
                    </div>

                    <q-input
                      v-if="getVoiceCustomInstructionsMode(voice) !== 'inherit'"
                      :model-value="getVoiceCustomInstructionsText(voice)"
                      outlined
                      type="textarea"
                      autogrow
                      dense
                      class="q-mt-sm"
                      placeholder="Voice-specific AI instructions..."
                      @update:model-value="setVoiceCustomInstructionsText(voice, $event)"
                    />
                  </div>

                  <q-separator class="q-my-md" />

                  <!-- On Failure Override -->
                  <div>
                    <div class="text-subtitle2 q-mb-sm">When Moderation Fails (API Error)</div>
                    <q-btn-toggle
                      :model-value="getVoiceOnFailureMode(voice)"
                      :options="[
                        { label: 'Use Global', value: 'inherit' },
                        { label: 'Block', value: 'block' },
                        { label: 'Allow', value: 'skip' }
                      ]"
                      color="grey-8"
                      toggle-color="primary"
                      unelevated
                      rounded
                      size="sm"
                      @update:model-value="setVoiceOnFailureMode(voice, $event)"
                    />
                    <div class="text-caption text-grey-6 q-mt-xs">
                      <span v-if="getVoiceOnFailureMode(voice) === 'inherit'">Using global failure behavior.</span>
                      <span v-else-if="getVoiceOnFailureMode(voice) === 'block'">Block message if moderation API fails (safer).</span>
                      <span v-else>Allow message through if moderation API fails.</span>
                    </div>
                  </div>
                </div>
              </div>
            </q-tab-panel>
          </q-tab-panels>
        </q-card>
      </q-expansion-item>
    </q-list>

    <!-- Add/Edit Voice Dialog -->
    <q-dialog v-model="showDialog" persistent>
      <q-card style="min-width: 500px; max-width: 600px">
        <q-card-section>
          <div class="text-h6">{{ isEditing ? 'Edit Voice' : 'Add Voice' }}</div>
        </q-card-section>

        <q-card-section class="q-gutter-md">
          <q-input
            v-model="editingVoice.alias"
            outlined
            label="Alias *"
            hint="Unique name to reference this voice (e.g., 'narrator', 'excited')"
          />

          <q-select
            v-model="editingVoice.elevenLabsVoiceId"
            :options="availableVoices"
            :loading="loadingVoices"
            outlined
            label="ElevenLabs Voice *"
            option-value="voice_id"
            option-label="name"
            emit-value
            map-options
          >
            <template v-slot:option="{ opt, selected, toggleOption }">
              <q-item clickable @click="toggleOption(opt)">
                <q-item-section>
                  <q-item-label>{{ opt.name }}</q-item-label>
                  <q-item-label caption>{{ opt.category }} - {{ opt.voice_id }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-icon v-if="selected" name="check" color="primary" />
                </q-item-section>
              </q-item>
            </template>
          </q-select>

          <q-select
            v-model="editingVoice.elevenLabsModelId"
            :options="modelOptions"
            :loading="loadingModels"
            outlined
            label="Model"
            option-value="value"
            option-label="label"
            emit-value
            map-options
          >
            <template v-slot:option="{ opt, selected, toggleOption }">
              <q-item clickable @click="toggleOption(opt)">
                <q-item-section>
                  <q-item-label>{{ opt.label }}</q-item-label>
                  <q-item-label caption>{{ opt.description }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-icon v-if="selected" name="check" color="primary" />
                </q-item-section>
              </q-item>
            </template>
          </q-select>

          <!-- Voice Settings -->
          <div class="text-subtitle2 q-mt-md q-mb-sm">Voice Settings</div>

          <!-- Stability Slider -->
          <div class="q-mb-md">
            <div class="row items-center justify-between">
              <span class="text-body2">Stability</span>
              <span class="text-caption text-grey">{{ editingVoice.stability.toFixed(2) }}</span>
            </div>
            <q-slider v-model="editingVoice.stability" :min="0" :max="1" :step="0.05" color="primary" />
            <div class="row justify-between text-caption text-grey-6">
              <span>More variable</span>
              <span>More stable</span>
            </div>
          </div>

          <!-- Similarity Boost Slider -->
          <div class="q-mb-md">
            <div class="row items-center justify-between">
              <span class="text-body2">Clarity + Similarity</span>
              <span class="text-caption text-grey">{{ editingVoice.similarityBoost.toFixed(2) }}</span>
            </div>
            <q-slider v-model="editingVoice.similarityBoost" :min="0" :max="1" :step="0.05" color="primary" />
            <div class="row justify-between text-caption text-grey-6">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>

          <!-- Style Slider (only for eleven_multilingual_v2) -->
          <div class="q-mb-md">
            <div class="row items-center justify-between">
              <span class="text-body2">
                Style Exaggeration
                <q-icon v-if="!isStyleSupported" name="info" color="grey" size="xs" class="q-ml-xs">
                  <q-tooltip>Only available for Multilingual v2 model</q-tooltip>
                </q-icon>
              </span>
              <span class="text-caption text-grey">{{ editingVoice.style.toFixed(2) }}</span>
            </div>
            <q-slider v-model="editingVoice.style" :min="0" :max="1" :step="0.05" :disable="!isStyleSupported" :color="isStyleSupported ? 'primary' : 'grey'" />
            <div class="row justify-between text-caption text-grey-6">
              <span>None (faster)</span>
              <span>Exaggerated</span>
            </div>
          </div>

          <!-- Speed Slider -->
          <div class="q-mb-md">
            <div class="row items-center justify-between">
              <span class="text-body2">Speed</span>
              <span class="text-caption text-grey">{{ editingVoice.speed.toFixed(2) }}x</span>
            </div>
            <q-slider v-model="editingVoice.speed" :min="0.5" :max="2.0" :step="0.05" color="primary" />
            <div class="row justify-between text-caption text-grey-6">
              <span>0.5x (slow)</span>
              <span>1.0x</span>
              <span>2.0x (fast)</span>
            </div>
          </div>

          <!-- Volume Override -->
          <div class="q-mb-md">
            <div class="row items-center justify-between">
              <q-checkbox
                v-model="editingVoice.volumeEnabled"
                label="Volume Override"
                dense
              />
              <span v-if="editingVoice.volumeEnabled" class="text-caption text-grey">{{ editingVoice.volume }}%</span>
              <span v-else class="text-caption text-grey">Using global</span>
            </div>
            <q-slider
              v-if="editingVoice.volumeEnabled"
              v-model="editingVoice.volume"
              :min="0"
              :max="200"
              :step="5"
              color="primary"
              class="q-mt-xs"
            />
            <div v-if="editingVoice.volumeEnabled" class="row justify-between text-caption text-grey-6">
              <span>Mute</span>
              <span>100%</span>
              <span>200%</span>
            </div>
          </div>

          <!-- Speaker Boost Toggle -->
          <q-toggle v-model="editingVoice.useSpeakerBoost" label="Speaker Boost" color="primary">
            <q-tooltip>Enhances similarity to original voice. Slightly increases latency.</q-tooltip>
          </q-toggle>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" v-close-popup />
          <q-btn flat :label="isEditing ? 'Save' : 'Add'" color="primary" @click="saveVoice" :disable="!editingVoice.alias || !editingVoice.elevenLabsVoiceId" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Test Voice Dialog -->
    <q-dialog v-model="showTestDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Test Voice: {{ testingVoice?.alias }}</div>
          <div class="text-caption text-grey">
            {{ getVoiceName(testingVoice?.elevenLabsVoiceId) }} &bull; {{ getModelName(testingVoice?.elevenLabsModelId) }}
          </div>
        </q-card-section>

        <q-card-section>
          <q-input v-model="testText" outlined autofocus label="Enter text to speak" placeholder="Hello, this is a voice test!" :disable="isTestingVoice" @keyup.enter="runVoiceTest" />
        </q-card-section>

        <q-card-section v-if="testError" class="q-pt-none">
          <q-banner dense class="bg-negative text-white">{{ testError }}</q-banner>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Close" color="grey" v-close-popup :disable="isTestingVoice" />
          <q-btn :loading="isTestingVoice" :icon="isPlayingTest ? 'stop' : 'play_arrow'" :label="isPlayingTest ? 'Stop' : 'Play'" :color="isPlayingTest ? 'negative' : 'primary'" @click="isPlayingTest ? stopVoiceTest() : runVoiceTest()" :disable="!testText.trim()" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Hidden audio element for test playback -->
    <audio ref="testAudioPlayer" @ended="onTestAudioEnded" @error="onTestAudioError"></audio>

    <!-- Voice Rule Dialog -->
    <q-dialog v-model="showVoiceRuleDialog" persistent>
      <q-card style="min-width: 450px">
        <q-card-section>
          <div class="text-h6">{{ isEditingVoiceRule ? 'Edit Rule' : 'Add Rule' }} - {{ editingVoiceAlias }}</div>
        </q-card-section>

        <q-card-section class="q-gutter-md">
          <q-input v-model="editingVoiceRule.pattern" outlined label="Pattern *" :hint="editingVoiceRule.isRegex ? 'Regular expression pattern' : 'Text to find (plain text)'" :error="!!voiceRulePatternError" :error-message="voiceRulePatternError" @update:model-value="validateVoiceRulePattern" />
          <q-input v-model="editingVoiceRule.replacement" outlined label="Replacement" hint="Leave empty to remove matched text" />
          <div class="row q-gutter-md">
            <q-toggle v-model="editingVoiceRule.isRegex" label="Use Regular Expression" @update:model-value="validateVoiceRulePattern" />
            <q-toggle v-model="editingVoiceRule.caseSensitive" label="Case Sensitive" />
          </div>
          <q-toggle v-model="editingVoiceRule.enabled" label="Enabled" />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" v-close-popup />
          <q-btn flat :label="isEditingVoiceRule ? 'Save' : 'Add'" color="primary" :disable="!editingVoiceRule.pattern || !!voiceRulePatternError" @click="saveVoiceRule" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Add Profanity Exception Dialog -->
    <q-dialog v-model="showAddProfanityExceptionDialog">
      <q-card style="min-width: 300px">
        <q-card-section>
          <div class="text-h6">Add Allowed Word</div>
        </q-card-section>
        <q-card-section>
          <q-input v-model="newProfanityException" outlined label="Word to allow" placeholder="e.g., damn" autofocus @keyup.enter="addProfanityException" />
          <div class="text-caption text-grey-6 q-mt-sm">This word won't be blocked or replaced for this voice.</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" label="Add" :disable="!newProfanityException.trim()" @click="addProfanityException" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Add Blocked Topic Dialog -->
    <q-dialog v-model="showAddBlockedTopicDialog">
      <q-card style="min-width: 300px">
        <q-card-section>
          <div class="text-h6">Add Blocked Topic</div>
        </q-card-section>
        <q-card-section>
          <q-input v-model="newBlockedTopic" outlined label="Topic to block" placeholder="e.g., my ex" autofocus @keyup.enter="addBlockedTopic" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" label="Add" :disable="!newBlockedTopic.trim()" @click="addBlockedTopic" />
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

// Voice settings tab state (per-voice)
const voiceSettingsTab = ref({})

// Initialize tab state for each voice
watch(() => props.settings.voices, (voices) => {
  if (voices) {
    for (const voice of voices) {
      if (!voiceSettingsTab.value[voice.alias]) {
        voiceSettingsTab.value[voice.alias] = 'text'
      }
    }
  }
}, { immediate: true, deep: true })

const showDialog = ref(false)
const isEditing = ref(false)
const originalAlias = ref('')
const editingVoice = ref({
  alias: '',
  elevenLabsVoiceId: '',
  elevenLabsModelId: 'eleven_multilingual_v2',
  stability: 0.5,
  similarityBoost: 0.75,
  useSpeakerBoost: true,
  style: 0,
  speed: 1.0,
  volumeEnabled: false,
  volume: 100
})

const availableVoices = ref([])
const loadingVoices = ref(false)
const modelOptions = ref([])
const loadingModels = ref(false)

// OpenAI models for voice overrides
const openAIModels = ref([])
const loadingOpenAIModels = ref(false)

// Test voice dialog state
const showTestDialog = ref(false)
const testingVoice = ref(null)
const testText = ref('Hello, this is a voice test!')
const isTestingVoice = ref(false)
const isPlayingTest = ref(false)
const testError = ref('')
const testAudioPlayer = ref(null)

// Voice rule dialog state
const showVoiceRuleDialog = ref(false)
const isEditingVoiceRule = ref(false)
const editingVoiceAlias = ref('')
const editingVoiceRuleIndex = ref(-1)
const editingVoiceRule = ref({
  id: '',
  pattern: '',
  replacement: '',
  isRegex: false,
  caseSensitive: false,
  enabled: true
})
const voiceRulePatternError = ref('')

// Voice text processing test state
const voiceTestInputs = ref({})
const voiceTestResults = ref({})

// New dialog states
const showAddProfanityExceptionDialog = ref(false)
const newProfanityException = ref('')
const currentProfanityExceptionVoice = ref(null)

const showAddBlockedTopicDialog = ref(false)
const newBlockedTopic = ref('')
const currentBlockedTopicVoice = ref(null)

// Protection rules that can be overridden per-voice
const protectionRuleOptions = [
  { key: 'sexualContent', label: 'Sexual', description: 'Block explicit sexual content', category: 'safety' },
  { key: 'hateSpeech', label: 'Hate', description: 'Block hate speech and slurs', category: 'safety' },
  { key: 'violence', label: 'Violence', description: 'Block violence and threats', category: 'safety' },
  { key: 'doxxing', label: 'Doxxing', description: 'Block personal info leaks', category: 'safety' },
  { key: 'misinformation', label: 'Misinfo', description: 'Block dangerous misinformation', category: 'safety' },
  { key: 'songLyrics', label: 'Lyrics', description: 'Block song lyrics (HIGH risk)', category: 'copyright' },
  { key: 'mediaQuotes', label: 'Media', description: 'Block movie/TV/book quotes (MEDIUM risk)', category: 'copyright' },
  { key: 'gamingCulture', label: 'Gaming', description: 'Block game dialogue (LOW risk)', category: 'copyright' }
]

// Topic presets for blocked topics
const topicPresets = [
  { key: 'politics', label: 'Politics', description: 'Political parties, elections, government' },
  { key: 'religion', label: 'Religion', description: 'Religious beliefs and debates' },
  { key: 'streamerDrama', label: 'Drama', description: 'Controversies involving creators' },
  { key: 'spoilers', label: 'Spoilers', description: 'Plot spoilers, backseating' },
  { key: 'traumaDumping', label: 'Trauma', description: 'Heavy personal trauma' },
  { key: 'cryptoFinance', label: 'Crypto', description: 'Cryptocurrency, NFTs' },
  { key: 'consoleWars', label: 'Console Wars', description: 'Platform tribalism' },
  { key: 'bodyImage', label: 'Body Image', description: 'Comments about appearance' },
  { key: 'relationshipStatus', label: 'Relationships', description: 'Dating questions' },
  { key: 'ageLocation', label: 'Age/Location', description: 'Personal identifying info' },
  { key: 'competitorMentions', label: 'Competitors', description: 'Promoting other channels' },
  { key: 'realWorldTragedies', label: 'Tragedies', description: 'Current disasters' }
]

const voices = computed(() => props.settings.voices || [])

const isStyleSupported = computed(() => {
  return editingVoice.value.elevenLabsModelId === 'eleven_multilingual_v2'
})

// ============ BADGE HELPERS ============

function hasAnyTextOverride(voice) {
  return voice.ignoreSanitization || voice.allowZalgoText || voice.allowEmojis ||
         voice.ignoreGlobalReplacements ||
         voice.replacements?.length > 0 || voice.ignoreMaxMessageLength ||
         voice.maxMessageLengthOverride
}

function hasAnyAIOverride(voice) {
  return voice.allowUserBracketTags || voice.gptProcessingOverride || voice.openAIModelOverride
}

function hasAnySafetyOverride(voice) {
  const override = voice.gptProcessingOverride?.contentModeration
  if (!override) return false
  return override.rules || override.profanity || override.blockedTopics ||
         override.customInstructions || override.onFailure
}

// ============ WATCHERS ============

watch(() => props.settings.elevenLabsApiKey, (newKey) => {
  if (newKey) {
    loadAvailableVoices()
    loadAvailableModels()
  }
}, { immediate: true })

watch(() => props.settings.chatGptApiKey, (newKey) => {
  if (newKey) {
    loadOpenAIModels()
  }
}, { immediate: true })

// ============ LOAD FUNCTIONS ============

async function loadAvailableVoices() {
  if (!props.settings.elevenLabsApiKey) return
  loadingVoices.value = true
  try {
    const voices = await window.electronAPI.getVoices()
    availableVoices.value = voices.sort((a, b) => a.name.localeCompare(b.name))
  } catch (error) {
    console.error('Failed to load voices:', error)
    $q.notify({ type: 'negative', message: `Failed to load voices: ${error.message}` })
  } finally {
    loadingVoices.value = false
  }
}

async function loadAvailableModels() {
  if (!props.settings.elevenLabsApiKey) return
  loadingModels.value = true
  try {
    const models = await window.electronAPI.getModels()
    modelOptions.value = models.map(model => ({
      label: model.name,
      value: model.model_id,
      description: model.description
    }))
  } catch (error) {
    console.error('Failed to load models:', error)
    modelOptions.value = [{ label: 'Eleven Multilingual v2', value: 'eleven_multilingual_v2', description: 'Default model' }]
  } finally {
    loadingModels.value = false
  }
}

async function loadOpenAIModels() {
  loadingOpenAIModels.value = true
  try {
    openAIModels.value = await window.electronAPI.getOpenAIModels()
  } catch (error) {
    console.error('Failed to load OpenAI models:', error)
    openAIModels.value = []
  } finally {
    loadingOpenAIModels.value = false
  }
}

// ============ VOICE CRUD ============

function openAddDialog() {
  isEditing.value = false
  const defaultModel = modelOptions.value.length > 0 ? modelOptions.value[0].value : 'eleven_multilingual_v2'
  editingVoice.value = {
    alias: '',
    elevenLabsVoiceId: '',
    elevenLabsModelId: defaultModel,
    stability: 0.5,
    similarityBoost: 0.75,
    useSpeakerBoost: true,
    style: 0,
    speed: 1.0,
    volumeEnabled: false,
    volume: 100
  }
  showDialog.value = true
}

function openEditDialog(voice) {
  isEditing.value = true
  originalAlias.value = voice.alias
  editingVoice.value = {
    alias: voice.alias,
    elevenLabsVoiceId: voice.elevenLabsVoiceId,
    elevenLabsModelId: voice.elevenLabsModelId || 'eleven_multilingual_v2',
    stability: voice.stability ?? 0.5,
    similarityBoost: voice.similarityBoost ?? 0.75,
    useSpeakerBoost: voice.useSpeakerBoost ?? true,
    style: voice.style ?? 0,
    speed: voice.speed ?? 1.0,
    volumeEnabled: voice.volume != null,
    volume: voice.volume ?? 100
  }
  showDialog.value = true
}

function saveVoice() {
  const currentVoices = props.settings.voices || []
  const newVoices = JSON.parse(JSON.stringify(currentVoices))
  const newAlias = editingVoice.value.alias.trim()

  // Convert volumeEnabled UI state to stored volume value
  const voiceData = { ...toRaw(editingVoice.value) }
  if (voiceData.volumeEnabled) {
    voiceData.volume = voiceData.volume ?? 100
  } else {
    delete voiceData.volume
  }
  delete voiceData.volumeEnabled

  if (!newAlias) {
    $q.notify({ type: 'warning', message: 'Alias cannot be empty' })
    return
  }

  if (isEditing.value) {
    const originalIndex = newVoices.findIndex(v => v.alias === originalAlias.value)
    if (newAlias !== originalAlias.value) {
      const conflictIndex = newVoices.findIndex(v => v.alias === newAlias)
      if (conflictIndex !== -1) {
        $q.notify({ type: 'warning', message: 'A voice with this alias already exists' })
        return
      }
    }
    if (originalIndex !== -1) {
      newVoices[originalIndex] = JSON.parse(JSON.stringify({ ...voiceData, alias: newAlias }))
    }
    if (props.settings.defaultVoiceAlias === originalAlias.value && newAlias !== originalAlias.value) {
      emit('update', 'defaultVoiceAlias', newAlias)
    }
  } else {
    const existingIndex = newVoices.findIndex(v => v.alias === newAlias)
    if (existingIndex !== -1) {
      $q.notify({ type: 'warning', message: 'A voice with this alias already exists' })
      return
    }
    newVoices.push(JSON.parse(JSON.stringify({ ...voiceData, alias: newAlias })))
    if (newVoices.length === 1) {
      emit('update', 'defaultVoiceAlias', newAlias)
    }
  }

  emit('update', 'voices', newVoices)
  showDialog.value = false
  $q.notify({ type: 'positive', message: `Voice ${isEditing.value ? 'updated' : 'added'} successfully` })
}

function deleteVoice(alias) {
  $q.dialog({
    title: 'Delete Voice',
    message: `Are you sure you want to delete the voice "${alias}"?`,
    cancel: true
  }).onOk(() => {
    const currentVoices = props.settings.voices || []
    const newVoices = JSON.parse(JSON.stringify(currentVoices.filter(v => v.alias !== alias)))
    emit('update', 'voices', newVoices)
    if (props.settings.defaultVoiceAlias === alias) {
      emit('update', 'defaultVoiceAlias', newVoices.length > 0 ? newVoices[0].alias : '')
    }
    $q.notify({ type: 'positive', message: 'Voice deleted' })
  })
}

function setAsDefault(alias) {
  emit('update', 'defaultVoiceAlias', alias)
  $q.notify({ type: 'positive', message: `"${alias}" set as default voice` })
}

// ============ VOICE TEST FUNCTIONS ============

function openTestDialog(voice) {
  testingVoice.value = voice
  testError.value = ''
  isTestingVoice.value = false
  isPlayingTest.value = false
  showTestDialog.value = true
}

async function runVoiceTest() {
  if (!testText.value.trim() || !testingVoice.value) return
  isTestingVoice.value = true
  testError.value = ''

  try {
    const audioBase64 = await window.electronAPI.testTTS({
      text: testText.value.trim(),
      voiceId: testingVoice.value.elevenLabsVoiceId,
      modelId: testingVoice.value.elevenLabsModelId,
      settings: {
        stability: testingVoice.value.stability,
        similarityBoost: testingVoice.value.similarityBoost,
        useSpeakerBoost: testingVoice.value.useSpeakerBoost,
        style: testingVoice.value.style,
        speed: testingVoice.value.speed
      }
    })
    playTestAudio(audioBase64)
  } catch (error) {
    console.error('Voice test error:', error)
    testError.value = error.message
    isTestingVoice.value = false
  }
}

function playTestAudio(audioBase64) {
  const audio = testAudioPlayer.value
  if (!audio) return
  const byteCharacters = atob(audioBase64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  const blob = new Blob([byteArray], { type: 'audio/mpeg' })
  const url = URL.createObjectURL(blob)
  audio.src = url
  isTestingVoice.value = false
  isPlayingTest.value = true
  audio.play().catch(error => {
    console.error('Audio playback error:', error)
    testError.value = 'Failed to play audio: ' + error.message
    isPlayingTest.value = false
    URL.revokeObjectURL(url)
  })
}

function stopVoiceTest() {
  const audio = testAudioPlayer.value
  if (audio) {
    audio.pause()
    audio.currentTime = 0
    if (audio.src) {
      URL.revokeObjectURL(audio.src)
      audio.src = ''
    }
  }
  isPlayingTest.value = false
}

function onTestAudioEnded() {
  isPlayingTest.value = false
  const audio = testAudioPlayer.value
  if (audio?.src) URL.revokeObjectURL(audio.src)
}

function onTestAudioError(event) {
  console.error('Test audio error:', event)
  testError.value = 'Audio playback failed'
  isPlayingTest.value = false
}

function getVoiceName(voiceId) {
  const voice = availableVoices.value.find(v => v.voice_id === voiceId)
  return voice?.name || voiceId?.substring(0, 12) + '...' || 'Unknown'
}

function getModelName(modelId) {
  const model = modelOptions.value.find(m => m.value === modelId)
  if (model) return model.label
  const fallbacks = {
    'eleven_multilingual_v2': 'Multilingual v2',
    'eleven_turbo_v2_5': 'Turbo v2.5',
    'eleven_turbo_v2': 'Turbo v2',
    'eleven_monolingual_v1': 'Monolingual v1',
    'eleven_multilingual_v1': 'Multilingual v1'
  }
  return fallbacks[modelId] || modelId || 'Unknown'
}

// ============ VOICE UPDATE HELPER ============

function updateVoice(voice, updates) {
  const currentVoices = props.settings.voices || []
  const newVoices = JSON.parse(JSON.stringify(currentVoices))
  const index = newVoices.findIndex(v => v.alias === voice.alias)
  if (index !== -1) {
    newVoices[index] = { ...newVoices[index], ...updates }
    emit('update', 'voices', newVoices)
  }
}

// Clean up empty nested objects and return final gptProcessingOverride value
function cleanupGptOverride(override) {
  if (!override) return null
  // Clean up empty contentModeration
  if (override.contentModeration && Object.keys(override.contentModeration).length === 0) {
    delete override.contentModeration
  }
  // Return null if entire override is empty
  return Object.keys(override).length > 0 ? override : null
}

// ============ TEXT PROCESSING FUNCTIONS ============

function toggleIgnoreSanitization(voice, value) {
  updateVoice(voice, { ignoreSanitization: value })
}

function toggleAllowZalgoText(voice, value) {
  updateVoice(voice, { allowZalgoText: value })
}

function toggleAllowEmojis(voice, value) {
  updateVoice(voice, { allowEmojis: value })
}

function toggleIgnoreGlobal(voice, value) {
  updateVoice(voice, { ignoreGlobalReplacements: value })
}

function toggleIgnoreMaxLength(voice, value) {
  updateVoice(voice, {
    ignoreMaxMessageLength: value,
    maxMessageLengthOverride: value ? null : voice.maxMessageLengthOverride
  })
}

function toggleMaxLengthOverride(voice, enabled) {
  if (enabled) {
    updateVoice(voice, {
      maxMessageLengthOverride: {
        characters: { enabled: false, value: 500 },
        words: { enabled: false, value: 50 }
      }
    })
  } else {
    updateVoice(voice, { maxMessageLengthOverride: null })
  }
}

function getVoiceMaxLengthWithDefaults(voice) {
  const override = voice.maxMessageLengthOverride || {}
  return {
    characters: { enabled: override.characters?.enabled ?? false, value: override.characters?.value ?? 500 },
    words: { enabled: override.words?.enabled ?? false, value: override.words?.value ?? 50 }
  }
}

function updateVoiceCharLimitEnabled(voice, enabled) {
  if (voice.maxMessageLengthOverride) {
    const current = getVoiceMaxLengthWithDefaults(voice)
    current.characters.enabled = enabled
    updateVoice(voice, { maxMessageLengthOverride: current })
  }
}

function updateVoiceCharLimitValue(voice, value) {
  const numValue = parseInt(value, 10)
  if (numValue > 0 && voice.maxMessageLengthOverride) {
    const current = getVoiceMaxLengthWithDefaults(voice)
    current.characters.value = numValue
    updateVoice(voice, { maxMessageLengthOverride: current })
  }
}

function updateVoiceWordLimitEnabled(voice, enabled) {
  if (voice.maxMessageLengthOverride) {
    const current = getVoiceMaxLengthWithDefaults(voice)
    current.words.enabled = enabled
    updateVoice(voice, { maxMessageLengthOverride: current })
  }
}

function updateVoiceWordLimitValue(voice, value) {
  const numValue = parseInt(value, 10)
  if (numValue > 0 && voice.maxMessageLengthOverride) {
    const current = getVoiceMaxLengthWithDefaults(voice)
    current.words.value = numValue
    updateVoice(voice, { maxMessageLengthOverride: current })
  }
}

// ============ VOICE REPLACEMENT RULES ============

function openVoiceRuleDialog(voice, rule = null, ruleIndex = -1) {
  editingVoiceAlias.value = voice.alias
  isEditingVoiceRule.value = rule !== null
  editingVoiceRuleIndex.value = ruleIndex
  if (rule) {
    editingVoiceRule.value = { ...rule }
  } else {
    editingVoiceRule.value = { id: uuidv4(), pattern: '', replacement: '', isRegex: false, caseSensitive: false, enabled: true }
  }
  voiceRulePatternError.value = ''
  showVoiceRuleDialog.value = true
}

async function validateVoiceRulePattern() {
  if (!editingVoiceRule.value.pattern) {
    voiceRulePatternError.value = ''
    return
  }
  if (editingVoiceRule.value.isRegex) {
    const result = await window.electronAPI.validateRegexPattern(editingVoiceRule.value.pattern)
    voiceRulePatternError.value = result.valid ? '' : result.error
  } else {
    voiceRulePatternError.value = ''
  }
}

function saveVoiceRule() {
  const currentVoices = props.settings.voices || []
  const newVoices = JSON.parse(JSON.stringify(currentVoices))
  const voiceIndex = newVoices.findIndex(v => v.alias === editingVoiceAlias.value)
  if (voiceIndex === -1) return
  if (!newVoices[voiceIndex].replacements) newVoices[voiceIndex].replacements = []
  if (isEditingVoiceRule.value) {
    newVoices[voiceIndex].replacements[editingVoiceRuleIndex.value] = { ...editingVoiceRule.value }
  } else {
    newVoices[voiceIndex].replacements.push({ ...editingVoiceRule.value })
  }
  emit('update', 'voices', newVoices)
  showVoiceRuleDialog.value = false
  $q.notify({ type: 'positive', message: `Rule ${isEditingVoiceRule.value ? 'updated' : 'added'} successfully` })
}

function toggleVoiceRule(voice, ruleIndex, enabled) {
  const currentVoices = props.settings.voices || []
  const newVoices = JSON.parse(JSON.stringify(currentVoices))
  const voiceIndex = newVoices.findIndex(v => v.alias === voice.alias)
  if (voiceIndex !== -1 && newVoices[voiceIndex].replacements?.[ruleIndex]) {
    newVoices[voiceIndex].replacements[ruleIndex].enabled = enabled
    emit('update', 'voices', newVoices)
  }
}

function moveVoiceRule(voice, ruleIndex, direction) {
  const newIndex = ruleIndex + direction
  const currentVoices = props.settings.voices || []
  const newVoices = JSON.parse(JSON.stringify(currentVoices))
  const voiceIndex = newVoices.findIndex(v => v.alias === voice.alias)
  if (voiceIndex === -1 || !newVoices[voiceIndex].replacements) return
  if (newIndex < 0 || newIndex >= newVoices[voiceIndex].replacements.length) return
  const [removed] = newVoices[voiceIndex].replacements.splice(ruleIndex, 1)
  newVoices[voiceIndex].replacements.splice(newIndex, 0, removed)
  emit('update', 'voices', newVoices)
}

function deleteVoiceRule(voice, ruleIndex) {
  $q.dialog({ title: 'Delete Rule', message: 'Are you sure you want to delete this rule?', cancel: true }).onOk(() => {
    const currentVoices = props.settings.voices || []
    const newVoices = JSON.parse(JSON.stringify(currentVoices))
    const voiceIndex = newVoices.findIndex(v => v.alias === voice.alias)
    if (voiceIndex !== -1 && newVoices[voiceIndex].replacements) {
      newVoices[voiceIndex].replacements.splice(ruleIndex, 1)
      emit('update', 'voices', newVoices)
      $q.notify({ type: 'positive', message: 'Rule deleted' })
    }
  })
}

async function runVoiceTextTest(alias) {
  const input = voiceTestInputs.value[alias]
  if (!input) {
    voiceTestResults.value[alias] = null
    return
  }
  try {
    const result = await window.electronAPI.testTextProcessing(input, alias)
    voiceTestResults.value[alias] = result
  } catch (error) {
    voiceTestResults.value[alias] = {
      processedText: input,
      wasModified: false,
      charCount: input.length,
      wordCount: input.split(/\s+/).filter(Boolean).length
    }
  }
}

// ============ AI PROCESSING FUNCTIONS ============

function toggleIgnoreGPTProcessing(voice, value) {
  updateVoice(voice, { ignoreGPTProcessing: value })
}

function toggleAllowUserBracketTags(voice, value) {
  updateVoice(voice, { allowUserBracketTags: value })
}

function getEmotionEnhancementMode(voice) {
  if (!voice.gptProcessingOverride?.emotionEnhancement) return 'inherit'
  return voice.gptProcessingOverride.emotionEnhancement.enabled ? 'on' : 'off'
}

function setEmotionEnhancementMode(voice, mode) {
  const current = JSON.parse(JSON.stringify(voice.gptProcessingOverride || {}))
  if (mode === 'inherit') {
    delete current.emotionEnhancement
  } else {
    current.emotionEnhancement = { enabled: mode === 'on' }
  }
  updateVoice(voice, { gptProcessingOverride: cleanupGptOverride(current) })
}

function toggleOpenAIModelOverride(voice, enabled) {
  if (enabled) {
    const defaultModel = openAIModels.value.length > 0 ? openAIModels.value[0].id : 'gpt-5-nano'
    updateVoice(voice, { openAIModelOverride: defaultModel })
  } else {
    updateVoice(voice, { openAIModelOverride: null })
  }
}

function updateVoiceOpenAIModel(voice, model) {
  updateVoice(voice, { openAIModelOverride: model })
}

// ============ SAFETY TAB FUNCTIONS ============

// Content Moderation Mode
function getContentModerationMode(voice) {
  const cm = voice.gptProcessingOverride?.contentModeration
  if (!cm || cm.enabled === undefined) return 'inherit'
  return cm.enabled ? 'on' : 'off'
}

function setContentModerationMode(voice, mode) {
  const current = JSON.parse(JSON.stringify(voice.gptProcessingOverride || {}))
  if (mode === 'inherit') {
    if (current.contentModeration) {
      delete current.contentModeration.enabled
    }
  } else {
    if (!current.contentModeration) current.contentModeration = {}
    current.contentModeration.enabled = mode === 'on'
  }
  updateVoice(voice, { gptProcessingOverride: cleanupGptOverride(current) })
}

// Rule Level Overrides
function getVoiceRuleOverrideLevel(voice, ruleKey) {
  const rules = voice.gptProcessingOverride?.contentModeration?.rules
  if (!rules || !rules[ruleKey]) return undefined
  if (rules[ruleKey].level !== undefined) return rules[ruleKey].level
  if (rules[ruleKey].enabled !== undefined) return rules[ruleKey].enabled ? 'standard' : 'off'
  return undefined
}

function getVoiceRuleOverrideColor(voice, ruleKey) {
  const level = getVoiceRuleOverrideLevel(voice, ruleKey)
  if (level === undefined) return 'grey-8'
  if (level === 'off') return 'negative'
  if (level === 'standard') return 'primary'
  if (level === 'strict') return 'deep-orange'
  return 'grey-8'
}

function getVoiceRuleOverrideTextColor(voice, ruleKey) {
  const level = getVoiceRuleOverrideLevel(voice, ruleKey)
  return level === undefined ? 'grey-5' : 'white'
}

function getVoiceRuleOverrideIcon(voice, ruleKey) {
  const level = getVoiceRuleOverrideLevel(voice, ruleKey)
  if (level === undefined) return 'settings'
  if (level === 'off') return 'close'
  if (level === 'standard') return 'check'
  if (level === 'strict') return 'priority_high'
  return 'settings'
}

function getVoiceRuleOverrideLabel(voice, ruleKey) {
  const level = getVoiceRuleOverrideLevel(voice, ruleKey)
  if (level === undefined) return ''
  if (level === 'off') return 'OFF'
  if (level === 'standard') return 'STD'
  if (level === 'strict') return 'MAX'
  return ''
}

function cycleVoiceRuleOverride(voice, ruleKey) {
  const currentLevel = getVoiceRuleOverrideLevel(voice, ruleKey)
  let newLevel
  if (currentLevel === undefined) newLevel = 'off'
  else if (currentLevel === 'off') newLevel = 'standard'
  else if (currentLevel === 'standard') newLevel = 'strict'
  else newLevel = undefined

  const current = JSON.parse(JSON.stringify(voice.gptProcessingOverride || {}))
  if (!current.contentModeration) current.contentModeration = {}
  if (!current.contentModeration.rules) current.contentModeration.rules = {}

  if (newLevel === undefined) {
    delete current.contentModeration.rules[ruleKey]
    if (Object.keys(current.contentModeration.rules).length === 0) delete current.contentModeration.rules
  } else {
    current.contentModeration.rules[ruleKey] = { level: newLevel }
  }

  updateVoice(voice, { gptProcessingOverride: cleanupGptOverride(current) })
}

// Profanity Functions
function getVoiceProfanityMode(voice) {
  const profanity = voice.gptProcessingOverride?.contentModeration?.profanity
  if (!profanity || !profanity.override) return 'inherit'
  return profanity.mode || 'replace'
}

function setVoiceProfanityMode(voice, mode) {
  const current = JSON.parse(JSON.stringify(voice.gptProcessingOverride || {}))
  if (!current.contentModeration) current.contentModeration = {}

  if (mode === 'inherit') {
    delete current.contentModeration.profanity
  } else {
    // Preserve existing settings when switching modes
    const existing = current.contentModeration.profanity || {}
    current.contentModeration.profanity = {
      override: true,
      mode: mode,
      level: existing.level || 'standard',
      replacementWord: existing.replacementWord || 'quack',
      exceptions: existing.exceptions || []
    }
  }
  updateVoice(voice, { gptProcessingOverride: cleanupGptOverride(current) })
}

function getVoiceProfanityReplacementWord(voice) {
  return voice.gptProcessingOverride?.contentModeration?.profanity?.replacementWord || 'quack'
}

function setVoiceProfanityReplacementWord(voice, word) {
  const current = JSON.parse(JSON.stringify(voice.gptProcessingOverride || {}))
  if (current.contentModeration?.profanity) {
    current.contentModeration.profanity.replacementWord = word
    updateVoice(voice, { gptProcessingOverride: current })
  }
}

function getVoiceProfanityLevel(voice) {
  return voice.gptProcessingOverride?.contentModeration?.profanity?.level || 'standard'
}

function setVoiceProfanityLevel(voice, level) {
  const current = JSON.parse(JSON.stringify(voice.gptProcessingOverride || {}))
  if (current.contentModeration?.profanity) {
    current.contentModeration.profanity.level = level
    updateVoice(voice, { gptProcessingOverride: current })
  }
}

function getVoiceProfanityExceptions(voice) {
  return voice.gptProcessingOverride?.contentModeration?.profanity?.exceptions || []
}

function openAddProfanityExceptionDialog(voice) {
  currentProfanityExceptionVoice.value = voice
  newProfanityException.value = ''
  showAddProfanityExceptionDialog.value = true
}

function addProfanityException() {
  if (!newProfanityException.value.trim() || !currentProfanityExceptionVoice.value) return
  const voice = currentProfanityExceptionVoice.value
  const current = JSON.parse(JSON.stringify(voice.gptProcessingOverride || {}))
  if (current.contentModeration?.profanity) {
    if (!current.contentModeration.profanity.exceptions) current.contentModeration.profanity.exceptions = []
    const word = newProfanityException.value.trim().toLowerCase()
    if (!current.contentModeration.profanity.exceptions.includes(word)) {
      current.contentModeration.profanity.exceptions.push(word)
      updateVoice(voice, { gptProcessingOverride: current })
    }
  }
  showAddProfanityExceptionDialog.value = false
}

function removeVoiceProfanityException(voice, idx) {
  const current = JSON.parse(JSON.stringify(voice.gptProcessingOverride || {}))
  if (current.contentModeration?.profanity?.exceptions) {
    current.contentModeration.profanity.exceptions.splice(idx, 1)
    updateVoice(voice, { gptProcessingOverride: current })
  }
}

// Blocked Topics Functions
function getVoiceBlockedTopicsMode(voice) {
  const bt = voice.gptProcessingOverride?.contentModeration?.blockedTopics
  if (!bt || !bt.mode) return 'inherit'
  return bt.mode
}

function setVoiceBlockedTopicsMode(voice, mode) {
  const current = JSON.parse(JSON.stringify(voice.gptProcessingOverride || {}))
  if (!current.contentModeration) current.contentModeration = {}

  if (mode === 'inherit') {
    delete current.contentModeration.blockedTopics
  } else {
    // Preserve existing settings when switching modes
    const existing = current.contentModeration.blockedTopics || {}
    current.contentModeration.blockedTopics = {
      mode: mode,
      presets: existing.presets || {},
      custom: existing.custom || []
    }
  }
  updateVoice(voice, { gptProcessingOverride: cleanupGptOverride(current) })
}

function isVoiceTopicBlocked(voice, topicKey) {
  return voice.gptProcessingOverride?.contentModeration?.blockedTopics?.presets?.[topicKey] || false
}

function toggleVoiceBlockedTopic(voice, topicKey) {
  const current = JSON.parse(JSON.stringify(voice.gptProcessingOverride || {}))
  if (current.contentModeration?.blockedTopics) {
    if (!current.contentModeration.blockedTopics.presets) current.contentModeration.blockedTopics.presets = {}
    current.contentModeration.blockedTopics.presets[topicKey] = !current.contentModeration.blockedTopics.presets[topicKey]
    updateVoice(voice, { gptProcessingOverride: current })
  }
}

function getVoiceCustomBlockedTopics(voice) {
  return voice.gptProcessingOverride?.contentModeration?.blockedTopics?.custom || []
}

function openAddBlockedTopicDialog(voice) {
  currentBlockedTopicVoice.value = voice
  newBlockedTopic.value = ''
  showAddBlockedTopicDialog.value = true
}

function addBlockedTopic() {
  if (!newBlockedTopic.value.trim() || !currentBlockedTopicVoice.value) return
  const voice = currentBlockedTopicVoice.value
  const current = JSON.parse(JSON.stringify(voice.gptProcessingOverride || {}))
  if (current.contentModeration?.blockedTopics) {
    if (!current.contentModeration.blockedTopics.custom) current.contentModeration.blockedTopics.custom = []
    current.contentModeration.blockedTopics.custom.push(newBlockedTopic.value.trim())
    updateVoice(voice, { gptProcessingOverride: current })
  }
  showAddBlockedTopicDialog.value = false
}

function removeVoiceCustomBlockedTopic(voice, idx) {
  const current = JSON.parse(JSON.stringify(voice.gptProcessingOverride || {}))
  if (current.contentModeration?.blockedTopics?.custom) {
    current.contentModeration.blockedTopics.custom.splice(idx, 1)
    updateVoice(voice, { gptProcessingOverride: current })
  }
}

// Custom Instructions Functions
function getVoiceCustomInstructionsMode(voice) {
  const ci = voice.gptProcessingOverride?.contentModeration?.customInstructions
  if (!ci || !ci.mode) return 'inherit'
  return ci.mode
}

function setVoiceCustomInstructionsMode(voice, mode) {
  const current = JSON.parse(JSON.stringify(voice.gptProcessingOverride || {}))
  if (!current.contentModeration) current.contentModeration = {}

  if (mode === 'inherit') {
    delete current.contentModeration.customInstructions
  } else {
    // Preserve existing text when switching modes
    const existing = current.contentModeration.customInstructions || {}
    current.contentModeration.customInstructions = {
      mode: mode,
      text: existing.text || ''
    }
  }
  updateVoice(voice, { gptProcessingOverride: cleanupGptOverride(current) })
}

function getVoiceCustomInstructionsText(voice) {
  return voice.gptProcessingOverride?.contentModeration?.customInstructions?.text || ''
}

function setVoiceCustomInstructionsText(voice, text) {
  const current = JSON.parse(JSON.stringify(voice.gptProcessingOverride || {}))
  if (current.contentModeration?.customInstructions) {
    current.contentModeration.customInstructions.text = text
    updateVoice(voice, { gptProcessingOverride: current })
  }
}

// On Failure Functions
function getVoiceOnFailureMode(voice) {
  const onFailure = voice.gptProcessingOverride?.contentModeration?.onFailure
  if (!onFailure) return 'inherit'
  return onFailure
}

function setVoiceOnFailureMode(voice, mode) {
  const current = JSON.parse(JSON.stringify(voice.gptProcessingOverride || {}))
  if (!current.contentModeration) current.contentModeration = {}

  if (mode === 'inherit') {
    delete current.contentModeration.onFailure
  } else {
    current.contentModeration.onFailure = mode
  }
  updateVoice(voice, { gptProcessingOverride: cleanupGptOverride(current) })
}
</script>

<style scoped>
.result-modified :deep(.q-field__control) {
  background: rgba(33, 186, 69, 0.1);
}

.disabled-section {
  opacity: 0.5;
  pointer-events: none;
}

.bypass-section {
  background: rgba(244, 67, 54, 0.1);
  border-radius: 8px;
  padding: 12px;
}
</style>
