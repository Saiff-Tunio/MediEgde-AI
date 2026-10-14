import test from 'node:test';
import assert from 'node:assert/strict';
import { createScan, parseScans, screenings } from '../src/domain.ts';
import { analyzeLocally, getModel } from '../src/models.ts';

const image = { uri: 'file:///scan.jpg', width: 512, height: 512 };
test('every category saves an unanalysed record that survives serialization', () => {
  for (const category of screenings) {
    const record = createScan(category.id, image);
    assert.equal(record.status, 'awaiting-model');
    assert.deepEqual(parseScans(JSON.stringify([record])), [record]);
    assert.equal('confidence' in record, false);
  }
});
test('corrupt or incompatible history is rejected rather than silently discarded', () => {
  const valid = createScan('brain', image);
  for (const raw of ['broken json', '{}', '[null]', JSON.stringify([{ ...valid, screeningId: 'unknown' }]), JSON.stringify([{ ...valid, id: '../outside' }]), JSON.stringify([{ ...valid, createdAt: 'bad date' }]), JSON.stringify([{ ...valid, width: -1 }]), JSON.stringify([{ ...valid, status: 'diagnosed' }])]) {
    assert.throws(() => parseScans(raw));
  }
});
test('invalid image dimensions cannot produce a saved record', () => {
  for (const width of [0, -1, NaN, Infinity]) assert.throws(() => createScan('brain', { ...image, width }));
  assert.throws(() => createScan('brain', { ...image, uri: '' }));
});
test('all missing models fail explicitly without simulated predictions', async () => {
  for (const category of screenings) {
    assert.equal(getModel(category.id), undefined);
    await assert.rejects(analyzeLocally(category.id, image), /No analysis was performed/);
  }
});
