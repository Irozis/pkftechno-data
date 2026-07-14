import { readFile, writeFile } from 'node:fs/promises';

const dataPath = 'data/products.json';
const data = JSON.parse(await readFile(dataPath, 'utf8'));

const replacements = new Map([
  ['alm-2-130', {
    image_url: 'assets/products/radio-equipment/alm-2-130.png',
    alt: 'Антенна локомотивная АЛМ/2.130'
  }],
  ['rlsm-10', {
    image_url: 'assets/products/radio-equipment/rlsm-10.png',
    alt: 'Радиостанция РЛСМ-10'
  }]
]);

for (const [slug, image] of replacements) {
  const product = data.products.find((item) => item.slug === slug);
  if (!product) throw new Error(`Product not found: ${slug}`);
  product.image_url = image.image_url;
  data.images = data.images.filter((item) => item.product_slug !== slug);
  data.images.push({ product_slug: slug, ...image, sort: 10 });
}

await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(`Updated ${replacements.size} radio product images.`);
