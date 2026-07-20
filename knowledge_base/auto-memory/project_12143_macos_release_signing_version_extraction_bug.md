---
name: project_12143_macos_release_signing_version_extraction_bug
metadata: 
  node_type: memory
  type: project
  originSessionId: da7c4a3e-c585-4149-918d-070c0aeaf9ed
---

**✅ RESOLVED 07-18 — FIXED via Path A & CLOSED.** PR **#12149** "Fix macOS signing version extraction" (author **gtong-nv**; jkwak self-assigned but gtong wrote it) MERGED 07-18, merge `3292090b36`; jkwak manually closed (comment 5014518198; PR body had no `Closes #12143` → hand-closed). Triager verified the **merged diff**: one-liner at `release.yml:217` replaces greedy `.*\.0\.` with prefix-anchored `^libslang-compiler\.0\.([0-9]+(\.[0-9]+)*)\.dylib$` = **Approach A, diagnosis VINDICATED**; round-trips byte-exact 3/4-comp + interior-0; release unblocked. No GitHub reply (clean maintainer self-close). **OPEN separate track:** cert validity still unverified — next tagged macOS release run is first to reach `codesign` (:250); renew Khronos "Developer ID Application" cert if it then reports `0 valid identities`. jkwak owns. Chain closed; re-open only on fresh substantive human comment. History below retained.

---

**shader-slang/slang#12143** — "Update the digital signing keychain for MacOS release" (jkwak-work, assignee swoods-nv). P1 release ship-stopper: macOS release build fails at "Sign and notarize binaries" since tag **v2026.12.0.1**.

**Triager finding CORRECTS jkwak's framing.** jkwak hypothesized expired Khronos signing cert. PROVEN cause instead = **version-extraction bug** in `.github/workflows/release.yml:217`: greedy `sed -E 's/.*\.0\.([0-9]+(\.[0-9]+)*)\.dylib$/\1/'` matches the LAST interior `.0.`. For 4-component tag `v2026.12.0.1` → dylib `libslang-compiler.0.2026.12.0.1.dylib` → extracts `1` → reconstructs nonexistent `libslang-compiler.0.1.dylib` (byte-exact to error). 3-comp tags have no interior `.0.` → parsed fine → "began at v2026.12.0.1". Latent since PR #8926; no code change — first 4-comp tag exposed it. I re-traced the regex; repro sound.

**Cert = UNVERIFIED (not disproven).** "0 valid identities found" is from `security find-identity` at :177, BEFORE cert import (:189) — pre-import diagnostic noise on the runner default keychain. Job dies at :253 before codesign (:250) → zero signal on cert validity. Check separately once version bug fixed.

**Fix (Approach A, one-liner):** `version=$(basename "$libslang_library" | sed -E 's/^libslang-compiler\.0\.(.*)\.dylib$/\1/')`. Follow-ups B (sign resolved real files, no name reconstruct) / C (single source = tag, reuse :274-278).

**Routing: PARK at triaged → maintainer.** Fix edits `.github/workflows/release.yml`; bot lacks `workflows` perm (see [[project_bot_workflows_permission]]) → bot PR bounces. Do NOT dispatch slang-fixer. gon `darwin_arm64` unsupported warning = ancillary/latent (never reached).

**POSTED 07-17 11:25 UTC** (after GitHub auth recovered — see [[project_github_actions_graphql_401_outage]]). Verdict on issue as nv-slang-bot, comment 5002712412 (fresh, no prior comments), re-verified vs live master HEAD `5c30d437f`: https://github.com/shader-slang/slang/issues/12143#issuecomment-5002712412 — carries Approach-A one-liner + B/C follow-ups + separate cert track. Chain remains parked at triaged; next-action = maintainer (swoods-nv/jkwak) applies fix.

**RE-OPENED then RE-PARKED 07-17 20:26 UTC.** jkwak-work self-assigned (comment 5007171429: "figure out how to renew it") — the maintainer hand-off, but wording showed no engagement with the version-parse diagnosis (heading down cert track). Triager verified `:217` still unfixed on master `3649fb982`, posted brief deferential nudge (comment 5007191265): cert renewal legit as separate track BUT run aborts at `:253` before codesign so gives no cert signal; live blocker = greedy sed at `:217`; included ready one-liner; noted once fix lands, that run first exercises codesign & reveals if cert truly needs renewing. jkwak (self-assigned) owns applying fix; cert in parallel. Re-parked at triaged.

**2nd RE-OPEN 07-17 20:48 UTC.** jkwak asked "what version parsing bug? can you make a PR?" (comment 5007327931). Triager re-verified `:217` still unfixed on master `3649fb982`, posted full reply (comment 5007340729): (1) recapped greedy-sed trace + why began at v2026.12.0.1, re-linked verdict 5002712412; (2) honest re bot App lacks `workflows` perm → GitHub rejects push to `.github/workflows/` (#11985/#12062), gave ready diff + **Path A** (human commits one-liner, fastest) / **Path B** (grant App `workflows` perm → route slang-fixer). Did NOT dispatch fixer (would bounce without grant). **Next-action = jkwak's choice: commit directly OR grant perm for bot PR.** Terminal from Main's side pending jkwak's decision. If jkwak picks Path B / grants perm → route slang-fixer on this thread.
