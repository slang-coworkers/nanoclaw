---
title: "Byte-exact .slang test fixtures need `text eol=lf` in .gitattributes or they fail on Windows CI (CRLF)"
type: learning
topic: slang-compiler
source: learnings/1784845596400-byte-exact-slang-test-fixtures-need-text-eol-lf-in.md
---

# Byte-exact .slang test fixtures need `text eol=lf` in .gitattributes or they fail on Windows CI (CRLF)

A `.slang` FileCheck test whose correctness depends on an EXACT byte offset (e.g. positioning a multi-byte UTF-8 code point to straddle the 65535-byte SPIR-V string-literal split) passes on Linux/macOS but **fails deterministically on Windows CL CI** — because `.slang` has no git `eol` attribute, so the Windows runner checks the file out as CRLF. Every `\n`→`\r\n` above the marker adds a byte, shifting the target offset (seen 2026-07-23, slang#12202: ~977 newlines shifted `é` from byte 65534 to 66501 → +967 → past the boundary → `CHECK-DAG: OpSourceContinued "é` not found → 99% passed / 1 real failure on windows-debug + windows-release CL).

Fix: pin the fixture to LF in the root `.gitattributes` (precedent: `*.sh text eol=lf`):
```
tests/spirv/my-byte-exact-fixture.slang text eol=lf
```
This forces LF in the working tree on ALL platforms regardless of `core.autocrlf`, so the byte layout is identical everywhere. Verify the attribute with `git check-attr text eol -- <path>` (must pass `--` or it misreports `eol: unspecified`).

How to detect/reproduce WITHOUT a Windows box: `sed 's/$/\r/' lf-copy.slang > crlf-copy.slang` then run it through slang-test — it reproduces the exact `:NNN:15 CHECK-DAG expected string not found` Windows failure. Confirm the LF original passes.

Broader rule: any test that hard-codes an absolute byte offset is fragile (CRLF, comment reflow, formatting all shift it). Prefer content-anchored matches where possible; when an exact offset is unavoidable, `text eol=lf` is mandatory AND leave a comment in the file explaining the byte invariant. A test that only needs to EXCEED a threshold (e.g. >65535 to force a continuation) is safe under CRLF (which only grows the file) and doesn't need the pin.

Signature to recognize: "deterministic, Windows-CL-only (both debug+release), 1 test failure, x86_64 — and the failing CHECK is a byte-position-dependent pattern." Not a flake, not a rerun-clearable issue.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784845596400-byte-exact-slang-test-fixtures-need-text-eol-lf-in.md`_
