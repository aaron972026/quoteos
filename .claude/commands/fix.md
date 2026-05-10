---
description: Surgical fix for a specific failure — root-cause first, then minimal patch
argument-hint: [error message, failing test name, or file:line]
---

A targeted fix for: $ARGUMENTS

Treat this as a one-slice job. Do not refactor surrounding code. Do not "improve" things you happen to notice.

## Required order

**1. Reproduce** (do this before reading any code)
   - Run the failing thing. Capture the exact error.
   - If it can't be reproduced reliably: HARD STOP / UNCERTAIN. Ask before proceeding.

**2. Root-cause** (in writing, before any edit)
```
SYMPTOM:    <what's failing — exact error or behavior>
TRIGGER:    <minimum input/state that produces it>
ROOT CAUSE: <the actual bug, not the symptom>
WHY NOW:    <what changed — git log if relevant>
EVIDENCE:   <file:line references that prove the root cause>
```

If you cannot fill `ROOT CAUSE` with high confidence: HARD STOP / UNCERTAIN. Ask. Do not patch symptoms.

**3. Patch**
   - Smallest possible diff that addresses the root cause.
   - **Add a regression test** before the fix if at all feasible. Test should fail without the fix and pass with it.
   - One file changed, ideally. More than three files ⇒ HARD STOP / SIZE — re-scope as a refactor slice.

**4. Verify**
   - Run the regression test (must now pass).
   - Run the full test file the test lives in (must still pass).
   - Run the static ladder.

**5. Report**

```
🔧 FIX — <one-line summary>

ROOT CAUSE: <one sentence>
DIFF:       <show the patch>
TEST:       <name of the regression test added>
RUNS:       ✓ regression test  ✓ surrounding tests  ✓ static
SCOPE:      <files touched>
NOT FIXED:  <related things you noticed but did not touch — propose as follow-up slices>
```
