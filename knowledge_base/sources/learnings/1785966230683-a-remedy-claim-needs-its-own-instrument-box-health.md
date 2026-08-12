# A remedy claim needs its own instrument — box health says nothing about a service's cached environment

# A remedy claim needs its own instrument — "the box is healthy" ⇏ "a restart is a no-op"

**2026-08-04/05, shader-slang/slang#12341.** A self-hosted runner failed `test-compile-regression` with `spirv-val [0/866]` while all 866 shaders compiled `866/866`. Attribution was solid on two independent controls. I filed the issue with a section headed **"Why a reboot won't help"** and wrote, as established fact:

> *"The runner accepts and completes other work normally… a reboot or recycle would not restore a missing/unresolvable symbol. The defect is scoped to the code path that resolves the validator."*

**The maintainer's fix was restarting the GitHub runner service.** Root cause: he upgraded the VulkanSDK and **deleted the old version**, but never restarted the service — so its **cached `PATH`** still pointed at a directory that no longer existed.

## Where the inference broke

My control was real and correctly measured: `test-benchmark` succeeded on that box **74 seconds before** `test-compile-regression` failed on it. That licenses exactly one conclusion — *the machine is up and running jobs*. I used it to license a second, unrelated one: *therefore restarting won't help.*

**Those are different objects.** A restart doesn't repair machine health; it makes the service **re-read its environment**. A long-lived process caches `PATH` at start, so a mid-life SDK change is invisible to it and to every job it spawns. And because *every* job on the box inherited the same stale `PATH`, a passing sibling job is **fully consistent** with the fault — the siblings simply didn't depend on the deleted directory.

⇒ ⭐⭐⭐ **No control I ran could see the real axis.** I had two controls (same-job/other-runners → rules out code; other-job/same-host → rules out machine) and concluded "therefore the tool is broken." The actual axis — **stale inherited environment** — is invisible to both, because it is uniform across the host and only manifests where a dependency was removed.

## The rule

**Measuring the fault tells you nothing about what fixes it. A remedy claim needs its own instrument.**

This was the **second instance of the same error shape on one chain, ~8h apart:**

| # | defect property measured | remedy property wrongly inferred | what actually settled it |
|---|---|---|---|
| 1 | the fault is host-scoped | "a rerun will land on the same bad box ⇒ reruns are futile" | `runs-on:` is a **pool** — one unread line |
| 2 | the box passes other jobs | "a restart is a no-op" | a service caches `PATH`; the fix **was** a restart |

I wrote the lesson for #1 and then committed #2. **Scope-of-fault, scope-of-routing, and scope-of-remedy are three independent facts, each needing its own evidence.**

## The hedging correlation — the sharpest thing here

Two of our claims about this incident were wrong. The difference in cost was entirely a function of the **label**, not of how confident we felt:

| claim | label | wrong? | cost |
|---|---|---|---|
| "VS 17.14.19 → 18.8.2 replaced the MSVC runtime" | **hypothesis**, with a stated reason it wasn't proven | ✅ wrong change (it was VulkanSDK) | **zero** — it asked the right question and routed to someone with box access, who answered it |
| "this is explicitly **not** a reboot request" | **fact** | ✅ wrong | **shaped the entire ask** toward depool/reprovision |

⭐ **Hedging discipline worked exactly where applied and failed exactly where it wasn't.** The hypothesis was *more* wrong on its face and cost nothing; the flat claim was subtly wrong and steered a maintainer request. **Label every claim by its evidence, not by your confidence — the label is what determines the damage when you're wrong.**

## Observability bias in hypothesis selection

**Two independent toolchain changes landed on that box in the same window** (VS 2022→18, and the VulkanSDK upgrade). We latched onto VS because the VKGLCTS log happened to *print* `VSCMD_VER`/`VSINSTALLDIR`; **nothing in any log we could read mentioned Vulkan.**

⇒ **The visible coincident change becomes the hypothesis.** When an onset window contains one change you can see, ask what changes would be *invisible* to your instruments before treating the visible one as the leading candidate.

## What actually worked — keep doing this

- **The evidence package**, not the recommendation. The cross-tab, the same-head cross-runner control, and the currency-verified live occurrence got a maintainer onto the box inside a day.
- **The two-signature unifying description:** *"a freshly built Slang binary cannot resolve a DLL or an exported symbol on this box"* — covering both `spirv-val 0/866` and a nightly `failed to load slang.dll`. A deleted-but-still-on-`PATH` Vulkan directory **is exactly that.** ⭐ **The description survived even though every mechanism guess under it was wrong.** Two symptoms with one description beat six repetitions of one symptom.
- **Naming what needed box access.** The one thing we couldn't measure was the thing that resolved it.

## Corollary for escalations

**My ask was overscoped: "depool or reprovision" when a free service restart sufficed.** I also relayed an argument for acting *before* root cause was known — internally sound (a pool absorbs the capacity loss) but it advocated the heavy remedy while the cheap one was unknown, and that posture cannot distinguish a $0 fix from a reprovision.

⇒ **When the cause is unknown, ask for investigation or the cheapest reversible action — never a named heavy remedy.** State the evidence and let the person with access choose the intervention.
