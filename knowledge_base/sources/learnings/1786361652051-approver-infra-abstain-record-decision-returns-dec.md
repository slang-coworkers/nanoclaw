---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1785785872817-yn43nz
written_at: 2026-08-10T11:34:12.051Z
---

# [approver/infra-abstain] record_decision returns "Decision recorded" before the writer gate — the ack is emission-only, and a silent non-denial is NOT a successful write

# `ok("Decision recorded")` is printed unconditionally — the gate is outside the container

**Symptom.** After `record_decision` returned `Decision recorded:
shader-slang/slangpy#1068@266b2072e621 = ABSTAIN_INFRA`, I reported a ledger row
existed. A later identical call for the same commit came back as a host
notification: `record_decision denied: no approval-ledger writers are configured
(set APPROVAL_LEDGER_WRITERS)`. So the earlier "recorded" was, at best,
unverified — and the environment has **no writers configured at all**, meaning
neither call was persisted.

**Root cause, from the host source** (`/app/src/mcp-tools/core.ts:580-604`): the
handler validates four required args, calls `writeMessageOut({kind:'system',
content: JSON.stringify({action:'record_decision', …})})`, logs, and returns
`ok('Decision recorded: …')`. There is **no writer-capability check anywhere in
the handler** — `APPROVAL_LEDGER_WRITERS` appears nowhere in `/app`. The gate is
enforced by the host *after* consuming the emitted row, out of band. So the
success string is emitted **before and independently of** the write it claims.
The tool's own description ("the host ENFORCES that your agent group holds the
ledger-writer capability — a call from any other group is denied and you are
told so") is a contract to relay, never a state to assert.

**The trap that cost me the wrong claim: asymmetric feedback.** Of two calls for
the same commit, only the second drew a denial:

| call | emitted | denial |
|---|---|---|
| seq=5 | `2026-08-03T19:49:31.782Z` | **none, ever** |
| seq=19 | `2026-08-10T11:28:51.840Z` | `11:28:53.119Z` (+1.3 s) |

Same tool, same args shape, same (unconfigured) environment — one silent, one
denied. **A missing denial therefore carries no information.** Do not read
"no error came back" as "the row landed"; the denial path is best-effort and
evidently didn't fire on 08-03. Correspondingly, a denial that names one call
does **not** exonerate earlier calls: infer the environment-level fact ("no
writers configured") and apply it to every call made under it.

**How to check what actually happened** — your own emission is the only
self-verifiable part (`/workspace/outbound.db` is readable):

```bash
python3 - <<'PY'
import sqlite3
c=sqlite3.connect("file:/workspace/outbound.db?mode=ro",uri=True)
for seq,ts in c.execute("select seq,timestamp from messages_out where content like '%record_decision%' order by seq"):
    print(seq, ts)
PY
# and correlate against denials arriving within ~2s:
#   select rowid,timestamp,content from messages_in where content like '%ledger%'
```

Beware a false positive: `append_learning` bodies that merely *mention*
`record_decision` also match that `LIKE`. Confirm each hit parses as
`{"action":"record_decision"}` before counting it.

**What to say in the report.** Never "recorded to the ledger". Say **"decision
emitted to the ledger (`record_decision` returned ok; host-side persistence is
not container-verifiable)"** — and when a denial has been observed in the
session, say plainly that the row did **not** persist and name
`APPROVAL_LEDGER_WRITERS` as the operator fix. The reasoning artifacts in
`work/<pr>-<sha12>/` (`clauses.json`, `review-doc.md`) are the durable record
that survives; cite those.

**Corollary — `record_human_verdict` does not exist.** It is *deliberately not
registered* (`core.ts:608-614`): the host stamps the human outcome itself from
the webhook (`notifyApproverOfTerminalPr`), and a container-originated call is
denied by design. Do not reach for it on a `pr_merged` join, and do not smuggle
join fields through `record_decision` as a substitute — that re-asserts a
decision row (append-only, first-write-wins) and, per the description, a
*different* decision for the same commit is refused outright. Mine the merge for
a learning; the join itself is the host's job.
