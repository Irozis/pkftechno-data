import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const SOURCE_PAGE = 'http://pkftechno.ru/pss2ptest';
const ROOT = process.cwd();
const DATA_PATH = path.join(ROOT, 'data', 'products.json');
const BACKUP_PATH = path.join(ROOT, 'data', 'products.before-card-images.json');
const REPORT_DIR = path.join(ROOT, 'tmp', 'pkftechno-card-images-dry-run');
const WRITE = process.argv.includes('--write');

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

function fail(message) {
  console.error(`\n[scrape-pkftechno-card-images] ERROR: ${message}\n`);
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

function normalizeUrl(value = '') {
  const raw = decodeHtml(value).trim();
  if (!raw || raw.startsWith('data:') || raw.startsWith('#')) return '';

  try {
    return new URL(raw, SOURCE_PAGE).href;
  } catch {
    return '';
  }
}

function getAttributes(tag = '') {
  const attributes = {};
  const pattern = /([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g;

  for (const match of tag.matchAll(pattern)) {
    attributes[match[1]] = decodeHtml(match[3]);
  }

  return attributes;
}

function stripTags(html = '') {
  return decodeHtml(String(html).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function extractHref(html = '') {
  const match = html.match(/\bhref\s*=\s*(["'])([\s\S]*?)\1/i);
  return match ? decodeHtml(match[2]) : '';
}

function extractSlugFromHref(href = '') {
  try {
    return new URL(href, SOURCE_PAGE).searchParams.get('slug') || '';
  } catch {
    return '';
  }
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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
    for (const item of Array.isArray(gallery) ? gallery : []) {
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

function classifyImage(url = '') {
  if (!url) return 'placeholder';

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return 'placeholder';
  }

  const lower = url.toLowerCase();
  if (!parsed.hostname.endsWith('tildacdn.com')) return 'outside_card';
  if (lower.endsWith('.svg')) return 'logo_icon';
  if (lower.includes('logo') || lower.includes('icon')) return 'logo_icon';
  if (lower.includes('1x1') || lower.includes('/resize/20x/')) return 'placeholder';
  if (!/\.(png|jpe?g|webp)(?:[?#].*)?$/i.test(parsed.pathname + parsed.search)) return 'placeholder';

  return '';
}

function extractImagesFromElement(attributes, html) {
  const images = [];

  for (const key of ['src', 'data-original', 'data-img-zoom-url', 'data-img', 'data-bg', 'data-lazy', 'data-src']) {
    const url = normalizeUrl(attributes[key]);
    if (url) images.push(url);
  }

  if (attributes['data-field-imgs-value']) {
    images.push(...extractGalleryImages(attributes['data-field-imgs-value']));
  }

  images.push(...extractBackgroundImages(attributes.style));
  images.push(...extractBackgroundImages(html));

  return [...new Set(images)];
}

function extractZeroBlockElements(html) {
  const elements = [];
  const elementPattern = /<div\b[^>]*\bt396__elem\b[^>]*>[\s\S]*?<\/div>/gi;

  for (const match of html.matchAll(elementPattern)) {
    const elementHtml = match[0];
    const openTag = elementHtml.slice(0, elementHtml.indexOf('>') + 1);
    const attributes = getAttributes(openTag);
    const href = extractHref(elementHtml);
    const images = extractImagesFromElement(attributes, elementHtml);
    const top = numberOrNull(attributes['data-field-top-value']);
    const left = numberOrNull(attributes['data-field-left-value']);
    const width = numberOrNull(attributes['data-field-width-value']);
    const height = numberOrNull(attributes['data-field-height-value']);

    elements.push({
      id: attributes['data-elem-id'] || '',
      type: attributes['data-elem-type'] || '',
      top,
      left,
      width,
      height,
      href,
      slug: extractSlugFromHref(href),
      text: stripTags(elementHtml),
      images,
    });
  }

  return elements;
}

function getCardScope(anchor) {
  if (anchor.top == null || anchor.left == null || anchor.width == null || anchor.height == null) return null;

  return {
    top: anchor.top - 2,
    left: anchor.left - 2,
    right: anchor.left + anchor.width + 2,
    bottom: anchor.top + anchor.height + 2,
  };
}

function isInsideScope(element, scope) {
  if (!scope || element.top == null || element.left == null) return false;

  const centerX = element.left + ((element.width || 0) / 2);
  const centerY = element.top + ((element.height || 0) / 2);

  return centerX >= scope.left
    && centerX <= scope.right
    && centerY >= scope.top
    && centerY <= scope.bottom;
}

function isNearScope(element, scope) {
  if (!scope || element.top == null || element.left == null) return false;

  const centerX = element.left + ((element.width || 0) / 2);
  const centerY = element.top + ((element.height || 0) / 2);

  return centerX >= scope.left - 80
    && centerX <= scope.right + 80
    && centerY >= scope.top - 80
    && centerY <= scope.bottom + 80;
}

function collectCardImages(slug, anchor, elements) {
  if (!anchor) {
    return {
      method: 'dom_container',
      cardFound: false,
      freshImages: [],
      rejectedImages: [],
      status: 'card_scope_not_found',
    };
  }

  const scope = getCardScope(anchor);
  if (!scope) {
    return {
      method: 'dom_container',
      cardFound: false,
      freshImages: [],
      rejectedImages: [],
      status: 'card_scope_not_found',
    };
  }

  const freshImages = [];
  const rejectedImages = [];

  for (const element of elements.filter((item) => item.images.length > 0 && isNearScope(item, scope))) {
    for (const url of element.images) {
      if (!isInsideScope(element, scope)) {
        rejectedImages.push({ url, reason: 'outside_card', slug });
        continue;
      }

      const classification = classifyImage(url);
      if (classification) {
        rejectedImages.push({ url, reason: classification, slug });
        continue;
      }

      if (freshImages.includes(url)) {
        rejectedImages.push({ url, reason: 'duplicate', slug });
        continue;
      }

      freshImages.push(url);
    }
  }

  return {
    method: 'dom_container',
    cardFound: true,
    freshImages,
    rejectedImages,
    status: freshImages.length ? 'ok' : 'not_found_preserved_existing',
  };
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function printRows(rows) {
  const columns = ['title', 'slug', 'card_found', 'fresh_images_count', 'first_image_url', 'status'];
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

function printImageUrls(reports) {
  console.log('\nImage URLs by product:');
  for (const report of reports) {
    console.log(`${report.slug}:`);
    if (!report.fresh_images.length) {
      console.log('  none');
      continue;
    }
    report.fresh_images.forEach((url, index) => {
      console.log(`  ${(index + 1) * 10} ${url}`);
    });
  }
}

function printRejected(reports) {
  const rejected = reports.flatMap((report) => report.rejected_images || []);
  console.log('\nRejected:');
  console.log('url | reason | slug');
  console.log('----|--------|-----');
  if (!rejected.length) {
    console.log('none | none | none');
    return;
  }
  for (const item of rejected) {
    console.log(`${item.url} | ${item.reason} | ${item.slug}`);
  }
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  data.products = Array.isArray(data.products) ? data.products : [];
  data.images = Array.isArray(data.images) ? data.images : [];

  const productsBySlug = new Map(data.products.map((product) => [product.slug, product]));
  const response = await fetch(SOURCE_PAGE, {
    headers: {
      'user-agent': 'pkftechno-data-card-images/1.0',
      accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    fail(`Failed to fetch ${SOURCE_PAGE}: HTTP ${response.status}`);
  }

  const html = await response.text();
  const elements = extractZeroBlockElements(html);
  const targetSet = new Set(TARGET_SLUGS);
  const anchors = new Map();

  for (const slug of TARGET_SLUGS) {
    const candidates = elements.filter((element) => targetSet.has(element.slug) && element.slug === slug);
    const shape = candidates.find((element) => (
      element.type === 'shape'
      && (element.width || 0) >= 180
      && (element.height || 0) >= 180
    ));
    const fallback = candidates.find((element) => (
      (element.width || 0) >= 180
      && (element.height || 0) >= 80
    )) || candidates[0];

    if (shape || fallback) {
      anchors.set(slug, shape || fallback);
    }
  }

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, 'pss2ptest.html'), html, 'utf8');

  const reports = [];
  const rows = [];

  for (const slug of TARGET_SLUGS) {
    const product = productsBySlug.get(slug);
    const anchor = anchors.get(slug);
    const collected = collectCardImages(slug, anchor, elements);
    const report = {
      slug,
      source_page: SOURCE_PAGE,
      card_href: anchor?.href || '',
      method: collected.method,
      card_found: collected.cardFound,
      fresh_images: collected.freshImages,
      rejected_images: collected.rejectedImages,
      status: collected.status,
    };

    reports.push(report);
    writeJson(path.join(REPORT_DIR, `${slug}.json`), report);

    rows.push({
      title: product?.title || '',
      slug,
      card_found: report.card_found ? 'yes' : 'no',
      fresh_images_count: report.fresh_images.length,
      first_image_url: report.fresh_images[0] || '',
      status: report.status,
    });
  }

  if (WRITE) {
    if (!fs.existsSync(BACKUP_PATH)) {
      fs.copyFileSync(DATA_PATH, BACKUP_PATH);
    }

    const replacements = new Map();
    for (const report of reports) {
      const product = productsBySlug.get(report.slug);
      if (!product || report.fresh_images.length === 0) continue;

      product.image_url = report.fresh_images[0];
      replacements.set(report.slug, report.fresh_images.map((imageUrl, index) => ({
        product_slug: report.slug,
        image_url: imageUrl,
        alt: `${product.title || report.slug} - image ${index + 1}`,
        sort: (index + 1) * 10,
      })));
    }

    if (replacements.size > 0) {
      data.images = [
        ...data.images.filter((image) => !replacements.has(image.product_slug)),
        ...TARGET_SLUGS.flatMap((slug) => replacements.get(slug) || []),
      ];
      writeJson(DATA_PATH, data);
    }
  }

  console.log(`\n[scrape-pkftechno-card-images] Source: ${SOURCE_PAGE}`);
  console.log(`[scrape-pkftechno-card-images] Mode: ${WRITE ? 'write' : 'dry-run'}`);
  console.log(`[scrape-pkftechno-card-images] Report: ${path.relative(ROOT, REPORT_DIR)}`);
  if (WRITE) {
    console.log(`[scrape-pkftechno-card-images] Backup: ${path.relative(ROOT, BACKUP_PATH)}`);
    console.log(`[scrape-pkftechno-card-images] Updated: ${path.relative(ROOT, DATA_PATH)}`);
  }
  printRows(rows);
  printImageUrls(reports);
  printRejected(reports);

  const failed = rows.filter((row) => row.status === 'product_not_found');
  if (failed.length) {
    process.exitCode = 1;
  }
}

main();
