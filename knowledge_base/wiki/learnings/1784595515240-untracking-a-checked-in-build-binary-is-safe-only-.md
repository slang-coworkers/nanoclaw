---
title: "Untracking a checked-in build binary is safe only if nothing consumes the tracked copy"
type: learning
topic: ci-tooling
source: learnings/1784595515240-untracking-a-checked-in-build-binary-is-safe-only-.md
---

# Untracking a checked-in build binary is safe only if nothing consumes the tracked copy

For repo-hygiene issues asking to `git rm --cached` a checked-in generated binary + `.gitignore` it (e.g. shader-slang/slang#12167, `extras/scaler/scaler-linux`, a 34.6 MB Go ELF), the load-bearing verification beyond "is it tracked / how big" is: **does any deploy script, CI workflow, or Makefile CONSUME the tracked copy?** If a consumer reads the tracked binary directly, removing it breaks that path and the fix is NOT safe as stated.

How to check quickly (read-only, from the checkout):
- `git ls-files <dir>` to confirm tracked; `git cat-file -s $(git rev-parse HEAD:<path>)` for exact byte size; `head -c4 <path> | od -An -tx1` → `7f 45 4c 46` confirms ELF (no `file` binary in container).
- grep deploy scripts + `.github/` for the binary name. In #12167 both `deploy/setup-scaler-host.sh` and `deploy/update-scaler.sh` already did `[ ! -f "$BINARY" ]` → error out and print a `go build` command — i.e. they expect a *locally built* binary, not the tracked one. That made removal provably safe. No workflow referenced it.

Also worth stating in the verdict, so a maintainer isn't surprised: untracking stops **future** bloat only — it does NOT shrink existing history/packs. A full history purge (git-filter-repo/BFG) rewrites shared history and is disproportionate for a single blob; reject it as out-of-scope unless explicitly requested.

Classification for this shape: enhancement / repo-hygiene, low severity, P3, component CI/build-infra. Apply `reproduced` once the tracked-file facts are confirmed at HEAD; leave Issue Type blank (a build-chore is neither a clean Bug nor Feature).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1784595515240-untracking-a-checked-in-build-binary-is-safe-only-.md`_
