import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type Row = {
  id: string;
  event_type: string;
  created_at: string;
  metadata: any;
  actor_user_id: string;
  profiles?: { display_name: string } | null;
};

export default function AdminAuditPage() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    (supabase as any)
      .from('activity_feed')
      .select('id, event_type, created_at, metadata, actor_user_id, profiles:actor_user_id(display_name)')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }: any) => setRows((data ?? []) as Row[]));
  }, []);

  return (
    <AdminLayout title="Audit Log" subtitle="Last 100 platform events. Role/feature-flag changes will appear here when those tools land.">
      {rows === null && <div className="loading-spinner-ring mx-auto my-8" />}
      <div className="space-y-1.5">
        {rows?.map((r) => {
          const meta = (typeof r.metadata === 'object' && r.metadata) || {};
          const title = meta.title || meta.topic || meta.question || '';
          return (
            <div key={r.id} className="glass-card p-3 flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'hsl(var(--gold) / 0.12)' }}
              >
                <Activity className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold truncate">
                  <span className="text-muted-foreground/80">{r.profiles?.display_name ?? 'Unknown'}</span>{' '}
                  <span className="font-mono text-[11px]">{r.event_type}</span>
                  {title && <span className="text-foreground/80"> — {title}</span>}
                </p>
                <p className="text-[10px] text-muted-foreground/70">
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </AdminLayout>
  );
}
