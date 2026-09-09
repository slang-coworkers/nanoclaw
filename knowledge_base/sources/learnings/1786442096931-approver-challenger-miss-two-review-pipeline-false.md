---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786439928834-tf6a34
written_at: 2026-08-11T09:54:56.931Z
---

# [approver/challenger-miss] Two review-pipeline false-cleans in ONE decision: an OMITTING channel and a DROPPING parser both present as "no findings"

**Symptom** (slang-rhi#827, public-header change, decided 2026-08-11): both review artifacts handed to the decision tier were clean-looking, and both were wrong. Taking either at face value yields `WOULD_APPROVE` on a confirmed public-header source-compatibility break.

1. `collect-reviews.sh` writes CodeRabbit's *reviews-channel* body only. That body carried a **test nit** — which I then **refuted from source**. CodeRabbit's actual load-bearing finding (`include/slang-rhi.h:1957`, 🟠 Major `potential_issue`: "Preserve the existing descriptor ABI and legacy field semantics") lived in the **review-thread channel**, which the harvester never queries. Absent from every harvested artifact.
2. `devin-flags.md`'s `## Flags` section was **empty** while Devin's own counters said **1 Bug, 1 Flag** — the Bug at the *same location*. Decode defect at `devin-fetch.sh:184-188`.

**Root cause (the shared one):** a channel that never gets queried and a parser that silently drops its section produce **byte-identical output to a genuinely clean review**. Neither failure announces itself. This is the slang-rhi#825 failure mode recurring — same repo, same blind channel, same public header.

**How to catch it**
- Recover the blind channel directly; it is one call:
  `gh api graphql -f query='{repository(owner:"O",name:"N"){pullRequest(number:N){reviewThreads(first:50){totalCount nodes{isResolved path line comments(first:10){nodes{author{login __typename} body originalCommit{oid}}}}}}}}'`
  Compare `totalCount` against fetched length — a page is not a set. Judge currency by `originalCommit.oid` vs the pinned head, never by `created_at` (a clean CodeRabbit pass **edits** its summary comment in place).
- Devin discriminator, one command: `grep -c Flag devin-page.txt`. **≥1 ⇒ the panel rendered ⇒ parse defect ⇒ the findings are on disk** (recover with `open(...).read().replace('\\n','\n')`, or fix properly with `json.loads` at `devin-fetch.sh:186`). **0 ⇒ early scrape**, nothing to recover. Without this the two causes are indistinguishable and both look clean.
- Demand a **positive liveness token per channel** (`N Bugs / M Flags`, an `Actionable comments posted: N` count, a Run ID). An empty findings section plus exit 0 is not a clean review; it is an unanswered question.

**The transferable rule:** *a clean review is the output of a working reviewer **and** of a broken pipe.* Every channel must earn its "no findings" with a positive token; never infer it from an empty section. And note the ordering trap — **the finding you are handed may be the refutable one while the finding that decides the case sits in a channel nobody queried**, so the harvested body is the *least* complete view, not the authoritative one. Rank findings by verification against source, never by which channel surfaced them.

**Fix:** teach `collect-reviews.sh` to query `pullRequest.reviewThreads` (or `pulls/N/comments`) and merge those bodies into `harvest.json`; apply `text = json.loads(raw)` at `devin-fetch.sh:186`. Until then, both recoveries are mandatory manual steps on every slang-rhi decision.
