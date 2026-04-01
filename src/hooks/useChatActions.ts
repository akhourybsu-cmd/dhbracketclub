import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { toast } from 'sonner';
import type { Message } from '@/components/chat/types';

export function useChatActions(userId: string | undefined) {
  const { play } = useSoundEffect();

  // Edit state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!userId) return;
    play('tap');
    const { data: existing } = await supabase
      .from('message_reactions').select('id')
      .eq('message_id', messageId).eq('user_id', userId).eq('emoji', emoji)
      .maybeSingle();
    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('message_reactions').insert({ message_id: messageId, user_id: userId, emoji });
    }
  }, [userId, play]);

  const togglePin = useCallback(async (msg: Message) => {
    if (!userId) return;
    play('tap');
    const wasPinned = msg.is_pinned;
    const { error } = await supabase.rpc('toggle_message_pin', { p_message_id: msg.id });
    if (error) {
      toast.error('Failed to pin message');
    } else {
      toast.success(wasPinned ? 'Unpinned' : 'Pinned');
    }
  }, [userId, play]);

  const deleteMessage = useCallback(async (msgId: string) => {
    // DB cascades handle replies and reactions automatically
    await supabase.from('messages').delete().eq('id', msgId);
  }, []);

  const startEditing = useCallback((msg: Message) => {
    setEditingMessageId(msg.id);
    setEditContent(msg.content);
  }, []);

  const handleSaveEdit = useCallback(async (msgId: string, content: string) => {
    if (!content.trim()) return;
    play('tap');
    await supabase.from('messages').update({ content: content.trim(), edited_at: new Date().toISOString() }).eq('id', msgId);
    setEditingMessageId(null);
    setEditContent('');
    toast.success('Message edited');
  }, [play]);

  const cancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditContent('');
  }, []);

  return {
    play,
    toggleReaction,
    togglePin,
    deleteMessage,
    startEditing,
    handleSaveEdit,
    editingMessageId,
    editContent,
    setEditContent,
    cancelEdit,
  };
}
