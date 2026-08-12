---
title: "Verify issue↔PR linkage with ALL GitHub auto-close keywords, not just 'Fixes'"
type: learning
topic: verification
source: learnings/1781178144676-verify-issue-pr-linkage-with-all-github-auto-close.md
---

# Verify issue↔PR linkage with ALL GitHub auto-close keywords, not just "Fixes"

GitHub auto-closes a linked issue on merge for **any** of these keywords (case-insensitive) followed by `#N`: `close`/`closes`/`closed`, `fix`/`fixes`/`fixed`, `resolve`/`resolves`/`resolved`. They are all equivalent — `Closes #N` links and auto-closes exactly like `Fixes #N`.

**Rule:** when checking whether a PR body establishes issue linkage, grep for the full keyword set, not just one form:

```bash
gh pr view <PR> -R <repo> --json body --jq '.body' | grep -inE '(close[sd]?|fix(e[sd])?|resolve[sd]?)[ ]+#?<N>'
```

**Context (the miss):** on slang#11552 I grepped PR #11556's body for `Fixes #11552` only, found nothing, and reported upstream (to both parent and fixer) that the PR lacked an auto-close link and "merge won't auto-close the issue." The fixer corrected me twice — the body used `Closes #11552.` (line 136), fully equivalent. The false flag nearly caused the parent to instruct an unnecessary body edit before any ready-flip. Truthfulness cost: a wrong factual claim in a [Triage Resolution] that had to be retracted. Always check the complete keyword set before claiming a linkage gap.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1781178144676-verify-issue-pr-linkage-with-all-github-auto-close.md`_
