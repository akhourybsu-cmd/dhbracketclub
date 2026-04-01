import { Shield, Lock, Eye, Server, Key, Users, FileCheck, Globe, Database, ShieldCheck, ShieldAlert, Fingerprint } from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

const SECURITY_SECTIONS = [
  {
    id: 'encryption-transit',
    icon: Globe,
    color: 'success',
    title: 'Encryption in Transit',
    status: 'Active',
    summary: 'All data is encrypted using TLS 1.2+ (HTTPS) between your device and our servers.',
    details: [
      'Every API call, page load, and file upload is encrypted with industry-standard TLS (Transport Layer Security).',
      'This is the same encryption used by banks and financial institutions.',
      'No data is ever transmitted over unencrypted HTTP connections.',
      'Certificate pinning is enforced by the hosting infrastructure.',
    ],
  },
  {
    id: 'encryption-rest',
    icon: Database,
    color: 'success',
    title: 'Encryption at Rest',
    status: 'Active',
    summary: 'Your data is encrypted on disk using AES-256 server-side encryption.',
    details: [
      'All database volumes use AES-256 encryption, meaning your data is unreadable even if physical storage is compromised.',
      'Encryption keys are managed by the cloud infrastructure and rotated automatically.',
      'Backups are also encrypted with the same level of protection.',
    ],
  },
  {
    id: 'access-control',
    icon: Key,
    color: 'primary',
    title: 'Access Control & Permissions',
    status: 'Enforced',
    summary: 'Row-Level Security (RLS) ensures you can only access data you are authorized to see.',
    details: [
      'Every database table has Row-Level Security policies that restrict reads and writes to authorized users only.',
      'You can only edit your own profile, brackets, and messages — no one else can modify your data.',
      'Pool data (brackets, standings, picks) is scoped to pool members only.',
      'Admin actions are restricted to verified pool administrators and are audit-logged.',
      'Security-critical operations use server-side "security definer" functions that bypass client permissions safely.',
    ],
  },
  {
    id: 'authentication',
    icon: Fingerprint,
    color: 'primary',
    title: 'Authentication',
    status: 'Secured',
    summary: 'Industry-standard authentication with email verification and secure session management.',
    details: [
      'Passwords are hashed using bcrypt with automatic salting — we never store or see your plain-text password.',
      'Email verification is required before account activation.',
      'Sessions are managed with secure, short-lived JWT tokens that are automatically refreshed.',
      'Signing out immediately invalidates your session.',
      'Registration is invite-only — you need a valid invite code to create an account, keeping the community private.',
    ],
  },
  {
    id: 'invite-only',
    icon: Users,
    color: 'accent',
    title: 'Invite-Only Community',
    status: 'Active',
    summary: 'Only people with a valid invite code can join. This keeps the app private and trusted.',
    details: [
      'New accounts require a valid, unused invite code during registration.',
      'Invite codes are single-use and tracked to prevent unauthorized access.',
      'This ensures every member is vouched for, creating a trusted environment.',
      'There is no public registration — outsiders cannot create accounts.',
    ],
  },
  {
    id: 'data-privacy',
    icon: Eye,
    color: 'warning',
    title: 'Data Privacy',
    status: 'Protected',
    summary: 'Your personal data is minimal and never shared with third parties.',
    details: [
      'We collect only what is needed: email, display name, and your in-app activity.',
      'Your data is never sold, shared, or provided to third-party advertisers.',
      'Profile photos are stored in isolated, user-scoped storage buckets.',
      'You can change your display name and avatar at any time from your profile.',
      'Chat messages and bracket picks are only visible to authenticated members.',
    ],
  },
  {
    id: 'message-security',
    icon: Lock,
    color: 'accent',
    title: 'Chat & Message Security',
    status: 'Secured',
    summary: 'Messages are protected by strict access controls. Only you can edit your own messages.',
    details: [
      'All messages are transmitted over encrypted connections (TLS).',
      'Row-Level Security ensures only authenticated members can read messages.',
      'Only the original author can edit or delete their own messages — no one else can modify what you wrote.',
      'Message pinning uses a separate, secure server-side function so it does not grant broader edit access.',
      'Image uploads are validated for type and size (max 10MB) before acceptance.',
      'Link previews are fetched server-side with protections against internal network probing (SSRF protection).',
      'Note: Messages are not end-to-end encrypted. The server can read message content to provide features like search, link previews, push notifications, and shared media. This is standard for apps like Slack, Discord, and iMessage (non-E2EE mode).',
    ],
  },
  {
    id: 'abuse-prevention',
    icon: ShieldAlert,
    color: 'warning',
    title: 'Abuse Prevention',
    status: 'Active',
    summary: 'Multiple layers protect against spam, abuse, and malicious content.',
    details: [
      'Push notifications are throttled to prevent notification spam (max 1 per minute per channel).',
      'File uploads are restricted by type (images only) and size (10MB limit).',
      'URL handling validates protocols — only http:// and https:// links are rendered.',
      'Embedded content (Spotify, YouTube) uses strict allowlists to prevent injection attacks.',
      'Server-side link fetching blocks requests to private IP ranges, preventing SSRF attacks.',
    ],
  },
  {
    id: 'infrastructure',
    icon: Server,
    color: 'success',
    title: 'Infrastructure',
    status: 'Enterprise-Grade',
    summary: 'Built on enterprise-grade cloud infrastructure with automatic scaling and redundancy.',
    details: [
      'Hosted on globally distributed cloud infrastructure with automatic failover.',
      'Database backups run continuously with point-in-time recovery capability.',
      'Edge functions run in isolated, sandboxed environments.',
      'All infrastructure components are regularly patched and updated.',
      'API keys and secrets are stored in secure vaults — never in client-side code.',
    ],
  },
  {
    id: 'input-validation',
    icon: FileCheck,
    color: 'primary',
    title: 'Input Validation',
    status: 'Enforced',
    summary: 'All user inputs are validated to prevent injection attacks and data corruption.',
    details: [
      'Form inputs are validated on both client and server side.',
      'Database queries use parameterized statements — SQL injection is not possible.',
      'File uploads are validated for MIME type and size before storage.',
      'URL inputs are sanitized to prevent cross-site scripting (XSS) and open redirect attacks.',
      'No user-generated HTML is rendered directly — all content is safely escaped.',
    ],
  },
];

export default function SecurityInfoPanel() {
  return (
    <div className="glass-card p-5 mb-4">
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--success) / 0.15), hsl(var(--success) / 0.04))',
          }}
        >
          <ShieldCheck className="w-5 h-5" style={{ color: 'hsl(var(--success))' }} />
        </div>
        <div>
          <h3 className="text-[13px] font-bold">Security & Privacy</h3>
          <p className="text-[10px] text-muted-foreground/60">How we protect your data</p>
        </div>
      </div>

      {/* Overall status badge */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4"
        style={{
          background: 'linear-gradient(135deg, hsl(var(--success) / 0.08), hsl(var(--success) / 0.02))',
          border: '1px solid hsl(var(--success) / 0.12)',
        }}
      >
        <Shield className="w-4 h-4" style={{ color: 'hsl(var(--success))' }} />
        <div>
          <p className="text-[11px] font-bold" style={{ color: 'hsl(var(--success))' }}>All Systems Secure</p>
          <p className="text-[9px] text-muted-foreground/70">
            Encrypted connections • Access controls active • Invite-only community
          </p>
        </div>
      </div>

      {/* Accordion sections */}
      <Accordion type="multiple" className="space-y-1">
        {SECURITY_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <AccordionItem key={section.id} value={section.id} className="border-b-0">
              <AccordionTrigger className="py-3 hover:no-underline gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: `linear-gradient(135deg, hsl(var(--${section.color}) / 0.12), hsl(var(--${section.color}) / 0.04))`,
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: `hsl(var(--${section.color}))` }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[12px] font-semibold truncate">{section.title}</p>
                      <span
                        className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md flex-shrink-0"
                        style={{
                          background: `hsl(var(--${section.color}) / 0.1)`,
                          color: `hsl(var(--${section.color}))`,
                        }}
                      >
                        {section.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 leading-snug mt-0.5 line-clamp-1">
                      {section.summary}
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pl-10 pr-2 pb-2 space-y-2">
                  <p className="text-[11px] text-muted-foreground/80 leading-relaxed">{section.summary}</p>
                  <ul className="space-y-1.5">
                    {section.details.map((detail, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span
                          className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0"
                          style={{ background: `hsl(var(--${section.color}))` }}
                        />
                        <span className="text-[10px] text-muted-foreground/70 leading-relaxed">{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Footer note */}
      <div className="mt-4 pt-3 border-t border-border/30">
        <p className="text-[9px] text-muted-foreground/50 text-center leading-relaxed">
          Security is an ongoing commitment. Our architecture follows industry best practices
          including defense-in-depth, least-privilege access, and server-authoritative data validation.
        </p>
      </div>
    </div>
  );
}
