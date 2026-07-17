import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(root, 'data', 'products.json');
const data = JSON.parse(await readFile(dataPath, 'utf8'));

const additions = [
  {
    product_slug: 'raspredelitelnoe-ustrojstvo-ekru-6',
    image_url: 'assets/old-site-photos/nkue-products/ekru-6/ekrui6-1.png',
    alt: 'Распределительное устройство ЭКРУ-6 — изображение 1',
    sort: 5
  },
  {
    product_slug: 'shun-sibur',
    image_url: 'assets/old-site-photos/nkue-products/shun-sibur/shun1.png',
    alt: 'Шкаф управления насосом ШУН СИБУР — изображение 1',
    sort: 5
  }
];

for (const addition of additions) {
  data.images = data.images.filter((image) => image.image_url !== addition.image_url);
  data.images.push(addition);
}

const ekru = data.products.find((product) => product.slug === 'raspredelitelnoe-ustrojstvo-ekru-6');
if (ekru) ekru.catalog_url = '/products/raspredelitelnoe-ustrojstvo-ekru-6';

await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
