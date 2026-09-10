---
name: project_nanoclaw_1108_service_hint_single_source
description: "nanoclaw#1108 single-sourced serviceRestartHint() — MERGED mid-review (9th race), blobs == nv-main BY HASH. Headline: the PR creates the THIRD hand-written copy (auto.ts:513 Linux finder) one line below its own fix, and its AND-marker guard structurally cannot see it. ~28th inline-routing instance. Comment 5205199940."
metadata:
  node_type: memory
  type: project
  originSessionId: 2cb3f7b6-8b08-4661-8739-76c9f9079615
---

# nanoclaw#1108 — `ncl/setup: one source for the service-restart hint` (szihs, `service-hint-single-source` → `nv-main`)

Direct follow-up to the **🟡 "Three unfixed sibling sites"** note I left on
[[project_nanoclaw_1085_ncl_unit_hint]]. Extracts `serviceRestartHint()` +
`SERVICE_NAME_CAVEAT` into `src/install-slug.ts`; both call sites
(`src/cli/transport-errors.ts`, `setup/auto.ts:857`) now consume it. 4 files, +148/−24.
New `src/install-slug.test.ts` (97 lines) walks `src/`+`setup/`+`dashboard/` and fails any
file hand-writing the commands.

**ROUTING: handled INLINE by Main — ~28th instance.** nanoclaw is platform-infra; the
webhook's "route to the project's `*-pr-approver`" targets PRODUCT repos. Write path
(re-confirmed): `gh api .../issues/N/comments -X POST` works; `gh pr review`/`gh pr comment`
denied. Comment [5205199940](https://github.com/slang-coworkers/nanoclaw/pull/1108#issuecomment-5205199940).

**MERGED mid-review** — opened 13:00:15Z, merged `e81a0cc7` 13:19:46Z by szihs (**9th szihs
merge race**). All 4 blobs verified **SAME as `origin/nv-main` by hash** ⇒ findings are live,
not against a superseded head.

## 🔴 The headline: the PR creates the third copy it warns about, one line below its own fix

`serviceRestartHint()` de-duplicated the **restart pair**. But the Docker-permissions hint
gained a **hand-written copy of the Linux finder** at `setup/auto.ts:513`:

```ts
'  (custom unit name? find it: systemctl --user list-units --all | grep -i claw)',
```

Same text as `src/install-slug.ts:61`, unguarded. **Measured both directions (the
discriminating pair):**

| edit | result |
|---|---|
| finder in the single source (`install-slug.ts:61` → `--type=service`) | **2 suites fail** (`install-slug` + `transport-errors`) ✓ |
| finder at `auto.ts:513` → `launchctl list \| grep -i claw` (**macOS finder on a Linux-only path**) | **9/9 PASS** |

Row 2 is the exact defect #1085 fixed, re-introducible green. Two independent reasons:
1. No test touches that site (`grep -rln "renderPingFailureNote\|DOCKER_GROUP_STALE"
   --include=*.test.ts` → none).
2. **The guard structurally cannot see it**: it's an `AND` of two markers, and post-fix
   `auto.ts` has `systemctl --user restart ` but **no longer** `launchctl kickstart -k gui/`
   ⇒ passes while carrying hand-written guidance.

⭐⭐⭐**A de-duplication PR is the highest-risk place to hand-write a sibling string, and its
own guard is the least likely thing to catch it — the guard was written against the shape the
OLD code had.** The fix shrank `auto.ts`'s marker set below the guard's `AND` threshold, so
the file *left the guard's population by being partially fixed*. ⇒ **When reviewing a
"single source" refactor, check whether the fix changes which files the new guard can still
see** — coverage is not monotonic in cleanup.

## 🟡 Guard `AND` evadable by the form already used in-repo

Probed: a file re-authoring the **quoted** macOS form passes (5/5).

```ts
`  macOS:  launchctl kickstart -k "gui/$(id -u)/${label}"`,   // -k "gui/ ≠ marker -k gui/
```

⭐⭐**That quoted form is the house style for this command at `setup/lib/restart.sh:14`** ⇒
the most likely future re-author (someone copying the shell helper) is precisely the case the
marker misses. `OR` on `launchctl kickstart` / `systemctl --user restart ` costs no false
positives (`install-slug.ts` + its test are allow-listed). Also probed: a new site calling
`serviceRestartHint()` but **omitting `SERVICE_NAME_CAVEAT`** → 5/5 pass (caveat pairing is
unenforced).

## 🟡 NOT behaviour-preserving for `ncl` — and the 4 unchanged tests cannot see it

The body claims the unchanged `transport-errors` tests are the evidence of preservation
because they "assert block *structure*, not substrings." **Structure survived; wrapping
didn't.** Rendered through the real function on both sides (`tsx`, not read off the diff):

```
base: line2=68  line3=73  line4=53   (hand-wrapped across 3 array elements)
head: line2=196                       (one const)
```

`setup/auto.ts` re-wraps via `wrapForGutter(...,6)` — fine there. `transport-errors.ts`
writes straight to stderr (`client.ts:42`), **no wrapper** ⇒ on an 80-col terminal the caveat
soft-wraps mid-word in the one message whose job is careful reading while something is broken.

⭐⭐⭐**"Tests assert structure, not substrings" is a claim about what the tests CAN'T see,
offered as proof of what didn't change — it is an argument for weak coverage dressed as
evidence.** A property invisible to the suite (line width) is exactly where a
"behaviour-preserving" refactor drifts. ⇒ **Render both sides and diff the ARTIFACT, not the
assertions.** Same family as the #1085 lesson (a suite passing identically on both sides
tests nothing about the change) — here the suite passed identically **and the output changed**.

## 🟡 `dashboard` root dark locally, covered in CI

Walk roots measure **321 / 97 / 0** files (`src`/`setup`/`dashboard`) on `nv-main` —
`dashboard/` doesn't exist there and `catch { return; }` makes ABSENT indistinguishable from
SCANNED-CLEAN. Not a defect: `ci.yml` merges `nv-dashboard`+`nv-slang`+`nv-slangpy`+
`nv-nanoclaw` before `vitest`, so CI does scan it (checked `origin/nv-dashboard`'s
`dashboard/**/*.ts` directly — **0 offenders**). Flagged only so a local green isn't read as
dashboard coverage.

## Out of scope, recorded

`.ts` is now nearly single-sourced; **docs are not.** 50 `.md`/`.sh` files correctly use the
`launchd_label`/`systemd_unit` shell mirror (`setup/lib/install-slug.sh`), but **7 still
hard-code bare v1 names** — the #2484 class: `CLAUDE.md`, `docs/ON-CALL-RUNBOOK.md`,
`docs/ncl-tasks-migration.md`, `.claude/skills/{setup,debug,add-codex,add-dashboard}`. The
guard walks `.ts` only ⇒ will never see them.

## Verification method (what actually ran)

Worktrees at head `940b7647` and base `eb7371a7` off `/workspace/agent/nanoclaw-kb` (**NOT
shallow** here — `--is-shallow-repository` → false, unlike the state recorded in #1085;
re-check per session), `node_modules` symlinked from the parent clone.

- **9/9** vitest at head (`install-slug` 5 + `transport-errors` 4).
- **Differential guard runs — the load-bearing evidence, not the planted probe:** base
  `setup/auto.ts` swapped under the new test ⇒ `expected [ 'setup/auto.ts' ] to deeply
  equal []`. ⭐⭐**Test the guard against the HISTORICAL divergence it was written for; a
  synthetic probe only proves the matcher runs.**
- `tsc` **base vs head both regenerated this session** ⇒ error sets byte-identical, 4
  pre-existing (`@chat-adapter/telegram`, `js-yaml` ×3). Tree is not error-free at either
  end; "typechecks clean" is true only as a delta.
- prettier: `--check "src/**/*.ts"` exit **0** (= CI's `format:check` scope, per
  `package.json`). `setup/auto.ts` fails prettier at **base AND head** (60 files repo-wide
  outside `src/`) ⇒ pre-existing. ⭐**Run the checker's real scope from `package.json` before
  calling a formatting failure a regression** — my first pass widened the glob to `setup/**`
  and produced a false positive on the PR.
- Census asserted before scanning: files listed **4 == changedFiles 4**; added content lines
  **152 − 4 headers = 148 == `additions` 148**.
- CI: `check`/`ci`/`label` all **pass** (`ci` was `pending` on first read — don't quote a
  pending as a result). **No labels** on the PR; `label-pr.yml` reads body checkboxes, body
  has none.

Related: [[project_nanoclaw_1085_ncl_unit_hint]] (predecessor; this PR closes its 🟡 sibling-sites
note), [[project_nanoclaw_pr874_webhook_route_approver]] (routing rule),
[[feedback_nv_coworkers_automerge]] (`nv-main` outside the grant — maintainer owns merge).
