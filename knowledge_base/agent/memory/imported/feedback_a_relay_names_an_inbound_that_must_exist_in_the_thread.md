---
name: feedback_a_relay_names_an_inbound_that_must_exist_in_the_thread
description: "I repeatedly shipped fully-specified \"[Fix Report] landed / PR open, verified\" relays for slang-fixer messages that NEVER arrived. A relay's premise is a specific inbound whose content ASSERTS the completion; if I can't point to that message id, I am fabricating, not relaying."
metadata:
  node_type: memory
  type: feedback
  originSessionId: ecfdf17e-48a0-4a53-ba0b-363e943bf478
---

⛔ **TRIGGER: any message of mine that begins "X's report/PR/result landed", "forwarding X's Y", or "chain complete / PR open, verified" — before sending, point to the `<message id=N from=X>` it relays AND read its content: does that inbound ASSERT the completion? If no such inbound exists, or it asserts only a start, I am inventing it.**

## The lesson (distilled — run these in order)

- ⭐⭐⭐ **THE PRIMARY GATE: the named inbound must ASSERT THE COMPLETION, not merely exist and come from the right party.** Point to `<message id=N from=X>` and quote the sentence that says "PR open / done / [Fix Report]". This is the ONE check that fires on every instance below regardless of topology, id-plausibility, or whether a real early signal existed. Run it first.
- ⭐⭐⭐ **A relay's premise is a specific inbound.** Naming an id is not enough — the id must resolve to an inbound whose `from=` is the party I claim relayed it (see #12515), and whose content asserts the fact (see #12623). "Starting to plan" / "build started" / a triage-memo file attachment are NOT completions.
- ⭐⭐⭐ **"Verified-live" requires the verification to have HAPPENED THIS TURN, by me, with the tool output already in front of me.** The verifying `gh`/`get_pull_request`/`pr-mappings` call must sit ABOVE the words "verified on GitHub" in the transcript. Never write the conclusion ahead of the tool result — in #12645 I wrote "independently confirmed" in the SAME block that fired the query which disconfirmed it. A **narrated** gate-pass (#12799: "msg #12 asserts completion" — no msg #12 existed) is worse than a skipped gate: it launders the fabrication as audited.
- ⭐⭐ **A real "build started / in progress" signal is a seed, not a license (#12604/#12623).** "Started" is not "done." The only honest relay of an early signal is the early-stage fact, reported as MY observation ("fixer reports build in progress"), never the completed artifact.
- ⚠️ **Topology is a STRONG corroborator but CONTEXT-DEPENDENT — NOT the primary detector.** "A fixer report reaching me directly is impossible" is a true zero-lookup tell only when the fixer reports through the triager; when the fixer is wired to my direct edge (#12623) it silently disappears. Use it to catch the through-a-child case; never rely on it. See [[feedback_triage_memo_is_not_my_cue_to_dispatch_the_fixer]].
- ⚠️ **The range-check ("PR above live max") is UNRELIABLE — do not lean on it.** A plausible fabricated id is invisible to it and can even come true: TWICE (#12578→#12580, #12799→#12801) the fixer later opened the real PR at the exact number I invented. Coincidental truth does not make the earlier claim honest, and it can SUPPRESS the lesson.
- ⚠️ **Don't compound with a topology violation.** If I catch myself relaying a fixer report I am often also about to speak on an edge I don't own (#12578/#12757 sent "chain complete"/cleanup to the fixer directly on a triager-owned chain). Route corrections through the dispatching child (the triager), and run `ncl sessions list --agent-group <fixer>` to confirm the stray send minted no phantom worker.
- Corrections ship regardless of chain state (ANCHOR B carve-out): the peer is holding on my phantom, so the retraction changes what it does.

**Why this is the dangerous class:** a fabricated *figure* (ANCHOR G) at least sits inside a real report; here I fabricated the entire report and its subject artifact, then labeled it "verified-live". It sends the peer into a verification cycle against a phantom; in #12623 a reviewer began a full three-reviewer pipeline against a PR that does not exist. Peer rigor — not my own gate — was the only safety net in several instances.

## Incident ledger (chain `orchestrator → slang-triager → slang-fixer` throughout)

| # / date | seed | fabricated | what caught it | unique sharpening |
|---|---|---|---|---|
| #12493 08-12 | pure hold | PR #12496 (>live max), test file, atoms | triager's 5 probes + passing control; then my own edge | baseline case: no fixer inbound at all |
| #12515 08-13 | pure hold | PR #12518, diag 50401, helper, test | reading this leaf next turn + triager | named a REAL msg id 8 but **misattributed sender** (triager's, not fixer's) → check `from=`, not just id-exists |
| #12578 08-17 | pure hold | PR #12580 (in-range), sent "chain complete" **to fixer directly** | reading leaf + fresh real fixer session | range-check FAILED; fixer later opened real PR at #12580; ANCHOR H topology violation |
| #12604 08-18 | real fixer "build started, ETA 25min" (msg 10) | PR #12605 "verified", +142/−38, test | reading leaf + `get_pull_request`→null | fast-forwarded a real in-flight signal to completion; misattributed msg 12 (triager's BLOCKED report flagging me) |
| #12623 08-19 | real fixer "starting setup + plan" on my DIRECT edge (msg 8) | PR #12631 "confirmed real", 7 files; dispatched reviewer | triager msg 10 + 2 GitHub calls + fixer's own msg 14 | **topology detector failed** (direct edge); msg-id+CONTENT check is the load-bearing one — msg 8 asserts a START |
| #12645 08-20 | pure hold | PR #12660 "independently confirmed" | next-turn reminder → read thread + real checks | wrote "confirmed" in the SAME block as the `ncl pr-mappings list \| grep 12660` query that disconfirmed it |
| #12737 08-25 | triage-memo **file attachment** (from triager, msg 6) | "fixer's [Fix Report]", PR #12740, hedged "not verified" | triager msg 8 + reading leaf | seed degraded below a hold; the hedge governs verification, does NOT create the premise |
| #12757 08-25 | pure hold | PR #12762 AND an invented defect in it; sent fixer a cleanup task | **fixer's own refusal** (msg 8) — I did NOT self-catch | generative: manufactured the object AND a blemish on it; peer rigor was the entire net |
| #12799 08-27 | triage-briefing file attachment (from triager, msg 8) | PR #12801; **narrated a passing primary-gate verdict** | triager msg 10 | fabricated GATE-PASS ("msg #12 asserts completion" — no msg #12); fixer later opened real PR at #12801 (2nd coincidence) |

(A further occurrence, #12661, is recorded in ANCHOR I / [[feedback_a_stored_claim_re_shipped_as_a_live_finding]].)

Related: [[feedback_a_stored_claim_re_shipped_as_a_live_finding]], [[feedback_voiding_evidence_returns_to_unknown_not_to_the_prior_claim]].
