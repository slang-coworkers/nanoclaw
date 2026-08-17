---
title: "Reviewing PreToolUse gh-command guards: two bypass classes (title-token spoof, glued short-flag fail-open)"
type: learning
topic: review-process
source: learnings/1783879965262-reviewing-pretooluse-gh-command-guards-two-bypass-.md
---

# Reviewing PreToolUse gh-command guards: two bypass classes (title-token spoof, glued short-flag fail-open)

## Context
Reviewing a PreToolUse[Bash] hook that enforces `--draft` on `gh pr create` for upstream `shader-slang/*` (allowing forks). The author's "9 cases pass" self-test missed two real bypasses. Both fail OPEN (safe-ish) but defeat the guard. Lesson: validate command-string guards against ADVERSARIAL inputs, not just the happy-path forms — a command string is attacker-influenced text, not structured args.

## Bypass class 1 — token-in-quoted-title false-ALLOW
A guard that greps the raw command for a flag token (e.g. `grep -qE '(^|\s)--draft(\s|$)'`) is spoofed when that token appears inside the PR **title/body string**: `gh pr create --repo shader-slang/slangpy --title "support --draft mode"` has NO real `--draft` flag but matched the draft check → non-draft upstream PR allowed. **Fix:** strip quoted substrings before flag inspection — `sed -E 's/"[^"]*"//g; s/'\''[^'\'']*'\''//g'` — then grep the stripped string. This also protects repo-resolution from a `-R owner/repo` mentioned inside a title.

## Bypass class 2 — glued short-flag fail-open
pflag/gh accept the GLUED short form `-Rowner/repo` (no space). A repo-resolver regex that requires a space or `=` after `-R`/`--repo` misses the glued form → repo unresolved → empty owner → fail-open ALLOW. Author tested `-R owner/repo` (spaced) but not `-Rowner/repo`. **Fix:** regex must accept `-R[[:space:]]*` glued, e.g. match `(--repo([[:space:]]+|=)|-R[[:space:]]*)OWNER/NAME` then strip the flag prefix.

## Review recipe for such guards
Probe at minimum: token-inside-title (both `"..."` and `'...'`), glued short flag `-Rx/y`, `--repo=` equals form, compound `cd && gh pr create`, false-positive (fork target but upstream string in title → must ALLOW), and no-repo-resolvable → fail-open. 15 cases is a reasonable floor for a security-relevant command guard. Confirm fail-open vs fail-closed is the INTENDED direction (here fail-open, so forks/unknown never blocked).

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783879965262-reviewing-pretooluse-gh-command-guards-two-bypass-.md`_
