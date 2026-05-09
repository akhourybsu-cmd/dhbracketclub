// Personal/actionable chat push helpers.
// Kept narrow on purpose: only thread-reply + reaction fan-outs, both
// targeted (never broadcast). Sender exclusion + dedupe is enforced
// here AND server-side in send-push-notification as defense-in-depth.

import { supabase } from '@/integrations/supabase/client';

const MENTION_RE = /@([\w][\w\s]*?)(?=\s@|\s|$)/g;

function extractMentionedUserIds(
  content: string,
  members: { id: string; display_name: string }[],
): string[] {
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = MENTION_RE.exec(content)) !== null) {
    names.add(m[1].trim().toLowerCase());
  }
  if (names.size === 0) return [];
  return members.filter((u) => names.has(u.display_name.toLowerCase())).map((u) => u.id);
}

/**
 * Notify only people personally connected to a thread reply:
 *   - the parent message author
 *   - prior repliers in the same thread
 *   - users explicitly @mentioned in the new reply
 * Sender is always excluded; recipients are deduped server-side.
 */
export async function notifyThreadReply(params: {
  parentMessageId: string;
  parentAuthorId: string;
  channelId: string;
  senderUserId: string;
  senderDisplayName: string;
  content: string;
  members: { id: string; display_name: string }[];
}) {
  const { parentMessageId, parentAuthorId, channelId, senderUserId, senderDisplayName, content, members } = params;

  // Prior thread participants (best-effort; failure shouldn't block UX)
  let priorParticipants: string[] = [];
  try {
    const { data } = await supabase
      .from('messages')
      .select('user_id')
      .eq('parent_message_id', parentMessageId);
    priorParticipants = (data || []).map((r: any) => r.user_id);
  } catch { /* ignore */ }

  const mentioned = extractMentionedUserIds(content, members);

  const recipients = Array.from(new Set([
    parentAuthorId,
    ...priorParticipants,
    ...mentioned,
  ])).filter((u) => u && u !== senderUserId);

  if (recipients.length === 0) return;

  const preview = content.length > 80 ? content.slice(0, 80) + '…' : content;

  await supabase.functions.invoke('send-push-notification', {
    body: {
      type: 'thread_reply',
      title: `${senderDisplayName} replied in a thread`,
      message: preview,
      // Tag-coalesce per-thread so a burst of replies groups into one
      // notification on the device (handled by sw-push.js).
      tag: `dh-thread-${parentMessageId}`,
      url: `/chat?channel=${channelId}&thread=${parentMessageId}`,
      sender_user_id: senderUserId,
      target_user_ids: recipients,
    },
  }).catch(() => {});
}

/**
 * Notify the original message author when someone reacts to their message.
 * Self-reactions are skipped. Per-message tag groups bursts on device.
 */
export async function notifyReaction(params: {
  messageId: string;
  channelId: string;
  authorId: string;
  reactorId: string;
  reactorDisplayName: string;
  emoji: string;
}) {
  const { messageId, channelId, authorId, reactorId, reactorDisplayName, emoji } = params;
  if (!authorId || authorId === reactorId) return;

  await supabase.functions.invoke('send-push-notification', {
    body: {
      type: 'reaction',
      title: `${reactorDisplayName} reacted ${emoji}`,
      message: 'to your message',
      tag: `dh-react-${messageId}`,
      url: `/chat?channel=${channelId}&message=${messageId}`,
      sender_user_id: reactorId,
      target_user_ids: [authorId],
    },
  }).catch(() => {});
}
