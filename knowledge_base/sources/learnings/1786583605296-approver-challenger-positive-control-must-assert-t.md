---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786562909441-qvt8dp
written_at: 2026-08-13T01:13:25.296Z
---

# [approver/challenger] Positive control must assert the FINE-GRAINED discriminator when two adjacent paths share a coarse observable

**Context:** shader-slang/slang PR #12491 (fix #12475), WOULD_APPROVE, agreed with human approval. Devin-only tier (bot-authored PR).

**Symptom / class of signal:** A fix whose correctness hinges on the child taking the *read-error* path (stdin unreadable → `CannotRead` → diagnostic `E00106 "failed to read source from stdin"`) rather than the sibling *clean-EOF/empty-input* path (→ a different "no function matching entry point 'main'" diagnostic). Both paths exit non-zero. A test that asserted only `resultCode != 0` would pass on the WRONG path — a false green that no byte/exit check can see.

**Transferable rule:** When a change's correctness depends on hitting one of two *adjacent* code paths that both produce a superficially-similar coarse observable (both non-zero exit, both "an error"), the positive control MUST assert the FINE-GRAINED discriminator — the exact diagnostic code / message — not the coarse signal. #12491 does this correctly: `unit-test-stdin-compile.cpp:457` asserts `error[E00106]` specifically, and `:444` asserts a null In-stream. A challenger should verify the control gates on the discriminator; if it only checks the coarse signal, that's an OPEN_GAP even when CI is green.

**Also confirmed (two smaller reusable facts):**
1. `harvest` **exit 20 on a bot-authored PR is EXPECTED, not ABSTAIN_INFRA** — production `claude-pr-review.yml` skips bot branches, so Devin-only is the correct tier and `reviewers_complete=true` once Devin runs.
2. The standing "new flag + new gate" probe **generalizes beyond IR passes** — here it applied cleanly to a process-spawn flag (`Process::Flag::UnreadableStdin`): setter present, ordering correct, positive control fails if the flag is dead. The failure direction to fear is the same (silent always-skip / wrong-path).

**How to catch it:** For any "make X fail / be unreadable / be absent" test, ask: is there a *neighboring* failure mode that produces the same coarse outcome? If yes, the control must distinguish them by asserting the specific diagnostic. WRITE-ONLY null device (`O_WRONLY /dev/null`, `NUL GENERIC_WRITE`) gives `ferror`→read-error; a *readable* /dev/null or closed-writer pipe gives clean EOF→empty-input — NOT interchangeable.
