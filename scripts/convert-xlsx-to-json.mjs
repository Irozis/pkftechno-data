import { access, mkdir, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import xlsx from 'xlsx';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.resolve(rootDir, process.argv[2] || './source/products.xlsx');
const outputPath = path.join(rootDir, 'data', 'products.json');

function readSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    return [];
  }

  return xlsx.utils.sheet_to_json(sheet, {
    defval: '',
    raw: false
  }).filter((row) => Object.values(row).some((value) => String(value).trim() !== ''));
}

function parseSort(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

function normalizeRows(rows) {
  return rows.map((row) => {
    const normalized = {};

    for (const [key, value] of Object.entries(row)) {
      if (key === '__EMPTY') {
        continue;
      }

      normalized[key.trim()] = key.trim() === 'sort' ? parseSort(value) : value;
    }

    return normalized;
  });
}

function parseDictionaries(rows) {
  const dictionaries = {
    types: [],
    series: [],
    sections: []
  };

  for (const row of rows) {
    for (const key of ['types', 'series', 'sections']) {
      if (row[key]) {
        dictionaries[key].push(row[key]);
      }
    }

    const group = row.dictionary || row.group || row.type || row.category;
    const value = row.value || row.name || row.title;

    if (group && value && Object.hasOwn(dictionaries, group)) {
      dictionaries[group].push(value);
    }
  }

  for (const key of Object.keys(dictionaries)) {
    dictionaries[key] = [...new Set(dictionaries[key].map((value) => String(value).trim()).filter(Boolean))];
  }

  return dictionaries;
}

try {
  await access(sourcePath, constants.R_OK);
} catch {
  console.error(`Ошибка: Excel-файл не найден или недоступен: ${sourcePath}`);
  console.error('Файл data/products.json не изменен.');
  process.exit(1);
}

const workbook = xlsx.readFile(sourcePath);
const dictionariesRows = normalizeRows(readSheet(workbook, 'dictionaries'));

const data = {
  products: normalizeRows(readSheet(workbook, 'products')),
  characteristics: normalizeRows(readSheet(workbook, 'characteristics')),
  images: normalizeRows(readSheet(workbook, 'images')),
  related_products: normalizeRows(readSheet(workbook, 'related_products')),
  dictionaries: parseDictionaries(dictionariesRows)
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

console.log(`Готово: обновлен файл ${outputPath}`);
