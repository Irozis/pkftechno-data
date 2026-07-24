import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const productsFile = path.join(rootDir, "data", "products.json");
const sitemapFile = path.join(rootDir, "tmp", "seo-sitemap.xml");
const outputCsv = path.join(rootDir, "docs", "product-redirect-map.csv");
const outputMarkdown = path.join(rootDir, "docs", "product-redirect-map.md");

const SITE_HOSTS = new Set(["pkftechno.ru", "www.pkftechno.ru"]);
const TARGET_PATH = "/product";

const data = JSON.parse(fs.readFileSync(productsFile, "utf8"));
const products = Array.isArray(data) ? data : data.products;

if (!Array.isArray(products)) {
  throw new Error("В data/products.json не найден массив products.");
}

function normalizeSource(rawValue) {
  if (!rawValue || typeof rawValue !== "string") return null;

  try {
    const url = new URL(rawValue, "https://pkftechno.ru");
    if (!SITE_HOSTS.has(url.hostname.toLowerCase())) return null;
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    return `${pathname}${url.search}`;
  } catch {
    return null;
  }
}

function parseSitemapPaths() {
  if (!fs.existsSync(sitemapFile)) return new Set();
  const xml = fs.readFileSync(sitemapFile, "utf8");
  const paths = new Set();

  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    try {
      const url = new URL(match[1].trim());
      paths.add(`${url.pathname.replace(/\/+$/, "") || "/"}${url.search}`);
    } catch {
      // Пропускаем некорректную запись sitemap, не останавливая сборку таблицы.
    }
  }

  return paths;
}

const sitemapPaths = parseSitemapPaths();

const candidates = products.map((product) => {
  const source = normalizeSource(product.source_url);
  const legacy = normalizeSource(product.legacy_source_url);
  const sitemapSlugMatch = sitemapPaths.has(`/products/${product.slug}`)
    ? `/products/${product.slug}`
    : null;
  const catalog = normalizeSource(product.catalog_url);
  const sourcePath = source || legacy || sitemapSlugMatch || catalog;
  const sourceField = source
    ? "source_url"
    : legacy
      ? "legacy_source_url"
      : sitemapSlugMatch
        ? "sitemap_slug_match"
        : catalog
          ? "catalog_url"
          : "";

  let oldPath = sourcePath;
  if (oldPath && !sitemapPaths.has(oldPath) && sitemapPaths.has(`${oldPath}.html`)) {
    oldPath = `${oldPath}.html`;
  }

  return {
    slug: product.slug,
    title: product.title || "",
    sourceField,
    sourcePath,
    oldPath,
    newPath: `${TARGET_PATH}?slug=${encodeURIComponent(product.slug)}`,
    inSitemap: Boolean(oldPath && sitemapPaths.has(oldPath)),
    hasExternalSource: Boolean(
      (product.source_url && !normalizeSource(product.source_url)) ||
        (product.legacy_source_url && !normalizeSource(product.legacy_source_url)),
    ),
  };
});

const sourceCounts = new Map();
const catalogCounts = new Map();
for (const row of candidates) {
  if (!row.sourcePath) continue;
  sourceCounts.set(row.sourcePath, (sourceCounts.get(row.sourcePath) || 0) + 1);
}
for (const product of products) {
  const catalog = normalizeSource(product.catalog_url);
  if (!catalog) continue;
  catalogCounts.set(catalog, (catalogCounts.get(catalog) || 0) + 1);
}

const ready = [];
const excluded = [];

for (const row of candidates) {
  let reason = "";

  if (!row.sourcePath) {
    reason = row.hasExternalSource
      ? "Старая ссылка ведёт на другой домен"
      : "Нет старого адреса на pkftechno.ru";
  } else if (row.sourcePath === TARGET_PATH) {
    reason = "Служебная универсальная страница";
  } else if (
    row.sourceField === "catalog_url" &&
    (catalogCounts.get(row.sourcePath) || 0) > 1
  ) {
    reason = "Общая страница категории — перенаправлять нельзя";
  } else if ((sourceCounts.get(row.sourcePath) || 0) > 1) {
    reason = "Общая страница категории — перенаправлять нельзя";
  }

  if (reason) {
    excluded.push({ ...row, reason });
  } else {
    ready.push({
      ...row,
      status: row.oldPath === "/ibpten" ? "pilot_done" : "ready",
    });
  }
}

ready.sort((a, b) => a.oldPath.localeCompare(b.oldPath, "ru"));
excluded.sort((a, b) => (a.sourcePath || "").localeCompare(b.sourcePath || "", "ru"));

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

const csvHeader = [
  "status",
  "old_path",
  "new_path",
  "product_slug",
  "product_title",
  "source_field",
  "in_sitemap",
];
const csvRows = ready.map((row) =>
  [
    row.status,
    row.oldPath,
    row.newPath,
    row.slug,
    row.title,
    row.sourceField,
    row.inSitemap ? "yes" : "no",
  ]
    .map(csvCell)
    .join(","),
);
fs.writeFileSync(outputCsv, `${csvHeader.map(csvCell).join(",")}\n${csvRows.join("\n")}\n`);

const readyRows = ready
  .map(
    (row, index) =>
      `| ${index + 1} | \`${row.oldPath}\` | \`${row.newPath}\` | ${row.title.replaceAll("|", "\\|")} | ${row.inSitemap ? "да" : "нет"} | ${row.status} |`,
  )
  .join("\n");

const excludedBySource = new Map();
for (const row of excluded) {
  const key = `${row.sourcePath || "—"}\u0000${row.reason}`;
  if (!excludedBySource.has(key)) {
    excludedBySource.set(key, {
      sourcePath: row.sourcePath || "—",
      reason: row.reason,
      products: [],
    });
  }
  excludedBySource.get(key).products.push(row.slug);
}

const excludedRows = [...excludedBySource.values()]
  .map(
    (group) =>
      `| \`${group.sourcePath}\` | ${group.products.length} | ${group.reason} | ${group.products.map((slug) => `\`${slug}\``).join(", ")} |`,
  )
  .join("\n");

const markdown = `# Карта редиректов старых страниц продукции

Сгенерировано из \`data/products.json\`. Источник sitemap: ${fs.existsSync(sitemapFile) ? "`tmp/seo-sitemap.xml`" : "не найден"}.

## Итог

- Всего товаров: **${products.length}**
- Однозначных редиректов: **${ready.length}**
- Уже проверено пилотом: **${ready.filter((row) => row.status === "pilot_done").length}**
- Товаров без отдельного безопасного редиректа: **${excluded.length}**

Правило для Tilda заполняется без домена: значение из «Со страницы» → значение из «На страницу».

## Безопасные редиректы

| № | Со страницы | На страницу | Товар | Есть в sitemap | Статус |
|---:|---|---|---|:---:|---|
${readyRows}

## Не добавлять как редиректы

Эти адреса общие для нескольких товаров, служебные либо находятся на другом домене.

| Старый адрес | Товаров | Причина | Slug товаров |
|---|---:|---|---|
${excludedRows}
`;

fs.writeFileSync(outputMarkdown, markdown);

console.log(`Готово: ${ready.length} безопасных редиректов.`);
console.log(`Исключено: ${excluded.length} товаров.`);
console.log(path.relative(rootDir, outputCsv));
console.log(path.relative(rootDir, outputMarkdown));
