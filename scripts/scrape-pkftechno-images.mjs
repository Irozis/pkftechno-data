import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const SOURCE_PAGE = 'https://pkftechno.ru/pss2ptest';
const ROOT = process.cwd();
const DATA_PATH = path.join(ROOT, 'data', 'products.json');
const BACKUP_PATH = path.join(ROOT, 'data', 'products.before-fresh-card-images.json');
const OLD_IMAGE_BASELINE_PATH = path.join(ROOT, 'data', 'products.before-card-images.json');
const RAW_DIR = path.join(ROOT, 'tmp', 'pkftechno-card-images-scrape');

const TARGET_SLUGS = [
  'shs1-mg-pss-2p',
  'shs2-mg-pss-2p',
  'shs3-mg-pss-2p',
  'shu-mg-pss-2p',
  'pu-mg-pss-2p',
  'shk-pp1-pss-2p',
  'shk-pp2-pss-2p',
  'shk-pp3-pss-2p',
  'pu-pk-pss-2p',
  'shu-pk-pss-2p',
  'shk1-pk-pss-2p',
  'shk2-pk-pss-2p',
  'shtm-pk-pss-2p',
  'shs-pk-pss-2p',
];

const TITLE_ALIASES = {
  'shs1-mg-pss-2p': ['Шкаф силовой 1 МГ', 'ШС1 МГ ПСС-2П'],
  'shs2-mg-pss-2p': ['Шкаф силовой 2 МГ', 'ШС2 МГ ПСС-2П'],
  'shs3-mg-pss-2p': ['Шкаф силовой 3 МГ', 'ШС3 МГ ПСС-2П'],
  'shu-mg-pss-2p': ['Шкаф управления МГ', 'ШУ МГ ПСС-2П'],
  'pu-mg-pss-2p': ['Пульт управления МГ', 'ПУ МГ ПСС-2П'],
  'shk-pp1-pss-2p': ['Шкаф коммутации ПП-1', 'ШК ПП-1 ПСС-2П'],
  'shk-pp2-pss-2p': ['Шкаф коммутации ПП-2', 'ШК ПП-2 ПСС-2П'],
  'shk-pp3-pss-2p': ['Шкаф коммутации ПП-3', 'ШК ПП-3 ПСС-2П'],
  'pu-pk-pss-2p': ['Пульт управления ПК', 'ПУ ПК ПСС-2П'],
  'shu-pk-pss-2p': ['Шкаф управления ПК', 'ШУ ПК ПСС-2П'],
  'shk1-pk-pss-2p': ['Шкаф коммутации 1 ПК', 'ШК1 ПК ПСС-2П'],
  'shk2-pk-pss-2p': ['Шкаф коммутации 2 ПК', 'ШК2 ПК ПСС-2П'],
  'shtm-pk-pss-2p': ['Шкаф тиристорных модулей ПК', 'ШТМ ПК ПСС-2П'],
  'shs-pk-pss-2p': ['Шкаф силовой ПК', 'ШС ПК ПСС-2П'],
};

function fail(message) {
  console.error(`\n[scrape-pkftechno-images] ERROR: ${message}\n`);
  process.exit(1);
}

function decodeHtml(value = '') {
  const named = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  };

  return String(value).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const key = entity.toLowerCase();
    if (key.startsWith('#x')) return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
    if (key.startsWith('#')) return String.fromCodePoint(Number.parseInt(key.slice(1), 10));
    return named[key] || match;
  });
}

function normalizeText(value = '') {
  return decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeUrl(url) {
  const value = decodeHtml(url).trim();
  if (!value || value.startsWith('data:') || value.startsWith('#')) return '';

  try {
    return new URL(value, SOURCE_PAGE).href;
  } catch {
    return '';
  }
}

function getAttributes(tag) {
  const attributes = {};
  const pattern = /([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g;

  for (const match of tag.matchAll(pattern)) {
    attributes[match[1]] = decodeHtml(match[3]);
  }

  return attributes;
}

function stripTags(html) {
  return decodeHtml(String(html).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function extractHref(html) {
  const match = html.match(/\bhref\s*=\s*(["'])([\s\S]*?)\1/i);
  return match ? decodeHtml(match[2]) : '';
}

function extractSlugFromHref(href) {
  if (!href) return '';

  try {
    return new URL(href, SOURCE_PAGE).searchParams.get('slug') || '';
  } catch {
    return '';
  }
}

function extractBackgroundImages(value = '') {
  return [...String(value).matchAll(/url\((["']?)(.*?)\1\)/gi)]
    .map((match) => normalizeUrl(match[2]))
    .filter(Boolean);
}

function extractGalleryImages(rawValue = '') {
  const decoded = decodeHtml(rawValue);
  const images = [];

  try {
    const gallery = JSON.parse(decoded);
    for (const item of gallery) {
      for (const key of ['li_img', 'img', 'src']) {
        const url = normalizeUrl(item?.[key]);
        if (url) images.push(url);
      }
    }
  } catch {
    const matches = decoded.matchAll(/https?:\/\/[^"'\s<>]+?\.(?:png|jpe?g|webp)(?:\?[^"'\s<>]*)?/gi);
    for (const match of matches) {
      const url = normalizeUrl(match[0]);
      if (url) images.push(url);
    }
  }

  return images;
}

function isUsefulImage(url) {
  const lower = url.toLowerCase();
  return /^https?:\/\//.test(url)
    && /^https?:\/\/(?:static|thb|thumb|thumbs|optim|optim\.tildacdn|static\.tildacdn|thb\.tildacdn)\.com\//i.test(url)
    && !lower.includes('/resize/20x/')
    && !lower.includes('1x1')
    && !lower.endsWith('.svg')
    && !lower.includes('logo')
    && !lower.includes('icon');
}

function extractImagesFromElement(attributes, html) {
  const images = [];

  if (attributes['data-field-imgs-value']) {
    images.push(...extractGalleryImages(attributes['data-field-imgs-value']));
  }

  for (const key of [
    'src',
    'data-original',
    'data-img-zoom-url',
    'data-img',
    'data-bg',
    'data-lazy',
    'data-src',
  ]) {
    const url = normalizeUrl(attributes[key]);
    if (url) images.push(url);
  }

  images.push(...extractBackgroundImages(attributes.style));
  images.push(...extractBackgroundImages(html));

  return [...new Set(images)].filter(isUsefulImage);
}

function extractElements(html) {
  const elements = [];
  const elementPattern = /<div\b[^>]*\bt396__elem\b[^>]*>[\s\S]*?<\/div>/gi;

  for (const match of html.matchAll(elementPattern)) {
    const elementHtml = match[0];
    const tag = elementHtml.slice(0, elementHtml.indexOf('>') + 1);
    const attributes = getAttributes(tag);
    const href = extractHref(elementHtml);
    const top = Number(attributes['data-field-top-value']);
    const left = Number(attributes['data-field-left-value']);
    const width = Number(attributes['data-field-width-value']);
    const height = Number(attributes['data-field-height-value']);

    elements.push({
      id: attributes['data-elem-id'] || '',
      type: attributes['data-elem-type'] || '',
      top,
      left,
      width,
      height,
      text: stripTags(elementHtml),
      href,
      slug: extractSlugFromHref(href),
      images: extractImagesFromElement(attributes, elementHtml),
      html: elementHtml,
    });
  }

  return elements;
}

function getCardAnchors(elements, productsBySlug) {
  const anchors = new Map();
  const targetSet = new Set(TARGET_SLUGS);

  for (const element of elements) {
    if (targetSet.has(element.slug) && !anchors.has(element.slug)) {
      anchors.set(element.slug, {
        element,
        href: element.href,
        match: 'href_slug',
      });
    }
  }

  for (const slug of TARGET_SLUGS) {
    if (anchors.has(slug)) continue;

    const product = productsBySlug.get(slug);
    const aliases = [product?.title, ...(TITLE_ALIASES[slug] || [])]
      .filter(Boolean)
      .map(normalizeText);

    const candidates = elements.filter((element) => (
      element.href.includes('product?slug=')
      && aliases.includes(normalizeText(element.text))
      && Number.isFinite(element.top)
      && Number.isFinite(element.left)
    ));

    if (candidates.length > 0) {
      anchors.set(slug, {
        element: candidates[0],
        href: candidates[0].href,
        match: 'title_fallback',
      });
    }
  }

  return anchors;
}

function collectCardImages(anchor, imageElements, oldImageUrls) {
  const source = anchor.element;

  const candidates = imageElements
    .filter((element) => {
      if (!Number.isFinite(element.top) || !Number.isFinite(element.left)) return false;

      const horizontalDistance = Math.abs(source.left - element.left);
      const cardBottom = source.top + (Number.isFinite(source.height) ? source.height : 330);

      return element.top >= source.top - 30
        && element.top <= cardBottom
        && horizontalDistance <= 190;
    })
    .map((element) => ({
      element,
      score: Math.abs(source.left - element.left) + Math.abs(source.top - element.top) * 0.2,
    }))
    .sort((a, b) => a.score - b.score);

  const freshImages = [];
  const rejectedImages = [];
  for (const candidate of candidates) {
    for (const url of candidate.element.images) {
      if (oldImageUrls.has(url)) {
        rejectedImages.push({ url, reason: 'old_global_image' });
        continue;
      }

      if (!isUsefulImage(url)) {
        rejectedImages.push({ url, reason: 'logo_icon' });
        continue;
      }

      if (freshImages.includes(url)) {
        rejectedImages.push({ url, reason: 'duplicate' });
        continue;
      }

      freshImages.push(url);
    }
  }

  return {
    freshImages,
    rejectedImages,
    cardHtmlPreview: source.html.slice(0, 2000),
  };
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function printRows(rows) {
  const columns = ['title', 'slug', 'old_images_count', 'fresh_images_count', 'final_images_count', 'status'];
  const widths = Object.fromEntries(
    columns.map((column) => [
      column,
      Math.max(column.length, ...rows.map((row) => String(row[column] ?? '').length)),
    ]),
  );
  const format = (row) => columns.map((column) => String(row[column] ?? '').padEnd(widths[column])).join(' | ');

  console.log(format(Object.fromEntries(columns.map((column) => [column, column]))));
  console.log(columns.map((column) => '-'.repeat(widths[column])).join('-|-'));
  rows.forEach((row) => console.log(format(row)));
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  data.products = Array.isArray(data.products) ? data.products : [];
  data.images = Array.isArray(data.images) ? data.images : [];

  const oldBaseline = fs.existsSync(OLD_IMAGE_BASELINE_PATH)
    ? JSON.parse(fs.readFileSync(OLD_IMAGE_BASELINE_PATH, 'utf8'))
    : null;
  const oldBaselineImages = Array.isArray(oldBaseline?.images) ? oldBaseline.images : [];
  const oldImageUrls = new Set(oldBaselineImages
    .map((image) => normalizeUrl(image.image_url))
    .filter(Boolean));

  const productsBySlug = new Map(data.products.map((product) => [product.slug, product]));
  const oldImagesBySlug = new Map(TARGET_SLUGS.map((slug) => [
    slug,
    data.images.filter((image) => image.product_slug === slug),
  ]));

  fs.mkdirSync(RAW_DIR, { recursive: true });

  if (!fs.existsSync(BACKUP_PATH)) {
    fs.copyFileSync(DATA_PATH, BACKUP_PATH);
  }

  const response = await fetch(SOURCE_PAGE, {
    headers: {
      'user-agent': 'pkftechno-data-card-image-scraper/1.0',
      accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    fail(`Не удалось открыть ${SOURCE_PAGE}: HTTP ${response.status}`);
  }

  const html = await response.text();
  fs.writeFileSync(path.join(RAW_DIR, 'pss2ptest.html'), html, 'utf8');

  const elements = extractElements(html);
  const imageElements = elements.filter((element) => element.images.length > 0);
  const anchors = getCardAnchors(elements, productsBySlug);
  const replacements = new Map();
  const summary = [];
  const multiple = [];

  for (const slug of TARGET_SLUGS) {
    const product = productsBySlug.get(slug);
    const oldImages = oldImagesBySlug.get(slug) || [];
    const preservedFreshExisting = oldImages.filter((image) => (
      image.image_url && !oldImageUrls.has(normalizeUrl(image.image_url))
    ));

    if (!product) {
      summary.push({
        title: '',
        slug,
        old_images_count: 0,
        fresh_images_count: 0,
        final_images_count: 0,
        status: 'product_not_found',
      });
      continue;
    }

    const anchor = anchors.get(slug);
    let freshImages = [];
    let rejectedImages = [];
    let cardHtmlPreview = '';
    let status = 'card_not_found';

    if (anchor) {
      const collected = collectCardImages(anchor, imageElements, oldImageUrls);
      freshImages = collected.freshImages;
      rejectedImages = collected.rejectedImages;
      cardHtmlPreview = collected.cardHtmlPreview;

      if (freshImages.length === 0) {
        status = oldImages.length ? 'not_found_preserved_existing' : 'parse_failed_preserved_existing';
      } else {
        status = freshImages.length === 1 ? 'single_image_only' : 'ok';
      }
    }

    if (freshImages.length > 0) {
      product.image_url = freshImages[0];
      replacements.set(
        slug,
        freshImages.map((imageUrl, index) => ({
          product_slug: slug,
          image_url: imageUrl,
          alt: `${product.title || slug} — изображение ${index + 1}`,
          sort: (index + 1) * 10,
        })),
      );
    } else if (preservedFreshExisting.length > 0) {
      product.image_url = preservedFreshExisting[0].image_url;
      replacements.set(slug, preservedFreshExisting.map((image, index) => ({
        ...image,
        product_slug: slug,
        sort: (index + 1) * 10,
      })));
    }

    const finalCount = freshImages.length || preservedFreshExisting.length || oldImages.length;

    if (finalCount > 1) {
      multiple.push({
        title: product.title || '',
        slug,
        final_images_count: finalCount,
      });
    }

    const rawPayload = {
      slug,
      card_href: anchor?.href || '',
      card_html_preview: cardHtmlPreview,
      match: anchor?.match || '',
      fresh_images: freshImages,
      rejected_images: rejectedImages,
      final_images_count: finalCount,
      status,
    };
    writeJson(path.join(RAW_DIR, `${slug}.json`), rawPayload);

    summary.push({
      title: product.title || '',
      slug,
      old_images_count: oldImages.length,
      fresh_images_count: freshImages.length,
      final_images_count: finalCount,
      status,
    });
  }

  if (replacements.size > 0) {
    data.images = [
      ...data.images.filter((image) => !replacements.has(image.product_slug)),
      ...TARGET_SLUGS.flatMap((slug) => replacements.get(slug) || []),
    ];
    writeJson(DATA_PATH, data);
  }

  console.log('\n[scrape-pkftechno-images] Source:', SOURCE_PAGE);
  console.log('[scrape-pkftechno-images] Backup:', path.relative(ROOT, BACKUP_PATH));
  console.log('[scrape-pkftechno-images] Raw output:', path.relative(ROOT, RAW_DIR));
  console.log('[scrape-pkftechno-images] Updated:', path.relative(ROOT, DATA_PATH));
  printRows(summary);

  console.log('\n[scrape-pkftechno-images] Products with multiple images:');
  if (multiple.length) {
    console.table(multiple);
  } else {
    console.log('none');
  }

  const failed = summary.filter((row) => (
    row.status === 'product_not_found'
    || row.status === 'card_not_found'
    || row.status === 'parse_failed_preserved_existing'
    || row.final_images_count === 0
  ));

  if (failed.length) {
    console.warn('\n[scrape-pkftechno-images] Есть товары без найденных и без сохраненных изображений:');
    console.table(failed);
    process.exitCode = 1;
  }
}

main();
