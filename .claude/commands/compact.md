---
description: Compact the working context — keep facts, drop chatter
argument-hint: [optional: areas to preserve]
---

Produce a tight handoff summary I can paste into a fresh session to continue this work without re-explaining.

Aggressively drop:
- Conversational back-and-forth.
- Tool output that has been superseded.
- Anything we explored and abandoned, unless it informs current decisions.
- Long file contents — replace with `path:lines` references.

Keep:
- The original goal.
- Decisions made + the reasoning that's still load-bearing.
- The current slice plan and its status.
- File paths + line numbers for key code.
- Open questions / hard-stops awaiting answers.
- Verification commands established for this work.

## Output format

```
HANDOFF — <date> — <one-line goal>

GOAL
  <restated in one sentence>

DECISIONS (load-bearing)
  - <decision> — <why>

CURRENT STATE
  Slice <N>: <title> — <pending|in-progress|verified>
  Touched:  <paths>
  Verify:   <commands>

OPEN
  - <question or hard-stop awaiting decision>

REFERENCES
  - <path:lines> — <what it is>

PRESERVE (per request): $ARGUMENTS
```

Do not include the diff itself. Do not summarize what I already know. The reader is me, tomorrow, with a clean context.
