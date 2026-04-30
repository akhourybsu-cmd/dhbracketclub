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
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: "Missing VAPID config" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    webpush.setVapidDetails("https://dryhorse.app", vapidPublicKey, vapidPrivateKey);
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find today's lockbox day
    const now = new Date();
    const yearStart = new Date(Date.UTC(now.getFullYear(), 0, 1));
    const startOfDay = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayOfYear = Math.ceil((startOfDay.getTime() - yearStart.getTime()) / 86400000) + 1;

    const { data: day } = await supabase
      .from("lockbox_weeks")
      .select("id")
      .eq("week_number", dayOfYear)
      .eq("year", now.getFullYear())
      .maybeSingle();

    if (!day) {
      return new Response(JSON.stringify({ message: "No active day found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all users who have created a lock today
    const { data: todayLocks } = await supabase
      .from("lockbox_locks")
      .select("user_id")
      .eq("week_id", day.id);

    const usersWithLocks = new Set((todayLocks || []).map((l: any) => l.user_id));

    // Get all push subscriptions
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, user_id");

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check lockbox notification preferences
    const userIds = [...new Set(subscriptions.map((s: any) => s.user_id))];
    const { data: prefRows } = await supabase
      .from("notification_preferences")
      .select("user_id, lockbox")
      .in("user_id", userIds);

    const disabledUsers = new Set(
      (prefRows || []).filter((p: any) => p.lockbox === false).map((p: any) => p.user_id),
    );

    // Only notify users who haven't set their lock yet and have lockbox notifications enabled
    const filtered = subscriptions.filter(
      (s: any) => !usersWithLocks.has(s.user_id) && !disabledUsers.has(s.user_id),
    );

    if (filtered.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "All users have locks or disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      title: "🔒 Don't Forget Your Lock!",
      body: "Set up today's Lockbox defense before time runs out.",
      tag: "dh-lockbox-reminder",
      data: { url: "/lockbox" },
      icon: "/pwa-icon-512.png",
    });

    const expiredEndpoints: string[] = [];
    let sent = 0;

    for (const sub of filtered) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent++;
      } catch (e: any) {
        const sc = typeof e?.statusCode === "number" ? e.statusCode : undefined;
        if (sc === 410 || sc === 404) expiredEndpoints.push(sub.endpoint);
      }
    }

    if (expiredEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
    }

    return new Response(JSON.stringify({ sent, expired: expiredEndpoints.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Lockbox reminder error:", error);
    return new Response(JSON.stringify({ error: error?.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
