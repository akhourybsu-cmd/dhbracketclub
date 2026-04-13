

# Clarification Needed

The project already uses **Lovable AI**, which provides access to both Google Gemini and OpenAI models through a pre-configured gateway. No external API key is needed.

The earlier issue with outdated AI knowledge (Zootopia 2, K-pop Demon Hunters) is solved by:
1. Upgrading the model from `google/gemini-3-flash-preview` to `google/gemini-2.5-pro` (more recent training data)
2. Adding today's date to the system prompt so the AI knows what year it is

**This was already planned and approved** in a previous conversation but may not have been deployed yet.

## If you still want to use your own OpenAI API key

This is possible but **not recommended** — it would mean:
- Managing your own billing separately from Lovable
- No real advantage since the same OpenAI models (GPT-5, GPT-5-mini) are already available through Lovable AI
- Extra configuration work

## Recommended next step

Apply the previously approved fix: upgrade the AI model and add date-awareness to the `rate-draft` and `resolve-pick-dispute` edge functions. This will resolve the knowledge recency problem without any external API key.

### Changes
1. **`supabase/functions/rate-draft/index.ts`** — Change model to `google/gemini-2.5-pro`, add `Today's date is YYYY-MM-DD` to system prompt
2. **`supabase/functions/resolve-pick-dispute/index.ts`** — Same model + date changes
3. **`supabase/functions/suggest-items/index.ts`** — Same updates for consistency

