// DH Club — Narrative RPG · Campaign detail page (/narrative/:campaignId)
//
// Mobile-first campaign view. Tabs: Story (default), Characters, World,
// Log. The GM gets a floating "GM" button that opens the Console drawer.
// Pending/non-active campaigns render a status banner instead of
// the play surface.

import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft, ScrollText, MessageSquareText, Users, Globe2, ListChecks,
  Sparkles, Plus, UserPlus, Settings2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useNarrativeCampaign } from '@/hooks/useNarrativeCampaign';
import { useNarrativeCampaigns } from '@/hooks/useNarrativeCampaigns';
import { CampaignStatusPill } from '@/components/narrative/CampaignStatusPill';
import { StoryChat } from '@/components/narrative/StoryChat';
import { CharacterCreationSheet } from '@/components/narrative/CharacterCreationSheet';
import { CharacterSheetCard } from '@/components/narrative/CharacterSheetCard';
import { GMConsoleSheet } from '@/components/narrative/GMConsoleSheet';
import { MemberManagementSheet } from '@/components/narrative/MemberManagementSheet';
import { LiveSessionControls } from '@/components/narrative/LiveSessionControls';
import { LiveSessionPresence } from '@/components/narrative/LiveSessionPresence';
import { InviteRsvpBanner } from '@/components/narrative/InviteRsvpBanner';
import { ClockCard } from '@/components/narrative/ClockCard';
import { SectionHeader } from '@/components/home/SectionHeader';
import { StatusPill } from '@/components/ui/status-pill';
import { getTemplate, type TemplateKey } from '@/lib/narrative/templates';
import { computeCampaignStatus } from '@/lib/narrative/campaignStatus';
import { isFlamingoCampaign, FLAMINGO } from '@/lib/narrative/flamingoTheme';
import { FlamingoCampaignShell, FlamingoCampaignHeader, FlamingoTabs, FlamingoCharacterCard } from '@/components/narrative/flamingo';

type Tab = 'story' | 'characters' | 'world' | 'log';

export default function NarrativeCampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { submitForApproval } = useNarrativeCampaigns();
  const data = useNarrativeCampaign(campaignId);
  const [tab, setTab] = useState<Tab>('story');
  const [creatingChar, setCreatingChar] = useState(false);
  const [gmOpen, setGmOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);

  const isActive = data.campaign?.status === 'active' || data.campaign?.status === 'paused';

  const publicClocks = useMemo(() => data.clocks.filter(c => c.visibility === 'public'), [data.clocks]);
  const publicNpcs   = useMemo(() => data.npcs.filter(n => n.visibility === 'public'),   [data.npcs]);
  const publicClues  = useMemo(() => data.clues.filter(c => c.visibility === 'public' || data.isGm),  [data.clues, data.isGm]);

  if (data.loading && !data.campaign) {
    return (
      <div className="px-4 py-4 space-y-3">
        <div className="h-16 rounded-2xl skeleton-shimmer" />
        <div className="h-32 rounded-2xl skeleton-shimmer" />
        <div className="h-48 rounded-2xl skeleton-shimmer" />
      </div>
    );
  }

  if (!data.campaign) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-[13px] font-extrabold">Campaign not found</p>
        <button onClick={() => navigate('/narrative')} className="mt-3 text-[11px] font-bold text-primary">
          Back to campaigns
        </button>
      </div>
    );
  }

  const campaign = data.campaign;
  const template = getTemplate(campaign.template_key as TemplateKey);
  const flamingo = isFlamingoCampaign(campaign.template_key);
  const computedStatus = computeCampaignStatus({ campaign, recentMessages: data.messages });
  const pendingAiCount = data.aiSuggestions.filter(s => s.status === 'pending' || s.status === 'edited').length;

  // Flamingo Protocol campaigns render inside the neon shell. Other
  // campaigns use a plain flex column (calm shell).
  const PageWrap = (flamingo
    ? FlamingoCampaignShell
    : ({ children }: { children: ReactNode }) => <>{children}</>
  ) as (props: { children: ReactNode }) => JSX.Element;

  return (
    <div className="flex flex-col h-[calc(100dvh-3rem-env(safe-area-inset-top,0px))]">
      <PageWrap>
      {/* Compact header — Flamingo or calm depending on template. */}
      {flamingo ? (
        <FlamingoCampaignHeader
          campaign={campaign}
          computedStatus={computedStatus}
          onBack={() => navigate('/narrative')}
          pendingAiCount={pendingAiCount}
          canOpenGmConsole={data.isGm && isActive}
          onOpenGmConsole={() => setGmOpen(true)}
          canManageMembers={(data.isGm || data.myRole === 'game_master') && isActive}
          onManageMembers={() => setMembersOpen(true)}
        />
      ) : (
      <div
        className="flex-shrink-0 px-3 py-2.5 border-b border-border/20 bg-background/90 backdrop-blur-md flex items-center gap-2"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0px))' }}
      >
        <button
          onClick={() => navigate('/narrative')}
          aria-label="Back"
          className="w-9 h-9 rounded-lg bg-muted/30 flex items-center justify-center active:scale-95 transition"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h1 className="text-[14px] font-extrabold tracking-tight truncate">{campaign.title}</h1>
            <CampaignStatusPill
              status={computeCampaignStatus({ campaign, recentMessages: data.messages })}
              withPulse
            />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/65">
            {template.name}
          </p>
        </div>
        {(data.isGm || data.myRole === 'game_master') && isActive && (
          <button
            type="button"
            onClick={() => setMembersOpen(true)}
            aria-label="Manage members"
            className="h-9 w-9 rounded-lg text-muted-foreground/75 bg-muted/30 border border-border/40 inline-flex items-center justify-center active:scale-95 transition"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        )}
        {data.isGm && isActive && (() => {
          // Open suggestions = pending + edited (edited still needs final approval).
          const pendingCount = data.aiSuggestions.filter(s => s.status === 'pending' || s.status === 'edited').length;
          return (
            <button
              type="button"
              onClick={() => setGmOpen(true)}
              aria-label={pendingCount > 0 ? `Open GM Console — ${pendingCount} pending` : 'Open GM Console'}
              className="relative h-9 px-2.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1 active:scale-95 transition"
              style={{ background: 'hsl(var(--gold) / 0.18)', color: 'hsl(var(--gold))', border: '1px solid hsl(var(--gold) / 0.4)' }}
            >
              <Sparkles className="w-3 h-3" /> GM
              {pendingCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-extrabold tabular-nums inline-flex items-center justify-center ring-2 ring-background"
                  style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                >
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </button>
          );
        })()}
      </div>
      )}

      {/* Pending / approval banner */}
      {!isActive && (
        <div className="px-4 py-4 space-y-3">
          {campaign.status === 'draft' && (
            <BannerCard
              title="This campaign is a draft"
              body="Submit it for club-owner approval when you're ready to play."
              cta={user?.id === campaign.created_by ? { label: 'Submit for approval', onClick: async () => { await submitForApproval(campaign.id); toast.success('Submitted.'); data.refresh(); } } : undefined}
            />
          )}
          {campaign.status === 'pending_approval' && (
            <BannerCard
              title="Awaiting approval"
              body="A club owner will review this campaign before it goes live."
            />
          )}
          {campaign.status === 'needs_changes' && (
            <BannerCard
              title="Changes requested"
              body={campaign.approval_notes ?? 'A club owner has asked for changes — edit the proposal and re-submit.'}
              cta={user?.id === campaign.created_by ? { label: 'Submit again', onClick: async () => { await submitForApproval(campaign.id); toast.success('Re-submitted.'); data.refresh(); } } : undefined}
            />
          )}
          {campaign.status === 'rejected' && (
            <BannerCard
              title="Campaign rejected"
              body={campaign.approval_notes ?? 'A club owner declined this campaign.'}
            />
          )}
          {campaign.pitch && (
            <div className="rounded-2xl bg-card border border-border/40 p-3.5">
              <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/65">Pitch</p>
              <p className="text-[12.5px] text-foreground/85 leading-snug mt-1">{campaign.pitch}</p>
            </div>
          )}
          {campaign.opening_premise && (
            <div className="rounded-2xl bg-card border border-border/40 p-3.5">
              <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/65">Opening premise</p>
              <p className="text-[12.5px] text-foreground/85 leading-snug mt-1 whitespace-pre-wrap">{campaign.opening_premise}</p>
            </div>
          )}
        </div>
      )}

      {/* Tab strip (only for active/paused campaigns) — Flamingo flavor
          on Flamingo Protocol campaigns, calm grid otherwise. */}
      {isActive && (flamingo ? (
        <FlamingoTabs value={tab as any} onChange={(next) => setTab(next as Tab)} />
      ) : (
        <div className="px-3 py-2 border-b border-border/15 flex-shrink-0">
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted/30 p-1">
            {(['story', 'characters', 'world', 'log'] as Tab[]).map(t => {
              const selected = tab === t;
              const Icon = t === 'story' ? MessageSquareText : t === 'characters' ? Users : t === 'world' ? Globe2 : ListChecks;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`inline-flex items-center justify-center gap-1 h-9 rounded-lg text-[11px] font-extrabold uppercase tracking-wider transition ${selected ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground/75'}`}
                >
                  <Icon className="w-3 h-3" /> {t}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Pending invite — viewer was invited but hasn't accepted yet.
          Rendered above the live strip so it's the first thing they see. */}
      {isActive && user && (() => {
        const invite = data.members.find(m => m.user_id === user.id && m.status === 'invited');
        if (!invite) return null;
        return (
          <InviteRsvpBanner
            invitation={invite}
            campaignTitle={campaign.title}
            onResponded={data.refresh}
          />
        );
      })()}

      {/* Live session strip — shown on active campaigns when GM (controls)
          OR for everyone if already live (read-only "Live Now" pill).
          Presence row sits next to the controls so the table can see who
          else is actively in the campaign right now. */}
      {isActive && (data.isGm || campaign.live_session_id) && (
        <div className="px-3 py-2 border-b border-border/15 flex items-center gap-2 flex-wrap">
          <LiveSessionControls
            campaign={campaign}
            currentScene={data.currentScene}
            onChanged={data.refresh}
            readOnly={!data.isGm}
          />
          <LiveSessionPresence
            campaignId={campaign.id}
            myCharacterId={data.myCharacter?.id ?? null}
            myCharacterName={data.myCharacter?.name ?? null}
          />
        </div>
      )}

      {/* Tab content */}
      {isActive && tab === 'story' && (
        <StoryChat
          campaign={campaign}
          isGm={data.isGm}
          myRole={data.myRole}
          myCharacter={data.myCharacter}
          characters={data.characters}
          members={data.members}
          scenes={data.scenes}
          currentScene={data.currentScene}
          messages={data.messages}
          clocks={publicClocks}
          onPost={data.postMessage as any}
          onRoll={data.rollDice as any}
        />
      )}

      {isActive && tab === 'characters' && (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {!data.myCharacter && data.myRole !== 'spectator' && (
            <div className="rounded-2xl bg-card border border-dashed border-primary/40 p-4 text-center">
              <ScrollText className="w-6 h-6 mx-auto text-primary mb-2" />
              <p className="text-[13px] font-extrabold">Create your character before entering the story.</p>
              <button
                onClick={() => setCreatingChar(true)}
                className="mt-3 inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-[12px] font-extrabold"
                style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))', color: 'hsl(var(--primary-foreground))' }}
              >
                <UserPlus className="w-3.5 h-3.5" /> Create character
              </button>
            </div>
          )}
          {data.myCharacter && (
            <>
              <SectionHeader label={flamingo ? 'Your dossier' : 'Your character'} accent="var(--primary)" />
              {flamingo ? (
                <FlamingoCharacterCard character={data.myCharacter} showPrivate />
              ) : (
                <CharacterSheetCard character={data.myCharacter} showPrivate />
              )}
            </>
          )}
          {data.characters.filter(c => c.id !== data.myCharacter?.id).length > 0 && (
            <>
              <SectionHeader label={flamingo ? 'The crew' : 'The party'} count={data.characters.length} />
              <div className="space-y-2">
                {data.characters.filter(c => c.id !== data.myCharacter?.id).map(c => (
                  flamingo
                    ? <FlamingoCharacterCard key={c.id} character={c} showPrivate={data.isGm} />
                    : <CharacterSheetCard key={c.id} character={c} showPrivate={data.isGm} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {isActive && tab === 'world' && (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {publicNpcs.length > 0 && (
            <section>
              <SectionHeader label={flamingo ? 'Known players' : 'Notable NPCs'} count={publicNpcs.length} />
              <div className="space-y-2">
                {publicNpcs.map(n => (
                  flamingo ? (
                    <FlamingoEntityCard
                      key={n.id}
                      title={n.name}
                      eyebrow={n.role ?? undefined}
                      body={n.description ?? undefined}
                      accent={FLAMINGO.gold}
                    />
                  ) : (
                    <div key={n.id} className="rounded-xl bg-card border border-border/40 p-3">
                      <p className="text-[12.5px] font-extrabold">{n.name}</p>
                      {n.role && <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/65">{n.role}</p>}
                      {n.description && <p className="text-[11.5px] text-foreground/80 leading-snug mt-1">{n.description}</p>}
                    </div>
                  )
                ))}
              </div>
            </section>
          )}
          {publicClues.length > 0 && (
            <section>
              <SectionHeader label={flamingo ? 'Case board' : 'Clues'} count={publicClues.length} />
              <div className="space-y-2">
                {publicClues.map(c => (
                  flamingo ? (
                    <FlamingoEntityCard
                      key={c.id}
                      title={c.name}
                      body={c.description ?? undefined}
                      accent={FLAMINGO.clue}
                      pill={c.status.replace('_', ' ')}
                      pillAccent={
                        c.status === 'solved' ? FLAMINGO.success
                          : c.status === 'false_lead' ? FLAMINGO.danger
                          : c.status === 'partial' ? FLAMINGO.gold
                          : FLAMINGO.clue
                      }
                    />
                  ) : (
                    <div key={c.id} className="rounded-xl bg-card border border-border/40 p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12.5px] font-extrabold truncate">{c.name}</span>
                        <StatusPill variant={c.status === 'solved' ? 'success' : c.status === 'false_lead' ? 'danger' : c.status === 'partial' ? 'warning' : 'info'} size="xs">
                          {c.status.replace('_', ' ')}
                        </StatusPill>
                      </div>
                      {c.description && <p className="text-[11.5px] text-foreground/80 leading-snug mt-1">{c.description}</p>}
                    </div>
                  )
                ))}
              </div>
            </section>
          )}
          {publicClocks.length > 0 && (
            <section>
              <SectionHeader label={flamingo ? 'Heat & danger' : 'Active clocks'} count={publicClocks.length} />
              <div className="space-y-2">
                {publicClocks.map(c => <ClockCard key={c.id} clock={c} />)}
              </div>
            </section>
          )}
          {data.locations.length > 0 && (
            <section>
              <SectionHeader label={flamingo ? 'Velvetaine' : 'Locations'} count={data.locations.length} />
              <div className="space-y-2">
                {data.locations.map(l => (
                  flamingo ? (
                    <FlamingoEntityCard
                      key={l.id}
                      title={l.name}
                      body={l.description ?? undefined}
                      accent={FLAMINGO.cyan}
                    />
                  ) : (
                    <div key={l.id} className="rounded-xl bg-card border border-border/40 p-3">
                      <p className="text-[12.5px] font-extrabold">{l.name}</p>
                      {l.description && <p className="text-[11.5px] text-foreground/80 leading-snug mt-1">{l.description}</p>}
                    </div>
                  )
                ))}
              </div>
            </section>
          )}
          {publicNpcs.length === 0 && publicClues.length === 0 && publicClocks.length === 0 && data.locations.length === 0 && (
            <div
              className="rounded-xl p-4 text-center"
              style={flamingo ? {
                background: `hsl(${FLAMINGO.ink} / 0.6)`,
                border: `1px dashed hsl(${FLAMINGO.pink} / 0.3)`,
              } : {
                background: 'hsl(var(--muted) / 0.25)',
                border: '1px dashed hsl(var(--border) / 0.4)',
              }}
            >
              <p
                className="text-[11.5px]"
                style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.7)` : 'hsl(var(--muted-foreground) / 0.75)' }}
              >
                {flamingo
                  ? 'Velvetaine sleeps. The GM lights the neon when the city wakes up.'
                  : 'The world is empty so far. The GM will populate it as the campaign unfolds.'}
              </p>
            </div>
          )}
        </div>
      )}

      {isActive && tab === 'log' && (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <SectionHeader label={flamingo ? 'Episode log' : 'Campaign log'} />
          {(() => {
            const logEvents = data.messages.filter(m =>
              m.message_type === 'scene_card' ||
              m.message_type === 'chapter_transition' ||
              m.message_type === 'campaign_summary'
            );
            if (logEvents.length === 0) {
              return (
                <div
                  className="rounded-xl p-4 text-center"
                  style={flamingo ? {
                    background: `hsl(${FLAMINGO.ink} / 0.6)`,
                    border: `1px dashed hsl(${FLAMINGO.pink} / 0.3)`,
                  } : {
                    background: 'hsl(var(--muted) / 0.25)',
                    border: '1px dashed hsl(var(--border) / 0.4)',
                  }}
                >
                  <p style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.7)` : 'hsl(var(--muted-foreground) / 0.75)' }} className="text-[11.5px]">
                    {flamingo
                      ? 'No episodes filmed yet. The crew hasn\'t made the wire.'
                      : 'No log entries yet.'}
                  </p>
                </div>
              );
            }
            return (
              <div className="space-y-2">
                {logEvents.map(e => {
                  const labelMap: Record<string, string> = flamingo
                    ? {
                        scene_card: 'Scene · Roll Sound',
                        chapter_transition: 'New Chapter',
                        campaign_summary: 'Episode Recap',
                      }
                    : {
                        scene_card: 'Scene',
                        chapter_transition: 'Chapter Transition',
                        campaign_summary: 'Campaign Summary',
                      };
                  const accent = flamingo
                    ? (e.message_type === 'chapter_transition' ? FLAMINGO.pink
                        : e.message_type === 'campaign_summary' ? FLAMINGO.cyan
                        : FLAMINGO.gold)
                    : null;
                  return (
                    <div
                      key={e.id}
                      className="rounded-xl p-3 relative overflow-hidden"
                      style={flamingo && accent ? {
                        background: `linear-gradient(135deg, hsl(${FLAMINGO.ink}), hsl(${FLAMINGO.midnight}))`,
                        border: `1px solid hsl(${accent} / 0.45)`,
                        boxShadow: `0 0 12px -6px hsl(${accent} / 0.5)`,
                      } : {
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border) / 0.4)',
                      }}
                    >
                      {flamingo && accent && (
                        <div
                          aria-hidden
                          className="absolute left-0 top-0 bottom-0 w-1"
                          style={{ background: `hsl(${accent})` }}
                        />
                      )}
                      <div className={flamingo ? 'pl-2' : ''}>
                        <p
                          className="text-[9.5px] font-extrabold uppercase tracking-[0.22em]"
                          style={{ color: flamingo && accent ? `hsl(${accent})` : 'hsl(var(--muted-foreground) / 0.65)' }}
                        >
                          {labelMap[e.message_type] ?? e.message_type.replace('_', ' ')}
                        </p>
                        <p
                          className="text-[12.5px] leading-snug mt-1"
                          style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.9)` : 'hsl(var(--foreground) / 0.85)' }}
                        >
                          {e.body}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Sheets / drawers */}
      <CharacterCreationSheet
        open={creatingChar}
        onClose={() => setCreatingChar(false)}
        templateKey={campaign.template_key as TemplateKey}
        onCreate={async (input) => { await data.createCharacter(input); }}
      />
      {data.isGm && (
        <GMConsoleSheet
          open={gmOpen}
          onClose={() => setGmOpen(false)}
          campaign={campaign}
          currentScene={data.currentScene}
          scenes={data.scenes}
          npcs={data.npcs}
          clues={data.clues}
          items={data.items}
          factions={data.factions}
          clocks={data.clocks}
          locations={data.locations}
          aiSuggestions={data.aiSuggestions}
          onCreateScene={data.createScene as any}
          onEndScene={data.endScene}
          onAdvanceClock={data.advanceClock}
          onCreateClock={data.createClock as any}
          onCreateNpc={data.createNpc as any}
          onCreateClue={data.createClue as any}
          onCreateFaction={data.createFaction as any}
          onCreateItem={data.createItem as any}
          onChanged={data.refresh}
        />
      )}
      {/* Member management — GM or admin only. */}
      {data.isGm && (
        <MemberManagementSheet
          open={membersOpen}
          onClose={() => setMembersOpen(false)}
          campaign={campaign}
          members={data.members}
          onChanged={data.refresh}
        />
      )}
      </PageWrap>
    </div>
  );
}

/** Small dossier/evidence card used in the Flamingo World tab for NPCs,
 *  clues, and locations. Status-pill style chip on the right when a
 *  `pill` label is provided (used for clue statuses). */
function FlamingoEntityCard({
  title, eyebrow, body, accent, pill, pillAccent,
}: {
  title: string;
  eyebrow?: string;
  body?: string;
  accent: string;
  pill?: string;
  pillAccent?: string;
}) {
  return (
    <div
      className="rounded-xl p-3 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, hsl(${FLAMINGO.ink}), hsl(${FLAMINGO.midnight}))`,
        border: `1px solid hsl(${accent} / 0.4)`,
        boxShadow: `0 0 12px -6px hsl(${accent} / 0.45)`,
        color: `hsl(${FLAMINGO.paper})`,
      }}
    >
      <div
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ background: `hsl(${accent})` }}
      />
      <div className="pl-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-extrabold truncate">{title}</p>
          {eyebrow && (
            <p
              className="text-[10px] font-bold uppercase tracking-wider mt-0.5"
              style={{ color: `hsl(${accent})` }}
            >
              {eyebrow}
            </p>
          )}
          {body && (
            <p
              className="text-[11.5px] leading-snug mt-1"
              style={{ color: `hsl(${FLAMINGO.paper} / 0.82)` }}
            >
              {body}
            </p>
          )}
        </div>
        {pill && pillAccent && (
          <span
            className="flex-shrink-0 inline-block rounded-full px-1.5 py-[1px] text-[9px] font-extrabold uppercase tracking-[0.18em]"
            style={{
              background: `hsl(${pillAccent} / 0.2)`,
              color: `hsl(${pillAccent})`,
              border: `1px solid hsl(${pillAccent} / 0.5)`,
            }}
          >
            {pill}
          </span>
        )}
      </div>
    </div>
  );
}

function BannerCard({ title, body, cta }: { title: string; body: string; cta?: { label: string; onClick: () => void } }) {
  return (
    <div className="rounded-2xl bg-card border border-warning/35 p-3.5" style={{ background: 'hsl(38 95% 50% / 0.05)' }}>
      <p className="text-[12.5px] font-extrabold">{title}</p>
      <p className="text-[11.5px] text-foreground/80 leading-snug mt-1">{body}</p>
      {cta && (
        <button onClick={cta.onClick} className="mt-3 h-10 px-4 rounded-xl text-[12px] font-extrabold inline-flex items-center gap-1.5" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))', color: 'hsl(var(--primary-foreground))' }}>
          <Plus className="w-3.5 h-3.5" /> {cta.label}
        </button>
      )}
    </div>
  );
}
