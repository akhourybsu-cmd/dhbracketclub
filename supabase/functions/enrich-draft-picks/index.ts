import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPPORTED_CATEGORIES = [
  "movie", "tv", "book", "music", "food", "brand", "place",
  "sport", "game", "person", "animal", "generic",
] as const;
type Category = typeof SUPPORTED_CATEGORIES[number];

interface EnrichmentResult {
  normalized_name: string;
  matched_name: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
  source_provider: string;
  confidence: number;
  metadata: Record<string, unknown>;
  status: "matched" | "low_confidence" | "placeholder";
}

// ─── AI Classification ───
async function classifyDraft(
  apiKey: string,
  topic: string,
  description: string | null,
  pickTexts: string[]
): Promise<{ category: Category; confidence: number }> {
  const prompt = `Classify this draft/competition topic into exactly one category.

Topic: "${topic}"
${description ? `Description: "${description}"` : ""}
Sample picks: ${pickTexts.slice(0, 8).join(", ")}

Categories: movie, tv, book, music, food, brand, place, sport, game, person, animal, generic

Return ONLY the category and your confidence (0.0-1.0).`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: "You classify competition topics. Respond only with JSON via the tool call." },
        { role: "user", content: prompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "classify",
          description: "Return classification result",
          parameters: {
            type: "object",
            properties: {
              category: { type: "string", enum: [...SUPPORTED_CATEGORIES] },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["category", "confidence"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "classify" } },
    }),
  });

  if (!response.ok) return { category: "generic", confidence: 0.3 };
  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) return { category: "generic", confidence: 0.3 };
  return JSON.parse(toolCall.function.arguments);
}

// ─── AI Enrichment (batch) ───
async function aiEnrichItems(
  apiKey: string,
  category: Category,
  topic: string,
  itemNames: string[]
): Promise<Record<string, EnrichmentResult>> {
  const categoryHints: Record<string, string> = {
    movie: "For movies, include: year, director, genre.",
    tv: "For TV shows, include: year, network, genre.",
    book: "For books, include: author, year, genre.",
    music: "For music, include: artist, year, genre, type (album/song).",
    food: "For food/restaurants, include: type, cuisine.",
    brand: "For brands, include: industry, founded_year.",
    person: "For people, include: known_for, birth_year.",
    sport: "For sports items, include: team, position, sport.",
    generic: "Include any helpful context.",
  };

  const hint = categoryHints[category] || categoryHints.generic;

  const prompt = `You are enriching items for a "${topic}" draft (category: ${category}).
${hint}

For each item, return:
- normalized_name: clean canonical name
- matched_name: the official/canonical title if you recognize it, or null
- metadata: object with relevant fields
- confidence: 0.0-1.0 how confident you are in the match

Items to enrich:
${itemNames.map((n, i) => `${i + 1}. "${n}"`).join("\n")}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You enrich draft items with metadata. Return results via the tool call." },
        { role: "user", content: prompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_enrichments",
          description: "Return enrichment data for all items",
          parameters: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    original_name: { type: "string" },
                    normalized_name: { type: "string" },
                    matched_name: { type: "string" },
                    confidence: { type: "number" },
                    metadata: { type: "object" },
                  },
                  required: ["original_name", "normalized_name", "confidence"],
                },
              },
            },
            required: ["items"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_enrichments" } },
    }),
  });

  if (!response.ok) return {};
  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) return {};

  const parsed = JSON.parse(toolCall.function.arguments);
  const results: Record<string, EnrichmentResult> = {};

  for (const item of parsed.items || []) {
    const confidence = item.confidence || 0;
    results[item.original_name] = {
      normalized_name: item.normalized_name || item.original_name,
      matched_name: item.matched_name || null,
      image_url: null,
      thumbnail_url: null,
      source_provider: "ai",
      confidence,
      metadata: item.metadata || {},
      status: confidence >= 0.7 ? "matched" : confidence >= 0.4 ? "low_confidence" : "placeholder",
    };
  }

  return results;
}

// ─── Open Library (Books) ───
async function enrichFromOpenLibrary(
  name: string,
  enrichment: EnrichmentResult
): Promise<EnrichmentResult> {
  try {
    const query = encodeURIComponent(enrichment.normalized_name || name);
    const res = await fetch(`https://openlibrary.org/search.json?title=${query}&limit=1`);
    if (!res.ok) return enrichment;
    const data = await res.json();
    const doc = data.docs?.[0];
    if (!doc) return enrichment;

    const coverId = doc.cover_i;
    if (coverId) {
      enrichment.image_url = `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
      enrichment.thumbnail_url = `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;
      enrichment.source_provider = "openlibrary";
      enrichment.confidence = Math.max(enrichment.confidence, 0.8);
      enrichment.status = "matched";
    }
    enrichment.matched_name = doc.title || enrichment.matched_name;
    enrichment.metadata = {
      ...enrichment.metadata,
      author: doc.author_name?.[0],
      year: doc.first_publish_year,
    };
    return enrichment;
  } catch {
    return enrichment;
  }
}

// ─── iTunes Search API (Movies, TV, Music) — free, no API key ───
async function enrichFromiTunes(
  name: string,
  enrichment: EnrichmentResult,
  category: Category
): Promise<EnrichmentResult> {
  try {
    const mediaType = category === "movie" ? "movie" : category === "tv" ? "tvShow" : "music";
    const entity = category === "movie" ? "movie" : category === "tv" ? "tvSeason" : "album";
    const query = encodeURIComponent(enrichment.normalized_name || name);
    const url = `https://itunes.apple.com/search?term=${query}&media=${mediaType}&entity=${entity}&limit=3`;

    const res = await fetch(url);
    if (!res.ok) return enrichment;
    const data = await res.json();
    const results = data.results;
    if (!results?.length) return enrichment;

    const match = results[0];
    const rawArtwork: string = match.artworkUrl100 || match.artworkUrl60 || "";
    if (rawArtwork) {
      enrichment.image_url = rawArtwork.replace("100x100bb", "600x600bb");
      enrichment.thumbnail_url = rawArtwork.replace("100x100bb", "200x200bb");
      enrichment.source_provider = "itunes";
      enrichment.confidence = Math.max(enrichment.confidence, 0.85);
      enrichment.status = "matched";
    }

    if (category === "movie") {
      enrichment.matched_name = match.trackName || enrichment.matched_name;
      enrichment.metadata = {
        ...enrichment.metadata,
        year: match.releaseDate ? new Date(match.releaseDate).getFullYear() : enrichment.metadata.year,
        director: match.artistName || enrichment.metadata.director,
        genre: match.primaryGenreName || enrichment.metadata.genre,
      };
    } else if (category === "tv") {
      enrichment.matched_name = match.collectionName || enrichment.matched_name;
      enrichment.metadata = {
        ...enrichment.metadata,
        year: match.releaseDate ? new Date(match.releaseDate).getFullYear() : enrichment.metadata.year,
        network: match.artistName || enrichment.metadata.network,
        genre: match.primaryGenreName || enrichment.metadata.genre,
      };
    } else if (category === "music") {
      enrichment.matched_name = match.collectionName || match.trackName || enrichment.matched_name;
      enrichment.metadata = {
        ...enrichment.metadata,
        artist: match.artistName || enrichment.metadata.artist,
        year: match.releaseDate ? new Date(match.releaseDate).getFullYear() : enrichment.metadata.year,
        genre: match.primaryGenreName || enrichment.metadata.genre,
      };
    }

    return enrichment;
  } catch (err) {
    console.error("iTunes enrichment error:", err);
    return enrichment;
  }
}

// ─── Wikipedia / Wikimedia (universal fallback for images) ───
async function enrichFromWikipedia(
  name: string,
  enrichment: EnrichmentResult,
  category: Category
): Promise<EnrichmentResult> {
  try {
    const categoryHint = category === "movie" ? " film" : category === "tv" ? " TV series" : category === "game" ? " video game" : "";
    const searchQuery = encodeURIComponent((enrichment.normalized_name || name) + categoryHint);

    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${searchQuery}&format=json&srlimit=1`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return enrichment;
    const searchData = await searchRes.json();
    const pageTitle = searchData?.query?.search?.[0]?.title;
    if (!pageTitle) return enrichment;

    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
    const summaryRes = await fetch(summaryUrl);
    if (!summaryRes.ok) return enrichment;
    const summary = await summaryRes.json();

    const thumb = summary.thumbnail?.source;
    const original = summary.originalimage?.source;

    if (thumb || original) {
      enrichment.image_url = original || thumb;
      enrichment.thumbnail_url = thumb || original;
      enrichment.source_provider = "wikipedia";
      enrichment.confidence = Math.max(enrichment.confidence, 0.8);
      enrichment.status = "matched";
    }

    return enrichment;
  } catch (err) {
    console.error("Wikipedia enrichment error:", err);
    return enrichment;
  }
}

// ─── Source-specific enrichment ───
async function enrichItem(
  category: Category,
  name: string,
  aiResult: EnrichmentResult
): Promise<EnrichmentResult> {
  let result = { ...aiResult };
  switch (category) {
    case "book":
      result = await enrichFromOpenLibrary(name, result);
      break;
    case "movie":
    case "tv":
    case "music":
      result = await enrichFromiTunes(name, result, category);
      break;
    default:
      break;
  }

  // Wikipedia fallback: if no image was found from the primary source, try Wikipedia
  if (!result.image_url) {
    result = await enrichFromWikipedia(name, result, category);
  }

  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { draft_id, pick_ids } = await req.json();

    if (!draft_id) {
      return new Response(JSON.stringify({ error: "draft_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch draft
    const { data: draft, error: draftErr } = await supabase
      .from("drafts")
      .select("*, competitions(title, description)")
      .eq("id", draft_id)
      .single();
    if (draftErr || !draft) throw new Error("Draft not found");

    // 2. Fetch picks to enrich (specific picks or all)
    let picksQuery = supabase
      .from("draft_picks")
      .select("*")
      .eq("draft_id", draft_id)
      .order("pick_number");

    if (pick_ids && pick_ids.length > 0) {
      picksQuery = picksQuery.in("id", pick_ids);
    }

    const { data: picks, error: pickErr } = await picksQuery;
    if (pickErr || !picks?.length) throw new Error("No picks found");

    // 3. Check which picks already have enrichments
    const pickIdList = picks.map((p: { id: string }) => p.id);
    const { data: existingEnrichments } = await supabase
      .from("item_enrichments")
      .select("item_id")
      .in("item_id", pickIdList)
      .eq("item_type", "draft_pick");

    const alreadyEnriched = new Set((existingEnrichments || []).map((e: { item_id: string }) => e.item_id));
    
    // If enriching specific picks, always re-enrich them; otherwise skip already-enriched
    const picksToEnrich = pick_ids?.length
      ? picks
      : picks.filter((p: { id: string }) => !alreadyEnriched.has(p.id));

    if (picksToEnrich.length === 0) {
      return new Response(
        JSON.stringify({ message: "All picks already enriched", enriched_count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pickTexts = picksToEnrich.map((p: { pick_text: string }) => p.pick_text);

    // 4. Classify the draft (use cached category or classify fresh)
    let category = draft.category as Category;
    if (!category) {
      const allPickTexts = picks.map((p: { pick_text: string }) => p.pick_text);
      const classification = await classifyDraft(
        LOVABLE_API_KEY,
        draft.topic,
        draft.competitions?.description,
        allPickTexts
      );
      console.log("Draft classification:", classification);
      category = classification.category;

      await supabase
        .from("drafts")
        .update({ category })
        .eq("id", draft_id);
    }

    // 5. AI-enrich all picks in batch
    const aiResults = await aiEnrichItems(LOVABLE_API_KEY, category, draft.topic, pickTexts);

    // 6. Source-specific enrichment per pick
    const enrichments = await Promise.all(
      picksToEnrich.map(async (pick: { id: string; pick_text: string }) => {
        const aiResult = aiResults[pick.pick_text] || {
          normalized_name: pick.pick_text,
          matched_name: null,
          image_url: null,
          thumbnail_url: null,
          source_provider: "ai",
          confidence: 0.3,
          metadata: {},
          status: "placeholder" as const,
        };

        const enriched = await enrichItem(category, pick.pick_text, aiResult);

        return {
          item_id: pick.id,
          item_type: "draft_pick",
          category,
          normalized_name: enriched.normalized_name,
          matched_name: enriched.matched_name,
          image_url: enriched.image_url,
          thumbnail_url: enriched.thumbnail_url,
          source_provider: enriched.source_provider,
          confidence: enriched.confidence,
          metadata: enriched.metadata,
          status: enriched.status,
        };
      })
    );

    // 7. Upsert enrichments
    const { error: upsertErr } = await supabase
      .from("item_enrichments")
      .upsert(enrichments, { onConflict: "item_id,item_type" });

    if (upsertErr) {
      console.error("Upsert error:", upsertErr);
      throw new Error(`Failed to save enrichments: ${upsertErr.message}`);
    }

    return new Response(
      JSON.stringify({
        category,
        enriched_count: enrichments.length,
        matched: enrichments.filter((e) => e.status === "matched").length,
        low_confidence: enrichments.filter((e) => e.status === "low_confidence").length,
        placeholder: enrichments.filter((e) => e.status === "placeholder").length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("enrich-draft-picks error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
