---
name: project_nanoclaw_1068_kb_health_telemetry
description: "nanoclaw#1068 (szihs) adds scripts/kb-health.py — offline KB telemetry. MERGED 104s after opening, reviewed post-merge inline (comment 5181115163). Two LIVE instrument defects on nv-main: cheap-gate undercounts sessions_citing 29%, and a zero-transcript run publishes a confident green zero. Follow-up PR offered."
metadata:
  node_type: memory
  type: project
  originSessionId: 44a66732-cecb-47d6-bb2a-658e5e0ab91c
---

# nanoclaw#1068 — kb-health telemetry for the learnings KB

PR https://github.com/slang-coworkers/nanoclaw/pull/1068, author **szihs**, base `nv-main`,
head `fix/nv-main/kb-health-telemetry`, **1 file +326/−0** (`scripts/kb-health.py`, NEW).
My review comment **`5181115163`**. Third in the series after
[[project_nanoclaw_1066_kb_fold_bounded]] and [[project_nanoclaw_1067_footer_normalizer]].

## 🔴 STATE — MERGED, two instrument defects LIVE, follow-up PR OFFERED

⛔**Opened `2026-08-04T15:09:36Z`, merged `15:11:18Z` by szihs (`57aa7a007af8dcc6c1f3fc7958060e00e588c28a`)
— 104 SECONDS.** Reviewed against the merged tree. Merged blob byte-identical to reviewed head:
`md5 f968147617f0704e8e4c1d9b10f6cc90` at both `62ec8d62790477a21642843f45b4ac46d8470906` and `nv-main`.

⭐⭐**SECOND occurrence of the merge-race in this series** (#1066 was 26s, this 104s) ⇒ the
`pr_ready_for_review` webhook is **not a lock**, and on this repo/author the window is ~2 minutes.
**Recheck `merged`/`state` BEFORE drafting, and verify the merged blob == reviewed head by hash**
(I did; identity claim ⇒ hash, not diff-read). Two data points now, same author, same base —
treat post-merge review as the DEFAULT posture for `szihs` + `nv-main`, not the exception.

**Routing: handled INLINE by Main.** Webhook carried the generic post-#874 "route to the project's
`*-pr-approver`" string — stale for this repo; see [[project_nanoclaw_pr874_webhook_route_approver]].
Closest-to-the-state twice over: script measures `/workspace/shared/`, which is Main-write-only.

## Findings — both 🔴 are in the INSTRUMENT, not the reasoning

**1. Cheap-gate undercounts `sessions_citing` by 29% (measured).** `scan_reads` L72–74 skips any
line lacking `/workspace/shared`, `tool_use_id`, or `append_learning` — *before* `cite_re` runs. A
prose citation in an assistant text block carries none of the three. On 872 local transcripts:
`sessions_citing` **10 as-written vs 14 true**; 12 citation blocks pass, **8 dropped**. Knock-on:
`sessions_citing` is also the **divisor** of `tokens_per_citing_session` ⇒ the KB reads as *less
used AND more expensive per use* — **both errors point toward cutting the KB.**
⚠️Magnitude is one group's corpus; the **mechanism** transfers, the 29% does not. Fix = hoist
`cite_re.search(line)` into the gate as a 4th alternative.

**2. A zero-transcript run is BYTE-INDISTINGUISHABLE from a healthy one in the artifact.** Warning
is **stderr-only**; `KB-HEALTH.md` + `.kb-health.json` record `0/0 (0.0%)`, `0.00 M` as a legitimate
datapoint, no flag, `rc=0`. `grep -c 'WARNING|LANDMINE|0 transcripts' KB-HEALTH.md` → **0**
(non-zero control `grep -c 'KB Health'` → 1). Under the planned 05:45 cron stderr goes to
mail/`/dev/null` ⇒ the morning digest says *"nobody uses the KB, cost is zero"* — **the strongest
possible argument for a change nobody should make, in a green-looking artifact.** This is the
script's OWN documented landmine reproduced in its OWN output surface (docstring admits 2 probes
already returned a confident zero). ⭐⭐**Direct instance of [[feedback_a_guard_can_be_inert_and_read_as_passing]]:
the digest cannot distinguish "measured zero" from "measurement broke."**

**🟡 Four smaller (all reproduced):**
- `atoms/day` divides by **days-with-atoms**, not calendar days (`Counter` has no zero keys).
  Correct today (14/14 populated ⇒ 56.6 right). Fixture: 14 atoms / 14-day span / activity on 2
  days → **7.0/day vs true 1.0** = 7×. **Misreports exactly when activity drops.**
- `d()` deltas don't guard on `window_days`: `--days 30` vs a `--days 10` prior at an IDENTICAL
  daily rate prints **`+200% vs prev`**. One ad-hoc wide run poisons the next night.
- `other` layer is in `tokens_total` but never in the printed breakdown ⇒ shares silently don't sum
  to 100%. Live **1.9%** (concept 86.7 / atom 11.5); synthetic shows 75% unattributed.
- Corrupt `.kb-health.json` → `except: hist=[]` **silently discards all prior runs**: 4 accumulated
  → 1 entry, `rc=0`, no mention of history in stderr. Write is non-atomic
  (`json.dump(..., open(path,"w"))`), which is what CREATES the corrupt file. Wants temp+`os.replace`.

## ✅ Verified clean (each with a control)

- **Offline claim exact**: `grep -E 'urllib|requests|socket|http|urlopen|subprocess|os.system|popen'`
  → **0**. Stdlib only. Compiles.
- **Glob landmine real and correctly handled**: fixture `**/*.jsonl` → **0**, literal
  `.claude-shared` → **1**. Also confirmed `**` matches files sitting DIRECTLY in
  `-workspace-agent/` (zero intermediate dirs) ⇒ flat case not missed.
- **No-leak holds**: `kb-sync.sh` copies only `$SH/{wiki,sources,learnings}`; `data/shared` **root**
  never touched ⇒ telemetry cannot reach the public mirror.
- **Every shape baseline reproduces EXACTLY**: index 5,647 B · 47 pages · 2.58 MB · median 39 KB ·
  max 229 KB · over-cap **23** · missing-TL;DR **47**. Drift now **171** (2379/2208/2208), was 164 —
  growth, but WIDENING.
- Perf fine: `atom_stats` 2,360 atoms = 0.4s; ~1.2s at 7,000.
- ⭐**A units concern I checked that does NOT bind**: `kb-health` caps on `getsize` (bytes),
  `SKILL.md:442` on `len(t)` (chars). Live both → **23**, **0** pages classified differently.
  Latent only — but 3 pages within ~2 KB of the boundary, byte−char deltas to 253 B ⇒ they will
  eventually disagree. **Two sources of truth for one cap.** *(Reported as latent, not asserted as
  a defect — the measurement refused the tidier story.)*
- `pages_over_cap = 23` vs "~7 estimated from a truncated validator listing" = the >40 KB
  truncation problem **measuring itself**.

## Write-authority — unchanged, third confirmation

REST issue-comment POST is the ONLY working verb; both `gh pr review` and `gh pr comment` are
denied (GraphQL `Resource not accessible by integration`). Went straight to
`gh api .../issues/1068/comments --method POST --input <(jq -Rs '{body:.}')` → `5181115163`, no
wasted round-trips. See [[project_nanoclaw_1067_footer_normalizer]] §write-authority.

RESUME = **szihs responds to comment `5181115163`** ⇒ open the follow-up PR (offered). Fix set:
(a) hoist `cite_re` into the cheap gate, (b) `transcripts_matched`/`status` field + loud line in
`KB-HEALTH.md` + non-zero exit on 0, (c) calendar-day divisor, (d) `window_days` guard on deltas,
(e) print `other`, (f) atomic history write. Note **#1066's `superseded_by` persistence defect is
still LIVE on `nv-main`** and also owes a follow-up — both could land together.
