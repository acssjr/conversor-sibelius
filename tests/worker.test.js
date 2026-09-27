import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { analyze, convert, MAX_BYTES } from '../src/lib/sibelius.js';

function fixture() {
  const bytes = new Uint8Array(40);
  bytes.set([15,83,73,66,69,76,73,85,83]);
  const view = new DataView(bytes.buffer);
  view.setUint16(10,69); view.setUint16(12,3); view.setUint32(18,58);
  return bytes;
}
function setup() {
  const messages = [];
  const self = { postMessage(message, transfer = []) { messages.push(structuredClone(message, { transfer })); } };
  const source = fs.readFileSync(new URL('../src/converter.worker.js', import.meta.url), 'utf8').replace(/^import[^\n]+\n/, '');
  vm.runInNewContext(source, { self, analyze, convert, MAX_BYTES, Uint8Array, Error });
  return { messages, send: data => self.onmessage({ data }) };
}
const file = bytes => ({ size: bytes.length, arrayBuffer: async () => bytes.buffer });

test('worker analyzes and converts both profiles without detaching original', async () => {
  const worker = setup(), bytes = fixture(), original = bytes.slice();
  await worker.send({ type: 'analyze', id: 1, file: file(bytes) });
  assert.equal(worker.messages[0].info.headers, 1);
  for (const profile of ['minimal', 'alternative']) {
    await worker.send({ type: 'convert', id: 1, profile });
    const result = worker.messages.at(-1);
    assert.equal(result.type, 'converted');
    assert.equal(new Uint8Array(result.bytes)[11], 68);
    assert.equal(result.report.changedBytes, profile === 'minimal' ? 1 : 2);
  }
  assert.deepEqual(bytes, original);
});
test('worker discards late reads after a new file selection', async () => {
  const worker = setup(); let release;
  const slow = worker.send({ type: 'analyze', id: 1, file: { size: 40, arrayBuffer: () => new Promise(resolve => { release = resolve; }) } });
  await worker.send({ type: 'analyze', id: 2, file: file(fixture()) });
  release(fixture().buffer); await slow;
  assert.deepEqual(worker.messages.map(message => message.id), [2]);
});
test('worker rejects stale conversion and oversized files', async () => {
  const worker = setup();
  await worker.send({ type: 'analyze', id: 2, file: file(fixture()) });
  await worker.send({ type: 'convert', id: 1, profile: 'minimal' });
  assert.equal(worker.messages.at(-1).type, 'error');
  await worker.send({ type: 'analyze', id: 3, file: { size: MAX_BYTES + 1 } });
  assert.match(worker.messages.at(-1).message, /50 MiB/);
});
