/*
 * Витрина Delomant Analytics. Графики рисуются тем же способом, что и в
 * приложении (scripts/main.js): руками собранный SVG, без сторонних
 * библиотек, с теми же цветами — витрина показывает настоящий вид
 * продукта, а не приблизительный макет.
 *
 * Данные — обезличенный срез data/demo/frozen_strawberries.json.
 * Реальные выгрузки клиентов на публичную страницу не попадают.
 */
(function () {
    'use strict';

    var C = {
        primary: '#2563EB',
        brand: '#211CB0',
        text: '#0F172A',
        muted: '#64748B',
        grid: '#E2E8F0',
        ok: '#16A34A',
        warn: '#F59E0B',
        bad: '#DC2626'
    };
    var FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'DejaVu Sans',sans-serif";
    // Цвета линий совпадают с эталонной запиской docs/analytics/
    var SERIES_COLORS = ['#211CB0', '#2F2BC7', '#16A34A', '#8B93F2', '#F59E0B'];

    var DEMO_URL = 'data/demo/frozen_strawberries.json';
    var demo = null;

    /** Разряды пробелами, как formatNumber в приложении. */
    function fmt(n) {
        return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }
    /*
     * Экранируем и кавычки: значения подставляются не только в текст, но и
     * в HTML-атрибуты (value у чекбоксов). Демо-данные свои, но файл может
     * смениться, а незакрытая кавычка в атрибуте — готовая дыра.
     */
    function esc(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    function svgOpen(w, h, cls) {
        return '<svg class="' + (cls || '') + '" viewBox="0 0 ' + w + ' ' + h + '" ' +
               'preserveAspectRatio="xMidYMid meet" role="img">' +
               '<style>text{font-family:' + FONT + ';font-size:12px;fill:' + C.text + '}</style>';
    }

    /* ---------- Графики ---------- */

    /** Горизонтальные полосы: повторяет buildBarChart из main.js. */
    function chartBars(items, opts) {
        opts = opts || {};
        var top = items.slice(0, opts.limit || 8);
        /*
         * Поля слева и справа считаем по самым длинным строкам: иначе
         * «469 720 кг (28.3%)» упирается в край, а «Великобритания»
         * обрезается слева. Названия у лидера рисуются жирным, поэтому
         * коэффициент берём с запасом на bold, а потолок — такой, чтобы
         * самое длинное название целиком помещалось.
         */
        var nameLen = 0, valLen = 0;
        top.forEach(function (it) {
            if (it.name.length > nameLen) { nameLen = it.name.length; }
            if (it.label.length > valLen) { valLen = it.label.length; }
        });
        var w = 560;
        var labelW = Math.min(200, Math.max(96, nameLen * 7.3 + 16));
        var valueW = Math.min(150, Math.max(70, valLen * 5.9 + 14));
        var barH = 20, gap = 9, padTop = 8;
        var h = padTop * 2 + top.length * (barH + gap) - gap;
        var innerW = w - labelW - valueW;
        var max = 0;
        top.forEach(function (it) { if (it.value > max) { max = it.value; } });
        if (!max) { max = 1; }

        // Название, не влезающее даже в максимальное поле, укорачиваем:
        // иначе оно уходит за левый край картинки
        var maxChars = Math.floor((labelW - 12) / 7.3);

        var s = svgOpen(w, h);
        top.forEach(function (it, i) {
            var y = padTop + i * (barH + gap);
            var bw = Math.max(2, it.value / max * innerW);
            var color = it.highlight ? C.brand : C.primary;
            var name = it.name.length > maxChars ? it.name.slice(0, maxChars - 1) + '…' : it.name;
            s += '<text x="' + (labelW - 8) + '" y="' + (y + barH / 2 + 4) + '" text-anchor="end" font-size="11.5"' +
                 (it.highlight ? ' font-weight="700"' : '') + '>' + esc(name) + '</text>';
            s += '<rect x="' + labelW + '" y="' + y + '" width="' + bw + '" height="' + barH + '" fill="' + color + '" rx="3"/>';
            s += '<text x="' + (labelW + bw + 7) + '" y="' + (y + barH / 2 + 4) + '" font-size="11" fill="' + C.muted + '">' +
                 esc(it.label) + '</text>';
        });
        return s + '</svg>';
    }

    /** Линии по годам: динамика объёмов, тонны. */
    function chartLines(series, years) {
        var w = 560, h = 236;
        // Поле справа считаем по самой длинной подписи, иначе «Великобритания»
        // выходит за край viewBox и обрезается
        var longest = 0;
        series.forEach(function (se) { if (se.name.length > longest) { longest = se.name.length; } });
        var pad = { top: 16, right: Math.min(150, Math.max(80, longest * 6.2 + 16)), bottom: 28, left: 44 };
        var innerW = w - pad.left - pad.right;
        var innerH = h - pad.top - pad.bottom;
        var max = 0;
        series.forEach(function (se) {
            se.values.forEach(function (v) { if (v > max) { max = v; } });
        });
        max = Math.ceil(max / 20) * 20 || 1;

        function X(i) { return pad.left + (years.length < 2 ? 0 : i / (years.length - 1) * innerW); }
        function Y(v) { return pad.top + innerH - v / max * innerH; }

        var s = svgOpen(w, h);
        // Сетка и подписи оси Y
        for (var g = 0; g <= 4; g++) {
            var val = max / 4 * g;
            var y = Y(val);
            s += '<line x1="' + pad.left + '" y1="' + y + '" x2="' + (pad.left + innerW) + '" y2="' + y +
                 '" stroke="' + C.grid + '" stroke-width="1"/>';
            s += '<text x="' + (pad.left - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10.5" fill="' + C.muted + '">' +
                 Math.round(val) + '</text>';
        }
        years.forEach(function (yr, i) {
            s += '<text x="' + X(i) + '" y="' + (h - 9) + '" text-anchor="middle" font-size="10.5" fill="' + C.muted + '">' + yr + '</text>';
        });

        // Подписи справа разводим, чтобы не накладывались
        var labels = series.map(function (se, i) {
            return { name: se.name, color: SERIES_COLORS[i % SERIES_COLORS.length], y: Y(se.values[se.values.length - 1]) };
        }).sort(function (a, b) { return a.y - b.y; });
        for (var k = 1; k < labels.length; k++) {
            if (labels[k].y - labels[k - 1].y < 14) { labels[k].y = labels[k - 1].y + 14; }
        }
        // Если стопка подписей упёрлась в низ, сдвигаем её вверх целиком
        var overflow = labels.length ? labels[labels.length - 1].y - (h - 12) : 0;
        if (overflow > 0) {
            labels.forEach(function (l) { l.y -= overflow; });
        }

        series.forEach(function (se, i) {
            var color = SERIES_COLORS[i % SERIES_COLORS.length];
            var d = se.values.map(function (v, j) { return (j ? 'L' : 'M') + X(j) + ' ' + Y(v); }).join(' ');
            s += '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2.2" stroke-linejoin="round"/>';
            se.values.forEach(function (v, j) {
                s += '<circle cx="' + X(j) + '" cy="' + Y(v) + '" r="3" fill="#fff" stroke="' + color + '" stroke-width="2"/>';
            });
        });
        labels.forEach(function (l) {
            s += '<text x="' + (pad.left + innerW + 9) + '" y="' + (l.y + 4) + '" font-size="11" fill="' + l.color + '" font-weight="600">' +
                 esc(l.name) + '</text>';
        });
        return s + '</svg>';
    }

    /**
     * Кольцо долей. Доли и подпись в центре считаются по переданным
     * странам, а не по всему рынку: иначе при выборе одной страны кольцо
     * заполнено целиком, а в легенде стоит её доля от мира — цифры
     * противоречат картинке.
     */
    function chartDonut(items, totalWeight) {
        var w = 560, h = 236, cx = 118, cy = h / 2, r = 82, thick = 30;
        var top = items.slice(0, 6);
        var rest = items.slice(6).reduce(function (a, it) { return a + it.share; }, 0);
        var parts = top.map(function (it, i) {
            return { name: it.name, share: it.share, color: SERIES_COLORS[i % SERIES_COLORS.length] };
        });
        if (rest > 0.05) { parts.push({ name: 'Прочие', share: rest, color: '#CBD5E1' }); }

        var total = parts.reduce(function (a, p) { return a + p.share; }, 0) || 1;
        // Доли пересчитываем от выбранных стран, чтобы сумма давала 100%
        // и совпадала с тем, что нарисовано в кольце
        parts.forEach(function (p) { p.pct = p.share / total * 100; });

        // Вес выбранных стран в тоннах — для подписи в центре
        var tons = typeof totalWeight === 'number'
            ? totalWeight
            : items.reduce(function (a, it) { return a + (it.weight || 0); }, 0) / 1000;
        var s = svgOpen(w, h);
        var angle = -Math.PI / 2;
        parts.forEach(function (p) {
            var sweep = p.share / total * Math.PI * 2;
            var end = angle + sweep;
            var large = sweep > Math.PI ? 1 : 0;
            var x1 = cx + Math.cos(angle) * r, y1 = cy + Math.sin(angle) * r;
            var x2 = cx + Math.cos(end) * r, y2 = cy + Math.sin(end) * r;
            s += '<path d="M' + x1 + ' ' + y1 + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x2 + ' ' + y2 + '" ' +
                 'fill="none" stroke="' + p.color + '" stroke-width="' + thick + '"/>';
            angle = end;
        });
        s += '<text x="' + cx + '" y="' + (cy - 3) + '" text-anchor="middle" font-size="19" font-weight="800">' +
             fmt(tons) + ' т</text>';
        s += '<text x="' + cx + '" y="' + (cy + 15) + '" text-anchor="middle" font-size="11" fill="' + C.muted + '">импорт 2020–2024</text>';

        var lx = 250, ly = cy - parts.length * 11 + 6;
        parts.forEach(function (p, i) {
            var y = ly + i * 22;
            s += '<rect x="' + lx + '" y="' + (y - 8) + '" width="11" height="11" rx="3" fill="' + p.color + '"/>';
            s += '<text x="' + (lx + 19) + '" y="' + (y + 1) + '" font-size="11.5">' + esc(p.name) + '</text>';
            s += '<text x="' + (lx + 250) + '" y="' + (y + 1) + '" text-anchor="end" font-size="11.5" fill="' + C.muted + '">' +
                 p.pct.toFixed(1) + '%</text>';
        });
        return s + '</svg>';
    }

    /* ---------- Первый экран ---------- */

    function renderHero() {
        var slot = document.getElementById('heroChart');
        if (!slot || !demo) { return; }
        var series = demo.countries.slice(0, 5).map(function (c) {
            return { name: c.name, values: c.series };
        });
        slot.innerHTML = chartLines(series, demo.meta.years);
    }

    /* ---------- Витрина анализов ---------- */

    var ANALYSES = [
        ['Объёмы и стоимость', 'Итоги по весу, стоимости и средней цене за выбранный период.'],
        ['Объёмы по странам', 'Топ-10 направлений с долей каждого в общем объёме.'],
        ['Динамика цен по странам', 'Как менялась цена за килограмм у каждого поставщика.'],
        ['Структура импорта', 'Сводная страна × год по весу и по стоимости.'],
        ['Структура по изготовителям', 'Кто из производителей занимает какую долю рынка.'],
        ['Потоки между странами', 'Направления поставок: откуда, куда и в каком объёме.'],
        ['Поквартальная динамика цен', 'Сезонность и ценовые колебания внутри года.'],
        ['Топ получателей', 'Крупнейшие покупатели с объёмами и средними ценами.'],
        ['Топ отправителей', 'Ведущие экспортёры и их положение в рейтинге.'],
        ['Топ изготовителей', 'Рейтинг производителей по объёму отгрузок.'],
        ['Сигналы и риски', 'Резкие отклонения цен и объёмов, требующие внимания.'],
        ['Изменения рынка', 'Кто вырос, кто ушёл и какие игроки появились впервые.']
    ];

    // Простые контурные иконки — без внешних библиотек и шрифтов
    var ICONS = [
        'M4 14h3v5H4zM9.5 8h3v11h-3zM15 11h3v8h-3z',
        'M4 18h16M6 18V9M11 18V5M16 18v-7',
        'M4 16l4-5 3 3 5-7 4 4',
        'M4 5h16v4H4zM4 11h16v4H4zM4 17h9v3H4z',
        'M5 19V7l7-3 7 3v12M9 19v-5h6v5',
        'M4 8h9M13 8l-3-3M13 8l-3 3M20 16h-9M11 16l3-3M11 16l3 3',
        'M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-6',
        'M12 4l2.4 5 5.6.7-4 3.9 1 5.4-5-2.7-5 2.7 1-5.4-4-3.9 5.6-.7z',
        'M5 20V9M12 20V4M19 20v-7',
        'M6 20h12M8 20v-6a4 4 0 018 0v6M12 8V4',
        'M12 4l9 16H3zM12 10v5M12 17.5v.5',
        'M4 17l5-6 4 3 7-8M20 6v5h-5'
    ];

    function renderTiles() {
        var box = document.getElementById('tiles');
        if (!box) { return; }
        box.innerHTML = ANALYSES.map(function (a, i) {
            return '<article class="tile">' +
                '<div class="ico"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" ' +
                'stroke="' + C.brand + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="' + ICONS[i % ICONS.length] + '"/></svg></div>' +
                '<h3>' + esc(a[0]) + '</h3><p>' + esc(a[1]) + '</p></article>';
        }).join('');
    }

    /* ---------- Интерактивное мини-демо ---------- */

    var MODES = [
        { id: 'volume', name: 'Объёмы по странам',  sub: 'Топ направлений по весу, 2020–2024' },
        { id: 'price',  name: 'Динамика цен',       sub: 'Средняя импортная цена, USD за килограмм' },
        { id: 'share',  name: 'Структура импорта',  sub: 'Доли стран в объёме поставок, 2020–2024' },
        { id: 'trend',  name: 'Динамика объёмов',   sub: 'Как менялись поставки с 2020 по 2024 год' }
    ];

    var state = { mode: 'volume', picked: [] };

    /** Страны в порядке исходного набора — так цвета линий не скачут. */
    function selected() {
        return demo.countries.filter(function (c) { return state.picked.indexOf(c.name) !== -1; });
    }

    function renderDemoControls() {
        var modes = document.getElementById('demoModes');
        var list = document.getElementById('demoCountries');
        if (!modes || !list) { return; }

        modes.innerHTML = MODES.map(function (m) {
            return '<label class="demo-mode' + (m.id === state.mode ? ' on' : '') + '">' +
                '<input type="radio" name="demo-mode" value="' + m.id + '"' +
                (m.id === state.mode ? ' checked' : '') + '> ' + esc(m.name) + '</label>';
        }).join('');

        list.innerHTML = demo.countries.map(function (c, i) {
            var on = state.picked.indexOf(c.name) !== -1;
            return '<label class="demo-check">' +
                '<input type="checkbox" value="' + esc(c.name) + '"' + (on ? ' checked' : '') + '>' +
                '<span class="sw" style="background:' + SERIES_COLORS[i % SERIES_COLORS.length] + '"></span>' +
                '<span>' + esc(c.name) + '</span></label>';
        }).join('');

        modes.addEventListener('change', function (e) {
            if (e.target.name !== 'demo-mode') { return; }
            state.mode = e.target.value;
            Array.prototype.forEach.call(modes.querySelectorAll('.demo-mode'), function (el) {
                el.classList.toggle('on', el.querySelector('input').checked);
            });
            renderDemoChart();
        });

        list.addEventListener('change', function (e) {
            if (e.target.type !== 'checkbox') { return; }
            var name = e.target.value;
            var at = state.picked.indexOf(name);
            if (e.target.checked && at === -1) { state.picked.push(name); }
            if (!e.target.checked && at !== -1) { state.picked.splice(at, 1); }
            renderDemoChart();
        });

        var allBtn = document.getElementById('demoAll');
        if (allBtn) {
            allBtn.addEventListener('click', function () {
                var all = state.picked.length === demo.countries.length;
                state.picked = all ? [] : demo.countries.map(function (c) { return c.name; });
                Array.prototype.forEach.call(list.querySelectorAll('input'), function (i) { i.checked = !all; });
                renderDemoChart();
            });
        }
    }

    function renderDemoChart() {
        var slot = document.getElementById('demoChart');
        var title = document.getElementById('demoTitle');
        var sub = document.getElementById('demoSub');
        var count = document.getElementById('demoCount');
        if (!slot || !demo) { return; }

        var mode = MODES.filter(function (m) { return m.id === state.mode; })[0];
        title.textContent = mode.name;
        sub.textContent = mode.sub;

        var rows = selected();
        var n = rows.length;
        count.textContent = n + ' ' + (n % 10 === 1 && n % 100 !== 11 ? 'страна' :
                            (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'страны' : 'стран'));

        if (!n) {
            slot.innerHTML = '<p class="demo-empty">Выберите хотя бы одну страну слева.</p>';
            return;
        }

        if (state.mode === 'volume') {
            var byVolume = rows.slice().sort(function (a, b) { return b.weight - a.weight; });
            slot.innerHTML = chartBars(byVolume.map(function (c, i) {
                return { name: c.name, value: c.weight, label: fmt(c.weight) + ' кг (' + c.share.toFixed(1) + '%)', highlight: i === 0 };
            }), { limit: 10 });
        } else if (state.mode === 'price') {
            var byPrice = rows.slice().sort(function (a, b) { return b.price - a.price; });
            slot.innerHTML = chartBars(byPrice.map(function (c, i) {
                return { name: c.name, value: c.price, label: '$' + c.price.toFixed(2) + '/кг', highlight: i === 0 };
            }), { limit: 10 });
        } else if (state.mode === 'share') {
            var byShare = rows.slice().sort(function (a, b) { return b.share - a.share; });
            slot.innerHTML = chartDonut(byShare);
        } else {
            slot.innerHTML = chartLines(rows.slice(0, 6).map(function (c) {
                return { name: c.name, values: c.series };
            }), demo.meta.years);
        }
    }

    /** Текущий вид в CSV — как кнопка выгрузки в приложении. */
    function demoCsv() {
        var rows = selected();
        var head, lines;
        if (state.mode === 'trend') {
            head = ['Страна'].concat(demo.meta.years).join(';');
            lines = rows.map(function (c) { return [c.name].concat(c.series).join(';'); });
        } else {
            head = 'Страна;Вес, кг;Доля, %;Цена, USD/кг';
            lines = rows.map(function (c) { return [c.name, c.weight, c.share, c.price].join(';'); });
        }
        // BOM — иначе Excel открывает кириллицу кракозябрами
        var blob = new Blob(['﻿' + head + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        saveBlob(blob, 'delomant_demo_' + state.mode + '.csv');
    }

    /** SVG → PNG через canvas, как exportChartPNG в приложении. */
    function demoPng() {
        var svg = document.querySelector('#demoChart svg');
        if (!svg) { return; }
        var box = svg.viewBox.baseVal;
        var w = box.width || 560, h = box.height || 240, scale = 2;
        var copy = svg.cloneNode(true);
        copy.setAttribute('width', w);
        copy.setAttribute('height', h);
        var xml = new XMLSerializer().serializeToString(copy);
        var img = new Image();
        img.onload = function () {
            var cv = document.createElement('canvas');
            cv.width = w * scale;
            cv.height = h * scale;
            var ctx = cv.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, cv.width, cv.height);
            ctx.drawImage(img, 0, 0, cv.width, cv.height);
            cv.toBlob(function (blob) { saveBlob(blob, 'delomant_demo_' + state.mode + '.png'); });
        };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    }

    function saveBlob(blob, name) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    function initDemo() {
        state.picked = demo.countries.slice(0, 6).map(function (c) { return c.name; });
        renderDemoControls();
        renderDemoChart();
        var png = document.getElementById('demoPng');
        var csv = document.getElementById('demoCsv');
        if (png) { png.addEventListener('click', demoPng); }
        if (csv) { csv.addEventListener('click', demoCsv); }
    }

    /* ---------- Вход поверх витрины ---------- */

    /*
     * Модальное окно входа. Форма уходит на /login с полем ajax=1, поэтому
     * при неверном пароле окно остаётся открытым. Если JavaScript отключён,
     * ссылки ведут на /login, а форма отправляется обычным способом —
     * пользователь просто увидит отдельную страницу входа.
     */
    function initLogin() {
        var modal = document.getElementById('loginModal');
        var form = document.getElementById('loginForm');
        if (!modal || !form) { return; }

        var err = document.getElementById('loginErr');
        var btn = document.getElementById('loginBtn');
        var lastFocus = null;

        function open(e) {
            if (e) { e.preventDefault(); }
            lastFocus = document.activeElement;
            modal.hidden = false;
            document.body.style.overflow = 'hidden';
            var first = form.querySelector('input[name="login"]');
            if (first) { first.focus(); }
        }

        function close() {
            modal.hidden = true;
            document.body.style.overflow = '';
            err.hidden = true;
            form.reset();
            if (lastFocus) { lastFocus.focus(); }
        }

        // Любая ссылка с data-login открывает окно вместо перехода
        Array.prototype.forEach.call(document.querySelectorAll('[data-login]'), function (el) {
            el.addEventListener('click', open);
        });

        modal.addEventListener('click', function (e) {
            if (e.target.hasAttribute('data-close')) {
                // Ссылка на тарифы должна и закрыть окно, и увести к якорю
                if (e.target.tagName !== 'A') { e.preventDefault(); }
                close();
            }
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !modal.hidden) { close(); }
        });

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            err.hidden = true;
            btn.disabled = true;
            btn.textContent = 'Проверяем…';

            fetch(form.action, {
                method: 'POST',
                body: new FormData(form),
                credentials: 'same-origin'
            })
                .then(function (r) {
                    return r.json().catch(function () { return { ok: false }; });
                })
                .then(function (res) {
                    if (res.ok) {
                        window.location.href = res.redirect || '/login';
                        return;
                    }
                    err.textContent = res.error || 'Неверный логин или пароль.';
                    err.hidden = false;
                    btn.disabled = false;
                    btn.textContent = 'Войти';
                    var pass = form.querySelector('input[name="password"]');
                    if (pass) { pass.value = ''; pass.focus(); }
                })
                .catch(function () {
                    // Сеть или сервер не ответили — уводим на обычную страницу входа
                    window.location.href = '/login';
                });
        });
    }

    /* ---------- Запуск ---------- */

    // Графики нужны и мини-демо, поэтому отдаём их наружу
    window.DelomantLanding = {
        colors: C,
        chartBars: chartBars,
        chartLines: chartLines,
        chartDonut: chartDonut,
        fmt: fmt,
        esc: esc,
        getDemo: function () { return demo; }
    };

    renderTiles();
    initLogin();

    fetch(DEMO_URL)
        .then(function (r) {
            if (!r.ok) { throw new Error('HTTP ' + r.status); }
            return r.json();
        })
        .then(function (json) {
            demo = json;
            renderHero();
            initDemo();
        })
        .catch(function () {
            var msg = '<p class="demo-empty">Демонстрационные данные недоступны.</p>';
            ['heroChart', 'demoChart'].forEach(function (id) {
                var slot = document.getElementById(id);
                if (slot) { slot.innerHTML = msg; }
            });
        });
})();
