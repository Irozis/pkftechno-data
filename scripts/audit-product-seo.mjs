import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(rootDir, 'data', 'products.json');
const siteName = 'ПКФ «Технология»';

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function getSeoTitle(product) {
  const title = normalizeText(product.seo_title || product.title || product.slug);
  if (product.seo_title) return title;
  const brandedTitle = `${title} | ${siteName}`;
  return brandedTitle.length <= 75 ? brandedTitle : title;
}

function getSeoDescription(product) {
  return normalizeText(
    product.seo_description ||
    product.description ||
    product.hero_description ||
    product.short_description ||
    product.purpose
  );
}

function findDuplicates(products, getValue) {
  const values = new Map();

  for (const product of products) {
    const value = getValue(product);
    if (!value) continue;
    if (!values.has(value)) values.set(value, []);
    values.get(value).push(product.slug);
  }

  return [...values.entries()]
    .filter(([, slugs]) => slugs.length > 1)
    .map(([value, slugs]) => ({ value, slugs }));
}

const data = JSON.parse(await readFile(dataPath, 'utf8'));
const products = Array.isArray(data.products) ? data.products : [];
const titleDuplicates = findDuplicates(products, getSeoTitle);
const descriptionDuplicates = findDuplicates(products, getSeoDescription);
const missingDescriptions = products.filter((product) => !getSeoDescription(product));
const longTitles = products.filter((product) => getSeoTitle(product).length > 75);
const shortDescriptions = products.filter((product) => {
  const description = getSeoDescription(product);
  return description && description.length < 70;
});

console.log('SEO-аудит карточек продукции');
console.log(`Товаров: ${products.length}`);
console.log(`Уникальных canonical URL: ${new Set(products.map((product) => `/product?slug=${encodeURIComponent(product.slug)}`)).size}`);
console.log(`Повторяющихся SEO Title: ${titleDuplicates.length}`);
console.log(`Повторяющихся исходных Description: ${descriptionDuplicates.length}`);
console.log(`Без описания: ${missingDescriptions.length}`);
console.log(`Title длиннее 75 символов: ${longTitles.length}`);
console.log(`Description короче 70 символов: ${shortDescriptions.length}`);

if (titleDuplicates.length > 0) {
  console.log('\nПовторяющиеся SEO Title:');
  for (const duplicate of titleDuplicates) {
    console.log(`- ${duplicate.value}`);
    console.log(`  ${duplicate.slugs.join(', ')}`);
  }
}

if (missingDescriptions.length > 0) {
  console.log('\nТовары без описания:');
  for (const product of missingDescriptions) {
    console.log(`- ${product.slug}`);
  }
}

if (longTitles.length > 0) {
  console.log('\nДлинные Title, которые стоит проверить вручную:');
  for (const product of longTitles) {
    console.log(`- ${product.slug}: ${getSeoTitle(product).length} символов`);
  }
}

