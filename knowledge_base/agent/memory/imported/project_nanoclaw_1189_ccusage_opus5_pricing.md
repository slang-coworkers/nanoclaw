---
name: project_nanoclaw_1189_ccusage_opus5_pricing
description: "nanoclaw#1189 (szihs) drops --offline from runCcusage + fills FALLBACK_PRICING for opus-5. ~32nd no-nanoclaw-approver inline review. LGTM, 4 findings. REPRODUCED 53.5x on my own transcripts. Key finding: NO on-disk pricing cache ⇒ every runCcusage call refetches 1.6MB; 23 groups x 60s = ~1380 req/hr/dashboard, so the silent-$0 risk is ENDOGENOUS (429), not just 'if the network is down'."
metadata:
  node_type: memory
  type: project
  originSessionId: pr1189-ccusage
---

**slang-coworkers/nanoclaw#1189** — `dashboard: price opus-5 — cost was understated 52x`,
branch `fix/ccusage-online-pricing` → **`nv-dashboard`**, author **szihs** (human, not bot).
2 files, +175/-9. `pr_ready_for_review` (reason `opened`) webhook, 2026-08-11.
CI **green** (`ci` pass 2m40s, `label` pass). Zero prior reviews/comments — I was first.

**ROUTING: handled INLINE by Main — ~32nd instance** of the standing rule
([[project_nanoclaw_pr874_webhook_route_approver]]): the webhook's generic *"route to the project's
`*-pr-approver`"* string is advisory; nanoclaw is the platform fork with **no approver wired**, and a
slang/slangpy **compiler** approver at a dashboard-pricing PR would `ABSTAIN_POLICY`.
Comment **`5252868380`**.

## What the PR does

`runCcusage` passed `--offline`, which prices from the snapshot bundled in ccusage **20.0.19**
(already latest ⇒ no version bump fixes it). That snapshot lacks `claude-opus-5`. ccusage's response
to an unknown model is **cost 0 with token counts intact** ⇒ well-formed, self-consistent, wrong.
Three fixes: drop `--offline`; fill `FALLBACK_PRICING` (was 1 entry) and export it; delete the
`CCUSAGE_MODEL_ALIASES` sonnet-5→sonnet-4-6 workaround (50% markup **and** it merged labels,
destroying per-model attribution).

## Independent reproduction — the numbers are real

Pulled the pinned native binary (`npm pack @ccusage/ccusage-linux-x64@20.0.19`, bin at
`ccub/package/bin/ccusage`) and ran both ways against **my own** container's transcripts
(`CLAUDE_CONFIG_DIR=/home/node/.claude`, `--since 20260801`):

| model | `--offline` | live |
|---|---|---|
| claude-opus-5 | $0.00 | **$8,690.03** |
| aws/anthropic/bedrock-claude-opus-5 | $0.00 | **$8.93** |
| claude-opus-4-8 | $162.38 | $162.38 |
| claude-haiku-4-5-20251001 | $2.74 | $2.74 |
| bedrock-claude-opus-4-8 | $0.46 | $0.46 |
| **total** | **$165.58** | **$8,864.54** |

**53.5x** on one group; every already-correct model **byte-identical** — the signature the author
claimed. (His prod figure was 52x across 23 groups; mine is one group, so the two agree in kind, not
in magnitude — do not conflate them.)

Also verified: all 4 rate rows match live LiteLLM exactly; the old sonnet-5 row **is**
`claude-sonnet-4-6`'s list verbatim; **none** of these models carry `*_above_200k_tokens` rates in
LiteLLM ⇒ the flat 4-field table is faithful (the tiering mismatch I expected does not apply);
full suite **1445 passed (108 files)**; online 0.59–0.69s vs offline 0.52s.

## ⭐ The finding worth keeping: the fix's risk is ENDOGENOUS

**There is no on-disk pricing cache.** Proof: a successful live run, then a dead-proxy run seconds
later → `$0.00`. Nothing persists between invocations ⇒ **every** `runCcusage` call refetches
`model_prices_and_context_window.json` (**1.6 MB raw / 82 KB gzip** — measured both).

`refreshCcusageCache` fans out one call **per agent group** on a 60s timer while a dashboard client
is connected. 23 groups ⇒ **~1,380 req/hr per dashboard**; the re-entrancy comment directly above
documents **5 dashboards on one box** ⇒ **~6,900 req/hr** to `raw.githubusercontent.com`.

The PR frames the $0-reinstatement risk as *external* ("prod has network"). The fan-out makes it
**self-inflicted**: a 429 lands in the identical silent-$0 state. ⇒ ⭐⭐**When a fix trades a
bundled snapshot for a live fetch, the call-frequency question is part of the review — the author
answered the outage case and never counted his own request volume.**

**Fail-soft confirmed honestly**: dead proxy → `$0.00`, **rc=0, empty stderr**, well-formed JSON.
⚠️My FIRST attempt to test this failed open — `no_proxy='*'` did **not** block egress (direct
network works here), so the run priced opus-5 correctly at $1145.18 and I nearly reported "the
outage claim is wrong." A dead proxy (`HTTPS_PROXY=http://127.0.0.1:9`) was the working method.
⇒ **a negative-control that silently doesn't block is indistinguishable from a refutation.**

## Findings 2–4

2. 🟡 **Mutation claim covers one of two sites.** *Inside* `ccusageDailyArgs` → 2 tests fail (I ran
   it). At the **call site** `[...ccusageDailyArgs(since), '--offline']` → **6/6 still pass**. The
   extraction moved the assertion boundary to the helper's return value; the argv handed to
   `execFile` is unasserted. ⇒ ⭐**Extracting a value to make it testable can move the test off the
   boundary that actually broke.**
3. 🟡 **Table still silently drops in-use ids.** `if (!FALLBACK_PRICING[model]) continue`. Absent
   from the table but present in my transcripts: `claude-haiku-4-5-20251001`, `claude-opus-4-7`,
   `aws/anthropic/bedrock-claude-opus-4-8`. Stated with the limit: I see these in `projects/`; this
   container has **no** `skills/*/transcripts/`, so I could not confirm they reach the scanner's
   path. The new test asserts 3 named models are present ⇒ passes while any unlisted id is dropped
   (closes the instance, not the class).
4. Nit: `aws/anthropic/bedrock-claude-opus-5` uses base `5e-6`; regional `us./eu./jp.` keys bill
   `5.5e-6/2.75e-5` ⇒ possibly 10% light.

## Constructed test worth reusing

**Does ccusage read `skills/*/transcripts/`?** Placed one identical assistant record under a fake
`CLAUDE_CONFIG_DIR`: under `skills/.../transcripts/` → `daily: []`, $0.00; under `projects/` →
$30.00. ⇒ the two cost paths are **complementary, no double-count**. Cheaper and more decisive than
reading the loader source.

Related: [[project_nanoclaw_1159_deploy_validates_templates]],
[[project_nanoclaw_1115_funnel_trusted_provenance]] (same funnel/cost surface).
