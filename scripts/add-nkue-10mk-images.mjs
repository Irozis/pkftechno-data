import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(root, 'data', 'products.json');
const data = JSON.parse(await readFile(dataPath, 'utf8'));
const imageRoot = 'assets/old-site-photos/nkue-products/nkue-10mk';

const galleryGroups = {
  'pult-mashinista-pm-nkue-10mk': ['nkue10pm1.png'],
  'kreslo-mashinista-km-nkue-10mk': ['nkue10km1.png'],
  'kreslo-pult-nkue-10mk': ['nkue10kp1.png'],
  'shkaf-osveshcheniya-nkue-10mk': ['nkue10sho1.png', 'nkue10sho11.png'],
  'shkaf-osveshcheniya-sho-nkue-10mk': ['nkue10sho1.png', 'nkue10sho11.png'],
  'shkaf-kontaktorov-nkue-10mk': ['nkue10shk1.png', 'nkue10shk11.png', 'nkue10shk111.png'],
  'shkaf-kommutacii-shk-nkue-10mk': ['nkue10shk1.png', 'nkue10shk11.png', 'nkue10shk111.png'],
  'shkaf-kontrolya-izolyacii-nkue-10mk': ['nkue10shki1.png', 'nkue10shki11.png'],
  'shkaf-kontrolya-izolyacii-shki-nkue-10mk': ['nkue10shki1.png', 'nkue10shki11.png'],
  'shkaf-vypryamitelej-i-razgona-nkue-10mk': ['nkue10shvr1.png', 'nkue10shvr11.png'],
  'shkaf-vypryamitelej-i-razgona-shvr-nkue-10mk': ['nkue10shvr1.png', 'nkue10shvr11.png'],
  'shkaf-vspomogatelnyh-privodov-nkue-10mk': ['nkue10svp1.png', 'nkue10svp11.png'],
  'shkaf-vspomogatelnyh-privodov-shvp-nkue-10mk': ['nkue10svp1.png', 'nkue10svp11.png'],
  'shkaf-glavnyh-privodov-nkue-10mk': ['nkue10shgp1.png', 'nkue10shgp11.png'],
  'shkaf-upravleniya-glavnymi-privodami-shgp-nkue-10mk': ['nkue10shgp1.png', 'nkue10shgp11.png']
};

const targets = new Set(Object.keys(galleryGroups));
data.images = data.images.filter((image) => !targets.has(image.product_slug));

for (const [productSlug, files] of Object.entries(galleryGroups)) {
  const title = data.products.find((product) => product.slug === productSlug)?.title || productSlug;
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
