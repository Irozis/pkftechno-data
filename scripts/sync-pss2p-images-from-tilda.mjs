import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SOURCE_URL = 'https://pkftechno.ru/pss2ptest';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(rootDir, 'data', 'products.json');

const targets = [
  { title: 'Шкаф силовой 1 МГ', slug: 'shs1-mg-pss-2p' },
  { title: 'Шкаф силовой 2 МГ', slug: 'shs2-mg-pss-2p' },
  { title: 'Шкаф силовой 3 МГ', slug: 'shs3-mg-pss-2p' },
  { title: 'Шкаф управления МГ', slug: 'shu-mg-pss-2p', titleAliases: ['Шкаф упраления МГ'] },
  { title: 'Пульт управления МГ', slug: 'pu-mg-pss-2p' },
  { title: 'Шкаф коммутации ПП-1', slug: 'shk-pp-1-pss-2p', slugAliases: ['shk-pp1-pss-2p'] },
  { title: 'Шкаф коммутации ПП-2', slug: 'shk-pp-2-pss-2p', slugAliases: ['shk-pp2-pss-2p'] },
  { title: 'Шкаф коммутации ПП-3', slug: 'shk-pp-3-pss-2p', slugAliases: ['shk-pp3-pss-2p'] },
  { title: 'Пульт управления ПК', slug: 'pu-pk-pss-2p' },
  { title: 'Шкаф управления ПК', slug: 'shu-pk-pss-2p' },
  { title: 'Шкаф коммутации 1 ПК', slug: 'shk1-pk-pss-2p' },
  { title: 'Шкаф коммутации 2 ПК', slug: 'shk2-pk-pss-2p' },
  { title: 'Шкаф тиристорных модулей ПК', slug: 'shtm-pk-pss-2p' },
  { title: 'Шкаф силовой ПК', slug: 'shs-pk-pss-2p' }
];

function decodeHtml(value = '') {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#034;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function normalizeText(value = '') {
  return decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getAttributes(tag) {
  const attributes = {};
  const attributePattern = /([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g;

  for (const match of tag.matchAll(attributePattern)) {
    attributes[match[1]] = decodeHtml(match[3]);
  }

  return attributes;
}

function getElementText(html) {
  return decodeHtml(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function extractHref(html) {
  const match = html.match(/\bhref\s*=\s*(["'])([\s\S]*?)\1/i);
  return match ? decodeHtml(match[2]) : '';
}

function extractBackgroundImages(value = '') {
  return [...String(value).matchAll(/url\((["']?)(.*?)\1\)/gi)]
    .map((match) => decodeHtml(match[2]).trim())
    .filter(Boolean);
}

function extractImageUrls(element) {
  const images = [];

  if (element.attributes['data-field-imgs-value']) {
    try {
      const galleryItems = JSON.parse(element.attributes['data-field-imgs-value']);
      for (const item of galleryItems) {
        if (item?.li_img) {
          images.push(item.li_img);
        }
      }
    } catch {
      // Some Tilda blocks contain malformed or editor-only values. Other image
      // attributes below still give the script a chance to resolve the card.
    }
  }

  for (const key of ['src', 'data-original', 'data-img-zoom-url', 'data-img', 'data-bg']) {
    if (element.attributes[key]) {
      images.push(element.attributes[key]);
    }
  }

  images.push(...extractBackgroundImages(element.attributes.style));
  images.push(...extractBackgroundImages(element.html));

  return [...new Set(images)]
    .map((url) => url.trim())
    .filter((url) => /^https?:\/\//i.test(url));
}

function extractElements(html) {
  const elements = [];
  const elementPattern = /<div\b[^>]*\bt396__elem\b[^>]*>[\s\S]*?<\/div>/gi;

  for (const match of html.matchAll(elementPattern)) {
    const elementHtml = match[0];
    const tag = elementHtml.slice(0, elementHtml.indexOf('>') + 1);
    const attributes = getAttributes(tag);
    const images = extractImageUrls({ attributes, html: elementHtml });

    elements.push({
      id: attributes['data-elem-id'] || '',
      type: attributes['data-elem-type'] || '',
      top: Number(attributes['data-field-top-value']),
      left: Number(attributes['data-field-left-value']),
      width: Number(attributes['data-field-width-value']),
      height: Number(attributes['data-field-height-value']),
      text: getElementText(elementHtml),
      href: extractHref(elementHtml),
      images,
      attributes,
      html: elementHtml
    });
  }

  return elements;
}

function getSlugFromHref(href) {
  if (!href) {
    return '';
  }

  try {
    return new URL(href, SOURCE_URL).searchParams.get('slug') || '';
  } catch {
    return '';
  }
}

function findCardImage(titleElement, imageElements) {
  const candidates = imageElements
    .filter((element) => {
      if (!Number.isFinite(element.top) || !Number.isFinite(element.left)) {
        return false;
      }

      const horizontalDistance = Math.abs(element.left - titleElement.left);
      const verticalDistance = titleElement.top - element.top;

      return verticalDistance > 0 && verticalDistance <= 260 && horizontalDistance <= 90;
    })
    .map((element) => ({
      element,
      score: Math.abs(titleElement.left - element.left) + Math.abs(titleElement.top - element.top) * 0.25
    }))
    .sort((a, b) => a.score - b.score);

  if (candidates.length === 0) {
    return { status: 'image_not_found', imageUrl: '' };
  }

  if (candidates.length > 1 && Math.abs(candidates[0].score - candidates[1].score) < 1) {
    return { status: 'ambiguous_card', imageUrl: candidates[0].element.images[0] || '' };
  }

  return { status: 'updated', imageUrl: candidates[0].element.images[0] || '' };
}

function findImageAfterCardHref(html, pageSlug) {
  if (!pageSlug) {
    return '';
  }

  const hrefIndex = html.indexOf(`product?slug=${pageSlug}`);

  if (hrefIndex === -1) {
    return '';
  }

  const nearbyHtml = html.slice(hrefIndex, hrefIndex + 14000);
  const match = nearbyHtml.match(/\bdata-field-imgs-value\s*=\s*(["'])([\s\S]*?)\1/i);

  if (!match) {
    return '';
  }

  try {
    const galleryItems = JSON.parse(decodeHtml(match[2]));
    return galleryItems.find((item) => item?.li_img)?.li_img || '';
  } catch {
    return '';
  }
}

function findProduct(data, target, pageSlug) {
  const slugsToTry = [target.slug, pageSlug, ...(target.slugAliases || [])].filter(Boolean);

  for (const slug of slugsToTry) {
    const product = data.products.find((item) => item.slug === slug);
    if (product) {
      return product;
    }
  }

  return null;
}

function printRows(rows) {
  const columns = ['slug', 'title', 'image_url', 'status'];
  const widths = Object.fromEntries(
    columns.map((column) => [
      column,
      Math.max(column.length, ...rows.map((row) => String(row[column] || '').length))
    ])
  );

  const format = (row) => columns.map((column) => String(row[column] || '').padEnd(widths[column])).join(' | ');
  console.log(format(Object.fromEntries(columns.map((column) => [column, column]))));
  console.log(columns.map((column) => '-'.repeat(widths[column])).join('-|-'));
  for (const row of rows) {
    console.log(format(row));
  }
}

const response = await fetch(SOURCE_URL);

if (!response.ok) {
  throw new Error(`Не удалось открыть ${SOURCE_URL}: HTTP ${response.status}`);
}

const html = await response.text();
const data = JSON.parse(await readFile(dataPath, 'utf8'));

if (!Array.isArray(data.products)) {
  throw new Error('data/products.json: поле products должно быть массивом.');
}

if (!Array.isArray(data.images)) {
  data.images = [];
}

const elements = extractElements(html);
const titleElements = elements.filter((element) => element.href.includes('product?slug=') && element.text);
const imageElements = elements.filter((element) => element.images.length > 0);
const rows = [];
const updatedImages = [];
const allTargetSlugs = new Set(targets.flatMap((target) => [target.slug, ...(target.slugAliases || [])]));
const changedProducts = new Set();

for (const target of targets) {
  const targetTitles = [target.title, ...(target.titleAliases || [])].map((title) => normalizeText(title));
  const matches = titleElements.filter((element) => targetTitles.includes(normalizeText(element.text)));
  const row = {
    slug: target.slug,
    title: target.title,
    image_url: '',
    status: 'image_not_found'
  };

  if (matches.length !== 1) {
    row.status = matches.length === 0 ? 'image_not_found' : 'ambiguous_card';
    rows.push(row);
    continue;
  }

  const titleElement = matches[0];
  const pageSlug = getSlugFromHref(titleElement.href);
  const product = findProduct(data, target, pageSlug);

  if (!product) {
    row.status = 'product_not_found';
    rows.push(row);
    continue;
  }

  const image = findCardImage(titleElement, imageElements);
  const fallbackImageUrl = image.imageUrl || findImageAfterCardHref(html, pageSlug);
  row.slug = product.slug;
  row.image_url = fallbackImageUrl;
  row.status = fallbackImageUrl ? 'updated' : image.status;

  if (row.status === 'updated' && fallbackImageUrl) {
    product.image_url = fallbackImageUrl;
    if (Object.hasOwn(product, 'image')) {
      product.image = fallbackImageUrl;
    }

    updatedImages.push({
      product_slug: product.slug,
      image_url: fallbackImageUrl,
      alt: target.title,
      sort: 10
    });

    changedProducts.add(product.slug);
  }

  rows.push(row);
}

for (const slug of changedProducts) {
  allTargetSlugs.add(slug);
}

data.images = [
  ...data.images.filter((image) => !allTargetSlugs.has(image.product_slug)),
  ...updatedImages
];

await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
printRows(rows);
