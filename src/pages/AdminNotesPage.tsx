import { AdminLayout } from '@/components/admin/AdminLayout';
import { Sparkles } from 'lucide-react';

export default function AdminNotesPage() {
  return (
    <AdminLayout title="Polish Notes" subtitle="Mobile refinement checklist and admin notes.">
      <div className="glass-card p-6 text-center">
        <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'hsl(var(--accent) / 0.14)', border: '1px solid hsl(var(--accent) / 0.22)' }}>
          <Sparkles className="w-5 h-5 text-accent" />
        </div>
        <p className="text-[13px] font-bold mb-1">Coming soon</p>
        <p className="text-[11px] text-muted-foreground/80 leading-snug">Backed by a new <code className="font-mono">admin_notes</code> table (Phase 3).</p>
      </div>
    </AdminLayout>
  );
}
