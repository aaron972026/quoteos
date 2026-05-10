---
description: Pre-merge gate — full verify, review, and commit/PR prep
argument-hint: [optional: PR title or commit message]
---

Treat this as the final gate before code leaves the branch. Be paranoid.

## Sequence (do not reorder)

**1. Pre-flight**
   - `git status` — uncommitted/untracked? Surface them. Do not commit by surprise.
   - `git log --oneline @{upstream}..HEAD` — list commits going out.

**2. Full verification ladder** (CLAUDE.md §5.3) — must be GREEN
   - Static, unit, smoke. RED here ⇒ stop and report.

**3. Independent review** — invoke the `reviewer` subagent with the full diff (`git diff @{upstream}...HEAD`).
   - Any `BLOCKING` finding ⇒ stop and report; do not proceed to commit.

**4. Commit message / PR draft**
   Format:
   ```
   <type>(<scope>): <imperative summary, ≤72 chars>

   WHY: <one paragraph — what problem this solves, not what code changed>

   WHAT: <bullet list of slice-level changes>

   VERIFY:
     - <command> — <expected>
     - ...

   RISK / ROLLBACK: <one line>
   ```
   `<type>` ∈ {feat, fix, refactor, perf, docs, test, chore, build}.

**5. Output a SHIP REPORT**

```
🚢 SHIP REPORT

CHECKS:    ✓ static  ✓ unit  ✓ smoke  ✓ review
COMMITS:   <n> going out
DIFF:      +<adds> -<dels> across <n> files
RISK:      <low | medium | high> — <reason>

PROPOSED MESSAGE:
<commit / PR draft above>

NEXT ACTION (you, the human):
  - review the message above
  - run: git commit / open PR
  - I will not push or merge.
```

I push. I merge. You stop at the report.
