<div align="center">

<img width="256" height="256" alt="logo"
src="https://github.com/user-attachments/assets/b1536b22-9d6b-428c-a780-4ec5989a1351" />

<h1>VoiceForge</h1>

</div>

## What is VoiceForge?

_AI-powered Text-to-Speech for Twitch streamers, powered by ElevenLabs._

VoiceForge is my desktop app that unlocks the full magic of ElevenLabs TTS on your stream. You get total control over voice models, all the V3 settings, and that incredible emotional depth the engine is capable of!

I made it because the existing TTS options just... weren’t cutting it. ElevenLabs V3 voices can be mind-blowingly expressive — laughing, whispering, shouting, even singing — but only if you feed them the right prompts. Most tools leave that magic on the table.

VoiceForge fixes that with a clever twist: it uses ChatGPT as your personal Voice Director. For every message, it reads the text, figures out the vibe, and automatically adds the perfect V3 tags for emotion, pacing, and tone. The result? Your TTS stops sounding like a robot and starts feeling like a real character reacting to chat.

And since GPT is already looking at every message, we put it to double duty with smart AI content moderation — quietly catching anything inappropriate, sneaky evasions, or off-limits topics before they ever hit your speakers.

## Features

- Multiple ElevenLabs voice aliases with per-voice settings
- AI-powered content moderation (configurable strictness levels)
- Emotion-enhanced TTS with ElevenLabs V3 voice tags
- Text processing pipeline (sanitization, replacements, length limits)
- Streamer.bot integration for Twitch channel point redemptions
- Queue management with pause/resume and manual moderation
- History with replay and refund capabilities
- OBS WebSocket integration for overlay control

## Requirements

- Windows 10/11
- [ElevenLabs](https://elevenlabs.io/) API key (for TTS generation)
- [OpenAI](https://platform.openai.com/) API key (for AI moderation/emotion tags)
- [Streamer.bot](https://streamer.bot/) (for Twitch integration)
- [OBS Studio](https://obsproject.com/) v28+ (optional, for overlay control via built-in WebSocket)

## Installation

### Download

Download the latest installer from the [Releases](../../releases) page.

### Build from Source

```bash
# Clone the repository
git clone https://github.com/Flavionel/voice-forge.git
cd VoiceForge

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build the installer
npm run build
```

## Setup Guide

### 1. Install & Configure VoiceForge

1. Install VoiceForge
2. Enter your ElevenLabs and OpenAI API keys in the **API Keys** tab
3. Configure at least one voice alias in the **Voices** tab

> **AI Moderation Note:** For reliable content moderation, I recommend using **GPT-5** or **GPT-5 mini**. If you enable [OpenAI data sharing](https://help.openai.com/en/articles/10306912-sharing-feedback-evaluation-and-fine-tuning-data-and-api-inputs-and-outputs-with-openai), you receive free API tokens daily — typically more than enough to run TTS moderation at no cost, even with heavy usage.

### 2. Set Up Streamer.bot (TTS)

1. Import `VoiceForge-TTS.sb` from the `streamerbot-extension/` folder into Streamer.bot
2. Edit the `ttsAlias` sub-action — set it to the voice alias you configured in VoiceForge
3. Add a **Channel Point Redemption** trigger (the reward must require text input)
4. For additional voices, import `VoiceForge-TTS.sb` again with a different alias and trigger

> **Important:** Channel point rewards must be created through Streamer.bot (not the Twitch dashboard) for refunds to work. See the [Extension Guide](streamerbot-extension/README.md#channel-points-setup) for details.

### 3. (Optional) OBS Overlay

1. Import `VoiceForge-Actions.sb` into Streamer.bot
2. Edit the **VoiceForge - Show** and **VoiceForge - Hide** actions — select your OBS Scene and Source in each sub-action
3. In VoiceForge → **Connections** tab, enter the Show and Hide action IDs

### 4. (Optional) Refunds

1. In VoiceForge → **Connections** tab, enter the Refund action ID (from the `VoiceForge - Refund` action imported in step 3)

> When TTS is blocked by moderation, VoiceForge will automatically refund the viewer's channel points and notify them in chat.

For the full setup guide with troubleshooting, see the [Streamer.bot Extension Guide](streamerbot-extension/README.md).

## Streamer.bot Integration

VoiceForge receives TTS requests from [Streamer.bot](https://streamer.bot/) via WebSocket. Viewers redeem channel points with a text message, Streamer.bot forwards it to VoiceForge, and VoiceForge handles the rest — moderation, text processing, TTS generation, and playback.

The `streamerbot-extension/` folder contains ready-to-import action files and detailed setup instructions.

## Configuration

All settings are accessible through the app's UI:

| Tab | Description |
|-----|-------------|
| Queue | View and manage the TTS queue |
| History | View past TTS messages, replay or refund |
| API Keys | ElevenLabs and OpenAI API keys |
| Connections | WebSocket server and Streamer.bot settings |
| Voices | Voice aliases with per-voice overrides |
| Text Processing | Sanitization, replacements, length limits |
| AI Processing | GPT moderation, emotion enhancement, topics |
| General | OBS integration, manual moderation mode |

## Screenshots



## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).

## Credits

- Built with [Electron](https://www.electronjs.org/), [Vue 3](https://vuejs.org/), and [Quasar](https://quasar.dev/)
- TTS powered by [ElevenLabs](https://elevenlabs.io/)
- AI processing powered by [OpenAI](https://platform.openai.com/)
- Twitch integration via [Streamer.bot](https://streamer.bot/)

---

Made by [Flavionel](https://www.twitch.tv/flavionel)
