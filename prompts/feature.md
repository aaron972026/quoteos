# Feature request — copy-paste template

Fill in every field. Empty fields are an instruction to stop and ask.

```
GOAL
  In one sentence, what's true after this is done that isn't true now?
  >

USER / CALLER
  Who or what triggers this? CLI user? HTTP client? cron? upstream service?
  >

INPUTS
  Shape, types, validation rules, edge cases (empty, max, malformed).
  >

OUTPUTS
  Shape, types, error modes, what success looks like.
  >

NON-GOALS
  What this is explicitly NOT doing. Be aggressive — most scope creep starts here.
  >

CONSTRAINTS
  Performance budget, memory, latency, dependencies allowed/forbidden, must-be-pure, must-be-async, etc.
  >

EXAMPLES (at least one happy + one error)
  Input  -> output
  Input  -> error
  >

EXISTING CODE TO RESPECT
  Modules, patterns, abstractions that already exist and should be reused, not reinvented.
  >

VERIFICATION
  Exact commands that prove this works. If you can't write them, the feature isn't specified yet.
  >

ROLLBACK
  How to undo this cleanly. (Feature flag? Revert one commit? Schema migration down?)
  >
```

Hand this to Claude with `/plan <paste>`. Expect a slice plan back, not code.
