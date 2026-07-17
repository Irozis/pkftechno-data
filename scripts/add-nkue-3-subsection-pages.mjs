import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(root, 'data', 'products.json');
const data = JSON.parse(await readFile(dataPath, 'utf8'));

const section = 'Экскаваторное оборудование';
const series = 'НКУЭ-3';
const sourceBase = 'https://pkftechno.ru/products/';
const pending = 'Идёт работа над информацией по этому изделию. Технические характеристики и подробное описание будут добавлены позже.';

const products = [
  {
    slug: 'kreslo-mashinista-km-nkue-3',
    title: 'Кресло машиниста КМ НКУЭ-3',
    type: 'Кресло машиниста',
    description: 'Кресло машиниста экскаватора представляет собой кресло, оснащённое командоконтроллерами для управления главными приводами экскаватора во всех режимах работы. Командоконтроллеры оснащены двухкоординатными джойстиками с датчиками Холла, что гарантирует длительную безотказную работу джойстика. На левой консоли кресла расположен командоконтроллер «Напор», с помощью которого выполняются управление приводом подъёма, приводом вращения и приводом хода. На правой консоли расположен командоконтроллер «Подъём/Вращение», предназначенный для управления приводами напора и хода, открывания днища ковша и подачи звукового сигнала. На командоконтроллерах предусмотрены кнопки «СТОП УПР.» и «СТОП ВМ.» для отключения цепей управления и асинхронной высоковольтной машины.',
    image_url: null
  },
  {
    slug: 'pult-upravleniya-nkue-3',
    title: 'Пульт управления НКУЭ-3',
    type: 'Пульт управления',
    description: pending
  },
  {
    slug: 'shkaf-vspomogatelnyh-privodov-nkue-3',
    title: 'Шкаф вспомогательных приводов НКУЭ-3',
    type: 'Шкаф вспомогательных приводов',
    description: pending
  },
  {
    slug: 'shkaf-glavnyh-privodov-nkue-3',
    title: 'Шкаф главных приводов НКУЭ-3',
    type: 'Шкаф главных приводов',
    description: pending
  },
  {
    slug: 'paneli-p1-p2-p3-nkue-3',
    title: 'Панели П1-3 НКУЭ-3',
    type: 'Панели управления',
    description: pending
  },
  {
    slug: 'shkaf-razgona-nkue-3',
    title: 'Шкаф разгона НКУЭ-3',
    type: 'Шкаф разгона',
    description: pending
  },
  {
    slug: 'shkaf-dinamicheskogo-tormozheniya-nkue-3',
    title: 'Шкаф динамического торможения НКУЭ-3',
    type: 'Шкаф динамического торможения',
    description: pending
  }
];

const existing = new Map(data.products.map((item) => [item.slug, item]));
for (const [index, item] of products.entries()) {
  const previous = existing.get(item.slug) || {};
  const description = item.description;
  existing.set(item.slug, {
    ...previous,
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
    source_url: `${sourceBase}${item.slug}`,
    cta_text: 'Получить консультацию',
    sort: 1380 + index * 10,
    status: 'published',
    ...(item.image_url ? { image_url: item.image_url } : {})
  });
}

data.products = [...existing.values()];
await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
