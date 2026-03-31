const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only allow http/https
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return new Response(JSON.stringify({ error: 'Unsupported protocol' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the page with a timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DHClubBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    const contentType = res.headers.get('content-type') || '';

    // If it's an image, return minimal metadata
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

    // Read only first 50KB to avoid huge pages
    const reader = res.body?.getReader();
    if (!reader) {
      return new Response(JSON.stringify({ title: parsedUrl.hostname, site_name: parsedUrl.hostname }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let html = '';
    const decoder = new TextDecoder();
    let bytesRead = 0;
    const MAX_BYTES = 50_000;

    while (bytesRead < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      bytesRead += value.byteLength;
    }
    reader.cancel();

    // Parse OG tags with regex (no DOM parser needed)
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

    // Resolve relative image URLs
    if (imageUrl && !imageUrl.startsWith('http')) {
      try {
        imageUrl = new URL(imageUrl, url).href;
      } catch {
        imageUrl = null;
      }
    }

    return new Response(JSON.stringify({
      title: title?.slice(0, 300),
      description: description?.slice(0, 500),
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
