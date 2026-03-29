

# Chat Message Attribution — Differentiation Plan

## Problem
Currently all messages look identical regardless of sender. The only distinguishing element is a small name + avatar shown on the first message of a group, then subsequent messages from the same author have no visual author cue at all. In a busy channel with multiple people, it's hard to scan and attribute messages.

## Approach: Color-coded author accent strip (Slack/Discord hybrid)

Rather than traditional chat bubbles (which waste horizontal space and look dated), use a **thin left border accent** colored per-user, combined with improved avatar persistence. This is how Discord and Linear handle attribution — compact, scannable, and modern.

```text
┌─────────────────────────────────┐
│ 🟣 ┃ Alex · 2:14 PM             │  ← accent bar + avatar + name
│    ┃ Hey, did you see the game?  │
│    ┃ It was incredible           │  ← grouped, same accent color
│                                  │
│ 🟢 ┃ Jordan · 2:15 PM           │  ← different accent color
│    ┃ Yeah! That last play 🔥     │
│                                  │
│ 🟣 ┃ Alex · 2:16 PM             │  ← Alex's color returns
│    ┃ We should do a bracket      │
└─────────────────────────────────┘
```

## Changes

### 1. Deterministic user color system (`UserAvatar.tsx`)
Export a `getUserColor(userId)` utility that returns a consistent HSL color per user. The avatar already computes hues — extract this into a shared function so both the avatar and the accent strip use the same color.

### 2. Left accent border on messages (`MessageBubble.tsx`)
- Add a 3px left border on each message row, colored with the user's accent color
- For grouped messages (same author), continue the accent strip with no gap — this visually connects consecutive messages from the same person without needing to repeat the avatar
- For the current user's own messages, use a distinct muted/primary accent so "your" messages are instantly recognizable

### 3. Persistent mini-avatar on grouped messages (`MessageBubble.tsx`)
Currently grouped messages (`sameAuthor=true`) hide the avatar entirely. Instead, show a **smaller avatar (18px)** in the left gutter for grouped messages. This provides a persistent visual anchor even mid-group, especially useful when scrolling through long runs of messages.

### 4. Subtle background tint for own messages (`MessageBubble.tsx`)
Add a very light `bg-primary/4` background tint to the current user's messages. This is a common pattern (iMessage, WhatsApp) that makes your own messages instantly distinguishable without full bubbles.

### 5. Author name color matches accent (`MessageBubble.tsx`)
Tint the author display name with their accent color (at reduced opacity) so the name visually links to the accent strip.

## Files to modify
- `src/components/chat/UserAvatar.tsx` — extract `getUserColor()` utility
- `src/components/chat/MessageBubble.tsx` — accent border, mini-avatar for groups, own-message tint, colored name

## What stays the same
- No traditional bubbles — keeps the compact Slack/Discord-style layout
- No changes to message data, reactions, threading, or actions
- Mobile bottom sheet and all existing UX preserved

