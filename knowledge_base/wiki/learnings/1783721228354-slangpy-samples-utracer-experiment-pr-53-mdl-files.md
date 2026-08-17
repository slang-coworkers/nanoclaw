---
title: "slangpy-samples utracer experiment (PR #53): MDL files are generated/vendored; verify LFS + rename cleanliness"
type: learning
topic: slang-compiler
source: learnings/1783721228354-slangpy-samples-utracer-experiment-pr-53-mdl-files.md
---

# slangpy-samples utracer experiment (PR #53): MDL files are generated/vendored; verify LFS + rename cleanliness

Reviewing slangpy-samples#53 ("Add neural.slang UTracer experiment", experiments/neural_slang/utracer/) surfaced reusable facts for this repo/PR family:

**MDL material files are generated/vendored — do NOT hand-review.** `materials/ceramic/mdl_ceramic_material.slang` (3492 lines) is machine-generated MDL target code (Itanium-mangled names `_ZN4base...`, auto-numbered `structtype0`/`glob_cnst452`, inline 256-entry permutation tables); only the tail `MDLCeramicMaterialInstance` wrapper (~last 190 lines) is hand-written glue exposing `IMaterialInstance` (`eval`/`collect_properties`). `materials/mdl_runtime.slangh` + `mdl_target_code_types.slangh` carry explicit "adapted from the MDL SDK DXR example" provenance headers. Classify these as vendored; deep-reviewing 3.5k lines of generated code wastes a subagent.

**Verify LFS objects actually resolve (dangling pointer = non-runnable sample).** A checked-out repo shows LFS files as ~130-byte `version https://git-lfs.github.com/spec/v1` pointers when cloned with `GIT_LFS_SKIP_SMUDGE=1`. Extract each `oid sha256:`+`size` and POST to `https://github.com/<owner>/<repo>.git/info/lfs/objects/batch` (Accept/Content-Type `application/vnd.git-lfs+json`, `Authorization: Bearer $(gh auth token)`, body `{"operation":"download","transfers":["basic"],"objects":[{oid,size}]}`). `actions.download` present == object exists on remote. All #53 assets (.glb/.hdr/material .jpg/.png) resolved. Note `*.bin` is NOT in .gitattributes so small binaries commit directly (ceramic_material_data.bin = 2052 B).

**Zero CI is the norm for experiments/, not a regression.** slangpy-samples CI = only pre-commit.yml + issue-sync; `tests/examples/test_examples.py` sets `EXAMPLES_DIR = repo/examples` and enumerates test_* entries explicitly. Anything under `experiments/` (brdf, mipmap, tinybc, neuralmaterials, neural_slang, …) gets zero CI. A rename from examples/ → experiments/ (as #53 does for the latent_texture demo) loses no coverage IF the demo wasn't already a test_examples entry — check `git show main:tests/examples/test_examples.py`.

**Gradient-accumulation hazard did NOT apply here.** The prior neural-demo "`.set`→`.add`" learning is about direct tensor writes; #53 delegates gradient accumulation to `slang.neural` via `DifferentialPtrPair<PointerAddress<float>>` (atomic add), so a full batch×batch grid into one gradient buffer is safe. Verified, not assumed.

Verdict: APPROVE_WITH_NITS, 0 bugs. diff_hash 4e4a9ba3... at commit e5a18be.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783721228354-slangpy-samples-utracer-experiment-pr-53-mdl-files.md`_
