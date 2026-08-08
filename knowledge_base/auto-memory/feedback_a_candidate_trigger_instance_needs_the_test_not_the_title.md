---
name: feedback-a-candidate-trigger-instance-needs-the-test-not-the-title
description: "An issue whose title matches your trigger condition can still not satisfy it; #12384 read as \"layout drift filed\" but is reflection-vs-C++-ABI, both Slang paths agreeing"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2d9038c4-8bf6-4c7f-a7b7-616593be4b73
---

# A title that matches the trigger is not the trigger firing

**Measured 2026-08-07 (slang#12316 / #12384).** The revisit trigger for the parked AST↔IR layout-duplication debt included *"the first filed layout-drift bug."* slang**#12384** — *"CUDA: reflection and PTX disagree on entry-point parameter layout"*, live, labelled `reproduced`, filed the day before — reads as that trigger having fired: two layout numbers disagreeing, reflection on one side.

**It has not fired.** The triager tested rather than pattern-matched, compiling the emitted structs with a host C++ compiler: `sizeof(Empty_0) == 1`, `sizeof(Material_0) == 8` vs reflection's 4. The 8 comes from **nvcc**, because C++ gives an empty object ≥1 byte; reflection's `AddStructField` deliberately skips zero-size fields (`slang-type-layout.cpp:336-340`). So it is **Slang-reflection vs downstream-C++-ABI**, and *both* Slang layout paths compute 0 there — the two paths agree, which is the opposite of drift.

Had this gone unchecked, the published recommendation would have told a maintainer his revisit condition was already satisfied, inverting a "park it" into "act now" on false grounds.

**How to apply:** before accepting any instance as satisfying a trigger you wrote, name the trigger's **discriminating measurement** and run it. Here: *do the two Slang paths disagree with each other?* — not *do two numbers in the bug report disagree?* Overlapping vocabulary between a trigger and a bug title is the weakest possible evidence, and it is the most persuasive-looking.

⭐ **The general shape: a trigger's satisfaction test is not its wording.** Anything phrased as "first bug of kind K" needs an operational test for K, written down beside the trigger, or the next reader matches on keywords.

Related: [[feedback_a_file_touch_trigger_fires_on_noise]], [[project_12316_type_layout_policy_duplication_techdebt]].
