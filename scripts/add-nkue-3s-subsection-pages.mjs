import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(root, 'data', 'products.json');
const data = JSON.parse(await readFile(dataPath, 'utf8'));
const section = 'Экскаваторное оборудование';
const series = 'НКУЭ-3С';
const pending = 'Идёт работа над информацией по этому изделию. Технические характеристики и подробное описание будут добавлены позже.';

const кресло = 'Кресло машиниста экскаватора представляет собой кресло, оснащённое консолями с джойстиками, являющееся рабочим местом машиниста экскаватора и предназначенное для управления главными приводами экскаватора во всех режимах работы. Кресло обеспечивает посадку машиниста в эргономичном кресле, управление главными и вспомогательными приводами, отключение высоковольтного выключателя, а также управление приводом хода и направлением хода. На левой консоли расположен джойстик напора для управления приводом напора и открывания днища ковша. На правой консоли расположены джойстик подъёма для управления приводами подъёма, вращения и хода, переключатель «Направление» и кнопка «СТОП УПР.». На левой консоли также предусмотрены переключатель «ХОД» и кнопка «СТОП ВМ.».';

const items = [
  {
    slug: 'kreslo-mashinista-km-nkue-3s',
    title: 'Кресло машиниста КМ НКУЭ-3С',
    type: 'Кресло машиниста',
    description: кресло
  },
  {
    slug: 'shkaf-vvodnoy-nkue-3s',
    title: 'Шкаф вводной НКУЭ-3С',
    type: 'Шкаф вводной',
    description: pending
  },
  {
    slug: 'shkaf-aktivnyh-vypryamiteley-nkue-3s',
    title: 'Шкаф активных выпрямителей ШАВ НКУЭ-3С',
    type: 'Шкаф активных выпрямителей',
    sourceSlug: 'shkaf-shav-nkue-3s'
  },
  {
    slug: 'shkaf-preobrazovateley-glavnyh-privodov-nkue-3s',
    title: 'Шкаф преобразователей главных приводов ШПГП НКУЭ-3С',
    type: 'Шкаф преобразователей главных приводов',
    sourceSlug: 'shkaf-shpgp-nkue-3s'
  },
  {
    slug: 'shkaf-upravleniya-nkue-3s',
    title: 'Шкаф управления НКУЭ-3С',
    type: 'Шкаф управления',
    sourceSlug: 'shkaf-upravleniya-shu-nkue-3s'
  },
  {
    slug: 'stojki-tormoznyh-soprotivlenij-nkue-3s',
    title: 'Стойки тормозных сопротивлений НКУЭ-3С',
    type: 'Стойки тормозных сопротивлений',
    description: pending
  }
];

const products = new Map(data.products.map((product) => [product.slug, product]));
const images = new Map();
for (const item of data.images) {
  if (item?.product_slug && item.image_url && !images.has(item.product_slug)) images.set(item.product_slug, item.image_url);
}

for (const [index, item] of items.entries()) {
  const source = item.sourceSlug ? products.get(item.sourceSlug) : null;
  const description = item.description || source?.description || pending;
  const imageUrl = images.get(item.sourceSlug);
  products.set(item.slug, {
    slug: item.slug,
    title: item.title,
    section,
    series,
    type: item.type,
    short_description: description,
    hero_description: description,
    description,
    purpose: description,
    catalog_url: `/products/${item.slug}`,
    source_url: `https://pkftechno.ru/products/${item.sourceSlug || item.slug}`,
    cta_text: 'Получить консультацию',
    sort: 1450 + index * 10,
    status: 'published',
    ...(imageUrl ? { image_url: imageUrl } : {})
  });
}

data.products = [...products.values()];
await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
