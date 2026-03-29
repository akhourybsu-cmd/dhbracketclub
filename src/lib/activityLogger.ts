import { supabase } from '@/integrations/supabase/client';

type ActivityEvent = {
  event_type: string;
  target_type?: string;
  target_id?: string;
  metadata?: Record<string, any>;
};

export async function logActivity(userId: string, event: ActivityEvent) {
  try {
    await supabase.from('activity_feed').insert({
      actor_user_id: userId,
      event_type: event.event_type,
      target_type: event.target_type || null,
      target_id: event.target_id || null,
      metadata: event.metadata || null,
    });
  } catch (e) {
    console.warn('Failed to log activity:', e);
  }
}
