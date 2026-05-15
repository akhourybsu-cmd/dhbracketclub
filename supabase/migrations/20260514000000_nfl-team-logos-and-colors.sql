-- ═══════════════════════════════════════════════════════════════════
-- DH Club — NFL team logos + official primary colors
--
-- Idempotent UPSERT against (abbr). Populates logo_url with ESPN CDN
-- pattern (https://a.espncdn.com/i/teamlogos/nfl/500/{abbr}.png) and
-- primary_color with each team's official primary hex.
--
-- Safe to re-run: ON CONFLICT (abbr) DO UPDATE writes the canonical
-- values. Pre-existing UUIDs are preserved (matched by abbr).
-- ═══════════════════════════════════════════════════════════════════

insert into public.nfl_teams (abbr, city, name, conference, division, primary_color, logo_url)
values
  ('ARI', 'Arizona',      'Cardinals',  'NFC', 'West',  '#97233F', 'https://a.espncdn.com/i/teamlogos/nfl/500/ari.png'),
  ('ATL', 'Atlanta',      'Falcons',    'NFC', 'South', '#A71930', 'https://a.espncdn.com/i/teamlogos/nfl/500/atl.png'),
  ('BAL', 'Baltimore',    'Ravens',     'AFC', 'North', '#241773', 'https://a.espncdn.com/i/teamlogos/nfl/500/bal.png'),
  ('BUF', 'Buffalo',       'Bills',      'AFC', 'East',  '#00338D', 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png'),
  ('CAR', 'Carolina',     'Panthers',   'NFC', 'South', '#0085CA', 'https://a.espncdn.com/i/teamlogos/nfl/500/car.png'),
  ('CHI', 'Chicago',      'Bears',      'NFC', 'North', '#0B162A', 'https://a.espncdn.com/i/teamlogos/nfl/500/chi.png'),
  ('CIN', 'Cincinnati',   'Bengals',    'AFC', 'North', '#FB4F14', 'https://a.espncdn.com/i/teamlogos/nfl/500/cin.png'),
  ('CLE', 'Cleveland',    'Browns',     'AFC', 'North', '#311D00', 'https://a.espncdn.com/i/teamlogos/nfl/500/cle.png'),
  ('DAL', 'Dallas',       'Cowboys',    'NFC', 'East',  '#003594', 'https://a.espncdn.com/i/teamlogos/nfl/500/dal.png'),
  ('DEN', 'Denver',       'Broncos',    'AFC', 'West',  '#FB4F14', 'https://a.espncdn.com/i/teamlogos/nfl/500/den.png'),
  ('DET', 'Detroit',      'Lions',      'NFC', 'North', '#0076B6', 'https://a.espncdn.com/i/teamlogos/nfl/500/det.png'),
  ('GB',  'Green Bay',    'Packers',    'NFC', 'North', '#203731', 'https://a.espncdn.com/i/teamlogos/nfl/500/gb.png'),
  ('HOU', 'Houston',      'Texans',     'AFC', 'South', '#03202F', 'https://a.espncdn.com/i/teamlogos/nfl/500/hou.png'),
  ('IND', 'Indianapolis', 'Colts',      'AFC', 'South', '#002C5F', 'https://a.espncdn.com/i/teamlogos/nfl/500/ind.png'),
  ('JAX', 'Jacksonville', 'Jaguars',    'AFC', 'South', '#006778', 'https://a.espncdn.com/i/teamlogos/nfl/500/jax.png'),
  ('KC',  'Kansas City',  'Chiefs',     'AFC', 'West',  '#E31837', 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png'),
  ('LAC', 'Los Angeles',  'Chargers',   'AFC', 'West',  '#0080C6', 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png'),
  ('LAR', 'Los Angeles',  'Rams',       'NFC', 'West',  '#003594', 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png'),
  ('LV',  'Las Vegas',    'Raiders',    'AFC', 'West',  '#000000', 'https://a.espncdn.com/i/teamlogos/nfl/500/lv.png'),
  ('MIA', 'Miami',        'Dolphins',   'AFC', 'East',  '#008E97', 'https://a.espncdn.com/i/teamlogos/nfl/500/mia.png'),
  ('MIN', 'Minnesota',    'Vikings',    'NFC', 'North', '#4F2683', 'https://a.espncdn.com/i/teamlogos/nfl/500/min.png'),
  ('NE',  'New England',  'Patriots',   'AFC', 'East',  '#002244', 'https://a.espncdn.com/i/teamlogos/nfl/500/ne.png'),
  ('NO',  'New Orleans',  'Saints',     'NFC', 'South', '#D3BC8D', 'https://a.espncdn.com/i/teamlogos/nfl/500/no.png'),
  ('NYG', 'New York',     'Giants',     'NFC', 'East',  '#0B2265', 'https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png'),
  ('NYJ', 'New York',     'Jets',       'AFC', 'East',  '#125740', 'https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png'),
  ('PHI', 'Philadelphia', 'Eagles',     'NFC', 'East',  '#004C54', 'https://a.espncdn.com/i/teamlogos/nfl/500/phi.png'),
  ('PIT', 'Pittsburgh',   'Steelers',   'AFC', 'North', '#FFB612', 'https://a.espncdn.com/i/teamlogos/nfl/500/pit.png'),
  ('SEA', 'Seattle',      'Seahawks',   'NFC', 'West',  '#002244', 'https://a.espncdn.com/i/teamlogos/nfl/500/sea.png'),
  ('SF',  'San Francisco', '49ers',     'NFC', 'West',  '#AA0000', 'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png'),
  ('TB',  'Tampa Bay',    'Buccaneers', 'NFC', 'South', '#D50A0A', 'https://a.espncdn.com/i/teamlogos/nfl/500/tb.png'),
  ('TEN', 'Tennessee',    'Titans',     'AFC', 'South', '#0C2340', 'https://a.espncdn.com/i/teamlogos/nfl/500/ten.png'),
  ('WAS', 'Washington',   'Commanders', 'NFC', 'East',  '#5A1414', 'https://a.espncdn.com/i/teamlogos/nfl/500/was.png')
on conflict (abbr) do update set
  city          = excluded.city,
  name          = excluded.name,
  conference    = excluded.conference,
  division      = excluded.division,
  primary_color = excluded.primary_color,
  logo_url      = excluded.logo_url;
