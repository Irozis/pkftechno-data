import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(root, 'data', 'products.json');
const data = JSON.parse(await readFile(dataPath, 'utf8'));
const imageRoot = 'assets/old-site-photos/nkue-products/nkue-3s';

const galleries = {
  'pult-mashinista-pm-nkue-3s': ['nkue3spm1.png', 'nkue3spm11.png'],
  'kreslo-mashinista-km-nkue-3s': ['nkue3skm1.png'],
  'shkaf-vvodnoy-nkue-3s': ['nkue3sshv1.png', 'nkue3sshv11.png', 'nkue3sshv111.png'],
  'shkaf-aktivnyh-vypryamiteley-nkue-3s': ['nkue3sshav1.png', 'nkue3sshav11.png', 'nkue3sshav111.png'],
  'shkaf-shav-nkue-3s': ['nkue3sshav1.png', 'nkue3sshav11.png', 'nkue3sshav111.png'],
  'shkaf-preobrazovateley-glavnyh-privodov-nkue-3s': ['nkue3sshpgp1.png', 'nkue3sshpgp11.png'],
  'shkaf-shpgp-nkue-3s': ['nkue3sshpgp1.png', 'nkue3sshpgp11.png'],
  'shkaf-upravleniya-nkue-3s': ['nkue3sshu1.png', 'nkuesshu11.png'],
  'shkaf-upravleniya-shu-nkue-3s': ['nkue3sshu1.png', 'nkuesshu11.png'],
  'stojki-tormoznyh-soprotivlenij-nkue-3s': ['nkue3ssts1.png', 'nkue3ssts11.png']
};

const products = new Map(data.products.map((product) => [product.slug, product]));
const targetSlugs = new Set(Object.keys(galleries));
data.images = data.images.filter((image) => !targetSlugs.has(image.product_slug));

for (const [productSlug, files] of Object.entries(galleries)) {
  const title = products.get(productSlug)?.title || productSlug;
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
