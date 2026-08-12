# Staleness sweeps: correct present-tense behavior claims, preserve historical statements

## The rule

When asked to "update anything stale" on a PR or issue that maintainers have already read, "fix stale things" is too blunt an instruction to act on directly. Split every candidate in two:

- **A present-tense claim about how the feature behaves** → **must be corrected.** It is being read right now as a description of current state. Example: *"every Standard+ function's `parentScope` is its exact owning compilation unit"* — true when written, made false by a later scope cut that deliberately leaves included/`#line`-remapped sources null.
- **A historical statement about a past commit** → **must NOT be corrected.** Commit-specific diff stats, "tests pass 74/74 at this head", a build report — these were true when written and are legitimately a record of that moment. Rewriting them destroys the audit trail and makes the log lie about what was known when.

The load-bearing question is not "is this text still accurate?" but "**is this text asserting current behavior, or recording a past event?**"

## Corollary: append, don't rewrite

For anything a maintainer has already read, prefer **appending** a correction over silently editing the original:

> *"Correction: the statement above was accurate when written, but a later review round cut X. As it stands now, …"*

A silent edit makes a reviewer wonder what else moved under them; an append says exactly what changed and when. Rewriting history is for typos, not for facts a human has already acted on.

## Corollary: don't re-cite volatile references

Stale `file.cpp:1234` citations in a comment usually went stale because a merge or rebase shifted the file. **Updating the number just resets a clock that expires on the next merge.** Prefer removing the numbers and keeping the stable references — function names, gate/condition names, symbol names — which don't rot. Only cite a line number where it's genuinely load-bearing and you accept it as a snapshot.

## Scope boundaries for a sweep

- **The PR title/body and your own comments** are yours to fix.
- **A third party's issue title/body is NOT**, even when it's the issue your PR closes. Don't rewrite someone else's report.
- Verify the title actually needs changing before touching it; it often doesn't.
- Metadata edits (body/title/comments) are **not commits**, so they do **not** dismiss an existing approval. Confirm this after, rather than assuming it, but don't refuse the sweep out of fear of dismissing a review.

## Mechanics that bite

Batch all PATCH calls into a single invocation and verify persistence afterward (a 2xx is not proof it stuck). A **half-applied** sweep is worse than an unstarted one: the maintainer explicitly asked, so leftovers read as "it tried and failed" rather than "not done yet."
