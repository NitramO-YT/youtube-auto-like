import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { ListFullError, listOf, MAX_CHANNELS, normalizeChannels } from '../../src/core/channels.js';
import { createStore } from '../../src/platform/storage.js';
import { createActionRunner, isStorageFull } from '../../src/ui/shared/actions.js';
import { moveChannel, setVideoExcluded } from '../../src/ui/shared/lists.js';
import { createNotice } from '../../src/ui/shared/notice.js';
import { translator } from '../helpers/fake-i18n.mjs';
import { fakeStorageApi } from '../helpers/fake-storage.mjs';

const COLAS = { id: 'UC9orcd4I_3Uy_8_UAz2r48g', name: 'COLAS' };
// Avatar of COLAS on its public page, 8 November 2026.
const AVATAR = 'https://yt3.googleusercontent.com/3fhLCThebQlwuSDXM9SEapaTSVFB3EuXHCKtDzFhnugoLLb71I05xsU_yi5-qLMoT0Ve4PQQ=s88-c-k-c0x00ffffff-no-rj-mo';
const OLD = '2026-01-01T00:00:00.000Z';
const NOW = new Date('2026-11-08T21:00:00.000Z');
const storeWith = (lists) => createStore(fakeStorageApi({ settings: { lists } }));

describe('moveChannel', () => {
  it('moves the channel, and the undo puts it back in its list with its date', async () => {
    const store = storeWith({ never: [{ ...COLAS, addedAt: OLD }] });
    const { settings, undo } = await moveChannel(store, COLAS, 'always', NOW);
    assert.equal(listOf(settings.lists, COLAS.id), 'always');
    const restored = await undo();
    assert.equal(listOf(restored.lists, COLAS.id), 'never');
    assert.equal(restored.lists.never[0].addedAt, OLD);
  });

  it('takes a channel out of both lists, and the undo of an addition removes it', async () => {
    const store = storeWith({});
    const { undo } = await moveChannel(store, COLAS, 'never', NOW);
    assert.equal(listOf((await undo()).lists, COLAS.id), null);
    const removed = await moveChannel(storeWith({ always: [COLAS] }), COLAS, null, NOW);
    assert.equal(listOf(removed.settings.lists, COLAS.id), null);
  });

  it('gives back its avatar to a channel taken out of a list, at the undo', async () => {
    const store = storeWith({ always: [{ ...COLAS, avatarUrl: AVATAR, addedAt: OLD }] });
    const { undo } = await moveChannel(store, { id: COLAS.id }, null, NOW);
    assert.deepEqual((await undo()).lists.always, [{ ...COLAS, avatarUrl: AVATAR, addedAt: OLD }]);
  });

  it('saves nothing when the list is full', async () => {
    const full = normalizeChannels(Array.from({ length: MAX_CHANNELS }, (_, i) => ({ id: `UC${String(i).padStart(22, '0')}` })));
    const api = fakeStorageApi({ settings: { lists: { always: full } } });
    await assert.rejects(moveChannel(createStore(api), COLAS, 'always', NOW), ListFullError);
    assert.equal(api.data.settings.lists.always.length, MAX_CHANNELS);
  });
});

describe('setVideoExcluded', () => {
  const VIDEO = { videoId: 'EkDC9elBHHc', title: 'le moooonstre', channelName: 'COLAS', channelAvatarUrl: AVATAR, isShort: true };

  it('excludes a video, and the undo takes it out again', async () => {
    const store = storeWith({});
    const { settings, undo } = await setVideoExcluded(store, VIDEO, true, NOW);
    assert.deepEqual(settings.excludedVideos, [{ ...VIDEO, addedAt: NOW.toISOString() }]);
    assert.deepEqual((await undo()).excludedVideos, []);
  });

  it('stops excluding a video, and the undo gives it back with its date', async () => {
    const store = createStore(fakeStorageApi({ settings: { excludedVideos: [{ ...VIDEO, addedAt: OLD }] } }));
    const { settings, undo } = await setVideoExcluded(store, { videoId: VIDEO.videoId }, false, NOW);
    assert.deepEqual(settings.excludedVideos, []);
    assert.deepEqual((await undo()).excludedVideos, [{ ...VIDEO, addedAt: OLD }]);
  });
});

// Elements with what createNotice uses: hidden, textContent, classList, click.
function fakeElements() {
  const element = () => {
    const classes = new Set();
    const listeners = [];
    return {
      hidden: true,
      textContent: '',
      classes,
      classList: { toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)) },
      addEventListener: (_, listener) => listeners.push(listener),
      click: () => listeners.forEach((listener) => listener()),
    };
  };
  return { box: element(), text: element(), undoButton: element() };
}

describe('createNotice', () => {
  it('shows a message, offers the undo, and hides once it is used', async () => {
    const elements = fakeElements();
    const undo = mock.fn();
    const notice = createNotice(elements, { duration: 60_000 });
    notice.show('Saved', { undo });
    assert.equal(elements.box.hidden, false);
    assert.equal(elements.text.textContent, 'Saved');
    assert.equal(elements.undoButton.hidden, false);
    elements.undoButton.click();
    elements.undoButton.click();
    assert.equal(undo.mock.callCount(), 1);
    assert.equal(elements.box.hidden, true);
    notice.hide();
  });

  it('marks a failure, without an undo, and hides after its delay', async () => {
    const elements = fakeElements();
    const notice = createNotice(elements, { duration: 5 });
    notice.show('Not saved', { error: true });
    assert.ok(elements.box.classes.has('error'));
    assert.equal(elements.undoButton.hidden, true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(elements.box.hidden, true);
  });
});

describe('createActionRunner', () => {
  const en = translator('en');

  it('explains a full list, and logs any other failure as not saved', async () => {
    const shown = [];
    const act = createActionRunner({ show: (text, options) => shown.push([text, options.error]) }, en, 'en');
    await act(() => {
      throw new ListFullError('always');
    });
    const error = mock.method(console, 'error', () => {});
    try {
      await act(() => Promise.reject(new Error('storage down')));
      assert.equal(error.mock.callCount(), 1);
    } finally {
      error.mock.restore();
    }
    assert.deepEqual(shown, [
      ['This list is full (5,000 entries at most).', true],
      ['The change could not be saved.', true],
    ]);
  });

  it('explains a full storage, without logging it as an unknown failure', async () => {
    const shown = [];
    const act = createActionRunner({ show: (text) => shown.push(text) }, en, 'en');
    const error = mock.method(console, 'error', () => {});
    try {
      await act(() => Promise.reject(new Error('QUOTA_BYTES quota exceeded')));
      assert.equal(error.mock.callCount(), 0);
    } finally {
      error.mock.restore();
    }
    assert.deepEqual(shown, ['The storage of the extension is full: remove channels or excluded videos from your lists, then try again.']);
    assert.equal(isStorageFull(new Error('storage down')), false);
  });

  it('runs an action asked while another runs once that one is done, never dropping it', async () => {
    const act = createActionRunner({ show: () => {} }, en, 'en');
    const order = [];
    let release;
    const first = act(() => new Promise((resolve) => (release = resolve)).then(() => order.push('first')));
    const second = act(() => order.push('second'));
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.deepEqual(order, [], 'the second waits for the first');
    release();
    await Promise.all([first, second]);
    assert.deepEqual(order, ['first', 'second']);
  });

  it('goes on with the next actions after a failure', async () => {
    const act = createActionRunner({ show: () => {} }, en, 'en');
    const error = mock.method(console, 'error', () => {});
    const next = mock.fn();
    try {
      act(() => Promise.reject(new Error('storage down')));
      await act(next);
    } finally {
      error.mock.restore();
    }
    assert.equal(next.mock.callCount(), 1);
  });
});
