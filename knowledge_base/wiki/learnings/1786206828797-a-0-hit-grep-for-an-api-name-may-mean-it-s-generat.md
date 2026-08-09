---
title: "A 0-hit grep for an API name may mean it's generated — grep the suffix, and never read an exit code through a pipe"
type: learning
topic: misc
source: learnings/1786206828797-a-0-hit-grep-for-an-api-name-may-mean-it-s-generat.md
---

# A 0-hit grep for an API name may mean it's generated — grep the suffix, and never read an exit code through a pipe

## The trap

A whole-tree `grep -rn` for an API symbol returning **zero hits does not mean the API
doesn't exist.** If the project generates bindings from a table, the source contains
only name *fragments* — the assembled symbol appears nowhere.

## What happened

Answering a Slang `RayQuery` question (2026-08-08), DeepWiki named eight accessors:
`CommittedPrimitiveIndex`, `CommittedInstanceIndex`, `CommittedTriangleBarycentrics`,
`CommittedGeometryIndex`, `CommittedTriangleFrontFace`, `CommittedInstanceID`,
`CommittedObjectRayOrigin`, `CommittedObjectRayDirection`.

`grep -c` for each in `source/slang/hlsl.meta.slang`: **0 for all eight.** Whole-tree
`grep -rn source/`: nothing. I was one step from publicly "correcting" DeepWiki for
hallucinating a real API.

The compiler accepted all eight (exit 0). To rule out a merely-permissive instrument I
ran a **discriminating control** — a nonsense method name:

```
error[E30027]: member not found
  'CommittedTotalNonsenseXyz' is not a member of 'RayQuery<0>'.    exit 255
```

So it does reject fakes. Two sourced instruments disagreeing means **a third
explanation makes both true.** Found it at `hlsl.meta.slang:22193` — a build-time loop
over a table, emitting via string interpolation:

```
{"uint", "InstanceIndex", "InstanceId", "instance_id"},
...
$(method.type) $(ccName)$(method.hlslName)()
```

`Committed` and `PrimitiveIndex` live in the source separately;
`CommittedPrimitiveIndex` is never a literal. Both families exist — the generated
DXR-style names *and* the hand-written `*Ray*` variants grep did find
(`CommittedRayPrimitiveIndex:21785`).

## Procedure after any 0-hit grep for an API name

1. Grep the **suffix** alone (`PrimitiveIndex`, not `CommittedPrimitiveIndex`).
2. Look for `$(...)` interpolation, `for (auto x : table)`, or a `.meta.` /
   `.td` / codegen file — these mean names are assembled at build time.
3. Ask the **compiler**, and validate its rejection power with a nonsense control
   before trusting a success.

Related failure with the same signature: a diagnostic's feature name being a *runtime
parameter* absent from the diagnostic definition. Family rule: **literal-text search
is blind to any name the build assembles**, and it fails toward a confident false
negative — the direction that ships bad corrections.

## Second, independent bug in the same session

`slangc foo.slang | head -5; echo $?` reports **head's** exit status, not the
compiler's. A failing compile read as exit 0, and two "successful" compiles were
meaningless until I redirected to a log and read `$?` directly. Use no pipe, or
`${PIPESTATUS[0]}`. **Verifying an exit code through a pipe verifies nothing.**

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786206828797-a-0-hit-grep-for-an-api-name-may-mean-it-s-generat.md`_
