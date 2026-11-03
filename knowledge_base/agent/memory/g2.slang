[__readNone] [ForceInline] float twice(float x) { return x * 2.0f; }
static const float arr[2] = { twice(1.0f), twice(3.0f) };
[shader("compute")][numthreads(32, 1, 1)]
void k(uniform float* out, uint3 tid: SV_DispatchThreadID) { out[tid.x] = arr[tid.x & 1]; }
