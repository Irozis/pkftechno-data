import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outputDir = path.join(root, 'assets', 'old-page-snapshots', 'locomotive-radio');

const pages = [
  ['al1-160', 'Антенна локомотивная АЛ1/160', 'https://pkftechno.ru/al1n160'],
  ['al1-160-n', 'Антенна локомотивная АЛ1/160/Н', 'https://pkftechno.ru/al1n160h'],
  ['al2-160', 'Антенна локомотивная АЛ2/160', 'https://pkftechno.ru/al2n160'],
  ['al2-160-900-2500-n', 'Антенна локомотивная АЛ2/160/900-2500/Н', 'https://pkftechno.ru/al2n160sl900-2500h'],
  ['al2-160-n', 'Антенна локомотивная АЛ2/160/Н', 'https://pkftechno.ru/al2n160h'],
  ['al2-450-2700-mimo', 'Антенна локомотивная АЛ2/450-2700/MIMO', 'https://pkftechno.ru/al2_450-2700_mimo'],
  ['al2-450-2700-mimo-n', 'Антенна локомотивная АЛ2/450-2700/MIMO/Н', 'https://pkftechno.ru/al2_450-2700_mimo_h'],
  ['al2-450-2700-n-050', 'Антенна локомотивная АЛ2/450-2700/Н-050', 'https://pkftechno.ru/al2_450-2700_h-050'],
  ['al2-450-2700-n-057', 'Антенна локомотивная АЛ2/450-2700/Н-057', 'https://pkftechno.ru/al2_450-2700_h-057'],
  ['al2-460-900', 'Антенна локомотивная АЛ2/460/900', 'https://pkftechno.ru/al2_460_900'],
  ['al2-460-900-n', 'Антенна локомотивная АЛ2/460/900/Н', 'https://pkftechno.ru/al2_460_900h'],
  ['al3-160-n-058', 'Антенна локомотивная АЛ3/160/Н-058', 'https://pkftechno.ru/al3_160_h-058'],
  ['al3-160-n-059', 'Антенна локомотивная АЛ3/160/Н-059', 'https://pkftechno.ru/al3_160_h-059'],
  ['al3-800-3400', 'Антенна локомотивная АЛ3/800-3400', 'https://pkftechno.ru/al3_800-3400'],
  ['al3-800-3400-mimo', 'Антенна локомотивная АЛ3/800-3400/MIMO', 'https://rclab.ru/?product=%D0%B0%D0%BB3-800-3400-mimo'],
  ['al3-800-3400-mimo-n', 'Антенна локомотивная АЛ3/800-3400/MIMO/Н', 'https://pkftechno.ru/al3_800-3400_mimo_h'],
  ['al3-800-3400-n', 'Антенна локомотивная АЛ3/800-3400/Н', 'https://pkftechno.ru/al3_800-3400_h'],
  ['alm-2-130', 'Антенна локомотивная АЛМ/2.130', 'https://pkftechno.ru/alm_2130'],
  ['rlsm-10', 'Радиостанция РЛСМ-10', 'https://pkftechno.ru/rlsm-10'],
  ['df-160-r6k', 'Дуплексный фильтр ДФ-160/Р6К', 'https://pkftechno.ru/df-160_r6k'],
  ['df-160-r8k', 'Дуплексный фильтр ДФ-160/Р8К', 'https://pkftechno.ru/df-160/r8k'],
];

await mkdir(outputDir, { recursive: true });
const manifest = [];

for (const [slug, title, url] of pages) {
  const response = await fetch(url, { redirect: 'follow' });
  const html = await response.text();
  const file = `${slug}.html`;
  await writeFile(path.join(outputDir, file), html, 'utf8');
  manifest.push({ slug, title, requested_url: url, final_url: response.url, status: response.status, bytes: Buffer.byteLength(html), file });
  console.log(`${response.status}\t${title}\t${response.url}`);
}

await writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify({ exported_at: new Date().toISOString(), pages: manifest }, null, 2)}\n`, 'utf8');
console.log(`Exported ${manifest.length} page snapshots to ${outputDir}`);
