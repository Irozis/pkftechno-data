# pkftechno-data

Статический data-репозиторий для каталога продукции сайта ПКФ «Технология». Данные публикуются через GitHub Pages и читаются из Tilda через `fetch()` без сервера, базы данных, API-ключей и платных сервисов.

## Структура

```text
data/
  products.json
images/
  products/
scripts/
  convert-xlsx-to-json.mjs
  validate-data.mjs
```

Основной файл данных:

```text
data/products.json
```

После включения GitHub Pages он будет доступен по адресу:

```text
https://<username>.github.io/pkftechno-data/data/products.json
```

## GitHub Pages

1. Откройте репозиторий на GitHub.
2. Перейдите в `Settings` → `Pages`.
3. В разделе `Build and deployment` выберите `Deploy from a branch`.
4. В `Branch` выберите `main`, папку `/root`.
5. Сохраните настройки и дождитесь публикации Pages.

## How Tilda uses this repository

Основной публичный сайт остаётся на Tilda:

```text
https://pkftechno.ru
```

Этот репозиторий используется как источник данных и вспомогательных файлов:

- `data/products.json` — источник данных для Tilda;
- T123-сниппеты для универсальной страницы товара лежат в папке `tilda/`;
- страница Tilda `/product?slug=<slug>` загружает JSON и подставляет данные товара;
- карточки каталога должны вести на Tilda URL `/product?slug=<slug>`;
- GitHub Pages product pages are technical previews only;
- The public website remains on Tilda;
- Production product links should use Tilda URL format: `/product?slug=<slug>`.

Не используйте ссылки вида `https://irozis.github.io/pkftechno-data/products/<slug>/` как публичные ссылки карточек товара. Эти страницы можно оставить только для технического предпросмотра данных.

## Ссылка для Tilda

В Tilda-скрипте используйте:

```js
const DATA_URL = 'https://<username>.github.io/pkftechno-data/data/products.json';
```

Замените `<username>` на имя GitHub-аккаунта или организации.

## Изображения

Публичные изображения товаров храните в папке:

```text
images/products/
```

В `data/products.json` для изображений используются относительные пути:

```json
{
  "image_url": "/images/products/shs1-mg-pss-2p-1.jpg"
}
```

Tilda-скрипт может преобразовать такой путь в абсолютный относительно `DATA_URL`.

## Tilda: блок “Технический паспорт”

Готовый HTML-блок лежит в файле:

```text
tilda/product-specs-block.html
```

Код из этого файла нужно вставлять в Tilda через блок T123 после блока Product Loader. Product Loader должен быть выше блока характеристик и создавать событие `pkfProductLoaded`.

Блок сам группирует характеристики по полю `group`. Если характеристик больше 10, под списком появляется кнопка `Показать все характеристики`; повторный клик сворачивает список обратно.

## Обновление products.json

Данные можно обновлять вручную в `data/products.json` или конвертировать из Excel.

Ожидаемые листы Excel:

- `products`
- `characteristics`
- `images`
- `related_products`
- `dictionaries`

Команда конвертации:

```bash
npm run convert
```

По умолчанию команда читает файл:

```text
./source/products.xlsx
```

Можно передать другой путь напрямую:

```bash
node scripts/convert-xlsx-to-json.mjs ./path/to/products.xlsx
```

Если Excel-файл не найден, скрипт выведет понятную ошибку и не изменит остальные файлы репозитория.

## Валидация

Установите зависимости:

```bash
npm install
```

Запустите проверку данных:

```bash
npm run validate
```

Скрипт проверяет валидность JSON, уникальность `slug` в `products`, а также ссылки `product_slug` и `related_slug` в характеристиках, изображениях и похожих товарах.

## Безопасность публичного репозитория

Не загружайте в public-репозиторий закупочные цены, внутренние документы, токены, договоры, персональные данные и другую непубличную информацию.

Excel-файл лучше хранить локально. В GitHub загружайте только готовый `products.json` и публичные изображения.
