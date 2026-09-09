---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786966663639-3y1j9a
written_at: 2026-08-19T14:29:11.727Z
---

# [approver/human-disagreement] OPEN_GAP on a fatal-but-VERIFIED-UNREACHABLE defensive assert was overruled — humans merged; discriminator vs the vindicated latent-BLOCK is reachability + who controls the trigger

## Case
shader-slang/slang#12539 (Fix #12535, unorm/snorm layout-transparency). I decided **ABSTAIN_POLICY/OPEN_GAP** @ `d9ce4ff5d65d` over the PR's new `SLANG_RELEASE_ASSERT(attr==NoDiff||UNorm||SNorm)` at `slang-ir-layout.cpp:502-508` — release-fatal on any other attributed type, on a layout-transparent (by-premise "harmless") property. I explicitly did NOT block (traced not-reachable by a complete enumeration of all 14 `getAttributedType` sites + 3 frontend modifier→attr handlers; `NonUniformAttr` is a spec-cache-key token, never a value type), but did NOT clear either (fatal-by-construction + the PR's own process report argues a whitelist is wrong then the code implements one + two reviewers converged on the site).

## Join (human outcome)
PR **MERGED** 2026-08-19 by jvepsalainen-nv at head `f7be9557727c`; **APPROVED** by jkiviluoto-nv (review pinned to the merged head). Merged head = my decided `d9ce4ff5` + 12 PURE master-catchup commits (ahead 12/behind 0; interval touches NONE of the PR fix files). Verified the flagged guard shipped **UNCHANGED** at the merged head (`:505-507`). ⇒ **DISAGREEMENT: my abstain vs human approve+merge with the guard as-is.**

Scored against the FALSIFIABLE reading (per the standing rule): not the tautological "a human must look" (any abstain satisfies that), but "material enough NOT to merge as-is." A clean human approve at essentially my decided code **refutes** the material claim ⇒ this is a **conservative / false abstain** (milder than a false-safe — I declined to approve, I did not approve a rejected change; same family as slangpy#1082 `1785504649372`).

## The discriminator (this vs the VINDICATED latent-BLOCK `1784141964975`)
Both were "latent" defensive-guard findings; opposite outcomes. The difference is **reachability + who controls the trigger**, not latency:
- **`1784141964975` (BLOCK vindicated):** a host payload built at a **metadata-reported offset** with no lower-bound check. Latent on today's layout, but the offset is **EXTERNAL INPUT** (compiler metadata that changes across versions/targets) — the trigger is outside the code's control, so "works now" isn't validation. Author added the exact guard. → block-worthy.
- **#12539 (OPEN_GAP overruled):** a fatal assert whose trigger is **INTERNAL** — it fires only if some *other compiler pass* attaches a non-{NoDiff,UNorm,SNorm} attr to a value type, which a complete producer enumeration showed nothing does. The trigger is fully under the compiler's own control and provably absent today. Humans judged "unreachable + fail-loud (a defined abort beats master's `SLANG_ASSERT`→`SLANG_ASSUME` UB)" acceptable, and did NOT treat the PR-rationale-vs-code contradiction as merge-blocking.

## Transferable calibration
When a diff adds/hardens a **fail-loud guard** (esp. `SLANG_ASSERT`→`SLANG_RELEASE_ASSERT`) on an invariant whose trigger is INTERNAL to the compiler and you have **verified-unreachable via complete producer enumeration**: lean toward **advisory/clear**, not OPEN_GAP. A fail-loud guard on a can't-happen-today shape is defensive coding maintainers routinely accept; the residual "a future pass might violate it" is exactly what the assert exists to catch loudly. Reserve OPEN_GAP/BLOCK for guards whose trigger is **EXTERNAL/attacker-or-metadata-controlled** (the `1784141964975` shape) or **verified-reachable on a supported path**. The PR-description-contradicts-code point and "two reviewers flagged it" are real quality signals but are **advisory** on their own — they raise a comment, not a merge block. My abstain over-weighted them. Net: correct not to approve blindly, but the conservative-lean cost a false-abstain here; the sharper call was advisory-clear with the gap surfaced as a comment for the human.
