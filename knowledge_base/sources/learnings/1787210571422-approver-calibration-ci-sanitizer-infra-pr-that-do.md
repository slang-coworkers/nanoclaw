---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787208113173-doxczh
written_at: 2026-08-20T07:22:51.422Z
---

# [approver/calibration] CI sanitizer-infra PR that downloads an unverified external toolchain → OPEN_GAP unless checksum-pinned or owner-accepted (slangpy#1119)

## The transferable class
A CI/build-infra PR that **downloads an external toolchain or binary and then builds/runs with
it** (here: `curl | tar` of an LLVM 22 release archive added to PATH, in a new `sanitizers.yml`
tsan lane) carries a supply-chain gap that is a specific, nameable OPEN_GAP — NOT a stylistic
nit — when ALL of:
1. the download has no integrity check (no SHA-256/512 pin; TLS + `--fail` proves transport, not
   that the bytes are the intended artifact);
2. it executes on a CI runner that also holds repo credentials (checkout without
   `persist-credentials: false`) and/or uses an unpinned action (`@latest`, floating tag);
3. no security-owner has explicitly accepted the surface on the PR.
A bot (CodeRabbit here) that flags exactly this as "required before merge or need explicit
security-owner acceptance" is stating a merge-gating verdict → parse as REQUEST_CHANGES → Step 3
does not clear (real trigger: every run of the lane; real blast radius: unverified compiler +
credentials) → **ABSTAIN_POLICY:OPEN_GAP**. Fallback tier + conservative-lean ⇒ never round up.

## What does NOT rescue it (probed and rejected on #1119)
- "A green lane ran the download and built fine" — proves usability at that head, not archive
  integrity, and (if the lane is schedule/workflow_dispatch-only, no `pull_request` trigger) not
  automatic PR coverage. Verify the workflow `on:` block + the run `event` before leaning on it.
- "The checkout/action pattern matches the pre-existing repo convention" — valid ONLY for the
  items that are genuinely unchanged (persist-credentials, get-cmake here). A NEW download the PR
  introduces is not covered by "convention"; judge it on its own.

## What DID clear (so a similar PR isn't over-abstained)
- Global vcpkg overlay blast radius cleared because the full **non-TSan** build matrix was green
  on the head (both-directions control — the overlay applies to all builds, and none regressed).
- Pre-existing red lane (asan-ubsan-linux LeakSanitizer) is not a change-defect: it's red on
  `main` and the PR's edits are TSan-gated, ASan/UBSan paths untouched. Not a BLOCK.
- No 🔴 functional bug anywhere ⇒ never BLOCK; the whole thing is a security-hardening judgment
  that belongs to a human, which is what ABSTAIN_POLICY:OPEN_GAP routes.

## Step-0 recall hook for next time
When changed paths include a new/edited `.github/workflows/*` that fetches an external binary:
grep the diff for `curl`/`wget`/`Invoke-WebRequest` + `tar`/`unzip` and check for a companion
checksum/hash verification and `persist-credentials`. Missing verification on an executed
download = OPEN_GAP candidate.
