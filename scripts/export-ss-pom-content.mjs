import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(root, 'data', 'products.json');
const htmlDir = path.join(root, 'tmp', 'old-product-pages');
const outputJson = path.join(root, 'data', 'ss-pom-content.json');
const outputMd = path.join(root, 'docs', 'ss-pom-content.md');

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
    .replace(/&ndash;/gi, '–');
}

function extractText(html) {
  const clean = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<\/(?:p|div|section|article|header|footer|h[1-6]|li|tr|br|td|th)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  const lines = decodeHtml(clean)
    .split(/\r?\n|\s{2,}/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return lines.filter((line, index) => index === 0 || line !== lines[index - 1]);
}

function markdownTable(rows) {
  return [
    '| Параметр | Значение |',
    '|---|---|',
    ...rows.map((row) => `| ${row.name} | ${[row.value, row.unit].filter(Boolean).join(' ')} |`)
  ].join('\n');
}

const data = JSON.parse(await readFile(dataPath, 'utf8'));
const products = data.products.filter((product) => product.series === 'СС-ПОМ');
const images = data.images;
const exported = [];
const markdown = ['# СС-ПОМ', '', 'Снегоочистительная машина с пневматическим обдувом. Ниже собраны данные двух изделий серии из каталога проекта и старых страниц сайта.', ''];

for (const product of products) {
  const html = await readFile(path.join(htmlDir, `${product.slug}.html`), 'utf8');
  const sourceImages = images.filter((image) => image.product_slug === product.slug).sort((a, b) => a.sort - b.sort);
  const characteristics = data.characteristics
    .filter((item) => item.product_slug === product.slug)
    .sort((a, b) => a.sort - b.sort);
  const text = extractText(html);
  const page = {
    slug: product.slug,
    title: product.title,
    series: product.series,
    type: product.type,
    section: product.section,
    source_url: product.source_url,
    description: product.description,
    purpose: product.purpose,
    characteristics,
    images: sourceImages,
    full_text: text
  };
  exported.push(page);

  markdown.push(`## ${product.title}`, '', `Источник: ${product.source_url}`, '', '### Текстовая информация', '', product.description, '');
  markdown.push('### Характеристики', '', markdownTable(characteristics), '');
  markdown.push('### Изображения', '', ...sourceImages.map((image) => `- ${image.image_url}`), '');
  markdown.push('### Полный текст старой страницы', '', ...text.map((line) => `- ${line}`), '');
}

await writeFile(outputJson, `${JSON.stringify(exported, null, 2)}\n`, 'utf8');
await writeFile(outputMd, `${markdown.join('\n')}\n`, 'utf8');
console.log(`Exported ${exported.length} SS-POM products.`);
