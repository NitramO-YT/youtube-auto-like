import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { crc32, inflateRawSync } from 'node:zlib';
import { zipFiles } from '../../scripts/lib/zip.mjs';

/** Reads an archive back through its central directory: [{ name, data }]. */
function unzip(archive) {
  const end = archive.length - 22;
  assert.equal(archive.readUInt32LE(end), 0x06054b50, 'end of central directory');
  const count = archive.readUInt16LE(end + 10);
  let at = archive.readUInt32LE(end + 16);
  const files = [];
  for (let i = 0; i < count; i += 1) {
    assert.equal(archive.readUInt32LE(at), 0x02014b50, 'central header');
    const checksum = archive.readUInt32LE(at + 16);
    const compressedSize = archive.readUInt32LE(at + 20);
    const nameLength = archive.readUInt16LE(at + 28);
    const offset = archive.readUInt32LE(at + 42);
    const name = archive.toString('utf8', at + 46, at + 46 + nameLength);
    const start = offset + 30 + archive.readUInt16LE(offset + 26) + archive.readUInt16LE(offset + 28);
    const data = inflateRawSync(archive.subarray(start, start + compressedSize));
    assert.equal(crc32(data), checksum, `checksum of ${name}`);
    files.push({ name, data });
    at += 46 + nameLength;
  }
  return files;
}

describe('zipFiles', () => {
  const files = [
    { name: 'manifest.json', data: Buffer.from('{"manifest_version":3}') },
    { name: '_locales/fr/messages.json', data: Buffer.from('{"x":{"message":"Réglages"}}') },
    { name: 'icons/empty.txt', data: Buffer.alloc(0) },
  ];

  it('gives back every file, with its path and content', () => {
    assert.deepEqual(unzip(zipFiles(files)), files);
  });

  it('gives the same archive for the same files, whenever it is made', () => {
    assert.deepEqual(zipFiles(files), zipFiles(structuredClone(files).map((file) => ({ ...file, data: Buffer.from(file.data) }))));
  });
});
