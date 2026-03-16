import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { LogOut, User } from 'lucide-react';
import { motion } from 'framer-motion';

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
      initial={{ opacity: 0, y: 10 }}
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
          <p className="page-header-subtitle">Manage your account</p>
        </div>
      </div>

      <div className="glass-card p-6 space-y-5 mb-6">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl font-extrabold text-primary">
            {displayName ? displayName[0].toUpperCase() : '?'}
          </div>
          <div>
            <p className="font-bold text-lg">{displayName}</p>
            <p className="text-xs text-muted-foreground font-medium">{user?.email}</p>
          </div>
        </div>

        <div>
          <label className="form-label">Display Name</label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="form-input" />
        </div>

        <Button onClick={handleSave} className="w-full h-11 font-bold rounded-xl btn-press" disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Button variant="outline" className="w-full gap-2 h-11 text-destructive hover:text-destructive font-bold rounded-xl btn-press" onClick={signOut}>
        <LogOut className="w-4 h-4" /> Sign Out
      </Button>
    </motion.div>
  );
}
