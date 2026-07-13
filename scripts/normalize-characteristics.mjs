import { readFile, writeFile } from 'node:fs/promises';

const dataPath = new URL('../data/products.json', import.meta.url);
const data = JSON.parse(await readFile(dataPath, 'utf8'));

for (const item of data.characteristics) {
  if (item.name !== 'Номинальное напряжение бортовой сети') continue;
  item.name = /перем\.|перем|345|418/i.test(`${item.value} ${item.unit || ''}`)
    ? 'Номинальное напряжение цепей переменного тока'
    : 'Номинальное напряжение цепей постоянного тока';
}

await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log('Нормализованы названия характеристик напряжения.');
