---
name: project_nanoclaw_1121_kb_doctor_artifact
description: "nanoclaw#1121 (szihs, nv-dashboard) fixes both #1080 🔴s in /api/kb-health. Reviewed INLINE post-merge, comment 5206134605. Both fixes hold end-to-end vs the REAL producer that landed 9 min later in #1124. 3🟡: comment at server.ts:5553-5554 asserts 2 false things; tsc verification cannot cover dashboard/; test blocker is macOS-local."
metadata:
  node_type: memory
  type: project
  originSessionId: d96e13cd-7e62-4b32-a20d-ae2aa76ab8fe
---

# nanoclaw#1121 — `/api/kb-health` reads the structured kb-doctor artifact

PR https://github.com/slang-coworkers/nanoclaw/pull/1121, author **szihs**, base **`nv-dashboard`**,
head `68392773`, **1 file +67/−7** (`dashboard/server.ts`). Comment **`5206134605`**.
Direct follow-up to my own [[project_nanoclaw_1080_kb_health_route]] — it fixes **both** 🔴 I filed
there (the 2-char `split('\\n')` and the writer-less `.kb-doctor.txt`).

**Routing: handled INLINE by Main** (~27th instance). Webhook carried the generic
*"route it to the project's `*-pr-approver`"* string, which targets PRODUCT repos only — see
[[project_nanoclaw_pr874_webhook_route_approver]].

## STATE — MERGED 13:49:04Z, +9 min after opening (another race)

Verified merged blob == reviewed head **BY HASH**: `dashboard/server.ts` = `42a32007` at head
`68392773`, at merge commit `bb9b69fb`, and at the `nv-dashboard` tip. Single parent `51d532c8`
(squash). `ci` + `label` both green at head. 0 prior comments.

## ⭐⭐⭐ THE LESSON: the producer half landed 9 MINUTES AFTER the merge, and it INVALIDATED my headline finding

My draft Finding 2 was: the route reads `raw.generatedAt` (camelCase) while reading
`latest?.generated_at` (snake_case) 5 lines above; `scripts/kb-doctor.py` is **print-only** (0
write-opens vs `kb-health.py`'s 2) and **no branch of the repo writes `.kb-doctor.json`** (censused
all 16 remote branches, `jsonwrite=0` on every one) ⇒ if the future producer follows its sibling's
snake_case, `stale` can never fire, silently. I **measured** that: snake_case + 49 h old →
`stale=false, ageHours=null`.

**All of that was true of the ref I read and FALSE by the time I would have published.** PR
**#1124** (`kb-doctor/kb-health: unknown is not clean…`, merged **13:58:34Z** — 9 min after #1121)
rewrote `kb-doctor.py` 162→369 lines, adding `write_artifact()` (mkstemp→`json.dump`→fsync→
`os.replace`), default `<repo>/data/shared/.kb-doctor.json`, and line 326 emits
**`"generatedAt"` — camelCase, matching the consumer exactly.** The mixed convention is *correct*:
each key matches its own producer.

⇒ ⭐⭐⭐ **A 16-branch census with a per-branch positive control is still a measurement of ONE MOMENT.
On a repo merging a PR every few minutes, "no branch writes this file" expires while you are
reasoning about it.** The census wasn't wrong — it was *stale*, which is indistinguishable from
wrong at publication time. **Re-run the census that establishes an ABSENCE immediately before
publishing, exactly as the merge-state recheck rule already demands for `state`/`merged`.**

⇒ ⭐⭐ **And the adversarial pass is what caught it** — I asked it to refute both findings and it
refuted #2 on facts I could have fetched but hadn't re-fetched. It also noted the mechanism of my
false negative: my shallow clone (`.git/shallow`, refspec `nv-dashboard` only) **never fetched
`nv-main`**, so a local grep for the producer returns a **false negative with no error**
(same family as [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]]). My branch census went
through the API and was right-for-its-moment; a local grep would have been wrong outright.

⚠️ It also corrected two fixture errors of mine, neither published: my fixtures used
`status: "ok"`, which **the producer never emits** (its enum is `clean | drift | unknown`), and
`counts.drift: "3"` (string) is unreachable since the producer always emits `len()`.

## ✅ Both #1080 🔴s genuinely fixed — verified END-TO-END against the real producer

Ran the landed `kb-doctor.py` against a repo where every check errors → `status:"unknown"`,
`complete:false`, `counts:{ok:0,drift:0,unknown:4}`, `exitCode:2`. Fed that **real artifact** through
the route's reader transplanted verbatim (transplant fidelity confirmed by the adversary:
whitespace-normalised diff vs `server.ts:5513-5537` empty, only `Date.now()`→`nowMs`):

| artifact | `driftCount` | `doctor.status` | `complete` | `stale` |
|---|---|---|---|---|
| absent / unparseable / `schema:2` | **null** | null | null | false |
| `clean`, fresh | 0 | clean | true | false |
| `drift`, 3 | 3 | drift | true | false |
| **all 4 UNKNOWN (real run)** | **0** | unknown | false | false |
| `clean`, 49 h old | 0 | clean | true | **true** |

Row 1 is the fix and it holds — the old reader returned `[]` for all three. Path agreement exact
(`join(getDataDir(),'shared')` vs the producer's `<repo>/data/shared`). `complete:false` +
`status:"drift"` coexistence claim verified against the producer's own logic
(`status` is drift-first, `complete = not unknown` ⇒ `clean`+incomplete unreachable,
`drift`+incomplete reachable).

## 🟡 `dashboard/server.ts:5553-5554` — the comment asserts two false things

```
// Kept for existing consumers, but sourced from the producer's count —
// null when unavailable, so "unknown" can never render as zero.
```

(a) **`"unknown"` DOES render as zero** — row 4, from the real producer. But `driftCount: 0` is
*correct*: `counts.drift` counts DRIFT findings only, an errored check becomes UNKNOWN, so 0 means
"zero drift among the checks that ran". `grep -n driftCount` → 5 hits, none conditional on
`complete`; nothing clamps it. **Only the comment is wrong**, and it uses `"unknown"` in the
producer's exact term-of-art sense. ⭐⭐**I originally framed this as the payload restoring #1080's
conflation — the adversary correctly downgraded it: the missing/unreadable/no-drift conflation IS
gone; what remains is a different, narrower one, in the legacy scalar only.** ⭐⭐**And it is the
CODE COMMENT that makes the claim, not the PR body — the body's "null when unavailable" is
legitimately scoped to row 1. Cite the artifact that makes the claim, not the prose that resembles
it**; had I rested the finding on the body it would have been refuted.

(b) **there are no existing consumers.** `grep -rIn -i "kb.health"` whole-tree → only
`server.ts:5456/5461/5462`. Positive control: `/api/regression-quality` and `/api/funnel` ARE
fetched (`dashboard/public/app.js:448/386`); `/api/kb-health` nowhere. The compatibility framing is
what makes (a) look harmless.

⭐⭐**Dropped the `stale` leg before publishing** — a 49 h-old clean report reporting 0 *was*
measured, just stalely, and `doctor.stale:true` is right there. Calling it "unmeasured as clean"
would have been wrong.

## 🟡 The stated verification could not have failed for this file

Body verifies `tsc --noEmit -p tsconfig.json` exit 0 — true, but the root tsconfig has
`include:["src/**/*"]` and is the **only** tsconfig; `dashboard/` has none. Proven with **paired
probes**, not by reading the config: a deliberate `TS2322` in `dashboard/__tsprobe.ts` is **NOT
reported** (error count unchanged) while the same error in `src/__tsprobe.ts` **IS** (+1) ⇒ the
instrument fires, the negative is real. `--listFilesOnly`: **0 of 496** files under `dashboard/`,
`src/index.ts` present as control (re-run independently with real deps: 0 of 496 again).
`build` + `typecheck` resolve to the same project ⇒ ~12 k-line `server.ts` unchecked by every entry
point the repo ships.

Typechecked it directly with real deps: **34 errors in `dashboard/server.ts`, byte-identical count
at base `51d532c8`** ⇒ adds none, and **0** in the changed region (5456-5580). Change is type-clean;
the *command* just wasn't evidence. Same shape as #1080's lesson.

Prettier note in the body **accurate** — CI gate is `prettier --check "src/**/*.ts"`, and
`server.ts` is not prettier-clean at **base** either (tested both with the repo's own `.prettierrc`).

## 🟡 The test blocker is macOS-arm64-local, not the suite

Body: `dashboard/server.test.ts` can't execute (`rolldown-binding.darwin-arm64.node`).
**It runs fine on linux x64**: 88 tests green, 113/113 across the 3 dashboard files, **identical on
head and base** ⇒ no regression. pnpm installs `@rolldown/binding-linux-x64-gnu` there. CI at this
head ran it green too (`✓ dashboard/server.test.ts (88 tests)`, 158 files passed) — so a test **was**
shippable; CI would have verified it. Suite has **0** refs to `kb-health`/`kb-doctor`/`drift` and is
byte-identical head-vs-base ⇒ **the 88 green tests are a no-regression signal with ZERO coverage of
this route.** ⭐⭐*"I couldn't run it" is a claim about a machine, not about the suite — check
whether YOUR platform can run it before accepting the flag.*

## ⚠️ Published as explicitly UNVERIFIED: whether a kb-doctor cron exists

`.kb-doctor.json` **absent from live prod `/workspace/shared` at 14:24Z** ⇒ route reports
`unavailable`/`driftCount:null` today, the honest state the sequencing note predicted. But
**no invoker** of `kb-doctor.py` appears in `docs/scheduled-tasks.*`, the workflows, or any task
prompt I can read — and I said plainly that this census is **not authoritative**, because:
⭐⭐⭐**my own self-check refuted my instrument.** `ncl tasks list` is **group-scoped** (11 rows vs
13 committed across 4 groups), and the committed snapshot contains **no task with a 05:45
recurrence** even though `.kb-health.json` is demonstrably stamped 05:45 today. ⇒ **A census that
cannot find a writer you KNOW exists cannot be used to conclude another writer doesn't** — I found
the discriminator by asking the instrument to locate a known-present item, which is cheaper than any
reasoning about scope.

RESUME = szihs replies to `5206134605` ⇒ follow-up = comment fix at `server.ts:5553-5554` (say
"zero drift among the checks that ran", or return `null` when `complete === false`) + pin schema 1 in
a doc/shared type + a fixture test for the route (CI can run it). **Merged, so the 🟡s are live on
`nv-dashboard`** — but none is a regression: all three are about a comment, a verification method,
and coverage, not behavior. #1080's residual 🟡s still live at this head (`available: true` on a
zero-transcript record — though `kb-health.py` now refuses to append on zero transcripts, so the
producer half is fixed; `?? 0` for absent sub-objects; `trend` mixing `window_days`).
