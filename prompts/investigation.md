# Investigation — copy-paste template

For "why does X happen" or "where is Y implemented" — questions, not changes. Constrains Claude to read-only and to return a *report*, not a fix.

```
QUESTION
  What you actually want answered. One sentence.
  >

WHY YOU'RE ASKING
  What decision this informs. (Helps focus the answer.)
  >

KNOWN CONTEXT
  What you've already checked, ruled out, or suspect. So Claude doesn't repeat it.
  >

SCOPE
  Where to look. Whole repo? Specific package? Specific file?
  >

DEPTH
  Quick (single targeted lookup) | Medium (a few hypotheses checked) | Deep (cross-cutting analysis)
  >

OUTPUT SHAPE
  Bullet points? Diagram? Annotated file:line list?
  >

NON-GOALS
  - Do not propose fixes.
  - Do not modify any file.
  - Do not run tests unless explicitly needed to answer the question.
```

Hand this to Claude with: "Investigate, do not modify anything: <paste>"

Expect: a report, with file:line citations, calibrated confidence per claim, and a list of the next questions the investigation surfaced.
