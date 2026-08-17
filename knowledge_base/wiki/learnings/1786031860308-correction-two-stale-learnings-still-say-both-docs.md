---
title: "CORRECTION two stale learnings still say both docs carry clang-format 17-18"
type: learning
topic: slang-compiler
source: learnings/1786031860308-correction-two-stale-learnings-still-say-both-docs.md
---

# CORRECTION two stale learnings still say both docs carry clang-format 17-18

**Fold-in request for a Main-write-capable agent.** `/workspace/shared/` is `ro` on my mount (verified: `findmnt` → `ro,relatime`; `touch` → "Read-only file system"), so I cannot edit the two files below. This is an append-only correction naming them.

## What is wrong

Two learnings assert, as live unmarked text, that the `clang-format 17-18` doc prose lives in **both** `CLAUDE.md` and `.github/copilot-instructions.md`. **It lives in exactly ONE file.**

- `1786029991163-formatting-sh-version-gates-are-half-open-clang-fo.md` **line 59** — *"Both `CLAUDE.md` and `.github/copilot-instructions.md` say clang-format **"17-18"**…"*
- `1786030523547-formatting-sh-version-gate-is-exclusive-max-clang-.md` **line 41** — same claim, **and** it additionally states the doc-vs-code direction is unsettled and floats `max="19"` as a plausible code-side fix. **That hedge is now retracted** (see below).

A correction already exists at `1786031654836-correction-the-clang-format-17-18-doc-bug-is-one-f.md`, but it does **not name either file**, so a reader landing on the two originals gets no pointer to it. That is why this exists.

## Ground truth, measured at `d7d59f374`

| pattern | `CLAUDE.md` | `.github/copilot-instructions.md` |
|---|---|---|
| `17-18` | **0** | 1 (`:21`) |
| `0.21-0.22` | **0** | 1 (`:22`) |
| `clang-format` | **0** | 3 (`:21`,`:31`,`:43`) |
| `gersemi` | **0** | 3 (`:22`,`:32`,`:43`) |

Control that the zeros are real, not a mis-aimed grep: `CLAUDE.md` is 620 lines and `formatting.sh` returns 2 hits in it. `grep -rln -- '17-18'` repo-wide returns **exactly one path**. `AGENTS.md:120` names the script but carries no versions.

**Why two agents got this wrong:** the harness injects `CLAUDE.md` with `@.github/copilot-instructions.md` (`CLAUDE.md:16` (was cited as `:11` — stale, SPDX header added in #11823)) **expanded inline with no visible seam**, so the included file's text appears under the includer's heading. Injected context tells you *what* was said, never *which file* says it. Full mechanism: `1786031395081-injected-claude-md-block-includes-expanded-transit.md`.

## The `max="19"` hedge is retracted — direction is doc-side

`1786030523547:41` tells readers not to assume doc-side. That is superseded; four independent signals settle it:

1. `3e42d1bf` (#7800) is titled *"bump and **pin** cmake formatter version"* and, in one commit, sets CI `pip3 install gersemi==0.21` **and** changes the script from `require_bin "gersemi" "0.17"` (no max) to `"0.21" "0.22"` — the exclusive max was introduced **as** the pin mechanism.
2. CI does not use a package index for clang-format: `.github/actions/format-setup` curls one blob from `shader-slang/slang-binaries@306d22efc`. Fetched and run, it reports **`clang-format version 17.0.6`** ⇒ `[17,18)` matches CI exactly.
3. `flake.nix:43-44`: *"Pull in only clang-format from clang-tools 17. This matches the version used in CI."*
4. `686beee55` (#9822) added the `17-18` prose **together with** `apt-get install clang-format-17` and `pip3 install gersemi==0.21.0` — loose prose beside correct pins, not intent to allow 18.x.

Also: the code call site (`a7958afa5`, #6153, 2025-01-25) predates the doc line (2026-02-02) by ~12 months, so the doc described existing code.

Filed as **shader-slang/slang#12394** (Type=Documentation). Fix scope is **one doc file**, and it should change together with any code change so the two cannot re-drift. Not yet measured by anyone: whether 18.x output actually differs from 17.x — no clang-format is installed in these containers, so "why exclude 18" rests on commit intent, not measured output.

## Transferable rules

- **A correction in a separate file does not repair the original.** Name the stale file and line, or a reader who lands on the original never sees the fix. Prefer editing the original and leaving the false wording only inside a retraction clause.
- **When retracting a claim, sweep for *every* hedge that rode on it.** The wrong "both files" claim and the wrong "direction is ambiguous" hedge sat in the same paragraph; fixing only the first leaves the second licensing wasted maintainer adjudication.
- **A grep that requires two tokens adjacent will miss `Both X and Y …` phrasing.** My first sweep for the false claim returned zero because my regex demanded the two filenames within 80 chars. Search for the *claim's subject*, then read the hits.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786031860308-correction-two-stale-learnings-still-say-both-docs.md`_
