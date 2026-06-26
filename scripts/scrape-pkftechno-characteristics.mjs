import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const PRODUCTS_JSON_PATH = path.join(ROOT, 'data', 'products.json');
const BACKUP_JSON_PATH = path.join(ROOT, 'data', 'products.before-site-characteristics.json');
const SCRAPE_DIR = path.join(ROOT, 'tmp', 'pkftechno-characteristics-scrape');
const GROUP = 'Технические характеристики';

const PRODUCT_SOURCE_MAP = {
  'shs1-mg-pss-2p': 'https://pkftechno.ru/products/shkaf-silovoj-shs1-mg-pss-2p',
  'shs2-mg-pss-2p': 'https://pkftechno.ru/products/shkaf-silovoj-shs2-mg-pss-2p',
  'shs3-mg-pss-2p': 'https://pkftechno.ru/products/shkaf-silovoj-shs3-mg-pss-2p',

  'shu-mg-pss-2p': 'https://pkftechno.ru/products/shkaf-upravleniya-shu-mg-pss-2p',
  'pu-mg-pss-2p': 'https://pkftechno.ru/products/pult-upravleniya-pu-mg-pss-2p',

  'shk-pp1-pss-2p': 'https://pkftechno.ru/products/shkaf-kommutacii-shk-pp-1-pss-2p',
  'shk-pp2-pss-2p': 'https://pkftechno.ru/products/shkaf-kommutacii-shk-pp-2-pss-2p',
  'shk-pp3-pss-2p': 'https://pkftechno.ru/products/shkaf-kommutacii-shk-pp-3-pss-2p',

  'pu-pk-pss-2p': 'https://pkftechno.ru/products/pult-upravleniya-pu-pk-pss-2p',
  'shu-pk-pss-2p': 'https://pkftechno.ru/products/shkaf-upravleniya-shu-pk-pss-2p',
  'shk1-pk-pss-2p': 'https://pkftechno.ru/products/shkaf-kommutacii-shk1-pk-pss-2p',
  'shk2-pk-pss-2p': 'https://pkftechno.ru/products/shkaf-kommutacii-shk2-pk-pss-2p',
  'shtm-pk-pss-2p': 'https://pkftechno.ru/products/shkaf-tiristornyh-modulej-shtm-pk-pss-2p',
  'shs-pk-pss-2p': 'https://pkftechno.ru/products/shkaf-silovoj-shs-pk-pss-2p',
};

const DETAIL_SLUGS = [
  'shs1-mg-pss-2p',
  'shs2-mg-pss-2p',
  'shs3-mg-pss-2p',
  'shu-mg-pss-2p',
  'shs-pk-pss-2p',
];

const SERVICE_LINES = new Set([
  'Заказать',
  'Проконсультироваться',
  'Получить консультацию',
  'Отправить',
  'Параметр',
  'Значение',
  'Параметры и значения',
]);

const FALLBACK_FIELD_NAMES = new Set([
  'Тип изделия',
  'Серия',
  'Раздел',
  'Область применения',
  'Исполнение',
]);

const PARAMETER_HINTS = [
  'напряжение',
  'режим',
  'климат',
  'диапазон',
  'температур',
  'степень',
  'условия',
  'частота',
  'ток',
  'мощность',
  'габарит',
  'масса',
  'защиты',
  'сеть',
  'исполнение',
  'количество',
  'тип',
];

function fail(message) {
  console.error(`\n[scrape-pkftechno-characteristics] ERROR: ${message}\n`);
  process.exit(1);
}

function normalizeText(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
}

function decodeHtml(value) {
  const named = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    laquo: '«',
    raquo: '»',
    ndash: '–',
    mdash: '—',
    hellip: '…',
  };

  return String(value).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const key = entity.toLowerCase();
    if (key.startsWith('#x')) {
      return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
    }
    if (key.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(key.slice(1), 10));
    }
    return named[key] || match;
  });
}

function loadProductsJson() {
  if (!fs.existsSync(PRODUCTS_JSON_PATH)) {
    fail(`Не найден файл ${PRODUCTS_JSON_PATH}`);
  }

  const data = JSON.parse(fs.readFileSync(PRODUCTS_JSON_PATH, 'utf8'));
  data.products = Array.isArray(data.products) ? data.products : [];
  data.characteristics = Array.isArray(data.characteristics) ? data.characteristics : [];
  return data;
}

function getAlternativeUrls(url) {
  const alternatives = [];
  const typoPult = url.replace('/pult-upravleniya-', '/pul-upravlenya-');
  const typoShkaf = url.replace('/shkaf-upravleniya-', '/shkaf-upravlenya-');

  for (const candidate of [url, typoPult, typoShkaf]) {
    if (!alternatives.includes(candidate)) {
      alternatives.push(candidate);
    }
  }

  return alternatives;
}

async function fetchHtml(sourceUrl) {
  let lastStatus = 0;
  let lastUrl = sourceUrl;

  for (const url of getAlternativeUrls(sourceUrl)) {
    lastUrl = url;
    const response = await fetch(url, {
      headers: {
        'user-agent': 'pkftechno-data-characteristics-scraper/1.0',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    lastStatus = response.status;

    if (response.ok) {
      return {
        html: await response.text(),
        sourceUrl: url,
        statusCode: response.status,
      };
    }

    if (response.status !== 404) {
      break;
    }
  }

  return {
    html: '',
    sourceUrl: lastUrl,
    statusCode: lastStatus,
  };
}

function extractTitle(html) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const title = h1 || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
  return normalizeText(decodeHtml(title.replace(/<[^>]+>/g, ''))).replace(/\s*\|\s*.*$/, '');
}

function htmlToLines(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '\n')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '\n')
    .replace(/<(br|hr)\b[^>]*>/gi, '\n')
    .replace(/<\/(h[1-6]|p|div|li|td|th|tr|section|article|table|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  return decodeHtml(text)
    .split('\n')
    .map((line) => normalizeText(line))
    .filter(Boolean);
}

function isTechnicalHeading(line) {
  const lower = line.toLowerCase();
  return [
    'характеристики',
    'технические характеристики',
    'основные характеристики',
    'параметры',
    'технические данные',
  ].some((heading) => lower === heading || lower.includes(heading));
}

function isStopLine(line) {
  if (SERVICE_LINES.has(line)) {
    return true;
  }

  return [
    'Контакты',
    'Оставьте заявку',
    'Главная',
    'Продукция',
    'Портфолио',
    'Публичная оферта',
    'Политика',
  ].some((stop) => line === stop || line.startsWith(stop));
}

function looksLikeParameterName(line) {
  const lower = line.toLowerCase();
  if (line.length > 90) {
    return true;
  }

  return PARAMETER_HINTS.some((hint) => lower.includes(hint));
}

function looksLikeValue(line) {
  const lower = line.toLowerCase();
  return /[0-9]/.test(line)
    || lower.includes('гост')
    || lower.includes('ip')
    || lower.includes('продолж')
    || lower.includes('перем')
    || lower.includes('пост')
    || lower.includes('ток');
}

function cleanName(value) {
  return normalizeText(value)
    .replace(/^[•\-–—]+\s*/, '')
    .replace(/\s*[:;]\s*$/, '');
}

function cleanValue(value) {
  return normalizeText(value).replace(/^[•\-–—:]+\s*/, '');
}

function addCharacteristic(rows, name, value, raw) {
  const cleanedName = cleanName(name);
  const cleanedValue = cleanValue(value);

  if (!cleanedName || !cleanedValue) {
    return;
  }

  if (SERVICE_LINES.has(cleanedName) || SERVICE_LINES.has(cleanedValue)) {
    return;
  }

  if (cleanedName.length > 180 || cleanedValue.length > 220) {
    return;
  }

  if (rows.some((row) => row.name === cleanedName && row.value === cleanedValue)) {
    return;
  }

  rows.push({
    name: cleanedName,
    value: cleanedValue,
    raw: raw || `${cleanedName}: ${cleanedValue}`,
  });
}

function parseInlineRows(lines) {
  const rows = [];

  for (const line of lines) {
    for (const part of line.split(';').map((item) => normalizeText(item)).filter(Boolean)) {
      const match = part.match(/^([^:—–]{3,120})\s*(?::|\s[—–]\s)\s*(.{1,220})$/);
      if (match) {
        addCharacteristic(rows, match[1], match[2], part);
      }
    }
  }

  return rows;
}

function stripTags(value) {
  return normalizeText(decodeHtml(String(value).replace(/<[^>]+>/g, ' ')));
}

function extractTildaRecords(html) {
  const records = [];
  const recordRegex = /<div id="(rec\d+)"[\s\S]*?(?=<div id="rec\d+"|<\/body>)/gi;
  let recordMatch;

  while ((recordMatch = recordRegex.exec(html)) !== null) {
    records.push({
      id: recordMatch[1],
      html: recordMatch[0],
    });
  }

  return records;
}

function extractTextElements(recordHtml) {
  const elements = [];
  const elementRegex = /<div class=['"][^'"]*\btn-elem\b[^'"]*['"][^>]*data-elem-type=['"]text['"][\s\S]*?<\/div>/gi;
  let elementMatch;

  while ((elementMatch = elementRegex.exec(recordHtml)) !== null) {
    const block = elementMatch[0];
    const top = Number.parseFloat(block.match(/data-field-top-value=["'](-?\d+(?:\.\d+)?)["']/i)?.[1] ?? 'NaN');
    const left = Number.parseFloat(block.match(/data-field-left-value=["'](-?\d+(?:\.\d+)?)["']/i)?.[1] ?? 'NaN');
    const text = stripTags(block);

    if (!Number.isFinite(top) || !Number.isFinite(left) || !text) {
      continue;
    }

    elements.push({ top, left, text });
  }

  return elements;
}

function parseCoordinateCharacteristics(html) {
  const rows = [];

  for (const record of extractTildaRecords(html)) {
    const elements = extractTextElements(record.html);
    const marker = elements.find((element) => element.text.toLowerCase() === 'параметры и значения');

    if (!marker) {
      continue;
    }

    const desktopElements = elements
      .filter((element) => (
        element.top > marker.top
        && element.top < marker.top + 700
        && element.left >= 250
        && !SERVICE_LINES.has(element.text)
      ))
      .sort((a, b) => a.top - b.top || a.left - b.left);

    const names = desktopElements.filter((element) => element.left < 850);
    const values = desktopElements.filter((element) => element.left >= 850);

    for (const nameElement of names) {
      const valueElement = values.find((candidate) => Math.abs(candidate.top - nameElement.top) <= 18);
      if (!valueElement) {
        continue;
      }

      addCharacteristic(rows, nameElement.text, valueElement.text, `${nameElement.text}: ${valueElement.text}`);
    }

    if (rows.length) {
      return rows;
    }
  }

  return rows;
}

function getCharacteristicsWindow(lines) {
  const paramsIndex = lines.findIndex((line) => line.toLowerCase() === 'параметры и значения');
  if (paramsIndex >= 0) {
    return lines.slice(paramsIndex + 1);
  }

  const headingIndex = lines.findIndex(isTechnicalHeading);
  if (headingIndex >= 0) {
    return lines.slice(headingIndex + 1);
  }

  return [];
}

function parseCharacteristics(html) {
  const coordinateRows = parseCoordinateCharacteristics(html);
  if (coordinateRows.length) {
    return coordinateRows;
  }

  const lines = htmlToLines(html);
  const windowLines = getCharacteristicsWindow(lines);
  const rows = [];
  const candidates = [];

  for (const line of windowLines) {
    if (isStopLine(line) && candidates.length >= 2) {
      break;
    }

    if (SERVICE_LINES.has(line)) {
      continue;
    }

    if (line.includes('Нажимая на кнопку') || line.includes('персональных данных')) {
      break;
    }

    candidates.push(line);
  }

  rows.push(...parseInlineRows(candidates));

  for (let index = 0; index < candidates.length - 1; index += 1) {
    const name = candidates[index];
    const value = candidates[index + 1];

    if (name.includes(':') || name.includes('—')) {
      continue;
    }

    if (looksLikeParameterName(value) && !looksLikeValue(value)) {
      continue;
    }

    addCharacteristic(rows, name, value, `${name}: ${value}`);
    index += 1;
  }

  const onlyFallback = rows.length > 0
    && rows.every((row) => FALLBACK_FIELD_NAMES.has(row.name));

  if (onlyFallback) {
    return [];
  }

  return rows;
}

function toDataRows(slug, rows) {
  return rows.map((row, index) => ({
    product_slug: slug,
    group: GROUP,
    name: row.name,
    value: row.value,
    unit: '',
    sort: (index + 1) * 10,
  }));
}

function oldRowsForSlug(data, slug) {
  return data.characteristics.filter((item) => item.product_slug === slug);
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function main() {
  const data = loadProductsJson();
  const productsBySlug = new Map(data.products.map((product) => [product.slug, product]));
  const summary = [];
  const replacements = new Map();
  const rawResults = new Map();

  fs.mkdirSync(SCRAPE_DIR, { recursive: true });

  if (!fs.existsSync(BACKUP_JSON_PATH)) {
    fs.copyFileSync(PRODUCTS_JSON_PATH, BACKUP_JSON_PATH);
  }

  for (const [slug, sourceUrl] of Object.entries(PRODUCT_SOURCE_MAP)) {
    const product = productsBySlug.get(slug);
    const oldCount = oldRowsForSlug(data, slug).length;

    if (!product) {
      summary.push({
        title: '',
        slug,
        source_url: sourceUrl,
        old_count: 0,
        scraped_count: 0,
        final_count: 0,
        status: 'product_not_found',
      });
      continue;
    }

    let html = '';
    let actualUrl = sourceUrl;
    let statusCode = 0;
    let scraped = [];
    let status = 'parse_failed_preserved_existing';

    try {
      const response = await fetchHtml(sourceUrl);
      html = response.html;
      actualUrl = response.sourceUrl;
      statusCode = response.statusCode;

      if (statusCode === 404 || !html) {
        status = oldCount ? 'not_found_preserved_existing' : 'url_404';
      } else if (statusCode >= 200 && statusCode < 300) {
        scraped = parseCharacteristics(html);
        status = scraped.length ? 'ok' : 'parse_failed_preserved_existing';
      } else {
        status = oldCount ? 'not_found_preserved_existing' : 'url_404';
      }
    } catch (error) {
      status = oldCount ? 'parse_failed_preserved_existing' : 'url_404';
      html = `Fetch failed: ${error.message}`;
    }

    if (html) {
      fs.writeFileSync(path.join(SCRAPE_DIR, `${slug}.html`), html, 'utf8');
    }

    const title = extractTitle(html) || product.title || product.name || '';
    const rawPayload = {
      slug,
      source_url: actualUrl,
      title,
      status: status === 'ok' ? 'ok' : status.replace('_preserved_existing', ''),
      status_code: statusCode,
      extracted_characteristics: scraped,
    };

    writeJson(path.join(SCRAPE_DIR, `${slug}.json`), rawPayload);
    rawResults.set(slug, rawPayload);

    if (status === 'ok') {
      replacements.set(slug, toDataRows(slug, scraped));
    } else if (!oldCount) {
      console.warn(`[scrape-pkftechno-characteristics] WARNING: ${slug}: characteristics not found and no existing rows to preserve.`);
    }

    summary.push({
      title: product.title || title,
      slug,
      source_url: actualUrl,
      old_count: oldCount,
      scraped_count: scraped.length,
      final_count: status === 'ok' ? scraped.length : oldCount,
      status,
    });
  }

  if (replacements.size > 0) {
    data.characteristics = data.characteristics.filter(
      (item) => !replacements.has(item.product_slug),
    );

    for (const slug of Object.keys(PRODUCT_SOURCE_MAP)) {
      if (replacements.has(slug)) {
        data.characteristics.push(...replacements.get(slug));
      }
    }

    writeJson(PRODUCTS_JSON_PATH, data);
  }

  console.log('\n[scrape-pkftechno-characteristics] Backup:', path.relative(ROOT, BACKUP_JSON_PATH));
  console.log('[scrape-pkftechno-characteristics] Raw output:', path.relative(ROOT, SCRAPE_DIR));
  console.log('[scrape-pkftechno-characteristics] Updated:', path.relative(ROOT, PRODUCTS_JSON_PATH));
  console.table(summary);

  for (const slug of DETAIL_SLUGS) {
    const raw = rawResults.get(slug);
    if (!raw) {
      continue;
    }

    console.log(`\n[scrape-pkftechno-characteristics] Details: ${slug}`);
    console.table(raw.extracted_characteristics.map((row, index) => ({
      sort: (index + 1) * 10,
      name: row.name,
      value: row.value,
    })));
  }

  const failed = summary.filter((row) => (
    row.status === 'product_not_found'
    || row.status === 'url_404'
    || (row.status !== 'ok' && row.final_count === 0)
  ));

  if (failed.length) {
    console.warn('\n[scrape-pkftechno-characteristics] Есть товары без найденных и без сохраненных характеристик:');
    console.table(failed);
    process.exitCode = 1;
  }
}

main();
