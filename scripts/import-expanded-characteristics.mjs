import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import xlsx from 'xlsx';

const ROOT = process.cwd();
const PRODUCTS_JSON_PATH = path.join(ROOT, 'data', 'products.json');

const EXCEL_CANDIDATES = [
  path.join(ROOT, 'source', 'pkftechno_products_export_EXPANDED_2026-06-09.xlsx'),
  path.join(ROOT, 'pkftechno_products_export_EXPANDED_2026-06-09.xlsx'),
  path.join(ROOT, 'source', 'products.xlsx'),
];

const TARGET_SECTION_MARKER = 'ПСС-2П';
const TARGET_GROUP = 'Технические характеристики';

const SOURCE_SLUG_TO_PRODUCT_SLUG = {
  'shkaf-silovoj-shs1-mg-pss-2p': 'shs1-mg-pss-2p',
  'shkaf-silovoj-shs2-mg-pss-2p': 'shs2-mg-pss-2p',
  'shkaf-silovoj-shs3-mg-pss-2p': 'shs3-mg-pss-2p',

  'shkaf-silovoj-shs-pk-pss-2p': 'shs-pk-pss-2p',

  'shkaf-upravleniya-shu-mg-pss-2p': 'shu-mg-pss-2p',
  'shkaf-upravleniya-shu-pk-pss-2p': 'shu-pk-pss-2p',

  'shkaf-kommutacii-shk1-pk-pss-2p': 'shk1-pk-pss-2p',
  'shkaf-kommutacii-shk2-pk-pss-2p': 'shk2-pk-pss-2p',

  'shkaf-kommutacii-shk-pp-1-pss-2p': 'shk-pp1-pss-2p',
  'shkaf-kommutacii-shk-pp-2-pss-2p': 'shk-pp2-pss-2p',
  'shkaf-kommutacii-shk-pp-3-pss-2p': 'shk-pp3-pss-2p',

  'pult-upravleniya-pu-mg-pss-2p': 'pu-mg-pss-2p',
  'pul-upravlenya-pu-mg-pss-2p': 'pu-mg-pss-2p',

  'pult-upravleniya-pu-pk-pss-2p': 'pu-pk-pss-2p',
  'pul-upravlenya-pu-pk-pss-2p': 'pu-pk-pss-2p',

  'shkaf-tiristornyh-modulej-shtm-pk-pss-2p': 'shtm-pk-pss-2p',
};

const TARGET_PRODUCT_SLUGS = [...new Set(Object.values(SOURCE_SLUG_TO_PRODUCT_SLUG))];

function fail(message) {
  console.error(`\n[import-expanded-characteristics] ERROR: ${message}\n`);
  process.exit(1);
}

function findExcelPath() {
  return EXCEL_CANDIDATES.find((candidate) => fs.existsSync(candidate));
}

function normalizeText(value) {
  return String(value ?? '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCell(row, possibleNames) {
  for (const name of possibleNames) {
    if (Object.prototype.hasOwnProperty.call(row, name)) {
      return row[name];
    }
  }

  const normalizedMap = new Map(
    Object.keys(row).map((key) => [normalizeText(key).toLowerCase(), key]),
  );

  for (const name of possibleNames) {
    const foundKey = normalizedMap.get(normalizeText(name).toLowerCase());
    if (foundKey) return row[foundKey];
  }

  return '';
}

function extractSlugFromUrl(rawUrl) {
  const value = normalizeText(rawUrl);
  if (!value) return '';

  try {
    const url = value.startsWith('http')
      ? new URL(value)
      : new URL(value, 'https://pkftechno.ru');

    const querySlug = url.searchParams.get('slug');
    if (querySlug) return querySlug.trim();

    const parts = url.pathname.split('/').filter(Boolean);
    return parts.at(-1) || '';
  } catch {
    const parts = value.split('?')[0].split('/').filter(Boolean);
    return parts.at(-1) || '';
  }
}

function isEmptyCharacteristics(value) {
  const text = normalizeText(value).toLowerCase();
  return (
    !text ||
    text === 'не указано' ||
    text === 'не указано в csv' ||
    text === 'нет данных' ||
    text === '-'
  );
}

function parseCharacteristics(rawText, productSlug) {
  const text = normalizeText(rawText);
  if (!text) return [];

  return text
    .split(';')
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .map((part, index) => {
      const colonIndex = part.indexOf(':');

      const name = colonIndex >= 0
        ? normalizeText(part.slice(0, colonIndex))
        : part;

      const value = colonIndex >= 0
        ? normalizeText(part.slice(colonIndex + 1))
        : '';

      return {
        product_slug: productSlug,
        group: TARGET_GROUP,
        name,
        value,
        unit: '',
        sort: (index + 1) * 10,
      };
    });
}

function loadProductsJson() {
  if (!fs.existsSync(PRODUCTS_JSON_PATH)) {
    fail(`Не найден файл ${PRODUCTS_JSON_PATH}`);
  }

  return JSON.parse(fs.readFileSync(PRODUCTS_JSON_PATH, 'utf8'));
}

function readExcelRows(excelPath) {
  const workbook = xlsx.readFile(excelPath);
  const sheetName = workbook.SheetNames.includes('Продукция')
    ? 'Продукция'
    : workbook.SheetNames[0];

  if (!sheetName) {
    fail('В Excel-файле нет листов.');
  }

  const sheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet, { defval: '' });
}

function buildImports(rows, productsBySlug) {
  const imports = new Map();

  for (const row of rows) {
    const title = normalizeText(getCell(row, [
      'Название продукции',
      'Наименование',
      'Название',
      'title',
      'name',
    ]));

    const section = normalizeText(getCell(row, [
      'Подраздел',
      'Раздел',
      'Категория',
      'category',
      'section',
    ]));

    const url = normalizeText(getCell(row, [
      'Ссылка на страницу с продукцией',
      'Ссылка',
      'URL',
      'url',
      'link',
    ]));

    const rawCharacteristics = getCell(row, [
      'Характеристики продукции',
      'Характеристики',
      'characteristics',
      'specs',
    ]);

    const sourceSlug = extractSlugFromUrl(url);
    const productSlug = SOURCE_SLUG_TO_PRODUCT_SLUG[sourceSlug];

    const rowText = `${title} ${section} ${url}`;

    if (!productSlug) {
      continue;
    }

    if (!rowText.includes(TARGET_SECTION_MARKER)) {
      continue;
    }

    if (isEmptyCharacteristics(rawCharacteristics)) {
      imports.set(productSlug, {
        status: 'empty_characteristics',
        title,
        sourceSlug,
        rows: [],
      });
      continue;
    }

    if (!productsBySlug.has(productSlug)) {
      imports.set(productSlug, {
        status: 'product_not_found',
        title,
        sourceSlug,
        rows: [],
      });
      continue;
    }

    const parsed = parseCharacteristics(rawCharacteristics, productSlug);

    imports.set(productSlug, {
      status: parsed.length ? 'ok' : 'empty_characteristics',
      title,
      sourceSlug,
      rows: parsed,
    });
  }

  return imports;
}

function main() {
  const excelPath = findExcelPath();

  if (!excelPath) {
    fail(`Excel-файл не найден. Положи pkftechno_products_export_EXPANDED_2026-06-09.xlsx в ./source/ или в корень репозитория.`);
  }

  const data = loadProductsJson();
  data.products = Array.isArray(data.products) ? data.products : [];
  data.characteristics = Array.isArray(data.characteristics) ? data.characteristics : [];

  const productsBySlug = new Map(data.products.map((product) => [product.slug, product]));
  const oldCounts = new Map();

  for (const slug of TARGET_PRODUCT_SLUGS) {
    oldCounts.set(
      slug,
      data.characteristics.filter((item) => item.product_slug === slug).length,
    );
  }

  const rows = readExcelRows(excelPath);
  const imports = buildImports(rows, productsBySlug);

  const backupPath = path.join(ROOT, 'data', 'products.before-expanded-characteristics.json');
  fs.copyFileSync(PRODUCTS_JSON_PATH, backupPath);

  data.characteristics = data.characteristics.filter(
    (item) => !TARGET_PRODUCT_SLUGS.includes(item.product_slug),
  );

  const summary = [];

  for (const slug of TARGET_PRODUCT_SLUGS) {
    const product = productsBySlug.get(slug);
    const imported = imports.get(slug);

    if (!product) {
      summary.push({
        title: 'ТОВАР НЕ НАЙДЕН',
        slug,
        old_characteristics_count: oldCounts.get(slug) || 0,
        new_characteristics_count: 0,
        status: 'product_not_found',
      });
      continue;
    }

    if (!imported) {
      summary.push({
        title: product.title || product.name || imported?.title || '',
        slug,
        old_characteristics_count: oldCounts.get(slug) || 0,
        new_characteristics_count: 0,
        status: 'source_not_found',
      });
      continue;
    }

    if (imported.rows.length) {
      data.characteristics.push(...imported.rows);
    }

    summary.push({
      title: product.title || product.name || imported.title || '',
      slug,
      old_characteristics_count: oldCounts.get(slug) || 0,
      new_characteristics_count: imported.rows.length,
      status: imported.status,
    });
  }

  fs.writeFileSync(PRODUCTS_JSON_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

  console.log('\n[import-expanded-characteristics] Excel:', path.relative(ROOT, excelPath));
  console.log('[import-expanded-characteristics] Backup:', path.relative(ROOT, backupPath));
  console.log('[import-expanded-characteristics] Updated:', path.relative(ROOT, PRODUCTS_JSON_PATH));
  console.table(summary);

  const failed = summary.filter((row) => row.status !== 'ok');

  if (failed.length) {
    console.warn('\n[import-expanded-characteristics] Есть строки не со статусом ok. Проверь source slug / Excel rows:');
    console.table(failed);
    process.exitCode = 1;
  }
}

main();
