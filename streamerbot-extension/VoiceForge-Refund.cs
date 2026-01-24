/*
 * VoiceForge - Refund Action
 *
 * Cancels a Twitch channel point redemption (refunds points to the user).
 * Called by VoiceForge when TTS is blocked or fails.
 *
 * ARGUMENTS (passed automatically by VoiceForge via DoAction):
 *   - redemptionId : The Twitch redemption ID to cancel
 *   - rewardId     : The Twitch reward ID
 *   - username     : Who redeemed (for chat message)
 *   - reason       : Why the TTS was rejected (for logging)
 *
 * IMPORTANT:
 *   The channel point reward MUST be created/owned by Streamerbot
 *   for cancellation to work (Twitch API requirement).
 */

using System;

public class CPHInline
{
    public bool Execute()
    {
        string rewardId = args.ContainsKey("rewardId") ? args["rewardId"].ToString() : "";
        string redemptionId = args.ContainsKey("redemptionId") ? args["redemptionId"].ToString() : "";
        string username = args.ContainsKey("username") ? args["username"].ToString() : "unknown";
        string reason = args.ContainsKey("reason") ? args["reason"].ToString() : "TTS request failed";

        if (string.IsNullOrEmpty(rewardId) || string.IsNullOrEmpty(redemptionId))
        {
            CPH.LogWarn("[VoiceForge] Cannot refund - missing rewardId or redemptionId");
            return false;
        }

        try
        {
            CPH.TwitchRedemptionCancel(rewardId, redemptionId);
            CPH.LogInfo($"[VoiceForge] Refunded channel points for {username} (reason: {reason})");
            return true;
        }
        catch (Exception ex)
        {
            CPH.LogError($"[VoiceForge] Failed to refund: {ex.Message}");
            return false;
        }
    }
}
