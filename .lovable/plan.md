

# Light/Dark Mode Toggle — Plan

## What needs to happen

1. **Fix the build error** in `ChatPage.tsx` (line ~370 has a dangling `await` outside an `async` function — the `loadPinnedMessages` function declaration is missing its `const ... = async () => {` wrapper)

2. **Add `next-themes` ThemeProvider** to `App.tsx` — the package is already installed but no provider wraps the app, so `useTheme()` in `sonner.tsx` returns a default

3. **Create a theme toggle component** — a clean Sun/Moon icon button that calls `setTheme()` from `next-themes`

4. **Add the toggle to the Profile page** — alongside the existing sound toggle, add a "Dark Mode" / "Light Mode" switch row

5. **Add the toggle to AppLayout header** — a small icon button in the top-right area for quick access from any page

6. **Update `index.html`** — add `class="dark"` to `<html>` so `next-themes` initializes correctly with dark as default (matching current design)

7. **Verify light mode CSS** — the `.light` class already exists in `index.css` with a full set of light-mode variables. Just need to confirm the `dark` class maps to `:root` values (or duplicate them under `.dark`).

## Files to change

- `src/pages/ChatPage.tsx` — fix the broken `async` function wrapper (~line 370)
- `src/App.tsx` — wrap with `ThemeProvider` from `next-themes` (defaultTheme="dark", attribute="class")
- `src/components/ThemeToggle.tsx` — new component with Sun/Moon icon
- `src/components/AppLayout.tsx` — add ThemeToggle to header
- `src/pages/ProfilePage.tsx` — add theme toggle row in settings section
- `index.html` — add `class="dark"` to `<html>`
- `src/index.css` — add `.dark` class mirroring current `:root` values so both dark and light themes work with the class-based system

## Technical approach

- `next-themes` with `attribute="class"` and `defaultTheme="dark"` handles persistence (localStorage) and SSR automatically
- Tailwind's `darkMode: ["class"]` is already configured
- The existing `.light` CSS block has all needed light-mode variables
- Add a `.dark` block that duplicates `:root` dark values so the toggle works bidirectionally

