---
title: "`comments==0` only proxies 'no GitHub artifact' for issues filed by SOMEONE ELSE — on a bot-authored issue the BODY is the artifact, so the R3 detector inverts"
type: learning
topic: misc
source: learnings/1785846721964-comments-0-only-proxies-no-github-artifact-for-iss.md
---

# `comments==0` only proxies "no GitHub artifact" for issues filed by SOMEONE ELSE — on a bot-authored issue the BODY is the artifact, so the R3 detector inverts

A supervisor nudge on shader-slang/slang#12337 (2026-08-04 12:29Z) fired the R3 "no resumable GitHub artifact" gap and asked for a 5-bullet comment. **I posted nothing — the premise was measurably false, and posting would have degraded the artifact.**

## What the nudge said vs. what was true

> *"Silent ≥60 min with **no GitHub artifact at all**… If that analysis exists in your session, it is currently **invisible to any human landing on the issue**."*

- `comments=0` — **TRUE**.
- "no artifact" / "invisible" — **FALSE**. **Our own bot authored #12337.** The artifact is the **issue body**: 8783 B, and every fact the nudge listed as missing was already in it. Verified by grep with a zero-control, not by memory: `12113`×3, `12112`×2, `12136`×1, `9817`×1, `breakdown.py`×2, `api_session_create`×1, the corrected `280.2`/`119.0` figures, the explicit *"range match (not an identity)"* framing, the *"under 2%"* refutation, and the dedup scope-note verbatim (*"…fall outside that enumeration by construction — cross-referenced here rather than as dedup misses"*).
- The 5-bullet's load-bearing fields were present as prose: **verdict** = the `[!IMPORTANT]` pattern-not-a-diagnosis fence; **next-action + blocker** = *"Wait for the reproducer — that is the gate, and it is a maintainer's to close"* (`sbangaru_nv`).

`comments=0` was the **intended** state: the analysis went in via three in-place body PATCHes, deliberately never stacked as comments (author + `comments==0` ⇒ a PATCH notifies nobody and no reader had seen the older text).

## The generalizable defect

**`comments==0` is a valid artifact-absence proxy only for issues filed by OTHERS.** When *we* authored the issue, the body is our footprint, so the proxy **inverts — it fires hardest exactly where the public footprint is most complete.** A "post the 5-bullet" response would have restated the body directly beneath itself, as the issue's *first* comment, where it reads as new information.

Same family as `permissions.push` for `issues:write`, `gh api rate_limit` as an auth probe, and `grep -c` for counting things: **the instrument answers a different question than the one asked, and its answer looks like an answer.**

**Fix for the detector:** gate the R3 check on `issue.user.login != <our bot>`, or treat `body` as the artifact when it is ours — ideally checking body length / last-updated rather than comment count.

## Also worth knowing: a cross-ref backlink looks like human activity on the timeline

The timeline showed `jvepsalainen-nv` **mentioned** + **subscribed** at 10:25Z. That is **not** a human reply re-opening the chain — it is our own #12113 cross-reference backlink firing a notification. Only `issue_comment` by a non-bot author is a routing inbound. Check the **event type and actor**, not merely that the timeline moved.

## Rule

**Verify a nudge's premises even when it is pointing at real work, and especially when it is pointing at a gap.** A missing *record* is not an absent *event* — here the record the supervisor could see (`comments`) was simply not where the event lived. The correct response to a false-positive nudge is a measured refusal plus the detector fix, not a defensive artifact that makes the count look right.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785846721964-comments-0-only-proxies-no-github-artifact-for-iss.md`_
