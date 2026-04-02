import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';
import type { Channel, Category } from './types';

const EMOJI_OPTIONS = [
  '💬', '📢', '🏀', '🎬', '🍕', '🎲', '✈️', '🏆',
  '🎮', '🎵', '📚', '🏈', '⚽', '🎯', '💡', '🔥',
  '❤️', '🌍', '📸', '🛠️', '💰', '🎤', '🐶', '🚀',
];

interface ChannelSettingsDialogProps {
  channel: Channel;
  categories: Category[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (channelId: string, updates: Partial<Pick<Channel, 'name' | 'description' | 'icon' | 'category_id' | 'is_default'>>) => Promise<boolean>;
  onDelete: (channelId: string) => void;
}

export function ChannelSettingsDialog({ channel, categories, open, onOpenChange, onUpdate, onDelete }: ChannelSettingsDialogProps) {
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description || '');
  const [icon, setIcon] = useState(channel.icon || '');
  const [categoryId, setCategoryId] = useState(channel.category_id || '');
  const [isDefault, setIsDefault] = useState(channel.is_default);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const sanitizedName = name.trim().toLowerCase().replace(/\s+/g, '-');
    onUpdate(channel.id, {
      name: sanitizedName,
      description: description.trim() || null,
      icon: icon || null,
      category_id: categoryId || null,
      is_default: isDefault,
    });
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Channel Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Channel Name</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="channel-name"
              className="h-9 text-sm"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Description</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What's this channel about?"
              className="text-sm resize-none min-h-[60px]"
              rows={2}
            />
          </div>

          {/* Emoji/Icon */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Icon</Label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setIcon('')}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs border transition-all ${!icon ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-border/30 hover:bg-muted/50'}`}
              >
                #
              </button>
              {EMOJI_OPTIONS.map(e => (
                <button
                  key={e}
                  onClick={() => setIcon(e)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-all ${icon === e ? 'border border-primary bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/50'}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Category</Label>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">No category</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Default toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs font-semibold">Default Channel</Label>
              <p className="text-[10px] text-muted-foreground/70">New users land here first</p>
            </div>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </div>

          <Button onClick={handleSave} disabled={saving || !name.trim()} className="w-full h-9 text-xs font-bold">
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>

          <Separator />

          {/* Danger zone */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-destructive/70">Danger Zone</p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="w-full h-8 text-xs gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" /> Delete Channel
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete #{channel.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the channel and all its messages, reactions, and read states. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => { onDelete(channel.id); onOpenChange(false); }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
