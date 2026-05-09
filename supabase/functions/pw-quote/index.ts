// Lightweight ticker quote proxy (Finnhub).
// Used by Portfolio Wars picker to validate symbols & show latest price.
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const FINNHUB = "https://finnhub.io/api/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") || "").toUpperCase().trim();
  if (!symbol || !/^[A-Z.\-]{1,8}$/.test(symbol)) {
    return new Response(JSON.stringify({ error: "Invalid symbol" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const key = Deno.env.get("FINNHUB_API_KEY");
  if (!key) {
    return new Response(JSON.stringify({ error: "FINNHUB_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const res = await fetch(`${FINNHUB}/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`);
    const data = await res.json();
    // Finnhub /quote: c=current, o=open, h=high, l=low, pc=prev close
    return new Response(JSON.stringify({
      symbol,
      current: data.c ?? null,
      open: data.o ?? null,
      prev_close: data.pc ?? null,
      high: data.h ?? null,
      low: data.l ?? null,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
