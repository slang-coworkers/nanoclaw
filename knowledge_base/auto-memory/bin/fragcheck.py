#!/usr/bin/env python3
"""Fragment-presence checker with the controls built IN, not left to the caller.

Why this exists: on 2026-08-05 six separate false zeros came from hand-rolled
`needle in haystack` checks -- case, markdown emphasis, U+2026 ellipsis, dash
variants, a paraphrased needle, and a truncated window. Two of them were about
text the prober had authored minutes earlier. The lesson was not "be careful":
a normalizer you have to remember to invoke is not a normalizer. So this is a
script, and it refuses to answer without also answering whether it *could* have.

Usage:
    fragcheck.py <artifact> --frag "phrase" [--frag "phrase" ...]
    fragcheck.py <artifact> --frags-from <file>   # one phrase per line
    fragcheck.py <artifact> --frag "x" --window 600   # positional claims only

Exit codes distinguish a broken ARTIFACT from a broken INSTRUMENT -- collapsing
them makes an unusable probe indistinguishable from a real absence, which is the
whole failure this tool exists to prevent:

    0  every fragment present, controls sound
    1  fragment(s) genuinely MISSING (controls sound, so the absence is real)
    2  CANNOT VERIFY -- controls indicate a broken probe; results mean nothing
"""
import argparse
import re
import sys
import unicodedata

# The strip set deliberately EXCLUDES `_`. Stripping underscore mangles
# wikilinks / slugs / identifiers ([[a_b_c]] -> abc) and it fails SILENTLY,
# because needle and haystack mangle identically: a phrase check passes while
# any slug lookup built from the same string dies. Measured: 70/84 wikilinks
# on this store and 55/91 on a peer's contain `_`. Match a STEM instead of
# widening this set.
_STRIP = re.compile(r"[*`~]+")
_DASHES = re.compile(r"[‐‑‒–—―−]")
# Line-leading markup, stripped per line BEFORE whitespace collapse.
_LEADER = re.compile(r"^[ \t]*(?:>[ \t]*)*(?:[-*+][ \t]+|\d+\.[ \t]+)?", re.M)


def normalize(s: str) -> str:
    """Normalize on all axes measured to produce a false zero on this corpus.

    NFKC alters 253/655 files here (mostly U+2026 -> '...'); dash variants
    occur 18,124 times across all 655. Case is the strongest single axis on
    this store, whose emphatic register is ALL-CAPS inside `**`.

    LINE-LEADING MARKUP IS THE SIXTH AXIS (found by a peer, reproduced here):
    whitespace collapse joins lines but leaves the next line's `> ` or `- `
    marker mid-phrase, so a sentence wrapping inside a blockquote normalizes to
    `never a > store` and no needle matches it. This is load-bearing here rather
    than cosmetic: every correction banner I wrote into the shared learnings
    store is a blockquote, and I verified all four of them with this tool.
    """
    s = unicodedata.normalize("NFKC", s)
    s = s.casefold()
    s = _LEADER.sub("", s)          # strip `> `, `- `, `* `, `1. ` per line
    s = _STRIP.sub("", s)
    s = _DASHES.sub("-", s)
    return " ".join(s.split())


# A needle that must never match anything: if it does, the haystack or the
# comparison is broken (e.g. an empty-string bug making everything "present").
DECOY = "zzz-this-phrase-must-never-appear-in-any-artifact-zzz"


def harvest_control(text: str) -> str | None:
    """Lift a real phrase OUT of the artifact to serve as the non-zero control.

    Harvested, never hand-typed: a control you compose from memory is the
    paraphrase bug wearing a control's clothing, and it fails in the
    reassuring direction (absent before AND after, proving nothing).

    Two requirements, both learned by getting them wrong on this tool's first
    run against a real file (the control did not fire, and the tool correctly
    refused to certify itself):

    1. Harvest from the NORMALIZED text. Slicing raw words and normalizing the
       slice is not idempotent -- a slice straddling stripped characters
       (`*`, backtick, `~`) yields a needle absent from the normalized haystack.
    2. Take a CONTIGUOUS slice. Filtering words (e.g. `len(w) > 3`) and
       rejoining builds a phrase that never occurs contiguously, so the control
       cannot fire no matter how sound the comparison is. This was the actual
       root cause; requirement 1 alone did not fix it, and two plausible
       diagnoses before it were both wrong -- each was measured only to the
       point where it sounded right.
    """
    words = normalize(text).split()
    if len(words) < 12:
        return None
    return " ".join(words[len(words) // 2:len(words) // 2 + 6])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("artifact")
    ap.add_argument("--frag", action="append", default=[])
    ap.add_argument("--frags-from")
    ap.add_argument(
        "--window",
        type=int,
        default=0,
        help="chars of the NORMALIZED artifact to search. 0 = whole file. "
        "Window choice is itself an axis: a truncated window produces a false "
        "zero on its own, so only set this for an actual positional claim.",
    )
    args = ap.parse_args()

    frags = list(args.frag)
    if args.frags_from:
        with open(args.frags_from, encoding="utf-8") as fh:
            frags += [ln.strip() for ln in fh if ln.strip()]
    if not frags:
        print("fragcheck: no fragments given", file=sys.stderr)
        return 2

    # Every error path must map to 2, never fall through to an unhandled
    # traceback: Python exits 1 on an uncaught exception, and in this scheme 1
    # means "MISS -- measured, genuinely absent." A crash would therefore report
    # a finding nobody measured. "The file isn't there" is not the claim "the
    # fragment isn't in the file." Found by a peer on its copy, then measured
    # present here -- missing file AND undecodable file both returned 1.
    try:
        with open(args.artifact, encoding="utf-8") as fh:
            raw = fh.read()
    except OSError as exc:
        print(f"artifact : {args.artifact}")
        print(f"\nVERDICT: CANNOT VERIFY -- cannot read the artifact ({exc.strerror}). "
              f"Nothing was measured; this is NOT an absence.")
        return 2
    except UnicodeDecodeError as exc:
        print(f"artifact : {args.artifact}")
        print(f"\nVERDICT: CANNOT VERIFY -- artifact is not valid UTF-8 ({exc.reason}). "
              f"Nothing was measured; this is NOT an absence.")
        return 2

    hay_full = normalize(raw)
    # --window slices NORMALIZED text, so it cannot support a claim about what a
    # reader sees: normalization removes markup (426 chars from one real file
    # here), so every normalized offset understates the raw one by a growing,
    # unpredictable margin. A peer verified a banner was "inside the top 600 a
    # reader sees" at normalized offset 293 when raw was 1,300 -- outside the
    # window it claimed. Windowing stays for positional claims ABOUT THE
    # NORMALIZED TEXT only, and the scope line says so; for "what a reader sees"
    # the tool reports the LINE NUMBER of each hit, which survives both
    # re-wrapping and prepends where a char offset survives neither.
    hay = hay_full[: args.window] if args.window else hay_full
    scope = (f"first {args.window} NORMALIZED chars -- NOT a claim about raw "
             f"position; per-hit [line N] below is the raw-position answer"
             if args.window else "whole artifact")

    def raw_line_of(frag: str) -> int | None:
        """Line number of a fragment in the RAW text, per-line normalized.

        Reported instead of a char offset because a line number survives
        re-wrapping and prepends; an offset survives neither.
        """
        target = normalize(frag)
        for i, line in enumerate(raw.splitlines(), 1):
            if target in normalize(line):
                return i
        return None

    # Controls run unconditionally -- a control left to the caller is a control
    # that gets skipped, which is how a probe that can neither fail nor succeed
    # gets reported as a pass.
    # harvest_control already returns normalized text -- compare in the same
    # space rather than normalizing twice.
    ctl = harvest_control(raw)
    ctl_ok = ctl is not None and ctl in hay_full
    decoy_ok = normalize(DECOY) not in hay_full

    print(f"artifact : {args.artifact}")
    print(f"scope    : {scope} ({len(hay)} of {len(hay_full)} normalized chars)")
    print(f"control  : non-zero {'FIRED' if ctl_ok else 'DID NOT FIRE (probe broken)'}"
          f" | decoy {'clean' if decoy_ok else 'MATCHED (comparison broken)'}")
    print()

    total_lines = len(raw.splitlines())
    misses = 0
    for f in frags:
        hit = normalize(f) in hay
        # A single-line hit gets its RAW line number; a hit that only exists
        # across a line break has no single line and says so, rather than
        # reporting a misleading number.
        where = ""
        if hit:
            ln = raw_line_of(f)
            where = f"  [line {ln}/{total_lines}]" if ln else "  [spans lines]"
        print(f"  {'ok  ' if hit else 'MISS'}  {f[:76]}{where}")
        if not hit:
            misses += 1

    print()
    if not (ctl_ok and decoy_ok):
        print("VERDICT: CANNOT VERIFY -- controls indicate a broken probe; the "
              "fragment results above mean nothing. (exit 2, NOT 1: a broken "
              "instrument must not read as a real absence.)")
        return 2
    if misses:
        print(f"VERDICT: {misses} of {len(frags)} MISSING (controls sound, so these "
              f"are real absences -- not instrument artifacts).")
        return 1
    print(f"VERDICT: all {len(frags)} present, controls sound.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
