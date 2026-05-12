#!/usr/bin/env python3
"""Build docs/PRIVACY_MATRIX.md from a pg_policies dump (env POLICIES_TSV)."""
import os, re, sys
from collections import defaultdict

src = os.environ.get("POLICIES_TSV", "/tmp/policies.tsv")
rows = defaultdict(lambda: defaultdict(list))

with open(src) as f:
    current = None
    for raw in f:
        line = raw.rstrip("\n")
        if not line.strip():
            continue
        if line.startswith("  "):
            if current and rows[current[0]][current[1]]:
                rows[current[0]][current[1]][-1] += " / " + line.strip()
            continue
        parts = line.split("\t", 2)
        if len(parts) < 3:
            continue
        table, cmd, blob = parts
        current = (table, cmd)
        for pol in blob.split("\n  "):
            rows[table][cmd].append(pol.strip())


def classify(s: str) -> str:
    s = (s or "").lower()
    if s.strip() in ("-", "true"):
        return "🌐 Anyone"
    tags = []
    if "is_app_admin" in s or "is_platform_owner" in s or "role = 'admin'" in s:
        tags.append("Admin")
    if "auth.uid() = user_id" in s or "user_id = auth.uid()" in s or "auth.uid() = id" in s or "id = auth.uid()" in s:
        tags.append("Owner")
    if "is_club_admin" in s or "is_club_manager" in s:
        tags.append("Club admin")
    elif "current_user_club_id" in s or "club_members" in s:
        tags.append("Club member")
    if "is_pool_admin" in s:
        tags.append("Pool admin")
    elif "is_pool_member" in s:
        tags.append("Pool member")
    if not tags and ("auth.uid() is not null" in s or "authenticated" in s):
        tags.append("Authenticated")
    if not tags:
        tags.append("Conditional")
    return " + ".join(tags)


cmds = ["SELECT", "INSERT", "UPDATE", "DELETE", "ALL"]
out = [
    "# Privacy & Access Matrix",
    "",
    "Generated from `pg_policies` on the live database. Each row summarizes who can perform each action on a table according to current Row-Level Security policies.",
    "",
    "Legend: **🌐 Anyone** = anonymous + authenticated. **Owner** = `auth.uid() = user_id`. **Club member / admin** = membership-gated. **Admin** = `is_app_admin` / `is_platform_owner`.",
    "",
    "| Table | SELECT | INSERT | UPDATE | DELETE | ALL |",
    "|---|---|---|---|---|---|",
]

for table in sorted(rows.keys()):
    cells = []
    for cmd in cmds:
        pols = rows[table].get(cmd, [])
        if not pols:
            cells.append("—")
            continue
        labels = set()
        for p in pols:
            mu = re.search(r"USING=(.*?)\s*\|\s*CHECK=", p)
            mc = re.search(r"CHECK=(.*)$", p)
            labels.add(classify((mu.group(1) if mu else "") + " " + (mc.group(1) if mc else "")))
        cells.append(" / ".join(sorted(labels)))
    out.append(f"| `{table}` | " + " | ".join(cells) + " |")

out += [
    "",
    "## Tables without RLS",
    "None — every public table has RLS enabled. CI guard: `src/test/rls/anonymous-access.test.ts`.",
    "",
    "## How to regenerate",
    "Run `scripts/build-privacy-matrix.sh` after any RLS migration.",
    "",
]

dst = os.path.join(os.path.dirname(__file__), "..", "docs", "PRIVACY_MATRIX.md")
with open(dst, "w") as f:
    f.write("\n".join(out))
print(f"Wrote {dst} ({len(rows)} tables)")
