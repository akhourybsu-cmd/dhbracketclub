UPDATE public.nfl_teams
SET logo_url = 'https://a.espncdn.com/i/teamlogos/nfl/500/' || lower(abbr) || '.png'
WHERE logo_url IS NULL OR logo_url = '';