import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(root, 'data', 'products.json');
const data = JSON.parse(await readFile(dataPath, 'utf8'));
const section = 'Экскаваторное оборудование';
const series = 'НКУЭ-10МК';
const pending = 'Идёт работа над информацией по этому изделию. Технические характеристики и подробное описание будут добавлены позже.';

const items = [
  ['pult-mashinista-pm-nkue-10mk', 'Пульт машиниста ПМ НКУЭ-10МК', 'Пульт машиниста'],
  ['kreslo-mashinista-km-nkue-10mk', 'Кресло машиниста КМ НКУЭ-10МК', 'Кресло машиниста'],
  ['kreslo-pult-nkue-10mk', 'Кресло-пульт НКУЭ-10МК', 'Кресло-пульт'],
  ['shkaf-osveshcheniya-nkue-10mk', 'Шкаф освещения ШО НКУЭ-10МК', 'Шкаф освещения', 'shkaf-osveshcheniya-sho-nkue-10mk'],
  ['shkaf-kontaktorov-nkue-10mk', 'Шкаф контакторов ШК НКУЭ-10МК', 'Шкаф контакторов', 'shkaf-kommutacii-shk-nkue-10mk'],
  ['shkaf-kontrolya-izolyacii-nkue-10mk', 'Шкаф контроля изоляции ШКИ НКУЭ-10МК', 'Шкаф контроля изоляции', 'shkaf-kontrolya-izolyacii-shki-nkue-10mk'],
  ['shkaf-vypryamitelej-i-razgona-nkue-10mk', 'Шкаф выпрямителей и разгона ШВР НКУЭ-10МК', 'Шкаф выпрямителей и разгона', 'shkaf-vypryamitelej-i-razgona-shvr-nkue-10mk'],
  ['shkaf-vspomogatelnyh-privodov-nkue-10mk', 'Шкаф вспомогательных приводов ШВП НКУЭ-10МК', 'Шкаф вспомогательных приводов', 'shkaf-vspomogatelnyh-privodov-shvp-nkue-10mk'],
  ['shkaf-glavnyh-privodov-nkue-10mk', 'Шкаф главных приводов ШГП НКУЭ-10МК', 'Шкаф главных приводов', 'shkaf-upravleniya-glavnymi-privodami-shgp-nkue-10mk']
];

const products = new Map(data.products.map((product) => [product.slug, product]));
for (const [index, [slug, title, type, sourceSlug]] of items.entries()) {
  const source = sourceSlug ? products.get(sourceSlug) : null;
  const description = source?.description || pending;
  products.set(slug, {
    slug,
    title,
    section,
    series,
    type,
    short_description: description,
    hero_description: description,
    description,
    purpose: description,
    catalog_url: `/products/${slug}`,
    source_url: `https://pkftechno.ru/products/${sourceSlug || slug}`,
    cta_text: 'Получить консультацию',
    sort: 1510 + index * 10,
    status: 'published'
  });
}

data.products = [...products.values()];
await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
