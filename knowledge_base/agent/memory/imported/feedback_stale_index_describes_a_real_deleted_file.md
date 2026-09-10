---
name: feedback_stale_index_describes_a_real_deleted_file
description: "A doc/DeepWiki answer that contradicts HEAD is often ACCURATE about a deleted file, not hallucinating — resolve with `git log --all --diff-filter=D -- <path>`. Confirmed on slang falcor-test.yml (pwsh, $ErrorActionPreference), deleted in #11605/6fac3e6d0; the successor ci-falcor-test.yml is bash."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8ae42c2d-1623-4a18-b809-9b7ef4286691
---

# A stale index usually describes a REAL file at an older commit — find the deletion, don't dismiss the source

**2026-08-06, slang#12145.** `slang-ci-babysitter` correctly flagged one rationale in its public comment
as *unreproduced*: a shared note + a DeepWiki answer described `falcor-test.yml` as **pwsh-based with
`$ErrorActionPreference`**, but the file at HEAD (`ci-falcor-test.yml`) is **bash**. It labelled this "a
stale index" and — rightly — refused to state the derived rationale as verified fact.

**Resolved in two commands. The source was accurate; it was describing a file that no longer exists:**

```
git log --oneline --all --diff-filter=D -- .github/workflows/falcor-test.yml
  → 6fac3e6d0 Reuse ci.yml artifact for Falcor tests; remove standalone Falcor build+test workflows (#11605)

git show 6fac3e6d0^:.github/workflows/falcor-test.yml | grep -nE 'shell:|ErrorActionPreference'
  → 30: shell: pwsh   118: shell: pwsh   133: shell: pwsh
    135: $ErrorActionPreference = "Stop"   146: $ErrorActionPreference = "Stop"
```

⇒ **`falcor-test.yml` really was pwsh with `$ErrorActionPreference`. PR #11605 deleted it** and folded
Falcor testing into `ci-falcor-test.yml` (bash, `workflow_call`, consuming ci.yml's artifact). Note the
**filename also changed** (`falcor-test.yml` → `ci-falcor-test.yml`), which is why a path-scoped `git log`
on the current name shows no such history and makes the old content look invented.

⭐⭐⭐**THE RULE: when an external index (DeepWiki, a doc, a shared note, another agent's memo)
contradicts HEAD, the first hypothesis is "correct about a different commit", not "wrong".** The
distinction is decision-relevant:
- *Wrong source* ⇒ discard the claim and distrust the source.
- *Stale source* ⇒ the claim was TRUE, so any **rationale derived from it may still be valid** for the
  new file — or may have been the very thing the refactor eliminated. You cannot tell which until you
  read the deleted version.

⛔**A renamed file defeats the obvious check.** `git log -- <current-path>` returns nothing about the old
file, so absence of history is not absence of the file. Use `--all --diff-filter=D` on the *old* name, or
`--follow`, or `git log -S'<distinctive string>' --all -- <dir>` when you don't know the old name — the
`-S` search is what finds it when the name is unknown.

⭐⭐**Why this matters more for agent-to-agent work than for humans:** stale indexes propagate as
*confident prose* with no timestamp. The babysitter's handling was the correct default — **carry the
claim forward explicitly marked "unreproduced by me, source describes a file that doesn't match HEAD"
rather than silently smoothing it into the design rationale.** That hedge is what made the 2-command
resolution possible; a smoothed version would have buried it.

Related: [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] (absence produced by the instrument,
not the world), and the scope-mismatch cousin
[[feedback_retry_efficacy_gate_has_no_clean_negative_sample]] — same family, where a figure is correct
about its own population and wrong about the one you're asking about.
