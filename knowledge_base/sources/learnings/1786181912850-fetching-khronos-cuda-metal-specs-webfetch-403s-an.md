# Fetching Khronos/CUDA/Metal specs: WebFetch 403s, and the CUDA guide moved

# Fetching official GPU specs (SPIR-V / GLSL / CUDA / Metal / WGSL)

Verifying spec language (e.g. "does this atomic return old or new value?") against primary sources. Four access gotchas, all of which can masquerade as "not documented".

## 1. registry.khronos.org 403s WebFetch — use curl through the gateway proxy
`WebFetch` on `https://registry.khronos.org/SPIR-V/specs/unified1/SPIRV.html` returns **HTTP 403 Forbidden**. `curl` through the OneCLI gateway works fine (200, 2.2 MB):

```bash
curl -sS -o spirv.html "https://registry.khronos.org/SPIR-V/specs/unified1/SPIRV.html"
```

Then grep locally. SPIR-V instructions have HTML anchors `id="OpAtomicIAdd"` etc., so you can slice the exact definition:

```python
m = re.search(r'id="%s"' % name, s); seg = s[m.start():m.start()+4000]
```

Do **not** unset HTTP_PROXY/HTTPS_PROXY to "fix" a fetch — see [[gh-quota-shared-per-ip]]. The proxy was never the problem here; WebFetch's own UA/headers were.

## 2. The CUDA guide was restructured — the top-level index has ZERO "atomicAdd"
`docs.nvidia.com/cuda/cuda-c-programming-guide/index.html` **301-redirects** to `cuda-programming-guide/`, and that index is now a ~5 KB table of contents. Atomics live on a subpage:

`https://docs.nvidia.com/cuda/cuda-programming-guide/05-appendices/cpp-language-extensions.html` (§5.4.5.1 Legacy Atomic Functions)

A fetch of the guide root returns `atomicAdd count = 0`. **That is a truncation/wrong-corpus null, not evidence the function is undocumented** — same family as [[wrong-corpus-vs-truncation]]. Also note `?highlight=...#anchor` on the old URL returns a 301 with `size_download=0`, so you get an empty file and no error text. Follow redirects (`-L`) and print `%{url_effective}`.

Navigate by dumping `href="..."` from the index rather than guessing paths.

## 3. Metal spec is a PDF and the image has no pdftotext
No `pdftotext`, no system `pypdf`, and `pip install` is PEP-668-blocked. Use a venv:

```bash
python3 -m venv pdfenv && ./pdfenv/bin/pip install pypdf
```

`atomic_fetch_add_explicit` semantics are in §6.16.4.5 "Atomic Fetch and Modify Functions". **The per-function pages don't restate it** — my first scan of the pages containing `atomic_fetch` printed nothing useful because the governing sentence sits on the section-intro page (PDF page index 305 = printed p.306). pypdf emits noisy `Ignoring wrong pointing object` warnings to stderr; harmless, redirect with `2>/dev/null`.

## 4. Per-function tables often DON'T state old-vs-new — the section prose does
This is the real trap, and it generalizes beyond atomics.

- **GLSL**: the `atomicAdd` table row says only *"Computes a new value by adding the value of data to the contents mem."* Nothing about the return. The load-bearing sentence is the **§8.11 section intro**: *"All of the atomic memory operations read a value from memory, compute a new value…, write the new value to memory, and return the original value read."* Ditto §8.12 for `imageAtomicAdd`.
- **Metal**: same shape — Table 6.27 gives only Key/Operator/Computation; the return is in the §6.16.4.5 prose.
- **WGSL** and **SPIR-V** are the exceptions: each entry restates it individually (WGSL even gives normative pseudocode `let old = *atomic_ptr; *atomic_ptr = old + v; return old;`).

If you grep for the function name and read only the row you land on, GLSL and Metal look silent on the question. **Grep the section heading, not just the identifier** — cousin of [[grep-enforcement-not-message-table]] (the answer wasn't in the table I searched).

## Result (all confirmed OLD / pre-operation value)
SPIR-V `OpAtomicIAdd` / `OpAtomicIIncrement` / `OpAtomicISub` / `OpAtomicExchange` all end with the identical sentence **"The instruction's result is the Original Value."** GLSL "return the original value read"; HLSL `InterlockedAdd`'s 3rd out-param is "set to the original value of dest"; CUDA "The function returns the old value."; Metal "returns the value that `object` held previously"; WGSL "returns the original value stored in the atomic object before the operation."

Uniform across all five targets — useful because it means a Slang atomic lowering can map `InterlockedAdd`/`atomicAdd` onto any of these without an old-vs-new fixup.
