# DEV: Building the Streamer.bot Extension Files

Instructions for the maintainer to create/rebuild the distributable `.sb` export files.

---

## File 1: VoiceForge-TTS.sb

Contains the TTS action with all necessary sub-actions (arguments + C# WebSocket code).

### Action: `VoiceForge - TTS`

1. Go to **Actions** tab → Right-click → **Add**
2. Name: `VoiceForge - TTS`, Group: `VoiceForge`
3. Add sub-actions:
   - **Core → Arguments → Set Argument**: Variable `ttsText`, Value `%rawInput%`
   - **Core → Arguments → Set Argument**: Variable `ttsAlias`, Value _(leave empty for default voice)_
   - **Core → Arguments → Set Argument**: Variable `ttsHost`, Value `localhost`
   - **Core → Arguments → Set Argument**: Variable `ttsPort`, Value `7591`
   - **Core → Arguments → Set Argument**: Variable `ttsTimeout`, Value `5`
   - **Core → C# → Execute C# Code**:
     - Name: `Send TTS Request`
     - Paste contents of `VoiceForge-Speak.cs`
     - Click **Compile** → "Compiled successfully!"
     - Check **Precompile on Application Start**

### Export

1. Select `VoiceForge - TTS` → Right-click → **Add to Export**
2. **Export** (top menu) → **Export to File** → Save as `VoiceForge-TTS.sb`

---

## File 2: VoiceForge-Actions.sb

Contains optional helper actions for OBS overlay control and channel point refunds.

### Action: `VoiceForge - Show`

1. Right-click → **Add**
2. Name: `VoiceForge - Show`, Group: `VoiceForge`
3. Click **+** → **OBS → Source → Set Source Visibility State**
   - Scene: _(select any scene — users will change this to their own)_
   - Source: _(select any source — users will change this to their own)_
   - State: **Visible**

### Action: `VoiceForge - Hide`

1. Right-click → **Add**
2. Name: `VoiceForge - Hide`, Group: `VoiceForge`
3. Click **+** → **OBS → Source → Set Source Visibility State**
   - Scene: _(same as above)_
   - Source: _(same as above)_
   - State: **Hidden**

### Action: `VoiceForge - Refund`

1. Right-click → **Add**
2. Name: `VoiceForge - Refund`, Group: `VoiceForge`
3. Click **+** → **Core → C# → Execute C# Code**
   - Name: `Cancel Redemption`
   - Paste contents of `VoiceForge-Refund.cs`
   - Click **Compile** → "Compiled successfully!"
   - Check **Precompile on Application Start**
4. (Optional) Click **+** → **Twitch → Chat → Send Message to Channel**
   - Message: `@%username% Your TTS request couldn't be processed. Your points have been refunded!`

### Export

1. Select `VoiceForge - Show` → Right-click → **Add to Export**
2. Select `VoiceForge - Hide` → Right-click → **Add to Export**
3. Select `VoiceForge - Refund` → Right-click → **Add to Export**
4. **Export** (top menu) → **Export to File** → Save as `VoiceForge-Actions.sb`

---

## Testing the Exports

1. Delete all VoiceForge actions from Streamer.bot
2. Import `VoiceForge-TTS.sb` — verify Speak + example action imported, C# compiled
3. Import `VoiceForge-Actions.sb` — verify Show/Hide/Refund imported
4. Configure Show/Hide with your OBS Scene/Source
5. Set action IDs in VoiceForge → Connections tab
6. Test full flow: channel point redemption → TTS → OBS show → audio plays → OBS hide

---

## Summary

| File | Actions Included | Purpose |
|------|-----------------|---------|
| `VoiceForge-TTS.sb` | VoiceForge - TTS | Core TTS action (arguments + C# code) |
| `VoiceForge-Actions.sb` | Show, Hide, Refund | Optional OBS overlay + refund helpers |