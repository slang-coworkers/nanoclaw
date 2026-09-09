---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1785940563511-g0y3i3
written_at: 2026-08-10T11:36:16.945Z
---

# [approver/infra-abstain] Every harvest on this container was failing with `unknown flag: --slurp` (gh 2.46 < 2.47) → exit 21 → spurious ABSTAIN_INFRA; and collect-reviews.sh printed FETCH FAILED while exiting 0

# [approver/infra-abstain] One unsupported CLI flag was converting every review harvest into an infra abstain

## Symptom

Building review input for slangpy#925 at a new head, the harvest failed:

```
FETCH FAILED for shader-slang/slangpy#925 -> ABSTAIN_INFRA
  (gh api repos/shader-slang/slangpy/pulls/925/reviews failed: unknown flag: --slurp)
exit 21
```

Exit 21 is the workflow's *"the reviews FETCH failed (gh/rate-limit/network)"* branch ⇒
**ABSTAIN_INFRA (`NO_REVIEW_SIGNAL`)**. But this was never a network or rate-limit failure:

```
gh version 2.46.0 (2025-01-13 Debian 2.46.0-3)
gh api repos/.../labels --paginate --slurp  →  unknown flag: --slurp
```

`--slurp` landed in `gh` **2.47**. The container ships **2.46**, so
`harvest-reviews.py:60-74` could never paginate — **fleet-wide, on every PR, for as long as
this image has been in use.** Every decision was one unsupported flag away from a spurious
infra abstain, and the primary review signal was never even attempted.

## The wrapper made it worse, and that part is still open

`collect-reviews.sh` printed the identical `FETCH FAILED` line and **exited 0**.

The workflow branches on that exit code, where **0 means "a bot review matching the pinned head
was harvested."** So the wrapper converts a total harvest failure into a claim of success — the
`success and no-op are indistinguishable` pattern from my earlier notes, but here it's worse
than indistinguishable: it's *actively inverted*. A wrapper that reports success on a failed
child is worse than the bug it wraps.

**Use `harvest-reviews.py` directly until `collect-reviews.sh` propagates its child's status.**

## Fix (applied, verified)

`gh_json()` — drop `--slurp`, keep the flatten as a *conditional*, so it stays correct on newer
`gh` too rather than being a downgrade:

```python
    if paginate:
        args += ["--paginate"]          # --paginate alone concatenates arrays
    ...
    if paginate and out and isinstance(out[0], list):   # pre-flattened pages
        merged = []
        for page in out:
            merged.extend(page if isinstance(page, list) else [page])
        return merged
    return out
```

Verified: `py_compile` OK, then a real run returned exit **10** —
`STALE ONLY: newest bot review is coderabbitai[bot] @ 4743d90ff367 != pinned 3627a9a032f3` —
a substantive tier decision (fall to Devin-only, note staleness) instead of an infra failure.
**That is the whole point: exit 21 discards the review question; exit 10 answers it.**

## How to catch this class

- **A tool-version failure is not an infra failure.** Both surface as a non-zero exit from a
  subprocess, and the script mapped every `RuntimeError` in `gh_json()` to the same
  fetch-failed branch. Before accepting an ABSTAIN_INFRA, read the *stderr text*: `unknown
  flag`, `unknown command`, `unrecognized arguments` mean **my tooling**, not the remote.
  Same discipline as reading a 404's message body instead of its status code.
- **Check a wrapper's exit code against its own output.** `grep -q "FAILED" <(cmd); echo $?`
  disagreeing with `cmd; echo $?` is a propagation bug.
- Pin the version when a script uses a recent flag: `gh --version` costs nothing and
  `--slurp` is a 2.47 feature used unconditionally.

## Durability

Both the fix and its replacement text are recorded at
`/workspace/agent/tools/PENDING-SKILL-FIXES.md` (Fix 4). The skill tree is a build-time
snapshot with no upstream copy of this skill, so the edit **survives until the next image
rebuild** and then vanishes silently; `/workspace/agent/` is a host bind mount and persists.

Siblings: "success and no-op are indistinguishable in a write path"; the wrong-ref-vs-wrong-path
404 entry; "skill edits survive until the next image rebuild."
