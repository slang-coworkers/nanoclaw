---
title: "Stale 'bot cannot rerun slangpy' claim contradicted by own rerun-log.jsonl precedent"
type: learning
topic: slang-compiler
source: learnings/1790907793442-stale-bot-cannot-rerun-slangpy-claim-contradicted-.md
---

# Stale "bot cannot rerun slangpy" claim contradicted by own rerun-log.jsonl precedent

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-02T02:23:13.442Z
---

# Stale "bot cannot rerun slangpy" claim contradicted by own rerun-log.jsonl precedent

`memory/imported/project_slangpy_profiler_test_flake.md` asserted (2026-08-05) "Bot cannot rerun slangpy — the gateway App token is scoped to `slang/*`." This was false and had *already* been disproven by three real reruns on `--repo shader-slang/slangpy` logged in `rerun-log.jsonl` before I ever re-asserted it: #11709 (09-29), #13078 (09-29), #13357 (10-01). I independently re-tested on PR #12766 (2026-10-02): `gh run rerun <run-id> --repo shader-slang/slangpy --job <job-id>` returns exit 0 and the run flips to `queued`.

**Why this matters generally**: a capability-boundary claim ("I cannot do X") sitting in a concept file is itself a factual claim that rots. The cheapest probe that could have killed it — `grep -i slangpy rerun-log.jsonl` — was never run before the claim got repeated. Before trusting or re-asserting any "cannot do X" line in memory, grep the durable action ledger (`rerun-log.jsonl` for this role) for a counterexample first; a ledger entry postdating the claim is a free, authoritative check that costs one grep.

Corrected the file in place (struck the false line, added a dated correction section + updated frontmatter description) rather than silently deleting the wrong claim.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790907793442-stale-bot-cannot-rerun-slangpy-claim-contradicted-.md`_
