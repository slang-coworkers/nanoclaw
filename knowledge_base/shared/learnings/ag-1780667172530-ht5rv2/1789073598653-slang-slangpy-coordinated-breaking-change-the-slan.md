---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1788459650863-01ks0y
written_at: 2026-09-10T20:53:18.653Z
---

# Slang↔SlangPy coordinated breaking change: the SLANGPY_CHERRY_PICK_PR production pattern (update)

Update to the earlier "companion PR CI merge-order" learning, from how slang#12840→#12986 ↔ slangpy#1135 actually resolved in production:

**The cherry-pick coordination (slangpy#1143) is the real mechanism, and it must be driven from the slang side + cleaned up after.**
- A **fork** Slang PR cannot run the secret-gated cherry-pick CI (needs `SLANGPY_DISPATCH_TOKEN`/`SLANG_STATUS_TOKEN`). So a cross-repo breaking change gets **recreated as a same-repo Slang PR** (12840 fork → 12986 same-repo) to enable coordination. Don't assume a closed slang PR was rejected — check for a same-repo successor (`gh pr view <n> --json state,mergedAt`; `mergedAt:null` + `state:CLOSED` = closed unmerged).
- Once the same-repo Slang PR is open, a maintainer sets **`SLANGPY_CHERRY_PICK_PR: "1135"`** in slang `master`'s `.github/workflows/ci-slangpy-trigger-test.yml`. That makes EVERY slang PR's "SlangPy Tests" dispatch pass `slangpy_cherry_pick_pr`, so slangpy's `ci-latest-slang.yml` merges the companion PR into slangpy before building against master-Slang. This (a) keeps all slang PR CI green through the breaking window, and (b) continuously exercises the companion PR green — that IS the execution proof (verify: the slang PR's own "SlangPy Tests" commit status = success).
- **The slang-side breaking PR can merge to master BEFORE the slangpy companion PR merges** — the cherry-pick keeps CI green. The enum/type then lives on slang `master` but NOT in any release yet.
- The slangpy companion PR then just waits on a **release gate**: slangpy's own `ci.yml` builds against pinned `SGL_SLANG_VERSION` (a release tarball, not master), so the companion PR's own CI stays red until (1) a Slang release containing the change is cut and (2) the companion PR bumps `SGL_SLANG_VERSION` to it. Only then merge.
- **Post-merge cleanup [easy to forget]:** after the companion slangpy PR merges, revert `SLANGPY_CHERRY_PICK_PR` back to `""` on slang master (the workflow carries an in-file "REVERT … AS SOON AS #<pr> HAS MERGED" comment) — otherwise slang CI keeps cherry-picking a merged PR.
- Validation shortcut once the change is on slang master: run slangpy `ci-latest-slang` `workflow_dispatch` from the companion PR branch with the default `slang_branch=master` — branch checkout mode reaches master (the earlier fork-only-branch limitation is gone once merged).
