import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// VAPID public key - this is safe to embed client-side
const VAPID_PUBLIC_KEY = 'BK65iZjfs07Tc1aTr4os8pQ3NlQ-tgteaFbFcVbIOh8t9HLLanvoCUp_AfYwjfoauiJ4mKIebV1inCpQu-aqdmc';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  // Check existing subscription
  useEffect(() => {
    if (!isSupported || !user) return;

    const checkSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          // Verify it exists in DB
          const { data } = await supabase
            .from('push_subscriptions')
            .select('id')
            .eq('endpoint', subscription.endpoint)
            .eq('user_id', user.id)
            .maybeSingle();
          setIsSubscribed(!!data);
        } else {
          setIsSubscribed(false);
        }
      } catch {
        setIsSubscribed(false);
      }
    };

    checkSubscription();
  }, [isSupported, user]);

  const subscribe = useCallback(async () => {
    if (!user || !isSupported) return false;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setLoading(false);
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const key = subscription.getKey('p256dh');
      const auth = subscription.getKey('auth');
      if (!key || !auth) throw new Error('Missing subscription keys');

      const p256dh = btoa(String.fromCharCode(...new Uint8Array(key)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const authStr = btoa(String.fromCharCode(...new Uint8Array(auth)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      // Upsert subscription
      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh,
          auth: authStr,
        },
        { onConflict: 'endpoint' }
      );

      if (error) throw error;
      setIsSubscribed(true);
      setLoading(false);
      return true;
    } catch (err) {
      console.error('Push subscribe error:', err);
      setLoading(false);
      return false;
    }
  }, [user, isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', subscription.endpoint);
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error('Push unsubscribe error:', err);
    }
    setLoading(false);
  }, [user]);

  return {
    isSupported,
    isSubscribed,
    permission,
    loading,
    subscribe,
    unsubscribe,
  };
}
