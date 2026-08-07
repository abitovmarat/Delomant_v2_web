/*
 * Модуль «Зарубежная таможня» — импорт по данным зарубежных таможен и статведомств.
 * Самодостаточный, не зависит от main.js.
 *
 * Два РАЗНЫХ типа источников, у каждого своя таблица (см. `kind`):
 *   kind:'firm'    — контрагентская модель, импортёр×HS6 (Колумбия DIAN, Перу SUNAT).
 *   kind:'country' — страновая модель, товар×страна-партнёр, без компаний
 *                    (Казахстан stat.gov.kz, Кыргызстан stat.gov.kg — публикации
 *                    статведомств по кодам, названий компаний там нет в принципе).
 *
 * Данные готовит офлайн-пайплайн (scripts/parse_*.py + scripts/prep_foreign_data.py).
 * Загружаются лениво при первом открытии раздела.
 *
 *   data/foreign/co_aggregate.json  — Колумбия, импортёр×HS6 (только юрлица)
 *   data/foreign/pe_aggregate.json  — Перу, импортёр×HS6 (только юрлица)
 *   data/foreign/kz_aggregate.json  — Казахстан, товар×партнёр, экспорт+импорт
 *   data/foreign/kg_aggregate.json  — Кыргызстан, товар×партнёр, только импорт
 *   data/foreign/hs_names_ru.json   — HS6/HS4 → рус. название (из статистики КЗ/КГ)
 *
 * Только импортёры-юрлица (NIT 8/9 / RUC 20) — персональные данные физлиц отфильтрованы.
 *
 * Провенанс: период, методика, оговорки и категория данных приходят в meta.source
 * снимка (реестр — scripts/foreign_sources.py) и показываются над таблицей и на
 * отдельном листе Excel-выгрузки. В этом файле их дублировать не нужно.
 */
(function () {
    'use strict';

    // Описание источника (период, методика, оговорки) НЕ дублируется здесь —
    // оно приходит в meta.source снимка из scripts/foreign_sources.py, чтобы
    // подпись под таблицей не разъезжалась с тем, из чего снимок собран.
    var SOURCES = {
        CO: { file: 'data/foreign/co_aggregate.json', kind: 'firm', idLabel: 'NIT', sortDefault: 5,
              tab: '🇨🇴 Колумбия' },
        PE: { file: 'data/foreign/pe_aggregate.json', kind: 'firm', idLabel: 'RUC', sortDefault: 5,
              tab: '🇵🇪 Перу' },
        KZ: { file: 'data/foreign/kz_aggregate.json', kind: 'country', sortDefault: 6,
              tab: '🇰🇿 Казахстан' },
        KG: { file: 'data/foreign/kg_aggregate.json', kind: 'country', sortDefault: 5,
              tab: '🇰🇬 Кыргызстан' }
    };

    var CATEGORY = {
        official:   { label: 'официальные данные', cls: 'ok' },
        unofficial: { label: 'без статистической валидации', cls: 'warn' },
        derived:    { label: 'расчётный показатель', cls: 'warn' }
    };

    function src() { return SOURCES[state.country]; }
    function isCountry() { return src().kind === 'country'; }

    var names = null;          // {hs6:{}, hs4:{}}
    var cache = {};            // код страны -> {cols, meta, rows}
    // sortK — индекс колонки в rows; у двух моделей он разный, поэтому при смене
    // страны сбрасывается на «оборот по убыванию» (CIF у firm, импорт USD у country).
    var state = { country: 'CO', sortK: 5, dir: -1, drill: null };

    // Колонка оборота для сортировки по умолчанию: CIF (firm), импорт USD (country).
    function defaultSort() { return src().sortDefault; }

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
        // table-layout:fixed — иначе браузер тянет таблицу под самую длинную ячейку
        // (в статистике КЗ описания товара доходят до ~1000 знаков) и она выходит за экран
        '#foreign table.fc-tbl{border-collapse:collapse;width:100%;font-size:13px;min-width:720px;table-layout:fixed}' +
        '#foreign .fc-tbl th,.fc-tbl td{padding:8px 12px;text-align:left;border-bottom:1px solid var(--fc-line);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '#foreign .fc-tbl th{position:sticky;top:0;background:var(--fc-tile);cursor:pointer;user-select:none;font-size:12px}' +
        '#foreign .fc-tbl th.num,.fc-tbl td.num{text-align:right;font-variant-numeric:tabular-nums}' +
        '#foreign .fc-tbl tbody tr{cursor:default}' +
        '#foreign .fc-tbl tbody tr[data-id]{cursor:pointer}' +
        '#foreign .fc-tbl tbody tr:hover{background:var(--fc-tile)}' +
        '#foreign .fc-hs{color:var(--fc-cob);font-weight:600}' +
        '#foreign .fc-prod{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '#foreign .fc-foot{color:var(--fc-mut);font-size:12px;margin-top:10px}' +
        // журнал источника (провенанс)
        '#foreign .fc-badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;vertical-align:1px}' +
        '#foreign .fc-badge.ok{background:#dcfce7;color:#166534}' +
        '#foreign .fc-badge.warn{background:#fef3c7;color:#92400e}' +
        '@media(prefers-color-scheme:dark){#foreign .fc-badge.ok{background:#14532d;color:#bbf7d0}' +
        '#foreign .fc-badge.warn{background:#78350f;color:#fde68a}}' +
        '#foreign .fc-prov{margin-top:.6em}' +
        '#foreign .fc-prov summary{cursor:pointer;color:var(--fc-cob);font-weight:600;font-size:13px}' +
        '#foreign .fc-prov dl{display:grid;grid-template-columns:minmax(120px,max-content) 1fr;gap:7px 16px;' +
            'margin:.8em 0 0;font-size:13px;line-height:1.5;padding:12px 14px;border:1px solid var(--fc-line);' +
            'border-radius:10px;background:var(--fc-tile)}' +
        '#foreign .fc-prov dt{color:var(--fc-lbl);font-weight:600}' +
        '#foreign .fc-prov dd{margin:0;color:var(--fc-fg)}' +
        '#foreign .fc-prov a{color:var(--fc-cob)}' +
        '#foreign .fc-drill{border:1px solid var(--fc-cob);border-radius:12px;padding:14px 16px;margin-bottom:16px;background:var(--fc-tile)}' +
        '#foreign .fc-drill h4{margin:0 0 .2em;font-size:16px}' +
        '#foreign .fc-drill .close{float:right;cursor:pointer;color:var(--fc-mut);font-size:20px;line-height:1}' +
        // палитра (с учётом тёмной темы приложения, если она есть)
        // --fc-mut — только для второстепенных подписей; --fc-lbl потемнее,
        // для названий полей в журнале источника, чтобы они читались, а не бледнели
        '#foreign{--fc-bg:#fff;--fc-fg:#0f172a;--fc-mut:#57647a;--fc-lbl:#334155;--fc-line:#e2e8f0;--fc-cob:#2563eb;--fc-tile:#f1f5f9}' +
        '@media(prefers-color-scheme:dark){#foreign{--fc-bg:#0b1220;--fc-fg:#e5e9f0;--fc-mut:#a9b7ca;--fc-lbl:#cbd5e1;--fc-line:#1e293b;--fc-cob:#3b82f6;--fc-tile:#111a2e}}';
        var el = document.createElement('style');
        el.id = 'fc-style';
        el.textContent = css;
        document.head.appendChild(el);
    }

    function shell(root) {
        var tabs = Object.keys(SOURCES).map(function (c) {
            return '<button class="fc-tab" data-c="' + c + '">' + SOURCES[c].tab + '</button>';
        }).join('');
        root.innerHTML =
        '<div class="fc-tabs">' + tabs + '</div>' +
        '<p class="fc-note" id="fc-note"></p>' +
        '<div class="fc-tiles" id="fc-tiles"></div>' +
        '<div id="fc-drill"></div>' +
        '<div class="fc-ctrl">' +
            '<input id="fc-q" type="search" autocomplete="off">' +
            '<input id="fc-qhs" type="search" autocomplete="off">' +
            '<button class="fc-btn" id="fc-xlsx">Экспорт в Excel</button>' +
            '<button class="fc-btn" id="fc-use" hidden>Использовать как данные</button>' +
            '<span class="fc-cnt" id="fc-cnt"></span>' +
        '</div>' +
        '<div class="fc-wrap"><table class="fc-tbl">' +
            '<thead id="fc-th"></thead><tbody id="fc-tb"></tbody></table></div>' +
        '<p class="fc-foot" id="fc-foot"></p>';

        root.querySelectorAll('.fc-tab').forEach(function (b) {
            b.addEventListener('click', function () {
                if (state.country === b.dataset.c) { return; }
                state.country = b.dataset.c;
                state.drill = null;
                state.sortK = defaultSort();
                state.dir = -1;
                root.querySelector('#fc-q').value = '';
                root.querySelector('#fc-qhs').value = '';
                renderAll();
            });
        });
        root.querySelector('#fc-q').addEventListener('input', renderTable);
        root.querySelector('#fc-qhs').addEventListener('input', renderTable);
        root.querySelector('#fc-xlsx').addEventListener('click', exportXlsx);
        root.querySelector('#fc-use').addEventListener('click', sendToApp);
    }

    // Описание колонок текущей модели: k — индекс в rows (null = вычисляемая),
    // num — числовая, cell — как отрисовать ячейку.
    // w — доля ширины таблицы: при table-layout:fixed колонки надо задать явно,
    // иначе длинное описание товара перетянет одеяло на себя.
    function columns() {
        var s = src();
        if (s.kind === 'firm') {
            return [
                { t: 'Импортёр', k: 1, w: '22%', cell: function (r) { return esc(r[1]); } },
                { t: 'HS6', k: 2, w: '8%', cls: 'fc-hs', cell: function (r) { return r[2]; } },
                { t: 'Товар', k: null, w: '26%', cell: prodCell },
                { t: 'Позиций', k: 3, w: '9%', num: true, cell: function (r) { return fmt(r[3]); } },
                { t: 'Нетто, т', k: 4, w: '11%', num: true, cell: function (r) { return fmt(r[4] / 1000); } },
                { t: 'CIF, USD', k: 5, w: '12%', num: true, cell: function (r) { return fmt(r[5]); } },
                { t: 'FOB, USD', k: 6, w: '12%', num: true, cell: function (r) { return fmt(r[6]); } }
            ];
        }
        if (state.country === 'KZ') {
            return [
                { t: 'Код ТН ВЭД', k: 0, w: '10%', cls: 'fc-hs', cell: function (r) { return r[0]; } },
                { t: 'Товар', k: 1, w: '30%', cell: prodCell },
                { t: 'Партнёр', k: 2, w: '12%', cell: function (r) { return esc(r[2]); } },
                { t: 'Экспорт, т', k: 3, w: '11%', num: true, cell: function (r) { return fmt(r[3]); } },
                { t: 'Экспорт, USD', k: 4, w: '13%', num: true, cell: function (r) { return fmt(r[4]); } },
                { t: 'Импорт, т', k: 5, w: '11%', num: true, cell: function (r) { return fmt(r[5]); } },
                { t: 'Импорт, USD', k: 6, w: '13%', num: true, cell: function (r) { return fmt(r[6]); } }
            ];
        }
        return [   // KG: только импорт, натуральный объём в своей единице
            { t: 'Код ТН ВЭД', k: 0, w: '10%', cls: 'fc-hs', cell: function (r) { return r[0]; } },
            { t: 'Товар', k: 1, w: '38%', cell: prodCell },
            { t: 'Партнёр', k: 2, w: '14%', cell: function (r) { return esc(r[2]); } },
            { t: 'Количество', k: 3, w: '13%', num: true, cell: function (r) { return fmt(r[3]); } },
            { t: 'Единица', k: 4, w: '11%', cell: function (r) { return esc(r[4]); } },
            { t: 'Импорт, USD', k: 5, w: '14%', num: true, cell: function (r) { return fmt(r[5]); } }
        ];
    }

    // У firm-источников названия товара в строке нет — берём из словаря по HS.
    // У country-источников товар подписан в самом источнике (колонка 1).
    function prodCell(r) {
        var nm = isCountry() ? r[1] : hsName(r[2]);
        return '<span class="fc-prod" title="' + esc(nm) + '">' + esc(nm || '—') + '</span>';
    }

    function renderHead() {
        var cols = columns();
        document.getElementById('fc-th').innerHTML = '<tr>' + cols.map(function (c, i) {
            var w = c.w ? ' style="width:' + c.w + '"' : '';
            return c.k === null
                ? '<th' + w + '>' + c.t + '</th>'
                : '<th data-i="' + i + '"' + (c.num ? ' class="num"' : '') + w + '>' + c.t + '</th>';
        }).join('') + '</tr>';
        document.querySelectorAll('#fc-th th[data-i]').forEach(function (th) {
            th.addEventListener('click', function () {
                var c = cols[+th.dataset.i];
                if (state.sortK === c.k) { state.dir *= -1; }
                else { state.sortK = c.k; state.dir = c.num ? -1 : 1; }
                renderTable();
            });
        });
    }

    function current() { return cache[state.country]; }

    // Левый поиск: импортёр (firm) / страна-партнёр (country).
    // Правый поиск: код или название товара — в обеих моделях.
    function filtered() {
        var d = current(); if (!d) { return []; }
        var q = (document.getElementById('fc-q').value || '').trim().toUpperCase();
        var h = (document.getElementById('fc-qhs').value || '').trim().toUpperCase();
        var ctry = isCountry();
        var nameI = ctry ? 2 : 1;      // колонка «кто» (партнёр / импортёр)
        var codeI = ctry ? 0 : 2;      // колонка кода ТН ВЭД
        var rows = d.rows;
        if (q) { rows = rows.filter(function (r) { return String(r[nameI]).toUpperCase().indexOf(q) >= 0; }); }
        if (h) {
            rows = rows.filter(function (r) {
                var nm = ctry ? r[1] : hsName(r[2]);
                return String(r[codeI]).indexOf(h) === 0 || String(nm).toUpperCase().indexOf(h) >= 0;
            });
        }
        var k = state.sortK, dir = state.dir;
        return rows.slice().sort(function (a, b) { return (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0) * dir; });
    }

    function renderTable() {
        var rows = filtered(), cols = columns(), ctry = isCountry();
        document.getElementById('fc-cnt').textContent = fmt(rows.length) + ' пар';
        var tb = document.getElementById('fc-tb');
        tb.innerHTML = rows.slice(0, 300).map(function (r) {
            // drill есть только у firm-модели: там строка = импортёр, у которого много кодов
            return '<tr' + (ctry ? '' : ' data-id="' + esc(r[0]) + '"') + '>' + cols.map(function (c) {
                return '<td' + (c.num ? ' class="num"' : c.cls ? ' class="' + c.cls + '"' : '') + '>' +
                    c.cell(r) + '</td>';
            }).join('') + '</tr>';
        }).join('');
        if (!ctry) {
            tb.querySelectorAll('tr').forEach(function (tr) {
                tr.addEventListener('click', function () { drill(tr.getAttribute('data-id')); });
            });
        }
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

    function tiles(m) {
        if (!isCountry()) {
            return [['Импортёров', fmt(m.importers)], ['Пар импортёр×HS6', fmt(m.pairs)],
                    ['Товарных кодов', fmt(m.hs6)], ['Сумма CIF, USD', fmt(m.cif)],
                    ['Нетто, т', fmt(m.net / 1000)]];
        }
        var t = [['Товарных кодов', fmt(m.codes)], ['Стран-партнёров', fmt(m.partners)],
                 ['Пар товар×партнёр', fmt(m.pairs)], ['Импорт, USD', fmt(m.import_usd)]];
        if (m.flows === 'export+import') {   // КЗ публикует оба потока и тоннаж
            t.push(['Экспорт, USD', fmt(m.export_usd)]);
            t.push(['Импорт, т', fmt(m.import_t)]);
        }
        return t;
    }

    // Журнал источника: что за набор, за какой период, как посчитано и чего не стоит
    // от него ждать. Раскрывается по клику, чтобы не перегружать экран.
    function renderProvenance(m) {
        var p = m.source, cat = CATEGORY[p.category] || CATEGORY.derived;
        var rows = [
            ['Ведомство', esc(p.agency)],
            ['Набор данных', esc(p.dataset)],
            ['Период', esc(p.period_label) + ' (' + esc(p.period) + ')'],
            ['Дата выгрузки', esc(p.retrieved) + ' · снимок собран ' + esc(m.built)],
            ['Единицы', esc(p.currency) + ' · ' + esc(p.value_basis) + ' · ' + esc(p.weight_unit)],
            ['Методика', esc(p.method)],
            ['Ограничения', esc(p.caveats)],
            ['Исходный файл', esc(p.source_file)],
            ['Ссылка', '<a href="' + esc(p.url) + '" target="_blank" rel="noopener">' + esc(p.url) + '</a>']
        ];
        document.getElementById('fc-note').innerHTML =
            '<span class="fc-badge ' + cat.cls + '">' + esc(cat.label) + '</span> ' +
            '<b>' + esc(p.title) + '</b> · ' + esc(p.period_label) +
            '<details class="fc-prov"><summary>Журнал источника</summary><dl>' +
            rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('') +
            '</dl></details>';
    }

    function renderAll() {
        var s = src(), d = current(), ctry = isCountry();
        renderProvenance(d.meta);
        document.querySelectorAll('#foreign .fc-tab').forEach(function (b) {
            b.classList.toggle('on', b.dataset.c === state.country);
        });
        document.getElementById('fc-drill').innerHTML = '';
        // Передача в приложение возможна только для контрагентской модели —
        // см. пояснение в toAppRows()
        var use = document.getElementById('fc-use');
        use.hidden = ctry;
        use.title = 'Загрузить снимок как активную таблицу приложения ' +
                    '(разделы «Обработка», «Анализ», «Презентация»)';
        document.getElementById('fc-q').placeholder = ctry ? 'Поиск по стране-партнёру…' : 'Поиск по импортёру…';
        document.getElementById('fc-qhs').placeholder =
            (ctry ? (d.meta.hs_level === 4 ? 'HS4' : 'HS6') : 'HS6') + ' или название товара…';
        document.getElementById('fc-foot').textContent = 'Показаны топ-300 по текущему фильтру и сортировке. ' +
            (ctry ? 'Детализация до контрагента невозможна: в источнике только коды.'
                  : 'Клик по строке — все коды этого импортёра.') +
            ' Клик по заголовку — сортировка.';
        document.getElementById('fc-tiles').innerHTML = tiles(d.meta).map(function (t) {
            return '<div class="fc-tile"><div class="v">' + t[1] + '</div><div class="l">' + t[0] + '</div></div>';
        }).join('');
        renderHead();
        renderTable();
    }

    function exportXlsx() {
        if (typeof XLSX === 'undefined') { alert('Библиотека экспорта недоступна'); return; }
        var s = src(), rows;
        if (isCountry()) {
            rows = filtered().map(function (r) {
                var o = { 'Код ТН ВЭД': r[0], 'Товар': r[1], 'Партнёр': r[2] };
                if (state.country === 'KZ') {
                    o['Экспорт, т'] = r[3]; o['Экспорт, USD'] = r[4];
                    o['Импорт, т'] = r[5]; o['Импорт, USD'] = r[6];
                } else {
                    o['Количество'] = r[3]; o['Единица'] = r[4]; o['Импорт, USD'] = r[5];
                }
                return o;
            });
        } else {
            rows = filtered().map(function (r) {
                return {
                    'Импортёр': r[1], ' ': r[0], 'HS6': r[2], 'Товар': hsName(r[2]),
                    'Позиций': r[3], 'Нетто, т': Math.round(r[4] / 1000),
                    'CIF, USD': r[5], 'FOB, USD': r[6]
                };
            });
            // переименуем служебный ключ-пробел в идентификатор
            rows.forEach(function (o) { o[s.idLabel] = o[' ']; delete o[' ']; });
        }
        var ws = XLSX.utils.json_to_sheet(rows);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, state.country);
        // отдельный лист с журналом источника: выгрузка не должна терять провенанс
        var p = current().meta.source;
        var info = [
            ['Источник', p.title], ['Ведомство', p.agency], ['Набор данных', p.dataset],
            ['Период', p.period_label + ' (' + p.period + ')'],
            ['Категория данных', (CATEGORY[p.category] || {}).label || p.category],
            ['Дата выгрузки', p.retrieved], ['Снимок собран', current().meta.built],
            ['Валюта', p.currency], ['Основа стоимости', p.value_basis],
            ['Натуральная единица', p.weight_unit], ['Методика', p.method],
            ['Ограничения', p.caveats], ['Исходный файл', p.source_file], ['Ссылка', p.url],
            ['Выгружено строк', rows.length]
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(info), 'Источник');
        XLSX.writeFile(wb, 'foreign_customs_' + state.country + '.xlsx');
    }

    /*
     * Передача снимка в приложение как активной таблицы.
     *
     * Работает только для контрагентской модели (Колумбия, Перу): её поля
     * ложатся на канонические колонки приложения один в один, и после
     * загрузки доступны все обычные анализы и слайды презентации.
     *
     * Для КЗ/КГ передача сознательно не делается: там нет получателя,
     * у КЗ два потока в одной строке (пришлось бы её раздваивать, и суммы
     * разошлись бы с журналом источника), у КГ 5 023 строки из 14 260
     * измеряются не в тоннах — колонку веса заполнить нечем. Витрина для
     * них остаётся единственным честным представлением.
     */
    function toAppRows() {
        var d = current(), s = src(), p = d.meta.source;
        var headers = ['Дата регистрации', 'Год', 'Страна отправления',
                       'Наименование получателя', s.idLabel, 'Код товара по ТН ВЭД',
                       'Наименование и характеристики товаров', 'Вес нетто, кг',
                       'Статистическая стоимость, USD', 'Фактурная стоимость'];
        // Период снимка — одна дата на все строки: агрегат помесячной разбивки
        // не содержит, выдумывать её нельзя.
        var period = String(p.period || '');
        var year = period.slice(0, 4);
        var date = /^\d{4}-\d{2}$/.test(period) ? period + '-01' : (year ? year + '-01-01' : '');
        var country = (p.title || '').split(' — ')[0];
        var rows = d.rows.map(function (r) {
            return [date, year, country, r[1], r[0], r[2], hsName(r[2]), r[4], r[5], r[6]];
        });
        return { headers: headers, rows: rows };
    }

    function sendToApp() {
        if (isCountry()) { return; }
        if (!window.DelomantData) {
            alert('Модуль данных приложения недоступен.');
            return;
        }
        var d = current(), p = d.meta.source;
        var label = p.title + ' — ' + p.period_label;
        if (window.DelomantData.hasData() &&
            !confirm('Загруженные данные будут заменены на «' + label + '».\n\nПродолжить?')) {
            return;
        }
        var parsed = toAppRows();
        var note = 'Источник: ' + p.agency + ' (' + p.dataset + '), ' + p.period_label +
                   '; выгрузка ' + p.retrieved +
                   (p.category === 'unofficial' ? '; данные без статистической валидации' : '');
        window.DelomantData.apply(label, parsed, 'foreign', note);
        var link = document.querySelector('.sidebar-nav-item[href="#data"]');
        if (link) { link.click(); }
        alert('Загружено строк: ' + fmt(parsed.rows.length) + '.\n\n' +
              'Данные доступны в разделах «Обработка», «Анализ» и «Презентация».\n' +
              'Источник: ' + p.agency + ', ' + p.period_label + '.');
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
        var codes = Object.keys(SOURCES);
        Promise.all([fetchJson('data/foreign/hs_names_ru.json')].concat(
            codes.map(function (c) { return fetchJson(SOURCES[c].file); })
        )).then(function (res) {
            names = res[0];
            codes.forEach(function (c, i) { cache[c] = res[i + 1]; });
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
