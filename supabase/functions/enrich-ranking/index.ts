import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Category Classification ───
const SUPPORTED_CATEGORIES = [
  "movie", "tv", "book", "music", "food", "brand", "place",
  "sport", "game", "person", "animal", "generic",
] as const;
type Category = typeof SUPPORTED_CATEGORIES[number];

interface ClassificationResult {
  category: Category;
  confidence: number;
}

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
async function classifyRanking(
  apiKey: string,
  topic: string,
  description: string | null,
  itemNames: string[]
): Promise<ClassificationResult> {
  const prompt = `Classify this ranking list into exactly one category.

Topic: "${topic}"
${description ? `Description: "${description}"` : ""}
Items: ${itemNames.slice(0, 8).join(", ")}

Categories: movie, tv, book, music, food, brand, place, sport, game, person, animal, generic

Rules:
- "movie" = specific movie titles
- "tv" = specific TV show titles
- "book" = specific book titles
- "music" = albums, songs, or artists
- "food" = food items, dishes, restaurants, fast food chains
- "brand" = commercial brands not covered by other categories
- "place" = locations, cities, countries, venues
- "sport" = sports, teams, athletes
- "game" = video games, board games
- "person" = specific people, celebrities
- "animal" = animals, pets, breeds
- "generic" = anything that doesn't fit above

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
        { role: "system", content: "You classify ranking lists. Respond only with JSON via the tool call." },
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

  if (!response.ok) throw new Error(`Classification failed: ${response.status}`);
  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) return { category: "generic", confidence: 0.3 };
  return JSON.parse(toolCall.function.arguments);
}

// ─── AI Enrichment (normalize + metadata) ───
async function aiEnrichItems(
  apiKey: string,
  category: Category,
  topic: string,
  itemNames: string[]
): Promise<Record<string, EnrichmentResult>> {
  const categoryHints: Record<string, string> = {
    movie: "For movies, include: year, director, genre. normalized_name should be the canonical movie title.",
    tv: "For TV shows, include: year (first aired), network, genre. normalized_name should be the canonical show title.",
    book: "For books, include: author, year, genre. normalized_name should be the canonical book title.",
    music: "For music, include: artist, year, genre, type (album/song). normalized_name should be the canonical title.",
    food: "For food/restaurants, include: type, cuisine. normalized_name should be the proper name.",
    brand: "For brands, include: industry, founded_year. normalized_name should be the official brand name.",
    person: "For people, include: known_for, birth_year. normalized_name should be the full proper name.",
    generic: "Include any helpful context. normalized_name should be a cleaned version of the name.",
  };

  const hint = categoryHints[category] || categoryHints.generic;

  const prompt = `You are enriching items for a "${topic}" ranking (category: ${category}).
${hint}

For each item, return:
- normalized_name: clean canonical name
- matched_name: the official/canonical title if you recognize it, or null
- metadata: object with relevant fields (year, creator/director/author, genre, etc.)
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
        { role: "system", content: "You enrich ranking items with metadata. Return results via the tool call." },
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

  if (!response.ok) throw new Error(`AI enrichment failed: ${response.status}`);
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
      isbn: doc.isbn?.[0],
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

    // Pick the best match (first result from iTunes is usually the best)
    const match = results[0];

    // iTunes provides artwork at 100x100 by default; we can upscale by replacing the size
    const rawArtwork: string = match.artworkUrl100 || match.artworkUrl60 || "";
    if (rawArtwork) {
      enrichment.image_url = rawArtwork.replace("100x100bb", "600x600bb");
      enrichment.thumbnail_url = rawArtwork.replace("100x100bb", "200x200bb");
      enrichment.source_provider = "itunes";
      enrichment.confidence = Math.max(enrichment.confidence, 0.85);
      enrichment.status = "matched";
    }

    // Enrich metadata from iTunes response
    if (category === "movie") {
      enrichment.matched_name = match.trackName || enrichment.matched_name;
      enrichment.metadata = {
        ...enrichment.metadata,
        year: match.releaseDate ? new Date(match.releaseDate).getFullYear() : enrichment.metadata.year,
        director: match.artistName || enrichment.metadata.director,
        genre: match.primaryGenreName || enrichment.metadata.genre,
        content_rating: match.contentAdvisoryRating,
        runtime_minutes: match.trackTimeMillis ? Math.round(match.trackTimeMillis / 60000) : undefined,
      };
    } else if (category === "tv") {
      enrichment.matched_name = match.collectionName || enrichment.matched_name;
      enrichment.metadata = {
        ...enrichment.metadata,
        year: match.releaseDate ? new Date(match.releaseDate).getFullYear() : enrichment.metadata.year,
        network: match.artistName || enrichment.metadata.network,
        genre: match.primaryGenreName || enrichment.metadata.genre,
        content_rating: match.contentAdvisoryRating,
      };
    } else if (category === "music") {
      enrichment.matched_name = match.collectionName || match.trackName || enrichment.matched_name;
      enrichment.metadata = {
        ...enrichment.metadata,
        artist: match.artistName || enrichment.metadata.artist,
        year: match.releaseDate ? new Date(match.releaseDate).getFullYear() : enrichment.metadata.year,
        genre: match.primaryGenreName || enrichment.metadata.genre,
        type: match.collectionType || match.wrapperType || enrichment.metadata.type,
      };
    }

    return enrichment;
  } catch (err) {
    console.error("iTunes enrichment error:", err);
    return enrichment;
  }
}

// ─── Orchestrator ───
async function enrichItem(
  apiKey: string,
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
      result.source_provider = "ai";
      break;
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
    const { ranking_id } = await req.json();
    if (!ranking_id) {
      return new Response(JSON.stringify({ error: "ranking_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch ranking + items
    const { data: ranking, error: rankErr } = await supabase
      .from("rankings")
      .select("*, competitions(title, description)")
      .eq("id", ranking_id)
      .single();
    if (rankErr || !ranking) throw new Error("Ranking not found");

    const { data: items, error: itemErr } = await supabase
      .from("ranking_items")
      .select("*")
      .eq("ranking_id", ranking_id)
      .order("position");
    if (itemErr || !items?.length) throw new Error("No items found");

    const itemNames = items.map((i: { label: string }) => i.label);

    // 2. Classify the ranking
    const classification = await classifyRanking(
      LOVABLE_API_KEY,
      ranking.topic,
      ranking.competitions?.description,
      itemNames
    );
    console.log("Classification:", classification);

    // Update ranking category
    await supabase
      .from("rankings")
      .update({ category: classification.category })
      .eq("id", ranking_id);

    // 3. AI-enrich all items in batch
    const aiResults = await aiEnrichItems(
      LOVABLE_API_KEY,
      classification.category as Category,
      ranking.topic,
      itemNames
    );

    // 4. Source-specific enrichment per item
    const enrichments = await Promise.all(
      items.map(async (item: { id: string; label: string }) => {
        const aiResult = aiResults[item.label] || {
          normalized_name: item.label,
          matched_name: null,
          image_url: null,
          thumbnail_url: null,
          source_provider: "ai",
          confidence: 0.3,
          metadata: {},
          status: "placeholder" as const,
        };

        const enriched = await enrichItem(
          LOVABLE_API_KEY,
          classification.category as Category,
          item.label,
          aiResult
        );

        return {
          item_id: item.id,
          item_type: "ranking_item",
          category: classification.category,
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

    // 5. Upsert enrichments
    const { error: upsertErr } = await supabase
      .from("item_enrichments")
      .upsert(enrichments, { onConflict: "item_id,item_type" });

    if (upsertErr) {
      console.error("Upsert error:", upsertErr);
      throw new Error(`Failed to save enrichments: ${upsertErr.message}`);
    }

    return new Response(
      JSON.stringify({
        category: classification.category,
        confidence: classification.confidence,
        enriched_count: enrichments.length,
        matched: enrichments.filter((e) => e.status === "matched").length,
        low_confidence: enrichments.filter((e) => e.status === "low_confidence").length,
        placeholder: enrichments.filter((e) => e.status === "placeholder").length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("enrich-ranking error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
