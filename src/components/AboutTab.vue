<template>
  <div class="about-container">
    <div class="column items-center q-mb-xl">
      <img
        v-if="logoSrc"
        :src="logoSrc"
        alt="VoiceForge Logo"
        class="about-logo q-mb-md"
      />
      <div class="text-h4 text-weight-bold">VoiceForge</div>
      <div class="text-caption text-grey-6">v1.0.0</div>
    </div>

    <q-separator class="q-my-lg" />

    <div class="row q-col-gutter-lg">
      <!-- Creator Info -->
      <div class="col-12 col-md-8">
        <q-card flat class="about-card">
          <q-card-section>
            <div class="row items-center q-mb-md">
              <div class="avatar-wrapper q-mr-md">
                <q-avatar size="64px">
                  <img v-if="avatarSrc" :src="avatarSrc" alt="Flavionel" />
                  <q-icon v-else name="person" size="40px" />
                </q-avatar>
              </div>
              <div>
                <div class="text-h6">Flavionel</div>
                <div class="text-caption text-grey-5">Creator of VoiceForge</div>
              </div>
            </div>

            <div class="about-bio text-body2">
              <p>Hi there! I'm Flavionel, the creator of VoiceForge.</p>
              <p>
                I originally built this app for my community and me. We love TTS and the amazing
                emotions ElevenLabs can deliver, but existing integrations felt limited — so I
                decided to make something better.
              </p>
              <p>
                For questions, bugs, or suggestions, please create an issue on the official
                GitHub repository. You can find a direct link in the Links section.
              </p>
              <p>
                I stream almost every day on Twitch, so feel free to stop by and say hi! We play
                a variety of games, always on the highest difficulty with added challenge
                runs—even on the first playthrough.
              </p>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Quick Links -->
      <div class="col-12 col-md-4">
        <q-card flat class="about-card">
          <q-card-section>
            <div class="text-subtitle2 q-mb-md">Links</div>
            <div class="column" style="gap: 10px;">
              <q-btn
                unelevated
                color="deep-purple-7"
                text-color="white"
                class="full-width"
                :icon="twitchIcon"
                label="Twitch"
                @click="openExternal('https://www.twitch.tv/flavionel')"
              />
              <q-btn
                unelevated
                color="grey-8"
                text-color="white"
                class="full-width"
                :icon="githubIcon"
                label="GitHub"
                @click="openExternal('https://github.com/Flavionel/voice-forge')"
              />
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const logoSrc = ref(null)
const avatarSrc = ref(null)

// SVG path data for brand icons (Quasar format: just the path d attribute)
const twitchIcon = 'M11.571 4.714h1.715v5.143H11.57zm4.572 0H17.86v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z'
const githubIcon = 'M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z'

onMounted(async () => {
  try {
    const logo = await import('../assets/logo.png')
    logoSrc.value = logo.default
  } catch {
    // Logo not found, will be hidden
  }
  try {
    const avatar = await import('../assets/avatar.png')
    avatarSrc.value = avatar.default
  } catch {
    // Avatar not found, will show icon fallback
  }
})

function openExternal(url) {
  window.electronAPI.openExternal(url)
}
</script>

<style scoped>
@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.03); }
  100% { transform: scale(1); }
}

.about-container {
  max-width: 800px;
  margin: 0 auto;
  padding-top: 24px;
}

.about-logo {
  max-width: 160px;
  max-height: 160px;
  object-fit: contain;
  animation: pulse 6s infinite ease-in-out;
}

.avatar-wrapper {
  border-radius: 50%;
  padding: 2px;
  border: 2px solid #42a5f5;
  line-height: 0;
  display: inline-block;
}

.about-bio p {
  margin-bottom: 12px;
  line-height: 1.6;
  color: #bdbdbd;
}

.about-bio p:last-child {
  margin-bottom: 0;
}

.about-card {
  background: linear-gradient(145deg, #2c3e50, #233140);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}
</style>
