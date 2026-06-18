import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(rootDir, 'data', 'products.json');

const errors = [];

function fail(message) {
  errors.push(message);
}

function assertArray(value, name) {
  if (!Array.isArray(value)) {
    fail(`Поле "${name}" должно быть массивом.`);
    return [];
  }

  return value;
}

function hasSlug(product) {
  return typeof product.slug === 'string' && product.slug.trim() !== '';
}

let data;

try {
  const raw = await readFile(dataPath, 'utf8');
  data = JSON.parse(raw);
} catch (error) {
  console.error(`Ошибка: не удалось прочитать или разобрать JSON: ${dataPath}`);
  console.error(error.message);
  process.exit(1);
}

const products = assertArray(data.products, 'products');
const characteristics = assertArray(data.characteristics, 'characteristics');
const images = assertArray(data.images, 'images');
const relatedProducts = assertArray(data.related_products, 'related_products');

if (!data.dictionaries || typeof data.dictionaries !== 'object' || Array.isArray(data.dictionaries)) {
  fail('Поле "dictionaries" должно быть объектом.');
} else {
  assertArray(data.dictionaries.types, 'dictionaries.types');
  assertArray(data.dictionaries.series, 'dictionaries.series');
  assertArray(data.dictionaries.sections, 'dictionaries.sections');
}

const slugs = new Set();

products.forEach((product, index) => {
  if (!hasSlug(product)) {
    fail(`products[${index}]: поле "slug" обязательно.`);
    return;
  }

  if (slugs.has(product.slug)) {
    fail(`products[${index}]: slug "${product.slug}" повторяется.`);
    return;
  }

  slugs.add(product.slug);
});

characteristics.forEach((item, index) => {
  if (!slugs.has(item.product_slug)) {
    fail(`characteristics[${index}]: product_slug "${item.product_slug}" не найден в products.`);
  }
});

images.forEach((item, index) => {
  if (!slugs.has(item.product_slug)) {
    fail(`images[${index}]: product_slug "${item.product_slug}" не найден в products.`);
  }
});

relatedProducts.forEach((item, index) => {
  if (!slugs.has(item.product_slug)) {
    fail(`related_products[${index}]: product_slug "${item.product_slug}" не найден в products.`);
  }

  if (!slugs.has(item.related_slug)) {
    fail(`related_products[${index}]: related_slug "${item.related_slug}" не найден в products.`);
  }
});

if (errors.length > 0) {
  console.error('Данные не прошли проверку:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Данные корректны.');
console.log(`Товаров: ${products.length}`);
console.log(`Характеристик: ${characteristics.length}`);
console.log(`Изображений: ${images.length}`);
console.log(`Связей похожих товаров: ${relatedProducts.length}`);
