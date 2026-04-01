const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/* ═══ Spotify oEmbed ═══ */
async function fetchSpotifyPreview(url: string) {
  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: data.title || null,
      description: data.description || `by ${data.provider_name || 'Spotify'}`,
      image_url: data.thumbnail_url || null,
      site_name: 'Spotify',
      content_type: 'spotify',
    };
  } catch { return null; }
}

/* ═══ YouTube oEmbed ═══ */
async function fetchYouTubePreview(url: string) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: data.title || null,
      description: `by ${data.author_name || 'YouTube'}`,
      image_url: data.thumbnail_url || null,
      site_name: 'YouTube',
      content_type: 'youtube',
    };
  } catch { return null; }
}

/* ═══ Apple Music / iTunes oEmbed ═══ */
async function fetchAppleMusicPreview(url: string) {
  try {
    const res = await fetch(`https://music.apple.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: data.title || data.name || null,
      description: data.author_name || data.provider_name || 'Apple Music',
      image_url: data.thumbnail_url || data.artworkUrl100 || null,
      site_name: 'Apple Music',
      content_type: 'link',
    };
  } catch { return null; }
}

/* ═══ SoundCloud oEmbed ═══ */
async function fetchSoundCloudPreview(url: string) {
  try {
    const res = await fetch(`https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: data.title || null,
      description: `by ${data.author_name || 'SoundCloud'}`,
      image_url: data.thumbnail_url || null,
      site_name: 'SoundCloud',
      content_type: 'link',
    };
  } catch { return null; }
}

/* ═══ Detect known domains ═══ */
function getSpecialFetcher(hostname: string, url: string) {
  if (hostname.includes('spotify.com')) return () => fetchSpotifyPreview(url);
  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return () => fetchYouTubePreview(url);
  if (hostname.includes('music.apple.com')) return () => fetchAppleMusicPreview(url);
  if (hostname.includes('soundcloud.com')) return () => fetchSoundCloudPreview(url);
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return new Response(JSON.stringify({ error: 'Unsupported protocol' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // SSRF protection: block private/internal IPs and metadata endpoints
    const hostname = parsedUrl.hostname.toLowerCase();
    const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '[::1]', '0.0.0.0', 'metadata.google.internal', '169.254.169.254'];
    const BLOCKED_PREFIXES = ['10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', '192.168.'];
    if (BLOCKED_HOSTS.includes(hostname) || BLOCKED_PREFIXES.some(p => hostname.startsWith(p)) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      return new Response(JSON.stringify({ error: 'URL not allowed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Try oEmbed for known domains first — gives authoritative titles
    const specialFetcher = getSpecialFetcher(parsedUrl.hostname, url);
    if (specialFetcher) {
      const specialData = await specialFetcher();
      if (specialData?.title) {
        console.log('oEmbed hit for', parsedUrl.hostname, '→', specialData.title);
        return new Response(JSON.stringify(specialData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Fallback: generic HTML scraping
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    const contentType = res.headers.get('content-type') || '';

    if (contentType.startsWith('image/')) {
      return new Response(JSON.stringify({
        title: parsedUrl.pathname.split('/').pop() || 'Image',
        image_url: url,
        site_name: parsedUrl.hostname,
        content_type: 'image',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!contentType.includes('text/html')) {
      return new Response(JSON.stringify({
        title: parsedUrl.hostname,
        site_name: parsedUrl.hostname,
        content_type: 'link',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const reader = res.body?.getReader();
    if (!reader) {
      return new Response(JSON.stringify({ title: parsedUrl.hostname, site_name: parsedUrl.hostname }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let html = '';
    const decoder = new TextDecoder();
    let bytesRead = 0;
    const MAX_BYTES = 80_000;

    while (bytesRead < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      bytesRead += value.byteLength;
    }
    reader.cancel();

    const getMetaContent = (property: string): string | null => {
      const patterns = [
        new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, 'i'),
      ];
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) return match[1];
      }
      return null;
    };

    const getTitle = (): string | null => {
      const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      return match ? match[1].trim() : null;
    };

    const title = getMetaContent('og:title') || getMetaContent('twitter:title') || getTitle() || parsedUrl.hostname;
    const description = getMetaContent('og:description') || getMetaContent('twitter:description') || getMetaContent('description');
    let imageUrl = getMetaContent('og:image') || getMetaContent('twitter:image');
    const siteName = getMetaContent('og:site_name') || parsedUrl.hostname;

    if (imageUrl && !imageUrl.startsWith('http')) {
      try {
        imageUrl = new URL(imageUrl, url).href;
      } catch {
        imageUrl = null;
      }
    }

    // Decode HTML entities in title
    const decodeEntities = (str: string) =>
      str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'").replace(/&#x2F;/g, '/');

    return new Response(JSON.stringify({
      title: decodeEntities(title || '').slice(0, 300),
      description: description ? decodeEntities(description).slice(0, 500) : null,
      image_url: imageUrl,
      site_name: siteName?.slice(0, 100),
      content_type: 'link',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('fetch-link-preview error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch preview' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
