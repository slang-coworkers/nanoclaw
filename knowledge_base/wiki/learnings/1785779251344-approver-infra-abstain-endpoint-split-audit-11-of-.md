---
title: "[approver/infra-abstain] Endpoint-split audit: 11 of 18 CodeRabbit harvests silently under-read — detection recipe + 6 load-bearing rows"
type: learning
topic: review-approval
source: learnings/1785779251344-approver-infra-abstain-endpoint-split-audit-11-of-.md
---

# [approver/infra-abstain] Endpoint-split audit: 11 of 18 CodeRabbit harvests silently under-read — detection recipe + 6 load-bearing rows

**Scope of the bug, measured.** The endpoint-split trap (CodeRabbit findings live on `pulls/N/comments`; the harvester tallies severity markers in `pulls/N/reviews[].body` only) is not a one-PR curiosity. Audited every row I recorded where the harvest found a CodeRabbit review: **11 of 18 are EXPOSED, totalling 17 findings that were never in my decision input.** Every one of those harvests exited 0 — there was no error to notice.

**Detection recipe (run this against any approver's stored harvests):**
```
for each work/*/review/harvest.json with found==true and "coderabbit" in login:
    markers    = count of 🔴 🟠 🟡 🔵 in body
    actionable = int from re.search(r"Actionable comments posted:\s*(\d+)", body)
    EXPOSED if actionable > 0 and markers == 0
```
The signature is precise because CodeRabbit's own counter contradicts the body it ships: `Actionable comments posted: 11` next to zero severity markers is self-evidence that the findings are elsewhere.

**The severity distinction that matters — was the review signal load-bearing?** Cross-reference each exposed row's `clauses.json`:
- If a clause FAILED (e.g. `tier_eligible`, `no_protected_paths`), the decision short-circuited at Step 1 and the review signal was never consulted ⇒ the under-read is cosmetic for the verdict (though still wrong in the human-facing signal field).
- If **all clauses passed**, the review signal *was* the decision input. In my audit **6 rows** fall here — and one of them (**slang-rhi #797**) was a **WOULD_APPROVE**, i.e. an unread Major/Critical would be a genuine **false-safe**. Compounding factor worth noting: #797's row records that Devin had timed out, so CodeRabbit + CI were carrying more weight than usual — the row least able to absorb a silent under-read is exactly where one happened.

**Generalizable lesson:** when you find a parsing/collection bug, don't stop at the PR that surfaced it — **sweep your own stored artifacts for the signature and partition the hits by whether the affected field was load-bearing.** "The verdict didn't change" is not the same as "no harm": a wrong review-signal field is what a human reads to decide how much scrutiny a change already received, and a WOULD_APPROVE built on a partial harvest is a different risk class from an abstain built on one.

**Recovery blocked — escalated, not guessed.** Reading the actual missed findings requires `pulls/N/comments`, which a local PreToolUse hook (`gate-critique-on-deliver.sh`, `BASH_PATTERNS` regex `gh api [^|]*pulls\b`) denies because the regex matches read-only GETs, not just PR creation. Bypassing that hook was previously rejected by admin, so I did not. GraphQL is also unavailable in this container (`gh api graphql` → HTTP 401 Bad credentials while REST with the same token works). Fallbacks were evaluated and rejected as unsound rather than used: PR HTML is server-rendered with no JSON payload (no `original_commit_id`) and it omits resolved threads, so it is **provably lossy** — inferring severities from it would manufacture confidence. **Unblocking needs the hook regex narrowed to exclude GETs, or a working GraphQL token.** Recording the blocker with its two candidate fixes is the honest terminal state; I will not infer finding severities I cannot read.

**Harvester fixes (the scripts are byte-identical between slang-pr-approver and slangpy-pr-approver, sha256 `cbbb72da0aa2b774c46622c3a7948882ca251abb111764cd5ac5927ca785cd12`, so one patch covers both):**
1. Query `pulls/N/comments` and tally severities there, merged with body markers.
2. Treat `Actionable comments posted: N>0` + zero body markers as a hard findings-are-elsewhere flag.
3. Bucket inline comments by `original_commit_id`, never the drifting `commit_id`.
4. Green CodeRabbit commit status ≠ a harvestable review object exists at that commit.

**slangpy is higher-risk than slang for the same bug:** CodeRabbit is often its *only* review signal (no production `github-actions[bot]` review to fall back on), so an exposed slangpy row can read "clean" with every finding unexamined and nothing else in the input to compensate. Same recipe applies to its stored harvests.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785779251344-approver-infra-abstain-endpoint-split-audit-11-of-.md`_
