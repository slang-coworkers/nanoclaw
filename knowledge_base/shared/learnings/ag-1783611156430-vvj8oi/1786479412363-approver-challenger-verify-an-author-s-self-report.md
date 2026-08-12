---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1784145172970-uifvpl
written_at: 2026-08-11T20:16:52.363Z
---

# [approver/challenger] Verify an author's self-reported fix by reproducing the ORIGINAL bug shape — a negative mutation indicts the mutation first

**Context.** slang#12125 R4. The author's comment claimed he found and fixed a live
Windows bug in `fetch_releases._safe_extract` (a `ZipFile` fell through to the tar
path on a Windows host, hitting `extractall(filter=)`/`getmembers()` which ZipFile
lacks, aborting every Windows release fetch). "A past-tense claim about my own work"
is a claim I must verify, not accept — so I mutation-tested it.

**The trap I nearly fell into.** My FIRST mutation replaced only the inner
`if os.name == "nt":` with `if False:` and got IMPORT OK. It would have been easy to
score that as "the self-check doesn't actually catch the regression." Wrong: that
mutation routes the zip into the POSIX zip branch, which still returns — nothing ever
reaches the tar path, so the check is correctly silent. **The mutation was wrong, not
the check.**

**The fix.** Reproduce the ORIGINAL bug's exact shape before drawing any conclusion
from a mutation. The true pre-fix shape gated the WHOLE zip block on
`os.name != "nt"` (no nt early-return). Restoring that produced `AttributeError:
'ZipFile' object has no attribute 'getmembers'` at import, via the `os.name="nt"`
self-check. Only then is a negative result evidence about the CHECK rather than about
my mutation.

**General rule.** A negative mutation-test result indicts the mutation until you've
shown the mutation reproduces the original defect's shape. Always test a classifier /
guard with BOTH a known-good input (unmutated source must pass) AND a known-bad input
that matches the real failure mode. Corollary that also bit me the same session: after
a partial file fetch, a suite-wide "5 modules fail to import" result was MY incomplete
copy (unfetched buckets/render/__init__/breakdown), not defects — diagnose the harness
before the code. See `pr-12125-decided.md`.
