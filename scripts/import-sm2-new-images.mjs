import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const downloads = 'D:\\Мои документы\\Fedelesh_DM\\Загрузки';
const outputDir = path.join(root, 'assets', 'products', 'sm-2', 'new');
const dataPath = path.join(root, 'data', 'products.json');
const publicBase = 'https://irozis.github.io/pkftechno-data/assets/products/sm-2/new';

const mapping = [
  ['pult-upravleniya-koncevogo-poluvagona-snegouborochnoj-mashiny-pu-kp-sm-2', 'pupk.png', 'pu-kp.png', 10],
  ['pult-upravleniya-golovnoj-sekcii-snegouborochnoj-mashiny-pu-gm-sm-2', 'pugm.png', 'pu-gm.png', 10],
  ['shkaf-silovoj-koncevogo-poluvagona-snegouborochnoj-mashiny-shs-kp-sm-2', 'shskp.png', 'shs-kp.png', 10],
  ['shkaf-silovoj-koncevogo-poluvagona-snegouborochnoj-mashiny-shs-kp-sm-2', 'shskpopen.png', 'shs-kp-open.png', 20],
  ['shkaf-silovoj-golovnoj-sekcii-snegouborochnoj-mashiny-shs-gm-sm-2', 'shsgs.png', 'shs-gm.png', 10],
  ['shkaf-silovoj-golovnoj-sekcii-snegouborochnoj-mashiny-shs-gm-sm-2', 'shsgsopen.png', 'shs-gm-open.png', 20]
];

await mkdir(outputDir, { recursive: true });
const data = JSON.parse(await readFile(dataPath, 'utf8'));
const products = new Map(data.products.map((product) => [product.slug, product]));
const grouped = new Map();

for (const [slug, sourceName, targetName, sort] of mapping) {
  await copyFile(path.join(downloads, sourceName), path.join(outputDir, targetName));
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
console.log(`Imported ${mapping.length} new SM-2 images.`);
