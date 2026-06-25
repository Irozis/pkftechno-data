import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(rootDir, 'data', 'products.json');
const loaderPath = path.join(rootDir, 'tilda', 'product-loader.html');

const targets = [
  { title: 'Шкаф силовой 1 МГ', slug: 'shs1-mg-pss-2p' },
  { title: 'Шкаф силовой 2 МГ', slug: 'shs2-mg-pss-2p' },
  { title: 'Шкаф силовой 3 МГ', slug: 'shs3-mg-pss-2p' },
  { title: 'Шкаф управления МГ', slug: 'shu-mg-pss-2p' },
  { title: 'Пульт управления МГ', slug: 'pu-mg-pss-2p' },
  { title: 'Шкаф коммутации ПП-1', slug: 'shk-pp1-pss-2p' },
  { title: 'Шкаф коммутации ПП-2', slug: 'shk-pp2-pss-2p' },
  { title: 'Шкаф коммутации ПП-3', slug: 'shk-pp3-pss-2p' },
  { title: 'Пульт управления ПК', slug: 'pu-pk-pss-2p' },
  { title: 'Шкаф управления ПК', slug: 'shu-pk-pss-2p' },
  { title: 'Шкаф коммутации 1 ПК', slug: 'shk1-pk-pss-2p' },
  { title: 'Шкаф коммутации 2 ПК', slug: 'shk2-pk-pss-2p' },
  { title: 'Шкаф тиристорных модулей ПК', slug: 'shtm-pk-pss-2p' },
  { title: 'Шкаф силовой ПК', slug: 'shs-pk-pss-2p' }
];

function getSortValue(item) {
  const sort = Number(item?.sort);
  return Number.isFinite(sort) ? sort : 0;
}

function getLoaderStatus(loaderHtml) {
  const hasImageTarget = loaderHtml.includes('js-product-image');
  const hasSlugScopedImages = loaderHtml.includes('item.product_slug === product.slug');
  const setsImgSrc = loaderHtml.includes("setAttribute('src', imageUrl)");
  const setsBackground = loaderHtml.includes('backgroundImage');

  return hasImageTarget && hasSlugScopedImages && setsImgSrc && setsBackground;
}

function printRows(rows) {
  const columns = ['title', 'slug', 'image_url', 'images_count', 'status'];
  const widths = Object.fromEntries(
    columns.map((column) => [
      column,
      Math.max(column.length, ...rows.map((row) => String(row[column] || '').length))
    ])
  );

  const format = (row) => columns.map((column) => String(row[column] || '').padEnd(widths[column])).join(' | ');
  console.log(format(Object.fromEntries(columns.map((column) => [column, column]))));
  console.log(columns.map((column) => '-'.repeat(widths[column])).join('-|-'));
  rows.forEach((row) => console.log(format(row)));
}

const data = JSON.parse(await readFile(dataPath, 'utf8'));
const loaderHtml = await readFile(loaderPath, 'utf8');
const products = Array.isArray(data.products) ? data.products : [];
const images = Array.isArray(data.images) ? data.images : [];
const loaderOk = getLoaderStatus(loaderHtml);

const rows = targets.map((target) => {
  const product = products.find((item) => item.slug === target.slug);

  if (!product) {
    return {
      title: target.title,
      slug: target.slug,
      image_url: '',
      images_count: 0,
      status: 'product_not_found'
    };
  }

  const mainImages = images
    .filter((item) => item.product_slug === product.slug && getSortValue(item) === 10)
    .sort((a, b) => getSortValue(a) - getSortValue(b));
  const mainImage = mainImages[0];
  const imageUrl = product.image_url || mainImage?.image_url || '';

  let status = 'ok';

  if (!loaderOk) {
    status = 'loader_target_missing';
  } else if (!product.image_url || !mainImage?.image_url) {
    status = 'image_not_found';
  } else if (mainImages.length !== 1) {
    status = 'duplicate_images';
  } else if (mainImage.product_slug !== product.slug) {
    status = 'image_not_found';
  }

  return {
    title: target.title,
    slug: product.slug,
    image_url: imageUrl,
    images_count: mainImages.length,
    status
  };
});

printRows(rows);

const failed = rows.filter((row) => row.status !== 'ok');

if (failed.length > 0) {
  process.exitCode = 1;
}
