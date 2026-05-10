# Bugfix — copy-paste template

```
SYMPTOM
  Exact error message or wrong behavior. Stack trace if you have it.
  >

REPRO STEPS
  Minimal sequence that produces the symptom. If you can't reproduce, say so — that's the first thing to fix.
  >

EXPECTED
  What should happen instead.
  >

WHEN STARTED
  Last known good state. Commit hash, version, "after I did X". Helps narrow the search.
  >

SCOPE LIMIT
  What this fix should NOT touch, even if tempting. (Refactors, unrelated cleanup, etc.)
  >

ACCEPTANCE
  How we'll know it's fixed. A failing test you want passing? A CLI command that should succeed?
  >
```

Hand this to Claude with `/fix <paste>`. Expect: reproduce → root-cause writeup → minimal patch with regression test → verification.
