---
description: Execute the approved slice — implement, verify, report
argument-hint: [optional: slice number or note]
---

You are entering **PHASE 3-5 — EXECUTE → VERIFY → REPORT** of the Slice Loop.

## Pre-execution gate
Confirm — silently, but stop if any answer is "no":
1. Is there an approved slice plan in this session? (If no: run `/plan` first.)
2. Am I about to touch only files in `TOUCHES`? (If no: HARD STOP / SCOPE.)
3. Do I have everything I need to satisfy `VERIFY`? (If no: HARD STOP / UNCERTAIN.)

## Execute
- Make the smallest set of edits that satisfy `GOAL`.
- Use `Edit` (not `Write`) for existing files.
- One concept per edit call.
- If you discover the slice was wrong-shaped mid-execution: HARD STOP / SCOPE — do not adjust silently.

## Verify (run the slice's VERIFY block, in order)
1. Static checks (ruff, format, mypy if Python).
2. Tests for the touched area.
3. Smoke check (the literal "does the thing run" test).
4. Diff review — read your own diff and flag anything outside `TOUCHES`.

If any step fails: do **not** keep patching blindly. After the **second** failure with no clear theory: HARD STOP / SIZE.

## Report (verbatim format)

```
✅ SLICE <N> COMPLETE — <title>

CHANGED:
  <path>  +<adds> -<dels>
  ...

VERIFY:
  ✓ <command> — <result>
  ✓ <command> — <result>

KEY HUNKS:
  <show the 1-3 most important diffs only — not the whole patch>

OUT-OF-SCOPE FOUND (not fixed):
  - <thing> at <path:line>  → suggest as next slice

NEXT:
  <one-line: what slice 2 should be, OR "awaiting direction">
```

Then stop. Do not start the next slice without approval.
