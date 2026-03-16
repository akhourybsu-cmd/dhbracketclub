

# Assessment: Bracket Data Accuracy, Automation Readiness, and Schedule

## 1. Team Data Is Significantly Wrong

Comparing your database against the official 2026 bracket (Selection Sunday March 15, 2026), there are **major cross-region errors**. The sync corrupted team placements across regions. Here are the confirmed mismatches:

### East Region
| Seed | DB Has | Should Be |
|------|--------|-----------|
| 4 | Arkansas Razorbacks | **Kansas Jayhawks** |
| 11 | Prairie View A&M / Play-In | **South Florida** (no play-in in East 11) |

### West Region
| Seed | DB Has | Should Be |
|------|--------|-----------|
| 3 | Virginia Cavaliers | **Gonzaga Bulldogs** |
| 4 | Alabama Crimson Tide | **Arkansas Razorbacks** |
| 5 | Texas Tech Red Raiders | **Wisconsin Badgers** |
| 6 | Tennessee Volunteers | **BYU Cougars** |
| 11 | NC State Wolfpack | **Texas/NC State** (play-in) |
| 13 | Hofstra Pride | **Hawaii Rainbow Warriors** |
| 14 | Wright State Raiders | **Kennesaw State Owls** |
| 16 | Play-In / Miami OH | **LIU Sharks** (Miami OH is Midwest play-in) |

### Midwest Region
| Seed | DB Has | Should Be |
|------|--------|-----------|
| 1 | Purdue Boilermakers | **Michigan Wolverines** |
| 3 | Creighton | **Virginia Cavaliers** |
| 4 | Kansas Jayhawks | **Alabama Crimson Tide** |
| 5 | Gonzaga Bulldogs | **Texas Tech Red Raiders** |
| 6 | Tennessee State Tigers | **Tennessee Volunteers** |
| 7 | Texas Longhorns | **Kentucky Wildcats** |
| 11 | SMU Mustangs | **Miami OH / SMU** (play-in) |
| 12 | McNeese Cowboys | **Akron Zips** |
| 13 | Samford | **Hofstra Pride** |
| 14 | Akron Zips | **Wright State Raiders** |
| 15 | St Francis | **Tennessee State** |

That is roughly **20+ teams in the wrong region or seed**. The sync's name-matching and seed-pair logic is mapping ESPN/NCAA data onto wrong internal slots.

---

## 2. Automation Readiness — Honest Assessment

### What works today
- The Edge Function architecture is solid: NCAA provider with ESPN fallback, tiered game reconciliation, standings recalculation, game state history, admin override protection.
- Score updates, winner advancement to next rounds, and standings recalculation are all automated once games are correctly mapped.

### What is broken
- **The foundational team data is wrong.** The sync cannot fix this automatically because it matches external games to internal games using team names and seed pairs — but the internal teams are in the wrong regions, so seed-pair matching locks in incorrect mappings.
- **The `game_external_mappings` table** likely has incorrect mappings from previous syncs that will persist and prevent correct future matching.
- **Name matching is too loose.** The relaxed containment matching (Pass 2 in `buildTeamLookup`) can match "Tennessee" to "Tennessee State" or "Miami" to "Miami (OH)".

### What needs to happen before automation works
1. **One-time data correction**: Fix all ~68 team records with correct seed/region assignments matching the official bracket. Clear all `game_external_mappings` so reconciliation starts fresh.
2. **Tighten name matching**: Add disambiguation for known collision pairs (Tennessee vs Tennessee State, Miami vs Miami OH, etc.).
3. After that, the automated score syncing should work correctly since game-to-external mappings will be built on correct foundations.

### Manual effort going forward
- After the data fix: **zero manual effort expected** for scores and results. The sync pipeline will fetch scores, update winners, advance teams, and recalculate standings automatically.
- Admin tools remain available as a safety net for manual overrides if the API returns bad data.

---

## 3. Tournament Schedule and Lock Times

### Official 2026 Schedule
| Round | Dates |
|-------|-------|
| First Four | Tue March 17 & Wed March 18 |
| Round of 64 | Thu March 19 & Fri March 20 |
| Round of 32 | Sat March 21 & Sun March 22 |
| Sweet 16 | Thu March 26 & Fri March 27 |
| Elite 8 | Sat March 28 & Sun March 29 |
| Final Four | Sat April 4 |
| Championship | Mon April 6 |

### Current lock times (all wrong)
- **Tournament lock_time**: `2026-03-19 12:00:00 UTC` — this is during Round 1, should be before First Four starts
- **Pool lock times**: March 30 — way too late, games will already be in the Elite 8

### Correct lock time
Brackets should lock before the **First Four tips off on March 17**. The first First Four game typically starts around 6:40 PM ET, so the lock time should be approximately:
- **2026-03-17T18:00:00-04:00** (6:00 PM ET / 22:00 UTC on March 17)

This needs to be updated on both the tournament record and all existing pools.

---

## 4. Implementation Plan

### Step 1: Fix team data (SQL migration)
- Update all 68 team records with correct school_name, short_name, seed, region, and play_in_group values matching the official 2026 bracket.
- Clear `game_external_mappings` table entirely.
- Reset all R1 game team assignments to match corrected team IDs.

### Step 2: Fix lock times (SQL migration)
- Update tournament lock_time to `2026-03-17T22:00:00+00:00`.
- Update all pool lock_times to the same value.

### Step 3: Harden name matching (Edge Function update)
- Add explicit disambiguation map for collision-prone names (Tennessee/Tennessee State, Miami/Miami OH, etc.).
- Require exact match before falling back to containment matching.

### Step 4: Run a fresh sync
- With clean data and cleared mappings, run a full sync to establish correct external mappings.
- Verify all 67 games match correctly in sync logs.

