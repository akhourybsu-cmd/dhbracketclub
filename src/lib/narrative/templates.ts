// DH Club — Narrative RPG · Campaign templates
//
// Templates are seed data the campaign creator can choose at proposal time.
// Each template provides setting/tone, starter NPCs, factions, locations,
// clues, clocks, and optional GM-only canon. After approval, the GM can
// edit/add/remove any of this — the template is a starting point, never
// a constraint.
//
// IMPORTANT canon notes:
//
//  • The Flamingo Protocol is Miami Vice-style cinematic crime chaos with
//    absurdist comedy, faction politics, casino/studio/nightclub energy,
//    criminal negotiations, flashy dialogue, and occasional Western
//    movie-set imagery woven in because of the movie-set backdrop. It is
//    NOT "Neon Western" — the Western flavor is part of the cinematic
//    production backdrop, not the genre.
//
//  • Flamingo Protocol does NOT include prebuilt player characters.
//    Players create original characters when they join the campaign.
//
// Adding a new template: append to TEMPLATES + add its key to the
// `template_key` CHECK constraint in the SQL migration.

import type { ChronicleStat } from './chronicleRuleset';

export type TemplateKey = 'blank' | 'flamingo_protocol';

export type ClockType = 'danger' | 'opportunity' | 'mystery' | 'faction' | 'custom';

interface SeedNpc {
  name: string;
  role: string;
  description: string;
  visibility: 'public' | 'gm_only';
  /** Optional voice/tone notes the GM can lean on. */
  voice_notes?: string;
  /** Optional GM-only motives/secrets. */
  motives?: string;
  secrets?: string;
}

interface SeedLocation {
  name: string;
  description: string;
  visibility: 'public' | 'gm_only';
  region?: string;
}

interface SeedFaction {
  name: string;
  description: string;
  attitude?: string;
  relationship_score?: number;
  suspicion_score?: number;
  visibility: 'public' | 'gm_only';
  public_notes?: string;
  gm_notes?: string;
}

interface SeedClue {
  name: string;
  description: string;
  visibility: 'public' | 'gm_only';
  importance: 'low' | 'normal' | 'high';
  status: 'discovered' | 'partial' | 'solved' | 'false_lead';
}

interface SeedClock {
  name: string;
  description: string;
  current_value: number;
  max_value: number;
  clock_type: ClockType;
  visibility: 'public' | 'gm_only';
}

interface SeedScene {
  title: string;
  location?: string;
  stakes?: string;
  objective?: string;
  public_notes?: string;
  /** GM-only notes — never shown to players. */
  gm_notes?: string;
}

export interface CharacterArchetypeSuggestion {
  label: string;
  blurb: string;
  /** Suggested stat hint — purely informational, not enforced. */
  suggestedStats?: Array<{ stat: ChronicleStat; bias: 'high' | 'mid' }>;
}

export interface CampaignTemplate {
  key: TemplateKey;
  name: string;
  tagline: string;
  description: string;
  /** Long-form GM tone guide rendered in the campaign settings + memory seed. */
  toneGuide: string;
  /** Default tone keywords for the campaign's `tone_profile` field. */
  toneProfile: string;
  /** Suggested opening premise — pre-fills the proposal form; GM can edit. */
  openingPremise: string;
  /** Setting summary (for the World tab / campaign memory seed). */
  setting: string;
  /** Optional canon locks — GM agrees not to retcon these unless players say so. */
  canonLocks?: string[];
  /** A sample of the GM's preferred narration voice — helps AI maintain tone. */
  exampleNarration?: string;
  /** Suggested starter content. All editable post-approval. */
  starterScene?: SeedScene;
  starterLocations?: SeedLocation[];
  starterNpcs?: SeedNpc[];
  starterFactions?: SeedFaction[];
  starterClues?: SeedClue[];
  starterClocks?: SeedClock[];
  /** Character archetype suggestions — NOT prebuilt characters. */
  characterArchetypes?: CharacterArchetypeSuggestion[];
}

/* ─────────────────────────────────────────────────────────────────
 * THE FLAMINGO PROTOCOL
 *
 * Velvetaine. Miami Vice-style cinematic crime chaos. Casino + studio
 * underworld with faction politics, flashy dialogue, escalating
 * consequences, and occasional Western movie-set imagery layered in
 * because the production backdrop happens to be on a backlot Western.
 * ─────────────────────────────────────────────────────────────────*/

const FLAMINGO_PROTOCOL: CampaignTemplate = {
  key: 'flamingo_protocol',
  name: 'The Flamingo Protocol',
  tagline: 'Velvetaine, the tape, and a power struggle that won\'t stay buried.',
  description:
    'A flagship campaign set in Velvetaine — a city of casinos, studios, after-hours lounges, and crooked production deals. Players are pulled into a power struggle over a mysterious tape, the eccentric figures who want it, and the shadowy operation known only as The Flamingo Protocol.',
  toneGuide:
    'Miami Vice-style cinematic crime chaos. Flashy. Funny. Faction-driven. Casino/studio underworld energy. Absurdist friend-group dialogue with real stakes. Conversational pacing punctuated by escalating consequences. Recurring NPCs that feel like sitcom regulars who happen to carry guns. Western movie-set imagery shows up because the players keep crossing through a backlot — it is BACKDROP, not GENRE.',
  toneProfile:
    'cinematic-crime · flashy · funny · faction-driven · velvetaine · casino-studio · escalating · absurd-but-dangerous',
  openingPremise:
    'A group of ambitious, reckless, or desperate characters are pulled into Velvetaine\'s casino/studio underworld after a mysterious tape becomes leverage in a power struggle involving Catalina Cashmere, Tony Madone, and a shadowy operation known only as The Flamingo Protocol.',
  setting:
    'Velvetaine — a city stitched together from casino floors, neon strips, after-hours lounges, studio backlots, and the kind of motel rooms where deals get done and never spoken about again. Money moves through movie productions. Productions launder favors. Favors collapse into debts. Debts collapse into bodies.',
  canonLocks: [
    'Velvetaine is the city. It is not a metaphor for somewhere else.',
    'Catalina Cashmere runs a studio orbit. Tony Madone runs the Italian crew. Boilon runs the Colombians.',
    'The tape exists. Whether it has been edited is up for play.',
    'The Flamingo Protocol is a real operation. What it actually does is for the GM and the table to discover.',
  ],
  exampleNarration:
    'The valet pretends he hasn\'t seen you before. The valet has absolutely seen you before. Behind him the casino sign flickers — pink, pink, then a stutter of dead — and somewhere across the lot a film crew is yelling about a horse. The motel sign says VACANCY in two languages. One of them is lying.',
  starterScene: {
    title: 'After-hours at the Pink Sand',
    location: 'After-hours lounge, mezzanine level',
    stakes: 'Someone wants the tape. The party is being introduced to that someone — and probably to one or two people they shouldn\'t have known existed yet.',
    objective: 'Figure out who actually called this meeting, and whether to walk in or walk out.',
    public_notes: 'The Pink Sand lounge is empty except for the regulars, a Catalina Cashmere fixer, and one too-curious waiter who keeps refilling drinks that aren\'t empty.',
    gm_notes: 'The fixer is on Tony Madone\'s payroll, not Catalina\'s — they\'re trying to flip. The waiter is law enforcement adjacent (not federal yet). The Flamingo Protocol clock can advance if any character mentions the tape by name.',
  },
  starterLocations: [
    { name: 'Catalina\'s studio lot',     description: 'Working production by day, anything-goes after dark. Cameras still rolling somewhere.', visibility: 'public' },
    { name: 'Tony Madone\'s backroom',    description: 'Pool table, three phones, one window that doesn\'t open. Tony does not raise his voice. Ever.', visibility: 'public' },
    { name: 'Velvetaine casino floor',    description: 'Pink-and-gold carpet. Pit bosses with earpieces. The kind of place where a stack of chips can buy a name.', visibility: 'public' },
    { name: 'After-hours lounge (Pink Sand)', description: 'Mezzanine bar that opens at 1 AM. The piano player knows everything and tells nothing.', visibility: 'public' },
    { name: 'Motel parking lot',          description: 'The unofficial second office of every fixer in Velvetaine. Asphalt remembers tire tracks.', visibility: 'public' },
    { name: 'Backlot Western set',        description: 'A working production of a Western movie. Boardwalks, false-front saloons, hitching posts. Real horses. Real guns sometimes.', visibility: 'public' },
    { name: 'Neon strip',                 description: 'The artery of Velvetaine after midnight. Cars idle, deals happen, neon flickers.', visibility: 'public' },
    { name: 'Hidden screening room',      description: 'Below the studio commissary. Sound-proofed. The kind of room where tapes get watched.', visibility: 'gm_only' },
  ],
  starterNpcs: [
    {
      name: 'Catalina Cashmere',
      role: 'Studio executive / face of the operation',
      description: 'Charming. Loud. Runs a studio that doesn\'t entirely exist on paper. Wears sunglasses indoors. Knows everyone\'s real name.',
      visibility: 'public',
      voice_notes: 'Cuts you off mid-sentence and then says something nicer than you would have said yourself. Always working three angles. Calls people "honey" until she doesn\'t.',
      motives: 'Wants the tape. Needs the tape. Will pretend not to want it.',
      secrets: 'The studio is being used as cover for the Flamingo Protocol. She may or may not know this.',
    },
    {
      name: 'Tony Madone',
      role: 'Italian crew boss',
      description: 'Quiet. Polite. Always at the corner table. Has never been seen standing up. Owns the room without asking.',
      visibility: 'public',
      voice_notes: 'Speaks slowly. Asks a question and then waits the question out, even if it takes a full minute. Then says "okay" in a way that means "no".',
      motives: 'Wants the tape destroyed. Cannot let his name be on it. Will trade favors for that destruction.',
      secrets: 'Knows what The Flamingo Protocol is. Has been lying about it for two years.',
    },
    {
      name: 'Boilon',
      role: 'Colombian operator',
      description: 'Sharp suits, sharper laugh, never carries his own bag. Travels with three people and a tiny dog.',
      visibility: 'public',
      voice_notes: 'Tells one joke, then watches who laughs. The ones who laugh too hard get told a second joke that isn\'t one.',
      motives: 'Wants Catalina to owe him something. Doesn\'t care about the tape — he wants the leverage that flows from people thinking he cares about the tape.',
      secrets: 'Has a copy of the tape. Will not produce it unless asked the right way.',
    },
  ],
  starterFactions: [
    {
      name: 'Catalina\'s studio orbit',
      description: 'Producers, fixers, talent reps, lighting guys, on-set medics, post-production techs. Movement is constant. Loyalty is conditional.',
      attitude: 'Cordial — but always counting.',
      relationship_score: 10,
      suspicion_score: 15,
      visibility: 'public',
      public_notes: 'Production fronts most of the daylight business. Studio is the most visible faction in Velvetaine.',
      gm_notes: 'Several of Catalina\'s inner circle are quietly on other payrolls. The post-production room is where the tape lives — or used to.',
    },
    {
      name: 'Tony Madone and the Italians',
      description: 'Old crew. Newer money. Discipline. Runs three of the largest after-hours lounges and at least one of the casino vaults.',
      attitude: 'Polite and unimpressed.',
      relationship_score: -5,
      suspicion_score: 30,
      visibility: 'public',
      public_notes: 'The Italian crew is the most stable faction in Velvetaine and the most dangerous to cross.',
      gm_notes: 'Tony has been preparing for The Flamingo Protocol going public for two years. He has a fallback plan that will burn at least one other faction down.',
    },
    {
      name: 'Boilon and the Colombians',
      description: 'Smaller crew, more international. Owns the cocaine and most of the import chain. Less interested in being seen, more interested in being owed.',
      attitude: 'Friendly, transactional, terrifying.',
      relationship_score: 0,
      suspicion_score: 25,
      visibility: 'public',
      public_notes: 'New to Velvetaine in this decade. Already entrenched.',
    },
    {
      name: 'Casino/studio power players',
      description: 'Independent operators — pit bosses, producers, talent agents, hotel ownership groups. Not one faction; many small ones that align on convenience.',
      attitude: 'Each one for themselves.',
      visibility: 'public',
    },
    {
      name: 'Velvetaine criminal underworld',
      description: 'The general ecosystem of low-level crews, drivers, dealers, runners, and informants. Useful for legwork. Loud-mouthed under pressure.',
      attitude: 'Loyal until they\'re not.',
      visibility: 'public',
    },
    {
      name: 'Law enforcement (federal pressure)',
      description: 'Not yet kicking down doors. Watching. Has assets inside the casino and at least one production.',
      attitude: 'Patient.',
      visibility: 'gm_only',
      gm_notes: 'Currently in observation mode. They escalate when "Police pressure rises" clock hits 4/6. They have one informant whose identity should be a mid-campaign reveal.',
    },
  ],
  starterClues: [
    {
      name: 'The tape may have been edited',
      description: 'Whatever\'s on the tape, the timecodes don\'t match the official production log for that night.',
      visibility: 'public',
      importance: 'high',
      status: 'discovered',
    },
    {
      name: 'Someone else knows about the deal',
      description: 'A third party has been asking questions — not Tony\'s people, not Catalina\'s, not Boilon\'s. Someone outside.',
      visibility: 'public',
      importance: 'high',
      status: 'partial',
    },
    {
      name: 'Catalina is not telling the full truth',
      description: 'Two of her own producers tell incompatible versions of the same week.',
      visibility: 'public',
      importance: 'normal',
      status: 'discovered',
    },
    {
      name: 'Tony\'s people are watching the studio',
      description: 'A black sedan has been parked across from the studio gate every night this week. Different drivers. Same plates.',
      visibility: 'public',
      importance: 'normal',
      status: 'discovered',
    },
    {
      name: 'The movie set is being used for more than filming',
      description: 'Crew shifts on the Western backlot don\'t match call sheets. Lights stay on after wrap. Vehicles come in. Things come out.',
      visibility: 'public',
      importance: 'normal',
      status: 'partial',
    },
  ],
  starterClocks: [
    { name: 'Catalina grows suspicious',           description: 'Whose side are these characters actually on?', current_value: 0, max_value: 6, clock_type: 'faction',    visibility: 'public' },
    { name: 'Tony loses patience',                 description: 'Every visit costs.',                            current_value: 0, max_value: 8, clock_type: 'faction',    visibility: 'public' },
    { name: 'The tape changes hands',              description: 'Each handoff is more dangerous than the last.', current_value: 0, max_value: 4, clock_type: 'mystery',    visibility: 'public' },
    { name: 'Police pressure rises',               description: 'Federal observation tightens.',                 current_value: 0, max_value: 6, clock_type: 'danger',     visibility: 'public' },
    { name: 'The Flamingo Protocol stirs',         description: 'Something underneath is starting to move.',     current_value: 0, max_value: 10, clock_type: 'mystery',   visibility: 'gm_only' },
    { name: 'The studio lot goes into lockdown',   description: 'When this hits max, the backlot becomes inaccessible — and useful in different ways.', current_value: 0, max_value: 6, clock_type: 'danger', visibility: 'gm_only' },
  ],
  characterArchetypes: [
    { label: 'Smooth operator',     blurb: 'Talks fast, smiles wider, knows whose hands to shake.',           suggestedStats: [{ stat: 'charm', bias: 'high' }, { stat: 'cunning', bias: 'mid' }] },
    { label: 'Washed-up actor',     blurb: 'Big in the 90s. Still has the look. Still has the temper.',       suggestedStats: [{ stat: 'charm', bias: 'high' }, { stat: 'chaos', bias: 'mid' }] },
    { label: 'Casino rat',          blurb: 'Lives on the floor. Knows every dealer\'s alibi.',                 suggestedStats: [{ stat: 'cunning', bias: 'high' }, { stat: 'focus', bias: 'mid' }] },
    { label: 'Streetwise driver',   blurb: 'Owns a car nobody else can keep up with.',                        suggestedStats: [{ stat: 'focus', bias: 'high' }, { stat: 'grit', bias: 'mid' }] },
    { label: 'Crooked fixer',       blurb: 'Solves problems. Creates new, smaller, more solvable ones.',     suggestedStats: [{ stat: 'cunning', bias: 'high' }, { stat: 'charm', bias: 'mid' }] },
    { label: 'Wannabe gangster',    blurb: 'Tries way too hard. Has lasted longer than anyone expected.',   suggestedStats: [{ stat: 'grit', bias: 'high' }, { stat: 'chaos', bias: 'mid' }] },
    { label: 'Private investigator', blurb: 'Hates the city. Won\'t leave.',                                  suggestedStats: [{ stat: 'cunning', bias: 'high' }, { stat: 'focus', bias: 'mid' }] },
    { label: 'Studio crew member',  blurb: 'Lighting, sound, props — sees everyone come and go.',           suggestedStats: [{ stat: 'cunning', bias: 'mid' }, { stat: 'focus', bias: 'mid' }] },
    { label: 'Nightclub regular',   blurb: 'Hasn\'t paid for a drink in three years.',                       suggestedStats: [{ stat: 'charm', bias: 'high' }, { stat: 'chaos', bias: 'mid' }] },
    { label: 'Wild card',           blurb: 'Don\'t worry about it. You\'ll find out.',                      suggestedStats: [{ stat: 'chaos', bias: 'high' }] },
  ],
};

/* ─────────────────────────────────────────────────────────────────
 * BLANK CAMPAIGN
 *
 * No setting/canon. Creator fills in their own. Still uses Chronicle.
 * ─────────────────────────────────────────────────────────────────*/

const BLANK_CAMPAIGN: CampaignTemplate = {
  key: 'blank',
  name: 'Blank Campaign',
  tagline: 'Start from a blank page. Define your own setting, tone, and opening.',
  description:
    'A clean starting template. Pick a genre, set the tone, write your opening premise, and the Chronicle Engine handles the rest — characters, dice, scenes, clues, factions, clocks, and campaign memory all work the same way.',
  toneGuide: 'Define your own tone in the campaign settings. The GM Console respects whatever you write.',
  toneProfile: '',
  openingPremise: '',
  setting: '',
  canonLocks: [],
};

/* ── Lookup ───────────────────────────────────────────────────── */

export const TEMPLATES: Record<TemplateKey, CampaignTemplate> = {
  blank: BLANK_CAMPAIGN,
  flamingo_protocol: FLAMINGO_PROTOCOL,
};

export const TEMPLATE_LIST: CampaignTemplate[] = [BLANK_CAMPAIGN, FLAMINGO_PROTOCOL];

export function getTemplate(key: TemplateKey | string | null | undefined): CampaignTemplate {
  if (!key) return BLANK_CAMPAIGN;
  return TEMPLATES[key as TemplateKey] ?? BLANK_CAMPAIGN;
}
