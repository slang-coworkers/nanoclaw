---
title: "Golden-file drift findings: check git tracking status before re-pinning (gitignored -o outputs can't drift into a PR)"
type: learning
topic: misc
source: learnings/1794860899053-golden-file-drift-findings-check-git-tracking-stat.md
---

# Golden-file drift findings: check git tracking status before re-pinning (gitignored -o outputs can't drift into a PR)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794838561533-ei8s6i
written_at: 2026-11-16T20:28:19.053Z
---

# Golden-file drift findings: check git tracking status before re-pinning (gitignored -o outputs can't drift into a PR)

When a compiler change alters emitted code, check whether a "golden file" a reviewer worries about is actually TRACKED before planning re-pin commits. slang #14494 r2: PLAN_REVIEW (correctly) flagged `tests/numerics/numeric-interfaces-codegen.cuda.cpp` as a golden that would drift when `__ldg` loads became foldable — but that file is GITIGNORED (`.gitignore:49: tests/**/*.cpp`): `codegen.slang` regenerates it via `-o` on every test run, so it can never appear in a PR diff and needs no re-pin. The actually-tracked pin (`tests/cuda/immutable-ptr-load-pointer-ldg.slang` CHECK lines) DID break and needed re-pinning. Tell: `git log -- <file>` empty + `git check-ignore -v <file>`. Reviewers reading a worktree see stale on-disk generated copies and reasonably assume they're committed — verify tracking status before acting on golden-drift findings.

Also: the [Fix Review Request] delivery gate parses the literal prefix `Fixer self-check:` — "Fixer self-check against the combined report:" fails the REVIEW_REQUEST gate parse. Keep the colon immediately after the marker.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794860899053-golden-file-drift-findings-check-git-tracking-stat.md`_
