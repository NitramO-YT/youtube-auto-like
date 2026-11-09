import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Surface, surfaceFromUrl, videoIdFromUrl } from '../../src/content/youtube/surface.js';

describe('surfaceFromUrl', () => {
  it('recognizes the watch page and the Shorts player', () => {
    assert.equal(surfaceFromUrl('https://www.youtube.com/watch?v=aeP4eG-gO10'), Surface.WATCH);
    assert.equal(surfaceFromUrl('https://www.youtube.com/watch?v=rB6_IFAKzec&t=2703s'), Surface.WATCH);
    assert.equal(surfaceFromUrl('https://www.youtube.com/shorts/JgL5gMtA2X4'), Surface.SHORTS);
  });

  it('returns null for pages that play no video, and for malformed URLs', () => {
    for (const href of [
      'https://www.youtube.com/',
      'https://www.youtube.com/@COLAS./shorts',
      'https://www.youtube.com/watch',
      'https://www.youtube.com/shorts/',
      'not a url',
    ]) {
      assert.equal(surfaceFromUrl(href), null, href);
    }
  });
});

describe('videoIdFromUrl', () => {
  it('reads watch and Shorts URLs', () => {
    assert.equal(videoIdFromUrl('https://www.youtube.com/watch?v=aeP4eG-gO10'), 'aeP4eG-gO10');
    assert.equal(videoIdFromUrl('https://www.youtube.com/watch?v=rB6_IFAKzec&t=2703s'), 'rB6_IFAKzec');
    assert.equal(videoIdFromUrl('https://www.youtube.com/shorts/JgL5gMtA2X4'), 'JgL5gMtA2X4');
  });

  it('reads the video playing in a playlist or a mix, which changes with each next video', () => {
    const inPlaylist = 'https://www.youtube.com/watch?v=aeP4eG-gO10&list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG&index=3';
    assert.equal(surfaceFromUrl(inPlaylist), Surface.WATCH);
    assert.equal(videoIdFromUrl(inPlaylist), 'aeP4eG-gO10');
    assert.equal(videoIdFromUrl('https://www.youtube.com/watch?v=Bw7eq26hMDw&list=RDaeP4eG-gO10&start_radio=1&index=2'), 'Bw7eq26hMDw');
  });

  it('returns null for other pages and for malformed URLs', () => {
    for (const href of [
      'https://www.youtube.com/',
      'https://www.youtube.com/@COLAS./videos',
      'https://www.youtube.com/watch',
      'not a url',
    ]) {
      assert.equal(videoIdFromUrl(href), null, href);
    }
  });
});
