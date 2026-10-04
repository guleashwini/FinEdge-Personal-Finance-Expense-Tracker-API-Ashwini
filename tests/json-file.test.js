import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readJsonFile, writeJsonFile } from '../src/services/json-file.service.js';

async function makeTempDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), 'finedge-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('readJsonFile returns a fallback when the file does not exist', async (t) => {
  const directory = await makeTempDirectory(t);
  const result = await readJsonFile(join(directory, 'missing.json'), []);

  assert.deepEqual(result, []);
});

test('writeJsonFile creates folders and writes readable JSON', async (t) => {
  const directory = await makeTempDirectory(t);
  const filePath = join(directory, 'nested', 'records.json');
  const records = [{ id: '1', amount: 12.5 }];

  await writeJsonFile(filePath, records);

  assert.deepEqual(await readJsonFile(filePath, []), records);
  assert.equal(await readFile(filePath, 'utf8'), `${JSON.stringify(records, null, 2)}\n`);
});

test('readJsonFile rejects malformed JSON instead of hiding the error', async (t) => {
  const directory = await makeTempDirectory(t);
  const filePath = join(directory, 'invalid.json');
  await writeFile(filePath, '{ invalid json', 'utf8');

  await assert.rejects(readJsonFile(filePath, []), SyntaxError);
});
