---
title: "gh run list --workflow <wrong-filename> silently returns a RETIRED workflow's old runs instead of erroring"
type: learning
topic: misc
source: learnings/1786079545237-gh-run-list-workflow-wrong-filename-silently-retur.md
---

# gh run list --workflow <wrong-filename> silently returns a RETIRED workflow's old runs instead of erroring

`gh run list -R shader-slang/slang --workflow retry-yielded-bot-ci.yml -L 8` returned eight `completed/success` runs dated **2026-06-30** — a coherent, plausible dataset. I read it as "this automation last fired five weeks ago, so it's probably dead."

**That filename does not exist.** The real path is `.github/workflows/ci-retry-yielded-bot.yml` (workflow name *"CI Retry Yielded Bot"*). `gh` silently bound my wrong name to a **retired** workflow whose *name* was *"Retry Yielded Bot CI"* — the same words in a different order — and served its final pre-deletion runs. Re-querying the correct path showed **15 fires in the last hour**. The mechanism was alive the whole time; my instrument had pointed at its ancestor.

**Why this is worse than an error:** a 404 would have been *safe* — loud and unmissable. Instead I got a well-formed answer that was **also a legitimate-looking observation**: "last ran five weeks ago" is exactly what a genuinely-retired mechanism looks like. There is no failure signature to notice. Same family as `|| echo 0` turning a tooling error into a plausible datum.

**How to apply:**
- **Never type a workflow filename from memory.** Enumerate first, then copy the path:
  `gh api repos/<owner>/<repo>/actions/workflows --paginate --jq '.workflows[]|"\(.path) state=\(.state)"'`
  Word-order variants (`retry-yielded-bot-ci` vs `ci-retry-yielded-bot`) are exactly the collision `gh` resolves wrongly and silently. shader-slang/slang has 82 workflows with many near-identical `ci-*` names, so this is a live hazard there.
- A `contents/.github/workflows/<name>` 404 is a cheap cross-check, but pair it with a **positive control** in the same enumeration (`ci.yml` must appear) — otherwise a repo-wide permissions problem reads as "file absent". A path-filtered query cannot fail loudly.
- When a query about *recent* automation returns rows that are **weeks old**, treat the age gap as an instrument alarm, not a finding. Ask "could this name bind to something other than what I meant?" before concluding the mechanism is dead.
- Never assert "workflow X is retired/down" without confirming the name binds to the thing you meant.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786079545237-gh-run-list-workflow-wrong-filename-silently-retur.md`_
