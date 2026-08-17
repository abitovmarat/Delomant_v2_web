/*
 * Сборка сайта для выкладки на хостинг cloud4box.
 *
 * Доступ к сайту закрыт формой входа на PHP (server/index.php). Само
 * приложение и его статика лежат так, что напрямую, в обход авторизации,
 * их не получить:
 *
 *   - app/index.html          — вёрстка приложения, отдаётся index.php
 *                               только после входа;
 *   - assets/*.dat            — JS, CSS, логотип, JSON под расширением .dat
 *                               (его не перехватывает nginx) и закрыты
 *                               в .htaccess; наружу их отдаёт asset.php
 *                               по проверке сессии.
 *
 * Фронтенд не меняется: он обращается к обычным путям (scripts/main.js,
 * data/cbr_rates.json), а .htaccess проксирует их на asset.php.
 *
 * config.php (хеш пароля) создаётся на сервере через setup.php и в сборку
 * не входит — иначе хеш попал бы в публичный репозиторий.
 *
 * Запуск: node build.mjs
 * Токен установки берётся из переменной SETUP_TOKEN, иначе генерится
 * случайный (для CI он не важен: после первой установки setup отключён).
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';

const OUT = 'dist';

// latin1 = побайтовый round-trip: не портит ни UTF-8, ни переводы строк CRLF
const read = (p) => readFileSync(p, 'latin1');

function write(rel, data) {
    const full = join(OUT, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, data, 'latin1');
    return Buffer.byteLength(data, 'latin1');
}

// Статика приложения: исходник → assets/<имя>.dat
const ASSETS = [
    ['styles/main.css',              'assets/main.css.dat'],
    ['scripts/main.js',              'assets/main.js.dat'],
    ['data/Logo.png',                'assets/Logo.png.dat'],
    ['data/cbr_rates.json',          'assets/cbr_rates.dat'],
    ['data/company_dictionary.json', 'assets/company_dictionary.dat'],
    ['data/comtrade_countries.json', 'assets/comtrade_countries.dat'],
    ['data/comtrade_regions.json',   'assets/comtrade_regions.dat'],
    ['data/wits_countries.json',     'assets/wits_countries.dat'],
    ['data/wits_regions.json',       'assets/wits_regions.dat'],
    ['scripts/foreign_customs.js',   'assets/foreign_customs.js.dat'],
    ['data/foreign/hs_names_ru.json','assets/fc_hs_names.dat'],
    ['data/foreign/co_aggregate.json','assets/fc_co.dat'],
    ['data/foreign/pe_aggregate.json','assets/fc_pe.dat'],
    ['data/foreign/kz_aggregate.json','assets/fc_kz.dat'],
    ['data/foreign/kg_aggregate.json','assets/fc_kg.dat'],
    ['data/foreign/kg_series.json',   'assets/fc_kgs.dat'],
    ['data/foreign/kz_series.json',   'assets/fc_kzs.dat'],
    ['data/foreign/kz_dynamic.json',  'assets/fc_kzd.dat'],
];

const setupToken = process.env.SETUP_TOKEN || randomBytes(24).toString('hex');

rmSync(OUT, { recursive: true, force: true });

const sizes = [];

// Серверная обвязка
sizes.push(['index.php', write('index.php', read('server/index.php'))]);
sizes.push(['asset.php', write('asset.php', read('server/asset.php'))]);
sizes.push(['comtrade.php', write('comtrade.php', read('server/comtrade.php'))]);
sizes.push(['wits.php', write('wits.php', read('server/wits.php'))]);
sizes.push(['admin.php', write('admin.php', read('server/admin.php'))]);
sizes.push(['.htaccess', write('.htaccess', read('server/htaccess'))]);

// setup.php с подставленным токеном установки
const setup = read('server/setup.php').replace('__SETUP_TOKEN__', setupToken);
sizes.push(['setup.php', write('setup.php', setup)]);

/*
 * Приложение. К ссылкам на свою статику дописываем метку версии сборки
 * (?v=…), чтобы браузер гарантированно скачивал свежий файл после деплоя,
 * а не отдавал старый из кэша. HTML отдаётся с no-cache, поэтому новая
 * метка доходит сразу. CDN-скрипты не трогаем — у них свои версии в пути.
 */
const buildId = Date.now().toString(36);
let appHtml = read('index.html')
    .replace('href="styles/main.css"', 'href="styles/main.css?v=' + buildId + '"')
    .replace('src="scripts/main.js"', 'src="scripts/main.js?v=' + buildId + '"')
    .replace('src="scripts/foreign_customs.js"', 'src="scripts/foreign_customs.js?v=' + buildId + '"');
sizes.push(['app/index.html', write('app/index.html', appHtml)]);
for (const [src, dst] of ASSETS) {
    sizes.push([dst, write(dst, read(src))]);
}

const pad = Math.max(...sizes.map(([n]) => n.length));
for (const [name, size] of sizes) {
    console.log(`  ${name.padEnd(pad)}  ${String(size).padStart(7)} б`);
}
console.log(`\nСобрано в ${OUT}/ — ${sizes.length} файлов`);
if (!process.env.SETUP_TOKEN) {
    console.log(`Токен установки (setup.php?token=…): ${setupToken}`);
}
