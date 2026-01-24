/*
 * VoiceForge - Speak Action
 *
 * Sends TTS requests to VoiceForge application via WebSocket.
 *
 * ALL ARGUMENTS (set via "Set Argument" sub-action before calling this action):
 *
 *   REQUIRED:
 *   - ttsText       : The text to speak
 *
 *   OPTIONAL - Voice:
 *   - ttsAlias      : Voice alias configured in VoiceForge (uses default if not set)
 *
 *   OPTIONAL - Connection (only change if you modified VoiceForge settings):
 *   - ttsHost       : VoiceForge host (default: localhost)
 *   - ttsPort       : VoiceForge port (default: 7591)
 *   - ttsTimeout    : Connection timeout in seconds (default: 5)
 *
 *   OPTIONAL - Channel Points Refund (auto-detected from Channel Point Redemption trigger):
 *   - ttsRedemptionId : Twitch redemption ID (auto-detects from %redemptionId%)
 *   - ttsRewardId     : Twitch reward ID (auto-detects from %rewardId%)
 *
 *   OPTIONAL - Metadata (auto-detected from trigger if not set):
 *   - ttsUsername   : Who requested the TTS (auto-detects from %user% or %userName%)
 *
 * REFERENCES NEEDED:
 *   - System.dll (usually already available)
 *   - System.Net.WebSockets (included in System.dll)
 */

using System;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

public class CPHInline
{
    public bool Execute()
    {
        // ============ GET CONFIGURATION FROM ARGUMENTS ============
        // Connection settings (with defaults)
        string host = GetArgString("ttsHost", "localhost");
        int port = GetArgInt("ttsPort", 7591);
        int timeout = GetArgInt("ttsTimeout", 5);
        string wsUrl = $"ws://{host}:{port}";

        // ============ GET TTS ARGUMENTS ============
        // ttsText is required
        string text = GetArgString("ttsText", "");
        if (string.IsNullOrWhiteSpace(text))
        {
            CPH.LogWarn("[VoiceForge] No ttsText argument provided. Skipping TTS.");
            return false;
        }

        // ttsAlias is optional (VoiceForge will use default voice if not provided)
        string alias = GetArgString("ttsAlias", "");

        // ttsUsername - try explicit argument first, then common Streamerbot variables
        string username = GetArgString("ttsUsername", "");
        if (string.IsNullOrEmpty(username))
        {
            username = GetArgString("user", "");
        }
        if (string.IsNullOrEmpty(username))
        {
            username = GetArgString("userName", "");
        }

        // Channel points refund data (auto-detected from trigger, or set manually)
        string redemptionId = GetArgString("ttsRedemptionId", "");
        if (string.IsNullOrEmpty(redemptionId))
        {
            redemptionId = GetArgString("redemptionId", "");
        }
        string rewardId = GetArgString("ttsRewardId", "");
        if (string.IsNullOrEmpty(rewardId))
        {
            rewardId = GetArgString("rewardId", "");
        }

        // ============ SEND TO STREAMTTS ============
        try
        {
            SendTTSRequest(wsUrl, timeout, text, alias, username, redemptionId, rewardId).GetAwaiter().GetResult();
            CPH.LogInfo($"[VoiceForge] Sent TTS to {wsUrl}: \"{TruncateForLog(text, 50)}\" (voice: {(string.IsNullOrEmpty(alias) ? "default" : alias)})");
            return true;
        }
        catch (Exception ex)
        {
            CPH.LogError($"[VoiceForge] Failed to send TTS request: {ex.Message}");
            return false;
        }
    }

    private string GetArgString(string key, string defaultValue)
    {
        if (args.ContainsKey(key) && args[key] != null)
        {
            string val = args[key].ToString();
            if (!string.IsNullOrEmpty(val))
                return val;
        }
        return defaultValue;
    }

    private int GetArgInt(string key, int defaultValue)
    {
        if (args.ContainsKey(key) && args[key] != null)
        {
            if (int.TryParse(args[key].ToString(), out int val))
                return val;
        }
        return defaultValue;
    }

    private async Task SendTTSRequest(string wsUrl, int timeout, string text, string alias, string username, string redemptionId, string rewardId)
    {
        // Build JSON payload with proper escaping
        string jsonPayload = BuildJsonPayload(text, alias, username, redemptionId, rewardId);

        using (var client = new ClientWebSocket())
        {
            // Connect with timeout
            var connectCts = new CancellationTokenSource(TimeSpan.FromSeconds(timeout));

            try
            {
                await client.ConnectAsync(new Uri(wsUrl), connectCts.Token);
            }
            catch (OperationCanceledException)
            {
                throw new Exception($"Connection timeout - is VoiceForge running on {wsUrl}?");
            }
            catch (WebSocketException wex)
            {
                throw new Exception($"Cannot connect to VoiceForge at {wsUrl}: {wex.Message}");
            }

            if (client.State != WebSocketState.Open)
            {
                throw new Exception($"WebSocket connection failed. State: {client.State}");
            }

            // Send message
            var messageBuffer = Encoding.UTF8.GetBytes(jsonPayload);
            var segment = new ArraySegment<byte>(messageBuffer);

            var sendCts = new CancellationTokenSource(TimeSpan.FromSeconds(timeout));
            await client.SendAsync(segment, WebSocketMessageType.Text, true, sendCts.Token);

            // Close gracefully
            var closeCts = new CancellationTokenSource(TimeSpan.FromSeconds(timeout));
            await client.CloseAsync(WebSocketCloseStatus.NormalClosure, "TTS request sent", closeCts.Token);
        }
    }

    private string BuildJsonPayload(string text, string alias, string username, string redemptionId, string rewardId)
    {
        // Escape special characters for JSON
        string escapedText = EscapeJsonString(text);
        string escapedAlias = EscapeJsonString(alias);
        string escapedUsername = EscapeJsonString(username);

        // Build JSON object
        var sb = new StringBuilder();
        sb.Append("{");
        sb.Append("\"type\":\"TTS\"");
        sb.Append($",\"text\":\"{escapedText}\"");

        if (!string.IsNullOrEmpty(alias))
        {
            sb.Append($",\"alias\":\"{escapedAlias}\"");
        }

        if (!string.IsNullOrEmpty(username))
        {
            sb.Append($",\"username\":\"{escapedUsername}\"");
        }

        if (!string.IsNullOrEmpty(redemptionId))
        {
            sb.Append($",\"redemptionId\":\"{EscapeJsonString(redemptionId)}\"");
        }

        if (!string.IsNullOrEmpty(rewardId))
        {
            sb.Append($",\"rewardId\":\"{EscapeJsonString(rewardId)}\"");
        }

        sb.Append("}");

        return sb.ToString();
    }

    private string EscapeJsonString(string str)
    {
        if (string.IsNullOrEmpty(str)) return "";

        return str
            .Replace("\\", "\\\\")
            .Replace("\"", "\\\"")
            .Replace("\n", "\\n")
            .Replace("\r", "\\r")
            .Replace("\t", "\\t");
    }

    private string TruncateForLog(string text, int maxLength)
    {
        if (string.IsNullOrEmpty(text)) return "";
        if (text.Length <= maxLength) return text;
        return text.Substring(0, maxLength) + "...";
    }
}
