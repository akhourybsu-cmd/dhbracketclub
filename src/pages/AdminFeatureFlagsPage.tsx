import { AdminLayout } from '@/components/admin/AdminLayout';
import { Flag } from 'lucide-react';

export default function AdminFeatureFlagsPage() {
  return (
    <AdminLayout title="Feature Flags" subtitle="Toggle modules and beta tools across the platform.">
      <div className="glass-card p-6 text-center">
        <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'hsl(var(--primary) / 0.14)', border: '1px solid hsl(var(--primary) / 0.22)' }}>
          <Flag className="w-5 h-5 text-primary" />
        </div>
        <p className="text-[13px] font-bold mb-1">Coming soon</p>
        <p className="text-[11px] text-muted-foreground/80 leading-snug">Backed by a new <code className="font-mono">app_feature_flags</code> table (Phase 3).</p>
      </div>
    </AdminLayout>
  );
}
