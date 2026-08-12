---
name: feedback_blob_identity_across_heads_scopes_a_re_review
description: "When a synchronize lands mid-review, per-file blob hashes across the two heads partition findings into carried vs must-re-run — and delegated doc verification of my riskiest claims twice returned corrections that STRENGTHENED the finding."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 62d302da-c9ae-40de-ae7f-698f5b755918
---

# A mid-review `synchronize`: partition findings by blob hash, don't re-review or hand-wave

⛔ **TRIGGER: a `synchronize` webhook arrives for a PR I have already measured, or I am about to
post findings whose head is not the current head.** Two wrong moves: re-review everything
(expensive), or post the old findings unqualified (they may be dead).

✅ **The cheap partition — per-file blob hash across both heads:**

```bash
for f in <the PR's files>; do
  a=$(git rev-parse OLDHEAD:$f); b=$(git rev-parse NEWHEAD:$f)
  [ "$a" = "$b" ] && echo "SAME $f" || echo "CHANGED $a -> $b  $f"
done
```

**SAME ⇒ that file's findings carry with zero re-derivation** (the bytes I read are the bytes at
head — a stronger statement than "the diff looks unrelated"). **CHANGED ⇒ re-run those findings
against the new blob**, by execution if the claim is behavioural.

Measured on nanoclaw#1187 (2026-08-11): a ruff-fix synchronize moved head `2f032ac9` → `594996e9`.
3 of 4 files identical by hash (README, 2884-line dashboard JSON, `.service`); only the collector
changed. So the dashboard/README findings — the majority — carried, and I re-ran only the two
collector findings. Both reproduced. **Stating the head SHA and the blob-identity result at the
top of the review is what makes the findings auditable** rather than "reviewed at some point".

⭐⭐ **A `--stat` between heads is NOT a substitute.** It tells you which files the *commit*
touched; the blob hash tells you whether the *content you actually read* is still live. They
diverge on merges, reverts, and force-pushes that land back on identical content.

## ⭐⭐⭐ Delegating doc verification of my riskiest claim CORRECTED IT UPWARD — twice

Before posting I sent my two least-verifiable claims (InfluxDB 1.x int/float conflict behaviour;
InfluxQL `fill()` semantics + Grafana null rendering) to a subagent with an explicit *"quote
authoritative docs, refute me if wrong, say so if you can't find support"* brief.

Both came back CONFIRMED — **plus two corrections I had not anticipated, each of which made the
finding worse for the PR, not softer:**

1. I had "the conflicting **field** is dropped". Docs: the system "does not write the **point**"
   ⇒ every *other* field on that line dies too. Much larger blast radius.
2. I had it as deterministic. Docs: the conflict is **shard-scoped** ("a field's type cannot
   differ in a shard, but can differ across shards") ⇒ it silently *succeeds* across a shard
   boundary, so the bug is **intermittent** — the hardest kind to diagnose.

⇒ **The reflex to protect a finding by softening it ("may be dropped", "I believe") is the wrong
instinct — verification is as likely to sharpen it.** I would have posted a true-but-understated
🔴 and left the two things that make it urgent unsaid.

⇒ **Ask for refutation explicitly and give the agent permission to return "no authoritative
support".** That is what makes a CONFIRMED verdict worth citing, and it is what surfaced the
Grafana `spanNulls` default that the docs omit (it had to read the source to answer).

Related: [[feedback_published_negative_env_claims_need_rederivation]],
[[feedback_a_live_artifact_read_is_a_measurement_with_a_timestamp]],
[[feedback_a_fix_suggestion_is_a_claim_needing_its_own_execution_check]],
[[project_nanoclaw_1187_grafana_stack_into_git]].
