import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    webpush.setVapidDetails(
      "https://dhbracketclub.lovable.app",
      vapidPublicKey,
      vapidPrivateKey
    );

    const body = await req.json();

    // Support both { record } (client-side) and { type, table, record } (legacy trigger) formats
    const record = body.record;

    // Test notification mode
    if (body.test && body.user_id) {
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth, user_id")
        .eq("user_id", body.user_id);

      if (!subscriptions || subscriptions.length === 0) {
        return new Response(
          JSON.stringify({ error: "No push subscription found. Make sure notifications are enabled." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const testPayload = JSON.stringify({
        title: "🔔 Test Notification",
        body: "Push notifications are working!",
        data: { url: "/profile" },
        icon: "/pwa-icon-512.png",
      });

      let sent = 0;
      const expiredEndpoints: string[] = [];
      const failedDeliveries: Array<{ statusCode?: number; body?: string }> = [];

      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            testPayload
          );
          sent++;
        } catch (e: any) {
          const statusCode = typeof e?.statusCode === "number" ? e.statusCode : undefined;
          const body = typeof e?.body === "string" ? e.body : undefined;
          console.error("Test push error:", statusCode, body);
          failedDeliveries.push({ statusCode, body });

          if (statusCode === 410 || statusCode === 404) {
            expiredEndpoints.push(sub.endpoint);
          }
        }
      }

      if (expiredEndpoints.length > 0) {
        await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
      }

      if (sent === 0 && failedDeliveries.length > 0) {
        const vapidMismatch = failedDeliveries.some((failure) => failure.statusCode === 403);
        return new Response(
          JSON.stringify({
            sent,
            expired: expiredEndpoints.length,
            error: vapidMismatch
              ? "Subscription key mismatch detected. Turn Push Notifications off and on, then try again."
              : "No notifications were delivered. Please re-enable Push Notifications and try again.",
            code: vapidMismatch ? "VAPID_MISMATCH" : "DELIVERY_FAILED",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ sent, expired: expiredEndpoints.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normal message notification flow
    if (!record?.id || !record?.channel_id || !record?.user_id || !record?.content) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get sender profile and channel name
    const [{ data: sender }, { data: channel }] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", record.user_id).single(),
      supabase.from("channels").select("name").eq("id", record.channel_id).single(),
    ]);

    const senderName = sender?.display_name || "Someone";
    const channelName = channel?.name || "chat";
    const preview = record.content.length > 80 ? record.content.slice(0, 80) + "…" : record.content;

    // Get all push subscriptions except sender's
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, user_id")
      .neq("user_id", record.user_id);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check notification preferences
    const userIds = [...new Set(subscriptions.map((s: any) => s.user_id))];
    const { data: prefRows } = await supabase
      .from("notification_preferences")
      .select("user_id, chat_messages")
      .in("user_id", userIds);

    const disabledUsers = new Set(
      (prefRows || [])
        .filter((p: any) => p.chat_messages === false)
        .map((p: any) => p.user_id)
    );

    const filteredSubscriptions = subscriptions.filter(
      (s: any) => !disabledUsers.has(s.user_id)
    );

    if (filteredSubscriptions.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, filtered: subscriptions.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const notificationPayload = JSON.stringify({
      title: `${senderName} in #${channelName}`,
      body: preview,
      data: { url: `/chat?channel=${record.channel_id}` },
      icon: "/pwa-icon-512.png",
    });

    const expiredEndpoints: string[] = [];
    let sent = 0;

    for (const sub of filteredSubscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notificationPayload
        );
        sent++;
      } catch (e: any) {
        console.error("Push send error:", e.statusCode, e.body);
        if (e.statusCode === 410 || e.statusCode === 404) {
          expiredEndpoints.push(sub.endpoint);
        }
      }
    }

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
    }

    return new Response(
      JSON.stringify({ sent, expired: expiredEndpoints.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Push notification error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
