

# Fix Chat Layout Overflow on Mobile

## Problem
The chat page is rendered inside `AppLayout`'s content wrapper which adds padding (`py-5`) and bottom padding for the nav bar (`pb-[calc(4.5rem+...)]`). The chat page tries to escape this with negative margins (`-mx-4 -mt-5`) and a hardcoded height of `calc(100dvh - 4.5rem - safe-area)`. This doesn't account for the wrapper padding correctly, causing content to overflow or get cut off on different phone sizes.

## Solution
Give the chat page a dedicated layout treatment so it fills the available viewport exactly, without fighting the generic content wrapper.

### Changes

**1. AppLayout.tsx — detect chat route and skip content padding**
When the current route is `/chat`, render `{children}` directly inside `<main>` without the `max-w-[640px] mx-auto px-4 py-5` wrapper. The chat page will manage its own full-bleed layout. The bottom padding for the nav bar still applies.

**2. ChatPage.tsx — remove negative margin hacks, use clean full-height layout**
- Remove all `-mx-4 sm:-mx-5 -mt-5 sm:-mt-6 lg:-mt-8` negative margins from both the channel list view and message view containers.
- Change height from the hardcoded `calc(100dvh - 4.5rem - ...)` to `100%` — since the parent `<main>` already accounts for the bottom nav via its padding-bottom, the chat container just needs to fill the remaining space.
- Use `h-[calc(100dvh-4.5rem-env(safe-area-inset-bottom,0px))]` on the outermost chat div but without negative margins, since there's no wrapper padding to escape.

**3. Result**
The chat area will perfectly fill the space between the top of the screen and the bottom nav bar on any phone — iPhone SE, iPhone Pro Max, Pixel, Galaxy, etc. — because it no longer fights wrapper padding with fragile negative margins.

### Technical Detail
```
Before (fragile):
  <main pb=nav-height>
    <div px-4 py-5 max-w-640>     ← generic wrapper
      <div -mx-4 -mt-5 h=calc(100dvh-nav)>  ← chat fighting the wrapper
        ...
      </div>
    </div>
  </main>

After (clean):
  <main pb=nav-height>
    <div h=full>                   ← chat route: no wrapper padding
      <div h=calc(100dvh-nav)>     ← chat fills exactly
        ...
      </div>
    </div>
  </main>
```

Files to modify:
- `src/components/AppLayout.tsx` — conditional wrapper for chat route
- `src/pages/ChatPage.tsx` — remove negative margins from both views

