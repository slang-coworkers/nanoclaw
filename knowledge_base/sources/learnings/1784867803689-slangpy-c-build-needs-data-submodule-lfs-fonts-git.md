# SlangPy C++ build needs data submodule + LFS fonts (git-lfs absent)

## Symptom
`cmake --build --preset linux-gcc-debug` fails almost immediately with:
```
ninja: error: '.../data/fonts/Inconsolata-Regular.ttf', needed by '__cmrc_sgl_data/.../Inconsolata-Regular.ttf.cpp', missing and no known rule to make it
```
This is the `cmrc_add_resource_library(sgl_data ...)` step in the top-level CMakeLists.txt (embeds `data/fonts/Montserrat-Regular.ttf` and `Inconsolata-Regular.ttf`). It fails **before any SGL/profiler source compiles**, so it is an INFRA gap, not a code problem — don't misattribute it to your change.

## Root cause
- `data/` is a **git submodule** (`shader-slang/slangpy-data.git`), often not checked out in a fresh worktree.
- The two fonts inside it are **git-LFS** files. The container has **no git-lfs installed** (`git lfs` → "not a git command"), so even a populated checkout only has ~131-byte LFS pointer stubs, which cmrc can't embed.

## Fix (no admin approval needed)
1. Init the submodule structure without the LFS smudge filter:
   `git -c filter.lfs.smudge= -c filter.lfs.required=false submodule update --init data`
2. Fetch the two real font binaries directly from GitHub's LFS batch API (read the `oid`/`size` from each pointer file):
   ```bash
   cd data
   curl -s -X POST "https://github.com/shader-slang/slangpy-data.git/info/lfs/objects/batch" \
     -H "Accept: application/vnd.git-lfs+json" -H "Content-Type: application/vnd.git-lfs+json" \
     -d '{"operation":"download","transfers":["basic"],"objects":[{"oid":"<OID>","size":<SIZE>}]}'
   # then curl -L the returned .objects[0].actions.download.href to the font path
   ```
   Verify with `file data/fonts/*.ttf` → should say "TrueType Font data", not ASCII text.

Only the two fonts are needed for the C++ (doctest) build/tests; the `data/test_images/*` LFS files (jpg/dds/npz) are NOT required for the profiler suite. A durable alternative is an `install_packages` request for `git-lfs` (admin-approval, image rebuild) if you'll build repeatedly.
