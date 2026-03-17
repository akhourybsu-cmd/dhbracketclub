import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { LogOut, User } from 'lucide-react';
import { motion } from 'framer-motion';
import dhMonogram from '@/assets/dh-monogram.png';

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('display_name').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) setDisplayName(data.display_name);
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', user.id);

    if (error) toast.error(error.message);
    else toast.success('Profile updated!');
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto"
    >
      {/* Page header */}
      <div className="page-header">
        <div className="page-header-icon">
          <User />
        </div>
        <div>
          <h1 className="page-header-title">Profile</h1>
          <p className="page-header-subtitle">Manage your DH Club account</p>
        </div>
      </div>

      {/* Identity card */}
      <div className="glass-card arena-edge p-6 mb-4">
        <div className="flex items-center gap-4 mb-6 relative z-10">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-extrabold text-primary relative" style={{
            background: 'linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.04))',
            border: '1px solid hsl(var(--primary) / 0.1)',
            boxShadow: '0 0 20px hsl(var(--primary) / 0.06)',
          }}>
            {displayName ? displayName[0].toUpperCase() : '?'}
          </div>
          <div>
            <p className="font-bold text-lg leading-tight">{displayName}</p>
            <p className="text-[11px] text-muted-foreground/60 font-medium mt-0.5">{user?.email}</p>
          </div>
        </div>

        <div className="relative z-10 space-y-4">
          <div>
            <label className="form-label">Display Name</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="form-input" />
          </div>

          <Button onClick={handleSave} className="w-full h-11 font-bold rounded-xl btn-press text-[13px]" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* DH Club branding */}
      <div className="flex items-center justify-center gap-2 py-4 mb-2">
        <img src={dhMonogram} alt="DH Club" className="w-5 h-5 object-contain opacity-30" />
        <span className="text-[9px] text-muted-foreground/30 font-bold uppercase tracking-[0.15em]">DH Club Member</span>
      </div>

      {/* Sign out */}
      <button
        onClick={signOut}
        className="w-full flex items-center justify-center gap-2 h-10 rounded-xl text-[13px] font-medium text-muted-foreground/60 hover:text-destructive transition-colors duration-200"
      >
        <LogOut className="w-3.5 h-3.5" /> Sign Out
      </button>
    </motion.div>
  );
}
