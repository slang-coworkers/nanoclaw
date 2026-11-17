import { describe, expect, it } from 'vitest';

import { BUILD_JOBS_HOST_SHARE, resolveContainerBuildJobs } from './config.js';

describe('resolveContainerBuildJobs', () => {
  it('gives each build a share of the host cores when nothing is set', () => {
    expect(BUILD_JOBS_HOST_SHARE).toBe(4);
    expect(resolveContainerBuildJobs(undefined, 64)).toBe(16);
    expect(resolveContainerBuildJobs('', 64)).toBe(16);
    expect(resolveContainerBuildJobs('  ', 30)).toBe(7);
  });

  it('never goes below two jobs on a small host', () => {
    expect(resolveContainerBuildJobs(undefined, 4)).toBe(2);
    expect(resolveContainerBuildJobs(undefined, 1)).toBe(2);
  });

  it('uses an explicit whole number as given', () => {
    expect(resolveContainerBuildJobs('8', 64)).toBe(8);
    expect(resolveContainerBuildJobs('96', 64)).toBe(96);
  });

  it('leaves the variable unset for 0', () => {
    expect(resolveContainerBuildJobs('0', 64)).toBeUndefined();
  });

  it('falls back to the share for a value that is not a whole number', () => {
    for (const raw of ['-1', '2.5', 'many', 'NaN']) {
      expect(resolveContainerBuildJobs(raw, 64)).toBe(16);
    }
  });
});
