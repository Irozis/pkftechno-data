import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(root, 'data', 'products.json');
const scrapeDir = path.join(root, 'tmp', 'shom-2000-scrape');
const imageDir = path.join(root, 'assets', 'products', 'shom-2000');
const styledDir = path.join(imageDir, 'styled');
const publicBase = 'https://irozis.github.io/pkftechno-data';

const pages = [
  ['panelvvoda12000', 'panel-vvoda-sekciya-1-shchom-2000'],
  ['panelupravleniya12000', 'panel-upravleniya-sekciya-1-shchom-2000'],
  ['panelsilovaya12000', 'panel-silovaya-sekciya-1-shchom-2000'],
  ['paneltransformatorov2000', 'panel-transformatorov-shchom-2000'],
  ['shkafvigrebnoytscepi2000', 'shkaf-vygrebnoj-cepi-shchom-2000'],
  ['panelvigrebnoytscepilevaya2000', 'panel-vygrebnoj-cepi-levaya-shchom-2000'],
  ['panelvigrebnoytscepypravay2000', 'panel-vygrebnoj-cepi-pravaya-shchom-2000'],
  ['page72213779', 'panel-vvoda-sekciya-2-shchom-2000'],
  ['panelsilovaya122000', 'panel-silovaya-1-sekciya-2-shchom-2000'],
  ['panelsilovaya222000', 'panel-silovaya-2-sekciya-2-shchom-2000'],
  ['panelupravlenia22000', 'panel-upravleniya-sekciya-2-shchom-2000']
];

function decodeHtml(value) {
  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&hellip;/gi, '…');
}

function cleanText(html) {
  const body = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<\/(?:p|div|section|article|header|footer|h[1-6]|li|tr|br|td|th)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  const lines = decodeHtml(body)
    .split(/\r?\n|\s{2,}/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const result = [];
  for (const line of lines) {
    if (result.at(-1) !== line) result.push(line);
  }
  return result;
}

function firstMatch(html, expression) {
  return decodeHtml(html.match(expression)?.[1] || '').replace(/\s+/g, ' ').trim();
}

function imageUrls(html) {
  return [...new Set([...html.matchAll(/https?:\/\/static\.tildacdn\.com\/[^"'&\s)<>]+\.(?:jpg|jpeg|png|webp)/gi)]
    .map((match) => match[0])
    .filter((url) => !/favicon|logo/i.test(url)))];
}

const data = JSON.parse(await readFile(dataPath, 'utf8'));
const rootImages = await readdir(imageDir);
const styledImages = await readdir(styledDir);
const shomProducts = new Map(data.products.filter((product) => product.slug.includes('shchom-2000')).map((product) => [product.slug, product]));
const imported = [];

for (const [alias, slug] of pages) {
  const html = await readFile(path.join(scrapeDir, `${alias}.html`), 'utf8');
  const product = shomProducts.get(slug);
  if (!product) throw new Error(`Missing product: ${slug}`);

  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i) || product.title;
  const description = firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i) || product.description;
  const text = cleanText(html);
  const urls = imageUrls(html);
  const images = urls.map((url, index) => {
    const basename = path.basename(new URL(url).pathname);
    const stem = basename.replace(/\.[^.]+$/, '');
    const sourceName = rootImages.find((name) => name.endsWith(`--${basename}`));
    const styledName = styledImages.find((name) => name.endsWith(`--${stem}-styled.png`));
    const localName = styledName || sourceName;
    return {
      source_url: url,
      image_url: localName ? `${publicBase}/assets/products/shom-2000/${styledName ? 'styled/' : ''}${styledName || sourceName}` : url,
      local_path: localName ? `assets/products/shom-2000/${styledName ? 'styled/' : ''}${styledName || sourceName}` : null,
      alt: `${title} — изображение ${index + 1}`,
      sort: (index + 1) * 10
    };
  });

  product.title = title;
  product.short_description = description;
  product.hero_description = description;
  product.description = description;
  product.image_url = images[0]?.image_url || product.image_url;
  product.legacy_text = text;
  product.legacy_source_url = `https://pkftechno.ru/${alias}`;
  product.legacy_image_count = images.length;

  data.images = data.images.filter((image) => image.product_slug !== slug);
  data.images.push(...images.map(({ source_url, image_url, alt, sort }) => ({ product_slug: slug, source_url, image_url, alt, sort })));
  imported.push({ slug, alias, title, description, source_url: product.legacy_source_url, text, images });
}

await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
await writeFile(path.join(root, 'data', 'shom-2000-pages.json'), `${JSON.stringify(imported, null, 2)}\n`, 'utf8');
console.log(`Imported ${imported.length} pages and ${imported.reduce((sum, page) => sum + page.images.length, 0)} source images.`);
