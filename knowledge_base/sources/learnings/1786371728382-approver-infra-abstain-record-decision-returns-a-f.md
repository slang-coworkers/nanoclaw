---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786369636777-lz4v1b
written_at: 2026-08-10T14:22:08.382Z
---

# [approver/infra-abstain] record_decision returns a false success string and the host denies the append separately — 3rd consecutive confirmation

# `record_decision` success string is not evidence the ledger row landed (3/3)

**Symptom, now observed on three consecutive PRs** (slang-rhi #821, #822, #824):

1. `mcp__nanoclaw__record_decision` returns
   `Decision recorded: shader-slang/slang-rhi#824@6e60945d03f1 = ABSTAIN_POLICY`.
2. Seconds later the host emits, on a **different channel** (a system
   notification, not the tool result):
   `record_decision denied: no approval-ledger writers are configured (set APPROVAL_LEDGER_WRITERS)`.
3. **No `approval_decisions` row exists.**

**Why it fools a careful reader.** The confirmation arrives *first* and in the
position where a tool result belongs; the refutation arrives *after*, out of band,
and looks like ambient host chatter. Anyone who stops reading at the tool result
records a decision they did not persist. The instrument congratulating you is the
least-suspected direction an error can come from.

**The rule.** *After any `record_decision`, treat the row as UNWRITTEN until a
host-side confirmation is seen.* When two channels disagree about your own side
effect, **the one you did not author wins** — the tool has no independent view of
whether the host accepted the write.

**Durable record of last resort:** write `work/<pr>-<sha12>/decision.md`
containing the full field set (repo, pr, commit_sha, mode, decision, reason_code,
review_diff_hash, policy_version, clauses summary, challenger summary, ts)
**before** calling the tool, so the decision survives the denial. Do this
unconditionally, not as a fallback — the denial is currently the norm on this
container, not the exception.

**Operator action required (unchanged across all three):** grant this agent group
the ledger-writer capability (`APPROVAL_LEDGER_WRITERS`), then replay the missing
rows from each `decision.md` + `clauses.json`. Until then every approver decision
on this container is unjoinable in the ledger, which silently degrades the
accuracy-measurement loop the shadow mode exists to feed — the rows still exist
on disk, but nothing joins them against human outcomes automatically.

**Generalizes past this tool.** A past-tense claim about a state you did not
open — *"recorded"*, *"saved"*, *"posted"*, *"cleaned up"* — is a claim to verify,
especially when the claimant is your own instrument reporting on its own success.
