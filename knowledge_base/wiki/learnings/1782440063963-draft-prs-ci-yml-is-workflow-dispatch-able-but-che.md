---
title: "Draft PRs: ci.yml IS workflow_dispatch-able, but check-formatting.yml is NOT — verify format locally with clang-format 17"
type: learning
topic: slang-compiler
source: learnings/1782440063963-draft-prs-ci-yml-is-workflow-dispatch-able-but-che.md
---

# Draft PRs: ci.yml IS workflow_dispatch-able, but check-formatting.yml is NOT — verify format locally with clang-format 17

shader-slang/slang gates auto (pull_request) CI on `draft != true`, so a bot DRAFT PR shows every check "skipping". Two consequences, and how to handle each:

1. **Functional CI (ci.yml) CAN run on a draft** via `gh workflow run ci.yml -R shader-slang/slang --ref fix/issue-<n>` — `workflow_dispatch` is NOT subject to the `draft != true` filter, so this runs the full build/test/sanitizer matrix on the draft head. (This is the already-mandated dispatch from CLAUDE.local.md; it genuinely works on drafts. Verify with `gh run view <id> --json jobs` — the `filter` job shows `success`, not `skipping`.)

2. **check-formatting.yml CANNOT run on a draft.** It is `pull_request`-only with `if: ... github.event.pull_request.draft != true` and has NO `workflow_dispatch` trigger. So the clang-format check never runs on a draft, and `gh pr ready` is operator-gated. Don't "rely on CI's format check" for a draft — verify locally:
   - `pip install --break-system-packages "clang-format==17.0.6"` (installs to ~/.local/bin; add to PATH). MUST be 17.x: `extras/formatting.sh` requires range [17,18) and rejects 18.x as "too new".
   - Authoritative C++-only check (independent of gersemi/shfmt absence): `clang-format --dry-run --Werror <file>` per changed .cpp — empty output + rc 0 = clean.
   - Note: `extras/formatting.sh --check-only` exits non-zero merely because gersemi/shfmt are absent in the container, even when clang-format passes — so isolate clang-format with the per-file dry-run rather than trusting the script's overall exit code.
   - `.slang` files are NOT formatted by any tool in formatting.sh; only .cpp/.cmake/.sh/.md/.yaml/.json are. A pure compiler-fix + .slang-test PR only needs clang-format.

Container note: `clang-format`/`gersemi`/`shfmt` are all absent by default; only `prettier` is present.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782440063963-draft-prs-ci-yml-is-workflow-dispatch-able-but-che.md`_
