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

interface ImageCandidate {
  url: string;
  thumbnail: string;
  source: string;
  label: string;
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
    const res = await fetch(`https://openlibrary.org/search.json?title=${query}&limit=5`);
    if (!res.ok) return enrichment;
    const data = await res.json();
    const docs = data.docs || [];
    if (!docs.length) return enrichment;

    const candidates: ImageCandidate[] = [];
    for (const doc of docs.slice(0, 5)) {
      const coverId = doc.cover_i;
      if (coverId) {
        candidates.push({
          url: `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`,
          thumbnail: `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`,
          source: "openlibrary",
          label: doc.title || name,
        });
      }
    }

    const doc = docs[0];
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
      image_candidates: candidates,
    };
    return enrichment;
  } catch {
    return enrichment;
  }
}

// Helper to detect if topic is about bands/artists
function topicIsBandOrArtist(topic: string): boolean {
  const lower = topic.toLowerCase();
  return /\b(band|bands|artist|artists|musician|musicians|group|groups|singer|singers)\b/.test(lower);
}

// ─── iTunes Search API (Movies, TV, Music) — free, no API key ───
async function enrichFromiTunes(
  name: string,
  enrichment: EnrichmentResult,
  category: Category,
  topic?: string
): Promise<EnrichmentResult> {
  try {
    const isBandTopic = topic ? topicIsBandOrArtist(topic) : false;
    const mediaType = category === "movie" ? "movie" : category === "tv" ? "tvShow" : "music";
    const entity = category === "movie" ? "movie" : category === "tv" ? "tvSeason" : (isBandTopic ? "musicArtist" : "album");
    const query = encodeURIComponent(enrichment.normalized_name || name);
    const url = `https://itunes.apple.com/search?term=${query}&media=${mediaType}&entity=${entity}&limit=5`;

    const res = await fetch(url);
    if (!res.ok) return enrichment;
    const data = await res.json();
    const results = data.results;
    if (!results?.length) return enrichment;

    // Collect image candidates from all results
    const candidates: ImageCandidate[] = [];
    for (const r of results.slice(0, 5)) {
      const raw: string = r.artworkUrl100 || r.artworkUrl60 || "";
      if (raw) {
        candidates.push({
          url: raw.replace("100x100bb", "600x600bb"),
          thumbnail: raw.replace("100x100bb", "200x200bb"),
          source: "itunes",
          label: r.trackName || r.collectionName || name,
        });
      }
    }

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
        image_candidates: [...(enrichment.metadata.image_candidates as ImageCandidate[] || []), ...candidates],
      };
    } else if (category === "tv") {
      enrichment.matched_name = match.collectionName || enrichment.matched_name;
      enrichment.metadata = {
        ...enrichment.metadata,
        year: match.releaseDate ? new Date(match.releaseDate).getFullYear() : enrichment.metadata.year,
        network: match.artistName || enrichment.metadata.network,
        genre: match.primaryGenreName || enrichment.metadata.genre,
        image_candidates: [...(enrichment.metadata.image_candidates as ImageCandidate[] || []), ...candidates],
      };
    } else if (category === "music") {
      enrichment.matched_name = match.collectionName || match.trackName || enrichment.matched_name;
      enrichment.metadata = {
        ...enrichment.metadata,
        artist: match.artistName || enrichment.metadata.artist,
        year: match.releaseDate ? new Date(match.releaseDate).getFullYear() : enrichment.metadata.year,
        genre: match.primaryGenreName || enrichment.metadata.genre,
        image_candidates: [...(enrichment.metadata.image_candidates as ImageCandidate[] || []), ...candidates],
      };
    }

    return enrichment;
  } catch (err) {
    console.error("iTunes enrichment error:", err);
    return enrichment;
  }
}

// ─── Deezer API (Music) — free, no API key ───
async function enrichFromDeezer(
  name: string,
  enrichment: EnrichmentResult,
  topic?: string
): Promise<EnrichmentResult> {
  try {
    const isBandTopic = topic ? topicIsBandOrArtist(topic) : false;
    const query = encodeURIComponent(enrichment.normalized_name || name);
    const endpoint = isBandTopic ? "artist" : "album";
    const res = await fetch(`https://api.deezer.com/search/${endpoint}?q=${query}&limit=5`);
    if (!res.ok) return enrichment;
    const data = await res.json();
    const items = data.data || [];
    if (!items.length) return enrichment;

    const candidates: ImageCandidate[] = [];
    for (const a of albums.slice(0, 5)) {
      if (a.cover_xl || a.cover_big) {
        candidates.push({
          url: a.cover_xl || a.cover_big,
          thumbnail: a.cover_medium || a.cover_small || a.cover_xl || a.cover_big,
          source: "deezer",
          label: a.title || name,
        });
      }
    }

    const album = albums[0];
    if (album.cover_xl || album.cover_big) {
      enrichment.image_url = album.cover_xl || album.cover_big;
      enrichment.thumbnail_url = album.cover_medium || album.cover_small || enrichment.image_url;
      enrichment.source_provider = "deezer";
      enrichment.confidence = Math.max(enrichment.confidence, 0.85);
      enrichment.status = "matched";
    }
    enrichment.matched_name = album.title || enrichment.matched_name;
    enrichment.metadata = {
      ...enrichment.metadata,
      artist: album.artist?.name || enrichment.metadata.artist,
      image_candidates: [...(enrichment.metadata.image_candidates as ImageCandidate[] || []), ...candidates],
    };
    return enrichment;
  } catch (err) {
    console.error("Deezer enrichment error:", err);
    return enrichment;
  }
}

// ─── MusicBrainz + Cover Art Archive (Music) — free, no API key ───
async function enrichFromMusicBrainz(
  name: string,
  enrichment: EnrichmentResult
): Promise<EnrichmentResult> {
  try {
    const query = encodeURIComponent(enrichment.normalized_name || name);
    const res = await fetch(
      `https://musicbrainz.org/ws/2/release-group/?query=${query}&limit=1&fmt=json`,
      { headers: { "User-Agent": "LovableEnrichment/1.0 (contact@lovable.dev)" } }
    );
    if (!res.ok) return enrichment;
    const data = await res.json();
    const rg = data["release-groups"]?.[0];
    if (!rg) return enrichment;

    const caaRes = await fetch(`https://coverartarchive.org/release-group/${rg.id}`, {
      redirect: "follow",
    });
    if (caaRes.ok) {
      const caaData = await caaRes.json();
      const front = caaData.images?.find((img: { front: boolean }) => img.front);
      if (front) {
        enrichment.image_url = front.image;
        enrichment.thumbnail_url = front.thumbnails?.["500"] || front.thumbnails?.large || front.image;
        enrichment.source_provider = "musicbrainz";
        enrichment.confidence = Math.max(enrichment.confidence, 0.85);
        enrichment.status = "matched";
      }
    }

    enrichment.matched_name = rg.title || enrichment.matched_name;
    enrichment.metadata = {
      ...enrichment.metadata,
      artist: rg["artist-credit"]?.[0]?.name || enrichment.metadata.artist,
      year: rg["first-release-date"]?.substring(0, 4) || enrichment.metadata.year,
      type: rg["primary-type"] || enrichment.metadata.type,
    };
    return enrichment;
  } catch (err) {
    console.error("MusicBrainz enrichment error:", err);
    return enrichment;
  }
}

// ─── TheMealDB (Food) — free, no API key (test key "1") ───
async function enrichFromMealDB(
  name: string,
  enrichment: EnrichmentResult
): Promise<EnrichmentResult> {
  try {
    const query = encodeURIComponent(enrichment.normalized_name || name);
    const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${query}`);
    if (!res.ok) return enrichment;
    const data = await res.json();
    const meal = data.meals?.[0];
    if (!meal) return enrichment;

    if (meal.strMealThumb) {
      enrichment.image_url = meal.strMealThumb;
      enrichment.thumbnail_url = `${meal.strMealThumb}/preview`;
      enrichment.source_provider = "themealdb";
      enrichment.confidence = Math.max(enrichment.confidence, 0.8);
      enrichment.status = "matched";
    }
    enrichment.matched_name = meal.strMeal || enrichment.matched_name;
    enrichment.metadata = {
      ...enrichment.metadata,
      cuisine: meal.strArea || enrichment.metadata.cuisine,
      category: meal.strCategory || enrichment.metadata.category,
    };
    return enrichment;
  } catch (err) {
    console.error("TheMealDB enrichment error:", err);
    return enrichment;
  }
}

// ─── TheSportsDB (Sports) — free, no API key (test key "1") ───
async function enrichFromSportsDB(
  name: string,
  enrichment: EnrichmentResult
): Promise<EnrichmentResult> {
  try {
    const query = encodeURIComponent(enrichment.normalized_name || name);
    const candidates: ImageCandidate[] = (enrichment.metadata.image_candidates as ImageCandidate[] || []);

    const teamRes = await fetch(`https://www.thesportsdb.com/api/v1/json/1/searchteams.php?t=${query}`);
    if (teamRes.ok) {
      const teamData = await teamRes.json();
      const teams = teamData.teams || [];
      for (const t of teams.slice(0, 5)) {
        const img = t.strBadge || t.strLogo;
        if (img) candidates.push({ url: img, thumbnail: img + "/preview", source: "thesportsdb", label: t.strTeam || name });
      }
      const team = teams[0];
      if (team) {
        const badge = team.strBadge || team.strLogo;
        if (badge) {
          enrichment.image_url = badge;
          enrichment.thumbnail_url = badge + "/preview";
          enrichment.source_provider = "thesportsdb";
          enrichment.confidence = Math.max(enrichment.confidence, 0.85);
          enrichment.status = "matched";
        }
        enrichment.matched_name = team.strTeam || enrichment.matched_name;
        enrichment.metadata = {
          ...enrichment.metadata,
          sport: team.strSport,
          league: team.strLeague,
          stadium: team.strStadium,
          country: team.strCountry,
          image_candidates: candidates,
        };
        return enrichment;
      }
    }
    const playerRes = await fetch(`https://www.thesportsdb.com/api/v1/json/1/searchplayers.php?p=${query}`);
    if (playerRes.ok) {
      const playerData = await playerRes.json();
      const players = playerData.player || [];
      for (const pl of players.slice(0, 5)) {
        const img = pl.strThumb || pl.strCutout;
        if (img) candidates.push({ url: img, thumbnail: img + "/preview", source: "thesportsdb", label: pl.strPlayer || name });
      }
      const player = players[0];
      if (player) {
        const thumb = player.strThumb || player.strCutout;
        if (thumb) {
          enrichment.image_url = thumb;
          enrichment.thumbnail_url = thumb + "/preview";
          enrichment.source_provider = "thesportsdb";
          enrichment.confidence = Math.max(enrichment.confidence, 0.85);
          enrichment.status = "matched";
        }
        enrichment.matched_name = player.strPlayer || enrichment.matched_name;
        enrichment.metadata = {
          ...enrichment.metadata,
          sport: player.strSport,
          team: player.strTeam,
          position: player.strPosition,
          nationality: player.strNationality,
          image_candidates: candidates,
        };
      }
    }
    if (candidates.length) {
      enrichment.metadata = { ...enrichment.metadata, image_candidates: candidates };
    }
    return enrichment;
  } catch (err) {
    console.error("TheSportsDB enrichment error:", err);
    return enrichment;
  }
}

// ─── TMDB (Movies, TV, People) ───
async function enrichFromTMDB(
  name: string,
  enrichment: EnrichmentResult,
  category: Category
): Promise<EnrichmentResult> {
  try {
    const token = Deno.env.get("TMDB_READ_ACCESS_TOKEN");
    if (!token) return enrichment;

    const query = encodeURIComponent(enrichment.normalized_name || name);
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const candidates: ImageCandidate[] = (enrichment.metadata.image_candidates as ImageCandidate[] || []);

    if (category === "movie") {
      const res = await fetch(`https://api.themoviedb.org/3/search/movie?query=${query}&language=en-US&page=1`, { headers });
      if (!res.ok) return enrichment;
      const data = await res.json();
      const results = data.results || [];

      for (const m of results.slice(0, 5)) {
        if (m.poster_path) {
          candidates.push({
            url: `https://image.tmdb.org/t/p/w500${m.poster_path}`,
            thumbnail: `https://image.tmdb.org/t/p/w200${m.poster_path}`,
            source: "tmdb",
            label: m.title || name,
          });
        }
      }

      const movie = results[0];
      if (movie?.poster_path) {
        enrichment.image_url = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
        enrichment.thumbnail_url = `https://image.tmdb.org/t/p/w200${movie.poster_path}`;
        enrichment.source_provider = "tmdb";
        enrichment.confidence = Math.max(enrichment.confidence, 0.92);
        enrichment.status = "matched";
      }
      if (movie) {
        enrichment.matched_name = movie.title || enrichment.matched_name;
        enrichment.metadata = {
          ...enrichment.metadata,
          year: movie.release_date ? new Date(movie.release_date).getFullYear() : enrichment.metadata.year,
          tmdb_id: movie.id,
          overview: movie.overview?.substring(0, 200),
          vote_average: movie.vote_average,
          backdrop_path: movie.backdrop_path ? `https://image.tmdb.org/t/p/w780${movie.backdrop_path}` : undefined,
          image_candidates: candidates,
        };
      }
    } else if (category === "tv") {
      const res = await fetch(`https://api.themoviedb.org/3/search/tv?query=${query}&language=en-US&page=1`, { headers });
      if (!res.ok) return enrichment;
      const data = await res.json();
      const results = data.results || [];

      for (const s of results.slice(0, 5)) {
        if (s.poster_path) {
          candidates.push({
            url: `https://image.tmdb.org/t/p/w500${s.poster_path}`,
            thumbnail: `https://image.tmdb.org/t/p/w200${s.poster_path}`,
            source: "tmdb",
            label: s.name || name,
          });
        }
      }

      const show = results[0];
      if (show?.poster_path) {
        enrichment.image_url = `https://image.tmdb.org/t/p/w500${show.poster_path}`;
        enrichment.thumbnail_url = `https://image.tmdb.org/t/p/w200${show.poster_path}`;
        enrichment.source_provider = "tmdb";
        enrichment.confidence = Math.max(enrichment.confidence, 0.92);
        enrichment.status = "matched";
      }
      if (show) {
        enrichment.matched_name = show.name || enrichment.matched_name;
        enrichment.metadata = {
          ...enrichment.metadata,
          year: show.first_air_date ? new Date(show.first_air_date).getFullYear() : enrichment.metadata.year,
          tmdb_id: show.id,
          overview: show.overview?.substring(0, 200),
          vote_average: show.vote_average,
          backdrop_path: show.backdrop_path ? `https://image.tmdb.org/t/p/w780${show.backdrop_path}` : undefined,
          image_candidates: candidates,
        };
      }
    } else if (category === "person") {
      const res = await fetch(`https://api.themoviedb.org/3/search/person?query=${query}&language=en-US&page=1`, { headers });
      if (!res.ok) return enrichment;
      const data = await res.json();
      const results = data.results || [];

      for (const p of results.slice(0, 5)) {
        if (p.profile_path) {
          candidates.push({
            url: `https://image.tmdb.org/t/p/w500${p.profile_path}`,
            thumbnail: `https://image.tmdb.org/t/p/w200${p.profile_path}`,
            source: "tmdb",
            label: p.name || name,
          });
        }
      }

      const person = results[0];
      if (person?.profile_path) {
        enrichment.image_url = `https://image.tmdb.org/t/p/w500${person.profile_path}`;
        enrichment.thumbnail_url = `https://image.tmdb.org/t/p/w200${person.profile_path}`;
        enrichment.source_provider = "tmdb";
        enrichment.confidence = Math.max(enrichment.confidence, 0.9);
        enrichment.status = "matched";
      }
      if (person) {
        enrichment.matched_name = person.name || enrichment.matched_name;
        enrichment.metadata = {
          ...enrichment.metadata,
          known_for_department: person.known_for_department,
          tmdb_id: person.id,
          known_for: person.known_for?.slice(0, 3).map((k: any) => k.title || k.name).filter(Boolean),
          image_candidates: candidates,
        };
      }
    }

    if (candidates.length) {
      enrichment.metadata = { ...enrichment.metadata, image_candidates: candidates };
    }

    return enrichment;
  } catch (err) {
    console.error("TMDB enrichment error:", err);
    return enrichment;
  }
}

// ─── Pexels (universal fallback for high-quality stock photos) ───
async function enrichFromPexels(
  name: string,
  enrichment: EnrichmentResult,
  category: Category
): Promise<EnrichmentResult> {
  try {
    const apiKey = Deno.env.get("PEXELS_API_KEY");
    if (!apiKey) return enrichment;

    const categoryHint = category === "food" ? " dish food" : category === "place" ? " landmark" : category === "sport" ? " sport" : category === "animal" ? " animal" : "";
    const query = encodeURIComponent((enrichment.normalized_name || name) + categoryHint);
    const res = await fetch(`https://api.pexels.com/v1/search?query=${query}&per_page=5&orientation=landscape`, {
      headers: { Authorization: apiKey },
    });
    if (!res.ok) return enrichment;
    const data = await res.json();
    const photos = data.photos || [];
    if (!photos.length) return enrichment;

    const candidates: ImageCandidate[] = (enrichment.metadata.image_candidates as ImageCandidate[] || []);
    for (const p of photos.slice(0, 5)) {
      if (p.src) {
        candidates.push({
          url: p.src.large || p.src.original,
          thumbnail: p.src.medium || p.src.small,
          source: "pexels",
          label: p.alt || name,
        });
      }
    }

    const photo = photos[0];
    if (photo.src) {
      enrichment.image_url = photo.src.large || photo.src.original;
      enrichment.thumbnail_url = photo.src.medium || photo.src.small;
      enrichment.source_provider = "pexels";
      enrichment.confidence = Math.max(enrichment.confidence, 0.7);
      enrichment.status = enrichment.status === "placeholder" ? "low_confidence" : enrichment.status;
    }
    enrichment.metadata = {
      ...enrichment.metadata,
      pexels_photographer: photo.photographer,
      pexels_photo_url: photo.url,
      image_candidates: candidates,
    };
    return enrichment;
  } catch (err) {
    console.error("Pexels enrichment error:", err);
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

      const wikiCandidates: ImageCandidate[] = (enrichment.metadata.image_candidates as ImageCandidate[] || []);
      wikiCandidates.push({ url: original || thumb, thumbnail: thumb || original, source: "wikipedia", label: pageTitle });
      enrichment.metadata = { ...enrichment.metadata, image_candidates: wikiCandidates };
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
  aiResult: EnrichmentResult,
  topic?: string
): Promise<EnrichmentResult> {
  let result = { ...aiResult };
  switch (category) {
    case "book":
      result = await enrichFromOpenLibrary(name, result);
      break;
    case "movie":
    case "tv":
      // TMDB first (primary), iTunes as fallback
      result = await enrichFromTMDB(name, result, category);
      if (!result.image_url) result = await enrichFromiTunes(name, result, category, topic);
      break;
    case "music":
      result = await enrichFromiTunes(name, result, category, topic);
      if (!result.image_url) result = await enrichFromDeezer(name, result, topic);
      if (!result.image_url) result = await enrichFromMusicBrainz(name, result);
      break;
    case "food":
      result = await enrichFromMealDB(name, result);
      break;
    case "sport":
      result = await enrichFromSportsDB(name, result);
      break;
    case "person":
      result = await enrichFromTMDB(name, result, category);
      break;
    default:
      break;
  }

  // Wikipedia fallback: if no image was found from the primary source, try Wikipedia
  if (!result.image_url) {
    result = await enrichFromWikipedia(name, result, category);
  }

  // Pexels fallback: if still no image, try Pexels stock photos
  if (!result.image_url) {
    result = await enrichFromPexels(name, result, category);
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

        const enriched = await enrichItem(category, pick.pick_text, aiResult, draft.topic);

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
