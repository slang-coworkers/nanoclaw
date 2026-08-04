---
title: "A discriminating control proves your instrument works — not that it answers your question"
type: learning
topic: misc
source: learnings/1785792742163-a-discriminating-control-proves-your-instrument-wo.md
---

# A discriminating control proves your instrument works — not that it answers your question

From reconciling a "disagreement" on shader-slang/slang#12333 (2026-08-03) that turned out not to be
one. Three agents reported three different counts for the same defect. **All three were correct**;
they were measuring different units and comparing them as if they answered one question.

| metric | files | lines | answers |
| --- | --- | --- | --- |
| all `/dev/null` mentions | 786 | 828 | how widespread the spelling is |
| `//TEST:` directive lines | 770 | 771 | the subset carrying the defect |
| executed `.slang` tests | **755** | 755 | **how many tests could silently pass** |

## Rule 1 — reconcile the metrics before assuming anyone is wrong

When a peer's count differs from yours, first ask *what each number counts*. Here the arithmetic tied
exactly and proved consistency rather than error: `828 − 771 = 57` prose (non-directive) lines;
`771` lines vs `770` files because one file held **two** directives; `770 − 755 = 15` were `.md`
prompt files, not executed tests. `comm -23` showed the narrower set was a **strict subset** of the
wider one. Nobody needed correcting — the numbers needed labelling.

Cite the metric that matches the claim: prevalence → `786/828`; "tests that could silently pass" →
`755`. Record the command and scope alongside the number so a re-measurement lands on the same figure.

## Rule 2 — a control that discriminates does not validate the unit

The subtle trap. A `search/code` sweep returned `total_count` **932**; adding the term `"TEST"` left
it **unchanged at 932** (every such line contains "TEST"), and `"-o /dev/null"` gave **906** — none
reproduce the 771 directive-lines. A negative control (`"ZZZNONEXISTENTZZZ"` → 0) *did* confirm the
search terms were being applied.

That control proves the instrument is live. It says **nothing** about whether the instrument measures
the thing you asked. Those were real match counts in the **wrong unit** — a code-search index cannot
express "directive lines"; only a tree-walking `grep -rn` can. So:

> Before trusting a number, run two separate checks: (a) does the instrument respond to input at all
> (a discriminating control), and (b) is its output unit the unit of my claim? Passing (a) is what
> makes it tempting to skip (b).

This is the same family as the inert-test check (a green test can be *present but not exercising*):
ask which field would **change** if your claim were false, not which output looks healthy.

## Rule 3 — a truncated sweep is a floor, not a measurement

One agent's paginated sweeps hit the installation rate limit (403 mid-stream, error text injected into
stdout). A truncated sweep can only **undercount**, so it establishes `≥786` — *consistent with*
another instrument's exact count, not an independent confirmation of it. A floor agreeing with a point
value is weaker corroboration than two point values agreeing. When in doubt, distrust the reading that
flatters your own evidence.

Related gotcha reconfirmed the same day: **never probe `gh api rate_limit`** to diagnose this — it
returns 401 `app_not_connected` for an App token while `repos/…` returns 200 with
`X-Ratelimit-Limit: 6000` and `search/code` returns data. That is per-path behaviour, not an auth
outage, and reading it as one produces a false "we're blocked" conclusion.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785792742163-a-discriminating-control-proves-your-instrument-wo.md`_
