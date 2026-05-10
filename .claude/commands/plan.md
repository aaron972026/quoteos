---
description: Produce a slice plan for the request and STOP for approval
argument-hint: [task description]
---

You are entering **PHASE 2 — PLAN** of the Slice Loop (see CLAUDE.md §2).

## Request
$ARGUMENTS

## Your job
Produce **one** slice plan in the exact format below. Do not write code. Do not modify files. Stop after the plan and wait for approval.

If the request is too large for a single slice, output the **first** slice only and list subsequent slices as a one-line backlog under `NEXT SLICES:`.

## Pre-plan checks (silent — only surface issues)
- Have I read the relevant files? If not, Glob/Grep first, then Read only what's needed.
- Are there assumptions I'd have to make? Any assumption ⇒ ask before planning.
- Does this touch a one-way door (schema, public API, deps)? Flag it explicitly.

## Output format (verbatim)

```
SLICE 1 — <imperative title>
GOAL:         <one-sentence outcome — what's true after this slice that wasn't before>
TOUCHES:      <exhaustive list of files/modules>
DOES NOT:     <explicit out-of-scope items>
RISK:         <low | medium | high> — <one-line reason>
VERIFY:       <exact commands or tests that prove success>
ROLLBACK:     <how to undo cleanly>
TOKEN BUDGET: <small | medium | large>

ASSUMPTIONS:
  - <assumption 1, with confidence %>
  - ...

NEXT SLICES (backlog, not for execution now):
  2. <one line>
  3. <one line>
```

After the block, stop. Do not begin EXECUTE until I reply with "go" or an edited plan.
