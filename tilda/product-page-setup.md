# Настройка универсальной страницы товара в Tilda

Основной сайт остаётся на Tilda: `https://pkftechno.ru`.

GitHub Pages в этом репозитории используется как источник данных и технический preview. Пользовательские ссылки каталога должны вести на Tilda:

```text
/product?slug=<slug>
```

Не используйте для карточек каталога ссылки вида:

```text
https://irozis.github.io/pkftechno-data/products/<slug>/
```

## Структура страницы `/product`

1. Header.
2. Hero товара — T123 с кодом из `tilda/product-hero-block.html`.
3. Product Loader — T123, невидимый технический блок.
4. Описание — T123.
5. Технический паспорт — T123.
6. Блок приобретения — статичный Zero Block.
7. Похожие изделия — T123.
8. Форма заявки или стандартный Tilda-блок.
9. Footer.

## Hero товара

Используйте отдельный HTML-блок из `tilda/product-hero-block.html`. Он заменяет старый Zero Block и сам подстраивает высоту под заголовок и описание. Вставьте его после Header, а старый Hero Zero Block удалите или отключите.

Блок использует следующие CSS-классы:

```text
js-product-section
js-product-title
js-product-short
js-product-meta-series
js-product-meta-type
js-product-back-link
js-product-image
js-product-gallery
```

Product Loader заполнит эти элементы после загрузки `data/products.json`.

## Изображение товара

Для страницы `/product?slug=<slug>` есть два варианта вывода изображения.

### Вариант A — одиночное изображение

Поставьте class `js-product-image` на Image-элемент или на Zero Block shape/image-элемент.

Product Loader обновит:

- `src` и `data-original`, если внутри есть `<img>`;
- `background-image` на `.tn-atom`, если это Tilda shape / Zero Block element.

### Вариант B — динамическая галерея

Не используйте стандартную Tilda Gallery для динамических изображений из JSON.

Поставьте HTML-контейнер:

```html
<div class="js-product-gallery"></div>
```

Product Loader сам отрисует слайдер:

- большое изображение товара;
- стрелки назад/вперёд;
- точки;
- счётчик вида `1 / 3`.

Миниатюры не используются.

Если у товара одно изображение, стрелки, точки и счётчик скрываются. Если изображений несколько, стрелки и точки работают циклически.

Рекомендация: для товаров с несколькими изображениями использовать `js-product-gallery`; для простого одиночного hero можно оставить `js-product-image`.

Для краткого текста hero используется:

```js
product.hero_description || product.short_description || product.description
```

Длинное назначение не подставляется в hero отдельно.

## Product Loader

После hero добавьте отдельный блок T123 и вставьте код из:

```text
tilda/product-loader.html
```

Этот блок:

- читает `slug` из URL;
- загружает `https://irozis.github.io/pkftechno-data/data/products.json`;
- ищет товар по `product.slug === slug`;
- заполняет Zero Block;
- создаёт `window.pkfProductContext`;
- вызывает событие `pkfProductLoaded`.

## Описание

Ниже Product Loader добавьте отдельный T123 и вставьте:

```text
tilda/product-description-block.html
```

Блок слушает `pkfProductLoaded` и выводит `product.description`. Если описания нет, показывает текст:

```text
Описание изделия уточняется.
```

## Технический паспорт

Ниже описания добавьте отдельный T123 и вставьте:

```text
tilda/product-specs-block.html
```

Блок берёт характеристики из `context.data.characteristics`, фильтрует по текущему `product.slug`, сортирует по `sort`, группирует по `group` и показывает кнопку раскрытия, если строк больше 10.

## Блок приобретения

CTA «Приобретение» лучше оставить статичным Zero Block.

Текст:

```text
ПРИОБРЕТЕНИЕ

Оставить заявку на приобретение оборудования

Чтобы приобрести изделие, оставьте заявку — специалист уточнит требуемое исполнение, комплектацию и условия эксплуатации, после чего подготовит предложение.

[Оставить заявку]
```

Не добавляйте `js-product-cta-title`, не подставляйте название товара в CTA и не делайте GitHub Pages основным способом покупки.

## Похожие изделия

Ниже CTA добавьте отдельный T123 и вставьте:

```text
tilda/product-related-block.html
```

Ссылки в карточках похожих изделий ведут на Tilda:

```js
'/product?slug=' + related.slug
```

Если похожих изделий нет, блок скрывается.

## Ссылки в карточках каталога

Карточки на страницах каталога, включая `pss2ptest`, должны вести на:

```text
/product?slug=<slug>
```

Готовый список ссылок для ПСС-2П лежит в:

```text
tilda/pss2p-card-links.md
```

PP-slug не переименовывать:

```text
shk-pp1-pss-2p
shk-pp2-pss-2p
shk-pp3-pss-2p
```

## Технический preview GitHub Pages

Сгенерированные страницы `products/<slug>/index.html` можно использовать как технический предпросмотр данных, но они не являются основными страницами публичного сайта.

Команда:

```bash
npm run build:pages
```

нужна только для preview-страниц GitHub Pages, а не для основного сайта на Tilda.
