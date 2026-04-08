

# Dashboard: Reorder, Hide Completed, Online Presence

## Overview
Three refinements to the Home tab: reorder sections so Drafts appear first, add a toggle to hide completed items, and show a subtle online-now indicator.

## Changes (single file: `src/pages/DashboardPage.tsx`)

### 1. Reorder Sections
Move the Drafts section (lines 524-572) above the Brackets section (lines 475-522). Adjust animation delays accordingly.

### 2. Hide Completed Toggle
- Add `const [hideCompleted, setHideCompleted] = useState(false)` state
- Add a small toggle pill near the top of the competitions area (below Quick Create): "Hide completed" with a Switch or clickable pill
- Filter drafts: when `hideCompleted`, exclude `d.status === 'completed'`
- Filter brackets: when `hideCompleted`, exclude pools where `bracketStatuses.get(pool.id) === 'complete'`
- If all items in a section are hidden, hide the entire section header

### 3. Online Presence Indicator
- Add a `presenceChannel` via `supabase.channel('online-presence')` using Supabase Realtime Presence
- Track current user presence on mount, subscribe to sync events
- Store `onlineUserIds` set in state
- Display a subtle row below the greeting: small stacked avatar dots (colored circles with initials) for online members + "N online" label
- Fetch all profiles once (the group is small/private) and cross-reference with presence state
- Keep it minimal — a single row with tiny 24px avatar circles, max 5 shown + overflow count

## Technical Details

**Presence channel setup:**
```typescript
const [onlineUsers, setOnlineUsers] = useState<{id: string, name: string, avatar?: string}[]>([]);

useEffect(() => {
  if (!user) return;
  const channel = supabase.channel('online-presence', { config: { presence: { key: user.id } } });
  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const users = Object.values(state).flat().map((p: any) => ({
        id: p.user_id, name: p.display_name, avatar: p.avatar_url
      }));
      setOnlineUsers(users);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ user_id: user.id, display_name: displayName, avatar_url: dashAvatarUrl });
      }
    });
  return () => { supabase.removeChannel(channel); };
}, [user, displayName, dashAvatarUrl]);
```

**Online indicator UI** — placed right after the greeting subtitle:
```
<div className="flex items-center gap-1.5 mt-2">
  <div className="flex -space-x-1.5">
    {onlineUsers.slice(0,5).map(u => <UserAvatar size={20} ... />)}
  </div>
  <span className="text-[10px] text-muted-foreground font-medium">
    {onlineUsers.length} online
  </span>
</div>
```

**Hide completed pill** — placed between Quick Create and the first section:
```
<button onClick={() => setHideCompleted(!hideCompleted)}
  className={cn("text-[10px] font-bold px-3 py-1.5 rounded-full transition-colors",
    hideCompleted ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground"
  )}>
  {hideCompleted ? 'Show completed' : 'Hide completed'}
</button>
```

## Files Modified
1. **`src/pages/DashboardPage.tsx`** — All three features in one file

