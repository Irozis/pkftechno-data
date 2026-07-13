import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const downloads = path.join('D:', 'Мои документы', 'Fedelesh_DM', 'Загрузки');
const outputDir = path.join(root, 'assets', 'products', 'ss-pom', 'new');
const dataPath = path.join(root, 'data', 'products.json');
const publicBase = 'https://irozis.github.io/pkftechno-data/assets/products/ss-pom/new';

const mapping = [
  ['elektricheskij-shkaf-a11-ss-pom', 'а11 откр.png', 10],
  ['elektricheskij-shkaf-a11-ss-pom', 'а11-a12.png', 20],
  ['elektricheskij-shkaf-a12-ss-pom', 'а12 откр.png', 10],
  ['elektricheskij-shkaf-a12-ss-pom', 'а11-a12.png', 20]
];

await mkdir(outputDir, { recursive: true });
const data = JSON.parse(await readFile(dataPath, 'utf8'));
const products = new Map(data.products.map((product) => [product.slug, product]));
const grouped = new Map();

for (const [slug, sourceName, sort] of mapping) {
  const source = path.join(downloads, sourceName);
  const targetName = `${slug}-${sourceName.replace(/\.png$/i, '').replace(/[^a-z0-9]+/gi, '-')}.png`;
  await copyFile(source, path.join(outputDir, targetName));
  if (!grouped.has(slug)) grouped.set(slug, []);
  grouped.get(slug).push({
    product_slug: slug,
    image_url: `${publicBase}/${targetName}`,
    alt: `${products.get(slug)?.title || slug} — изображение ${grouped.get(slug).length + 1}`,
    sort
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
console.log(`Imported ${mapping.length} new SS-POM images.`);
