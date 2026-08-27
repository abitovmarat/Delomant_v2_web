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

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';

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
    ['vendor/xlsx-0.20.3.full.min.js','assets/xlsx-0.20.3.full.min.js.dat'],
    ['vendor/jszip-3.10.1.min.js',    'assets/jszip-3.10.1.min.js.dat'],
    ['vendor/jspdf-2.5.1.umd.min.js', 'assets/jspdf-2.5.1.umd.min.js.dat'],
    ['vendor/html2canvas-1.4.1.min.js','assets/html2canvas-1.4.1.min.js.dat'],
    ['vendor/pptxgenjs-3.12.0.bundle.js', 'assets/pptxgenjs-3.12.0.bundle.js.dat'],
    ['data/Logo.png',                'assets/Logo.png.dat'],
    ['data/cbr_rates.json',          'assets/cbr_rates.dat'],
    ['data/company_dictionary.json', 'assets/company_dictionary.dat'],
    ['data/comtrade_countries.json', 'assets/comtrade_countries.dat'],
    ['data/comtrade_regions.json',   'assets/comtrade_regions.dat'],
    ['data/wits_countries.json',     'assets/wits_countries.dat'],
    ['data/wits_regions.json',       'assets/wits_regions.dat'],
    ['data/hs_names_ru.json',        'assets/hs_names_ru.dat'],
];

const LEGAL_FILES = [
    ['vendor/THIRD_PARTY_NOTICES.md', 'third-party-licenses/THIRD_PARTY_NOTICES.md'],
    ['vendor/licenses/SheetJS-0.20.3-Apache-2.0.txt', 'third-party-licenses/SheetJS-0.20.3-Apache-2.0.txt'],
    ['vendor/licenses/JSZip-3.10.1.txt', 'third-party-licenses/JSZip-3.10.1.txt'],
    ['vendor/licenses/jsPDF-2.5.1.txt', 'third-party-licenses/jsPDF-2.5.1.txt'],
    ['vendor/licenses/html2canvas-1.4.1.txt', 'third-party-licenses/html2canvas-1.4.1.txt'],
    ['vendor/licenses/PptxGenJS-3.12.0.txt', 'third-party-licenses/PptxGenJS-3.12.0.txt'],
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

/*
 * Публичная страница документации и сами PDF. Открыты без входа: реестр
 * требует, чтобы описание функциональных характеристик и сведения для
 * установки открывались по прямой ссылке. Каталог docs_files закрыт в
 * .htaccess, файлы отдаёт docs.php по белому списку.
 */
sizes.push(['docs.php', write('docs.php', read('server/docs.php'))]);
for (const f of readdirSync('public_docs')) {
    if (!f.endsWith('.pdf')) { continue; }
    sizes.push(['docs_files/' + f, write('docs_files/' + f, read('public_docs/' + f))]);
}
sizes.push(['.htaccess', write('.htaccess', read('server/htaccess'))]);

// setup.php с подставленным токеном установки
const setup = read('server/setup.php').replace('__SETUP_TOKEN__', setupToken);
sizes.push(['setup.php', write('setup.php', setup)]);

// Ключ Comtrade Plus — только если задан через окружение (секрет GitHub
// Actions). В репозиторий ключ не попадает: файл создаётся при сборке и
// уезжает на сервер, где comtrade.php сам его подхватывает. Без секрета
// файл не создаётся — работает бесплатный public-эндпоинт.
if (process.env.COMTRADE_KEY) {
    const keyBody = '<?php return ' + JSON.stringify(process.env.COMTRADE_KEY) + ";\n";
    sizes.push(['comtrade_key.php', write('comtrade_key.php', keyBody)]);
}

/*
 * Приложение. К ссылкам на свою статику дописываем метку версии сборки
 * (?v=…), чтобы браузер гарантированно скачивал свежий файл после деплоя,
 * а не отдавал старый из кэша. HTML отдаётся с no-cache, поэтому новая
 * метка доходит сразу. Локальные сторонние библиотеки уже содержат версии в имени файла.
 */
const buildId = Date.now().toString(36);
let appHtml = read('index.html')
    .replace('href="styles/main.css"', 'href="styles/main.css?v=' + buildId + '"')
    .replace('src="scripts/main.js"', 'src="scripts/main.js?v=' + buildId + '"');
sizes.push(['app/index.html', write('app/index.html', appHtml)]);
/*
 * Ассеты кладём и в исходном виде, и предсжатыми (.gz).
 *
 * Предсжатые копии ускоряют загрузку крупных справочников. asset.php отдаёт
 * .gz, если браузер сообщил, что понимает gzip; иначе — обычный файл.
 */
for (const [src, dst] of ASSETS) {
    const data = read(src);
    sizes.push([dst, write(dst, data)]);

    // Мелочь сжимать незачем — выигрыш меньше накладных расходов
    if (Buffer.byteLength(data, 'latin1') > 65536) {
        const gz = gzipSync(Buffer.from(data, 'latin1'), { level: 9 });
        const full = join(OUT, dst + '.gz');
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, gz);
        sizes.push([dst + '.gz', gz.length]);
    }
}

for (const [src, dst] of LEGAL_FILES) {
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
