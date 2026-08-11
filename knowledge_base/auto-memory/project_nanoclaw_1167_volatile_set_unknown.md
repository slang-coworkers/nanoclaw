---
name: project_nanoclaw_1167_volatile_set_unknown
description: "nanoclaw#1167 (szihs, OPEN at review) F09 exclusion-set UNKNOWN + F10 both-or-neither. Body verified by execution incl. 8-red pre-fix. 1 🟠: the 'shared date makes a torn pair detectable' claim FAILS for the same-day retry this PR makes routine (digest carries date only, no generated_at) — constructed. 3 🟡 incl. a dead json round-trip and 4 python suites still unwired."
metadata:
  node_type: memory
  type: project
  originSessionId: d2e304ab-6188-4217-a785-eb56335f1a37
---

# nanoclaw#1167 — "a doubt about the exclusion set is a doubt about every comparison"

PR: https://github.com/slang-coworkers/nanoclaw/pull/1167 (szihs, base `nv-main`, head
`fix/nv-main/kb-doctor-volatile-unknown` **`7990f0c1b`**, merge-base `0280ead6`, 4 files +217/−11).
**OPEN, `mergeStateStatus CLEAN`, 0 reviews / 0 comments at my post** — the first PR in this
series I reviewed **pre-merge**; the standing "post-merge is the default posture for szihs +
nv-main" did not fire here. My comment **`5237114509`**.

Blobs pinned: `d390f826` kb-doctor · `54b59cf6` kb-health · `a4e8e78e` tests · `0cd9ee69` ci.yml.

**Routing: INLINE by Main.** `pr_ready_for_review` again carried the generic
*"route to the project's `*-pr-approver`"* string; `slang-coworkers/nanoclaw` has no approver wired
and the slang/slangpy approvers are repo-scoped compiler approvers that would `ABSTAIN_POLICY`.
Standing rule, see [[project_nanoclaw_pr874_webhook_route_approver]]. **Do NOT quote an ordinal** —
the ordinals in this store disagree and none is measured (ANCHOR G).

## Ninth in the KB-tooling series; the direct follow-up to my own #1124 findings

[[project_nanoclaw_1124_kb_unknown_not_clean]] is the parent. F09/F10 here close the P1+P2 the
author's own review doc raised on it. ⭐**A stored finding again gave me a prediction to test the
follow-up against** — and one of my three #1124 🔴 is still live and *intersects this PR's thesis*
(see below). That is what made the review cheap.

## Body verified BY EXECUTION — everything reproduced

- **41/41 post-fix**; **8 red pre-fix** (head test file × merge-base kb-doctor/kb-health in
  `/tmp` scratch): `5 failures + 3 errors`, split exactly as the body's table claims. The keystone
  `test_a_broken_import_is_UNKNOWN_not_a_clean_pass` fails **`AssertionError: 'OK' != 'UNKNOWN'`**
  — the false clean itself, not a `KeyError` — because the assertion order was chosen for it.
  ⭐⭐**The author names which of their own assertions prove nothing** (removed `exit code == 2`);
  I measured that too: that fixture is exit 2 with or without the fix, so removing it was right.
- **The F09 mechanism CONSTRUCTED, not argued**: broken import + a pair that agrees under the stale
  copy → `tasks: UNKNOWN` + `tasks-volatile-set: UNKNOWN`, exit 2. Broken import + real prompt
  difference → `DRIFT`, exit 1.
- **The divergence check is ARMED**: perturbing the *dumper* (`VOLATILE` loses `row_id`), fallback
  untouched, makes `test_an_in_sync_fallback_says_nothing` **FAIL** naming
  `tasks-volatile-set: DRIFT`; unperturbed the key is absent. Fires on real divergence, silent on
  the happy path.
- **The new CI step actually RAN**: run `31362869812` log →
  `KB observability tests (Python) … Ran 41 tests … OK`. ⭐**Presence in the YAML is not execution**
  — I checked the log, not the diff.

## 🟠 The one real finding: "the shared date makes a torn pair detectable" is false for the tear this PR makes routine

F10's comment claims the only surviving window is a crash between the two `write_atomic` calls, and
that *"the sample carries `generated_at` and the digest carries the same date, so a torn pair is
detectable rather than silent."* **`digest()` renders `# KB Health — {c['date']}` and emits
`generated_at` NOWHERE** (`'generated_at' in md` → `False`). And the same PR made same-day re-runs
normal (`hist` filtered by `cur["date"]`), so the most likely tear is the one the date cannot see.

Constructed against head, `write_atomic` mocked to raise on call 2:

```
run1           history [2026-08-10] generated_at …07:05:14.791671
same-day retry history replace SUCCEEDS, digest replace raises OSError
AFTER:  history.date 2026-08-10  generated_at …795189   digest header  2026-08-10
        digest == run1's? True   history != run1's? True
        dates AGREE? True        digest carries generated_at? False
```

⇒ reader sees `date == date`, concludes consistent, reads a digest describing a sample no longer in
the history. **CONTROL (cross-day tear): dates disagree, detectable** — so the date IS a
discriminator, just not for the same-day case.

⭐⭐**The repo already has the fix pattern**: `dump-scheduled-tasks.py` embeds
`Snapshot id: <sha256>` in its Markdown mirror and `check_published()` compares it to the JSON,
catching a torn publish *"after the fact by a reader, including after a crash that ran no
rollback."* One line in `digest()` gives this pair the same property.

## 🟡 `json.loads(json.dumps(hist))` is a dead gate

Commented *"refuse to replace the trend with something unreadable"*. With default flags
`json.dumps` never emits what `json.loads` rejects: `NaN`/`Infinity` round-trip in **both**
directions (`json.loads('{"a": NaN}')` parses). The only asymmetry I found — a >4300-digit int
under 3.11's `int_max_str_digits` cap — **raises inside `dumps`, before the guard**. The
*placement* is correct and load-bearing (`digest()` genuinely raises; the test proves it); it is
the `loads` call that is a no-op. `allow_nan=False` would make it real.

## 🟡 CI gap closed for ONE suite, still open for FOUR

Enumerated every python test file at head × every workflow:

| suite | referenced by |
|---|---|
| `container/skills/learnings-wiki/test_learnings_wiki.py` | `ci.yml` |
| `scripts/test_kb_observability.py` | `ci.yml` ← this PR |
| `scripts/test_regression_quality.py` | **none** (27 tests, pass) |
| `container/skills/supervise-issues/scripts/test_{scan,pull_universe,worktree_gc}.py` | **none** (33/13/28, pass) |

101 tests exist and are simply unwired. Body's "adjacent to task #50, a different suite" is
accurate but the count is **4**, not 1. `python3 -m unittest discover -s scripts -p 'test_*.py'`
→ 68 OK; same over the supervise-issues dir → 74 OK. Two discovery steps replace the growing
named-file list. **Root-level `discover` finds 0** (no `__init__.py`) — must be per-directory.

## 🟡 My #1124 finding survives the fix AND instantiates this PR's own thesis

`check_tasks` still iterates snapshot keys (`live_cmp` filtered by `k in want_cmp`), so a
**live-only key is invisible**. The new `UNKNOWN` does not cover the case where the *snapshot*, not
the fallback, is the stale party: dumper stops excluding `tries` today → yesterday's snapshot has
no `tries` key → live `tries=7` → import works, fallback in sync, nothing degraded →

```
tasks verdict: OK   tasks-volatile-set emitted? False
'all 1 live definitions match the snapshot'
```

CONTROL: same set, snapshot *carries* the field with a different value → `DRIFT [tries]`. ⇒ **a
narrowing change to `VOLATILE` yields a confident clean until the snapshot is re-dumped**, and the
new check cannot see it because it compares dumper-vs-fallback and those two agree.

## Deployment — confirmed and UNDERSTATED by the body

`docs/deployed-closure-verification-2026-08-10.md` in this same tree is more specific than the PR
body: F10 is **`inert-and-actively-miscomputing`** — prod `kb-health.py` is pre-#1124 and **on a
05:45 daily cron**, rewriting `KB-HEALTH.md` + `.kb-health.json` (last 2026-08-10 05:45). Not
merely dormant: the defective version produces the numbers on the dashboard now. `kb-doctor.py`
absent from prod and scheduled nowhere (task #36) ⇒ F09 needs a deploy **and** a schedule.

## Branch topology worth remembering

`scripts/test_kb_observability.py` and the `ci.yml` python steps exist **only on `nv-main`** —
all five other branches (`main`, `nv-dashboard`, `nv-slang`, `nv-slangpy`, `nv-nanoclaw`) have
`ci.yml` with **0** `run: python3` steps and no test file. `.github/**` and `scripts/**` are both
in nv-main's owned set (`.github/nv-path-guard/nv-main.txt`), so the composed-state merge resolves
toward nv-main and leaf PRs do execute the suite against nv-main's scripts.

See also [[project_nanoclaw_1165_lineage_integrity_f12]], [[project_nanoclaw_1076_kb_doctor]].
