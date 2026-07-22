/*
 * Сборка статики для выкладки на хостинг cloud4box.
 *
 * Зачем это нужно. Перед Apache там стоит nginx, который сам отдаёт файлы
 * с расширениями jpg,jpeg,gif,png,svg,js,css,woff,woff2 и т.д. — читает их
 * с диска напрямую, минуя Apache. А вместе с Apache минуется и .htaccess,
 * то есть пароль на такие файлы не действует: main.js со всей логикой
 * скачивался бы кем угодно без авторизации.
 *
 * Отключить раздачу статики через nginx из панели ISPmanager нельзя —
 * галка «Включить кеширование» убирает только заголовки Expires
 * и Cache-Control, но не саму раздачу.
 *
 * Поэтому статика выкладывается под расширением .dat: его в списке nginx
 * нет, запрос уходит Apache и закрывается паролем. Правильный Content-Type
 * возвращает .htaccess директивами ForceType.
 *
 * В репозитории файлы остаются с обычными именами — переименование живёт
 * только здесь и в собранной папке dist/.
 *
 * Запуск: node build.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

const OUT = 'dist';

// Файлы, которые nginx перехватывает: копируем под .dat
const RENAMED = [
    ['styles/main.css', 'styles/main.css.dat'],
    ['scripts/main.js', 'scripts/main.js.dat'],
    ['data/Logo.png', 'data/Logo.png.dat']
];

// Файлы, которые Apache и так отдаёт под паролем: копируем как есть
const AS_IS = [
    'data/cbr_rates.json',
    'data/company_dictionary.json'
];

// Ссылки, которые надо переписать в текстовых файлах
const REWRITES = [
    ['styles/main.css', 'styles/main.css.dat'],
    ['scripts/main.js', 'scripts/main.js.dat'],
    ['data/Logo.png', 'data/Logo.png.dat']
];

const FORCE_TYPES = [
    ['\\.js\\.dat$', 'application/javascript'],
    ['\\.css\\.dat$', 'text/css'],
    ['\\.png\\.dat$', 'image/png']
];

// Читаем и пишем через latin1: побайтовый round-trip, не портит ни UTF-8,
// ни переводы строк CRLF. Обычный utf8 здесь бы всё поломал.
const read = (p) => readFileSync(p, 'latin1');

// Текст, который добавляем от себя, живёт в JS как UTF-16 — переводим
// его в те же «байты как latin1», иначе кириллица превратится в мусор.
const utf8 = (s) => Buffer.from(s, 'utf8').toString('latin1');

function write(rel, data) {
    const full = join(OUT, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, data, 'latin1');
    return Buffer.byteLength(data, 'latin1');
}

function rewriteLinks(text) {
    let out = text;
    for (const [from, to] of REWRITES) {
        out = out.split(from).join(to);
    }
    return out;
}

rmSync(OUT, { recursive: true, force: true });

// index.html и main.js ссылаются на переименованные файлы — правим ссылки.
// В main.js это три <img src="data/Logo.png"> в конструкторе презентаций.
const sizes = [];
sizes.push(['index.html', write('index.html', rewriteLinks(read('index.html')))]);

for (const [src, dst] of RENAMED) {
    const raw = read(src);
    // Переписываем ссылки только внутри текстовых файлов, картинку не трогаем
    const body = src.endsWith('.png') ? raw : rewriteLinks(raw);
    sizes.push([dst, write(dst, body)]);
}

for (const rel of AS_IS) {
    sizes.push([rel, write(rel, read(rel))]);
}

// .htaccess = авторизация из репозитория + MIME-типы для .dat
const htaccess = read('.htaccess').replace(/\s*$/, '\n') +
    '\n' +
    utf8('# Статика выложена под .dat, чтобы её не перехватывал nginx в обход\n' +
         '# Apache и пароля (см. build.mjs). Content-Type возвращаем вручную.\n') +
    FORCE_TYPES.map(([re, type]) =>
        `<FilesMatch "${re}">\n    ForceType ${type}\n</FilesMatch>\n`
    ).join('');
sizes.push(['.htaccess', write('.htaccess', htaccess)]);

const pad = Math.max(...sizes.map(([n]) => n.length));
for (const [name, size] of sizes) {
    console.log(`  ${name.padEnd(pad)}  ${String(size).padStart(7)} б`);
}
console.log(`\nСобрано в ${OUT}/ — ${sizes.length} файлов`);
