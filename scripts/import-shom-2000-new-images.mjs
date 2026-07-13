import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const downloads = path.join('D:', 'Мои документы', 'Fedelesh_DM', 'Загрузки');
const outputDir = path.join(root, 'assets', 'products', 'shom-2000', 'new');
const dataPath = path.join(root, 'data', 'products.json');
const publicBase = 'https://irozis.github.io/pkftechno-data/assets/products/shom-2000/new';

const mapping = [
  ['panel-vvoda-sekciya-1-shchom-2000', 'панель ввода 1.png'],
  ['panel-vvoda-sekciya-2-shchom-2000', 'панель ввода 2.png'],
  ['panel-upravleniya-sekciya-1-shchom-2000', 'панель управления 1.png'],
  ['panel-upravleniya-sekciya-2-shchom-2000', 'панель управления 2.png'],
  ['panel-silovaya-sekciya-1-shchom-2000', 'панель силовая 1.png'],
  ['panel-silovaya-1-sekciya-2-shchom-2000', 'панель силовая 12.png'],
  ['panel-silovaya-2-sekciya-2-shchom-2000', 'Панель силовая 22.png'],
  ['panel-transformatorov-shchom-2000', 'панель трансформаторов.png'],
  ['panel-vygrebnoj-cepi-levaya-shchom-2000', 'пвц левая.png'],
  ['panel-vygrebnoj-cepi-pravaya-shchom-2000', 'пвц правая 1.png'],
  ['shkaf-vygrebnoj-cepi-shchom-2000', 'швц 1.png'],
  ['shkaf-vygrebnoj-cepi-shchom-2000', 'швц2.png']
];

await mkdir(outputDir, { recursive: true });
const data = JSON.parse(await readFile(dataPath, 'utf8'));
const products = new Map(data.products.map((product) => [product.slug, product]));
const grouped = new Map();

for (const [slug, sourceName] of mapping) {
  const source = path.join(downloads, sourceName);
  const targetName = `${slug}-${sourceName.replace(/\.png$/i, '').replace(/[^a-z0-9]+/gi, '-')}.png`;
  await copyFile(source, path.join(outputDir, targetName));
  if (!grouped.has(slug)) grouped.set(slug, []);
  grouped.get(slug).push({
    product_slug: slug,
    image_url: `${publicBase}/${targetName}`,
    alt: `${products.get(slug)?.title || slug} — изображение ${grouped.get(slug).length + 1}`,
    sort: (grouped.get(slug).length + 1) * 10
  });
}

for (const [slug, images] of grouped) {
  const product = products.get(slug);
  if (!product) throw new Error(`Unknown product: ${slug}`);
  data.images = data.images.filter((image) => image.product_slug !== slug);
  data.images.push(...images);
  product.image_url = images[0].image_url;
}

await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(`Imported ${mapping.length} new images for ${grouped.size} products.`);
