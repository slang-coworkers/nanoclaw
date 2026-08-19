---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787059329489-hfe2ag
written_at: 2026-08-18T14:01:11.880Z
---

# [approver/human-agreement] doc-sync PR is a safe WOULD_APPROVE when the new block is byte-identical to the fetched-head source of truth AND the doc is not generated

**Context:** shader-slang/slang PR #12584 (WOULD_APPROVE, shadow). A bot-authored `fix/issue-N` fixer PR, doc-only +5/-2, syncing the stale `DescriptorKind` enum example in `docs/user-guide/03-convenience-features.md` to the core-module definition in `source/slang/hlsl.meta.slang`. Harvest exit 20 (production review skips bot-authored fixer PRs — expected, not infra), Devin exit 0 clean → fallback tier.

**The transferable method for a doc-sync / stale-copy PR (the challenger that earns an APPROVE, not just an abstain):** documentation is a *consumer* of the mechanism it documents, so the decision reduces to "does the doc now match the mechanism?" — a verifiable question, answered in three cheap probes:

1. **Fetch the PR head and diff the new doc block against the source of truth at that exact commit** — not master, not the local clone (which may be at a different SHA). `git fetch origin pull/<pr>/head:pr<pr>` then `git show <head>:<source-file>` and compare to the doc block. On #12584 the new enum block was **byte-identical including `///` comments** to `hlsl.meta.slang:27308`. Byte-identity to a stable source at the head is the strongest possible evidence a doc-sync is complete and correct.
2. **Confirm the doc is hand-written, not generated / CI-diff-checked.** Grep `source/`, `tools/`, `extras/` for a producer of the file, and `.github/` for a diff-check workflow. If a generator exists (e.g. `a4-02-reference-capability-atoms.md` from `slang-capabilities.capdef`, or `command-line-slangc-reference.md`), a hand-edit is a guaranteed-red CI diff and the source+doc must be committed together — different decision. #12584's file has neither, and issue #12582 explicitly noted the enum does not `$()`-splice C++ constants, so hand-sync is correct.
3. **Confirm scope vs the issue.** #12582 enumerated four drifts; all four fixed, and the adjacent binding-index tables (composite `<Kind>_<Access>` labels, a separate pre-existing vocabulary) were correctly left alone — out of the issue's stated scope, does not undermine the PR's purpose. Advisory, not OPEN_GAP.

**Why this is an APPROVE and not an abstain:** the OPEN_GAP bar includes "a gap that undermines the PR's stated purpose." Here the doc now describes the mechanism it claims to document, verified against the mechanism itself — the stated purpose is fully met with zero residual gap. Contrast the failure mode (slang#12344 precedent): over-approving a docs PR by asking the *wrong* question ("no CI gate doesn't make it wrong"). The right question is the byte-diff against the head source, and it came back clean.

**Falsifier / join:** a human requesting changes on this head, or a follow-up commit editing the enum block before merge, refutes it. Join on merge/close against commit `087734541f7b` (verify join SHA vs live GitHub first).
