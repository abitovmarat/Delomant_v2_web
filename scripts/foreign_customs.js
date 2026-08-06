/*
 * Модуль «Зарубежная таможня» — контрагентский импорт по данным таможен
 * Колумбии (DIAN) и Перу (SUNAT). Самодостаточный, не зависит от main.js.
 *
 * Данные готовит офлайн-пайплайн (scripts/parse_colombia_dian.py,
 * scripts/parse_peru_sunat.py + scripts/prep — агрегаты и словарь названий).
 * Загружаются лениво при первом открытии раздела.
 *
 *   data/foreign/co_aggregate.json  — Колумбия, импортёр×HS6 (только юрлица)
 *   data/foreign/pe_aggregate.json  — Перу, импортёр×HS6 (только юрлица)
 *   data/foreign/hs_names_ru.json   — HS6/HS4 → рус. название (из статистики КЗ/КГ)
 *
 * Только импортёры-юрлица (NIT 8/9 / RUC 20) — персональные данные физлиц отфильтрованы.
 * Данные DIAN — неофициальные, без статистической валидации (пометка обязательна).
 */
(function () {
    'use strict';

    var SOURCES = {
        CO: { file: 'data/foreign/co_aggregate.json', idLabel: 'NIT',
              title: 'Колумбия (DIAN)',
              note: 'DIAN: реестр деклараций импорта — неофициальные данные без статистической валидации. Только импортёры-юрлица. Период: июнь 2026.' },
        PE: { file: 'data/foreign/pe_aggregate.json', idLabel: 'RUC',
              title: 'Перу (SUNAT)',
              note: 'SUNAT: импорт (уровень позиции). Только импортёры-юрлица. Присланная выборка ограничена одной товарной группой.' }
    };

    var names = null;          // {hs6:{}, hs4:{}}
    var cache = {};            // код страны -> {cols, meta, rows}
    var state = { country: 'CO', sortK: 5, dir: -1, drill: null };

    function fmt(n) { return Math.round(n).toLocaleString('ru-RU'); }
    function hsName(hs6) {
        if (!names) { return ''; }
        return names.hs6[hs6] || names.hs4[String(hs6).slice(0, 4)] || '';
    }

    function injectStyles() {
        if (document.getElementById('fc-style')) { return; }
        var css =
        '#foreign .fc-note{color:var(--fc-mut);font-size:13px;margin:.2em 0 1em;max-width:80ch}' +
        '#foreign .fc-tabs{display:flex;gap:8px;margin-bottom:14px}' +
        '#foreign .fc-tab{padding:8px 16px;border:1px solid var(--fc-line);border-radius:9px;background:var(--fc-tile);color:var(--fc-fg);cursor:pointer;font-size:14px;font-weight:600}' +
        '#foreign .fc-tab.on{background:var(--fc-cob);color:#fff;border-color:var(--fc-cob)}' +
        '#foreign .fc-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px}' +
        '#foreign .fc-tile{background:var(--fc-tile);border:1px solid var(--fc-line);border-radius:12px;padding:12px 14px}' +
        '#foreign .fc-tile .v{font-size:20px;font-weight:700;color:var(--fc-cob)}' +
        '#foreign .fc-tile .l{font-size:12px;color:var(--fc-mut);margin-top:2px}' +
        '#foreign .fc-ctrl{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px}' +
        '#foreign .fc-ctrl input{flex:1;min-width:170px;padding:9px 12px;border:1px solid var(--fc-line);border-radius:9px;background:var(--fc-bg);color:var(--fc-fg);font-size:14px}' +
        '#foreign .fc-btn{padding:9px 14px;border:1px solid var(--fc-cob);border-radius:9px;background:var(--fc-cob);color:#fff;cursor:pointer;font-size:13px;font-weight:600;white-space:nowrap}' +
        '#foreign .fc-cnt{color:var(--fc-mut);font-size:13px;white-space:nowrap}' +
        '#foreign .fc-wrap{overflow-x:auto;border:1px solid var(--fc-line);border-radius:12px}' +
        '#foreign table.fc-tbl{border-collapse:collapse;width:100%;font-size:13px;min-width:720px}' +
        '#foreign .fc-tbl th,.fc-tbl td{padding:8px 12px;text-align:left;border-bottom:1px solid var(--fc-line);white-space:nowrap}' +
        '#foreign .fc-tbl th{position:sticky;top:0;background:var(--fc-tile);cursor:pointer;user-select:none;font-size:12px}' +
        '#foreign .fc-tbl th.num,.fc-tbl td.num{text-align:right;font-variant-numeric:tabular-nums}' +
        '#foreign .fc-tbl tbody tr{cursor:pointer}' +
        '#foreign .fc-tbl tbody tr:hover{background:var(--fc-tile)}' +
        '#foreign .fc-hs{color:var(--fc-cob);font-weight:600}' +
        '#foreign .fc-prod{color:var(--fc-mut);max-width:280px;overflow:hidden;text-overflow:ellipsis}' +
        '#foreign .fc-foot{color:var(--fc-mut);font-size:12px;margin-top:10px}' +
        '#foreign .fc-drill{border:1px solid var(--fc-cob);border-radius:12px;padding:14px 16px;margin-bottom:16px;background:var(--fc-tile)}' +
        '#foreign .fc-drill h4{margin:0 0 .2em;font-size:16px}' +
        '#foreign .fc-drill .close{float:right;cursor:pointer;color:var(--fc-mut);font-size:20px;line-height:1}' +
        // палитра (с учётом тёмной темы приложения, если она есть)
        '#foreign{--fc-bg:#fff;--fc-fg:#0f172a;--fc-mut:#64748b;--fc-line:#e2e8f0;--fc-cob:#2563eb;--fc-tile:#f1f5f9}' +
        '@media(prefers-color-scheme:dark){#foreign{--fc-bg:#0b1220;--fc-fg:#e5e9f0;--fc-mut:#94a3b8;--fc-line:#1e293b;--fc-cob:#3b82f6;--fc-tile:#111a2e}}';
        var el = document.createElement('style');
        el.id = 'fc-style';
        el.textContent = css;
        document.head.appendChild(el);
    }

    function shell(root) {
        root.innerHTML =
        '<div class="fc-tabs">' +
            '<button class="fc-tab" data-c="CO">🇨🇴 Колумбия</button>' +
            '<button class="fc-tab" data-c="PE">🇵🇪 Перу</button>' +
        '</div>' +
        '<p class="fc-note" id="fc-note"></p>' +
        '<div class="fc-tiles" id="fc-tiles"></div>' +
        '<div id="fc-drill"></div>' +
        '<div class="fc-ctrl">' +
            '<input id="fc-q" type="search" placeholder="Поиск по импортёру…" autocomplete="off">' +
            '<input id="fc-qhs" type="search" placeholder="HS6 или название товара…" autocomplete="off">' +
            '<button class="fc-btn" id="fc-xlsx">Экспорт в Excel</button>' +
            '<span class="fc-cnt" id="fc-cnt"></span>' +
        '</div>' +
        '<div class="fc-wrap"><table class="fc-tbl"><thead><tr>' +
            '<th data-k="1">Импортёр</th><th data-k="2">HS6</th><th>Товар</th>' +
            '<th data-k="3" class="num">Позиций</th><th data-k="4" class="num">Нетто, т</th>' +
            '<th data-k="5" class="num">CIF, USD</th><th data-k="6" class="num">FOB, USD</th>' +
        '</tr></thead><tbody id="fc-tb"></tbody></table></div>' +
        '<p class="fc-foot">Показаны топ-300 по текущему фильтру/сортировке. Клик по строке — все коды этого импортёра. Клик по заголовку — сортировка.</p>';

        root.querySelectorAll('.fc-tab').forEach(function (b) {
            b.addEventListener('click', function () { state.country = b.dataset.c; state.drill = null; renderAll(); });
        });
        root.querySelector('#fc-q').addEventListener('input', renderTable);
        root.querySelector('#fc-qhs').addEventListener('input', renderTable);
        root.querySelector('#fc-xlsx').addEventListener('click', exportXlsx);
        root.querySelectorAll('.fc-tbl th[data-k]').forEach(function (th) {
            th.addEventListener('click', function () {
                var k = +th.dataset.k;
                if (state.sortK === k) { state.dir *= -1; }
                else { state.sortK = k; state.dir = (k === 1 || k === 2) ? 1 : -1; }
                renderTable();
            });
        });
    }

    function current() { return cache[state.country]; }

    function filtered() {
        var d = current(); if (!d) { return []; }
        var q = (document.getElementById('fc-q').value || '').trim().toUpperCase();
        var h = (document.getElementById('fc-qhs').value || '').trim().toUpperCase();
        var rows = d.rows;
        if (q) { rows = rows.filter(function (r) { return String(r[1]).toUpperCase().indexOf(q) >= 0; }); }
        if (h) {
            rows = rows.filter(function (r) {
                return String(r[2]).indexOf(h) === 0 || hsName(r[2]).toUpperCase().indexOf(h) >= 0;
            });
        }
        var k = state.sortK, dir = state.dir;
        return rows.slice().sort(function (a, b) { return (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0) * dir; });
    }

    function renderTable() {
        var rows = filtered();
        document.getElementById('fc-cnt').textContent = fmt(rows.length) + ' пар';
        var body = rows.slice(0, 300).map(function (r) {
            return '<tr data-id="' + r[0] + '">' +
                '<td>' + esc(r[1]) + '</td>' +
                '<td class="fc-hs">' + r[2] + '</td>' +
                '<td class="fc-prod" title="' + esc(hsName(r[2])) + '">' + esc(hsName(r[2]) || '—') + '</td>' +
                '<td class="num">' + fmt(r[3]) + '</td>' +
                '<td class="num">' + fmt(r[4] / 1000) + '</td>' +
                '<td class="num">' + fmt(r[5]) + '</td>' +
                '<td class="num">' + fmt(r[6]) + '</td></tr>';
        }).join('');
        var tb = document.getElementById('fc-tb');
        tb.innerHTML = body;
        tb.querySelectorAll('tr').forEach(function (tr) {
            tr.addEventListener('click', function () { drill(tr.getAttribute('data-id')); });
        });
    }

    function drill(id) {
        var d = current();
        var rows = d.rows.filter(function (r) { return String(r[0]) === String(id); })
                         .sort(function (a, b) { return b[5] - a[5]; });
        if (!rows.length) { return; }
        var name = rows[0][1];
        var cif = rows.reduce(function (s, r) { return s + r[5]; }, 0);
        var box = document.getElementById('fc-drill');
        box.innerHTML = '<div class="fc-drill"><span class="close" title="Закрыть">×</span>' +
            '<h4>' + esc(name) + '</h4>' +
            '<p class="fc-note">' + SOURCES[state.country].idLabel + ' ' + esc(id) +
            ' · кодов: ' + rows.length + ' · суммарный CIF: ' + fmt(cif) + ' USD</p>' +
            '<div class="fc-wrap"><table class="fc-tbl"><thead><tr>' +
            '<th>HS6</th><th>Товар</th><th class="num">Позиций</th><th class="num">Нетто, т</th><th class="num">CIF, USD</th></tr></thead><tbody>' +
            rows.map(function (r) {
                return '<tr><td class="fc-hs">' + r[2] + '</td><td class="fc-prod" title="' + esc(hsName(r[2])) + '">' +
                    esc(hsName(r[2]) || '—') + '</td><td class="num">' + fmt(r[3]) + '</td><td class="num">' +
                    fmt(r[4] / 1000) + '</td><td class="num">' + fmt(r[5]) + '</td></tr>';
            }).join('') + '</tbody></table></div></div>';
        box.querySelector('.close').addEventListener('click', function () { box.innerHTML = ''; });
        box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function renderAll() {
        var s = SOURCES[state.country], d = current();
        document.getElementById('fc-note').textContent = s.note;
        document.querySelectorAll('#foreign .fc-tab').forEach(function (b) {
            b.classList.toggle('on', b.dataset.c === state.country);
        });
        document.getElementById('fc-drill').innerHTML = '';
        var m = d.meta;
        document.getElementById('fc-tiles').innerHTML = [
            ['Импортёров', fmt(m.importers)],
            ['Пар импортёр×HS6', fmt(m.pairs)],
            ['Товарных кодов', fmt(m.hs6)],
            ['Сумма CIF, USD', fmt(m.cif)],
            ['Нетто, т', fmt(m.net / 1000)]
        ].map(function (t) { return '<div class="fc-tile"><div class="v">' + t[1] + '</div><div class="l">' + t[0] + '</div></div>'; }).join('');
        renderTable();
    }

    function exportXlsx() {
        if (typeof XLSX === 'undefined') { alert('Библиотека экспорта недоступна'); return; }
        var s = SOURCES[state.country];
        var rows = filtered().map(function (r) {
            return {
                'Импортёр': r[1], ' ': r[0], 'HS6': r[2], 'Товар': hsName(r[2]),
                'Позиций': r[3], 'Нетто, т': Math.round(r[4] / 1000),
                'CIF, USD': r[5], 'FOB, USD': r[6]
            };
        });
        // переименуем служебный ключ-пробел в идентификатор
        rows.forEach(function (o) { o[s.idLabel] = o[' ']; delete o[' ']; });
        var ws = XLSX.utils.json_to_sheet(rows);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, state.country);
        XLSX.writeFile(wb, 'foreign_customs_' + state.country + '.xlsx');
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }

    function fetchJson(url) {
        return fetch(url, { cache: 'no-store' }).then(function (r) {
            if (!r.ok) { throw new Error('HTTP ' + r.status + ' ' + url); }
            return r.json();
        });
    }

    var initing = false;
    function init() {
        var root = document.getElementById('fc-root');
        if (!root || root.getAttribute('data-loaded') === '1' || initing) { return; }
        initing = true;
        root.innerHTML = '<p class="fc-note">Загрузка данных…</p>';
        Promise.all([
            fetchJson('data/foreign/hs_names_ru.json'),
            fetchJson(SOURCES.CO.file),
            fetchJson(SOURCES.PE.file)
        ]).then(function (res) {
            names = res[0]; cache.CO = res[1]; cache.PE = res[2];
            injectStyles();
            shell(root);
            renderAll();
            root.setAttribute('data-loaded', '1');
        }).catch(function (e) {
            root.innerHTML = '<p class="fc-note">Не удалось загрузить данные: ' + esc(e.message) + '</p>';
            initing = false;
        });
    }

    // Ленивая инициализация при первом открытии раздела «Зарубеж. таможня»
    document.addEventListener('DOMContentLoaded', function () {
        var link = document.querySelector('.sidebar-nav-item[href="#foreign"]');
        if (link) { link.addEventListener('click', function () { setTimeout(init, 0); }); }
        // если страница открыта сразу с #foreign
        if (location.hash === '#foreign') { setTimeout(init, 0); }
    });
})();
