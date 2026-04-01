

## Make Chat Channel Header Sticky

### Problem
The channel header bar (with the back button, channel name, search, pins) can scroll out of view on mobile, forcing users to scroll back up to access navigation controls.

### Root Cause
While the chat layout uses `flex flex-col` with `flex-shrink-0` on the header, the parent `main` element in `AppLayout` has no overflow constraint, which can allow the entire chat container to be scrollable within the page — particularly on mobile when content exceeds the viewport.

### Changes

**1. `src/pages/ChatPage.tsx`** — Add `sticky top-0 z-10` to the channel header div (line 473) so it pins to the top even if an outer container scrolls.

```diff
- <div className="flex items-center gap-2.5 py-3 border-b border-border/20 flex-shrink-0" ...>
+ <div className="flex items-center gap-2.5 py-3 border-b border-border/20 flex-shrink-0 sticky top-0 z-10" ...>
```

**2. `src/components/AppLayout.tsx`** — Add `overflow-hidden` to the `main` element specifically for chat routes, preventing double-scrollbar issues.

```diff
  <main className={cn(
    "flex-1 lg:pb-0 lg:pl-64 overflow-x-hidden min-w-0",
-   isChatRoute ? "pb-0" : "pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]"
+   isChatRoute ? "pb-0 overflow-hidden" : "pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]"
  )}>
```

These two changes ensure the header always stays visible regardless of scroll position or viewport resizing.

