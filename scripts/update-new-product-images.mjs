import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(rootDir, 'data', 'products.json');
const data = JSON.parse(await readFile(dataPath, 'utf8'));

const imageSets = {
  'kompleks-2-konlok': [
    ['assets/products/new-images/complex-2-konlok/konlok-1.png', 'Комплекс-2 КОНЛОК — датчик на рельсе', 10],
    ['assets/products/new-images/complex-2-konlok/konlok-2.png', 'Комплекс-2 КОНЛОК — измерительный модуль', 20]
  ],
  'sms-ab': [
    ['assets/products/new-images/sms-ab/sms-ab-1.png', 'СМС-АБ — контроллер', 10],
    ['assets/products/new-images/sms-ab/sms-ab-2.png', 'СМС-АБ — аккумуляторная батарея с датчиками', 20]
  ],
  skrt: [
    ['assets/products/new-images/skrt/noimages.png', 'СКРТ — изображение уточняется', 10]
  ]
};

for (const [slug, entries] of Object.entries(imageSets)) {
  const product = data.products.find((item) => item.slug === slug);
  if (!product) throw new Error(`Не найден товар: ${slug}`);

  product.image_url = entries[0][0];
  data.images = data.images.filter((item) => item.product_slug !== slug);
  data.images.push(...entries.map(([image_url, alt, sort]) => ({ product_slug: slug, image_url, alt, sort })));
}

await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log('Новые изображения подключены для: ' + Object.keys(imageSets).join(', '));
