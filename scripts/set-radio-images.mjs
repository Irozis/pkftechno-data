import { readFile, writeFile } from 'node:fs/promises';

const dataPath = 'data/products.json';
const data = JSON.parse(await readFile(dataPath, 'utf8'));

const replacements = new Map([
  ['al1-160', {
    image_url: 'assets/products/radio-equipment/al1-160.png',
    alt: 'Антенна локомотивная АЛ1/160'
  }],
  ['al1-160-n', {
    image_url: 'assets/products/radio-equipment/al1-160-n.png',
    alt: 'Антенна локомотивная АЛ1/160/Н'
  }],
  ['al2-160', {
    image_url: 'assets/products/radio-equipment/al2-160.png',
    alt: 'Антенна локомотивная АЛ2/160'
  }],
  ['al2-160-900-2500-n', {
    image_url: 'assets/products/radio-equipment/al2-160-900-2500-n.png',
    alt: 'Антенна локомотивная АЛ2/160/900-2500/Н'
  }],
  ['al2-160-n', {
    image_url: 'assets/products/radio-equipment/al2-160-n.png',
    alt: 'Антенна локомотивная АЛ2/160/Н'
  }],
  ['al2-450-2700-mimo', {
    image_url: 'assets/products/radio-equipment/al2-450-2700-mimo.png',
    alt: 'Антенна локомотивная АЛ2/450-2700/MIMO'
  }],
  ['al2-450-2700-mimo-n', {
    image_url: 'assets/products/radio-equipment/al2-450-2700-mimo-n.png',
    alt: 'Антенна локомотивная АЛ2/450-2700/MIMO/Н'
  }],
  ['al2-450-2700-n-050', {
    image_url: 'assets/products/radio-equipment/al2-450-2700-n-050.png',
    alt: 'Антенна локомотивная АЛ2/450-2700/Н-050'
  }],
  ['al2-450-2700-n-057', {
    image_url: 'assets/products/radio-equipment/al2-450-2700-n-057.png',
    alt: 'Антенна локомотивная АЛ2/450-2700/Н-057'
  }],
  ['al2-460-900', {
    image_url: 'assets/products/radio-equipment/al2-460-900.png',
    alt: 'Антенна локомотивная АЛ2/460/900'
  }],
  ['al2-460-900-n', {
    image_url: 'assets/products/radio-equipment/al2-460-900-n.png',
    alt: 'Антенна локомотивная АЛ2/460/900/Н'
  }],
  ['al3-160-n-058', {
    image_url: 'assets/products/radio-equipment/al3-160-n-058.png',
    alt: 'Антенна локомотивная АЛ3/160/Н-058'
  }],
  ['al3-160-n-059', {
    image_url: 'assets/products/radio-equipment/al3-160-n-059.png',
    alt: 'Антенна локомотивная АЛ3/160/Н-059'
  }],
  ['al3-800-3400', {
    image_url: 'assets/products/radio-equipment/al3-800-3400.png',
    alt: 'Антенна локомотивная АЛ3/800-3400'
  }],
  ['al3-800-3400-mimo', {
    image_url: 'assets/products/radio-equipment/al3-800-3400-mimo.png',
    alt: 'Антенна локомотивная АЛ3/800-3400/MIMO'
  }],
  ['al3-800-3400-mimo-n', {
    image_url: 'assets/products/radio-equipment/al3-800-3400-mimo-n.png',
    alt: 'Антенна локомотивная АЛ3/800-3400/MIMO/Н'
  }],
  ['al3-800-3400-n', {
    image_url: 'assets/products/radio-equipment/al3-800-3400-n.png',
    alt: 'Антенна локомотивная АЛ3/800-3400/Н'
  }],
  ['df-160-r6k', {
    image_url: 'assets/products/radio-equipment/df-160-r6k.png',
    alt: 'Дуплексный фильтр ДФ-160/Р6К'
  }],
  ['df-160-r8k', {
    image_url: 'assets/products/radio-equipment/df-160-r8k.png',
    alt: 'Дуплексный фильтр ДФ-160/Р8К'
  }],
  ['alm-2-130', {
    image_url: 'assets/products/radio-equipment/alm-2-130.png',
    alt: 'Антенна локомотивная АЛМ/2.130'
  }],
  ['rlsm-10', {
    image_url: 'assets/products/radio-equipment/rlsm-10.png',
    alt: 'Радиостанция РЛСМ-10'
  }]
]);

const publicAssetBase = 'https://irozis.github.io/pkftechno-data/';
for (const image of replacements.values()) {
  image.image_url = image.image_url.replace(/^assets\//, publicAssetBase + 'assets/');
}

for (const [slug, image] of replacements) {
  const product = data.products.find((item) => item.slug === slug);
  if (!product) throw new Error(`Product not found: ${slug}`);
  product.image_url = image.image_url;
  data.images = data.images.filter((item) => item.product_slug !== slug);
  data.images.push({ product_slug: slug, ...image, sort: 10 });
}

await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(`Updated ${replacements.size} radio product images.`);
