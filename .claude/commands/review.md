---
description: Independent code review of pending changes (delegates to reviewer subagent)
argument-hint: [optional: branch, commit range, or path]
---

Run an **independent** review of the pending changes — not a victory lap.

Delegate to the `reviewer` subagent with a fresh context so the review is not biased by what we just discussed.

## Scope
- $ARGUMENTS (default: `git diff` against the upstream branch)
- If there are no uncommitted/unpushed changes, say so and stop.

## Reviewer's brief (pass this to the subagent)

> You are an independent reviewer. You have not seen the conversation that produced these changes. Read the diff cold.
>
> Evaluate against:
> 1. **Correctness** — does it do what the commit message / slice goal claims?
> 2. **Safety** — error handling, edge cases, race conditions, resource leaks, injection/escape, secrets in code.
> 3. **Tests** — is the new behavior covered? Do tests test behavior, not implementation?
> 4. **Style fit** — does it match surrounding code conventions?
> 5. **Scope** — anything outside what a single slice should touch?
> 6. **Reversibility** — schema/API/dep changes flagged?
>
> Output in this exact shape:
>
> ```
> REVIEW — <branch/range>
>
> BLOCKING (must fix before merge):
>   - <file:line> — <issue> — <suggested fix>
>
> NON-BLOCKING (worth addressing):
>   - <file:line> — <issue>
>
> NITS (style only):
>   - <file:line> — <one-liner>
>
> POSITIVES (briefly — what's good):
>   - <one-liner>
>
> VERDICT: APPROVE | APPROVE-WITH-NITS | REQUEST-CHANGES | BLOCK
> ```

Do not start fixing anything based on the review. Bring the report back to me; I'll decide which findings become slices.
