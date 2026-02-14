/**
 * Text Processor Service
 *
 * Handles text replacements/censorship before sending to TTS.
 * Supports both global replacements and per-voice alias replacements.
 * Also handles input sanitization (HTML, code blocks, user tags).
 */

// ============ SANITIZATION FUNCTIONS ============

/**
 * Valid ElevenLabs audio tags for Eleven v3 Alpha
 * Only v3 supports these tags - other models will ignore or pronounce them
 */
const VALID_EMOTION_TAGS = [
  // Vocalizations
  '[laughs]', '[laugh]', '[laughter]',
  '[sighs]', '[sigh]',
  '[gasps]', '[gasp]',
  '[whispers]', '[whisper]',
  '[gulps]', '[gulp]',
  // Emotional states
  '[excited]', '[nervous]', '[frustrated]', '[calm]', '[sorrowful]',
  // Delivery control
  '[pauses]', '[pause]', '[hesitates]',
  // Tone cues
  '[cheerfully]', '[flatly]', '[deadpan]', '[playfully]', '[sarcastically]'
]

/**
 * Strip HTML tags from text
 * @param {string} text - Input text
 * @returns {string} - Text with HTML tags removed
 */
function stripHtmlTags(text) {
  if (!text) return text

  // Remove HTML tags
  let result = text.replace(/<[^>]*>/g, '')

  // Decode common HTML entities
  result = result
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")

  return result
}

/**
 * Strip code blocks and inline code from text
 * @param {string} text - Input text
 * @returns {string} - Text with code removed
 */
function stripCodeBlocks(text) {
  if (!text) return text

  let result = text

  // Remove fenced code blocks (```code```)
  result = result.replace(/```[\s\S]*?```/g, '')

  // Remove inline code (`code`)
  result = result.replace(/`[^`]+`/g, '')

  return result
}

/**
 * Strip user-added bracket tags from text
 * This removes anything in square brackets that isn't a valid V3 tag
 * @param {string} text - Input text
 * @returns {string} - Text with user bracket tags removed
 */
function stripUserBracketTags(text) {
  if (!text) return text

  // Match all [anything] patterns
  return text.replace(/\[[^\]]*\]/g, (match) => {
    // Keep valid V3 tags (lowercase only)
    if (VALID_EMOTION_TAGS.includes(match.toLowerCase())) {
      // But ensure they're lowercase
      return match.toLowerCase()
    }
    // Remove invalid/user tags
    return ''
  })
}

/**
 * Strip Zalgo/combining Unicode characters from text
 * Zalgo text uses excessive combining diacritical marks to create "corrupted" looking text
 * that can hide words from simple text filters
 * @param {string} text - Input text
 * @returns {string} - Text with combining marks removed
 */
function stripZalgoText(text) {
  if (!text) return text
  // Remove all Unicode nonspacing combining marks (category Mn)
  // This strips the stacking diacritics used in Zalgo while preserving base characters
  return text.replace(/\p{Mn}/gu, '')
}

/**
 * Common emoji to spoken description map
 * Covers the most frequently used emojis in Twitch/streaming context
 */
const EMOJI_MAP = {
  // Faces - happy/positive
  '😂': 'crying laughing', '🤣': 'rolling on the floor laughing', '😄': 'grinning',
  '😁': 'beaming', '😆': 'laughing', '😊': 'smiling', '🙂': 'slightly smiling',
  '😉': 'winky face', '😍': 'heart eyes', '🥰': 'smiling with hearts',
  '😘': 'blowing a kiss', '😎': 'cool sunglasses', '🤩': 'star struck',
  '🥳': 'party face', '😏': 'smirking',
  // Faces - negative/other
  '😢': 'crying', '😭': 'sobbing', '😱': 'screaming', '😡': 'angry face',
  '🤬': 'swearing', '😤': 'huffing', '🙄': 'eye roll', '😑': 'expressionless',
  '🤔': 'thinking', '🤯': 'mind blown', '😳': 'flushed', '😬': 'grimacing',
  '🫠': 'melting face', '💀': 'skull', '☠️': 'skull and crossbones',
  '🤡': 'clown', '👻': 'ghost', '😴': 'sleeping',
  // Gestures
  '👍': 'thumbs up', '👎': 'thumbs down', '👏': 'clapping', '🙏': 'praying hands',
  '🤝': 'handshake', '✌️': 'peace sign', '🤙': 'call me hand',
  '👋': 'waving', '🫡': 'salute', '🖕': 'middle finger',
  // Hearts & symbols
  '❤️': 'heart', '🧡': 'orange heart', '💛': 'yellow heart', '💚': 'green heart',
  '💙': 'blue heart', '💜': 'purple heart', '🖤': 'black heart', '🤍': 'white heart',
  '💔': 'broken heart', '💯': 'hundred', '✅': 'check mark', '❌': 'X mark',
  '⭐': 'star', '🌟': 'glowing star', '✨': 'sparkles',
  // Objects & misc
  '🔥': 'fire', '💪': 'flexing', '🎉': 'party popper', '🎊': 'confetti',
  '🏆': 'trophy', '🥇': 'gold medal', '🎮': 'game controller', '🎯': 'bullseye',
  '💰': 'money bag', '💎': 'gem', '🚀': 'rocket', '💣': 'bomb',
  '⚡': 'lightning', '🔔': 'bell', '🎵': 'music note', '🎶': 'music notes',
  '👀': 'eyes', '👁️': 'eye', '🧠': 'brain', '💤': 'zzz',
  // Animals
  '🐐': 'goat', '🐍': 'snake', '🦊': 'fox', '🐸': 'frog',
  '🐶': 'dog', '🐱': 'cat', '🦁': 'lion', '🐻': 'bear',
  // Flags & misc symbols
  '🏳️': 'white flag', '🚩': 'red flag', '💩': 'poop',
  '🤖': 'robot', '👑': 'crown', '🧢': 'cap'
}

/**
 * Replace emojis with fun spoken descriptions, then strip any remaining emojis
 * Collapses repeated identical emojis into a single fun description
 * @param {string} text - Input text
 * @returns {string} - Text with emojis replaced by spoken descriptions
 */
function replaceEmojis(text) {
  if (!text) return text

  let result = text

  // Phase 1: Collapse consecutive identical emojis into single descriptions
  for (const [emoji, description] of Object.entries(EMOJI_MAP)) {
    if (!result.includes(emoji)) continue

    // Escape emoji for regex (handles variation selectors etc.)
    const escaped = emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Match 2+ consecutive of the same emoji (with optional spaces between)
    const repeatedPattern = new RegExp(`(?:${escaped}\\s*){2,}`, 'gu')

    result = result.replace(repeatedPattern, (match) => {
      // Count how many times the emoji appears in the match
      let count = 0
      let idx = 0
      while ((idx = match.indexOf(emoji, idx)) !== -1) {
        count++
        idx += emoji.length
      }

      if (count >= 7) return ` a whole wall of ${description} `
      if (count >= 4) return ` so many ${description} `
      if (count >= 3) return ` ${description} times ${count} `
      return ` double ${description} `
    })
  }

  // Phase 2: Replace remaining single emojis
  for (const [emoji, description] of Object.entries(EMOJI_MAP)) {
    result = result.split(emoji).join(` ${description} `)
  }

  // Phase 3: Strip any remaining unmapped emojis via Unicode emoji regex
  result = result.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{200D}]|[\u{20E3}]|[\u{E0020}-\u{E007F}]/gu, '')

  // Normalize whitespace
  result = result.replace(/\s+/g, ' ').trim()

  return result
}

/**
 * Collapse repetitive/spam content into concise summaries
 * Prevents TTS from reading 50 identical characters or absurdly long numbers
 * Designed to make spam attempts entertaining rather than disruptive
 * @param {string} text - Input text
 * @returns {string} - Text with spam collapsed
 */
function collapseRepetition(text) {
  if (!text) return text

  let result = text

  // 1. Collapse long number strings (10+ digits)
  //    "12323423424234634634634060980394860394860348603968" → "123... a ridiculously long number"
  result = result.replace(/\d{10,}/g, (match) => {
    const preview = match.substring(0, 3)
    if (match.length >= 30) return `${preview}... an absurdly long number`
    if (match.length >= 15) return `${preview}... a very long number`
    return `${preview}... a long number`
  })

  // 2. Collapse repeated words (6+ consecutive repetitions)
  //    "GO GO GO GO GO!" → allowed (5 or fewer)
  //    "GO GO GO GO GO GO GO GO GO!" → collapsed
  result = result.replace(/\b(\w+)(?:\s+\1){5,}\b/gi, (match, word) => {
    const count = match.split(/\s+/).length
    if (count >= 10) return `${word}, a whole wall of them`
    if (count >= 7) return `${word}, so many of them`
    return `${word}, times ${count}`
  })

  // Normalize whitespace
  result = result.replace(/\s+/g, ' ').trim()

  return result
}

/**
 * Sanitize input text by removing HTML, code, and optionally user bracket tags
 * @param {string} text - Input text
 * @param {Object} config - Sanitization config { stripHtmlTags, stripCodeBlocks, stripUserBracketTags }
 * @returns {Object} - { result, sanitizationApplied }
 */
function sanitizeInput(text, config) {
  if (!text) {
    return { result: '', sanitizationApplied: [] }
  }

  let result = text
  const sanitizationApplied = []

  // Strip HTML tags
  if (config?.stripHtmlTags !== false) {
    const before = result
    result = stripHtmlTags(result)
    if (before !== result) {
      sanitizationApplied.push('html')
    }
  }

  // Strip code blocks
  if (config?.stripCodeBlocks !== false) {
    const before = result
    result = stripCodeBlocks(result)
    if (before !== result) {
      sanitizationApplied.push('code')
    }
  }

  // Strip Zalgo/combining marks
  if (config?.stripZalgoText !== false) {
    const before = result
    result = stripZalgoText(result)
    if (before !== result) {
      sanitizationApplied.push('zalgo')
    }
  }

  // Replace emojis with spoken descriptions
  if (config?.replaceEmojis !== false) {
    const before = result
    result = replaceEmojis(result)
    if (before !== result) {
      sanitizationApplied.push('emojis')
    }
  }

  // Collapse repetitive/spam content (always on — nobody wants TTS reading 50 a's)
  {
    const before = result
    result = collapseRepetition(result)
    if (before !== result) {
      sanitizationApplied.push('spam')
    }
  }

  // Strip user bracket tags (unless explicitly disabled)
  if (config?.stripUserBracketTags !== false) {
    const before = result
    result = stripUserBracketTags(result)
    if (before !== result) {
      sanitizationApplied.push('brackets')
    }
  }

  // Clean up extra whitespace that may result from removal
  result = result.replace(/\s+/g, ' ').trim()

  return { result, sanitizationApplied }
}

/**
 * Post-process text to find and normalize performance/emotion tags added by GPT
 * ElevenLabs v3 Alpha supports rich, descriptive tags - we preserve ALL of them
 * but lowercase them so ElevenLabs interprets them as directions, not text to read
 * @param {string} text - Text that may contain performance tags from GPT
 * @returns {Object} - { result, tagsFound, tagsRemoved }
 */
function postProcessEmotionTags(text) {
  if (!text) {
    return { result: '', tagsFound: [], tagsRemoved: [] }
  }

  const tagsFound = []

  // Find all bracket tags and lowercase them
  // ElevenLabs v3 will try to READ capitalized text in brackets literally
  // e.g., [A jubilant laugh] -> [a jubilant laugh]
  let result = text.replace(/\[[^\]]+\]/g, (match) => {
    const lowercased = match.toLowerCase()
    tagsFound.push(lowercased)
    return lowercased
  })

  // Strip trailing performance tags that have no text after them
  // e.g., "Hello world! [final alarm]" -> "Hello world!"
  // These tags don't work because there's nothing for them to affect
  result = result.replace(/\s*\[[^\]]+\]\s*$/, '')

  // Clean up extra whitespace
  result = result.replace(/\s+/g, ' ').trim()

  // tagsRemoved is always empty now - we trust GPT's creative tags
  return { result, tagsFound, tagsRemoved: [] }
}

/**
 * Get effective sanitization config for a voice
 * @param {Object} voiceConfig - Voice configuration
 * @param {Object} globalConfig - Global sanitization settings
 * @returns {Object} - Effective sanitization config
 */
function getEffectiveSanitization(voiceConfig, globalConfig) {
  const defaults = {
    stripHtmlTags: true,
    stripCodeBlocks: true,
    stripZalgoText: true,
    replaceEmojis: true,
    stripUserBracketTags: true
  }

  // If voice ignores sanitization entirely, disable all sanitization
  if (voiceConfig?.ignoreSanitization) {
    return {
      stripHtmlTags: false,
      stripCodeBlocks: false,
      stripZalgoText: false,
      replaceEmojis: false,
      stripUserBracketTags: false
    }
  }

  // Start with global config (or defaults)
  const config = {
    stripHtmlTags: globalConfig?.stripHtmlTags ?? defaults.stripHtmlTags,
    stripCodeBlocks: globalConfig?.stripCodeBlocks ?? defaults.stripCodeBlocks,
    stripZalgoText: globalConfig?.stripZalgoText ?? defaults.stripZalgoText,
    replaceEmojis: globalConfig?.replaceEmojis ?? defaults.replaceEmojis,
    stripUserBracketTags: globalConfig?.stripUserBracketTags ?? defaults.stripUserBracketTags
  }

  // Apply voice-specific overrides
  if (voiceConfig?.allowUserBracketTags) {
    config.stripUserBracketTags = false
  }
  if (voiceConfig?.allowZalgoText) {
    config.stripZalgoText = false
  }
  if (voiceConfig?.allowEmojis) {
    config.replaceEmojis = false
  }

  return config
}

// ============ REPLACEMENT FUNCTIONS ============

/**
 * Apply a list of replacement rules to text
 * @param {string} text - Input text to process
 * @param {Array} replacements - Array of replacement rules
 * @returns {string} - Processed text
 */
function applyReplacements(text, replacements) {
  if (!text || !replacements || replacements.length === 0) {
    return text
  }

  let result = text

  for (const rule of replacements) {
    // Skip disabled rules
    if (!rule.enabled) continue

    // Skip empty patterns
    if (!rule.pattern) continue

    try {
      if (rule.isRegex) {
        // Parse inline flags like (?i) from the pattern
        const { cleanPattern, flags: inlineFlags } = parseInlineFlags(rule.pattern)

        // Build regex with flags (global always, case insensitive by default unless caseSensitive is checked)
        let flags = 'g'
        // If inline flags specify case insensitive, use that
        if (inlineFlags.includes('i')) {
          flags += 'i'
        } else if (!rule.caseSensitive) {
          // Default to case insensitive unless explicitly case sensitive
          flags += 'i'
        }
        // Add other inline flags
        if (inlineFlags.includes('m')) flags += 'm'
        if (inlineFlags.includes('s')) flags += 's'

        const regex = new RegExp(cleanPattern, flags)
        result = result.replace(regex, rule.replacement || '')
      } else {
        // Plain text replacement
        if (rule.caseSensitive) {
          // Case-sensitive: use split/join for global replace
          result = result.split(rule.pattern).join(rule.replacement || '')
        } else {
          // Case-insensitive: use regex with escaped pattern
          const escapedPattern = escapeRegExp(rule.pattern)
          const regex = new RegExp(escapedPattern, 'gi')
          result = result.replace(regex, rule.replacement || '')
        }
      }
    } catch (error) {
      // Log error but continue with other rules
      console.error(`Text processor: Invalid replacement rule "${rule.pattern}":`, error.message)
    }
  }

  return result
}

/**
 * Escape special regex characters in a string
 * @param {string} str - String to escape
 * @returns {string} - Escaped string safe for use in RegExp
 */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Parse inline flags from regex pattern (e.g., (?i), (?m), (?s))
 * JavaScript doesn't support inline flags, so we extract them and apply as RegExp flags
 * @param {string} pattern - Regex pattern that may contain inline flags
 * @returns {Object} - { cleanPattern, flags }
 */
function parseInlineFlags(pattern) {
  let flags = ''
  let cleanPattern = pattern

  // Match inline flag groups at the start: (?i), (?im), (?ims), etc.
  const inlineFlagMatch = cleanPattern.match(/^\(\?([imsuxy]+)\)/)
  if (inlineFlagMatch) {
    const inlineFlags = inlineFlagMatch[1]
    cleanPattern = cleanPattern.slice(inlineFlagMatch[0].length)

    // Map PCRE flags to JS flags where possible
    if (inlineFlags.includes('i')) flags += 'i'  // case insensitive
    if (inlineFlags.includes('m')) flags += 'm'  // multiline
    if (inlineFlags.includes('s')) flags += 's'  // dotAll (. matches newlines)
    // Note: 'x' (extended/verbose) and 'u' (unicode) have different meanings or aren't directly supported
  }

  return { cleanPattern, flags }
}

/**
 * Process text through all applicable replacement rules
 * @param {string} text - Input text
 * @param {Object} voiceConfig - Voice configuration (may contain ignoreGlobalReplacements and replacements)
 * @param {Array} globalReplacements - Global replacement rules
 * @returns {Object} - { processedText, appliedRules }
 */
function processText(text, voiceConfig, globalReplacements) {
  if (!text) {
    return { processedText: '', appliedRules: [] }
  }

  let processedText = text
  const appliedRules = []

  // Step 1: Apply global replacements (unless voice ignores them)
  if (!voiceConfig?.ignoreGlobalReplacements && globalReplacements?.length > 0) {
    const beforeGlobal = processedText
    processedText = applyReplacements(processedText, globalReplacements)

    // Track which global rules were applied
    if (beforeGlobal !== processedText) {
      appliedRules.push({ type: 'global', count: globalReplacements.filter(r => r.enabled).length })
    }
  }

  // Step 2: Apply voice-specific replacements
  if (voiceConfig?.replacements?.length > 0) {
    const beforeVoice = processedText
    processedText = applyReplacements(processedText, voiceConfig.replacements)

    // Track which voice rules were applied
    if (beforeVoice !== processedText) {
      appliedRules.push({ type: 'voice', alias: voiceConfig.alias, count: voiceConfig.replacements.filter(r => r.enabled).length })
    }
  }

  return { processedText, appliedRules }
}

/**
 * Test a single replacement rule
 * @param {string} text - Input text
 * @param {Object} rule - Replacement rule to test
 * @returns {Object} - { result, matched, error }
 */
function testSingleRule(text, rule) {
  if (!text || !rule.pattern) {
    return { result: text, matched: false, error: null }
  }

  try {
    const original = text
    let result

    if (rule.isRegex) {
      // Parse inline flags like (?i) from the pattern
      const { cleanPattern, flags: inlineFlags } = parseInlineFlags(rule.pattern)

      let flags = 'g'
      if (inlineFlags.includes('i')) {
        flags += 'i'
      } else if (!rule.caseSensitive) {
        flags += 'i'
      }
      if (inlineFlags.includes('m')) flags += 'm'
      if (inlineFlags.includes('s')) flags += 's'

      const regex = new RegExp(cleanPattern, flags)
      result = text.replace(regex, rule.replacement || '')
    } else {
      if (rule.caseSensitive) {
        result = text.split(rule.pattern).join(rule.replacement || '')
      } else {
        const escapedPattern = escapeRegExp(rule.pattern)
        const regex = new RegExp(escapedPattern, 'gi')
        result = text.replace(regex, rule.replacement || '')
      }
    }

    return {
      result,
      matched: result !== original,
      error: null
    }
  } catch (error) {
    return {
      result: text,
      matched: false,
      error: error.message
    }
  }
}

/**
 * Validate a regex pattern
 * @param {string} pattern - Pattern to validate
 * @returns {Object} - { valid, error }
 */
function validateRegexPattern(pattern) {
  if (!pattern) {
    return { valid: false, error: 'Pattern is empty' }
  }

  try {
    // Strip inline flags before validating (JS doesn't support them)
    const { cleanPattern } = parseInlineFlags(pattern)
    new RegExp(cleanPattern)
    return { valid: true, error: null }
  } catch (error) {
    return { valid: false, error: error.message }
  }
}

/**
 * Apply max message length limits (dual: characters AND/OR words)
 * Both limits can be enabled simultaneously - whichever triggers first wins
 * @param {string} text - Input text
 * @param {Object} maxLengthConfig - { characters: { enabled, value }, words: { enabled, value } }
 * @returns {Object} - { result, wasTruncated, truncatedBy, charCount, wordCount }
 */
function applyMaxLength(text, maxLengthConfig) {
  if (!text) {
    return { result: '', wasTruncated: false, truncatedBy: null, charCount: 0, wordCount: 0 }
  }

  const charLimit = maxLengthConfig?.characters
  const wordLimit = maxLengthConfig?.words

  // If neither limit is enabled, return as-is
  if (!charLimit?.enabled && !wordLimit?.enabled) {
    const words = text.split(/\s+/).filter(Boolean)
    return {
      result: text,
      wasTruncated: false,
      truncatedBy: null,
      charCount: text.length,
      wordCount: words.length
    }
  }

  let result = text
  let wasTruncated = false
  let truncatedBy = null

  // Check character limit first (cheaper operation)
  if (charLimit?.enabled && result.length > charLimit.value) {
    // Truncate at word boundary if possible
    let truncated = result.substring(0, charLimit.value)
    const lastSpace = truncated.lastIndexOf(' ')
    if (lastSpace > charLimit.value * 0.8) {
      // Only truncate at word boundary if it doesn't lose too much
      truncated = truncated.substring(0, lastSpace)
    }
    result = truncated
    wasTruncated = true
    truncatedBy = 'characters'
  }

  // Check word limit
  if (wordLimit?.enabled) {
    const words = result.split(/\s+/).filter(Boolean)
    if (words.length > wordLimit.value) {
      result = words.slice(0, wordLimit.value).join(' ')
      wasTruncated = true
      // If both limits triggered, note it was characters first (already set), otherwise words
      if (!truncatedBy) {
        truncatedBy = 'words'
      }
    }
  }

  const finalWords = result.split(/\s+/).filter(Boolean)
  return {
    result,
    wasTruncated,
    truncatedBy,
    charCount: result.length,
    wordCount: finalWords.length
  }
}

/**
 * Get effective max length config for a voice (considering overrides)
 * Ensures all nested properties have proper defaults
 * @param {Object} voiceConfig - Voice configuration
 * @param {Object} globalMaxLength - Global max length settings
 * @returns {Object} - Effective max length config { characters: {...}, words: {...} }
 */
function getEffectiveMaxLength(voiceConfig, globalMaxLength) {
  const defaultConfig = {
    characters: { enabled: false, value: 500 },
    words: { enabled: false, value: 50 }
  }

  // Check if voice ignores max length entirely
  if (voiceConfig?.ignoreMaxMessageLength) {
    return defaultConfig
  }

  // Check if voice has an override
  if (voiceConfig?.maxMessageLengthOverride) {
    const override = voiceConfig.maxMessageLengthOverride
    return {
      characters: {
        enabled: override.characters?.enabled ?? false,
        value: override.characters?.value ?? 500
      },
      words: {
        enabled: override.words?.enabled ?? false,
        value: override.words?.value ?? 50
      }
    }
  }

  // Use global setting (with defaults for any missing properties)
  const global = globalMaxLength || {}
  return {
    characters: {
      enabled: global.characters?.enabled ?? false,
      value: global.characters?.value ?? 500
    },
    words: {
      enabled: global.words?.enabled ?? false,
      value: global.words?.value ?? 50
    }
  }
}

export {
  // Sanitization
  sanitizeInput,
  postProcessEmotionTags,
  getEffectiveSanitization,
  VALID_EMOTION_TAGS,
  // Replacements
  processText,
  testSingleRule,
  validateRegexPattern,
  // Max Length
  applyMaxLength,
  getEffectiveMaxLength
}
