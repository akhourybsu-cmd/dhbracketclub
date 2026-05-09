import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Input } from '@/components/ui/input';
import { Search, Loader2, User as UserIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type Row = { id: string; display_name: string | null; avatar_url: string | null };

export default function AdminUsersPage() {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async (q: string) => {
    setLoading(true);
    let req = (supabase as any).from('profiles').select('id, display_name, avatar_url').limit(50).order('display_name');
    const trimmed = q.trim();
    if (trimmed) req = req.ilike('display_name', `%${trimmed}%`);
    const { data } = await req;
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  return (
    <AdminLayout title="Users" subtitle="Search profiles and view memberships. Promote/demote and suspension are coming soon.">
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
        <Input
          placeholder="Search by display name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void search(query); }}
          className="pl-9 form-input"
        />
      </div>
      <button
        onClick={() => void search(query)}
        className="w-full mb-4 h-10 rounded-xl font-bold text-[12px] btn-press"
        style={{ background: 'hsl(var(--primary) / 0.14)', color: 'hsl(var(--primary))' }}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Search'}
      </button>

      {rows.length === 0 && !loading && (
        <div className="glass-card p-6 text-center">
          <UserIcon className="w-6 h-6 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-[12px] text-muted-foreground/80">Run a search to view users.</p>
        </div>
      )}

      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.id} className="glass-card p-3 flex items-center gap-3">
            {r.avatar_url ? (
              <img src={r.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center font-bold">
                {(r.display_name ?? '?')[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold truncate">{r.display_name ?? 'Unnamed'}</p>
              <p className="text-[10px] text-muted-foreground/70 font-mono truncate">{r.id.slice(0, 8)}…</p>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
