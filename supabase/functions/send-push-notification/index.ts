import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_id: string;
}

// Web Push utilities using Web Crypto API (no npm dep needed in Deno)
async function sendWebPush(
  subscription: PushSubscription,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
) {
  const endpoint = subscription.endpoint;
  const audience = new URL(endpoint).origin;

  // Create VAPID JWT
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: vapidSubject,
  };

  const encodedHeader = base64urlEncode(
    new TextEncoder().encode(JSON.stringify(header))
  );
  const encodedClaims = base64urlEncode(
    new TextEncoder().encode(JSON.stringify(claims))
  );
  const unsignedToken = `${encodedHeader}.${encodedClaims}`;

  // Import private key
  const privateKeyBytes = base64urlDecode(vapidPrivateKey);
  const publicKeyBytes = base64urlDecode(vapidPublicKey);

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: base64urlEncode(publicKeyBytes.slice(1, 33)),
      y: base64urlEncode(publicKeyBytes.slice(33, 65)),
      d: base64urlEncode(privateKeyBytes),
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format if needed
  const sigBytes = new Uint8Array(signature);
  const rawSig = sigBytes.length === 64 ? sigBytes : derToRaw(sigBytes);
  const encodedSignature = base64urlEncode(rawSig);
  const jwt = `${unsignedToken}.${encodedSignature}`;

  // Encrypt payload using subscription keys
  const payloadBytes = new TextEncoder().encode(payload);
  const encrypted = await encryptPayload(
    payloadBytes,
    subscription.p256dh,
    subscription.auth
  );

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${base64urlEncode(publicKeyBytes)}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
    },
    body: encrypted,
  });

  if (!response.ok && response.status === 410) {
    // Subscription expired, should be cleaned up
    return { expired: true, status: response.status };
  }

  return { expired: false, status: response.status };
}

async function encryptPayload(
  payload: Uint8Array,
  p256dhKey: string,
  authSecret: string
) {
  const userPublicKeyBytes = base64urlDecode(p256dhKey);
  const authBytes = base64urlDecode(authSecret);

  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const localPublicKey = await crypto.subtle.exportKey(
    "raw",
    localKeyPair.publicKey
  );
  const localPublicKeyBytes = new Uint8Array(localPublicKey);

  // Import user's public key
  const userPublicKey = await crypto.subtle.importKey(
    "raw",
    userPublicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: userPublicKey },
    localKeyPair.privateKey,
    256
  );

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive encryption key using HKDF
  const sharedSecretKey = await crypto.subtle.importKey(
    "raw",
    sharedSecret,
    { name: "HKDF" },
    false,
    ["deriveBits"]
  );

  // auth_info = "WebPush: info" || 0x00 || ua_public || as_public
  const authInfo = new Uint8Array([
    ...new TextEncoder().encode("WebPush: info\0"),
    ...userPublicKeyBytes,
    ...localPublicKeyBytes,
  ]);

  // IKM = HKDF(auth, shared_secret, auth_info, 32)
  const authSecretKey = await crypto.subtle.importKey(
    "raw",
    authBytes,
    { name: "HKDF" },
    false,
    ["deriveBits"]
  );

  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: new Uint8Array(sharedSecret),
        info: authInfo,
      },
      authSecretKey,
      256
    )
  );

  // PRK = HKDF-Extract(salt, IKM)
  const ikmKey = await crypto.subtle.importKey(
    "raw",
    ikm,
    { name: "HKDF" },
    false,
    ["deriveBits"]
  );

  // CEK = HKDF-Expand(PRK, "Content-Encoding: aes128gcm" || 0x01, 16)
  const cekInfo = new Uint8Array([
    ...new TextEncoder().encode("Content-Encoding: aes128gcm\0\x01"),
  ]);
  const cekBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: cekInfo },
    ikmKey,
    128
  );

  // Nonce = HKDF-Expand(PRK, "Content-Encoding: nonce" || 0x01, 12)
  const nonceInfo = new Uint8Array([
    ...new TextEncoder().encode("Content-Encoding: nonce\0\x01"),
  ]);
  const nonceBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: nonceInfo },
    ikmKey,
    96
  );

  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey(
    "raw",
    cekBits,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  // Add padding delimiter
  const paddedPayload = new Uint8Array([...payload, 2]);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonceBits },
    aesKey,
    paddedPayload
  );

  // Build aes128gcm header: salt(16) || rs(4) || idlen(1) || keyid(65) || ciphertext
  const rs = new ArrayBuffer(4);
  new DataView(rs).setUint32(0, 4096);

  const header = new Uint8Array([
    ...salt,
    ...new Uint8Array(rs),
    localPublicKeyBytes.length,
    ...localPublicKeyBytes,
  ]);

  const result = new Uint8Array(header.length + encrypted.byteLength);
  result.set(header);
  result.set(new Uint8Array(encrypted), header.length);

  return result;
}

function base64urlEncode(bytes: Uint8Array | ArrayBuffer): string {
  const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of uint8) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function derToRaw(der: Uint8Array): Uint8Array {
  // DER: 0x30 len 0x02 rLen r 0x02 sLen s
  const raw = new Uint8Array(64);
  let offset = 2;
  // skip 0x30 and total length
  offset += 1; // 0x02
  const rLen = der[offset++];
  const rStart = rLen > 32 ? offset + (rLen - 32) : offset;
  const rPad = rLen < 32 ? 32 - rLen : 0;
  raw.set(der.slice(rStart, offset + rLen), rPad);
  offset += rLen;
  offset += 1; // 0x02
  const sLen = der[offset++];
  const sStart = sLen > 32 ? offset + (sLen - 32) : offset;
  const sPad = sLen < 32 ? 32 - sLen : 0;
  raw.set(der.slice(sStart, offset + sLen), 32 + sPad);
  return raw;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const record = body.record;

    if (!record?.id || !record?.channel_id || !record?.user_id || !record?.content) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject = "https://dhbracketclub.lovable.app";

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

    // Check notification preferences - filter out users who disabled chat_messages
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
      return new Response(JSON.stringify({ sent: 0, filtered: subscriptions.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notificationPayload = JSON.stringify({
      title: `${senderName} in #${channelName}`,
      body: preview,
      data: { url: `/chat?channel=${record.channel_id}` },
      icon: "/pwa-icon-512.png",
    });

    const expiredEndpoints: string[] = [];
    let sent = 0;

    for (const sub of subscriptions) {
      try {
        const result = await sendWebPush(
          sub as PushSubscription,
          notificationPayload,
          vapidPublicKey,
          vapidPrivateKey,
          vapidSubject
        );
        if (result.expired) {
          expiredEndpoints.push(sub.endpoint);
        } else if (result.status >= 200 && result.status < 300) {
          sent++;
        }
      } catch (e) {
        console.error("Push send error:", e);
      }
    }

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);
    }

    return new Response(JSON.stringify({ sent, expired: expiredEndpoints.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Push notification error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
