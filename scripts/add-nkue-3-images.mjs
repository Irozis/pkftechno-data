import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(root, 'data', 'products.json');
const data = JSON.parse(await readFile(dataPath, 'utf8'));
const imageRoot = 'assets/old-site-photos/nkue-products/nkue-3';

const galleries = {
  'paneli-p1-p2-p3-nkue-3': ['nkue3p1.png', 'nkue3p2.png', 'nkue3p3.png'],
  'shkaf-vspomogatelnyh-privodov-nkue-3': ['nkue3shvp1.png', 'nkue3shvp11.png'],
  'shkaf-razgona-nkue-3': ['nkue3shr.png', 'nkue3shr1.png'],
  'shkaf-glavnyh-privodov-nkue-3': ['nkue3shgp1.png', 'nkue3shgp11.png'],
  'shkaf-dinamicheskogo-tormozheniya-nkue-3': ['nkue3shdt1.png', 'nkue3shdt11.png'],
  'pult-upravleniya-nkue-3': ['nkue3pu1.png', 'nkue3pu11.png', 'nkue3pu111.png'],
  'pult-mashinista-pm-nkue-3': ['nkue3pm1.png', 'nkue3pm11.png'],
  'kreslo-mashinista-km-nkue-3': ['nkue3km1.png']
};

const slugs = new Set(Object.keys(galleries));
data.images = data.images.filter((image) => !slugs.has(image.product_slug));

for (const [productSlug, files] of Object.entries(galleries)) {
  const product = data.products.find((item) => item.slug === productSlug);
  const title = product?.title || productSlug;
  files.forEach((file, index) => {
    data.images.push({
      product_slug: productSlug,
      image_url: `${imageRoot}/${file}`,
      alt: `${title} — изображение ${index + 1}`,
      sort: (index + 1) * 10
    });
  });
}

await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
