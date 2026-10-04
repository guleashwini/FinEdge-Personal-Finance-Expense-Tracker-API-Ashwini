import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function readJsonFile(filePath, fallbackValue) {
  try {
    const fileContents = await readFile(filePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return fallbackValue;
    }

    throw error;
  }
}

export async function writeJsonFile(filePath, data) {
  await mkdir(dirname(filePath), { recursive: true });
  const json = `${JSON.stringify(data, null, 2)}\n`;
  await writeFile(filePath, json, 'utf8');
}
