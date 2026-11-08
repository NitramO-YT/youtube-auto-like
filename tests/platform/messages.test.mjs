import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { acceptedMessage, Message } from '../../src/platform/messages.js';

const EXTENSION_ID = 'lccjnbjmgficoniieomponlgdjafnbhi';

describe('acceptedMessage', () => {
  it('accepts each known message from this extension', () => {
    for (const type of Object.values(Message)) {
      assert.equal(acceptedMessage({ type }, { id: EXTENSION_ID }, EXTENSION_ID), type);
    }
  });

  it('refuses messages from another extension or without a sender', () => {
    assert.equal(acceptedMessage({ type: Message.LIKE_NOW }, { id: 'aaaabbbbccccddddeeeeffffgggghhhh' }, EXTENSION_ID), null);
    assert.equal(acceptedMessage({ type: Message.LIKE_NOW }, undefined, EXTENSION_ID), null);
  });

  it('refuses unknown or malformed messages', () => {
    for (const message of [null, 'like-now', {}, { type: 'click-everything' }, { type: ['like-now'] }]) {
      assert.equal(acceptedMessage(message, { id: EXTENSION_ID }, EXTENSION_ID), null);
    }
  });
});
