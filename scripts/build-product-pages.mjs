import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(rootDir, 'data', 'products.json');
const productsDir = path.join(rootDir, 'products');

const placeholderSvg = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">
  <rect width="960" height="640" fill="#F7F8F5"/>
  <rect x="220" y="140" width="520" height="360" rx="8" fill="#FFFFFF" stroke="#D9DEE2" stroke-width="2"/>
  <path d="M335 408h290M365 242h230M365 292h230M365 342h230" stroke="#B7C0C7" stroke-width="18" stroke-linecap="round"/>
  <circle cx="650" cy="232" r="34" fill="#FFC400"/>
  <text x="480" y="548" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#5F6B73">Изображение уточняется</text>
</svg>
`)}`;

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getSortValue(item) {
  const sort = Number(item?.sort);
  return Number.isFinite(sort) ? sort : 0;
}

function getProductImage(product, images) {
  if (product?.image_url) {
    return product.image_url;
  }

  const image = images
    .filter((item) => item?.product_slug === product?.slug && item.image_url)
    .sort((a, b) => getSortValue(a) - getSortValue(b))[0];

  return image?.image_url || placeholderSvg;
}

function getProductImages(product, images) {
  const gallery = images
    .filter((item) => item?.product_slug === product?.slug && item.image_url)
    .sort((a, b) => getSortValue(a) - getSortValue(b));

  if (gallery.length > 0) return gallery;
  return product?.image_url ? [{ image_url: product.image_url, alt: product.title }] : [];
}

function getImageAlt(product, images) {
  const image = images
    .filter((item) => item?.product_slug === product?.slug && item.alt)
    .sort((a, b) => getSortValue(a) - getSortValue(b))[0];

  return image?.alt || product?.title || 'Изображение товара';
}

function getDescription(product) {
  return product.description || 'Описание изделия уточняется.';
}

function getHeroDescription(product) {
  return product.hero_description || product.short_description || getDescription(product);
}

function renderGallery(product, images) {
  const gallery = getProductImages(product, images);
  if (gallery.length < 2) return '';

  const cards = gallery.map((image, index) => `
            <figure class="pkf-gallery-item">
              <img src="${escapeHtml(image.image_url)}" alt="${escapeHtml(image.alt || `${product.title} — изображение ${index + 1}`)}" loading="lazy">
            </figure>`).join('');

  return `
    <section class="pkf-section pkf-gallery-section">
      <div class="pkf-container">
        <div class="pkf-section-head">
          <span>Изображения</span>
          <h2>Фотографии изделия</h2>
        </div>
        <div class="pkf-gallery-grid">${cards}</div>
      </div>
    </section>`;
}

function renderLegacyContent(product) {
  if (!Array.isArray(product.legacy_text) || product.legacy_text.length === 0) return '';
  const lines = product.legacy_text
    .map((line) => String(line).trim())
    .filter(Boolean);
  const content = lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('');

  return `
    <section class="pkf-section pkf-legacy-section">
      <div class="pkf-container pkf-two-column">
        <div class="pkf-section-head">
          <span>Архивная страница</span>
          <h2>Информация со старого сайта</h2>
        </div>
        <div class="pkf-text-panel pkf-legacy-content">${content}</div>
      </div>
    </section>`;
}

function renderMetaItems(product) {
  const items = [
    ['Серия', product.series],
    ['Тип изделия', product.type],
    ['Раздел', product.section]
  ].filter(([, value]) => value);

  return items
    .map(([name, value]) => `
              <div class="pkf-meta-item">
                <span>${escapeHtml(name)}</span>
                <strong>${escapeHtml(value)}</strong>
              </div>`)
    .join('');
}

function groupCharacteristics(product, characteristics) {
  const rows = characteristics
    .filter((item) => item?.product_slug === product.slug)
    .sort((a, b) => getSortValue(a) - getSortValue(b));

  const groups = [];
  const groupByName = new Map();

  for (const row of rows) {
    const groupName = String(row.group || '').trim() || 'Характеристики';
    if (!groupByName.has(groupName)) {
      const group = { name: groupName, rows: [] };
      groupByName.set(groupName, group);
      groups.push(group);
    }

    groupByName.get(groupName).rows.push(row);
  }

  return groups;
}

function renderCharacteristics(product, characteristics) {
  const groups = groupCharacteristics(product, characteristics);
  const rowCount = groups.reduce((sum, group) => sum + group.rows.length, 0);

  if (rowCount === 0) {
    return '<div class="pkf-empty">Характеристики уточняются по запросу.</div>';
  }

  let visibleIndex = 0;
  const html = groups
    .map((group) => {
      const rows = group.rows
        .map((item) => {
          visibleIndex += 1;
          const value = [item.value, item.unit].filter(Boolean).join(' ');
          const extraClass = visibleIndex > 10 ? ' pkf-spec-row-extra' : '';
          const hiddenAttr = visibleIndex > 10 ? ' hidden' : '';

          return `
              <div class="pkf-spec-row${extraClass}"${hiddenAttr}>
                <div class="pkf-spec-name">${escapeHtml(item.name)}</div>
                <div class="pkf-spec-value">${escapeHtml(value)}</div>
              </div>`;
        })
        .join('');

      return `
            <section class="pkf-spec-group">
              <h3>${escapeHtml(group.name)}</h3>
              ${rows}
            </section>`;
    })
    .join('');

  const toggle = rowCount > 10
    ? '<button class="pkf-spec-toggle" type="button" data-spec-toggle>Показать все характеристики ↓</button>'
    : '';

  return `
          <div class="pkf-specs" data-specs>
            ${html}
          </div>
          ${toggle}`;
}

function renderRelated(product, data, images) {
  const productsBySlug = new Map(data.products.map((item) => [item.slug, item]));
  const related = data.related_products
    .filter((item) => item?.product_slug === product.slug)
    .sort((a, b) => getSortValue(a) - getSortValue(b))
    .map((item) => productsBySlug.get(item.related_slug))
    .filter(Boolean);

  if (related.length === 0) {
    return '';
  }

  const cards = related
    .map((item) => `
            <article class="pkf-related-card">
              <a class="pkf-related-image" href="../${encodeURIComponent(item.slug)}/">
                <img src="${escapeHtml(getProductImage(item, images))}" alt="${escapeHtml(getImageAlt(item, images))}" loading="lazy">
              </a>
              <div class="pkf-related-content">
                <h3><a href="../${encodeURIComponent(item.slug)}/">${escapeHtml(item.title)}</a></h3>
                <p>${escapeHtml(item.short_description || getDescription(item))}</p>
                <a class="pkf-link" href="../${encodeURIComponent(item.slug)}/">Подробнее →</a>
              </div>
            </article>`)
    .join('');

  return `
      <section class="pkf-section pkf-related-section">
        <div class="pkf-container">
          <div class="pkf-section-head">
            <span>Каталог</span>
            <h2>Похожие изделия</h2>
          </div>
          <div class="pkf-related-grid">
            ${cards}
          </div>
        </div>
      </section>`;
}

function renderPage(product, data) {
  const images = Array.isArray(data.images) ? data.images : [];
  const characteristics = Array.isArray(data.characteristics) ? data.characteristics : [];
  const imageUrl = getProductImage(product, images);
  const imageAlt = getImageAlt(product, images);
  const title = product.title || product.slug;
  const description = getDescription(product);
  const heroDescription = getHeroDescription(product);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} | ПКФ Технология</title>
  <meta name="description" content="${escapeHtml(heroDescription)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800;900&display=swap" rel="stylesheet">
  ${renderStyles()}
</head>
<body>
  <header class="pkf-header">
    <div class="pkf-container pkf-header-inner">
      <a class="pkf-brand" href="../">ПКФ Технология</a>
      <nav class="pkf-nav" aria-label="Навигация">
        <a href="../">Продукция</a>
        <a href="#passport">Характеристики</a>
        <a href="#request">Заявка</a>
      </nav>
    </div>
  </header>

  <main>
    <section class="pkf-hero">
      <div class="pkf-container pkf-hero-grid">
        <div class="pkf-hero-media">
          <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(imageAlt)}">
        </div>
        <div class="pkf-hero-content">
          <div class="pkf-kicker">${escapeHtml([product.section, product.series].filter(Boolean).join(' / '))}</div>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(heroDescription)}</p>
          <div class="pkf-meta-grid">
            ${renderMetaItems(product)}
          </div>
          <a class="pkf-button" href="#request">Оставить заявку</a>
        </div>
      </div>
    </section>

    <section class="pkf-section">
      <div class="pkf-container pkf-two-column">
        <div class="pkf-section-head">
          <span>Описание</span>
          <h2>Назначение изделия</h2>
        </div>
        <div class="pkf-text-panel">
          <p>${escapeHtml(description)}</p>
        </div>
      </div>
    </section>

    ${renderGallery(product, images)}
    ${renderLegacyContent(product)}

    <section id="passport" class="pkf-section pkf-passport-section">
      <div class="pkf-container pkf-passport-layout">
        <div class="pkf-section-head">
          <span>Технические данные</span>
          <h2>Технический паспорт</h2>
        </div>
        <div class="pkf-passport-card">
          ${renderCharacteristics(product, characteristics)}
        </div>
      </div>
    </section>

    <section class="pkf-section pkf-cta">
      <div class="pkf-container pkf-cta-card">
        <div>
          <span>Приобретение</span>
          <h2>Оставить заявку на приобретение оборудования</h2>
          <p>Чтобы приобрести изделие, оставьте заявку — специалист уточнит требуемое исполнение, комплектацию и условия эксплуатации, после чего подготовит предложение.</p>
        </div>
        <a class="pkf-button pkf-button-dark" href="#request">Оставить заявку</a>
      </div>
    </section>

    ${renderRelated(product, data, images)}

    <section id="request" class="pkf-section pkf-request">
      <div class="pkf-container pkf-request-card">
        <div class="pkf-section-head">
          <span>Заявка</span>
          <h2>Оставить заявку</h2>
        </div>
        <p>Свяжитесь с нами для уточнения исполнения, комплектации и условий приобретения оборудования.</p>
      </div>
    </section>
  </main>

  <footer class="pkf-footer">
    <div class="pkf-container pkf-footer-inner">
      <span>ПКФ Технология</span>
      <a href="../">Все товары</a>
    </div>
  </footer>

  ${renderScripts()}
</body>
</html>
`;
}

function renderIndexPage(products, data) {
  const images = Array.isArray(data.images) ? data.images : [];
  const cards = products
    .map((product) => `
        <article class="pkf-index-card">
          <a class="pkf-index-image" href="./${encodeURIComponent(product.slug)}/">
            <img src="${escapeHtml(getProductImage(product, images))}" alt="${escapeHtml(getImageAlt(product, images))}" loading="lazy">
          </a>
          <div>
            <p>${escapeHtml([product.series, product.type].filter(Boolean).join(' / '))}</p>
            <h2><a href="./${encodeURIComponent(product.slug)}/">${escapeHtml(product.title || product.slug)}</a></h2>
            <a class="pkf-link" href="./${encodeURIComponent(product.slug)}/">Открыть страницу →</a>
          </div>
        </article>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Продукция | ПКФ Технология</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800;900&display=swap" rel="stylesheet">
  ${renderStyles()}
</head>
<body>
  <header class="pkf-header">
    <div class="pkf-container pkf-header-inner">
      <a class="pkf-brand" href="./">ПКФ Технология</a>
      <nav class="pkf-nav" aria-label="Навигация">
        <a href="./">Продукция</a>
      </nav>
    </div>
  </header>
  <main>
    <section class="pkf-index-hero">
      <div class="pkf-container">
        <span>Каталог</span>
        <h1>Страницы товаров</h1>
        <p>Проверочная страница со ссылками на все опубликованные товары.</p>
      </div>
    </section>
    <section class="pkf-section">
      <div class="pkf-container pkf-index-grid">
        ${cards}
      </div>
    </section>
  </main>
  <footer class="pkf-footer">
    <div class="pkf-container pkf-footer-inner">
      <span>ПКФ Технология</span>
      <span>${products.length} товаров</span>
    </div>
  </footer>
</body>
</html>
`;
}

function renderStyles() {
  return `<style>
    :root {
      --pkf-dark: #111517;
      --pkf-yellow: #FFC400;
      --pkf-bg: #F7F8F5;
      --pkf-line: #E2E6E8;
      --pkf-muted: #627079;
      --pkf-white: #FFFFFF;
    }

    * {
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      margin: 0;
      color: var(--pkf-dark);
      background: var(--pkf-bg);
      font-family: Manrope, Arial, sans-serif;
      font-size: 16px;
      line-height: 1.5;
    }

    a {
      color: inherit;
      text-decoration: none;
    }

    img {
      display: block;
      max-width: 100%;
    }

    .pkf-container {
      width: min(1120px, calc(100% - 48px));
      margin: 0 auto;
    }

    .pkf-header {
      position: sticky;
      top: 0;
      z-index: 10;
      background: var(--pkf-white);
      border-bottom: 1px solid var(--pkf-line);
    }

    .pkf-header-inner {
      min-height: 72px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    }

    .pkf-brand {
      font-size: 18px;
      font-weight: 900;
    }

    .pkf-nav {
      display: flex;
      align-items: center;
      gap: 24px;
      color: var(--pkf-muted);
      font-size: 14px;
      font-weight: 800;
    }

    .pkf-nav a:hover,
    .pkf-link:hover {
      color: #9D7900;
    }

    .pkf-hero {
      background: var(--pkf-dark);
      color: var(--pkf-white);
      padding: 64px 0;
    }

    .pkf-hero-grid {
      display: grid;
      grid-template-columns: minmax(320px, 0.92fr) minmax(0, 1fr);
      gap: 52px;
      align-items: center;
    }

    .pkf-hero-media {
      min-height: 420px;
      display: grid;
      place-items: center;
      overflow: hidden;
      background: #FFFFFF;
      border-radius: 8px;
    }

    .pkf-hero-media img {
      width: 100%;
      height: 100%;
      max-height: 520px;
      object-fit: contain;
    }

    .pkf-kicker,
    .pkf-section-head span,
    .pkf-cta-card span,
    .pkf-index-hero span {
      display: block;
      margin-bottom: 14px;
      color: var(--pkf-yellow);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 2px;
      line-height: 1.2;
      text-transform: uppercase;
    }

    .pkf-hero h1,
    .pkf-index-hero h1 {
      margin: 0;
      max-width: 620px;
      font-size: clamp(38px, 5vw, 68px);
      font-weight: 900;
      line-height: 1.04;
    }

    .pkf-hero p,
    .pkf-index-hero p {
      margin: 22px 0 0;
      max-width: 620px;
      color: #D2D9DD;
      font-size: 18px;
      font-weight: 700;
    }

    .pkf-meta-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin: 30px 0;
    }

    .pkf-meta-item {
      min-width: 0;
      padding: 16px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 8px;
    }

    .pkf-meta-item span {
      display: block;
      margin-bottom: 6px;
      color: #A7B0B6;
      font-size: 12px;
      font-weight: 800;
    }

    .pkf-meta-item strong {
      display: block;
      overflow-wrap: anywhere;
      color: var(--pkf-white);
      font-size: 14px;
      line-height: 1.35;
    }

    .pkf-button {
      display: inline-flex;
      min-height: 50px;
      align-items: center;
      justify-content: center;
      padding: 0 24px;
      border: 2px solid var(--pkf-yellow);
      border-radius: 8px;
      background: var(--pkf-yellow);
      color: var(--pkf-dark);
      font-size: 15px;
      font-weight: 900;
    }

    .pkf-button:hover {
      background: #FFD84A;
      border-color: #FFD84A;
    }

    .pkf-button-dark {
      background: var(--pkf-dark);
      border-color: var(--pkf-dark);
      color: var(--pkf-white);
    }

    .pkf-section {
      padding: 64px 0;
    }

    .pkf-two-column,
    .pkf-passport-layout {
      display: grid;
      grid-template-columns: 300px minmax(0, 1fr);
      gap: 48px;
      align-items: start;
    }

    .pkf-section-head h2,
    .pkf-cta-card h2,
    .pkf-request-card h2 {
      margin: 0;
      font-size: 34px;
      font-weight: 900;
      line-height: 1.12;
    }

    .pkf-section-head span {
      color: #B88900;
    }

    .pkf-text-panel,
    .pkf-passport-card,
    .pkf-request-card,
    .pkf-related-card,
    .pkf-index-card {
      background: var(--pkf-white);
      border: 1px solid var(--pkf-line);
      border-radius: 8px;
    }

    .pkf-text-panel {
      padding: 34px 36px;
    }

    .pkf-text-panel p,
    .pkf-cta-card p,
    .pkf-request-card p,
    .pkf-related-card p,
    .pkf-index-hero p {
      margin: 0;
      color: var(--pkf-muted);
      font-weight: 700;
    }

    .pkf-gallery-section {
      background: var(--pkf-bg);
    }

    .pkf-gallery-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px;
      margin-top: 28px;
    }

    .pkf-gallery-item {
      display: grid;
      place-items: center;
      aspect-ratio: 4 / 3;
      margin: 0;
      overflow: hidden;
      background: var(--pkf-white);
      border: 1px solid var(--pkf-line);
      border-radius: 8px;
    }

    .pkf-gallery-item img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .pkf-legacy-content {
      display: grid;
      gap: 12px;
    }

    .pkf-legacy-content p + p {
      padding-top: 12px;
      border-top: 1px solid var(--pkf-line);
    }

    .pkf-passport-section {
      background: var(--pkf-white);
    }

    .pkf-passport-card {
      padding: 28px 32px;
      background: var(--pkf-bg);
    }

    .pkf-spec-group {
      margin: 0;
    }

    .pkf-spec-group + .pkf-spec-group {
      margin-top: 22px;
    }

    .pkf-spec-group h3 {
      margin: 0 0 10px;
      color: #B88900;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 1.4px;
      text-transform: uppercase;
    }

    .pkf-spec-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(190px, 0.54fr);
      gap: 28px;
      padding: 13px 0;
      border-bottom: 1px solid var(--pkf-line);
    }

    .pkf-spec-name,
    .pkf-spec-value {
      overflow-wrap: anywhere;
      font-size: 15px;
      font-weight: 800;
      line-height: 1.35;
    }

    .pkf-spec-value {
      color: var(--pkf-muted);
    }

    .pkf-spec-toggle {
      margin-top: 22px;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--pkf-dark);
      font: inherit;
      font-size: 14px;
      font-weight: 900;
      cursor: pointer;
    }

    .pkf-spec-toggle:hover {
      color: #B88900;
    }

    .pkf-empty {
      color: var(--pkf-muted);
      font-weight: 800;
    }

    .pkf-cta {
      background: var(--pkf-bg);
    }

    .pkf-cta-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 32px;
      padding: 38px 42px;
      background: var(--pkf-yellow);
      border-radius: 8px;
      color: var(--pkf-dark);
    }

    .pkf-cta-card span {
      color: rgba(17, 21, 23, 0.72);
    }

    .pkf-cta-card p {
      max-width: 720px;
      margin-top: 14px;
      color: rgba(17, 21, 23, 0.78);
    }

    .pkf-related-section {
      background: var(--pkf-white);
    }

    .pkf-related-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px;
      margin-top: 28px;
    }

    .pkf-related-card {
      overflow: hidden;
    }

    .pkf-related-image,
    .pkf-index-image {
      display: grid;
      place-items: center;
      aspect-ratio: 4 / 3;
      background: var(--pkf-bg);
    }

    .pkf-related-image img,
    .pkf-index-image img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .pkf-related-content {
      padding: 20px;
    }

    .pkf-related-content h3,
    .pkf-index-card h2 {
      margin: 0 0 10px;
      font-size: 18px;
      font-weight: 900;
      line-height: 1.25;
    }

    .pkf-related-content p {
      margin-bottom: 16px;
      font-size: 14px;
    }

    .pkf-link {
      color: #B88900;
      font-size: 14px;
      font-weight: 900;
    }

    .pkf-request {
      background: var(--pkf-bg);
    }

    .pkf-request-card {
      max-width: 760px;
      padding: 38px 42px;
    }

    .pkf-request-card p {
      margin-top: 14px;
      font-size: 17px;
    }

    .pkf-footer {
      background: var(--pkf-dark);
      color: var(--pkf-white);
    }

    .pkf-footer-inner {
      min-height: 88px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      color: #C6CED3;
      font-size: 14px;
      font-weight: 800;
    }

    .pkf-footer-inner span:first-child {
      color: var(--pkf-white);
      font-weight: 900;
    }

    .pkf-index-hero {
      padding: 72px 0;
      background: var(--pkf-dark);
      color: var(--pkf-white);
    }

    .pkf-index-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px;
    }

    .pkf-index-card {
      overflow: hidden;
    }

    .pkf-index-card > div {
      padding: 20px;
    }

    .pkf-index-card p {
      margin: 0 0 10px;
      color: #B88900;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    @media (max-width: 960px) {
      .pkf-hero-grid,
      .pkf-two-column,
      .pkf-passport-layout {
        grid-template-columns: 1fr;
      }

      .pkf-hero-media {
        min-height: 360px;
        order: -1;
      }

      .pkf-meta-grid,
      .pkf-gallery-grid,
      .pkf-related-grid,
      .pkf-index-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .pkf-cta-card {
        align-items: flex-start;
        flex-direction: column;
      }
    }

    @media (max-width: 640px) {
      .pkf-container {
        width: min(100% - 32px, 1120px);
      }

      .pkf-header-inner {
        min-height: 64px;
      }

      .pkf-nav {
        gap: 14px;
        font-size: 12px;
      }

      .pkf-hero,
      .pkf-section,
      .pkf-index-hero {
        padding: 42px 0;
      }

      .pkf-hero-grid {
        gap: 30px;
      }

      .pkf-hero-media {
        min-height: 280px;
      }

      .pkf-hero h1,
      .pkf-index-hero h1 {
        font-size: 36px;
      }

      .pkf-hero p {
        font-size: 16px;
      }

      .pkf-meta-grid,
      .pkf-gallery-grid,
      .pkf-related-grid,
      .pkf-index-grid {
        grid-template-columns: 1fr;
      }

      .pkf-text-panel,
      .pkf-passport-card,
      .pkf-request-card,
      .pkf-cta-card {
        padding: 26px 22px;
      }

      .pkf-section-head h2,
      .pkf-cta-card h2,
      .pkf-request-card h2 {
        font-size: 28px;
      }

      .pkf-spec-row {
        display: block;
        padding: 14px 0;
      }

      .pkf-spec-value {
        margin-top: 6px;
      }

      .pkf-footer-inner {
        min-height: 76px;
      }
    }

    @media (max-width: 480px) {
      .pkf-brand {
        font-size: 16px;
      }

      .pkf-nav a:nth-child(2) {
        display: none;
      }

      .pkf-hero h1,
      .pkf-index-hero h1 {
        font-size: 32px;
      }

      .pkf-hero-media {
        min-height: 230px;
      }

      .pkf-button {
        width: 100%;
      }
    }
  </style>`;
}

function renderScripts() {
  return `<script>
    document.querySelectorAll('[data-spec-toggle]').forEach(function (button) {
      button.addEventListener('click', function () {
        var expanded = button.getAttribute('aria-expanded') === 'true';
        document.querySelectorAll('.pkf-spec-row-extra').forEach(function (row) {
          row.hidden = expanded;
        });
        button.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        button.textContent = expanded ? 'Показать все характеристики ↓' : 'Скрыть характеристики ↑';
      });
    });
  </script>`;
}

const data = JSON.parse(await readFile(dataPath, 'utf8'));
const products = Array.isArray(data.products) ? data.products : [];
const publishedProducts = products
  .filter((product) => product?.status === 'published')
  .sort((a, b) => getSortValue(a) - getSortValue(b));

await mkdir(productsDir, { recursive: true });

for (const product of publishedProducts) {
  const productDir = path.join(productsDir, product.slug);
  await mkdir(productDir, { recursive: true });
  await writeFile(path.join(productDir, 'index.html'), renderPage(product, data), 'utf8');
}

await writeFile(path.join(productsDir, 'index.html'), renderIndexPage(publishedProducts, data), 'utf8');

console.log(`Готово: создано страниц товаров: ${publishedProducts.length}`);
console.log(`Индекс: ${path.join(productsDir, 'index.html')}`);
