import { supabase } from "@/integrations/supabase/client";

/**
 * Record an admin action to the unified audit log.
 *
 * The actor is stamped server-side from auth.uid() — clients cannot forge it.
 * Calls from non-admins are rejected at the RPC layer.
 *
 * Failures are swallowed (logged to console) so that audit-write errors never
 * block the underlying admin operation. If you need hard-fail semantics, pass
 * `{ throwOnError: true }`.
 */
export async function logAdminAction(
  action: string,
  opts: {
    targetType?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
    throwOnError?: boolean;
  } = {},
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("log_admin_action", {
      _action: action,
      _target_type: opts.targetType ?? null,
      _target_id: opts.targetId ?? null,
      _metadata: (opts.metadata ?? {}) as never,
    });
    if (error) throw error;
    return (data as string) ?? null;
  } catch (err) {
    console.warn("[audit] log_admin_action failed:", err);
    if (opts.throwOnError) throw err;
    return null;
  }
}
