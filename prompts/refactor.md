# Refactor — copy-paste template

Refactors are the most dangerous slice type — they change a lot of code while *intending* to change no behavior. Be specific about the invariant.

```
WHAT'S WRONG NOW
  The actual pain. ("Function is too long" is not pain. "I had to read 200 lines to fix a 5-line bug" is.)
  >

INVARIANT (must not change)
  The behavior that must be byte-identical before/after. Tests that verify this invariant must already exist or be added FIRST.
  >

TARGET SHAPE
  What the code should look like after. Module boundary? Function signature? Pattern?
  >

MIGRATION PATH
  Big-bang vs. incremental. If incremental, list intermediate states that are each shippable.
  >

BLAST RADIUS
  Files touched (estimate). Public API affected (yes/no). Callers in this repo. Callers outside this repo.
  >

ROLLBACK
  Single revert? Multiple? Feature-flagged? Schema-irreversible?
  >

VERIFICATION
  - Existing tests must still pass.
  - Net behavior diff: what command/test proves nothing observable changed?
  >
```

Hand this to Claude with `/plan <paste>`. Expect Claude to PUSH BACK if the invariant isn't testable — that's the right answer.
