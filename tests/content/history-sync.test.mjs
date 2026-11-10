import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { initialSync, syncHistory } from '../../src/content/isolated/history-sync.js';
import { STABLE_FOR_MS } from '../../src/content/isolated/session.js';

/** Runs the readings [liked, time] in order, and gives each mark asked for, with its time. */
function marks(readings) {
  let state = initialSync();
  const asked = [];
  for (const [liked, now] of readings) {
    const result = syncHistory(state, liked, now);
    state = result.state;
    if (result.mark !== null) asked.push([result.mark, now]);
  }
  return asked;
}

describe('syncHistory', () => {
  it('marks a like seen removed once it has read the same for STABLE_FOR_MS, and only once', () => {
    assert.deepEqual(marks([[false, 0], [false, STABLE_FOR_MS - 1], [false, STABLE_FOR_MS], [false, 5000]]), [[true, STABLE_FOR_MS]]);
  });

  it('marks a like seen standing as such, which clears a removal of the history', () => {
    assert.deepEqual(marks([[true, 0], [true, STABLE_FOR_MS]]), [[false, STABLE_FOR_MS]]);
  });

  it('never decides on a reading that does not last, or that is unknown', () => {
    assert.deepEqual(marks([[false, 0], [null, 500], [false, 900], [true, 1200], [false, 1500]]), []);
    assert.deepEqual(marks([[null, 0], [null, 5000]]), []);
  });

  it('starts the wait again after a moment the like could not be read', () => {
    assert.deepEqual(marks([[false, 0], [null, 600], [false, 1100], [false, 1100 + STABLE_FOR_MS]]), [[true, 1100 + STABLE_FOR_MS]]);
  });

  it('follows a like taken back, then given again, each once stable', () => {
    assert.deepEqual(marks([[true, 0], [true, 1000], [false, 2000], [false, 3000], [true, 4000], [true, 5000]]), [
      [false, 1000],
      [true, 3000],
      [false, 5000],
    ]);
  });
});
