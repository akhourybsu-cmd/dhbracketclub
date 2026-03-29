import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Plus, MessageSquare, Pin, Heart, ChevronRight, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { logActivity } from '@/lib/activityLogger';

type Post = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  comments_count: number;
  created_at: string;
  profiles?: { display_name: string };
};

export default function PostsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { play } = useSoundEffect();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', content: '' });

  useEffect(() => { fetchPosts(); }, []);

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles:user_id(display_name)')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (data) {
      // Get comment counts
      const postIds = data.map(p => p.id);
      let countMap = new Map<string, number>();
      if (postIds.length > 0) {
        const { data: comments } = await supabase
          .from('post_comments')
          .select('post_id')
          .in('post_id', postIds);
        if (comments) {
          comments.forEach(c => countMap.set(c.post_id, (countMap.get(c.post_id) || 0) + 1));
        }
      }
      setPosts(data.map(p => ({ ...p, comments_count: countMap.get(p.id) || 0 })));
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.content.trim() || !user) return;
    play('success');
    const { data, error } = await supabase.from('posts').insert({
      user_id: user.id,
      title: form.title.trim(),
      content: form.content.trim(),
    }).select().single();

    if (data) {
      await logActivity(user.id, { event_type: 'post_created', target_type: 'post', target_id: data.id, metadata: { title: data.title } });
      setShowCreate(false);
      setForm({ title: '', content: '' });
      navigate(`/posts/${data.id}`);
    }
  };

  return (
    <div className="pb-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-extrabold tracking-tight">Discussions</h1>
          <Button size="sm" onClick={() => setShowCreate(true)} className="h-8 gap-1.5 text-xs font-bold rounded-xl">
            <Plus className="w-3.5 h-3.5" /> New Post
          </Button>
        </div>

        {/* Create form */}
        <AnimatePresence>
          {showCreate && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-6">
              <div className="glass-card p-4 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold">New Discussion</h3>
                  <button onClick={() => setShowCreate(false)} className="p-1 rounded hover:bg-muted/50"><X className="w-3.5 h-3.5" /></button>
                </div>
                <Input placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="h-9 text-sm" />
                <Textarea placeholder="What's on your mind?" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} className="text-sm min-h-[100px]" />
                <Button onClick={handleCreate} disabled={!form.title.trim() || !form.content.trim()} className="w-full h-9 text-xs font-bold">Post</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Posts list */}
        <div className="space-y-2">
          {posts.map((post, i) => (
            <motion.div key={post.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Link to={`/posts/${post.id}`} className="block group">
                <div className="glass-card p-4 transition-all duration-200 group-hover:border-primary/15">
                  <div className="relative z-10">
                    {post.is_pinned && (
                      <div className="flex items-center gap-1 text-[9px] font-bold text-premium-warm mb-1.5">
                        <Pin className="w-2.5 h-2.5" /> Pinned
                      </div>
                    )}
                    <h3 className="font-bold text-[14px] tracking-tight mb-1">{post.title}</h3>
                    <p className="text-[12px] text-foreground/50 line-clamp-2 leading-relaxed mb-2">{post.content}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground/40">
                        <span className="font-semibold">{post.profiles?.display_name}</span>
                        <span>·</span>
                        <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
                          <MessageSquare className="w-3 h-3" /> {post.comments_count}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/15" />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {posts.length === 0 && !loading && (
          <div className="text-center py-16">
            <FileText className="w-10 h-10 mx-auto text-muted-foreground/15 mb-3" />
            <p className="text-sm text-muted-foreground/50 font-medium">No discussions yet</p>
            <p className="text-xs text-muted-foreground/30 mt-1">Start a conversation</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
