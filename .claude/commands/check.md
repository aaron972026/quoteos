---
description: Run the full verification ladder against current changes
argument-hint: [optional: scope, e.g. path or test pattern]
---

Run the verification ladder (CLAUDE.md §5.3) against $ARGUMENTS (or the current working set if no argument).

Do not modify files. This is read-only.

Order — stop at first failure, report it, then continue with remaining checks marked as `[skipped — gated by earlier failure]`:

1. **Static**
   - `ruff check $ARGUMENTS`
   - `ruff format --check $ARGUMENTS`
   - `mypy --strict $ARGUMENTS` (Python only)
2. **Unit**
   - `pytest -x -q $ARGUMENTS` (or the project's equivalent)
3. **Smoke**
   - Identify and run the minimal "does the thing work" check. If none exists, say so — do not invent one.
4. **Diff review**
   - `git diff --stat` then read the diff for the touched area.
   - Flag: secrets, debug prints, TODOs added, files outside the agreed slice, unused imports.

## Output

```
CHECK REPORT
  static:  ✓ | ✗ <one-line>
  unit:    ✓ | ✗ <one-line>
  smoke:   ✓ | ✗ | n/a <one-line>
  diff:    ✓ | ✗ <findings>

VERDICT: GREEN | YELLOW | RED
  GREEN  = ship-ready
  YELLOW = passes gates, but I noticed N things worth your attention
  RED    = blocking — do not ship

If RED, propose the smallest next slice that would turn it GREEN — do not start it.
```
