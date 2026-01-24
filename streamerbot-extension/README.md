# VoiceForge - Streamer.bot Extension

Send TTS requests from Streamer.bot to VoiceForge via WebSocket.

---

## Files Included

| File | Description |
|------|-------------|
| `VoiceForge-TTS.sb` | Main TTS action — import this, set up your voices and triggers |
| `VoiceForge-Actions.sb` | Optional helper actions — Show/Hide OBS source, Refund channel points |
| `VoiceForge-Speak.cs` | C# source for the TTS WebSocket action (reference only) |
| `VoiceForge-Refund.cs` | C# source for the refund action (reference only) |

---

## Quick Start

### 1. Import the TTS Action

1. Open **Streamer.bot**
2. Click **Import** (top menu)
3. Drag and drop `VoiceForge-TTS.sb` into the Import dialog
4. Click **Import**

This creates a `VoiceForge - TTS` action.

### 2. Configure the Action

1. Edit the `ttsAlias` **Set Argument** sub-action — set its value to the voice alias you configured in VoiceForge (e.g., `Narrator`)
2. Add a **Trigger**: Right-click → **Add Trigger** → **Twitch → Channel Point Rewards → Reward Redemption**
3. Select your channel point reward

> **Important:** The channel point reward **must require text input** (so viewers can type their TTS message). If you want auto-refunds to work, the reward must be created through Streamer.bot — see [Channel Points Setup](#channel-points-setup).

> **Note:** Don't modify the other sub-actions unless you know what you're doing. If you changed VoiceForge's host/port, you can also edit the `ttsHost`/`ttsPort` arguments. Everything else is automatic.

### 3. Additional Voices

For each additional voice, repeat steps 1–2: import `VoiceForge-TTS.sb` again, rename the action (e.g., `VoiceForge - TTS Narrator`), set a different `ttsAlias`, and assign a different channel point reward.

### 4. (Optional) Import Helper Actions

1. Drag and drop `VoiceForge-Actions.sb` into the Import dialog
2. This adds three actions: **Show**, **Hide**, and **Refund**

---

## Channel Points Setup

> **Important:** Channel point redemptions **must be created through Streamer.bot** (not the Twitch dashboard) for refunds to work. This is a Twitch API requirement — only the application that created the reward can cancel/refund redemptions.

To create a channel point reward in Streamer.bot:

1. Go to **Platforms → Twitch → Channel Point Rewards**
2. Right-click → **Add**
3. Configure your reward (name, cost, require text input, etc.)

If you already have rewards created via Twitch dashboard and want refund support, delete them and recreate them in Streamer.bot.

---

## OBS Overlay Integration (Optional)

VoiceForge can show/hide an OBS source when TTS is playing. This is handled entirely through Streamer.bot's built-in OBS integration — VoiceForge just triggers the actions.

### How It Works

1. VoiceForge triggers the **Show** action (via action ID) when TTS starts playing
2. VoiceForge triggers the **Hide** action when TTS finishes
3. Each action uses Streamer.bot's **OBS Studio Source Visibility State** sub-action to control your source

### Setup

1. Import `VoiceForge-Actions.sb` (if you haven't already)
2. Open the **VoiceForge - Show** action — edit **all** sub-actions:
   - **OBS Studio GDI Text**: Select your **Scene** and **Source** (the text element that displays TTS text). The text value is set automatically — no parameter changes needed.
   - **OBS Studio Source Visibility State**: Select your **Scene** and **Source** (the element to show — can be a group, image, etc.)
3. Do the same for the **VoiceForge - Hide** action (same scene/source selections)
4. In VoiceForge app → **Connections** tab:
   - Enter the Show action ID (right-click action → Copy Action Id)
   - Enter the Hide action ID

### Animation Duration

If your OBS source has show/hide animations (transitions), configure the **Animation Duration** in VoiceForge's **General** tab. This ensures the queue timing accounts for animation durations and lingering time, so audio doesn't overlap with transitions.

---

## Refund Setup (Optional)

VoiceForge can automatically refund channel points when TTS is blocked by moderation or fails.

### Setup

1. Import `VoiceForge-Actions.sb` (if you haven't already)
2. In VoiceForge app → **Connections** tab:
   - Enter the Refund action ID (right-click `VoiceForge - Refund` → Copy Action Id)
3. Make sure VoiceForge is connected to Streamer.bot

### How It Works

When TTS is blocked or fails, VoiceForge automatically:
1. Triggers the `VoiceForge - Refund` action via Streamer.bot
2. Cancels the redemption (refunds the viewer's channel points)

### Customizing the Refund Action

The action already sends a chat message notifying the user their points were refunded. You can edit this message in the **Send Message to Channel** sub-action.

Available variables:

| Variable | Description |
|----------|-------------|
| `%redemptionId%` | Twitch redemption ID |
| `%rewardId%` | Twitch reward ID |
| `%username%` | Who redeemed |

---

## All Available Arguments

These are the **Set Argument** sub-actions inside the `VoiceForge - TTS` action.

### Required

| Argument | Description |
|----------|-------------|
| `ttsText` | The text to speak |

### Optional - Voice

| Argument | Description | Default |
|----------|-------------|---------|
| `ttsAlias` | Voice alias from VoiceForge app | (uses default voice) |

### Optional - Connection

Only change these if you modified VoiceForge settings.

| Argument | Description | Default |
|----------|-------------|---------|
| `ttsHost` | VoiceForge hostname | `localhost` |
| `ttsPort` | VoiceForge WebSocket port | `7591` |
| `ttsTimeout` | Connection timeout (seconds) | `5` |

### Optional - Channel Points Refund

These are auto-detected from the Channel Point Redemption trigger — no setup needed.

| Argument | Description | Default |
|----------|-------------|---------|
| `ttsRedemptionId` | Twitch redemption ID | (auto-detected from `%redemptionId%`) |
| `ttsRewardId` | Twitch reward ID | (auto-detected from `%rewardId%`) |

### Optional - Metadata

| Argument | Description | Default |
|----------|-------------|---------|
| `ttsUsername` | Who requested the TTS | (auto-detected from `%user%` or `%userName%`) |

---

## Other Triggers

VoiceForge is designed and tested with **Channel Point Redemptions**. Other Streamer.bot triggers (chat commands, bits, raids, etc.) may work if they provide the necessary variables, but are currently untested. Support for additional triggers may be added in future updates.

---

## Troubleshooting

### "Connection timeout" error
- Make sure VoiceForge is running
- Check port matches (default: 7591)
- If you changed the port in VoiceForge, set `ttsPort` argument

### "No ttsText argument provided"
- Add a "Set Argument" sub-action with `ttsText` before calling the action
- Make sure variable name is exactly `ttsText` (case-sensitive)

### TTS not playing
- Check VoiceForge Queue tab — is the request arriving?
- Check VoiceForge History tab for errors
- Verify your ElevenLabs API key is configured

### Refund not working
- Make sure the channel point reward was created through Streamer.bot (not Twitch dashboard)
- Verify the Refund action ID is set in VoiceForge → Connections tab
- Check Streamer.bot logs for errors

---

## Support

For issues, visit the [VoiceForge GitHub repository](../../).
