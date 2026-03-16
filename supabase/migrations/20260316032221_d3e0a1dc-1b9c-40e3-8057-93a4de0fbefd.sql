
-- Enable ESPN provider (keep stub for testing)
INSERT INTO public.provider_configs (provider_name, enabled, sport, tournament_scope, base_url)
VALUES ('espn', true, 'basketball', 'mens', 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball')
ON CONFLICT DO NOTHING;
