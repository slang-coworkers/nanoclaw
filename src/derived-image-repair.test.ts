import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DERIVED_IMAGE_REBUILD_COOLDOWN_MS,
  derivedImageTag,
  isImageUnavailable,
  requestDerivedImageRebuild,
  resetDerivedImageRebuildsForTests,
  settleDerivedImageRebuilds,
  shouldRebuildDerivedImage,
} from './derived-image-repair.js';
import { asFailureError, specInvalid } from './drivers/types.js';

const BASE = 'nanoclaw-agent-v2-abcd1234';
const missing = () => asFailureError({ kind: 'image-unavailable', retryable: true });

/** A build whose outcome the test decides after starting it. */
function deferredBuild() {
  let finish!: () => void;
  let fail!: (err: Error) => void;
  const build = vi.fn(
    () =>
      new Promise<void>((resolve, reject) => {
        finish = resolve;
        fail = reject;
      }),
  );
  return { build, finish: () => finish(), fail: (err: Error) => fail(err) };
}

afterEach(() => {
  resetDerivedImageRebuildsForTests();
});

describe('derivedImageTag', () => {
  it('tags the image base with the agent group id', () => {
    expect(derivedImageTag(BASE, 'ag-1')).toBe(`${BASE}:ag-1`);
  });
});

describe('isImageUnavailable', () => {
  it('recognises the typed image-unavailable failure', () => {
    expect(isImageUnavailable(missing())).toBe(true);
  });

  it('rejects other failure kinds, untyped errors and non-errors', () => {
    expect(isImageUnavailable(specInvalid('bad mount'))).toBe(false);
    expect(isImageUnavailable(asFailureError({ kind: 'runtime-unavailable', retryable: true }))).toBe(false);
    expect(isImageUnavailable(new Error('No such image: x'))).toBe(false);
    expect(isImageUnavailable({ kind: 'image-unavailable' })).toBe(false);
  });
});

describe('shouldRebuildDerivedImage', () => {
  const failed = {
    err: missing(),
    imageTag: `${BASE}:ag-1`,
    imageBase: BASE,
    agentGroupId: 'ag-1',
    imageBuild: true,
  };

  it('rebuilds a missing derived image on a driver that can build', () => {
    expect(shouldRebuildDerivedImage(failed)).toBe(true);
  });

  it('leaves the base image and operator-supplied pins to the operator', () => {
    expect(shouldRebuildDerivedImage({ ...failed, imageTag: undefined })).toBe(false);
    expect(shouldRebuildDerivedImage({ ...failed, imageTag: 'registry.example/agent:custom' })).toBe(false);
    expect(shouldRebuildDerivedImage({ ...failed, imageTag: `${BASE}:ag-2` })).toBe(false);
  });

  it('ignores other prepare failures and drivers without imageBuild', () => {
    expect(shouldRebuildDerivedImage({ ...failed, err: specInvalid('bad mount') })).toBe(false);
    expect(shouldRebuildDerivedImage({ ...failed, imageBuild: false })).toBe(false);
  });
});

describe('requestDerivedImageRebuild', () => {
  it('runs one build per group while it is in flight', async () => {
    const { build, finish } = deferredBuild();
    expect(requestDerivedImageRebuild('ag-1', build, 0)).toBe('started');
    expect(requestDerivedImageRebuild('ag-1', build, 1_000)).toBe('in-flight');
    await vi.waitFor(() => expect(build).toHaveBeenCalledTimes(1));
    finish();
    await settleDerivedImageRebuilds();
    expect(build).toHaveBeenCalledWith('ag-1');
  });

  it('builds different groups independently', async () => {
    const build = vi.fn(async (_agentGroupId: string) => {});
    expect(requestDerivedImageRebuild('ag-1', build, 0)).toBe('started');
    expect(requestDerivedImageRebuild('ag-2', build, 0)).toBe('started');
    await settleDerivedImageRebuilds();
    expect(build.mock.calls.map((c) => c[0]).sort()).toEqual(['ag-1', 'ag-2']);
  });

  it('waits out the cooldown after a failed build, then tries again', async () => {
    const { build, fail } = deferredBuild();
    expect(requestDerivedImageRebuild('ag-1', build, 0)).toBe('started');
    await vi.waitFor(() => expect(build).toHaveBeenCalledTimes(1));
    fail(new Error('FROM image not found'));
    await settleDerivedImageRebuilds();

    expect(requestDerivedImageRebuild('ag-1', build, DERIVED_IMAGE_REBUILD_COOLDOWN_MS - 1)).toBe('cooling-down');
    expect(build).toHaveBeenCalledTimes(1);
    expect(requestDerivedImageRebuild('ag-1', build, DERIVED_IMAGE_REBUILD_COOLDOWN_MS)).toBe('started');
    await vi.waitFor(() => expect(build).toHaveBeenCalledTimes(2));
  });

  it('keeps a synchronous throw from the builder inside the background build', async () => {
    const build = vi.fn((): Promise<void> => {
      throw new Error('boom');
    });
    expect(requestDerivedImageRebuild('ag-1', build, 0)).toBe('started');
    await expect(settleDerivedImageRebuilds()).resolves.toBeUndefined();
    expect(build).toHaveBeenCalledTimes(1);
  });
});
