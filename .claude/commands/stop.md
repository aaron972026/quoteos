---
description: Manual hard-stop checkpoint — audit current trajectory against the rules
argument-hint: [optional: concern]
---

Pause. Audit the current trajectory against CLAUDE.md §3 (hard-stop rules) before doing anything else.

Specifically check:

**SCOPE**
- What was the last approved slice's `TOUCHES` / `DOES NOT`?
- Has anything I've done or am about to do violate it?

**UNCERTAIN**
- Am I operating on assumptions that weren't approved?
- Is my confidence below 80% on any active step?

**SIZE**
- Files touched this slice: <count>
- Net lines this slice: <count>
- Verification failures in a row: <count>
- Estimated context used by this subtask: <%>

## Output

```
🛑 HARD-STOP AUDIT

SCOPE:       ✓ within bounds | ✗ <what drifted>
UNCERTAIN:   ✓ all assumptions approved | ✗ <unapproved assumption>
SIZE:        ✓ within budget | ✗ <which threshold breached>

CONCERN:     $ARGUMENTS

RECOMMENDATION:
  CONTINUE   — nothing fired
  RE-SCOPE   — re-slice before continuing  (with proposed split)
  ABORT      — back out current slice      (with rollback plan)
```

Do not act on the recommendation. Surface it; wait for me.
