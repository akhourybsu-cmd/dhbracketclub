import { AdminLayout } from '@/components/admin/AdminLayout';
import { Megaphone } from 'lucide-react';

export default function AdminAnnouncementsPage() {
  return (
    <AdminLayout title="Announcements" subtitle="Send platform-wide messages to all members.">
      <div className="glass-card p-6 text-center">
        <div
          className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
          style={{ background: 'hsl(var(--warning) / 0.14)', border: '1px solid hsl(var(--warning) / 0.22)' }}
        >
          <Megaphone className="w-5 h-5 text-warning" />
        </div>
        <p className="text-[13px] font-bold mb-1">Coming soon</p>
        <p className="text-[11px] text-muted-foreground/80 leading-snug">
          Compose a title, body, and target audience, then push it out app-wide. Backed by a new <code className="font-mono">announcements</code> table (Phase 3).
        </p>
      </div>
    </AdminLayout>
  );
}
