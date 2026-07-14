import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const downloads = 'D:\\Мои документы\\Fedelesh_DM\\Загрузки';
const dataPath = path.join(root, 'data', 'products.json');
const publicRoot = 'https://irozis.github.io/pkftechno-data/';
const cp = (...points) => String.fromCodePoint(...points);

const ru = {
  as: cp(0x430, 0x441, 0x31),
  sh1: cp(0x448, 0x440, 0x43f, 0x2d, 0x31),
  sh1Closed: cp(0x448, 0x440, 0x43f, 0x2d, 0x31, 0x437, 0x430, 0x43a, 0x440),
  sh2: cp(0x448, 0x440, 0x43f, 0x32),
  sh2Closed: cp(0x448, 0x440, 0x43f, 0x2d, 0x32, 0x437, 0x430, 0x43a, 0x440),
  sh3: cp(0x448, 0x440, 0x43f, 0x33),
  sh3Closed: cp(0x448, 0x440, 0x43f, 0x33, 0x2d, 0x437, 0x430, 0x43a, 0x440),
  puPk: cp(0x43f, 0x443, 0x20, 0x43f, 0x43a),
  puZk: cp(0x43f, 0x443, 0x20, 0x437, 0x43a)
};

const items = [
  ['as-01', ru.as + '.png', 'assets/products/railway-nku/other/as-01.png', 'Комплект пультов управления АС-01', 10],
  ['pult-upravleniya-pu-pk-ms-700t', ru.puPk + '.png', 'assets/products/railway-nku/ms-700t/pu-pk-ms-700t.png', 'Пульт управления ПУ ПК МС-700Т', 10],
  ['pult-upravleniya-pu-zk-ms-700t', ru.puZk + '.png', 'assets/products/railway-nku/ms-700t/pu-zk-ms-700t.png', 'Пульт управления ПУ ЗК МС-700Т', 10],
  ['shkaf-raspredeleniya-pitaniya-shrp1-ms-700t', ru.sh1Closed + '.png', 'assets/products/railway-nku/ms-700t/shrp1-ms-700t-closed.png', 'Шкаф распределения питания ШРП1 МС-700Т', 10],
  ['shkaf-raspredeleniya-pitaniya-shrp1-ms-700t', ru.sh1 + '.png', 'assets/products/railway-nku/ms-700t/shrp1-ms-700t-open.png', 'Шкаф распределения питания ШРП1 МС-700Т — открытый вид', 20],
  ['shkaf-raspredeleniya-pitaniya-shrp2-ms-700t', ru.sh2Closed + '.png', 'assets/products/railway-nku/ms-700t/shrp2-ms-700t-closed.png', 'Шкаф распределения питания ШРП2 МС-700Т', 10],
  ['shkaf-raspredeleniya-pitaniya-shrp2-ms-700t', ru.sh2 + '.png', 'assets/products/railway-nku/ms-700t/shrp2-ms-700t-open.png', 'Шкаф распределения питания ШРП2 МС-700Т — открытый вид', 20],
  ['shkaf-raspredeleniya-pitaniya-shrp3-ms-700t', ru.sh3Closed + '.png', 'assets/products/railway-nku/ms-700t/shrp3-ms-700t-closed.png', 'Шкаф распределения питания ШРП3 МС-700Т', 10],
  ['shkaf-raspredeleniya-pitaniya-shrp3-ms-700t', ru.sh3 + '.png', 'assets/products/railway-nku/ms-700t/shrp3-ms-700t-open.png', 'Шкаф распределения питания ШРП3 МС-700Т — открытый вид', 20],
  ['pult-upravleniya-koncevogo-poluvagona-snegouborochnoj-mashiny-pu-kp-sm-2', 'pupk.png', 'assets/products/sm-2/new/pu-kp.png', 'Пульт управления ПУ КП СМ-2', 10],
  ['pult-upravleniya-golovnoj-sekcii-snegouborochnoj-mashiny-pu-gm-sm-2', 'pugm.png', 'assets/products/sm-2/new/pu-gm.png', 'Пульт управления ПУ ГМ СМ-2', 10],
  ['shkaf-silovoj-koncevogo-poluvagona-snegouborochnoj-mashiny-shs-kp-sm-2', 'shskp.png', 'assets/products/sm-2/new/shs-kp.png', 'Шкаф силовой ШС КП СМ-2', 10],
  ['shkaf-silovoj-koncevogo-poluvagona-snegouborochnoj-mashiny-shs-kp-sm-2', 'shskpopen.png', 'assets/products/sm-2/new/shs-kp-open.png', 'Шкаф силовой ШС КП СМ-2 — открытый вид', 20],
  ['shkaf-silovoj-golovnoj-sekcii-snegouborochnoj-mashiny-shs-gm-sm-2', 'shsgs.png', 'assets/products/sm-2/new/shs-gm.png', 'Шкаф силовой ШС ГС СМ-2', 10],
  ['shkaf-silovoj-golovnoj-sekcii-snegouborochnoj-mashiny-shs-gm-sm-2', 'shsgsopen.png', 'assets/products/sm-2/new/shs-gm-open.png', 'Шкаф силовой ШС ГС СМ-2 — открытый вид', 20]
];

const data = JSON.parse(await readFile(dataPath, 'utf8'));
const grouped = new Map();

for (const [slug, sourceName, relativeTarget, alt, sort] of items) {
  const target = path.join(root, relativeTarget);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(downloads, sourceName), target);
  const image = { product_slug: slug, image_url: publicRoot + relativeTarget.replaceAll('\\', '/'), alt, sort };
  if (!grouped.has(slug)) grouped.set(slug, []);
  grouped.get(slug).push(image);
}

for (const [slug, images] of grouped) {
  data.images = data.images.filter((image) => image.product_slug !== slug);
  data.images.push(...images);
  const product = data.products.find((item) => item.slug === slug);
  if (!product) throw new Error(`Unknown product: ${slug}`);
  product.image_url = images[0].image_url;
}

await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(`Imported ${items.length} images for ${grouped.size} products.`);
