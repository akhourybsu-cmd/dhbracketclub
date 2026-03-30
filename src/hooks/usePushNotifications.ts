import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function normalizeBase64Url(value: string): string {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function fetchVapidPublicKey(): Promise<string> {
  const { data, error } = await supabase.functions.invoke('send-push-notification', {
    body: { action: 'get_vapid_public_key' },
  });

  if (error) throw error;

  const key = data?.vapidPublicKey;
  if (!key || typeof key !== 'string') {
    throw new Error('Missing VAPID public key');
  }

  return key;
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

  useEffect(() => {
    if (!isSupported || !user) return;

    const checkSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          setIsSubscribed(false);
          return;
        }

        const vapidPublicKey = await fetchVapidPublicKey();
        const existingServerKey = subscription.options.applicationServerKey;
        const existingKeyBase64 = existingServerKey ? arrayBufferToBase64Url(existingServerKey) : null;

        if (!existingKeyBase64 || normalizeBase64Url(existingKeyBase64) !== normalizeBase64Url(vapidPublicKey)) {
          await supabase.from('push_subscriptions').delete().eq('user_id', user.id);
          await subscription.unsubscribe();
          setIsSubscribed(false);
          return;
        }

        const { data } = await supabase
          .from('push_subscriptions')
          .select('id')
          .eq('endpoint', subscription.endpoint)
          .eq('user_id', user.id)
          .maybeSingle();

        setIsSubscribed(!!data);
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
      if (perm !== 'granted') return false;

      const registration = await navigator.serviceWorker.ready;
      const vapidPublicKey = await fetchVapidPublicKey();
      const desiredKey = urlBase64ToUint8Array(vapidPublicKey);

      let subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        subscription = null;
      }

      await supabase.from('push_subscriptions').delete().eq('user_id', user.id);

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: desiredKey as BufferSource,
      });

      const key = subscription.getKey('p256dh');
      const auth = subscription.getKey('auth');
      if (!key || !auth) throw new Error('Missing subscription keys');

      const p256dh = arrayBufferToBase64Url(key);
      const authStr = arrayBufferToBase64Url(auth);

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
      return true;
    } catch (err) {
      console.error('Push subscribe error:', err);
      return false;
    } finally {
      setLoading(false);
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
          .eq('endpoint', subscription.endpoint)
          .eq('user_id', user.id);
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error('Push unsubscribe error:', err);
    } finally {
      setLoading(false);
    }
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
