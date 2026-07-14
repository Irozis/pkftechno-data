import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dataPath = path.join(root, 'data', 'products.json');
const snapshotDir = path.join(root, 'assets', 'old-page-snapshots', 'locomotive-radio');

const namedEntities = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', laquo: '«', raquo: '»'
};

function decodeHtml(value) {
  return String(value || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => namedEntities[name.toLowerCase()] ?? match);
}

function cleanText(value) {
  return decodeHtml(String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

function attr(attrs, name) {
  const match = attrs.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'));
  return match?.[1] || '';
}

function extractElements(html) {
  const elements = [];
  const re = /<div\b([^>]*data-elem-id=[^>]*?)>\s*<h([123])\b[^>]*>([\s\S]*?)<\/h\2>/gi;
  for (const match of html.matchAll(re)) {
    const text = cleanText(match[3]);
    if (!text) continue;
    elements.push({
      id: attr(match[1], 'data-elem-id'),
      top: Number(attr(match[1], 'data-field-top-value')),
      left: Number(attr(match[1], 'data-field-left-value')),
      text,
      index: match.index
    });
  }
  return elements.filter((item) => Number.isFinite(item.top) && Number.isFinite(item.left));
}

function extractAllText(html) {
  const text = [...html.matchAll(/<h[123]\b[^>]*>([\s\S]*?)<\/h[123]>/gi)]
    .map((match) => cleanText(match[1]))
    .filter(Boolean);
  return [...new Set(text)];
}

function extractPurpose(html, elements) {
  const purposeHeading = elements.find((item) => item.text === 'Назначение');
  if (purposeHeading) {
    const purpose = elements
      .filter((item) => item.index > purposeHeading.index && item.text.length > 120)
      .sort((a, b) => a.index - b.index)[0];
    if (purpose) return purpose.text;
  }
  return extractAllText(html).find((text) => text.length > 120) || '';
}

function extractCharacteristics(html, elements) {
  const heading = elements.find((item) => item.text === 'Параметры и значения');
  if (!heading) return [];
  const end = elements.find((item) => item.index > heading.index && ['Контакты', 'Оставьте заявку'].includes(item.text));
  const table = elements.filter((item) => item.index > heading.index && (!end || item.index < end.index));
  const rows = [];
  const byTop = new Map();

  for (const item of table) {
    const key = Math.round(item.top / 3) * 3;
    if (!byTop.has(key)) byTop.set(key, []);
    byTop.get(key).push(item);
  }

  for (const items of byTop.values()) {
    const sorted = items.sort((a, b) => a.left - b.left);
    if (sorted.length < 2) continue;
    const name = sorted[0].text;
    const value = sorted[sorted.length - 1].text;
    if (name === 'Параметр' || name === 'Значение' || name.length < 2 || value.length < 1 || name === value) continue;
    rows.push({ name, value });
  }

  const unique = [];
  const seen = new Set();
  for (const row of rows) {
    const key = `${row.name}\u0000${row.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(row);
    }
  }
  return unique;
}

function extractExternalCharacteristics(html) {
  const rows = [];
  const re = /<div class="flex justify-between[^>]*>([\s\S]*?)<\/div>/gi;
  for (const match of html.matchAll(re)) {
    const values = [...match[1].matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)]
      .map((item) => cleanText(item[1]))
      .filter(Boolean);
    if (values.length >= 2 && values[0] !== values[1]) {
      rows.push({ name: values[0], value: values[1] });
    }
  }
  return rows;
}

function inferType(title) {
  if (title.startsWith('Антенна')) return 'Антенна';
  if (title.startsWith('Радиостанция')) return 'Радиостанция';
  if (title.startsWith('Дуплексный фильтр')) return 'Дуплексный фильтр';
  return 'Оборудование радиосвязи';
}

function inferSeries(title) {
  const match = title.match(/(АЛ[123М][^ ]+|РЛСМ-10|ДФ-160\/Р[68]К)/);
  return match?.[1] || title;
}

const data = JSON.parse(await readFile(dataPath, 'utf8'));
const manifest = JSON.parse(await readFile(path.join(snapshotDir, 'manifest.json'), 'utf8'));
const importSlugs = new Set(manifest.pages.map((page) => page.slug));
data.products = data.products.filter((product) => !importSlugs.has(product.slug));
data.characteristics = data.characteristics.filter((item) => !importSlugs.has(item.product_slug));
const importedProducts = [];
const importedCharacteristics = [];
const existingSlugs = new Set(data.products.map((product) => product.slug));

for (const page of manifest.pages) {
  const html = await readFile(path.join(snapshotDir, page.file), 'utf8');
  const elements = extractElements(html);
  const title = page.title;
  if (existingSlugs.has(page.slug)) throw new Error(`Slug already exists: ${page.slug}`);

  const purpose = extractPurpose(html, elements);
  let characteristics = extractCharacteristics(html, elements);
  if (characteristics.length === 0) characteristics = extractExternalCharacteristics(html);
  if (characteristics.length === 0 && page.slug === 'rlsm-10') {
    const features = elements.find((item) => item.text.startsWith('Поддержка цифровых стандартов'));
    if (features) characteristics = [{ name: 'Основные возможности', value: features.text }];
  }
  const product = {
    slug: page.slug,
    title,
    section: 'Оборудование радиосвязи',
    series: inferSeries(title),
    type: inferType(title),
    short_description: purpose,
    hero_description: purpose,
    description: purpose,
    purpose,
    catalog_url: '/radio-equipment',
    cta_text: 'Получить консультацию',
    source_url: page.requested_url,
    legacy_source_url: page.requested_url,
    legacy_text: extractAllText(html),
    sort: 1000 + importedProducts.length * 10,
    status: 'published'
  };
  importedProducts.push(product);
  characteristics.forEach((row, index) => {
    importedCharacteristics.push({
      product_slug: page.slug,
      group: 'Технические характеристики',
      name: row.name,
      value: row.value,
      unit: '',
      sort: (index + 1) * 10
    });
  });
  console.log(`${page.slug}: ${characteristics.length} characteristics`);
}

data.products.push(...importedProducts);
data.characteristics.push(...importedCharacteristics);
for (const value of ['Оборудование радиосвязи']) {
  if (!data.dictionaries.sections.includes(value)) data.dictionaries.sections.push(value);
}
for (const value of ['Антенна', 'Радиостанция', 'Дуплексный фильтр']) {
  if (!data.dictionaries.types.includes(value)) data.dictionaries.types.push(value);
}
for (const value of importedProducts.map((product) => product.series)) {
  if (!data.dictionaries.series.includes(value)) data.dictionaries.series.push(value);
}

await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(`Imported ${importedProducts.length} products and ${importedCharacteristics.length} characteristics.`);
