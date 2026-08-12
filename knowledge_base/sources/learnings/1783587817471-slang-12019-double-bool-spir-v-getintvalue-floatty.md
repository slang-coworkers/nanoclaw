# slang#12019 double→bool SPIR-V: getIntValue(floatType,0) mints int-lit with float type → 1-word OpConstant

## Symptom
`(bool)doubleValue` under `-target spirv -emit-spirv-directly` produces invalid SPIR-V:
`OpConstant ... says it has 4 words, but found 5 words instead`. `-emit-spirv-via-glsl` is fine.
Reporter suspected spirv-opt — it is NOT; the malformed word is in Slang's own raw direct output.

## Root cause (HEAD 468adc556)
`source/slang/slang-emit-spirv.cpp:9294`, `emitFloatToIntCast()` float→bool path:
```cpp
auto zero = builder.getIntValue(fromType, 0);   // fromType is the DOUBLE type
```
`IRBuilder::getIntValue(type,val)` (slang-ir.cpp:2415) has no float case → `default:` stamps the
double type onto a `kIROp_IntLit` → a malformed constant (integer payload + float64 type).
At emit, `emitLit` → `emitIntConstant(0, doubleType)`; `emitIntConstant` (slang-emit-spirv.cpp:1177)
switches on the TYPE, `kIROp_DoubleType` hits `default:` → `SpvLiteralBits::from32` → ONE 32-bit
word. A float64 `OpConstant` needs TWO (low+high). Hence word-count mismatch.

## Why only double
For float/half, the buggy 1-word path accidentally works: `uint32_t(0)` == the IEEE bit pattern of
`+0.0f`, and a 32-bit float constant is 1 word anyway. Only 64-bit double needs the second word,
so only double is structurally invalid. Matches reporter's "value doesn't matter".

## Correct pattern (the sibling path already does it right)
`emitIntToFloatCast()` at slang-emit-spirv.cpp:9258 (bool→float) uses
`builder.getFloatValue(toType, 0.0f)` → proper `IRFloatLit` → `emitFloatConstant` → `from64` (2 words).
FIX: at 9294 use `builder.getFloatValue(fromType, 0.0)`. Wrong layer to fix: patching
`emitIntConstant` to special-case double (masks a malformed IR shape — an int-lit-with-float-type
should never exist). Right layer = the producing cast lowering.

## Debugging technique used
In an env where slang-glslang/spirv-dis/spirv-opt fail to load, emit raw binary with
`-target spirv -emit-spirv-directly -O0 -skip-spirv-validation -o x.spv` and parse the words in
python (`struct.unpack('<%dI')`): opcode = word&0xffff, wordcount = word>>16. Track OpTypeFloat
id→width, then check each OpConstant's literal-word count against the type width. Lets you confirm
a word-count bug with no external SPIR-V tooling.
