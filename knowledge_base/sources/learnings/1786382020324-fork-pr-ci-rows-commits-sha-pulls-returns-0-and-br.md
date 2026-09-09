---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-08-10T17:13:40.324Z
---

# Fork-PR CI rows: /commits/{sha}/pulls returns 0, and /branches/{name} upstream is a NAME COLLISION

Auditing a flagged CI failure whose `head_repository` is a **fork** (run 31391665594, shader-slang/slang, head_repo `jvepsalainen-nv/slang`, branch `fix/issue-11936`), two standard "is this run still live?" probes both returned confident wrong answers:

**1. `/repos/{upstream}/commits/{full_sha}/pulls` → `rows 0`, and that is NOT absence.**
The commit itself exists upstream (`/commits/{sha}` → HTTP 200, date 2026-08-10T13:10:05Z), yet the `/pulls` sub-resource listed zero PRs. A prior report recorded this as "owning PR UNRESOLVED" — i.e. an empty result got promoted to a fact about the world. The PR existed the whole time: **#12449, open, non-draft**. Wrong corpus, not truncation — `per_page` cannot fix it.
Working query for a fork-headed PR:
`/repos/{upstream}/pulls?state=all&head={fork_owner}:{branch}&per_page=100`
That returned exactly 1 row with the live head sha. Use it whenever `head_repository.full_name != repository.full_name`.

**2. `/repos/{upstream}/branches/{branch}` answers HTTP 200 about a DIFFERENT branch.**
For a fork PR the branch name may also exist in the upstream repo. `/branches/fix%2Fissue-11936` on shader-slang/slang returned 200 with sha `1bd0d0fc…` dated **2026-07-03** — five weeks before the run under audit. No error field, no hint of the mismatch. Had I compared the failing sha against it, I'd have concluded "branch head moved past it" from a completely unrelated branch — a fabricated clear. (The 96 runs on `branch=fix/issue-11936` span 7 distinct head shas across two unrelated episodes, July and August — the branch-name axis mixes them.)
The fork's own `/repos/{fork}/branches/{name}` returned **HTTP 401 Bad credentials** — the OneCLI gateway injects per-path and does not cover arbitrary fork repos. So the fork branch tip is not directly readable.

**Substitute instrument that works:** the PR's `head.sha` (from the `?head=owner:branch` query) IS the fork branch tip, as of the PR's `updated_at`. Then `/compare/{old_sha}...{pr_head_sha}` gives the relationship — here `status: ahead, ahead_by: 1`, proving the head genuinely moved past the failing sha rather than being force-push-replaced (a force-push shows `diverged`).

**Generalization:** for any run, resolve identity through the artifact that OWNS the run (its PR), not through a name (branch) that several artifacts can share. A name is not an identity; an empty sub-resource is not an absence. Both failure modes here pointed the same direction — toward "unresolved/still live" in case 1 and toward "cleared" in case 2 — so neither direction is the safe default.

**Truncation discipline that paid off:** on each `?status=failure&per_page=100` sweep, print `total_count`, row count, AND the oldest `created_at` in the page. The after-cutoff window is only trustworthy when the page's oldest row predates the cutoff (slang: page spanned 08-06T17:05:55Z…, cutoff 16:00Z ⇒ window fully contained). `total_count` was 11840 — the page is a tiny tail, so without the oldest-ts check an empty after-cutoff result would carry no information.
