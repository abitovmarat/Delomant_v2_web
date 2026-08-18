document.addEventListener('DOMContentLoaded', function () {

    /* ================================
       Роль сессии (экспертный режим)
       ================================
       Роль приходит из серверной сессии через <meta name="app-role">,
       которую index.php подставляет при отдаче приложения. В режиме
       'expert' (доступ для проверяющих реестра) скрывается загрузка
       пользовательских выгрузок — стенд демонстрирует функциональность
       на безопасных источниках (UN Comtrade, WITS, зарубежная таможня),
       не выступая хранилищем чужих таможенных деклараций. */
    var roleMeta = document.querySelector('meta[name="app-role"]');
    var appRole = roleMeta ? roleMeta.getAttribute('content') : 'full';
    // Плейсхолдер (прямое открытие файла в dev) трактуем как полный доступ.
    if (appRole === '__ROLE__' || !appRole) { appRole = 'full'; }
    var isExpert = (appRole === 'expert');
    document.body.setAttribute('data-role', appRole);

    if (isExpert) {
        // Явная метка режима: без неё непонятно, почему разделы закрыты,
        // и невозможно на глаз отличить демо-доступ от полного.
        var modeBadge = document.querySelector('.header-mode');
        if (modeBadge) { modeBadge.hidden = false; }

        /*
         * Закрытые возможности не прячем, а помечаем замком: пользователь
         * должен видеть, что раздел существует (иначе система выглядит
         * беднее, чем есть), но не может им воспользоваться.
         *
         * Иконка — контурный SVG на currentColor, а не эмодзи: цветной
         * глиф не подчиняется теме и на тёмном фоне бокового меню выбивался.
         */
        var lockSvg = '<svg class="lock-ico" viewBox="0 0 24 24" fill="none" ' +
            'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
            'stroke-linejoin="round" aria-hidden="true">' +
            '<rect x="4" y="10.5" width="16" height="10.5" rx="2.2"/>' +
            '<path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>';
        /*
         * Контрагентские разрезы (получатели/отправители/изготовители)
         * убираем совсем, а не помечаем замком: эти данные в доступных
         * здесь источниках отсутствуют физически, поэтому карточка с
         * замком выглядела бы обещанием, которого стенд всё равно не
         * выполнит. Раздел «Обработка» — другое дело: там замок уместен,
         * функция существует и работает на полном доступе.
         */
        ['topReceivers', 'topSenders', 'topManufacturers'].forEach(function (type) {
            var card = document.querySelector('.action-card[data-analysis="' + type + '"]');
            if (card) { card.style.display = 'none'; }
        });

        // Раздел «Обработка»: пункт меню остаётся, содержимое подменяем
        // витриной — что этот раздел делает и почему сейчас закрыт.
        var processingNav = document.querySelector('.sidebar-nav-item[href="#processing"] .sidebar-nav-text');
        if (processingNav) { processingNav.insertAdjacentHTML('beforeend', ' <span class="lock-badge lock-badge-icon" title="Недоступно в демонстрационном режиме">' + lockSvg + '</span>'); }

        var processingModule = document.getElementById('processing');
        if (processingModule) {
            processingModule.innerHTML =
                '<h2 class="module-title">Обработка данных <span class="lock-badge">' + lockSvg + 'другой тариф</span></h2>' +
                '<div class="locked-module">' +
                    '<p class="locked-lead">Раздел принимает вашу таможенную выгрузку в Excel или CSV ' +
                    'и приводит её к виду, пригодному для анализа. В демонстрационном режиме он закрыт.</p>' +
                    '<ul class="locked-list">' +
                        '<li>Загрузка своей выгрузки (CSV, XLS, XLSX), несколько файлов подряд</li>' +
                        '<li>Сопоставление столбцов выгрузки со справочником полей</li>' +
                        '<li>Извлечение года, квартала и месяца из даты выпуска</li>' +
                        '<li>Пересчёт стоимости в рубли по курсу ЦБ на дату</li>' +
                        '<li>Очистка наименований и приведение единиц измерения</li>' +
                        '<li>Выгрузка обработанного массива в Excel или CSV</li>' +
                    '</ul>' +
                    '<p class="locked-note">Источники, доступные в этом режиме (UN Comtrade, ' +
                    'World Bank WITS, зарубежная таможня), приходят уже подготовленными. ' +
                    'Обработка им не нужна, анализ работает сразу.</p>' +
                '</div>';
        }
    }

    // Идентификация в шапке. Логин индивидуального аккаунта приходит из
    // <meta name="app-user"> (подставляет index.php). Клик по логину ведёт
    // на «/» — для роли expert это возврат в личный кабинет с инструкцией.
    var appUserMeta = document.querySelector('meta[name="app-user"]');
    var appUser = appUserMeta ? appUserMeta.getAttribute('content') : '';
    if (appUser === '__USER__' || !appUser) { appUser = ''; }

    var headerActions = document.querySelector('.header-actions');
    var loginLink = document.querySelector('.header-login-link');
    var adminLink = document.querySelector('.header-admin-link');
    var showHeaderActions = false;

    if (appUser && loginLink) {
        loginLink.textContent = '← ' + appUser;
        loginLink.hidden = false;
        showHeaderActions = true;
    }
    if (!isExpert && adminLink) {
        // Владелец управляет пользователями; обычному пользователю не показываем.
        adminLink.hidden = false;
        showHeaderActions = true;
    }
    if (headerActions && showHeaderActions) { headerActions.hidden = false; }

    // Интерфейс отрисован и роль применена — убираем стартовую заставку.
    // Небольшая минимальная задержка, чтобы уход был плавным, а не мгновенным.
    var appSplash = document.getElementById('app-splash');
    if (appSplash) {
        setTimeout(function () {
            appSplash.classList.add('hide');
            setTimeout(function () {
                if (appSplash.parentNode) { appSplash.parentNode.removeChild(appSplash); }
            }, 400);
        }, 300);
    }

    /* ================================
       App State
       ================================ */
    var appState = {
        rawData: [],
        headers: [],
        fileName: '',
        processedData: [],
        processedHeaders: [],
        isProcessed: false,
        // 'file' — выгрузка пользователя, 'comtrade' — статистика ООН.
        // От источника зависит, какие анализы вообще выполнимы.
        dataSource: 'file'
    };

    /*
     * Агрегированная статистика ООН не содержит отправителей, получателей
     * и изготовителей. Анализы, которым нужен контрагентский уровень,
     * на таком источнике объясняют причину вместо пустого графика.
     */
    function isContractorDataAvailable() {
        // UN Comtrade и World Bank WITS — агрегаты по кодам ТН ВЭД, без контрагентов
        return appState.dataSource !== 'comtrade' && appState.dataSource !== 'wits';
    }

    /*
     * Подпись об источнике для материалов, которые уходят наружу.
     * Отчёт по зеркальной статистике ООН обязан называть источник — по
     * своей выгрузке пользователь и так знает, откуда данные.
     */
    function dataSourceNote() {
        if (appState.dataSource === 'comtrade') {
            // «Зеркальной» статистика будет только когда партнёр — конкретная
            // страна: там мы смотрим её торговлю глазами контрагента. С
            // партнёром «весь мир» это прямая отчётность самих стран.
            return appState.sourceNote ||
                'Источник: UN Comtrade, зеркальная статистика стран-партнёров';
        }
        if (appState.dataSource === 'wits') {
            return appState.sourceNote || 'Источник: World Bank WITS, мировая торговая статистика';
        }
        // Зарубежная таможня: журнал источника кладёт сюда сам модуль —
        // такие данные тоже обязаны называть происхождение в материалах наружу
        if (appState.dataSource === 'foreign') {
            return appState.sourceNote || 'Источник: зарубежная таможенная статистика';
        }
        return '';
    }

    /*
     * Имя источника и уровень его агрегации. Нужны везде, где мы объясняем
     * пользователю, почему разрез недоступен: писать «UN Comtrade» на
     * данных Всемирного банка — вводить в заблуждение, а уровень у них
     * разный (Comtrade — коды HS6, WITS — крупные товарные разделы).
     */
    function dataSourceName() {
        if (appState.dataSource === 'wits') { return 'World Bank WITS'; }
        if (appState.dataSource === 'foreign') { return 'зарубежной таможенной статистики'; }
        return 'UN Comtrade';
    }

    function dataSourceLevel() {
        return appState.dataSource === 'wits'
            ? 'по крупным товарным разделам ТН ВЭД'
            : 'по кодам ТН ВЭД';
    }

    /* ================================
       Справочник названий ТН ВЭД (общий кэш)
       ================================
       Один и тот же файл нужен и поиску кода по названию, и подписям в
       анализах: голый код «081110» ничего не говорит, а «Земляника и
       клубника мороженая» — говорит. Грузим один раз и лениво: файл
       большой, а нужен не в каждом сеансе. */
    var hsNamesData = null;    // {hs6:{code:name}, hs4:{code:name}}
    var hsNamesPromise = null;

    function loadHsNames() {
        if (hsNamesPromise) { return hsNamesPromise; }
        hsNamesPromise = fetch('data/foreign/hs_names_ru.json', { cache: 'force-cache' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) {
                hsNamesData = (d && (d.hs6 || d.hs4)) ? d : { hs6: {}, hs4: {} };
                return hsNamesData;
            })
            .catch(function () {
                hsNamesData = { hs6: {}, hs4: {} };
                return hsNamesData;
            });
        return hsNamesPromise;
    }

    /** Название товара по коду; пусто, если справочник не загружен или кода нет. */
    function hsNameFor(code) {
        if (!hsNamesData) { return ''; }
        var c = String(code == null ? '' : code).replace(/\D/g, '');
        if (!c) { return ''; }
        return (hsNamesData.hs6 && hsNamesData.hs6[c]) ||
               (hsNamesData.hs4 && (hsNamesData.hs4[c] || hsNamesData.hs4[c.slice(0, 4)])) || '';
    }

    function renderContractorUnavailable() {
        return '<div class="analysis-unavailable">' +
            '<p>Анализ недоступен на данных ' + dataSourceName() + ': статистика агрегирована ' +
            dataSourceLevel() + ' и не содержит отправителей, получателей и изготовителей.</p>' +
            '<p>Для этого разреза нужна выгрузка с контрагентским уровнем данных.</p>' +
            '</div>';
    }

    function getActiveData() {
        return appState.isProcessed ? appState.processedData : appState.rawData;
    }

    function getActiveHeaders() {
        return appState.isProcessed && appState.processedHeaders.length > 0
            ? appState.processedHeaders : appState.headers;
    }

    /* ================================
       Constants
       ================================ */
    var COL_WEIGHT = 'Вес нетто, кг';
    var COL_STAT_USD = 'Статистическая стоимость, USD';
    var COL_INVOICE = 'Фактурная стоимость';
    var COL_INVOICE_RUB = 'Фактурная стоимость (нац. вал.)';
    var COL_CUSTOMS = 'Таможенная стоимость';
    var COL_INN = 'ИНН получателя';
    var COL_HS_CODE = 'Код товара по ТН ВЭД';
    var COL_DATE_REG = 'Дата регистрации';
    var COL_DATE_RELEASE = 'Дата выпуска';
    var COL_YEAR = 'Год';
    var COL_MONTH = 'Месяц';
    var COL_QUARTER = 'КВАРТАЛ';
    var COL_PRODUCT_NAME = 'Наименование и характеристики товаров';
    var COL_MANUFACTURER = 'Фирма-изготовитель';
    var COL_SENDER = 'Наименование отправителя';
    var COL_RECEIVER = 'Наименование получателя';
    var COL_DIRECTION = 'Направление перемещения';
    var BRIEF_PROCESSING_COLUMNS = [
        [COL_DATE_REG],
        [COL_SENDER],
        ['Адрес отправителя'],
        [COL_INN],
        [COL_RECEIVER],
        ['Адрес получателя'],
        ['Наименование контрактодержателя'],
        ['Страна отправления'],
        [COL_PRODUCT_NAME],
        [COL_MANUFACTURER],
        [COL_HS_CODE],
        ['Условие поставки'],
        ['Пункт поставки товара'],
        [COL_WEIGHT],
        [COL_INVOICE_RUB],
        [COL_STAT_USD],
        [COL_CUSTOMS],
        ['Таможенная стоимость USD за КГ', 'USD за КГ', 'USD за КГ таможенная', 'USD за КГ статистическая']
    ];

    var UTF8_BOM = '\uFEFF';
    var CSV_SEPARATOR = ';';
    var KEY_SEPARATOR = '|||';
    var HS_CODE_LENGTH = 10;
    var EXCEL_EPOCH_OFFSET = 25569;
    var MS_PER_DAY = 86400000;
    var COLUMNS_COLLAPSE_HEIGHT = 300;
    var TREND_THRESHOLD = 0.001;

    var CHART_COLORS = {
        primary: '#2563EB',
        text: '#0F172A',
        textMuted: '#64748B',
        grid: '#E2E8F0',
        bg: '#FFFFFF'
    };
    var CHART_FONT = 'DejaVu Sans, sans-serif';
    var MIME_CSV = 'text/csv;charset=utf-8';

    var CBR_RATES_URL = 'data/cbr_rates.json';
    var CBR_API_BASE = 'https://www.cbr-xml-daily.ru';
    var COL_CURRENCY_CODE = 'Код валюты';
    var COL_CBR_RATE = 'Курс ЦБ РФ';
    var COL_INVOICE_RUB_CBR = 'Таможенная стоимость (нац. вал., ЦБ)';

    var LS_CBR_KEY = 'delomant_cbr_rates';
    var rateCache = null; // Загружается один раз из JSON-файла или localStorage

    function round2(n) { return Math.round(n * 100) / 100; }

    function baseFileName() {
        return appState.fileName.replace(/\.[^.]+$/, '');
    }

    function isDateColumn(name) {
        var h = name.toLowerCase();
        return h.indexOf('date') !== -1 || h.indexOf('дата') !== -1 ||
               h.indexOf('time') !== -1 || h.indexOf('период') !== -1;
    }

    /* ================================
       Navigation
       ================================ */
    var navItems = document.querySelectorAll('.sidebar-nav-item');
    var modules = document.querySelectorAll('.module');

    navItems.forEach(function (item) {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            var targetId = this.getAttribute('href').substring(1);

            navItems.forEach(function (nav) { nav.classList.remove('active'); nav.removeAttribute('aria-current'); });
            this.classList.add('active');
            this.setAttribute('aria-current', 'page');

            modules.forEach(function (mod) { mod.classList.remove('active'); });
            var target = document.getElementById(targetId);
            if (target) { target.classList.add('active'); }
        });
    });

    /* ================================
       Helpers
       ================================ */
    function parseCSV(text) {
        var lines = text.trim().split('\n');
        if (lines.length < 2) { return { headers: [], rows: [] }; }

        var headers = parseCSVLine(lines[0]);
        var rows = [];
        for (var i = 1; i < lines.length; i++) {
            var values = parseCSVLine(lines[i]);
            if (values.length === headers.length) {
                var row = {};
                for (var j = 0; j < headers.length; j++) {
                    row[headers[j]] = values[j];
                }
                rows.push(row);
            }
        }
        return { headers: headers, rows: rows };
    }

    function parseCSVLine(line) {
        var result = [];
        var current = '';
        var inQuotes = false;

        for (var i = 0; i < line.length; i++) {
            var ch = line[i];
            if (inQuotes) {
                if (ch === '"' && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else if (ch === '"') {
                    inQuotes = false;
                } else {
                    current += ch;
                }
            } else {
                if (ch === '"') {
                    inQuotes = true;
                } else if (ch === ',' || ch === ';') {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += ch;
                }
            }
        }
        result.push(current.trim());
        return result;
    }

    function formatNumber(n) {
        if (isNaN(n)) { return n; }
        return Number(n).toLocaleString('ru-RU');
    }

    /* ================================
       Module: Data (Upload)
       ================================ */
    var uploadInput = document.querySelector('.upload-input');
    var uploadArea = document.querySelector('.upload-area');
    var uploadTitle = document.querySelector('.upload-title');
    var uploadDesc = document.querySelector('.upload-description');
    /*
     * Карточка загруженного файла живёт в двух местах: в «Данных» (там её
     * рисуют внешние источники) и в «Обработке» (там загружают свой файл).
     * Пишем сразу в оба контейнера, чтобы статус был виден в том разделе,
     * где пользователь сейчас находится.
     */
    var fileListNodes = document.querySelectorAll('.file-list');
    var fileList = {
        set innerHTML(html) {
            Array.prototype.forEach.call(fileListNodes, function (node) {
                node.innerHTML = html;
            });
        },
        get innerHTML() {
            return fileListNodes.length ? fileListNodes[0].innerHTML : '';
        }
    };

    if (uploadArea) {
        uploadArea.addEventListener('dragover', function (e) {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        uploadArea.addEventListener('dragleave', function () {
            uploadArea.classList.remove('drag-over');
        });
        uploadArea.addEventListener('drop', function (e) {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                handleFile(e.dataTransfer.files[0]);
            }
        });
    }

    if (uploadInput) {
        uploadInput.addEventListener('change', function () {
            if (this.files.length > 0) {
                handleFile(this.files[0]);
            }
        });
    }

    // --- Добавление файла (append) ---
    var appendRow = document.querySelector('.upload-append-row');
    var appendBtn = document.querySelector('.upload-append-btn');
    var appendInput = document.querySelector('.upload-append-input');

    if (appendBtn && appendInput) {
        appendBtn.addEventListener('click', function () { appendInput.click(); });
        appendInput.addEventListener('change', function () {
            if (this.files.length > 0) { appendFile(this.files[0]); this.value = ''; }
        });
    }

    function appendFile(file) {
        if (isExpert) { return; }
        if (!appState.rawData || appState.rawData.length === 0) {
            handleFile(file);
            return;
        }
        var ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
            alert('Поддерживаются только CSV, XLS, XLSX');
            return;
        }
        showLoading(file.name);
        var done = function(parsed) {
            hideLoading();
            if (!parsed || parsed.rows.length === 0) {
                alert('Файл пуст или имеет неверный формат');
                return;
            }
            // Проверяем совместимость заголовков
            var existingHeaders = appState.headers;
            var newHeaders = parsed.headers;
            var missing = existingHeaders.filter(function(h) { return newHeaders.indexOf(h) === -1; });
            var extra = newHeaders.filter(function(h) { return existingHeaders.indexOf(h) === -1; });
            var warn = '';
            if (missing.length > 0) warn += 'Отсутствуют столбцы: ' + missing.slice(0, 5).join(', ') + (missing.length > 5 ? '...' : '') + '\n';
            if (extra.length > 0) warn += 'Новые столбцы (будут добавлены): ' + extra.slice(0, 5).join(', ') + (extra.length > 5 ? '...' : '') + '\n';
            if (warn && !confirm('Структура файлов отличается:\n' + warn + '\nПродолжить?')) return;

            // Объединяем: добавляем новые заголовки
            extra.forEach(function(h) { existingHeaders.push(h); });
            // Нормализуем новые строки (заполняем пустые значения для отсутствующих столбцов)
            parsed.rows.forEach(function(row) {
                existingHeaders.forEach(function(h) { if (!(h in row)) row[h] = ''; });
            });
            // Нормализуем старые строки (заполняем новые столбцы)
            if (extra.length > 0) {
                appState.rawData.forEach(function(row) {
                    extra.forEach(function(h) { if (!(h in row)) row[h] = ''; });
                });
            }

            appState.rawData = appState.rawData.concat(parsed.rows);
            appState.fileName = appState.fileName + ' + ' + file.name;
            appState.processedData = [];
            appState.isProcessed = false;

            renderFileCardAppend();
            updateProcessingState();
            renderColumnsList();
            updateRatioSelects();
            updateCustomMappingSelects();
            updateVisualizationFields();
        };

        if (ext === 'csv') {
            var reader = new FileReader();
            reader.onload = function(e) { done(parseCSV(e.target.result)); };
            reader.onerror = function() { hideLoading(); alert('Не удалось прочитать файл'); };
            reader.readAsText(file, 'UTF-8');
        } else {
            var reader = new FileReader();
            reader.onload = function(e) {
                try {
                    var wb = XLSX.read(e.target.result, { type: 'array' });
                    var sheet = wb.Sheets[wb.SheetNames[0]];
                    var json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                    done(json.length > 0 ? { headers: Object.keys(json[0]), rows: json } : null);
                } catch(err) { hideLoading(); alert('Ошибка чтения файла: ' + err.message); }
            };
            reader.onerror = function() { hideLoading(); alert('Не удалось прочитать файл'); };
            reader.readAsArrayBuffer(file);
        }
    }

    function renderFileCardAppend() {
        var dateRange = detectDateRange(appState.rawData, appState.headers);
        fileList.innerHTML =
            '<div class="file-card file-card-success">' +
            '  <span class="file-card-icon">✅</span>' +
            '  <div class="file-card-body">' +
            '    <h4 class="file-card-name">' + appState.fileName + '</h4>' +
            '    <p class="file-card-meta">' +
            '      Строк: ' + formatNumber(appState.rawData.length) +
            '  &nbsp;|&nbsp; Столбцов: ' + appState.headers.length +
            (dateRange ? '  &nbsp;|&nbsp; Период: ' + dateRange : '') +
            '    </p>' +
            '  </div>' +
            '  <span class="file-card-status">Объединено</span>' +
            '</div>';
        // Карточки загрузки может не быть: в демонстрационном режиме раздел
        // «Обработка» вместе с ней заменён витриной
        if (uploadTitle) { uploadTitle.textContent = appState.fileName; }
        if (uploadDesc) { uploadDesc.textContent = formatNumber(appState.rawData.length) + ' строк загружено'; }
    }

    function showLoading(fileName) {
        if (uploadArea) { uploadArea.classList.add('loading'); }
        if (uploadTitle) { uploadTitle.textContent = fileName; }
        if (uploadDesc) { uploadDesc.textContent = 'Загрузка...'; }

        fileList.innerHTML =
            '<div class="file-card file-card-loading">' +
            '  <span class="file-card-icon"><span class="spinner"></span></span>' +
            '  <div class="file-card-body">' +
            '    <h4 class="file-card-name">' + fileName + '</h4>' +
            '    <p class="file-card-meta">Чтение и обработка файла...</p>' +
            '  </div>' +
            '</div>';
    }

    function hideLoading() {
        if (uploadArea) { uploadArea.classList.remove('loading'); }
    }

    function handleFile(file) {
        // Экспертный режим: загрузка пользовательских выгрузок отключена
        // (защита от обхода скрытого UI через консоль).
        if (isExpert) { return; }
        var ext = file.name.split('.').pop().toLowerCase();

        if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
            showFileError('Поддерживаются только CSV, XLS, XLSX');
            return;
        }

        showLoading(file.name);

        if (ext === 'csv') {
            var reader = new FileReader();
            reader.onload = function (e) {
                var parsed = parseCSV(e.target.result);
                hideLoading();
                if (parsed.rows.length === 0) {
                    showFileError('Файл пуст или имеет неверный формат');
                    return;
                }
                applyParsedData(file, parsed);
            };
            reader.onerror = function () {
                hideLoading();
                showFileError('Не удалось прочитать файл');
            };
            reader.readAsText(file, 'UTF-8');
        } else {
            var reader = new FileReader();
            reader.onload = function (e) {
                try {
                    var workbook = XLSX.read(e.target.result, { type: 'array' });
                    hideLoading();

                    if (workbook.SheetNames.length > 1) {
                        showSheetModal(workbook, file);
                    } else {
                        loadSheetFromWorkbook(workbook, workbook.SheetNames[0], file);
                    }
                } catch (err) {
                    hideLoading();
                    showFileError('Ошибка чтения файла: ' + err.message);
                }
            };
            reader.onerror = function () {
                hideLoading();
                showFileError('Не удалось прочитать файл');
            };
            reader.readAsArrayBuffer(file);
        }
    }

    function loadSheetFromWorkbook(workbook, sheetName, file) {
        var sheet = workbook.Sheets[sheetName];
        var json = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (json.length === 0) {
            showFileError('Лист "' + sheetName + '" пуст');
            return;
        }

        var headers = Object.keys(json[0]);
        applyParsedData(file, { headers: headers, rows: json });
    }

    // --- Sheet selection modal ---
    var sheetModalOverlay = document.querySelector('.sheet-modal-overlay');
    var sheetSelect = document.querySelector('.sheet-select');
    var sheetConfirmBtn = document.querySelector('.sheet-confirm-btn');
    var sheetCancelBtn = document.querySelector('.sheet-cancel-btn');
    var pendingWorkbook = null;
    var pendingFile = null;
    var pendingLookupMode = false;

    function showSheetModal(workbook, file) {
        pendingWorkbook = workbook;
        pendingFile = file;

        var html = '';
        workbook.SheetNames.forEach(function (name) {
            html += '<option value="' + name + '">' + name + '</option>';
        });
        sheetSelect.innerHTML = html;
        sheetModalOverlay.style.display = '';
    }

    if (sheetConfirmBtn) {
        sheetConfirmBtn.addEventListener('click', function () {
            var name = sheetSelect.value;
            sheetModalOverlay.style.display = 'none';
            if (pendingWorkbook && name) {
                if (pendingLookupMode) {
                    var sheet = pendingWorkbook.Sheets[name];
                    var json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                    applyLookupData({ headers: json.length > 0 ? Object.keys(json[0]) : [], rows: json }, pendingFile.name);
                } else {
                    loadSheetFromWorkbook(pendingWorkbook, name, pendingFile);
                }
            }
            pendingWorkbook = null;
            pendingFile = null;
            pendingLookupMode = false;
        });
    }

    if (sheetCancelBtn) {
        sheetCancelBtn.addEventListener('click', function () {
            sheetModalOverlay.style.display = 'none';
            pendingWorkbook = null;
            pendingFile = null;
            pendingLookupMode = false;
        });
    }

    /*
     * Единственная точка, через которую внешние модули (сейчас — «Зарубежная
     * таможня») отдают приложению готовую таблицу. Не расширять произвольно:
     * это узкий контракт, а не публичный API всего main.js.
     */
    window.DelomantData = {
        apply: function (label, parsed, source, note) {
            applyParsedData({ name: label }, parsed, source || 'file');
            appState.sourceNote = note || '';
        },
        hasData: function () { return getActiveData().length > 0; }
    };

    function applyParsedData(file, parsed, source) {
        appState.rawData = parsed.rows;
        appState.headers = parsed.headers;
        appState.fileName = file.name;
        appState.processedData = [];
        appState.isProcessed = false;
        appState.dataSource = source || 'file';
        appState.sourceNote = '';   // задаётся после вызова, если источник его несёт

        console.log('[Delomant] Данные загружены:', parsed.rows.length, 'строк,', parsed.headers.length, 'столбцов');

        renderFileCard(file, parsed);
        updateProcessingState();
        renderColumnsList();
        updateRatioSelects();
        // Набор доступных обогащений зависит от источника и столбцов,
        // а ставки относятся к прежним странам и кодам — сбрасываем
        tariffCache = null;
        renderEnrichList();
        updateCustomMappingSelects();
        updateVisualizationFields();
    }

    function showFileError(message) {
        fileList.innerHTML =
            '<div class="file-card file-card-error">' +
            '  <span class="file-card-icon">⚠️</span>' +
            '  <div class="file-card-body">' +
            '    <h4 class="file-card-name">Ошибка</h4>' +
            '    <p class="file-card-meta">' + message + '</p>' +
            '  </div>' +
            '</div>';
    }

    function renderFileCard(file, parsed) {
        var dateRange = detectDateRange(parsed.rows, parsed.headers);

        fileList.innerHTML =
            '<div class="file-card file-card-success">' +
            '  <span class="file-card-icon">✅</span>' +
            '  <div class="file-card-body">' +
            '    <h4 class="file-card-name">' + file.name + '</h4>' +
            '    <p class="file-card-meta">' +
            '      Строк: ' + formatNumber(parsed.rows.length) +
            '  &nbsp;|&nbsp; Столбцов: ' + parsed.headers.length +
            (dateRange ? '  &nbsp;|&nbsp; Период: ' + dateRange : '') +
            '    </p>' +
            '  </div>' +
            '  <span class="file-card-status">Загружен</span>' +
            '</div>';

        if (uploadTitle) { uploadTitle.textContent = file.name; }
        if (uploadDesc) { uploadDesc.textContent = formatNumber(parsed.rows.length) + ' строк загружено'; }
        if (appendRow) appendRow.style.display = '';
    }

    function detectDateRange(rows, headers) {
        var dateCol = null;
        for (var i = 0; i < headers.length; i++) {
            if (isDateColumn(headers[i])) {
                dateCol = headers[i];
                break;
            }
        }
        if (!dateCol) { return ''; }

        var dates = [];
        rows.forEach(function (row) {
            var d = new Date(row[dateCol]);
            if (!isNaN(d.getTime())) { dates.push(d); }
        });
        if (dates.length === 0) { return ''; }

        dates.sort(function (a, b) { return a - b; });
        var fmt = function (d) {
            return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
        };
        return fmt(dates[0]) + ' — ' + fmt(dates[dates.length - 1]);
    }

    /* ================================
       Module: Data — UN Comtrade
       ================================ */

    /*
     * Загрузка зеркальной статистики ООН как альтернатива файловой выгрузке.
     *
     * Пользователь мыслит категорией «импорт России из Китая», а в Comtrade
     * это экспорт Китая в Россию: страна-партнёр выступает репортёром, а РФ —
     * партнёром. Инверсию делает адаптер, наружу она не торчит.
     *
     * Данные приходят агрегированными по кодам HS6, поэтому отправителей,
     * получателей и изготовителей в них нет — часть анализа на таком
     * источнике недоступна, см. isContractorDataAvailable().
     */

    var COMTRADE_PROXY_URL = 'comtrade.php';
    var COMTRADE_COUNTRIES_URL = 'data/comtrade_countries.json';
    var COMTRADE_REGIONS_URL = 'data/comtrade_regions.json';
    // Версия ключа меняется при изменении формата справочника. Это не даёт
    // старой записи localStorage подставить в <option> пустой/текстовый код.
    var LS_COMTRADE_COUNTRIES_KEY = 'delomant_comtrade_countries_v3';
    var COMTRADE_RF_CODE = 643;
    // Comtrade: partnerCode=0 — агрегат «World», торговля со всеми странами
    var COMTRADE_WORLD_CODE = 0;

    // Должны совпадать с проверками в comtrade.php.
    // Периоды по одному — публичный preview отвечает «Maximum number of
    // periods for preview is 1». Страны и коды спокойно принимаются пачкой,
    // проверено на 40 странах в одном запросе.
    var COMTRADE_MAX_REPORTERS = 40;
    var COMTRADE_MAX_PERIODS = 1;
    var COMTRADE_MAX_CODES = 40;

    var COMTRADE_RETRY_DELAY = 4000; // пауза перед повтором после 429
    var COMTRADE_MAX_RETRIES = 3;

    var comtradeCard = document.querySelector('.comtrade-card');
    var comtradeForm = document.querySelector('.comtrade-form');
    var comtradeToggle = document.querySelector('.comtrade-toggle');
    var comtradeCountriesBox = document.querySelector('.comtrade-countries');
    var comtradeRegionsBox = document.querySelector('.comtrade-regions');
    var comtradePartnerSelect = document.querySelector('.comtrade-partner');
    var comtradeCountrySearch = document.querySelector('.comtrade-country-search');
    var comtradeSelectedHint = document.querySelector('.comtrade-selected-hint');
    var comtradeStatus = document.querySelector('.comtrade-status');
    var comtradeLoadBtn = document.querySelector('.comtrade-load-btn');
    var comtradeOriginalBtn = document.querySelector('.comtrade-original-btn');
    var comtradePresentationBtn = document.querySelector('.comtrade-presentation-btn');
    var comtradeReportBtn = document.querySelector('.comtrade-report-btn');

    var comtradeCountries = [];
    var comtradeRegions = [];
    var comtradeSelected = {}; // код страны → true
    // Сырой ответ API — строки как пришли, до схлопывания в comtradeToRows.
    // Храним, чтобы пользователь мог скачать оригинал выгрузки.
    var comtradeRawRows = [];
    // Понятная версия для презентаций: {headers, rows} с ценой и объёмом.
    var comtradePresentation = null;

    function normalizeComtradeCountries(value) {
        if (!Array.isArray(value)) { return []; }
        return value.filter(function (country) {
            return country && /^\d{1,4}$/.test(String(country.code).trim()) &&
                String(country.name || '').trim() !== '';
        });
    }

    function loadComtradeCountries() {
        if (comtradeCountries.length > 0) { return Promise.resolve(comtradeCountries); }

        try {
            var cached = localStorage.getItem(LS_COMTRADE_COUNTRIES_KEY);
            if (cached) {
                comtradeCountries = normalizeComtradeCountries(JSON.parse(cached));
                if (comtradeCountries.length > 0) { return Promise.resolve(comtradeCountries); }
            }
        } catch (e) { /* ignore */ }

        return fetch(COMTRADE_COUNTRIES_URL)
            .then(function (resp) {
                if (!resp.ok) { throw new Error(resp.status); }
                return resp.json();
            })
            .then(function (json) {
                comtradeCountries = normalizeComtradeCountries(json);
                if (comtradeCountries.length === 0) {
                    throw new Error('Справочник стран Comtrade пуст или повреждён');
                }
                try { localStorage.setItem(LS_COMTRADE_COUNTRIES_KEY, JSON.stringify(comtradeCountries)); } catch (e) { /* ignore */ }
                return comtradeCountries;
            })
            .catch(function () {
                comtradeCountries = [];
                return comtradeCountries;
            });
    }

    /*
     * Регион — это не код Comtrade, а именованный набор стран.
     *
     * Групповые записи API (isGroup) существуют только как партнёр, а у нас
     * партнёр всегда РФ, поэтому «Европу» одним reporter-кодом не запросить.
     * Кнопка региона просто отмечает входящие в него страны — дальше всё
     * идёт обычным путём, включая разбивку на пачки по COMTRADE_MAX_REPORTERS.
     */
    function loadComtradeRegions() {
        if (comtradeRegions.length > 0) { return Promise.resolve(comtradeRegions); }

        return fetch(COMTRADE_REGIONS_URL)
            .then(function (resp) { return resp.ok ? resp.json() : []; })
            .then(function (json) {
                comtradeRegions = Array.isArray(json) ? json : [];
                return comtradeRegions;
            })
            .catch(function () {
                // Без регионов форма остаётся рабочей — страны выбираются вручную
                comtradeRegions = [];
                return comtradeRegions;
            });
    }

    /** Коды региона, оставляя только те, что есть в справочнике стран. */
    function comtradeRegionCodes(region) {
        var known = {};
        comtradeCountries.forEach(function (c) { known[c.code] = true; });
        return region.codes.filter(function (code) { return known[code]; });
    }

    /** Регион отмечен полностью, частично или совсем не отмечен. */
    function comtradeRegionState(region) {
        var codes = comtradeRegionCodes(region);
        if (codes.length === 0) { return 'none'; }

        var picked = codes.filter(function (code) { return comtradeSelected[code]; }).length;
        if (picked === 0) { return 'none'; }
        return picked === codes.length ? 'all' : 'some';
    }

    /*
     * Селект партнёра: «Всем миром» + все страны справочника.
     *
     * В разметке заранее лежат только Россия и мир, чтобы форма была осмысленной
     * до загрузки справочника; остальные страны досыпаем сюда.
     */
    function fillComtradePartners() {
        if (!comtradePartnerSelect || comtradeCountries.length === 0) { return; }

        var current = comtradePartnerSelect.value;
        var html = '<option value="' + COMTRADE_WORLD_CODE + '">Всем миром</option>';

        comtradeCountries.forEach(function (c) {
            html += '<option value="' + c.code + '">' + c.name + '</option>';
        });

        comtradePartnerSelect.innerHTML = html;
        comtradePartnerSelect.value = /^\d{1,4}$/.test(String(current).trim())
            ? String(current).trim()
            : String(COMTRADE_RF_CODE);
        // Выбранного кода могло не оказаться в обновлённом справочнике.
        if (comtradePartnerSelect.value === '') {
            comtradePartnerSelect.value = String(COMTRADE_RF_CODE);
        }
    }

    /** Читаемое имя партнёра для ярлыка и подписи источника. */
    function comtradePartnerName(code) {
        if (String(code) === String(COMTRADE_WORLD_CODE)) { return 'весь мир'; }

        var name = '';
        comtradeCountries.forEach(function (c) {
            if (String(c.code) === String(code)) { name = c.name; }
        });
        return name || ('код ' + code);
    }

    function renderComtradeRegions() {
        if (!comtradeRegionsBox) { return; }

        var html = '';
        var lastGroup = '';

        comtradeRegions.forEach(function (region) {
            if (region.group !== lastGroup) {
                html += '<span class="comtrade-region-group">' + region.group + '</span>';
                lastGroup = region.group;
            }
            var state = comtradeRegionState(region);
            html += '<button type="button" class="comtrade-region comtrade-region-' + state + '"' +
                ' data-region="' + region.id + '" aria-pressed="' + (state === 'all') + '">' +
                region.name +
                '</button>';
        });

        comtradeRegionsBox.innerHTML = html;
    }

    /*
     * Клик по региону: если он отмечен целиком — снимаем, иначе дожимаем до
     * полного. Частично отмеченный регион по клику доотмечается, а не
     * сбрасывается, — так кнопка не стирает страны, выбранные вручную.
     */
    function toggleComtradeRegion(regionId) {
        var region = null;
        comtradeRegions.forEach(function (r) { if (r.id === regionId) { region = r; } });
        if (!region) { return; }

        var codes = comtradeRegionCodes(region);
        var turnOff = comtradeRegionState(region) === 'all';

        codes.forEach(function (code) {
            if (turnOff) {
                delete comtradeSelected[code];
            } else {
                comtradeSelected[code] = true;
            }
        });
    }

    function renderComtradeCountries(filter) {
        if (!comtradeCountriesBox) { return; }

        var needle = (filter || '').trim().toLowerCase();
        var html = '';

        comtradeCountries.forEach(function (country) {
            if (needle && country.name.toLowerCase().indexOf(needle) === -1) { return; }
            html += '<label class="comtrade-country">' +
                '<input type="checkbox" value="' + country.code + '"' +
                (comtradeSelected[country.code] ? ' checked' : '') + '>' +
                '<span>' + country.name + '</span>' +
                '</label>';
        });

        comtradeCountriesBox.innerHTML = html || '<p class="comtrade-empty">Ничего не найдено</p>';
    }

    function updateComtradeSelectedHint() {
        if (!comtradeSelectedHint) { return; }

        var names = comtradeCountries
            .filter(function (c) { return comtradeSelected[c.code]; })
            .map(function (c) { return c.name; });

        if (names.length === 0) {
            comtradeSelectedHint.textContent = 'Не выбрано ни одной страны';
            return;
        }
        comtradeSelectedHint.textContent = 'Выбрано ' + names.length + ': ' +
            (names.length > 6 ? names.slice(0, 6).join(', ') + '…' : names.join(', '));
    }

    function setComtradeStatus(text, kind) {
        if (!comtradeStatus) { return; }
        comtradeStatus.textContent = text;
        comtradeStatus.className = 'comtrade-status' + (kind ? ' comtrade-status-' + kind : '');
    }

    /** Разрезает список на куски, которые прокси примет за один запрос. */
    function comtradeChunk(list, size) {
        var chunks = [];
        for (var i = 0; i < list.length; i += size) {
            chunks.push(list.slice(i, i + size));
        }
        return chunks;
    }

    function buildComtradePeriods(freq, yearFrom, yearTo) {
        var periods = [];
        for (var y = yearFrom; y <= yearTo; y++) {
            if (freq === 'A') {
                periods.push(String(y));
            } else {
                for (var m = 1; m <= 12; m++) {
                    periods.push(String(y) + (m < 10 ? '0' + m : String(m)));
                }
            }
        }
        return periods;
    }

    /** Собирает и проверяет параметры формы. Возвращает null и пишет ошибку в статус. */
    function collectComtradeParams() {
        var direction = document.querySelector('.comtrade-direction').value;
        var partner = comtradePartnerSelect
            ? String(comtradePartnerSelect.value || '').trim()
            : String(COMTRADE_RF_CODE);
        // Самовосстановление после пустого/устаревшего значения в браузере.
        // Россия — штатный партнёр по умолчанию и всегда есть в разметке.
        if (!/^\d{1,4}$/.test(partner)) {
            partner = String(COMTRADE_RF_CODE);
            if (comtradePartnerSelect) { comtradePartnerSelect.value = partner; }
        }
        var isWorld = String(partner) === String(COMTRADE_WORLD_CODE);
        var freq = document.querySelector('.comtrade-freq').value;
        var yearFrom = parseInt(document.querySelector('.comtrade-year-from').value, 10);
        var yearTo = parseInt(document.querySelector('.comtrade-year-to').value, 10);
        var codesRaw = document.querySelector('.comtrade-codes').value.trim();

        var reporters = Object.keys(comtradeSelected).filter(function (code) {
            return comtradeSelected[code];
        });

        /*
         * Страна не торгует сама с собой: если партнёр попал в список стран
         * (например, выбрали регион «Европа» при партнёре «Германия»),
         * Comtrade вернёт по ней пусто. Молча убираем — иначе выбор региона
         * с европейским партнёром выглядел бы как потеря данных.
         */
        if (!isWorld) {
            reporters = reporters.filter(function (code) {
                return String(code) !== String(partner);
            });
        }

        if (reporters.length === 0) {
            setComtradeStatus(
                'Выберите хотя бы одну страну, кроме той, с кем смотрим торговлю',
                'error'
            );
            return null;
        }
        if (isNaN(yearFrom) || isNaN(yearTo) || yearFrom > yearTo) {
            setComtradeStatus('Проверьте диапазон лет', 'error');
            return null;
        }

        var codes = ['TOTAL'];
        if (codesRaw !== '') {
            codes = codesRaw.split(',').map(function (c) { return c.trim(); }).filter(Boolean);
            for (var i = 0; i < codes.length; i++) {
                if (!/^\d{2,6}$/.test(codes[i])) {
                    setComtradeStatus('Код «' + codes[i] + '» не подходит: нужно от 2 до 6 цифр', 'error');
                    return null;
                }
            }
        }

        var periods = buildComtradePeriods(freq, yearFrom, yearTo);

        return {
            direction: direction,
            partner: partner,
            freq: freq,
            /*
             * Направление задаётся с точки зрения репортёра — страны из списка.
             *
             * При партнёре-стране это зеркальный взгляд: «импорт России из
             * Китая» мы берём как экспорт Китая (X), потому что репортёр —
             * Китай, а РФ стоит партнёром. Но с партнёром «весь мир» репортёр
             * и есть тот, кто покупает: «сколько Европа покупает» — это её
             * собственный импорт (M). Без этой развилки запрос вернул бы
             * ровно обратное — сколько она продаёт.
             */
            flow: isWorld
                ? (direction === 'import' ? 'M' : 'X')
                : (direction === 'import' ? 'X' : 'M'),
            reporters: reporters,
            periods: periods,
            codes: codes,
        };
    }

    /** Один запрос к прокси с повтором при 429 — публичный эндпоинт лимитирован. */
    function comtradeRequest(params, attempt) {
        attempt = attempt || 0;

        var url = COMTRADE_PROXY_URL +
            '?freq=' + encodeURIComponent(params.freq) +
            '&flow=' + encodeURIComponent(params.flow) +
            '&partner=' + encodeURIComponent(params.partner) +
            '&reporter=' + encodeURIComponent(params.reporters.join(',')) +
            '&period=' + encodeURIComponent(params.periods.join(',')) +
            '&cmd=' + encodeURIComponent(params.codes.join(','));

        return fetch(url, { cache: 'no-store' })
            .then(function (resp) {
                // Читаем текстом: если PHP не отработал, в теле будет HTML,
                // и разбор JSON выдал бы невнятную ошибку парсера
                return resp.text().then(function (text) {
                    var json;
                    try {
                        json = JSON.parse(text);
                    } catch (e) {
                        throw new Error('Прокси comtrade.php недоступен или вернул не JSON (код ' + resp.status + ')');
                    }

                    // Повторяем не только при лимите (429), но и при таймауте/
                    // недоступности апстрима (502/504) — публичный Comtrade без
                    // ключа медленный и «весь мир» иногда не успевает ответить.
                    if ((resp.status === 429 || resp.status === 502 || resp.status === 504)
                        && attempt < COMTRADE_MAX_RETRIES) {
                        return new Promise(function (resolve) {
                            setTimeout(resolve, COMTRADE_RETRY_DELAY);
                        }).then(function () {
                            return comtradeRequest(params, attempt + 1);
                        });
                    }
                    if (!resp.ok) {
                        throw new Error(json.error || ('Ошибка ' + resp.status));
                    }
                    return json.data || [];
                });
            });
    }

    /*
     * Как назвать колонку страны в выгрузке.
     *
     * При партнёре-стране (обычно РФ) в строке стоит контрагент: смотрим
     * «импорт России из Китая» — и Китай это страна отправления. Но при
     * партнёре «весь мир» второй стороны нет, она размазана по всем странам,
     * и репортёр — это сама страна, которая купила или продала. Называть её
     * «страной отправления» в таком режиме прямо неверно.
     *
     * Обе точки, которые читают выгрузку (таблица и презентация), берут имя
     * отсюда — иначе они разъедутся и презентация не найдёт колонку.
     */
    function comtradeCountryColumn(params) {
        var isImport = params.direction === 'import';

        if (String(params.partner) === String(COMTRADE_WORLD_CODE)) {
            return isImport ? 'Страна-импортёр' : 'Страна-экспортёр';
        }
        return isImport ? 'Страна отправления' : 'Страна назначения';
    }

    /*
     * Итоговая ли это строка по товарной позиции.
     *
     * Comtrade возвращает одну позицию несколькими строками: одна — итог
     * по всем видам транспорта и таможенным режимам, остальные — разрезы
     * внутри него. Складывать их нельзя, объём удвоится: у Вьетнама за
     * 2023 год по коду 030617 приходит итог 12,18 млн USD и ровно та же
     * сумма отдельной строкой с motCode 2100.
     */
    function isComtradeTotalRow(row) {
        return row.motCode === 0 &&
            row.partner2Code === 0 &&
            String(row.customsCode) === 'C00' &&
            String(row.mosCode) === '0';
    }

    /*
     * Приводит ответ API к строкам приложения: оставляет итоговые строки
     * и схлопывает их по «период + страна + код».
     */
    function comtradeToRows(apiRows, params) {
        var byCode = {};
        comtradeCountries.forEach(function (c) { byCode[c.code] = c.name; });

        var isImport = params.direction === 'import';
        var countryCol = comtradeCountryColumn(params);

        var headers = [
            COL_DATE_REG,
            COL_YEAR,
            COL_QUARTER,
            COL_DIRECTION,
            countryCol,
            COL_HS_CODE,
            COL_WEIGHT,
            COL_STAT_USD,
        ];
        if (params.freq === 'M') { headers.splice(3, 0, COL_MONTH); }

        /*
         * Итоговые строки и разрезы приходят вперемешку. Сначала смотрим,
         * по каким позициям итог вообще есть: если есть — разрезы по этой
         * позиции игнорируем, если нет — складываем разрезы, чтобы не
         * потерять данные совсем.
         */
        var hasTotal = {};
        apiRows.forEach(function (row) {
            if (isComtradeTotalRow(row)) {
                hasTotal[String(row.period) + '|' + row.reporterCode + '|' + row.cmdCode] = true;
            }
        });

        var merged = {};
        var order = [];

        apiRows.forEach(function (row) {
            var period = String(row.period || '');
            var key = period + '|' + row.reporterCode + '|' + row.cmdCode;

            if (hasTotal[key] && !isComtradeTotalRow(row)) { return; }

            if (!merged[key]) {
                merged[key] = {
                    period: period,
                    reporter: row.reporterCode,
                    cmd: String(row.cmdCode || ''),
                    weight: 0,
                    value: 0,
                    hasWeight: false,
                };
                order.push(key);
            }

            var acc = merged[key];
            if (row.netWgt != null && row.netWgt > 0) {
                acc.weight += row.netWgt;
                acc.hasWeight = true;
            }
            if (row.primaryValue != null) {
                acc.value += row.primaryValue;
            }
        });

        var rows = [];
        var withWeight = 0;

        order.forEach(function (key) {
            var acc = merged[key];
            var year = parseInt(acc.period.slice(0, 4), 10);
            var month = acc.period.length === 6 ? parseInt(acc.period.slice(4, 6), 10) : 1;

            var row = {};
            row[COL_DATE_REG] = year + '-' + (month < 10 ? '0' + month : month) + '-01';
            row[COL_YEAR] = year;
            row[COL_QUARTER] = getQuarter(month);
            if (params.freq === 'M') { row[COL_MONTH] = MONTH_NAMES[month - 1]; }
            row[COL_DIRECTION] = isImport ? 'ИМ' : 'ЭК';
            row[countryCol] = byCode[acc.reporter] || ('Код ' + acc.reporter);
            row[COL_HS_CODE] = acc.cmd;
            // Вес отчитывают не все страны: пустая ячейка честнее нуля,
            // иначе средняя цена USD/кг поедет вниз на пустых строках
            row[COL_WEIGHT] = acc.hasWeight ? Math.round(acc.weight) : '';
            row[COL_STAT_USD] = Math.round(acc.value * 100) / 100;

            if (acc.hasWeight) { withWeight++; }
            rows.push(row);
        });

        return {
            headers: headers,
            rows: rows,
            weightCoverage: rows.length > 0 ? Math.round(withWeight / rows.length * 100) : 0,
        };
    }

    function comtradeLoad() {
        var params = collectComtradeParams();
        if (!params) { return; }

        // Прокси ограничивает длину каждого списка — режем запрос на части
        var batches = [];
        comtradeChunk(params.periods, COMTRADE_MAX_PERIODS).forEach(function (periods) {
            comtradeChunk(params.reporters, COMTRADE_MAX_REPORTERS).forEach(function (reporters) {
                comtradeChunk(params.codes, COMTRADE_MAX_CODES).forEach(function (codes) {
                    batches.push({
                        freq: params.freq,
                        flow: params.flow,
                        partner: params.partner,
                        periods: periods,
                        reporters: reporters,
                        codes: codes,
                    });
                });
            });
        });

        // Обращения к API идут с паузой, поэтому длинный период — это минуты.
        // Лучше предупредить, чем оставить пользователя перед висящей кнопкой.
        if (batches.length > 20) {
            var minutes = Math.ceil(batches.length * 1.5 / 60);
            if (!confirm('Потребуется ' + batches.length + ' запросов к Comtrade, примерно ' +
                minutes + ' мин. Продолжить?')) {
                return;
            }
        }

        comtradeLoadBtn.disabled = true;
        if (comtradeOriginalBtn) { comtradeOriginalBtn.hidden = true; }
        if (comtradePresentationBtn) { comtradePresentationBtn.hidden = true; }
        if (comtradeReportBtn) { comtradeReportBtn.hidden = true; }
        if (comtradeTariffBtn) { comtradeTariffBtn.hidden = true; }
        if (tariffBlock) { tariffBlock.hidden = true; tariffBlock.innerHTML = ''; }
        comtradeRawRows = [];
        comtradePresentation = null;
        comtradeTariffData = null;
        setComtradeStatus('Запрос 1 из ' + batches.length + '…', 'progress');

        var collected = [];

        // Последовательно, а не Promise.all: у публичного эндпоинта лимит
        // на частоту, параллельные запросы упрутся в 429
        var chain = Promise.resolve();
        batches.forEach(function (batch, index) {
            chain = chain.then(function () {
                setComtradeStatus('Запрос ' + (index + 1) + ' из ' + batches.length + '…', 'progress');
                return comtradeRequest(batch).then(function (rows) {
                    collected = collected.concat(rows);
                });
            });
        });

        chain
            .then(function () {
                if (collected.length === 0) {
                    setComtradeStatus('Comtrade не вернул данных по этому запросу. Проверьте коды ТН ВЭД и период.', 'error');
                    return;
                }

                // Сохраняем сырой ответ и открываем кнопку скачивания оригинала
                comtradeRawRows = collected;
                if (comtradeOriginalBtn) { comtradeOriginalBtn.hidden = false; }

                var parsed = comtradeToRows(collected, params);

                // Понятная версия для презентаций: цена, объём, читаемые подписи
                comtradePresentation = buildComtradePresentation(parsed, params);
                if (comtradePresentationBtn) { comtradePresentationBtn.hidden = false; }
                // Записка формируется из той же сводки, что и Excel-презентация
                if (comtradeReportBtn && comtradePresentation.summaryRows.length > 0) {
                    comtradeReportBtn.hidden = false;
                }
                // Тарифы TRAINS доступны только по конкретному коду ТН ВЭД
                var tariffCode = (params.codes || [])[0];
                if (comtradeTariffBtn && tariffCode && tariffCode !== 'TOTAL' && tariffCode !== 'ALL') {
                    comtradeTariffBtn.hidden = false;
                }

                // Ярлык и подпись источника зависят от партнёра: «импорт РФ»
                // и «зеркальная статистика» верны, только когда партнёр — страна
                var partnerName = comtradePartnerName(params.partner);
                var isWorld = String(params.partner) === String(COMTRADE_WORLD_CODE);
                var flowWord = params.direction === 'import' ? 'импорт' : 'экспорт';

                var label = 'UN Comtrade — ' + flowWord +
                    (isWorld ? ' (весь мир)' : ' ' + partnerName) + ', ' +
                    params.periods[0].slice(0, 4) + '–' + params.periods[params.periods.length - 1].slice(0, 4);

                applyParsedData({ name: label }, parsed, 'comtrade');

                appState.sourceNote = isWorld
                    ? 'Источник: UN Comtrade, торговля стран со всем миром'
                    : 'Источник: UN Comtrade, зеркальная статистика стран-партнёров ' +
                      '(торговля с: ' + partnerName + ')';

                var note = 'Загружено ' + formatNumber(parsed.rows.length) + ' строк. ';
                note += parsed.weightCoverage === 100
                    ? 'Вес отчитан по всем строкам.'
                    : 'Вес отчитан по ' + parsed.weightCoverage + '% строк, расчёт USD/кг возможен только по ним.';
                setComtradeStatus(note, parsed.weightCoverage >= 50 ? 'ok' : 'warn');
            })
            .catch(function (err) {
                setComtradeStatus(err.message || 'Не удалось загрузить данные', 'error');
            })
            .then(function () {
                comtradeLoadBtn.disabled = false;
            });
    }

    if (comtradeToggle) {
        comtradeToggle.addEventListener('click', function () {
            var opened = !comtradeForm.hidden;
            comtradeForm.hidden = opened;
            comtradeToggle.setAttribute('aria-expanded', String(!opened));
            comtradeToggle.textContent = opened ? 'Открыть' : 'Свернуть';

            if (!opened && comtradeCountries.length === 0) {
                // Регионы ссылаются на коды стран, поэтому ждём оба справочника
                Promise.all([loadComtradeCountries(), loadComtradeRegions()])
                    .then(function () {
                        renderComtradeCountries('');
                        renderComtradeRegions();
                        fillComtradePartners();
                        updateComtradeSelectedHint();
                    });
            }
        });
    }

    if (comtradeCountrySearch) {
        comtradeCountrySearch.addEventListener('input', function () {
            renderComtradeCountries(this.value);
        });
    }

    if (comtradeCountriesBox) {
        comtradeCountriesBox.addEventListener('change', function (e) {
            if (e.target.type !== 'checkbox') { return; }
            comtradeSelected[e.target.value] = e.target.checked;
            // Регион мог стать полным или перестать им быть
            renderComtradeRegions();
            updateComtradeSelectedHint();
        });
    }

    if (comtradeRegionsBox) {
        comtradeRegionsBox.addEventListener('click', function (e) {
            var btn = e.target.closest ? e.target.closest('.comtrade-region') : null;
            if (!btn) { return; }

            toggleComtradeRegion(btn.getAttribute('data-region'));
            // Список стран мог быть отфильтрован поиском — сохраняем фильтр
            renderComtradeCountries(comtradeCountrySearch ? comtradeCountrySearch.value : '');
            renderComtradeRegions();
            updateComtradeSelectedHint();
        });
    }

    var comtradeResetBtn = document.querySelector('.comtrade-reset-btn:not(.wits-reset-btn)');
    if (comtradeResetBtn) {
        comtradeResetBtn.addEventListener('click', function () {
            comtradeSelected = {};
            renderComtradeCountries(comtradeCountrySearch ? comtradeCountrySearch.value : '');
            renderComtradeRegions();
            updateComtradeSelectedHint();
        });
    }

    if (comtradeLoadBtn) {
        comtradeLoadBtn.addEventListener('click', comtradeLoad);
    }

    /*
     * Скачивание оригинала выгрузки Comtrade: строки как пришли от API,
     * со всеми полями и без схлопывания. Колонки — объединение ключей
     * всех строк (у разных строк набор полей может отличаться), порядок —
     * по первому появлению.
     */
    function downloadComtradeOriginal() {
        if (comtradeRawRows.length === 0) { return; }

        var headers = [];
        var seen = {};
        comtradeRawRows.forEach(function (row) {
            Object.keys(row).forEach(function (key) {
                if (!seen[key]) { seen[key] = true; headers.push(key); }
            });
        });

        var fileName = 'comtrade_original_' +
            new Date().toISOString().slice(0, 10) + '.xlsx';
        downloadXlsxData(comtradeRawRows, headers, 'Comtrade оригинал', fileName);
    }

    if (comtradeOriginalBtn) {
        comtradeOriginalBtn.addEventListener('click', downloadComtradeOriginal);
    }

    // Ширина колонок листа по содержимому (первые 100 строк) — как в downloadXlsxData
    function comtradeColWidths(data, headers) {
        return headers.map(function (h) {
            var maxLen = String(h).length;
            var n = Math.min(data.length, 100);
            for (var r = 0; r < n; r++) {
                var v = data[r][h];
                if (v != null) { var l = String(v).length; if (l > maxLen) { maxLen = l; } }
            }
            return { wch: Math.min(maxLen + 2, 50) };
        });
    }

    /*
     * Понятная версия выгрузки Comtrade — для рядового сотрудника, готовящего
     * презентацию. Единицы совпадают с аналитикой приложения, чтобы не путаться:
     * объём — «Объём (тонн)» (вес / 1000, round2), стоимость — «тыс. USD».
     * Строится из уже обработанных строк (parsed), а не из сырого ответа.
     *
     * Возвращает два набора: detail — построчная таблица, summary — сводка по
     * странам (доли и средняя цена) для слайдов.
     */
    function buildComtradePresentation(parsed, params) {
        var isImport = params.direction === 'import';
        var countryCol = comtradeCountryColumn(params);
        var isMonthly = params.freq === 'M';

        // Нац. валюта: Comtrade отдаёт только USD, поэтому пересчитываем по курсу
        // ЦБ на дату (getRowRubValue сам это делает, если рублёвых столбцов нет)
        var rubCtx = buildRubCtx(parsed.headers);

        var headers = ['Направление', 'Страна', 'Год'];
        if (isMonthly) { headers.push('Месяц'); }
        headers.push('Квартал', 'Код ТН ВЭД', 'Объём (тонн)',
            'Стоимость (тыс. USD)', 'Стоимость (тыс. нац. вал.)', 'Цена, USD/кг');

        var rows = [];
        var byCountry = {}; // страна → {w: кг, v: USD, r: руб}
        var byYear = {};    // год → {w: кг, v: USD, r: руб}
        var totalW = 0, totalV = 0, totalR = 0;

        parsed.rows.forEach(function (r) {
            var weightKg = typeof r[COL_WEIGHT] === 'number' ? r[COL_WEIGHT] : null;
            var valueUsd = typeof r[COL_STAT_USD] === 'number' ? r[COL_STAT_USD] : null;
            var valueRub = getRowRubValue(r, rubCtx); // рубли (0, если курса нет)
            var country = r[countryCol];
            var year = r[COL_YEAR];

            var out = {
                'Направление': isImport ? 'Импорт' : 'Экспорт',
                'Страна': country,
                'Год': year,
            };
            if (isMonthly) { out['Месяц'] = r[COL_MONTH]; }
            /*
             * У годовых данных кварталов нет: внутри приложения весь год
             * лежит в Q1, чтобы работали общие расчёты. В выгрузку такую
             * единицу выводить нельзя, читается как «это первый квартал»,
             * хотя в строке годовая сумма. Оставляем ячейку пустой.
             */
            out['Квартал'] = isMonthly ? r[COL_QUARTER] : '';
            out['Код ТН ВЭД'] = r[COL_HS_CODE];
            // Единицы как в аналитике: тонны (round2), тыс. USD и тыс. нац. вал.
            out['Объём (тонн)'] = weightKg != null ? round2(weightKg / 1000) : '';
            out['Стоимость (тыс. USD)'] = valueUsd != null ? round2(valueUsd / 1000) : '';
            out['Стоимость (тыс. нац. вал.)'] = valueRub > 0 ? round2(valueRub / 1000) : '';
            // Цена только там, где есть вес: иначе средняя поедет вниз на пустых
            out['Цена, USD/кг'] = (weightKg && weightKg > 0 && valueUsd != null)
                ? round2(valueUsd / weightKg) : '';
            rows.push(out);

            if (!byCountry[country]) { byCountry[country] = { w: 0, v: 0, r: 0 }; }
            if (weightKg != null) { byCountry[country].w += weightKg; totalW += weightKg; }
            if (valueUsd != null) { byCountry[country].v += valueUsd; totalV += valueUsd; }
            byCountry[country].r += valueRub; totalR += valueRub;

            if (!byYear[year]) { byYear[year] = { w: 0, v: 0, r: 0 }; }
            if (weightKg != null) { byYear[year].w += weightKg; }
            if (valueUsd != null) { byYear[year].v += valueUsd; }
            byYear[year].r += valueRub;
        });

        // Сводка по странам для слайдов: доли по объёму/стоимости и средняя цена
        var summaryHeaders = ['Страна', 'Объём (тонн)', 'Доля по объёму, %',
            'Стоимость (тыс. USD)', 'Доля по стоимости, %',
            'Стоимость (тыс. нац. вал.)', 'Средняя цена, USD/кг'];
        var summaryRows = Object.keys(byCountry).map(function (c) {
            var a = byCountry[c];
            return {
                'Страна': c,
                'Объём (тонн)': round2(a.w / 1000),
                'Доля по объёму, %': totalW > 0 ? round2(a.w / totalW * 100) : '',
                'Стоимость (тыс. USD)': round2(a.v / 1000),
                'Доля по стоимости, %': totalV > 0 ? round2(a.v / totalV * 100) : '',
                'Стоимость (тыс. нац. вал.)': a.r > 0 ? round2(a.r / 1000) : '',
                'Средняя цена, USD/кг': a.w > 0 ? round2(a.v / a.w) : '',
            };
        }).sort(function (x, y) { return y['Объём (тонн)'] - x['Объём (тонн)']; });

        // Сводка по годам для слайдов: рост год-к-году + итоговый CAGR.
        // CAGR как в аналитике: (last/first)^(1/лет) − 1, ×100.
        function calcCAGR(first, last, years) {
            if (!first || first <= 0 || years <= 0) { return null; }
            return (Math.pow(last / first, 1 / years) - 1) * 100;
        }
        var yearHeaders = ['Год', 'Объём (тонн)', 'Рост объёма г/г, %',
            'Стоимость (тыс. USD)', 'Рост USD г/г, %',
            'Стоимость (тыс. нац. вал.)', 'Рост нац. вал. г/г, %', 'Средняя цена, USD/кг'];
        var yearKeys = Object.keys(byYear).sort();
        var yearRows = yearKeys.map(function (y, i) {
            var a = byYear[y];
            var row = {
                'Год': y,
                'Объём (тонн)': round2(a.w / 1000),
                'Рост объёма г/г, %': '',
                'Стоимость (тыс. USD)': round2(a.v / 1000),
                'Рост USD г/г, %': '',
                'Стоимость (тыс. нац. вал.)': a.r > 0 ? round2(a.r / 1000) : '',
                'Рост нац. вал. г/г, %': '',
                'Средняя цена, USD/кг': a.w > 0 ? round2(a.v / a.w) : '',
            };
            if (i > 0) {
                var prev = byYear[yearKeys[i - 1]];
                if (prev.w > 0) { row['Рост объёма г/г, %'] = round2((a.w / prev.w - 1) * 100); }
                if (prev.v > 0) { row['Рост USD г/г, %'] = round2((a.v / prev.v - 1) * 100); }
                if (prev.r > 0) { row['Рост нац. вал. г/г, %'] = round2((a.r / prev.r - 1) * 100); }
            }
            return row;
        });
        // Строка CAGR (первый → последний год), как в анализе «Объёмы и стоимость»
        if (yearKeys.length >= 2) {
            var f = byYear[yearKeys[0]], l = byYear[yearKeys[yearKeys.length - 1]];
            var n = yearKeys.length - 1;
            var cagrW = calcCAGR(f.w, l.w, n);
            var cagrV = calcCAGR(f.v, l.v, n);
            var cagrR = calcCAGR(f.r, l.r, n);
            yearRows.push({
                'Год': 'CAGR',
                'Объём (тонн)': cagrW !== null ? round2(cagrW) + '%' : '—',
                'Рост объёма г/г, %': '',
                'Стоимость (тыс. USD)': cagrV !== null ? round2(cagrV) + '%' : '—',
                'Рост USD г/г, %': '',
                'Стоимость (тыс. нац. вал.)': cagrR !== null ? round2(cagrR) + '%' : '—',
                'Рост нац. вал. г/г, %': '',
                'Средняя цена, USD/кг': '',
            });
        }

        return {
            headers: headers, rows: rows,
            summaryHeaders: summaryHeaders, summaryRows: summaryRows,
            yearHeaders: yearHeaders, yearRows: yearRows,
            reportParams: params, // для HTML-записки: направление, коды, партнёр
        };
    }

    function downloadComtradePresentation() {
        if (!comtradePresentation || comtradePresentation.rows.length === 0) { return; }
        if (typeof XLSX === 'undefined') { return; }

        var p = comtradePresentation;
        var wb = XLSX.utils.book_new();

        var wsData = XLSX.utils.json_to_sheet(p.rows, { header: p.headers });
        wsData['!cols'] = comtradeColWidths(p.rows, p.headers);
        XLSX.utils.book_append_sheet(wb, wsData, 'Данные');

        if (p.summaryRows.length > 0) {
            var wsSum = XLSX.utils.json_to_sheet(p.summaryRows, { header: p.summaryHeaders });
            wsSum['!cols'] = comtradeColWidths(p.summaryRows, p.summaryHeaders);
            XLSX.utils.book_append_sheet(wb, wsSum, 'Для слайдов — страны');
        }

        if (p.yearRows.length > 0) {
            var wsYear = XLSX.utils.json_to_sheet(p.yearRows, { header: p.yearHeaders });
            wsYear['!cols'] = comtradeColWidths(p.yearRows, p.yearHeaders);
            XLSX.utils.book_append_sheet(wb, wsYear, 'Для слайдов — годы');
        }

        appendSourceSheet(wb);

        var fileName = 'comtrade_presentation_' + new Date().toISOString().slice(0, 10) + '.xlsx';
        var wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        triggerDownload(new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }), fileName);
    }

    if (comtradePresentationBtn) {
        comtradePresentationBtn.addEventListener('click', downloadComtradePresentation);
    }

    /* ================================
       Аналитическая записка (HTML) — в стиле Delomant
       ================================
       Собирается из той же сводки, что Excel-презентация (comtradePresentation),
       но выдаёт готовый самодостаточный HTML: титул + рейтинг стран + динамика +
       цены + выводы + источник. Все графики — статичный SVG/CSS без внешних
       библиотек, файл открывается в браузере и печатается в PDF (альбомная).
       Инсайты (лидер, история роста, оговорка про реэкспорт) считаются из данных. */

    function comtradeReportHtml(p, params) {
        function esc(s) {
            return String(s).replace(/[&<>"]/g, function (c) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
            });
        }
        // Разделитель тысяч — узкий неразрывный пробел
        function fmtInt(n) {
            return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        }
        function fmtT(tonnes) {
            return tonnes >= 10000 ? fmtInt(tonnes / 1000) + ' тыс. т' : fmtInt(tonnes) + ' т';
        }
        function pctSpan(v) {
            if (typeof v !== 'number') { return ''; }
            var cls = v >= 0 ? 'up' : 'down';
            var sign = v >= 0 ? '+' : '';
            return '<span class="' + cls + '">' + sign + round2(v) + '%</span>';
        }

        var isImport = params.direction === 'import';
        var buyer = isImport ? 'закупщик' : 'поставщик';
        var flowNoun = isImport ? 'импорта' : 'экспорта';   // родительный: «доля импорта»
        var flowActNoun = isImport ? 'закупки' : 'поставки'; // винительный: «сокращает закупки»

        // Годы (без строки CAGR) и последний год для KPI
        var yearRows = p.yearRows.filter(function (r) { return r['Год'] !== 'CAGR'; });
        var years = yearRows.map(function (r) { return r['Год']; });
        var lastY = yearRows[yearRows.length - 1] || {};
        var firstYear = years[0], lastYear = years[years.length - 1];

        var top = p.summaryRows.slice(0, 10);
        var leader = top[0] || { 'Страна': '—', 'Объём (тонн)': 0, 'Доля по объёму, %': 0 };
        var second = top[1];
        var ratio = (second && second['Объём (тонн)'] > 0)
            ? leader['Объём (тонн)'] / second['Объём (тонн)'] : null;

        // Страна × год (тонны) для линий — из детальных строк
        var cy = {};
        p.rows.forEach(function (r) {
            var t = r['Объём (тонн)'];
            if (typeof t !== 'number') { return; }
            var c = r['Страна'], y = r['Год'];
            if (!cy[c]) { cy[c] = {}; }
            cy[c][y] = (cy[c][y] || 0) + t;
        });
        var lineCountries = top.slice(0, 5).map(function (r) { return r['Страна']; });

        // Тренд первый→последний год, % (для инсайтов)
        function trendPct(country) {
            var a = cy[country] || {};
            var f = a[firstYear], l = a[lastYear];
            if (!f || f <= 0 || typeof l !== 'number') { return null; }
            return (l / f - 1) * 100;
        }
        var leaderTrend = trendPct(leader['Страна']);
        // Лидер роста среди топ-8 (с заметным объёмом)
        var grower = null, growerPct = -Infinity;
        top.slice(0, 8).forEach(function (r) {
            var t = trendPct(r['Страна']);
            if (t !== null && t > growerPct) { growerPct = t; grower = r['Страна']; }
        });

        // Цены по странам (по убыванию), только где есть
        var priceRows = p.summaryRows.filter(function (r) {
            return typeof r['Средняя цена, USD/кг'] === 'number';
        }).sort(function (a, b) {
            return b['Средняя цена, USD/кг'] - a['Средняя цена, USD/кг'];
        }).slice(0, 10);

        var reexport = isImport && top.slice(0, 8).some(function (r) {
            return r['Страна'] === 'Нидерланды' || r['Страна'] === 'Бельгия';
        });

        // --- Заголовок и контекст ---
        var codeStr = (params.codes && params.codes[0] !== 'TOTAL')
            ? params.codes.join(', ') : null;
        var isWorld = String(params.partner) === String(COMTRADE_WORLD_CODE);
        var partnerCtx = isWorld ? 'торговля со всем миром'
            : 'партнёр — ' + comtradePartnerName(params.partner);
        var title = (isImport ? 'Импорт' : 'Экспорт') +
            (codeStr ? ' товара ' + esc(codeStr) : ' (весь товарооборот)');
        var subtitle = (codeStr ? 'ТН ВЭД ' + esc(codeStr) + ' · ' : '') +
            p.summaryRows.length + ' стран · ' + partnerCtx;

        // --- Барчарт (горизонтальный) ---
        function barChart(items, maxVal, fmt, leadName) {
            return items.map(function (it) {
                var w = maxVal > 0 ? (it.v / maxVal * 100).toFixed(1) : 0;
                var lead = it.name === leadName ? ' lead' : '';
                return '<div class="bar-row"><div class="bar-name">' + esc(it.name) + '</div>' +
                    '<div class="bar-track"><div class="bar-fill' + lead + '" style="width:' + w + '%"></div></div>' +
                    '<div class="bar-val">' + fmt(it) + '</div></div>';
            }).join('');
        }
        var rankItems = top.map(function (r) {
            return { name: r['Страна'], v: r['Объём (тонн)'], sh: r['Доля по объёму, %'] };
        });
        var bars1 = barChart(rankItems, rankItems[0] ? rankItems[0].v : 0, function (it) {
            return '<b>' + fmtInt(it.v / 1000) + ' тыс. т</b> <span class="sh">· ' +
                (typeof it.sh === 'number' ? round2(it.sh) + '%' : '') + '</span>';
        }, leader['Страна']);
        var priceItems = priceRows.map(function (r) {
            return { name: r['Страна'], v: r['Средняя цена, USD/кг'] };
        });
        var bars2 = barChart(priceItems, priceItems[0] ? priceItems[0].v : 0, function (it) {
            return '<b>$' + round2(it.v) + '/кг</b>';
        }, leader['Страна']);

        // --- SVG линии динамики ---
        var lineColors = ['#211CB0', '#2F2BC7', '#16A34A', '#8B93F2', '#F59E0B'];
        var lineSvg = '', legendHtml = '';
        if (years.length >= 2) {
            var W = 1180, H = 340, padL = 54, padR = 140, padT = 20, padB = 40;
            var xa = padL, xb = W - padR, ya = padT, yb = H - padB;
            var maxV = 0;
            lineCountries.forEach(function (c) {
                years.forEach(function (y) {
                    var v = (cy[c] && cy[c][y]) ? cy[c][y] / 1000 : 0;
                    if (v > maxV) { maxV = v; }
                });
            });
            // «Красивый» шаг сетки
            var rawStep = maxV / 4 || 1;
            var mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
            var step = Math.ceil(rawStep / mag) * mag;
            var vmax = step * Math.ceil(maxV / step || 1);
            function X(i) { return xa + (xb - xa) * i / (years.length - 1); }
            function Y(v) { return yb - (yb - ya) * v / vmax; }
            var s = '';
            for (var g = 0; g <= vmax + 0.001; g += step) {
                s += '<line x1="' + xa + '" y1="' + Y(g) + '" x2="' + xb + '" y2="' + Y(g) + '" stroke="#EEF0F5"/>';
                s += '<text x="' + (xa - 10) + '" y="' + (Y(g) + 4) + '" text-anchor="end" font-size="12" fill="#94A3B8">' + fmtInt(g) + '</text>';
            }
            years.forEach(function (y, i) {
                s += '<text x="' + X(i) + '" y="' + (yb + 24) + '" text-anchor="middle" font-size="13" fill="#64748B">' + esc(y) + '</text>';
            });
            var labels = [];
            lineCountries.forEach(function (c, idx) {
                var pts = years.map(function (y) { return (cy[c] && cy[c][y]) ? cy[c][y] / 1000 : 0; });
                var d = pts.map(function (v, i) { return (i ? 'L' : 'M') + X(i) + ' ' + Y(v); }).join(' ');
                s += '<path d="' + d + '" fill="none" stroke="' + lineColors[idx] + '" stroke-width="3" stroke-linejoin="round"/>';
                pts.forEach(function (v, i) { s += '<circle cx="' + X(i) + '" cy="' + Y(v) + '" r="3.5" fill="' + lineColors[idx] + '"/>'; });
                labels.push({ name: c, color: lineColors[idx], y: Y(pts[pts.length - 1]) });
            });
            // Расталкиваем налезающие подписи
            labels.sort(function (a, b) { return a.y - b.y; });
            for (var k = 1; k < labels.length; k++) {
                if (labels[k].y - labels[k - 1].y < 15) { labels[k].y = labels[k - 1].y + 15; }
            }
            labels.forEach(function (l) {
                s += '<text x="' + (xb + 8) + '" y="' + (l.y + 4) + '" font-size="12.5" font-weight="700" fill="' + l.color + '">' + esc(l.name) + '</text>';
            });
            lineSvg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:340px">' + s + '</svg>';
            legendHtml = lineCountries.map(function (c, i) {
                return '<span><i style="background:' + lineColors[i] + '"></i>' + esc(c) + '</span>';
            }).join('');
        }

        // --- Инсайты (динамические) ---
        var insight1 = 'Крупнейший ' + buyer + ' это <b>' + esc(leader['Страна']) + '</b>: ' +
            (typeof leader['Доля по объёму, %'] === 'number' ? round2(leader['Доля по объёму, %']) + '% всего ' + flowNoun + ' региона' : '') +
            (ratio ? ', в ' + round2(ratio) + '× больше ближайшей страны' : '');
        var insight2;
        if (years.length >= 2 && grower) {
            insight2 = '<b>' + esc(leader['Страна']) + '</b> ' +
                (leaderTrend !== null ? (leaderTrend < 0 ? 'сокращает ' + flowActNoun + ' (' + round2(leaderTrend) + '% за период)' : 'растёт (+' + round2(leaderTrend) + '%)') : '') +
                (grower !== leader['Страна'] ? ', при этом <b>' + esc(grower) + '</b> наращивает быстрее всех (' + (growerPct >= 0 ? '+' : '') + round2(growerPct) + '%)' : '');
        } else {
            insight2 = 'Динамика ' + flowNoun + ' по ключевым странам за выбранный период';
        }
        var priceMin = priceItems.length ? priceItems[priceItems.length - 1] : null;
        var priceMax = priceItems.length ? priceItems[0] : null;
        var insight3 = priceMin && priceMax
            ? 'Цена входа сильно различается: от <b>$' + round2(priceMin.v) + '/кг</b> до <b>$' + round2(priceMax.v) + '/кг</b>. Объём закупок и премиальность рынка не совпадают'
            : 'Средняя импортная цена по странам';

        // --- Выводы ---
        var takes = [];
        takes.push('<b>' + esc(leader['Страна']) + '</b> занимает первое место по объёму (' +
            (typeof leader['Доля по объёму, %'] === 'number' ? round2(leader['Доля по объёму, %']) + '%, ' : '') +
            fmtT(leader['Объём (тонн)']) + ' за период)' +
            (leaderTrend !== null ? (leaderTrend < 0 ? ', но с нисходящим трендом' : ' и с растущим спросом') : '') + '.');
        if (grower && grower !== leader['Страна'] && growerPct > 0) {
            takes.push('<b>' + esc(grower) + '</b> растёт быстрее всех: ' + (growerPct >= 0 ? '+' : '') + round2(growerPct) + '% за период. Хороший кандидат на перспективу.');
        }
        if (reexport) {
            takes.push('<b>Нидерланды и Бельгию не стоит путать со спросом.</b> Это крупные хабы, Роттердам и Антверпен, и заметная часть их объёма приходится на реэкспорт, а не на конечное потребление.');
        }
        if (priceMax && priceMin) {
            takes.push('<b>Ценовое позиционирование.</b> Дороже всего покупает ' + esc(priceMax.name) + ' ($' + round2(priceMax.v) + '/кг), дешевле всего ' + esc(priceMin.name) + ' ($' + round2(priceMin.v) + '/кг).');
        }
        var takesHtml = takes.map(function (t, i) {
            return '<div class="lead-take"><div class="dot">' + (i + 1) + '</div><p>' + t + '</p></div>';
        }).join('');

        var footNote = 'delomant.ru · UN Comtrade';
        var dateStr = new Date().toLocaleDateString('ru-RU');
        var yearNow = new Date().getFullYear();

        // KPI
        var kpiVolume = typeof lastY['Объём (тонн)'] === 'number' ? fmtT(lastY['Объём (тонн)']) : '—';
        var kpiValue = typeof lastY['Стоимость (тыс. USD)'] === 'number'
            ? '$' + fmtInt(lastY['Стоимость (тыс. USD)'] / 1000) + ' млн' : '—';
        var kpiPrice = typeof lastY['Средняя цена, USD/кг'] === 'number'
            ? '$' + round2(lastY['Средняя цена, USD/кг']) + '/кг' : '—';

        var CSS = comtradeReportCss();
        var pages = '';
        var pageNo = 1; // титул

        // 1. Титул
        pages += '<section class="page cover">' +
            '<svg class="deco" viewBox="0 0 640 720" preserveAspectRatio="none"><g fill="#ffffff">' +
            '<path d="M480 120 a120 120 0 0 1 120 120 h-120 z"/><path d="M360 360 a120 120 0 0 0 120 120 v-120 z"/>' +
            '<circle cx="520" cy="520" r="80"/><rect x="360" y="120" width="110" height="110" rx="10"/></g></svg>' +
            '<div class="brand"><div class="col"><span class="colbase"></span></div><div class="bname">DELOMANT<br>GROUP</div></div>' +
            '<div class="kicker">Аналитическая справка<br>по итогам исследования рынка</div>' +
            '<h1>' + title + ',<br>' + firstYear + '–' + lastYear + '</h1>' +
            '<div class="part">' + subtitle + '</div>' +
            '<div class="site">delomant.ru</div><div class="yr">' + yearNow + '</div></section>';

        // 2. Главное
        pages += '<section class="page"><div class="insight">' + insight1 + '</div><div class="body">' +
            '<div class="kpis">' +
            '<div class="kpi"><div class="k-lab">Лидер</div><div class="k-val" style="font-size:26px">' + esc(leader['Страна']) + '</div><div class="k-sub">' + fmtT(leader['Объём (тонн)']) + ' за период</div></div>' +
            '<div class="kpi"><div class="k-lab">Объём, ' + lastYear + '</div><div class="k-val">' + kpiVolume + '</div><div class="k-sub">' + pctSpan(lastY['Рост объёма г/г, %']) + '</div></div>' +
            '<div class="kpi"><div class="k-lab">Стоимость, ' + lastYear + '</div><div class="k-val">' + kpiValue + '</div><div class="k-sub">' + pctSpan(lastY['Рост USD г/г, %']) + '</div></div>' +
            '<div class="kpi"><div class="k-lab">Средняя цена</div><div class="k-val">' + kpiPrice + '</div><div class="k-sub">' + lastYear + '</div></div>' +
            '</div>' +
            '<div class="chart-no">Диаграмма 1.</div><div class="chart-title">ТОП-' + top.length + ' стран по объёму ' + flowNoun + ', суммарно ' + firstYear + '–' + lastYear + '</div>' +
            '<div class="bars">' + bars1 + '</div></div>' +
            '<div class="footer"><span class="wm">DELOMANT</span><span>' + footNote + '</span><span>' + (++pageNo) + '</span></div></section>';

        // 3. Динамика
        if (lineSvg) {
            pages += '<section class="page"><div class="insight">' + insight2 + '</div><div class="body">' +
                '<div class="chart-no">Диаграмма 2.</div><div class="chart-title">Динамика ' + flowNoun + ' по ключевым странам, ' + firstYear + '–' + lastYear + ', тыс. тонн</div>' +
                lineSvg + '<div class="legend">' + legendHtml + '</div>' +
                '<div style="margin-top:22px" class="note"><b>Ключевой вывод.</b> При выборе целевого рынка смотрите и на объём, и на тренд. Лидерство во времени не бывает вечным.</div></div>' +
                '<div class="footer"><span class="wm">DELOMANT</span><span>' + footNote + '</span><span>' + (++pageNo) + '</span></div></section>';
        }

        // 4. Цены
        if (bars2) {
            pages += '<section class="page"><div class="insight">' + insight3 + '</div><div class="body">' +
                '<div class="chart-no">Диаграмма 3.</div><div class="chart-title">Средняя импортная цена по странам, ' + firstYear + '–' + lastYear + ', USD/кг</div>' +
                '<div class="bars">' + bars2 + '</div>' +
                (reexport ? '<div style="margin-top:24px" class="note"><b>Важно при интерпретации.</b> Нидерланды и Бельгия это логистические хабы, часть их «импорта» приходится на реэкспорт, а не на конечное потребление. Германия, Польша и Италия ближе к конечным рынкам.</div>' : '') +
                '</div><div class="footer"><span class="wm">DELOMANT</span><span>' + footNote + '</span><span>' + (++pageNo) + '</span></div></section>';
        }

        // Тарифные барьеры — только если пользователь их загрузил (WITS TRAINS).
        // Это то, чего нет в Comtrade: ставка пошлины по той же позиции.
        var tariffRows = (comtradeTariffData || []).filter(function (r) { return r.rate !== null; });
        if (tariffRows.length > 0) {
            var maxTr = tariffRows.reduce(function (m, r) { return Math.max(m, r.rate); }, 0) || 1;
            var bestTr = tariffRows.slice().sort(function (x, y) {
                return (y.tonnes / (1 + y.rate)) - (x.tonnes / (1 + x.rate));
            })[0];
            var trBars = tariffRows.slice(0, 10).map(function (r) {
                var w = (r.rate / maxTr * 100).toFixed(1);
                var lead = bestTr && r.country === bestTr.country ? ' lead' : '';
                return '<div class="bar-row"><div class="bar-name">' + esc(r.country) + '</div>' +
                    '<div class="bar-track"><div class="bar-fill' + lead + '" style="width:' + w + '%"></div></div>' +
                    '<div class="bar-val"><b>' + round2(r.rate) + '%</b> <span class="sh">· ' +
                    fmtInt((r.tonnes || 0) / 1000) + ' тыс. т</span></div></div>';
            }).join('');

            pages += '<section class="page"><div class="insight">' +
                (bestTr ? 'Лучшее сочетание спроса и низкого барьера у страны <b>' + esc(bestTr.country) +
                    '</b>: ' + fmtInt(bestTr.tonnes / 1000) + ' тыс. т при пошлине ' + round2(bestTr.rate) + '%'
                    : 'Тарифные барьеры входа по странам') +
                '</div><div class="body">' +
                '<div class="chart-no">Диаграмма 4.</div>' +
                '<div class="chart-title">Ставка ввозной пошлины (РНБ) и объём закупок' +
                (codeStr ? ', код ' + esc(codeStr) : '') + '</div>' +
                '<div class="bars">' + trBars + '</div>' +
                '<div style="margin-top:24px" class="note"><b>Как читать:</b> показана базовая ставка режима ' +
                'наибольшего благоприятствования, то есть пошлина без торговых соглашений. Объём говорит, ' +
                'сколько рынок покупает, а ставка во сколько обойдётся вход. Страны одного ' +
                'таможенного союза (ЕС) имеют общую ставку.</div>' +
                '</div><div class="footer"><span class="wm">DELOMANT</span><span>' + footNote +
                '</span><span>' + (++pageNo) + '</span></div></section>';
        }

        // Выводы + источник
        pages += '<section class="page"><div class="insight">Выводы и рекомендации</div><div class="body">' +
            takesHtml +
            '<div style="margin-top:28px" class="chart-no">Источник данных</div><table class="src">' +
            '<tr><td>Источник</td><td>UN Comtrade, база внешнеторговой статистики ООН (' + partnerCtx + ')</td></tr>' +
            (codeStr ? '<tr><td>Товар</td><td>ТН ВЭД ' + esc(codeStr) + ' (уровень HS6)</td></tr>' : '') +
            '<tr><td>Охват</td><td>' + p.summaryRows.length + ' стран · направление ' + (isImport ? 'импорт' : 'экспорт') + ' · период ' + firstYear + '–' + lastYear + '</td></tr>' +
            '<tr><td>Единицы</td><td>Тонны (нетто-вес) и тыс. USD. Данные не содержат сведений об отправителях, получателях и изготовителях</td></tr>' +
            (tariffRows.length > 0 ? '<tr><td>Тарифы</td><td>WITS TRAINS (UNCTAD), ставка РНБ по коду ' +
                (codeStr ? esc(codeStr) : '') + ', последний доступный год по каждой стране</td></tr>' : '') +
            '<tr><td>Выгружено</td><td>' + dateStr + '</td></tr></table>' +
            '</div><div class="footer"><span class="wm">DELOMANT</span><span>' + footNote + '</span><span>' + (++pageNo) + '</span></div></section>';

        return '<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">' +
            '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
            '<title>Delomant — ' + title.replace(/<[^>]+>/g, '') + '</title><style>' + CSS + '</style></head><body>' +
            pages + '</body></html>';
    }

    function comtradeReportCss() {
        return ":root{--blue:#2F2BC7;--blue-deep:#211CB0;--blue-soft:#EEF0FF;--ink:#0F172A;--muted:#64748B;--line:#E2E8F0;--accent:#16A34A;--warn:#B45309;--warn-bg:#FEF3C7;--font:'PT Sans','Segoe UI',-apple-system,Roboto,sans-serif;--serif:'PT Serif',Georgia,'Times New Roman',serif}" +
            "*{box-sizing:border-box;margin:0;padding:0}body{background:#5b5f6b;font-family:var(--font);color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
            ".page{position:relative;width:1280px;height:720px;margin:24px auto;background:#fff;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.35)}" +
            ".insight{background:var(--blue-deep);color:#fff;padding:26px 48px;font-size:22px;line-height:1.35;font-weight:700}.insight b{color:#FDE047}" +
            ".body{padding:26px 48px}.chart-no{color:var(--blue);font-weight:700;font-size:16px}.chart-title{color:var(--muted);font-size:15px;margin:2px 0 22px}" +
            ".footer{position:absolute;left:48px;right:48px;bottom:20px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--line);padding-top:12px;color:var(--muted);font-size:12px}.footer .wm{color:var(--blue-deep);font-weight:800;letter-spacing:.12em;font-size:13px}" +
            ".cover{background:var(--blue-deep);color:#fff}.cover .brand{position:absolute;top:56px;left:56px;display:flex;align-items:center;gap:16px}" +
            ".cover .col{width:44px;height:52px;position:relative}.cover .col:before{content:'';position:absolute;left:6px;right:6px;top:0;height:7px;background:#fff;border-radius:2px}.cover .col:after{content:'';position:absolute;left:11px;right:11px;top:11px;bottom:8px;background:repeating-linear-gradient(90deg,#fff 0 3px,transparent 3px 7px)}.cover .colbase{position:absolute;left:2px;right:2px;bottom:0;height:7px;background:#fff;border-radius:2px}" +
            ".cover .bname{font-family:var(--serif);font-size:34px;line-height:1.05;letter-spacing:.06em}.cover .kicker{position:absolute;top:64px;right:56px;text-align:right;font-weight:700;font-size:18px;line-height:1.4;opacity:.95}" +
            ".cover h1{position:absolute;left:56px;bottom:150px;right:120px;font-family:var(--serif);font-weight:700;font-size:48px;line-height:1.15}.cover .part{position:absolute;left:56px;bottom:96px;font-size:20px;opacity:.9}.cover .site{position:absolute;left:56px;bottom:48px;font-size:15px;opacity:.85}.cover .yr{position:absolute;right:56px;bottom:48px;font-size:15px;opacity:.85}.cover .deco{position:absolute;right:0;top:0;width:640px;height:720px;opacity:.10}" +
            ".bars{display:flex;flex-direction:column;gap:11px}.bar-row{display:grid;grid-template-columns:180px 1fr 160px;align-items:center;gap:14px}.bar-name{font-size:15px;font-weight:600;text-align:right}.bar-track{background:#F1F5F9;border-radius:5px;height:26px;position:relative}.bar-fill{height:100%;border-radius:5px;background:var(--blue)}.bar-fill.lead{background:linear-gradient(90deg,var(--blue-deep),var(--blue))}.bar-val{font-size:14px}.bar-val .sh{color:var(--muted)}" +
            ".kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}.kpi{border:1px solid var(--line);border-radius:12px;padding:18px 20px}.kpi .k-lab{color:var(--muted);font-size:13px;margin-bottom:8px}.kpi .k-val{font-size:30px;font-weight:800;color:var(--blue-deep);line-height:1}.kpi .k-sub{font-size:13px;margin-top:8px}.up{color:var(--accent);font-weight:700}.down{color:#DC2626;font-weight:700}" +
            ".legend{display:flex;gap:22px;flex-wrap:wrap;margin-top:14px;font-size:13px;color:var(--muted)}.legend span{display:inline-flex;align-items:center;gap:7px}.legend i{width:14px;height:4px;border-radius:2px;display:inline-block}" +
            ".lead-take{display:flex;gap:16px;align-items:flex-start;margin-bottom:16px}.lead-take .dot{flex:0 0 auto;width:28px;height:28px;border-radius:8px;background:var(--blue-soft);color:var(--blue-deep);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px}.lead-take p{font-size:16px;line-height:1.5}.lead-take b{color:var(--blue-deep)}" +
            ".note{background:var(--warn-bg);border-left:4px solid var(--warn);border-radius:8px;padding:14px 18px;color:#7c4a03;font-size:14px;line-height:1.5}.note b{color:var(--warn)}" +
            "table.src{width:100%;border-collapse:collapse;font-size:14px}table.src td{padding:9px 4px;border-bottom:1px solid var(--line);vertical-align:top}table.src td:first-child{color:var(--muted);width:220px}" +
            "@media print{body{background:#fff}.page{margin:0;box-shadow:none;page-break-after:always}@page{size:1280px 720px;margin:0}}";
    }

    function downloadComtradeReport() {
        if (!comtradePresentation || comtradePresentation.summaryRows.length === 0) { return; }
        var params = comtradePresentation.reportParams;
        if (!params) { return; }
        var html = comtradeReportHtml(comtradePresentation, params);
        var fileName = 'comtrade_report_' + new Date().toISOString().slice(0, 10) + '.html';
        triggerDownload(new Blob(['﻿' + html], { type: 'text/html;charset=utf-8' }), fileName);
    }

    if (comtradeReportBtn) {
        comtradeReportBtn.addEventListener('click', downloadComtradeReport);
    }

    /* ================================
       Тарифные барьеры (WITS TRAINS) поверх выгрузки Comtrade
       ================================
       Comtrade говорит, СКОЛЬКО страна ввозит, но молчит о том, ПО КАКОЙ
       ставке. Тарифы живут в отдельном датасете WITS — TRAINS. Ключевое:
       tradestats-* работают только на 16 товарных разделах и не принимают
       конкретный код (проверено: «Invalid Product Code»), а TRAINS отдаёт
       ставку ровно по HS6 — то есть по той же позиции, что мы загрузили.

       Связать источники удалось без таблицы соответствий: коды стран у
       TRAINS числовые M49 — те же, что reporterCode у Comtrade. */

    var comtradeTariffBtn = document.querySelector('.comtrade-tariff-btn');
    var tariffBlock = document.querySelector('.tariff-block');
    var comtradeTariffData = null; // [{country, code, rate, min, max, lines}] — и для записки

    /** Коды стран (M49) из сырого ответа Comtrade: код → русское имя. */
    function comtradeReporterCodes() {
        var names = {};
        comtradeCountries.forEach(function (c) { names[String(c.code)] = c.name; });

        var map = {};
        comtradeRawRows.forEach(function (r) {
            var code = r.reporterCode;
            if (code === undefined || code === null) { return; }
            map[String(code)] = names[String(code)] || ('код ' + code);
        });
        return map;
    }

    function loadComtradeTariffs() {
        if (!comtradePresentation || !tariffBlock) { return; }
        var params = comtradePresentation.reportParams || {};
        var codes = params.codes || [];
        var hs = codes[0];

        if (!hs || hs === 'TOTAL' || hs === 'ALL') {
            tariffBlock.hidden = false;
            tariffBlock.innerHTML = '<div class="tariff-note">Тарифы показываются для конкретного кода ТН ВЭД. ' +
                'Укажите код в поле «Коды ТН ВЭД» и загрузите данные заново.</div>';
            return;
        }

        var byCode = comtradeReporterCodes();
        // Ограничиваем список: тарифы интересны по значимым рынкам, а у
        // прокси стоит потолок на число стран в одном запросе.
        var topNames = comtradePresentation.summaryRows.slice(0, 15).map(function (r) { return r['Страна']; });
        var wanted = [];
        Object.keys(byCode).forEach(function (code) {
            if (topNames.indexOf(byCode[code]) !== -1) { wanted.push(code); }
        });
        if (wanted.length === 0) { wanted = Object.keys(byCode).slice(0, 15); }

        /*
         * Годы. TRAINS заметно отстаёт от торговой статистики, и горизонт у
         * каждой страны свой: проверено — у России последний год 2021, у
         * Египта 2019. Поэтому просим широкое окно назад от последнего года
         * выгрузки и берём по каждой стране самый свежий найденный год.
         * WITS отдаёт несколько лет одним запросом, так что это дёшево.
         */
        var years = (comtradePresentation.yearRows || [])
            .filter(function (r) { return r['Год'] !== 'CAGR'; })
            .map(function (r) { return parseInt(r['Год'], 10); })
            .filter(function (y) { return !isNaN(y); });
        var lastYear = years.length ? Math.max.apply(null, years) : new Date().getFullYear() - 3;
        var askYears = [];
        for (var back = 0; back <= 9; back++) {
            var y = lastYear - back;
            if (y >= 1988) { askYears.push(y); }
        }

        tariffBlock.hidden = false;
        tariffBlock.innerHTML = '<div class="tariff-note">Загружаем тарифные ставки WITS TRAINS…</div>';

        var url = WITS_PROXY_URL + '?datasource=trn' +
            '&reporter=' + encodeURIComponent(wanted.join(',')) +
            '&partner=000' +
            '&product=' + encodeURIComponent(hs) +
            '&year=' + encodeURIComponent(askYears.join(',')) +
            '&datatype=reported';

        fetch(url, { cache: 'no-store' })
            .then(function (r) { return r.json(); })
            .then(function (json) {
                if (json.error) { throw new Error(json.error); }
                renderComtradeTariffs(json.data || [], byCode, hs);
            })
            .catch(function (e) {
                tariffBlock.innerHTML = '<div class="tariff-note tariff-note-error">Не удалось загрузить тарифы: ' +
                    marketEsc(e.message) + '</div>';
            });
    }

    /** Соединяем ставку с объёмом: по каждой стране берём самый свежий год. */
    function renderComtradeTariffs(rows, byCode, hs) {
        var latest = {}; // код страны → запись с максимальным годом
        rows.forEach(function (r) {
            if (r.value === null || r.value === undefined) { return; }
            var code = String(parseInt(r.reporter, 10)); // «276» и «0276» — одно и то же
            var year = parseInt(r.year, 10);
            if (!latest[code] || year > latest[code].year) {
                latest[code] = {
                    year: year, rate: r.value, min: r.minRate, max: r.maxRate,
                    lines: r.lines, type: r.tariffType || 'MFN'
                };
            }
        });

        // Имя страны → код, чтобы подтянуть ставку к строке сводки
        var nameToCode = {};
        Object.keys(byCode).forEach(function (code) {
            nameToCode[byCode[code]] = String(parseInt(code, 10));
        });

        var out = [];
        comtradePresentation.summaryRows.slice(0, 15).forEach(function (row) {
            var name = row['Страна'];
            var t = latest[nameToCode[name]];
            out.push({
                country: name,
                tonnes: row['Объём (тонн)'],
                share: row['Доля по объёму, %'],
                price: row['Средняя цена, USD/кг'],
                rate: t ? t.rate : null,
                min: t ? t.min : null,
                max: t ? t.max : null,
                lines: t ? t.lines : null,
                year: t ? t.year : null
            });
        });
        comtradeTariffData = out;

        var withRate = out.filter(function (r) { return r.rate !== null; });
        if (withRate.length === 0) {
            tariffBlock.innerHTML = '<div class="tariff-note">По коду ' + marketEsc(hs) +
                ' тарифных ставок не нашлось. База TRAINS отстаёт от торговой статистики ' +
                'на несколько лет, а по некоторым странам данных нет вовсе. Это ограничение источника, ' +
                'а не ошибка загрузки.</div>';
            return;
        }

        // Пояснение — чтобы пользователь понимал, что именно он видит
        var html = '<div class="tariff-head">' +
            '<h4>Тарифные барьеры входа · код ' + marketEsc(hs) + '</h4>' +
            '<span class="tariff-source">WITS TRAINS · ставка РНБ</span></div>';
        html += '<div class="tariff-explain">' +
            '<b>Как это читать.</b> Comtrade показывает, <i>сколько</i> страна закупает, ' +
            'но не говорит, <i>по какой пошлине</i>. Чем ставка ниже, тем дешевле зайти на рынок. ' +
            'Показана базовая ставка РНБ, то есть режим наибольшего благоприятствования ' +
            'без торговых соглашений. В колонке «разброс» стоят минимальная и максимальная ставка ' +
            'внутри позиции: за средним значением могут прятаться разные подкатегории товара. ' +
            'Страны одного союза (ЕС) имеют общую ставку. ' +
            '<b>Год указан у каждой строки:</b> база тарифов отстаёт от торговой статистики, ' +
            'и у разных стран последний доступный год свой. Прочерк значит, что страна не отчиталась.</div>';

        var maxT = withRate.reduce(function (m, r) { return Math.max(m, r.tonnes || 0); }, 0) || 1;
        var maxR = withRate.reduce(function (m, r) { return Math.max(m, r.rate || 0); }, 0) || 1;

        html += '<div class="tariff-list">';
        out.forEach(function (r) {
            var barVol = Math.max(3, Math.round((r.tonnes || 0) / maxT * 100));
            var rateTxt = r.rate === null ? '—' : round2(r.rate) + '%';
            var barRate = r.rate === null ? 0 : Math.max(3, Math.round(r.rate / maxR * 100));
            // Хороший рынок = большой объём при низкой ставке
            var cls = r.rate === null ? 'unknown' : (r.rate <= 5 ? 'low' : (r.rate <= 15 ? 'mid' : 'high'));
            // Компактно: год и разброс линий. Подробности — в подсказке.
            var hasSpread = r.min !== null && r.max !== null &&
                r.min !== undefined && r.max !== undefined && r.min !== r.max;
            var spread = hasSpread ? ' · ' + round2(r.min) + '–' + round2(r.max) + '%' : '';
            var spreadTitle = hasSpread
                ? 'Внутри позиции ' + (r.lines || '') + ' тарифных линий со ставками от ' +
                  round2(r.min) + '% до ' + round2(r.max) + '%'
                : '';

            html += '<div class="tariff-row">' +
                '<div class="tariff-country">' + marketEsc(r.country) + '</div>' +
                '<div class="tariff-metric">' +
                    '<div class="tariff-bar"><div class="tariff-fill vol" style="width:' + barVol + '%"></div></div>' +
                    '<span class="tariff-val">' + formatNumber(Math.round((r.tonnes || 0) / 1000)) + ' тыс. т</span>' +
                '</div>' +
                '<div class="tariff-metric">' +
                    '<div class="tariff-bar"><div class="tariff-fill rate ' + cls + '" style="width:' + barRate + '%"></div></div>' +
                    '<span class="tariff-val tariff-rate ' + cls + '">' + rateTxt + '</span>' +
                '</div>' +
                '<div class="tariff-extra" title="' + marketEsc(spreadTitle) + '">' +
                    (r.year || '') + spread + '</div>' +
            '</div>';
        });
        html += '</div>';

        // Короткий вывод: где сочетание «много покупают» и «низкая ставка»
        var best = withRate.slice().sort(function (a, b) {
            return (b.tonnes / (1 + b.rate)) - (a.tonnes / (1 + a.rate));
        })[0];
        if (best) {
            html += '<div class="tariff-verdict">Лучшее сочетание объёма и низкой ставки: <b>' +
                marketEsc(best.country) + '</b> — ' + formatNumber(Math.round(best.tonnes / 1000)) +
                ' тыс. т при ставке ' + round2(best.rate) + '%.</div>';
        }
        tariffBlock.innerHTML = html;
    }

    if (comtradeTariffBtn) {
        comtradeTariffBtn.addEventListener('click', loadComtradeTariffs);
    }

    /* ================================
       Справочник кодов ТН ВЭД (поиск по названию)
       ================================
       Данные — data/foreign/hs_names_ru.json (hs6/hs4 → рус. название),
       тот же файл, что и в модуле зарубежной таможни. Грузится лениво при
       первом обращении. Клик по результату подставляет код в поле «Коды
       ТН ВЭД». */
    (function initHsSearch() {
        var input = document.querySelector('.hs-search-input');
        var results = document.querySelector('.hs-search-results');
        var codesInput = document.querySelector('.comtrade-codes');
        if (!input || !results || !codesInput) { return; }

        var namesList = null; // [[code, name], …]
        var loading = false;
        var timer = null;

        function escapeHtml(s) {
            return String(s).replace(/[&<>"]/g, function (c) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
            });
        }

        // Справочник общий с подписями в анализах — грузится один раз
        function loadNames() {
            if (namesList || loading) { return; }
            loading = true;
            loadHsNames().then(function (d) {
                var list = [];
                ['hs6', 'hs4'].forEach(function (lvl) {
                    var m = (d && d[lvl]) || {};
                    Object.keys(m).forEach(function (code) { list.push([code, m[code]]); });
                });
                namesList = list;
                render(input.value);
            });
        }

        function render(q) {
            q = (q || '').trim().toLowerCase();
            if (q.length < 2) { results.hidden = true; results.innerHTML = ''; return; }
            if (!namesList) {
                // Справочник ещё грузится — показываем статус, результаты
                // дорисуются в loadNames() после загрузки файла.
                results.innerHTML = '<div class="hs-empty">Загрузка справочника…</div>';
                results.hidden = false;
                return;
            }
            var out = [];
            for (var i = 0; i < namesList.length && out.length < 40; i++) {
                if (namesList[i][1].toLowerCase().indexOf(q) !== -1) { out.push(namesList[i]); }
            }
            if (out.length === 0) {
                results.innerHTML = '<div class="hs-empty">Ничего не найдено</div>';
            } else {
                results.innerHTML = out.map(function (r) {
                    return '<button type="button" class="hs-item" data-code="' + r[0] + '">' +
                        '<b>' + r[0] + '</b><span>' + escapeHtml(r[1]) + '</span></button>';
                }).join('');
            }
            results.hidden = false;
        }

        function addCode(code) {
            var cur = codesInput.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
            if (cur.indexOf(code) === -1) { cur.push(code); }
            codesInput.value = cur.join(', ');
            results.hidden = true;
            input.value = '';
        }

        input.addEventListener('focus', loadNames);
        input.addEventListener('input', function () {
            loadNames();
            clearTimeout(timer);
            timer = setTimeout(function () { render(input.value); }, 150);
        });
        results.addEventListener('click', function (e) {
            var btn = e.target.closest ? e.target.closest('.hs-item') : null;
            if (btn) { addCode(btn.getAttribute('data-code')); }
        });
        document.addEventListener('click', function (e) {
            if (e.target !== input && !results.contains(e.target)) { results.hidden = true; }
        });
    })();

    /* ================================
       Module: Data — World Bank WITS
       ================================
       Мировая торговая статистика Всемирного банка. Годовые объёмы импорта/
       экспорта по товарным разделам (или итог по стране). Как и Comtrade —
       агрегат по кодам ТН ВЭД, без контрагентов (см. isContractorDataAvailable).
       Значения WITS приходят в тыс. USD — приводим к USD, как в остальном
       приложении. Запросы идут через прокси wits.php (белый список, кэш). */

    var WITS_PROXY_URL = 'wits.php';
    var WITS_COUNTRIES_URL = 'data/wits_countries.json';
    var WITS_REGIONS_URL = 'data/wits_regions.json';
    var LS_WITS_COUNTRIES_KEY = 'delomant_wits_countries';

    // Репортёров шлём пачкой, год — по одному на запрос: WITS даёт 413, если
    // списком идут и репортёры, и годы сразу (см. батчинг в witsLoad).
    var WITS_MAX_REPORTERS = 10;
    var WITS_MIN_YEAR = 1996;
    var WITS_MAX_YEAR = 2021; // покрытие tradestats обычно отстаёт на ~2 года

    var witsCard = document.querySelector('.wits-card');
    var witsForm = witsCard ? witsCard.querySelector('.wits-form') : null;
    var witsToggle = witsCard ? witsCard.querySelector('.wits-toggle') : null;
    var witsCountriesBox = witsCard ? witsCard.querySelector('.wits-countries') : null;
    var witsRegionsBox = witsCard ? witsCard.querySelector('.wits-regions') : null;
    var witsCountrySearch = witsCard ? witsCard.querySelector('.wits-country-search') : null;
    var witsSelectedHint = witsCard ? witsCard.querySelector('.wits-selected-hint') : null;
    var witsPartnerSelect = witsCard ? witsCard.querySelector('.wits-partner') : null;
    var witsDirection = witsCard ? witsCard.querySelector('.wits-direction') : null;
    var witsLevel = witsCard ? witsCard.querySelector('.wits-level') : null;
    var witsYearFrom = witsCard ? witsCard.querySelector('.wits-year-from') : null;
    var witsYearTo = witsCard ? witsCard.querySelector('.wits-year-to') : null;
    var witsStatus = witsCard ? witsCard.querySelector('.wits-status') : null;
    var witsLoadBtn = witsCard ? witsCard.querySelector('.wits-load-btn') : null;
    var witsMode = witsCard ? witsCard.querySelector('.wits-mode') : null;
    var witsTariffType = witsCard ? witsCard.querySelector('.wits-tariff-type') : null;
    var witsTariffResults = witsCard ? witsCard.querySelector('.wits-tariff-results') : null;
    var witsTariffExportBtn = witsCard ? witsCard.querySelector('.wits-tariff-export-btn') : null;
    var witsTradeExportBtn = witsCard ? witsCard.querySelector('.wits-trade-export-btn') : null;

    var witsCountries = [];      // [{iso3, code, name, reporter}]
    var witsRegions = [];        // [{group, name, codes:[iso3]}]
    var witsSelected = {};       // iso3 → true
    var witsTariffRows = [];     // последняя выгрузка тарифов для экспорта в Excel
    var witsTradeExport = null;  // {rows, headers, name} последней загрузки торговли

    function loadWitsCountries() {
        if (witsCountries.length > 0) { return Promise.resolve(witsCountries); }
        try {
            var cached = localStorage.getItem(LS_WITS_COUNTRIES_KEY);
            if (cached) {
                witsCountries = JSON.parse(cached);
                if (witsCountries.length > 0) { return Promise.resolve(witsCountries); }
            }
        } catch (e) { /* ignore */ }

        return fetch(WITS_COUNTRIES_URL)
            .then(function (resp) { if (!resp.ok) { throw new Error(resp.status); } return resp.json(); })
            .then(function (json) {
                witsCountries = Array.isArray(json) ? json : [];
                try { localStorage.setItem(LS_WITS_COUNTRIES_KEY, JSON.stringify(witsCountries)); } catch (e) { /* ignore */ }
                return witsCountries;
            })
            .catch(function () { witsCountries = []; return witsCountries; });
    }

    function loadWitsRegions() {
        if (witsRegions.length > 0) { return Promise.resolve(witsRegions); }
        return fetch(WITS_REGIONS_URL)
            .then(function (resp) { return resp.ok ? resp.json() : []; })
            .then(function (json) { witsRegions = Array.isArray(json) ? json : []; return witsRegions; })
            .catch(function () { witsRegions = []; return witsRegions; });
    }

    /* Коды региона, оставляя только известные страны-репортёры справочника. */
    function witsRegionCodes(region) {
        var known = {};
        witsCountries.forEach(function (c) { if (c.reporter) { known[c.iso3] = true; } });
        return region.codes.filter(function (code) { return known[code]; });
    }

    /* Регион отмечен целиком, частично или совсем не отмечен. */
    function witsRegionState(region) {
        var codes = witsRegionCodes(region);
        if (codes.length === 0) { return 'none'; }
        var picked = codes.filter(function (code) { return witsSelected[code]; }).length;
        if (picked === 0) { return 'none'; }
        return picked === codes.length ? 'all' : 'some';
    }

    function renderWitsRegions() {
        if (!witsRegionsBox) { return; }
        var html = '';
        var lastGroup = '';
        witsRegions.forEach(function (region, idx) {
            if (region.group !== lastGroup) {
                html += '<span class="comtrade-region-group">' + region.group + '</span>';
                lastGroup = region.group;
            }
            var state = witsRegionState(region);
            html += '<button type="button" class="comtrade-region comtrade-region-' + state + '"' +
                ' data-region="' + idx + '" aria-pressed="' + (state === 'all') + '">' +
                region.name + '</button>';
        });
        witsRegionsBox.innerHTML = html;
    }

    /*
     * Клик по региону: отмечен целиком — снимаем, иначе дожимаем до полного.
     * Частичный доотмечается, а не сбрасывается, — чтобы не стереть страны,
     * выбранные вручную.
     */
    function toggleWitsRegion(idx) {
        var region = witsRegions[idx];
        if (!region) { return; }
        var codes = witsRegionCodes(region);
        var turnOff = witsRegionState(region) === 'all';
        codes.forEach(function (code) {
            if (turnOff) { delete witsSelected[code]; }
            else { witsSelected[code] = true; }
        });
    }

    function setWitsStatus(text, kind) {
        if (!witsStatus) { return; }
        witsStatus.textContent = text || '';
        witsStatus.className = 'comtrade-status wits-status' + (kind ? ' comtrade-status-' + kind : '');
    }

    function renderWitsCountries(filter) {
        if (!witsCountriesBox) { return; }
        var q = (filter || '').trim().toLowerCase();
        var list = witsCountries.filter(function (c) {
            if (!c.reporter) { return false; } // отбираем только страны-репортёры
            return !q || c.name.toLowerCase().indexOf(q) !== -1 || c.iso3.toLowerCase().indexOf(q) !== -1;
        });
        if (list.length === 0) {
            witsCountriesBox.innerHTML = '<span class="comtrade-empty">Ничего не найдено</span>';
            return;
        }
        var html = '';
        list.forEach(function (c) {
            var checked = witsSelected[c.iso3] ? ' checked' : '';
            html += '<label class="comtrade-country">' +
                '<input type="checkbox" value="' + c.iso3 + '"' + checked + '>' +
                '<span>' + c.name + '</span></label>';
        });
        witsCountriesBox.innerHTML = html;
    }

    function updateWitsSelectedHint() {
        if (!witsSelectedHint) { return; }
        var n = Object.keys(witsSelected).filter(function (k) { return witsSelected[k]; }).length;
        witsSelectedHint.textContent = n === 0
            ? 'Не выбрано ни одной страны'
            : 'Выбрано стран: ' + n;
    }

    function fillWitsPartners() {
        if (!witsPartnerSelect) { return; }
        // «Весь мир» уже в разметке; досыпаем страны справочника как партнёров
        var frag = document.createDocumentFragment();
        witsCountries.forEach(function (c) {
            var opt = document.createElement('option');
            opt.value = c.iso3;
            opt.textContent = c.name;
            frag.appendChild(opt);
        });
        witsPartnerSelect.appendChild(frag);
    }

    function collectWitsParams() {
        var reporters = Object.keys(witsSelected).filter(function (k) { return witsSelected[k]; });
        if (reporters.length === 0) {
            setWitsStatus('Выберите хотя бы одну страну-репортёра.', 'error');
            return null;
        }
        var yFrom = parseInt(witsYearFrom && witsYearFrom.value, 10);
        var yTo = parseInt(witsYearTo && witsYearTo.value, 10);
        if (isNaN(yFrom) || isNaN(yTo) || yFrom > yTo) {
            setWitsStatus('Проверьте диапазон лет.', 'error');
            return null;
        }
        yFrom = Math.max(yFrom, WITS_MIN_YEAR);
        yTo = Math.min(yTo, WITS_MAX_YEAR);
        var years = [];
        for (var y = yFrom; y <= yTo; y++) { years.push(String(y)); }

        var partner = (witsPartnerSelect && witsPartnerSelect.value) || 'wld';
        // Партнёр не может совпадать с единственным репортёром — WITS вернёт пусто
        return {
            mode: (witsMode && witsMode.value) || 'trade',
            direction: (witsDirection && witsDirection.value) || 'import',
            tariffType: (witsTariffType && witsTariffType.value) || 'MFN-SMPL-AVRG',
            reporters: reporters,
            partner: partner,
            product: (witsLevel && witsLevel.value) || 'all',
            years: years,
        };
    }

    /*
     * Русские названия 16 товарных разделов ТН ВЭД (коды WITS вида
     * «01-05_Animal»). WITS в ответе product=all мешает три классификации:
     * эти разделы, альтернативные группировки UNCTAD (AgrRaw, Food, manuf…)
     * и строку Total. Оставляем только разделы (witsIsHsSection), чтобы суммы
     * не задваивались, и подписываем их по-русски.
     */
    var WITS_SECTION_RU = {
        '01-05_Animal':     'Живые животные и продукты животного происхождения',
        '06-15_Vegetable':  'Продукты растительного происхождения',
        '16-24_FoodProd':   'Готовые пищевые продукты, напитки, табак',
        '25-26_Minerals':   'Минеральные продукты (руды, соль, камень)',
        '27-27_Fuels':      'Минеральное топливо, нефть, газ',
        '28-38_Chemicals':  'Продукция химической промышленности',
        '39-40_PlastiRub':  'Пластмассы и каучук',
        '41-43_HidesSkin':  'Кожа, мех и изделия из них',
        '44-49_Wood':       'Древесина, бумага и изделия из них',
        '50-63_TextCloth':  'Текстиль и текстильные изделия',
        '64-67_Footwear':   'Обувь, головные уборы, зонты',
        '68-71_StoneGlas':  'Камень, керамика, стекло, драгоценности',
        '72-83_Metals':     'Недрагоценные металлы и изделия из них',
        '84-85_MachElec':   'Машины, оборудование и электроника',
        '86-89_Transport':  'Транспортные средства',
        '90-99_Miscellan':  'Приборы, оружие, прочие товары',
    };

    /* Настоящий раздел ТН ВЭД (а не альтернативная группировка/итог). */
    function witsIsHsSection(code) {
        return Object.prototype.hasOwnProperty.call(WITS_SECTION_RU, code);
    }

    function witsProductLabel(code) {
        if (!code || code === 'Total') { return 'Все товары'; }
        if (WITS_SECTION_RU[code]) {
            return WITS_SECTION_RU[code] + ' (' + code.split('_')[0] + ')';
        }
        return String(code).replace(/_/g, ' ');
    }

    function witsToRows(records, params) {
        var byIso = {};
        witsCountries.forEach(function (c) { byIso[c.iso3] = c.name; });

        var isImport = params.direction === 'import';
        var countryCol = isImport ? 'Страна отправления' : 'Страна назначения';
        var headers = [COL_DATE_REG, COL_YEAR, COL_DIRECTION, countryCol, COL_HS_CODE, COL_STAT_USD];

        var wantSections = params.product === 'all';

        var rows = [];
        records.forEach(function (r) {
            if (r.value == null) { return; }
            // В режиме разделов берём только 16 разделов ТН ВЭД, отбрасывая
            // альтернативные группировки UNCTAD и строку Total — иначе суммы
            // задваиваются. В режиме «Итог по стране» оставляем Total.
            if (wantSections && !witsIsHsSection(r.product)) { return; }
            var year = parseInt(r.year, 10);
            if (isNaN(year)) { return; }
            var row = {};
            row[COL_DATE_REG] = year + '-01-01';
            row[COL_YEAR] = year;
            row[COL_DIRECTION] = isImport ? 'ИМ' : 'ЭК';
            row[countryCol] = byIso[r.reporter] || r.reporter;
            row[COL_HS_CODE] = witsProductLabel(r.product);
            // WITS отдаёт стоимость в тыс. USD — приводим к USD, как везде в приложении
            row[COL_STAT_USD] = Math.round(r.value * 1000 * 100) / 100;
            rows.push(row);
        });
        return { headers: headers, rows: rows };
    }

    function witsFetchBatch(batch, params) {
        var isTariff = params.mode === 'tariff';
        var datasource = isTariff ? 'tradestats-tariff' : 'tradestats-trade';
        var indicator = isTariff
            ? params.tariffType
            : (params.direction === 'import' ? 'MPRT-TRD-VL' : 'XPRT-TRD-VL');
        var query = 'datasource=' + datasource +
            '&reporter=' + encodeURIComponent(batch.reporters.join(',')) +
            '&partner=' + encodeURIComponent(params.partner) +
            '&year=' + encodeURIComponent(batch.years.join(',')) +
            '&product=' + encodeURIComponent(params.product) +
            '&indicator=' + encodeURIComponent(indicator);

        return fetch(WITS_PROXY_URL + '?' + query)
            .then(function (resp) {
                return resp.json().then(function (body) {
                    if (!resp.ok) { throw new Error(body && body.error ? body.error : ('WITS ' + resp.status)); }
                    return body;
                });
            })
            .then(function (body) { return (body && body.data) || []; });
    }

    function witsLoad() {
        var params = collectWitsParams();
        if (!params) { return; }

        clearWitsTariffs();
        clearWitsTradeExport();

        /*
         * WITS отдаёт 413, если в одном запросе списком идут И репортёры, И
         * годы одновременно (проверено: 2×2 уже валится, а 20×1 и 1×15 — ок).
         * Поэтому берём по одному году на запрос, а репортёров — пачкой.
         */
        var batches = [];
        params.years.forEach(function (year) {
            comtradeChunk(params.reporters, WITS_MAX_REPORTERS).forEach(function (reporters) {
                batches.push({ years: [year], reporters: reporters });
            });
        });

        witsLoadBtn.disabled = true;
        setWitsStatus('Загрузка из WITS… (запросов: ' + batches.length + ')', 'progress');
        // Длинный период × много стран — это десятки запросов с паузой. Предупредим.
        if (batches.length > 25 &&
            !confirm('Потребуется ' + batches.length + ' запросов к WITS (примерно ' +
                     Math.ceil(batches.length * 1.2 / 60) + ' мин). Продолжить?')) {
            witsLoadBtn.disabled = false;
            setWitsStatus('Отменено. Сузьте период или число стран.', 'warn');
            return;
        }

        var collected = [];
        var chain = Promise.resolve();
        batches.forEach(function (batch, i) {
            chain = chain.then(function () {
                setWitsStatus('Загрузка из WITS… ' + (i + 1) + ' из ' + batches.length, 'progress');
                return witsFetchBatch(batch, params).then(function (data) {
                    collected = collected.concat(data);
                });
            });
        });

        chain.then(function () {
            if (collected.length === 0) {
                setWitsStatus('WITS не вернул данных по этому запросу. Проверьте страны, партнёра и период.', 'error');
                return;
            }

            // Тарифы — это ставки в %, а не объёмы: их нельзя класть в общий
            // набор для анализа (там стоимость USD). Показываем отдельной
            // таблицей прямо в карточке и даём выгрузку.
            if (params.mode === 'tariff') {
                renderWitsTariffs(collected, params);
                return;
            }

            var parsed = witsToRows(collected, params);
            if (parsed.rows.length === 0) {
                setWitsStatus('Данные получены, но пусты после обработки.', 'error');
                return;
            }

            var flowWord = params.direction === 'import' ? 'импорт' : 'экспорт';
            var isWorld = String(params.partner).toLowerCase() === 'wld';
            var partnerName = isWorld ? 'весь мир'
                : (witsCountries.reduce(function (acc, c) { return c.iso3 === params.partner ? c.name : acc; }, params.partner));
            var yFrom = params.years[0], yTo = params.years[params.years.length - 1];
            var label = 'World Bank WITS — ' + flowWord + ' (' + partnerName + '), ' + yFrom + '–' + yTo;

            applyParsedData({ name: label }, parsed, 'wits');
            appState.sourceNote = 'Источник: World Bank WITS (tradestats-trade), ' +
                'торговля ' + (isWorld ? 'со всем миром' : 'с: ' + partnerName) +
                '. Годовые агрегаты в USD по крупным товарным разделам ТН ВЭД, без веса.';

            // Запоминаем загруженное для отдельной кнопки «Скачать данные»
            witsTradeExport = { rows: parsed.rows, headers: parsed.headers, name: label };
            if (witsTradeExportBtn) { witsTradeExportBtn.hidden = false; }

            setWitsStatus('Загружено ' + formatNumber(parsed.rows.length) + ' строк.', 'ok');
        }).catch(function (err) {
            setWitsStatus(err.message || 'Не удалось загрузить данные из WITS', 'error');
        }).then(function () {
            witsLoadBtn.disabled = false;
        });
    }

    var WITS_TARIFF_NAMES = {
        'MFN-SMPL-AVRG': 'РНБ, простая средняя',
        'MFN-WGHTD-AVRG': 'РНБ, взвешенная',
        'AHS-SMPL-AVRG': 'Фактическая, простая средняя',
        'AHS-WGHTD-AVRG': 'Фактическая, взвешенная',
    };

    var WITS_TARIFF_COLS = ['Страна', 'Товар', 'Год', 'Ставка, %'];

    function renderWitsTariffs(records, params) {
        var byIso = {};
        witsCountries.forEach(function (c) { byIso[c.iso3] = c.name; });

        var wantSections = params.product === 'all';

        var rows = [];
        records.forEach(function (r) {
            if (r.value == null) { return; }
            if (wantSections && !witsIsHsSection(r.product)) { return; }
            var row = {};
            row['Страна'] = byIso[r.reporter] || r.reporter;
            row['Товар'] = witsProductLabel(r.product);
            row['Год'] = parseInt(r.year, 10);
            row['Ставка, %'] = Math.round(r.value * 100) / 100;
            rows.push(row);
        });

        rows.sort(function (a, b) {
            return a['Страна'].localeCompare(b['Страна'], 'ru') ||
                a['Товар'].localeCompare(b['Товар'], 'ru') ||
                a['Год'] - b['Год'];
        });

        witsTariffRows = rows;

        if (rows.length === 0) {
            setWitsStatus('Тарифы не найдены по этому запросу.', 'error');
            return;
        }

        var html = '<table class="wits-tariff-table"><thead><tr>';
        WITS_TARIFF_COLS.forEach(function (h) { html += '<th>' + h + '</th>'; });
        html += '</tr></thead><tbody>';
        rows.forEach(function (row) {
            html += '<tr>' +
                '<td>' + row['Страна'] + '</td>' +
                '<td>' + row['Товар'] + '</td>' +
                '<td>' + row['Год'] + '</td>' +
                '<td class="wits-tariff-rate">' + formatNumber(row['Ставка, %']) + '</td>' +
                '</tr>';
        });
        html += '</tbody></table>';

        if (witsTariffResults) {
            witsTariffResults.innerHTML = html;
            witsTariffResults.hidden = false;
        }
        if (witsTariffExportBtn) { witsTariffExportBtn.hidden = false; }

        var tName = WITS_TARIFF_NAMES[params.tariffType] || params.tariffType;
        setWitsStatus('Тарифы (' + tName + '): ' + formatNumber(rows.length) + ' строк.', 'ok');
    }

    function downloadWitsTariffs() {
        if (witsTariffRows.length === 0) { return; }
        downloadXlsxData(witsTariffRows, WITS_TARIFF_COLS, 'Тарифы WITS', 'Тарифы WITS');
    }

    function downloadWitsTrade() {
        if (!witsTradeExport) { return; }
        downloadXlsxData(witsTradeExport.rows, witsTradeExport.headers, 'WITS', witsTradeExport.name);
    }

    /* Скрыть выдачу тарифов и загруженной торговли — при смене режима/новой загрузке */
    function clearWitsTariffs() {
        witsTariffRows = [];
        if (witsTariffResults) { witsTariffResults.hidden = true; witsTariffResults.innerHTML = ''; }
        if (witsTariffExportBtn) { witsTariffExportBtn.hidden = true; }
    }

    function clearWitsTradeExport() {
        witsTradeExport = null;
        if (witsTradeExportBtn) { witsTradeExportBtn.hidden = true; }
    }

    function updateWitsMode() {
        var isTariff = witsMode && witsMode.value === 'tariff';
        witsCard.querySelectorAll('.wits-only-trade').forEach(function (el) { el.hidden = isTariff; });
        witsCard.querySelectorAll('.wits-only-tariff').forEach(function (el) { el.hidden = !isTariff; });
        clearWitsTariffs();
        clearWitsTradeExport();
        setWitsStatus('', '');
    }

    if (witsMode) {
        witsMode.addEventListener('change', updateWitsMode);
    }

    if (witsTariffExportBtn) {
        witsTariffExportBtn.addEventListener('click', downloadWitsTariffs);
    }

    if (witsTradeExportBtn) {
        witsTradeExportBtn.addEventListener('click', downloadWitsTrade);
    }

    if (witsToggle) {
        witsToggle.addEventListener('click', function () {
            var opened = !witsForm.hidden;
            witsForm.hidden = opened;
            witsToggle.setAttribute('aria-expanded', String(!opened));
            witsToggle.textContent = opened ? 'Открыть' : 'Свернуть';
            if (!opened && witsCountries.length === 0) {
                // Регионы ссылаются на коды стран, поэтому ждём оба справочника
                Promise.all([loadWitsCountries(), loadWitsRegions()]).then(function () {
                    renderWitsCountries('');
                    renderWitsRegions();
                    fillWitsPartners();
                    updateWitsSelectedHint();
                });
            }
        });
    }

    if (witsCountrySearch) {
        witsCountrySearch.addEventListener('input', function () { renderWitsCountries(this.value); });
    }

    if (witsCountriesBox) {
        witsCountriesBox.addEventListener('change', function (e) {
            if (e.target.type !== 'checkbox') { return; }
            witsSelected[e.target.value] = e.target.checked;
            renderWitsRegions();   // регион мог стать полным/неполным
            updateWitsSelectedHint();
        });
    }

    if (witsRegionsBox) {
        witsRegionsBox.addEventListener('click', function (e) {
            var btn = e.target.closest ? e.target.closest('.comtrade-region') : null;
            if (!btn) { return; }
            toggleWitsRegion(parseInt(btn.getAttribute('data-region'), 10));
            renderWitsCountries(witsCountrySearch ? witsCountrySearch.value : '');
            renderWitsRegions();
            updateWitsSelectedHint();
        });
    }

    var witsResetBtn = document.querySelector('.wits-reset-btn');
    if (witsResetBtn) {
        witsResetBtn.addEventListener('click', function () {
            witsSelected = {};
            renderWitsCountries(witsCountrySearch ? witsCountrySearch.value : '');
            renderWitsRegions();
            updateWitsSelectedHint();
        });
    }

    if (witsLoadBtn) {
        witsLoadBtn.addEventListener('click', witsLoad);
    }

    /* ================================
       Module: Processing — Columns
       ================================ */
    var columnsList = document.querySelector('.columns-list');
    var columnsHint = document.querySelector('.columns-hint');
    var columnsSelectAll = document.querySelector('.columns-select-all');
    var columnsDeselectAll = document.querySelector('.columns-deselect-all');
    var columnsBriefBtn = document.querySelector('.columns-brief-btn');
    var columnsToggleBtn = document.querySelector('.columns-toggle-btn');

    function renderColumnsList() {
        if (!columnsList) { return; }
        if (appState.headers.length === 0) {
            columnsList.innerHTML = '';
            if (columnsHint) { columnsHint.style.display = ''; }
            return;
        }

        if (columnsHint) { columnsHint.style.display = 'none'; }

        var html = '';
        appState.headers.forEach(function (h) {
            html += '<label class="column-chip">' +
                '<input type="checkbox" class="column-checkbox" value="' + h + '" checked>' +
                '<span>' + h + '</span>' +
                '</label>';
        });
        columnsList.innerHTML = html;
        columnsList.classList.remove('expanded');

        if (columnsToggleBtn) {
            setTimeout(function () {
                if (columnsList.scrollHeight > columnsList.clientHeight + 10) {
                    columnsToggleBtn.style.display = '';
                    columnsToggleBtn.textContent = 'Показать все ▼';
                } else {
                    columnsToggleBtn.style.display = 'none';
                }
            }, 0);
        }

        columnsList.querySelectorAll('.column-checkbox').forEach(function (cb) {
            cb.addEventListener('change', function () {
                this.closest('.column-chip').classList.toggle('unchecked', !this.checked);
            });
        });
    }

    if (columnsToggleBtn) {
        columnsToggleBtn.addEventListener('click', function () {
            var expanded = columnsList.classList.toggle('expanded');
            columnsToggleBtn.textContent = expanded ? 'Свернуть ▲' : 'Показать все ▼';
        });
    }

    function getSelectedColumns() {
        var selected = [];
        columnsList.querySelectorAll('.column-checkbox').forEach(function (cb) {
            if (cb.checked) { selected.push(cb.value); }
        });
        return selected;
    }

    if (columnsSelectAll) {
        columnsSelectAll.addEventListener('click', function () {
            columnsList.querySelectorAll('.column-checkbox').forEach(function (cb) {
                cb.checked = true;
                cb.closest('.column-chip').classList.remove('unchecked');
            });
        });
    }

    if (columnsDeselectAll) {
        columnsDeselectAll.addEventListener('click', function () {
            columnsList.querySelectorAll('.column-checkbox').forEach(function (cb) {
                cb.checked = false;
                cb.closest('.column-chip').classList.add('unchecked');
            });
        });
    }

    function getBriefColumnMatches(headers) {
        var selected = [];
        BRIEF_PROCESSING_COLUMNS.forEach(function (aliases) {
            aliases.forEach(function (alias) {
                if (headers.indexOf(alias) !== -1 && selected.indexOf(alias) === -1) {
                    selected.push(alias);
                }
            });
        });
        return selected;
    }

    function applyColumnsSelection(cols) {
        if (!columnsList) { return; }
        columnsList.querySelectorAll('.column-checkbox').forEach(function (cb) {
            var selected = cols.indexOf(cb.value) !== -1;
            cb.checked = selected;
            cb.closest('.column-chip').classList.toggle('unchecked', !selected);
        });
    }

    if (columnsBriefBtn) {
        columnsBriefBtn.addEventListener('click', function () {
            applyColumnsSelection(getBriefColumnMatches(appState.headers));
        });
    }

    /* ================================
       Module: Processing — Column Templates
       ================================ */
    var TEMPLATES_KEY = 'delomant_col_templates';
    var templateSelect = document.querySelector('.template-select');
    var templateNameInput = document.querySelector('.template-name-input');
    var templateSaveBtn = document.querySelector('.template-save-btn');
    var templateLoadBtn = document.querySelector('.template-load-btn');
    var templateDeleteBtn = document.querySelector('.template-delete-btn');

    function loadTemplates() {
        try {
            return JSON.parse(localStorage.getItem(TEMPLATES_KEY)) || {};
        } catch (e) {
            return {};
        }
    }

    function saveTemplates(templates) {
        localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
    }

    function renderTemplateSelect() {
        if (!templateSelect) { return; }
        var templates = loadTemplates();
        var names = Object.keys(templates);
        var html = '<option value="">Шаблон...</option>';
        names.forEach(function (name) {
            html += '<option value="' + name + '">' + name + '</option>';
        });
        templateSelect.innerHTML = html;
    }

    if (templateSaveBtn) {
        templateSaveBtn.addEventListener('click', function () {
            var name = templateNameInput.value.trim();
            if (!name) { return; }

            var selected = getSelectedColumns();
            if (selected.length === 0) { return; }

            var templates = loadTemplates();
            templates[name] = selected;
            saveTemplates(templates);

            templateNameInput.value = '';
            renderTemplateSelect();
            templateSelect.value = name;
        });
    }

    if (templateLoadBtn) {
        templateLoadBtn.addEventListener('click', function () {
            var name = templateSelect.value;
            if (!name) { return; }

            var templates = loadTemplates();
            var cols = templates[name];
            if (!cols) { return; }

            columnsList.querySelectorAll('.column-checkbox').forEach(function (cb) {
                var inTemplate = cols.indexOf(cb.value) !== -1;
                cb.checked = inTemplate;
                cb.closest('.column-chip').classList.toggle('unchecked', !inTemplate);
            });
        });
    }

    if (templateDeleteBtn) {
        templateDeleteBtn.addEventListener('click', function () {
            var name = templateSelect.value;
            if (!name) { return; }

            var templates = loadTemplates();
            delete templates[name];
            saveTemplates(templates);
            renderTemplateSelect();
        });
    }

    renderTemplateSelect();

    /* ================================
       Module: Processing — Operations
       ================================ */
    var applyBtn = document.querySelector('.processing-apply-btn');
    var applyBtnTop = document.querySelector('.processing-apply-btn-top');
    if (applyBtnTop) {
        applyBtnTop.addEventListener('click', function () { applyBtn.click(); });
    }

    function setApplyBtnState(state) {
        // state: 'loading' | 'done' | 'error' | 'idle'
        var btns = [applyBtn, applyBtnTop].filter(Boolean);
        btns.forEach(function (btn) {
            btn.disabled = (state === 'loading');
            btn.classList.remove('btn-apply-done', 'btn-apply-error');
            if (state === 'loading') {
                btn.textContent = 'Обработка...';
            } else if (state === 'done') {
                btn.classList.add('btn-apply-done');
                btn.textContent = '✓ Готово';
                setTimeout(function () {
                    btn.classList.remove('btn-apply-done');
                    btn.textContent = btn === applyBtn ? 'Применить обработку' : 'Применить';
                }, 2500);
            } else if (state === 'error') {
                btn.classList.add('btn-apply-error');
                btn.textContent = '✕ Ошибка';
                setTimeout(function () {
                    btn.classList.remove('btn-apply-error');
                    btn.textContent = btn === applyBtn ? 'Применить обработку' : 'Применить';
                }, 2500);
            } else {
                btn.textContent = btn === applyBtn ? 'Применить обработку' : 'Применить';
            }
        });
    }
    var ratioNumerator = document.querySelector('.ratio-numerator');
    var ratioDenominator = document.querySelector('.ratio-denominator');

    // --- Пользовательский маппинг ---
    var customMappingSub = document.querySelector('.operation-sub-custom-mapping');
    var customMappingList = document.querySelector('.custom-mapping-list');
    var customMappingAddBtn = document.querySelector('.custom-mapping-add-btn');
    var LS_CUSTOM_MAPPING_KEY = 'delomant_custom_mapping';
    var companyDictStatus = document.querySelector('.company-dict-status');
    var companyDictAutosave = document.querySelector('.company-dict-autosave-checkbox');
    var companyDictCollectBtn = document.querySelector('.company-dict-collect-btn');
    var companyDictImportBtn = document.querySelector('.company-dict-import-btn');
    var companyDictExportBtn = document.querySelector('.company-dict-export-btn');
    var companyDictClearBtn = document.querySelector('.company-dict-clear-btn');
    var companyDictImportInput = document.querySelector('.company-dict-import-input');
    var LS_COMPANY_DICTIONARY_KEY = 'delomant_company_dictionary';
    var LS_COMPANY_DICTIONARY_AUTOSAVE = 'delomant_company_dictionary_autosave';
    var COMPANY_DICTIONARY_URL = 'data/company_dictionary.json';
    var companyDictionary = {};
    var companyDictionaryLastAdded = 0;

    // Показ/скрытие панели при клике на чекбокс
    var customMappingCb = document.querySelector('[data-op="custom-mapping"] .operation-checkbox');
    if (customMappingCb) {
        customMappingCb.addEventListener('change', function () {
            if (customMappingSub) {
                customMappingSub.style.display = this.checked ? 'flex' : 'none';
            }
        });
    }

    function addCustomMappingRow(fromCol, toCol) {
        if (!customMappingList) { return; }
        var row = document.createElement('div');
        row.className = 'custom-mapping-row';

        var select = document.createElement('select');
        var headers = appState.headers || [];
        var html = '<option value="">Колонка</option>';
        headers.forEach(function (h) {
            html += '<option value="' + h + '"' + (h === fromCol ? ' selected' : '') + '>' + h + '</option>';
        });
        select.innerHTML = html;

        var arrow = document.createElement('span');
        arrow.className = 'custom-mapping-arrow';
        arrow.textContent = '→';

        var input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Новое название';
        if (toCol) { input.value = toCol; }

        var removeBtn = document.createElement('button');
        removeBtn.className = 'custom-mapping-remove';
        removeBtn.textContent = '✕';
        removeBtn.addEventListener('click', function () {
            row.remove();
        });

        row.appendChild(select);
        row.appendChild(arrow);
        row.appendChild(input);
        row.appendChild(removeBtn);
        customMappingList.appendChild(row);
    }

    if (customMappingAddBtn) {
        customMappingAddBtn.addEventListener('click', function () {
            addCustomMappingRow('', '');
        });
    }

    function updateCustomMappingSelects() {
        if (!customMappingList) { return; }
        var headers = appState.headers || [];
        var rows = customMappingList.querySelectorAll('.custom-mapping-row');
        rows.forEach(function (row) {
            var select = row.querySelector('select');
            var current = select.value;
            var html = '<option value="">Колонка</option>';
            headers.forEach(function (h) {
                html += '<option value="' + h + '"' + (h === current ? ' selected' : '') + '>' + h + '</option>';
            });
            select.innerHTML = html;
        });
    }

    function getCustomMapping() {
        var mapping = {};
        if (!customMappingList) { return mapping; }
        customMappingList.querySelectorAll('.custom-mapping-row').forEach(function (row) {
            var from = row.querySelector('select').value;
            var to = row.querySelector('input').value.trim();
            if (from && to) { mapping[from] = to; }
        });
        return mapping;
    }

    function saveCustomMapping() {
        var mapping = getCustomMapping();
        try { localStorage.setItem(LS_CUSTOM_MAPPING_KEY, JSON.stringify(mapping)); } catch (e) { /* ignore */ }
    }

    function loadCustomMapping() {
        try {
            var saved = localStorage.getItem(LS_CUSTOM_MAPPING_KEY);
            if (saved) {
                var mapping = JSON.parse(saved);
                var keys = Object.keys(mapping);
                if (keys.length > 0) {
                    keys.forEach(function (from) {
                        addCustomMappingRow(from, mapping[from]);
                    });
                }
            }
        } catch (e) { /* ignore */ }
    }

    loadCustomMapping();

    // Маппинг: G## имя из выгрузки → русское имя (точное совпадение, 32 колонки)
    var COLUMN_MAP = {
        // --- Идентификация ---
        'ND (Номер декларации)': 'Номер декларации',
        'ND  Номер  декларации на товары': 'Номер декларации',
        'STAT (STAT)': 'STAT',
        'STAT(Признак учет в стат внешней торговли 1-учит 0-неучит)': 'STAT',
        'STAT Учет в статистике 0/1': 'STAT',
        'G071 (код таможни)': 'Код таможни',
        'G071 (Код таможни, в которую представляется ГТД)': 'Код таможни',
        '071 Таможня оформления ДТ': 'Код таможни',
        'G072 (Дата регистрации)': 'Дата регистрации',
        'G072 (Дата оформления ГТД в АИС декларанта)': 'Дата регистрации',
        '072 Дата ДТ': 'Дата регистрации',
        'G073 (Номер бланка)': 'Номер бланка',
        'G073 (Порядковый номер в АИС брокера/декларанта)': 'Номер бланка',
        '073 Порядковый № ДТ': 'Номер бланка',
        'GD1 (Дата выпуска)': 'Дата выпуска',
        'GD1 (Дата выпуска груза)': 'Дата выпуска',
        'D1 Дата выпуска груза': 'Дата выпуска',
        'G07 (Тип ГТД)': 'Тип ГТД',
        'G07 (вид таможенной декларации)': 'Тип ГТД',
        '07 Особенности декларирования': 'Тип ГТД',
        'G32 (Номер товара по ГТД)': 'Номер товара по ГТД',
        'G32 (номер товара по ГТД / списку)': 'Номер товара по ГТД',
        '32 Номер товара по ДТ': 'Номер товара по ГТД',
        'GD0 (Код завершения таможенного оформления)': 'Код завершения оформления',
        'GD0 (код завершения таможенного оформления)': 'Код завершения оформления',
        'D0 Код завршения таможенного оформления': 'Код завершения оформления',
        'GD2 (ЛНП долж.лица)': 'ЛНП должностного лица',
        'GD2 ЛНП выпускающего инспектора': 'ЛНП должностного лица',
        'Решение о выпуске товара': 'Решение о выпуске товара',
        // --- Направление и режим ---
        'G011 (Направление перемещения)': 'Направление перемещения',
        '011 ИМ/ЭК - направление перемещения': 'Направление перемещения',
        'G0121 (Таможенный режим)': 'Таможенный режим',
        'G012 (код основного таможенного режима)': 'Таможенный режим',
        '012 Основной таможенный режим': 'Таможенный режим',
        'Наименование основного таможенного режима': 'Наименование таможенного режима',
        'G24 (характер сделки)': 'Характер сделки',
        'G37 (Процедура)': 'Процедура',
        'G37 (код таможенной процедуры)': 'Процедура',
        '37 Процедура': 'Процедура',
        'G37_1 (Код предшествующего таможенного режима)': 'Код предшествующего режима',
        'Предшествующий таможенный режим': 'Предшествующий таможенный режим',
        'G37_2 (Код особенности перемещения декларируемых товаров)': 'Код особенности перемещения',
        'Особенность перемещения декларируемых товаров': 'Особенность перемещения',
        'Особенность по уплате таможенных сборов за таможенное оформление': 'Особенность уплаты сборов',
        'Особенность по уплате таможенной пошлины': 'Особенность уплаты пошлины',
        'Особенность по уплате акциза': 'Особенность уплаты акциза',
        'Особенность по уплате налога на добавленную стоимость': 'Особенность уплаты НДС',
        // --- Отправитель ---
        'G021 (ИНН отправителя)': 'ИНН отправителя',
        '021 ИНН отправителя': 'ИНН отправителя',
        'G022 (Наименование отправителя)': 'Наименование отправителя',
        '022 Наименование/ФИО отправителя': 'Наименование отправителя',
        'G023 (Адрес отправителя)': 'Адрес отправителя',
        '023 Адрес отправителя': 'Адрес отправителя',
        'G0231 (Код страны отправителя)': 'Код страны отправителя',
        '0231 Код страны отправителя': 'Код страны отправителя',
        'G024B регион отправителя': 'Регион отправителя',
        '024 ОКАТО отправителя': 'ОКАТО отправителя',
        // --- Получатель ---
        'G081 (ИНН получателя)': 'ИНН получателя',
        '081 ИНН получателя': 'ИНН получателя',
        'G082 (Наименование получателя)': 'Наименование получателя',
        '082 Наименование/ФИО получателя': 'Наименование получателя',
        'G0831 (Код страны получателя)': 'Код страны получателя',
        '0831 Код страны получателя': 'Код страны получателя',
        'G083 (Адрес получателя)': 'Адрес получателя',
        '083 Адрес получателя': 'Адрес получателя',
        'G084B регион получателя': 'Регион получателя',
        '084 ОКАТО получателя': 'ОКАТО получателя',
        // --- Контрактодержатель ---
        'G091 (ИНН контрактодержателя)': 'ИНН контрактодержателя',
        '091 ИНН контрактодержателя': 'ИНН контрактодержателя',
        'G092 (Наименование контрактодержателя)': 'Наименование контрактодержателя',
        '092 Наименование/ФИО контрактодержателя': 'Наименование контрактодержателя',
        'G0931 (Код страны контрактодержателя)': 'Код страны контрактодержателя',
        '0931 Код страны контрактодержателя': 'Код страны контрактодержателя',
        'G093 (Адрес контрактодержателя)': 'Адрес контрактодержателя',
        '093 Адрес контрактодержателя': 'Адрес контрактодержателя',
        'G094B регион контрактодержателя': 'Регион контрактодержателя',
        '094 ОКАТО контрактодержателя': 'ОКАТО контрактодержателя',
        // --- Декларант ---
        'G141 (ИНН декларанта)': 'ИНН декларанта',
        '141 ИНН декларанта': 'ИНН декларанта',
        'G142 (Наименование декларанта)': 'Наименование декларанта',
        '142 Наименование/ФИО декларанта': 'Наименование декларанта',
        'G1431 (Код страны нахождения декларанта)': 'Код страны декларанта',
        '1431 Код страны декларанта': 'Код страны декларанта',
        'G143 (Адрес декларанта)': 'Адрес декларанта',
        '143 Адрес декларанта': 'Адрес декларанта',
        'G144B (Код ОКАТО декларанта)': 'Код ОКАТО декларанта',
        '144 ОКАТО декларанта': 'Код ОКАТО декларанта',
        // --- Брокер ---
        'G541 (Номер свидетельства брокера)': 'Номер свидетельства брокера',
        'G541 (Номер Свидетельства о включении в Реестр таможенных брокеров (представителей))': 'Номер свидетельства брокера',
        'G541D (Дата свидетельства брокера)': 'Дата свидетельства брокера',
        'G541_NAM (Наименование брокера)': 'Наименование брокера',
        'G541_INN (ИНН брокера)': 'ИНН брокера',
        'G541_INN (ИНН таможенного брокера)': 'ИНН брокера',
        'G541_ADR (Адрес и контакты брокера)': 'Адрес брокера',
        'G5411 (Номер договора брокера с декларантом)': 'Номер договора брокера',
        'G5411D (Дата договора брокера с декларантом)': 'Дата договора брокера',
        'G5441 (ФИО заполнителя)': 'ФИО заполнителя',
        'G5441 (ФИО брокера)': 'ФИО заполнителя',
        '5441 ФИО заполнившего ДТ': 'ФИО заполнителя',
        'G5442 (Рабочий телефон там брокера)': 'Телефон брокера',
        'G5447 (Должность работника там брокера)': 'Должность брокера',
        '541 Свидетельство таможенного брокера': 'Номер свидетельства брокера',
        '541_INN ИНН брокера': 'ИНН брокера',
        // --- Страны ---
        'G11 (Код торгующей страны)': 'Код торгующей страны',
        'G11 (Код альфа-2 торгующей страны)': 'Код торгующей страны',
        '11 Торгующая страна': 'Код торгующей страны',
        'G15 (Страна отправления)': 'Страна отправления',
        'G15A (Код страны отправления)': 'Код страны отправления',
        'G15A (код страны отправления)': 'Код страны отправления',
        '15 Код страны отправления': 'Код страны отправления',
        'G16 (Страна происхождения)': 'Страна происхождения',
        '16 Страна происхождения': 'Страна происхождения',
        'G17A (Код страны назначения)': 'Код страны назначения',
        'G17A (код страны назначения)': 'Код страны назначения',
        '17 Код страны назначения': 'Код страны назначения',
        'G17B (Страна назначения)': 'Страна назначения',
        'G31_13 (Страна происхождения)': 'Страна происхождения товара',
        'G31_13 (кр наименование страны происхождения)': 'Страна происхождения товара',
        'G34 (Код страны происхождения)': 'Код страны происхождения',
        'Наименов страны происхожд по списку ГТД': 'Наименование страны происхождения',
        // --- Товар ---
        'G05 (Всего наименований товаров)': 'Всего наименований товаров',
        'G05 (всего наименований товаров)': 'Всего наименований товаров',
        '05 Товаров всего': 'Всего наименований товаров',
        'G06 (Кол-во мест)': 'Кол-во мест',
        'G06 (кол-во мест)': 'Кол-во мест',
        '06 Мест товара всего': 'Кол-во мест',
        'G31_1 (Наименование и характеристики товаров)': 'Наименование и характеристики товаров',
        'G31_1 (Описание и характеристика товара с лицевой стороны ГТД - 256 символов': 'Наименование и характеристики товаров',
        '31_1 Описание и характеристика товара': 'Наименование и характеристики товаров',
        'G31_11 (Фирма-изготовитель)': 'Фирма-изготовитель',
        'G31_11 (Наименование фирмы изготовителя)': 'Фирма-изготовитель',
        '31_11 Наименование фирмы изготовителя': 'Фирма-изготовитель',
        'G31_12 (Товарный знак, патент)': 'Товарный знак',
        'G31_12 (Товарный знак, объект авторского права)': 'Товарный знак',
        '31_12 Товарный знак': 'Товарный знак',
        'G31_2 (Кол-во грузовых мест)': 'Кол-во грузовых мест',
        'G31_2 (кол-во мест товара)': 'Кол-во грузовых мест',
        '31_2 Кол-во мест товара': 'Кол-во грузовых мест',
        'G31_7 (Кол-во товара в доп.ед.)': 'Кол-во в доп. ед.',
        'G31_7 (кол-во товара в дополнительной единице измерения)': 'Кол-во в доп. ед.',
        '31_7 Кол-во товара в доп ед. измерения': 'Кол-во в доп. ед.',
        'G31_71 (Наименование доп.ед.)': 'Наименование доп. ед.',
        'G31_71 (наименование дополнительной единицы измерения)': 'Наименование доп. ед.',
        '31_71 Дополнительная единица': 'Наименование доп. ед.',
        'G31_8 (Кол-во товара во второй ед.изм.)': 'Кол-во во 2-й ед.',
        'G31_8 (Кол-во товара в доп ед измер,отличной от основной)': 'Кол-во во 2-й ед.',
        '31_8 Кол-во товара в доп единице': 'Кол-во во 2-й ед.',
        'G31_81 (Наименование второй ед.изм.)': 'Наименование 2-й ед.',
        'G31_81 (Наимен доп ед измер, отличной от основной)': 'Наименование 2-й ед.',
        '31_81 Дополнительная единица': 'Наименование 2-й ед.',
        'G31_82 (Код второй ед.изм.)': 'Код 2-й ед.',
        'G31_82 (Код доп ед измер, отличной от основной)': 'Код 2-й ед.',
        'G31_9 (Кол-во товара в доп ед измер,отличной от основной и доп)': 'Кол-во в 3-й ед.',
        'G31_91 (Наимен доп ед измер, отличной от основной и доп)': 'Наименование 3-й ед.',
        'G31_92 (Код доп ед измер, отличной от основной и доп)': 'Код 3-й ед.',
        'G33 (Код товара по ТН ВЭД)': 'Код товара по ТН ВЭД',
        'G33 (код товара по ТН ВЭД России)': 'Код товара по ТН ВЭД',
        '33 Код товара по ТН ВЭД РФ': 'Код товара по ТН ВЭД',
        '34 Код страны происхождения': 'Код страны происхождения',
        'G39 (Квота)': 'Квота',
        'G39 (квота)': 'Квота',
        '39 Квота': 'Квота',
        '41А Единица измерения квоты': 'Код доп. ед. изм.',
        // --- Поставка и транспорт ---
        'G032 (Кол-во ТД1/2 или ТД3/4)': 'Кол-во ТД',
        'G04 (общее кол-во листов спецификаций)': 'Кол-во листов спецификаций',
        'G18 (кол-во транспортных средств)': 'Кол-во транспортных средств',
        'G19 (Признак контейнерных перевозок)': 'Контейнерные перевозки',
        'G19 (признак контейнерных перевозок)': 'Контейнерные перевозки',
        '19 Признак контейнерных перевозок 0/1': 'Контейнерные перевозки',
        '18 Кол-во транспорта при отправлении': 'Кол-во транспортных средств',
        '25 Вид транспортного средства': 'Код транспорта на границе',
        '03 Листов ДТ': 'Кол-во ТД',
        'G21 (кол-во транспортных средств на границе)': 'Кол-во ТС на границе',
        'G25 (Код вида транспорта на границе)': 'Код транспорта на границе',
        'Вид транспорта на границе': 'Вид транспорта на границе',
        'G29 (Код таможни на границе)': 'Код таможни на границе',
        'G31_3 (Кол-во контейнеров)': 'Кол-во контейнеров',
        'G202 (Условие поставки)': 'Условие поставки',
        'G202 (Краткий букв код условия поставки)': 'Условие поставки',
        '202 Условие поставки': 'Условие поставки',
        'Условие поставки': 'Условие поставки',
        'G2021 (Пункт поставки товара)': 'Пункт поставки товара',
        'G2021 (пункт поставки товара)': 'Пункт поставки товара',
        '2021 Пункт поставки товара': 'Пункт поставки товара',
        // --- Склад ---
        'G281 (Банковские реквизиты)': 'Банковские реквизиты',
        '28 ОКПО банка/паспорт сделки': 'Банковские реквизиты',
        'G300 (Тип информации)': 'Тип информации',
        'G300 (Тип местонахождения товаров)': 'Тип информации',
        '300 Тип информации': 'Тип информации',
        'Местонахождения товаров': 'Местонахождение товаров',
        'G301 (Свидетельство СВХ)': 'Свидетельство СВХ',
        'G30 (Название станции/склада)': 'Название склада',
        'G30 (Название ж/д станции / СКЛАД ПОЛУЧАТЕЛЯ  )': 'Название склада',
        'G30SUBD (Район склада)': 'Район склада',
        '30SUBD Регион': 'Район склада',
        'G30CITY (Город склада)': 'Город склада',
        '30CITY Населенный пункт': 'Город склада',
        'G30STREET (Улица склада)': 'Улица склада',
        '30STREET Адрес местонахождения товара': 'Улица склада',
        'G3012 (Код там. органа)': 'Код таможенного органа',
        'G3012 (Код таможенного органа, в регионе деятельности которого находится  склад получателя)': 'Код таможенного органа',
        '3012 Таможня в зоне которой склад': 'Код таможенного органа',
        'Наименование таможенного органа, в регионе деятельности которого находится  склад получателя': 'Наименование таможенного органа',
        // --- Стоимость и вес ---
        'G12 (Общая таможенная стоимость по ГТД)': 'Общая таможенная стоимость по ГТД',
        'G12 (Общая таможенная ст-ть по всей ГТД)': 'Общая таможенная стоимость по ГТД',
        '12 Общая таможенная стоимость': 'Общая таможенная стоимость по ГТД',
        'G121 (Цифровой код валюты таможенной стоимости)': 'Код валюты таможенной стоимости',
        'G221 (Букв.код валюты контракта)': 'Код валюты',
        'G221 (Код валюты фактурной стоимости)': 'Код валюты',
        '221 Валюта контракта': 'Код валюты',
        'G222 (Общая фактурная стоимость по ГТД)': 'Общая фактурная стоимость по ГТД',
        'G222 (общая фактурная ст-ть по всей ГТД)': 'Общая фактурная стоимость по ГТД',
        '222 Общая фактурная стоимость': 'Общая фактурная стоимость по ГТД',
        'G23 (Курс валюты)': 'Курс валюты',
        'G23 ( курс валюты)': 'Курс валюты',
        '23 Курс валюты': 'Курс валюты',
        'G230 (Дата курса валюты)': 'Дата курса валюты',
        'Дата курса валюты': 'Дата курса валюты',
        'G35 (Вес брутто, кг)': 'Вес брутто, кг',
        'G35 (Вес брутто (кг))': 'Вес брутто, кг',
        '35 Вес брутто, кг': 'Вес брутто, кг',
        'G38 (Вес нетто, кг)': 'Вес нетто, кг',
        'G38 (Вес нетто (кг))': 'Вес нетто, кг',
        '38 Вес нетто, кг': 'Вес нетто, кг',
        'G41A (Код доп.ед.изм.)': 'Код доп. ед. изм.',
        'G42 (Фактурная стоимость)': 'Фактурная стоимость',
        'G42 (Фактурная стоимость товара)': 'Фактурная стоимость',
        '42 Фактурная стоимость': 'Фактурная стоимость',
        'G42RUB (Фактурная стоимость в рублях)': 'Фактурная стоимость (нац. вал.)',
        'G43 (Признак КТС)': 'Признак КТС',
        'G43 (Признак корректировки таможенной стоимости)': 'Признак КТС',
        '43 Признак корректировки таможенной стоимости (КТС)': 'Признак КТС',
        '431 Метод определения таможенной стоимости': 'Метод определения ТС',
        'Корректировка таможенной стоимости': 'Корректировка таможенной стоимости',
        'G430 (Метод определения ТС)': 'Метод определения ТС',
        'G45 (Таможенная стоимость)': 'Таможенная стоимость',
        'G45 (Таможенная стоимость товара)': 'Таможенная стоимость',
        '45 Таможенная стоимость': 'Таможенная стоимость',
        'G46 (Статистическая стоимость, USD.)': 'Статистическая стоимость, USD',
        'G46 (Статистическая стоимость товара в USD)': 'Статистическая стоимость, USD',
        '46 Статистическая стоимость': 'Статистическая стоимость, USD',
        // --- Расчётные ---
        'USDKG (USD за КГ)': 'USD за КГ',
        'USD/KG (Статистическая стоимость за килограмм)': 'USD за КГ',
        'USD/KG Статистическая стоимость, USD/Вес НЕТТО, кг': 'USD за КГ',
        'FIRM (Доп.информация о контрактодержателе (Росстат))': 'Доп. информация Росстат',
        // --- Источник 4: русские названия без G-кодов ---
        'Учёт в статистике': 'STAT',
        'Учет в статистике': 'STAT',
        'Номер декларации': 'Номер декларации',
        'Таможня оформления': 'Код таможни',
        'Дата ДТ': 'Дата регистрации',
        'Порядковый № ДТ': 'Номер бланка',
        'Особенности декларирования': 'Тип ГТД',
        'Отправитель': 'Наименование отправителя',
        'Адрес отправителя': 'Адрес отправителя',
        'Страна отправителя': 'Код страны отправителя',
        'ОКАТО отправителя': 'ОКАТО отправителя',
        'КПП отправителя': 'КПП отправителя',
        'Листов ДТ': 'Кол-во ТД',
        'Товаров всего': 'Всего наименований товаров',
        'Мест товара': 'Кол-во мест',
        'Получатель': 'Наименование получателя',
        'Адрес получателя': 'Адрес получателя',
        'Страна получателя': 'Код страны получателя',
        'ОКАТО получателя': 'ОКАТО получателя',
        'КПП получателя': 'КПП получателя',
        'ИНН контрактодержателя': 'ИНН контрактодержателя',
        'Контрактодержатель': 'Наименование контрактодержателя',
        'Адрес контрактодержателя': 'Адрес контрактодержателя',
        'Страна контрактодержателя': 'Код страны контрактодержателя',
        'ОКАТО контрактодержателя': 'ОКАТО контрактодержателя',
        'КПП контрактодержателя': 'КПП контрактодержателя',
        'Торгующая страна': 'Код торгующей страны',
        'Общая таможенная стоимость': 'Общая таможенная стоимость по ГТД',
        'ИНН декларанта': 'ИНН декларанта',
        'Декларант': 'Наименование декларанта',
        'Адрес декларанта': 'Адрес декларанта',
        'Страна декларанта': 'Код страны декларанта',
        'ОКАТО декларанта': 'Код ОКАТО декларанта',
        'КПП декларанта': 'КПП декларанта',
        'Кол-во транспорта': 'Кол-во транспортных средств',
        'Контейнер': 'Контейнерные перевозки',
        'Валюта контракта': 'Код валюты',
        'Общая фактурная стоимость': 'Общая фактурная стоимость по ГТД',
        'Фактурная стоимость, RUB': 'Фактурная стоимость (нац. вал.)',
        'Курс валюты': 'Курс валюты',
        'Характер сделки': 'Характер сделки',
        'Транспорт на границе': 'Вид транспорта на границе',
        'Паспорт сделки': 'Банковские реквизиты',
        'Таможня на границе': 'Код таможни на границе',
        'Тип информации': 'Тип информации',
        'Регион': 'Район склада',
        'Населённый пункт': 'Город склада',
        'Населенный пункт': 'Город склада',
        'Адрес склада': 'Улица склада',
        'Таможня склада': 'Код таможенного органа',
        'Описание товара': 'Наименование и характеристики товаров',
        'Производитель': 'Фирма-изготовитель',
        'Кол-во мест': 'Кол-во грузовых мест',
        'Кол-во контейнеров': 'Кол-во контейнеров',
        'Доп. количество': 'Кол-во в доп. ед.',
        'Доп. единица': 'Наименование доп. ед.',
        'Доп. количество 2': 'Кол-во во 2-й ед.',
        'Доп. единица 2': 'Наименование 2-й ед.',
        'Номер товара': 'Номер товара по ГТД',
        'Код товара ТН ВЭД': 'Код товара по ТН ВЭД',
        'Код страны происхождения': 'Код страны происхождения',
        'Вес брутто, кг': 'Вес брутто, кг',
        'Вес нетто, кг': 'Вес нетто, кг',
        'Квота': 'Квота',
        'Единица квоты': 'Код доп. ед. изм.',
        'Признак КТС': 'Признак КТС',
        'Метод тамож. стоимости': 'Метод определения ТС',
        'Стат. стоимость, USD': 'Статистическая стоимость, USD',
        'Код завершения оформления': 'Код завершения оформления',
        'Таможенные платежи, USD': 'Таможенные платежи, USD',
        'Таможенные платежи, RUB': 'Таможенные платежи, RUB',
        'Стат. стоимость / нетто, USD/кг': 'USD за КГ',
        'Свидетельство брокера': 'Номер свидетельства брокера',
        'ИНН брокера': 'ИНН брокера',
        'ФИО заполнившего ДТ': 'ФИО заполнителя',
        'ИНН инспектора': 'ИНН инспектора',
        'Изготовитель': 'Фирма-изготовитель',
        'Описание и характеристика товара': 'Наименование и характеристики товаров',
        'Код валюты цены договора': 'Код валюты',
        'Страна получателя': 'Код страны получателя',
        'Страна происхождения товара': 'Страна происхождения',
        'Таможенный орган': 'Код таможни',
        'Цена за кг (USD)': 'USD за КГ',
        'Дата регистрации ДТ': 'Дата регистрации',
        'Направление (ИМ/ЭК)': 'Направление перемещения',
        'Получатель': 'Наименование получателя',
        'Итоговый адрес отправителя': 'Адрес отправителя',
        'Код ТН ВЭД. Знак звёздочки (*) в конце, если указывается менее 10 знаков.': 'Код товара по ТН ВЭД',
        'Пункт поставки': 'Пункт поставки товара',
        'Условие поставки в соответствии с Incoterms': 'Условие поставки',
        'Код вида таможенной декларации': 'Тип ГТД',
        'Код наличия упаковки товара': 'Кол-во мест',
        'ИНН таможенного брокера': 'ИНН брокера',
        'Дата выдачи Свидетельства о включении в Реестр таможенных брокеров (представителей)': 'Дата свидетельства брокера',
        'Метод определения таможенной стоимости': 'Метод определения ТС',
        'Код завершения таможенного оформления': 'Код завершения оформления',
        'Признак контейнерных перевозок': 'Контейнерные перевозки',
        'Страна декларанта': 'Код страны декларанта',
        'ИНН Декларанта': 'ИНН декларанта',
        'Соотн. нетто-брутто': 'Соотношение нетто-брутто',
        'Признак корректировки таможенной стоимости': 'Признак КТС',
        '№ св-ва брокера': 'Номер свидетельства брокера',
        'Вес нетто': 'Вес нетто, кг',
        'Вес брутто': 'Вес брутто, кг',
        'Статистическая стоимость': 'Статистическая стоимость, USD',
        'Товарный знак': 'Товарный знак',
        'Процедура': 'Процедура',
        'Фактурная стоимость': 'Фактурная стоимость',
        'Таможенная стоимость': 'Таможенная стоимость',
        'Страна отправления': 'Страна отправления',
        'Страна назначения': 'Страна назначения',
        'Страна происхождения': 'Страна происхождения',
        'Код страны отправителя': 'Код страны отправителя',
        'Код торгующей страны': 'Код торгующей страны',
        'Дата выпуска': 'Дата выпуска',
        'Дата курса валюты': 'Дата курса валюты',
        'Адрес получателя': 'Адрес получателя',
        'ИНН получателя': 'ИНН получателя',
        'Регион получателя': 'Регион получателя',
        'Наименование отправителя': 'Наименование отправителя',
        'ИНН отправителя': 'ИНН отправителя',
        'Регион отправителя': 'Регион отправителя',
        'Адрес декларанта': 'Адрес декларанта',
        'Наименование декларанта': 'Наименование декларанта',
        'Наименование контрактодержателя': 'Наименование контрактодержателя',
        'Таможенный режим': 'Таможенный режим'
    };

    function getSelectedOps() {
        var ops = [];
        document.querySelectorAll('.operation-list .operation-item[data-op]').forEach(function (item) {
            var cb = item.querySelector('.operation-checkbox');
            if (cb && cb.checked) {
                ops.push(item.getAttribute('data-op'));
            }
        });
        return ops;
    }

    var opsSelectAll = document.querySelector('.operations-select-all');
    var opsDeselectAll = document.querySelector('.operations-deselect-all');
    if (opsSelectAll) {
        opsSelectAll.addEventListener('click', function () {
            var excludeOps = ['custom-mapping', 'join-lookup', 'usd-per-kg-stat', 'usd-per-kg-invoice', 'rur-per-kg', 'cbr-rate', 'ratio'];
            document.querySelectorAll('.operation-list .operation-item[data-op]').forEach(function (item) {
                var op = item.getAttribute('data-op');
                if (excludeOps.indexOf(op) === -1) {
                    item.querySelector('.operation-checkbox').checked = true;
                }
            });
        });
    }
    if (opsDeselectAll) {
        opsDeselectAll.addEventListener('click', function () {
            document.querySelectorAll('.operation-list .operation-checkbox').forEach(function (cb) { cb.checked = false; });
        });
    }

    // Обновляем select'ы расчёта при загрузке данных
    function updateRatioSelects() {
        if (!ratioNumerator || !ratioDenominator) { return; }
        var headers = appState.headers;
        var html = '<option value="">Выберите столбец</option>';
        headers.forEach(function (h) {
            html += '<option value="' + h + '">' + h + '</option>';
        });
        ratioNumerator.innerHTML = html;
        ratioDenominator.innerHTML = html;

        // Авто-выбор стоимости и веса
        var priceCol = findColumn(headers, COL_CUSTOMS);
        var weightCol = findColumn(headers, COL_WEIGHT);
        if (priceCol) { ratioNumerator.value = priceCol; }
        if (weightCol) { ratioDenominator.value = weightCol; }
    }

    // Поиск колонки по точному имени в массиве headers
    function findColumn(headers, name) {
        return headers.indexOf(name) !== -1 ? name : null;
    }

    // --- Pipeline функции ---

    function normalizeMapHeaderName(name) {
        return String(name || '')
            .replace(/\s*\[гр\.\s*\d+\]\s*$/i, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function autoMapColumns(data, headers) {
        var mapped = [];
        var missing = [];
        var newHeaders = [];
        var normalizedHeaders = {};

        headers.forEach(function (h) {
            var normalized = normalizeMapHeaderName(h);
            if (normalized && !normalizedHeaders[normalized]) {
                normalizedHeaders[normalized] = h;
            }
        });

        // Для каждой записи в COLUMN_MAP ищем точное совпадение или вариант без суффикса "[гр. N]".
        var mapKeys = Object.keys(COLUMN_MAP);
        var usedStd = {}; // дедупликация: не добавлять одно stdName дважды
        mapKeys.forEach(function (origName) {
            var stdName = COLUMN_MAP[origName];
            var headerName = headers.indexOf(origName) !== -1 ? origName : normalizedHeaders[origName];
            if (headerName) {
                if (!usedStd[stdName]) {
                    mapped.push(headerName + ' → ' + stdName);
                    newHeaders.push(stdName);
                    usedStd[stdName] = headerName;
                }
            }
        });

        // Переименовываем и оставляем только найденные колонки
        data = data.map(function (row) {
            var newRow = {};
            // Используем usedStd чтобы брать значение из правильной исходной колонки
            newHeaders.forEach(function (stdName) {
                var origName = usedStd[stdName];
                if (origName) {
                    newRow[stdName] = row[origName];
                }
            });
            return newRow;
        });

        return { data: data, headers: newHeaders, mappings: mapped, missing: missing };
    }

    function applyCustomMapping(data, headers, mapping) {
        var keys = Object.keys(mapping);
        if (keys.length === 0) { return { data: data, headers: headers, count: 0 }; }

        var mapped = [];
        var newHeaders = headers.map(function (h) {
            if (mapping[h]) {
                mapped.push(h + ' → ' + mapping[h]);
                return mapping[h];
            }
            return h;
        });

        data = data.map(function (row) {
            var newRow = {};
            headers.forEach(function (h, i) {
                newRow[newHeaders[i]] = row[h];
            });
            return newRow;
        });

        return { data: data, headers: newHeaders, count: mapped.length, mappings: mapped };
    }

    function trimValues(data, headers) {
        var count = 0;
        data.forEach(function (row) {
            headers.forEach(function (h) {
                if (typeof row[h] === 'string') {
                    var trimmed = row[h].trim();
                    if (trimmed !== row[h]) {
                        row[h] = trimmed;
                        count++;
                    }
                }
            });
        });
        return count;
    }

    function lowercaseText(data, headers) {
        var count = 0;
        var numericCols = getNumericColumns(data, headers);
        headers.forEach(function (h) {
            if (numericCols.indexOf(h) !== -1) { return; }
            data.forEach(function (row) {
                if (typeof row[h] === 'string' && row[h] !== row[h].toLowerCase()) {
                    row[h] = row[h].toLowerCase();
                    count++;
                }
            });
        });
        return count;
    }

    var COMPANY_COLUMNS = [COL_SENDER, COL_RECEIVER, COL_MANUFACTURER];
    var COMPANY_COLUMN_HINTS = [
        'Наименование отправителя',
        'Наименование получателя',
        'Наименование контрактодержателя',
        'Фирма-изготовитель',
        'Изготовитель',
        'Производитель',
        'Отправитель',
        'Получатель',
        'Контрагент',
        'Компания',
        'Company',
        'Sender',
        'Receiver',
        'Manufacturer',
        'Supplier',
        'Importer',
        'Exporter'
    ];
    var COMPANY_COLUMN_SKIP_WORDS = ['АДРЕС', 'ИНН', 'КОД', 'СТРАНА', 'СТРАНЫ', 'ДАТА', 'НОМЕР', 'USD', 'КГ', 'ОКАТО', 'КПП'];
    var COMPANY_ORIGINAL_SUFFIX = ' (оригинал)';
    var EXCLUDED_ORIGINAL_HEADERS = [
        'ОКАТО отправителя (оригинал)',
        'ОКАТО контрактодержателя (оригинал)',
        'ОКАТО получателя (оригинал)'
    ];
    var EXCLUDED_FINAL_HEADERS = EXCLUDED_ORIGINAL_HEADERS.concat([
        'номер бланка',
        'Номер свидетельства брокера',
        'Признак КТС  Метод определения',
        'Код таможенного органа',
        'Тип информации',
        'Банковские реквизиты',
        'Квота',
        'Контейнерные перевозки',
        'Кол-во транспортных средств'
    ]).map(function (name) {
        return String(name || '').trim().toUpperCase();
    });
    var COMPANY_ORGFORMS = [
        ['ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ', 'ООО', 100],
        ['ООО', 'ООО', 90],
        ['OOO', 'ООО', 88],
        ['ОТКРЫТОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО', 'АО', 100],
        ['ОАО', 'АО', 90],
        ['OAO', 'АО', 88],
        ['АКЦИОНЕРНОЕ ОБЩЕСТВО', 'АО', 95],
        ['АО', 'АО', 85],
        ['AO', 'АО', 83],
        ['ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО', 'ПАО', 100],
        ['ПАО', 'ПАО', 90],
        ['PAO', 'ПАО', 88],
        ['ЗАКРЫТОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО', 'ЗАО', 100],
        ['ЗАО', 'ЗАО', 90],
        ['ZAO', 'ЗАО', 88],
        ['ИНДИВИДУАЛЬНЫЙ ПРЕДПРИНИМАТЕЛЬ', 'ИП', 100],
        ['ИП', 'ИП', 90],
        ['IP', 'ИП', 88],
        ['LIMITED LIABILITY COMPANY', 'LLC', 100],
        ['LLC', 'LLC', 90],
        ['JOINT STOCK COMPANY', 'JSC', 100],
        ['JSC', 'JSC', 90],
        ['CORPORATION', 'CORP', 100],
        ['CORP.', 'CORP', 90],
        ['CORP', 'CORP', 80],
        ['COMPANY LIMITED', 'LTD', 100],
        ['CO., LTD.', 'CO., LTD', 100],
        ['CO., LTD', 'CO., LTD', 100],
        ['CO. LTD.', 'CO., LTD', 95],
        ['CO. LTD', 'CO., LTD', 90],
        ['CO LTD', 'CO., LTD', 95],
        ['CO, LTD', 'CO., LTD', 90],
        ['LTD', 'LTD', 80],
        ['INC.', 'INC.', 90],
        ['INC', 'INC.', 80],
        ['B.V.', 'B.V.', 90],
        ['BV', 'B.V.', 70],
        ['SOCIEDAD ANONIMA CERRADA', 'S.A.C.', 100],
        ['S.A.C.', 'S.A.C.', 90],
        ['E.I.R.L.', 'E.I.R.L.', 90],
        ['EIRL', 'E.I.R.L.', 80],
        ['LTDA', 'LTDA', 90],
        ['S/A', 'S/A', 90],
        ['EIRELI', 'EIRELI', 90],
        ['ТОО', 'ТОО', 90],
        ['TOO', 'ТОО', 88]
    ].sort(function (a, b) {
        if (b[2] !== a[2]) { return b[2] - a[2]; }
        return b[0].length - a[0].length;
    });
    var COMPANY_ORGFORM_PATTERNS = null;
    var COMPANY_MARKERS = ['ON BEHALF OF', 'ON BEHALF', 'ПО ПОРУЧЕНИЮ', 'ОТ ИМЕНИ', 'BY ORDER OF'];
    var COMPANY_NAME_TAILS = [
        'PROCESSING IMPORT AND EXPORT',
        'PROCESSING IMPORT-EXPORT',
        'PROCESSING IMPORT EXPORT',
        'IMPORT AND EXPORT',
        'IMPORT-EXPORT'
    ];
    var COMPANY_NAME_MAP = {
        'PHUONG ANH SEAFOOD PROCESSING IMPORT AND EXPORT JOINT STOCK COMPANY': 'PHUONG ANH SEAFOOD, JSC',
        'KIEN CUONG SEAFOOD PROCESSING IMPORT-EXPORT JOINT STOCK COMPANY KIEN CUONG SEAFOOD': 'KIEN CUONG SEAFOOD, JSC',
        'KIEN CUONG SEAFOOD PROCESSING IMPORT EXPORT JOINT STOCK COMPANY KIEN CUONG SEAFOOD': 'KIEN CUONG SEAFOOD, JSC',
        'CAMIMEX JOINT STOCK COMPANY CAMIMEX CORP': 'CAMIMEX CORP, JSC',
        'CAMIMEX JOINT STOCK COMPANY': 'CAMIMEX, JSC',
        'MINH QUI SEAFOOD CO, LTD': 'MINH QUI SEAFOOD, CO., LTD',
        'MINH QUI SEAFOOD CO LTD': 'MINH QUI SEAFOOD, CO., LTD',
        'SEAPRODEX MINH HAI': 'SEAPRODEX MINH HAI',
        'MINH PHU HAU GIANG SEAFOOD CORPORATION': 'MINH PHU HAU GIANG SEAFOOD, CORP',
        'MINH PHU SEAFOOD CORP': 'MINH PHU SEAFOOD, CORP',
        'PHU CUONG-KIEN CUONG CO, LTD': 'PHU CUONG - KIEN CUONG, CO., LTD',
        'PHU CUONG - KIEN CUONG CO, LTD': 'PHU CUONG - KIEN CUONG, CO., LTD',
        'THIENDUC ORNAMENTAL CREATURE CORP': 'THIENDUC ORNAMENTAL CREATURE, CORP',
        'THONG THUAN COMPANY LIMITED': 'THONG THUAN, LTD',
        'ООО ПОЛЛYКС': 'ПОЛЛУКС, ООО',
        'ООО ПОЛЛУКС': 'ПОЛЛУКС, ООО',
        'РЫБОЛОВЕЦКАЯ АРТЕЛЬ КОЛХОЗ ИМ 50 ЛЕТ ОКТЯБРЯ': 'РЫБОЛОВЕЦКАЯ АРТЕЛЬ'
    };
    // Синонимы страны: иногда вместо компании стоит страна ("РОССИЯ" / "РОССИЙСКАЯ ФЕДЕРАЦИЯ")
    // либо она приписана хвостом к названию — считаем это одним значением
    var COMPANY_COUNTRY_ALIASES = {
        'РОССИЙСКАЯ ФЕДЕРАЦИЯ': 'РОССИЯ',
        'РОССИЙСКОЙ ФЕДЕРАЦИИ': 'РОССИЯ',
        'РФ': 'РОССИЯ',
        'RUSSIAN FEDERATION': 'РОССИЯ',
        'RUSSIA': 'РОССИЯ'
    };
    var COMPANY_ADDRESS_CUT_RE = /(,?\s*(ИНН|INN|TIN)\s*[№N:]?\s*\d[\d\s]*)|(,?\s*(АДРЕС|ADDRESS)\s*:?\s*.*)|(,?\s*\d{5,6}\s*,\s*Г\s+.*)/;
    var COMPANY_ABBREVIATIONS = [
        ['ТОРГОВАЯ КОМПАНИЯ', 'ТК'],
        ['ТОРГОВЫЙ ДОМ', 'ТД'],
        ['ТОРГОВО-ПРОИЗВОДСТВЕННАЯ КОМПАНИЯ', 'ТПК'],
        ['ТОРГОВО-ФИНАНСОВАЯ КОМПАНИЯ', 'ТФК'],
        ['ПРОИЗВОДСТВЕННО-ТОРГОВАЯ КОМПАНИЯ', 'ПТК'],
        ['ТРАНСПОРТНО-ЛОГИСТИЧЕСКАЯ КОМПАНИЯ', 'ТЛК'],
        ['ТРАНСПОРТНО-ЭКСПЕДИТОРСКАЯ КОМПАНИЯ', 'ТЭК'],
        ['ПРОИЗВОДСТВЕННАЯ КОМПАНИЯ', 'ПК'],
        ['ПРОИЗВОДСТВЕННАЯ ГРУППА', 'ПГ'],
        ['УПРАВЛЯЮЩАЯ КОМПАНИЯ', 'УК'],
        ['ТРАНСПОРТНЫЕ СИСТЕМЫ', 'ТС']
    ].sort(function (a, b) {
        return b[0].length - a[0].length;
    });

    function cutCompanyAddressInn(text) {
        var match = COMPANY_ADDRESS_CUT_RE.exec(text);
        if (!match || match.index === undefined) { return text; }
        return text.slice(0, match.index).replace(/[,;\s]+$/g, '').trim();
    }

    function isCompanyValueDirty(value) {
        var text = String(value || '');
        if (!text) { return false; }
        if (COMPANY_ADDRESS_CUT_RE.test(text)) { return true; }
        return /\b(ОКАТО|КПП)\b/.test(text);
    }

    function isCompanyAbbrevBoundary(ch) {
        return ch === '' || /[\s,;:"'-]/.test(ch);
    }

    function collapseCompanyAbbreviations(text) {
        var result = text;
        for (var i = 0; i < COMPANY_ABBREVIATIONS.length; i++) {
            var full = COMPANY_ABBREVIATIONS[i][0];
            var idx = result.indexOf(full);
            while (idx !== -1) {
                var before = idx === 0 ? '' : result.charAt(idx - 1);
                var after = idx + full.length >= result.length ? '' : result.charAt(idx + full.length);
                if (isCompanyAbbrevBoundary(before) && isCompanyAbbrevBoundary(after)) {
                    result = result.slice(0, idx) + COMPANY_ABBREVIATIONS[i][1] + result.slice(idx + full.length);
                    idx = result.indexOf(full, idx + COMPANY_ABBREVIATIONS[i][1].length);
                } else {
                    idx = result.indexOf(full, idx + 1);
                }
            }
        }
        return result;
    }

    function normalizeCompanyAlphaNumSpacing(text) {
        return text.replace(/\b([A-Z]{1,6})\s+(\d+)\b/g, function (match, letters, digits) {
            return letters + digits;
        });
    }

    function cleanCompanyText(value) {
        var text = String(value || '').trim().toUpperCase();
        text = text.replace(/Ё/g, 'Е')
            .replace(/[«»“”„]/g, '"')
            .replace(/[‘’]/g, "'")
            .replace(/[–—]/g, '-')
            .replace(/\u00A0/g, ' ');
        text = fixMixedCyrillicLatin(text);
        text = text.replace(/[<>]/g, ' ')
            .replace(/[()]/g, ' ')
            .replace(/["']/g, ' ')
            .replace(/\./g, ' ')
            .replace(/\s*,\s*/g, ', ')
            .replace(/\s*-\s*/g, '-')
            .replace(/\s+/g, ' ')
            .replace(/^[,;\s]+|[,;\s]+$/g, '')
            .trim();
        text = normalizeCompanyAlphaNumSpacing(text);
        return text;
    }

    function fixMixedCyrillicLatin(text) {
        var latinToCyr = {
            A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У'
        };
        var cyrToLatin = {
            'А': 'A', 'В': 'B', 'С': 'C', 'Е': 'E', 'Н': 'H', 'К': 'K', 'М': 'M', 'О': 'O', 'Р': 'P', 'Т': 'T', 'Х': 'X', 'У': 'Y'
        };
        function isLatin(ch) { return /[A-Z]/.test(ch); }
        function isCyr(ch) { return /[А-ЯЁ]/.test(ch); }
        function getStats(token) {
            var stats = { latin: 0, cyr: 0, strongLatin: 0, strongCyr: 0, firstScript: '' };
            for (var i = 0; i < token.length; i++) {
                var ch = token.charAt(i);
                if (isLatin(ch)) {
                    stats.latin++;
                    if (!latinToCyr[ch]) { stats.strongLatin++; }
                    if (!stats.firstScript) { stats.firstScript = 'latin'; }
                } else if (isCyr(ch)) {
                    stats.cyr++;
                    if (!cyrToLatin[ch]) { stats.strongCyr++; }
                    if (!stats.firstScript) { stats.firstScript = 'cyr'; }
                }
            }
            return stats;
        }
        function canConvertToken(token, target) {
            for (var i = 0; i < token.length; i++) {
                var ch = token.charAt(i);
                if (target === 'cyr' && isLatin(ch) && !latinToCyr[ch]) { return false; }
                if (target === 'latin' && isCyr(ch) && !cyrToLatin[ch]) { return false; }
            }
            return true;
        }

        var source = String(text || '');
        var context = getStats(source);
        return source.replace(/[A-ZА-ЯЁ]+/g, function (token) {
            var stats = getStats(token);
            if (!stats.latin || !stats.cyr) { return token; }

            var target = '';
            if (stats.strongCyr && !stats.strongLatin) { target = 'cyr'; }
            else if (stats.strongLatin && !stats.strongCyr) { target = 'latin'; }
            else if (!stats.strongLatin && !stats.strongCyr) {
                if (context.strongCyr && !context.strongLatin) { target = 'cyr'; }
                else if (context.strongLatin && !context.strongCyr) { target = 'latin'; }
                else { target = stats.firstScript || 'cyr'; }
            }
            if (!target) { return token; }
            if (!canConvertToken(token, target)) { return token; }

            return token.split('').map(function (ch) {
                if (target === 'cyr') { return latinToCyr[ch] || ch; }
                return cyrToLatin[ch] || ch;
            }).join('');
        });
    }

    var CYR_TO_LATIN_ALTERNATIVES = {
        'А': ['A'], 'Б': ['B'], 'В': ['V', 'W'], 'Г': ['G'], 'Д': ['D'],
        'Е': ['E', 'YE', 'IE'], 'Ж': ['ZH', 'J'], 'З': ['Z'], 'И': ['I'],
        'Й': ['Y', 'I', 'J'], 'К': ['K', 'C'], 'Л': ['L'], 'М': ['M'], 'Н': ['N'],
        'О': ['O'], 'П': ['P'], 'Р': ['R'], 'С': ['S', 'C'], 'Т': ['T'], 'У': ['U', 'OU'],
        'Ф': ['F'], 'Х': ['KH', 'H', 'X'], 'Ц': ['TS', 'C', 'Z'], 'Ч': ['CH'],
        'Ш': ['SH'], 'Щ': ['SHCH', 'SCH', 'SHCH'], 'Ъ': [''], 'Ы': ['Y', 'I'],
        'Ь': [''], 'Э': ['E'], 'Ю': ['YU', 'IU', 'U'], 'Я': ['YA', 'IA']
    };

    function buildTransliterationRegex(cyrLetters) {
        var pattern = '^';
        for (var i = 0; i < cyrLetters.length; i++) {
            var alts = CYR_TO_LATIN_ALTERNATIVES[cyrLetters.charAt(i)];
            if (!alts) { return null; }
            pattern += '(?:' + alts.join('|') + ')';
        }
        return new RegExp(pattern + '$');
    }

    function companyTransliteratedTokensMatch(cyrToken, latinToken) {
        var cyrLetters = cyrToken.replace(/[^А-ЯЁ]/g, '');
        var latinLetters = latinToken.replace(/[^A-Z]/g, '');
        if (!cyrLetters || !latinLetters) { return false; }
        var re = buildTransliterationRegex(cyrLetters);
        return !!re && re.test(latinLetters);
    }

    function stripLatinTransliterationDuplicate(text) {
        var tokens = text.split(' ').filter(function (t) { return t.length > 0; });
        var cyrTokens = [];
        var i = 0;
        while (i < tokens.length && /[А-ЯЁ]/.test(tokens[i])) {
            cyrTokens.push(tokens[i]);
            i++;
        }
        if (!cyrTokens.length || i >= tokens.length) { return text; }

        var latinTokens = tokens.slice(i).filter(function (t) { return /[A-Z]/.test(t); });
        if (!latinTokens.length || latinTokens.length !== (tokens.length - i)) { return text; }

        var cyrJoined = cyrTokens.join('');
        var latinJoined = latinTokens.join('');
        if (cyrTokens.length === latinTokens.length) {
            var allMatch = true;
            for (var j = 0; j < cyrTokens.length; j++) {
                if (!companyTransliteratedTokensMatch(cyrTokens[j], latinTokens[j])) { allMatch = false; break; }
            }
            if (allMatch) { return cyrTokens.join(' '); }
        }
        if (companyTransliteratedTokensMatch(cyrJoined, latinJoined)) {
            return cyrTokens.join(' ');
        }
        return text;
    }

    function findCompanyColumns(headers) {
        var cols = [];
        var seen = {};
        function add(col) {
            if (col && headers.indexOf(col) !== -1 && !seen[col]) {
                cols.push(col);
                seen[col] = true;
            }
        }
        COMPANY_COLUMNS.forEach(add);
        COMPANY_COLUMN_HINTS.forEach(add);

        headers.forEach(function (h) {
            var upper = String(h || '').toUpperCase();
            if (String(h || '').slice(-COMPANY_ORIGINAL_SUFFIX.length) === COMPANY_ORIGINAL_SUFFIX) { return; }
            var skip = false;
            COMPANY_COLUMN_SKIP_WORDS.forEach(function (word) {
                if (upper.indexOf(word) !== -1) { skip = true; }
            });
            if (skip) { return; }
            if (upper.indexOf('ОТПРАВИТЕЛ') !== -1 ||
                    upper.indexOf('ПОЛУЧАТЕЛ') !== -1 ||
                    upper.indexOf('ИЗГОТОВИТЕЛ') !== -1 ||
                    upper.indexOf('ПРОИЗВОДИТЕЛ') !== -1 ||
                    upper.indexOf('КОНТРАКТОДЕРЖАТЕЛ') !== -1 ||
                    upper.indexOf('КОНТРАГЕНТ') !== -1 ||
                    upper.indexOf('КОМПАН') !== -1 ||
                    upper.indexOf('COMPANY') !== -1 ||
                    upper.indexOf('SENDER') !== -1 ||
                    upper.indexOf('RECEIVER') !== -1 ||
                    upper.indexOf('MANUFACTURER') !== -1 ||
                    upper.indexOf('SUPPLIER') !== -1 ||
                    upper.indexOf('IMPORTER') !== -1 ||
                    upper.indexOf('EXPORTER') !== -1) {
                add(h);
            }
        });
        return cols;
    }

    function getOriginalCompanyColumnName(col) {
        return String(col || '') + COMPANY_ORIGINAL_SUFFIX;
    }

    function ensureAdjacentHeader(headers, sourceCol, adjacentCol) {
        var sourceIdx = headers.indexOf(sourceCol);
        if (sourceIdx === -1) { return; }
        var adjacentIdx = headers.indexOf(adjacentCol);
        if (adjacentIdx !== -1) {
            headers.splice(adjacentIdx, 1);
            if (adjacentIdx < sourceIdx) { sourceIdx--; }
        }
        headers.splice(sourceIdx + 1, 0, adjacentCol);
    }

    function hasCompanyBoundary(text, idx, len) {
        var before = idx === 0 ? ' ' : text.charAt(idx - 1);
        var after = idx + len >= text.length ? ' ' : text.charAt(idx + len);
        return /[\s,;:"']/.test(before) && /[\s,;:"']/.test(after);
    }

    function removeCompanyPhrase(text, phrase) {
        var idx = text.indexOf(phrase);
        while (idx !== -1) {
            if (hasCompanyBoundary(text, idx, phrase.length)) {
                return (text.slice(0, idx) + ' ' + text.slice(idx + phrase.length)).replace(/\s+/g, ' ').trim();
            }
            idx = text.indexOf(phrase, idx + 1);
        }
        return text;
    }

    function extractCompanyOrgform(text) {
        if (!COMPANY_ORGFORM_PATTERNS) {
            COMPANY_ORGFORM_PATTERNS = COMPANY_ORGFORMS.map(function (item) {
                return { pattern: cleanCompanyText(item[0]), orgform: item[1] };
            }).filter(function (item) {
                return !!item.pattern;
            });
        }
        var found = null;
        COMPANY_ORGFORM_PATTERNS.forEach(function (item) {
            if (found) { return; }
            var idx = text.indexOf(item.pattern);
            while (idx !== -1) {
                if (hasCompanyBoundary(text, idx, item.pattern.length)) {
                    found = { pattern: item.pattern, orgform: item.orgform };
                    return;
                }
                idx = text.indexOf(item.pattern, idx + 1);
            }
        });
        return found;
    }

    function stripCompanyMarkers(text) {
        var result = text;
        COMPANY_MARKERS.forEach(function (marker) {
            var cleanMarker = cleanCompanyText(marker);
            var idx = result.indexOf(cleanMarker);
            if (idx !== -1) {
                result = result.slice(0, idx).trim();
            }
        });
        return result;
    }

    function stripCompanyTails(text) {
        var result = text;
        COMPANY_NAME_TAILS.forEach(function (tail) {
            var cleanTail = cleanCompanyText(tail);
            if (result.slice(-cleanTail.length) === cleanTail) {
                result = result.slice(0, result.length - cleanTail.length).trim();
            }
        });
        return result;
    }

    function formatCompanyName(name, orgform) {
        var cleaned = String(name || '')
            .replace(/\s*,\s*/g, ', ')
            .replace(/\s*-\s*/g, '-')
            .replace(/\s+/g, ' ')
            .replace(/^[,;\s]+|[,;\s]+$/g, '')
            .trim();
        if (!cleaned) { return orgform || ''; }
        return orgform ? cleaned + ', ' + orgform : cleaned;
    }

    function getCompanyDictionaryValue(key) {
        var value = companyDictionary[key] || COMPANY_NAME_MAP[key] || '';
        if (value && isCompanyValueDirty(value)) { return ''; }
        return value;
    }

    function sanitizeCompanyCanonicalName(value) {
        return normalizeCompanyNameAuto(String(value || '').trim());
    }

    // Заменяем синоним страны, только если это всё значение целиком
    // или хвост после запятой. Внутри названия не трогаем, иначе пострадают
    // "УПРАВЛЕНИЕ ДЕЛАМИ ПРЕЗИДЕНТА РОССИЙСКОЙ ФЕДЕРАЦИИ" и подобные.
    function applyCompanyCountryAlias(text) {
        if (COMPANY_COUNTRY_ALIASES[text]) { return COMPANY_COUNTRY_ALIASES[text]; }
        var commaIdx = text.lastIndexOf(', ');
        if (commaIdx === -1) { return text; }
        var tailAlias = COMPANY_COUNTRY_ALIASES[text.slice(commaIdx + 2)];
        if (!tailAlias) { return text; }
        return text.slice(0, commaIdx) + ', ' + tailAlias;
    }

    function normalizeCompanyNameAuto(name) {
        var norm = applyCompanyCountryAlias(cleanCompanyText(name));
        if (!norm) { return ''; }

        if (COMPANY_NAME_MAP[norm]) { return COMPANY_NAME_MAP[norm]; }
        norm = stripCompanyMarkers(norm);
        if (COMPANY_NAME_MAP[norm]) { return COMPANY_NAME_MAP[norm]; }

        var org = extractCompanyOrgform(norm);
        var base = org ? removeCompanyPhrase(norm, org.pattern) : norm;
        base = cutCompanyAddressInn(base);
        base = stripCompanyTails(base);
        base = stripLatinTransliterationDuplicate(base);
        base = collapseCompanyAbbreviations(base);
        if (COMPANY_NAME_MAP[base]) { return COMPANY_NAME_MAP[base]; }

        return formatCompanyName(base, org ? org.orgform : '');
    }

    function normalizeCompanyName(name, opts) {
        opts = opts || {};
        var key = cleanCompanyText(name);
        if (!key) { return ''; }
        if (!opts.skipDictionary) {
            var dictValue = getCompanyDictionaryValue(key);
            if (dictValue) { return dictValue; }
        }
        return normalizeCompanyNameAuto(name);
    }

    function companyDictionarySize() {
        return Object.keys(companyDictionary).length;
    }

    function saveCompanyDictionary() {
        try {
            localStorage.setItem(LS_COMPANY_DICTIONARY_KEY, JSON.stringify(companyDictionary));
        } catch (err) {
            console.warn('Company dictionary save error:', err);
        }
        renderCompanyDictionaryStatus();
    }

    function renderCompanyDictionaryStatus(extraText) {
        if (!companyDictStatus) { return; }
        var size = companyDictionarySize();
        companyDictStatus.textContent = 'Словарь компаний: ' + formatNumber(size) + ' записей' + (extraText ? ' · ' + extraText : '');
    }

    function normalizeCompanyDictionaryEntries(payload) {
        var entries = [];
        if (!payload) { return entries; }
        if (Array.isArray(payload)) {
            payload.forEach(function (item) {
                if (!item) { return; }
                if (Array.isArray(item)) {
                    entries.push({ raw_pattern: item[0], canonical_name: item[1] });
                } else {
                    entries.push({
                        raw_pattern: item.raw_pattern || item.pattern || item.raw || item.source || item[0],
                        canonical_name: item.canonical_name || item.normalized || item.canonical || item.target || item[1]
                    });
                }
            });
        } else if (typeof payload === 'object') {
            Object.keys(payload).forEach(function (key) {
                entries.push({ raw_pattern: key, canonical_name: payload[key] });
            });
        }
        return entries;
    }

    function mergeCompanyDictionary(payload, overwrite) {
        var entries = normalizeCompanyDictionaryEntries(payload);
        var added = 0;
        var updated = 0;
        entries.forEach(function (item) {
            var key = cleanCompanyText(item.raw_pattern);
            var value = sanitizeCompanyCanonicalName(item.canonical_name);
            if (!key || !value) { return; }
            if (!companyDictionary[key]) {
                companyDictionary[key] = value;
                added++;
            } else if (overwrite && companyDictionary[key] !== value) {
                companyDictionary[key] = value;
                updated++;
            }
        });
        if (added || updated) { saveCompanyDictionary(); }
        else { renderCompanyDictionaryStatus(); }
        return { added: added, updated: updated };
    }

    function loadCompanyDictionaryFromStorage() {
        try {
            var raw = localStorage.getItem(LS_COMPANY_DICTIONARY_KEY);
            if (!raw) { return; }
            mergeCompanyDictionary(JSON.parse(raw), true);
        } catch (err) {
            console.warn('Company dictionary storage load error:', err);
        }
    }

    function loadCompanyDictionaryFromFile() {
        fetch(COMPANY_DICTIONARY_URL, { cache: 'no-store' })
            .then(function (res) {
                if (!res.ok) { throw new Error('not found'); }
                return res.json();
            })
            .then(function (json) {
                var result = mergeCompanyDictionary(json, false);
                renderCompanyDictionaryStatus(result.added ? 'загружено из data: +' + result.added : '');
            })
            .catch(function () {
                renderCompanyDictionaryStatus();
            });
    }

    function autoAddCompanyDictionaryEntry(rawValue, canonicalName) {
        if (!companyDictAutosave || !companyDictAutosave.checked) { return false; }
        var key = cleanCompanyText(rawValue);
        var value = String(canonicalName || '').trim();
        if (!key || !value || companyDictionary[key] === value || COMPANY_NAME_MAP[key]) { return false; }
        if (!companyDictionary[key] || isCompanyValueDirty(companyDictionary[key])) {
            companyDictionary[key] = value;
            return true;
        }
        return false;
    }

    function getCompanyDictionaryExportRows() {
        return Object.keys(companyDictionary).sort(function (a, b) {
            var va = companyDictionary[a];
            var vb = companyDictionary[b];
            if (va === vb) { return a.localeCompare(b); }
            return va.localeCompare(vb);
        }).map(function (key) {
            return { raw_pattern: key, canonical_name: companyDictionary[key] };
        });
    }

    function exportCompanyDictionary() {
        var rows = getCompanyDictionaryExportRows();
        var json = JSON.stringify(rows, null, 2);
        var blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'company_dictionary.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    }

    function collectCompanyDictionaryFromData(data, headers) {
        var cols = findCompanyColumns(headers);
        var added = 0;
        if (cols.length === 0) { return { added: 0, columns: 0 }; }
        data.forEach(function (row) {
            cols.forEach(function (col) {
                var raw = row[col];
                if (typeof raw !== 'string' || !raw.trim()) { return; }
                var canonical = normalizeCompanyName(raw, { skipDictionary: true });
                var key = cleanCompanyText(raw);
                if (key && canonical && !companyDictionary[key] && !COMPANY_NAME_MAP[key]) {
                    companyDictionary[key] = canonical;
                    added++;
                }
            });
        });
        if (added) { saveCompanyDictionary(); }
        else { renderCompanyDictionaryStatus('новых нет'); }
        return { added: added, columns: cols.length };
    }

    function initializeCompanyDictionary() {
        if (companyDictAutosave) {
            var savedAuto = localStorage.getItem(LS_COMPANY_DICTIONARY_AUTOSAVE);
            if (savedAuto !== null) {
                companyDictAutosave.checked = savedAuto === '1';
            }
            companyDictAutosave.addEventListener('change', function () {
                localStorage.setItem(LS_COMPANY_DICTIONARY_AUTOSAVE, this.checked ? '1' : '0');
            });
        }
        if (companyDictCollectBtn) {
            companyDictCollectBtn.addEventListener('click', function () {
                var result = collectCompanyDictionaryFromData(getActiveData(), getActiveHeaders());
                renderCompanyDictionaryStatus(result.columns ? 'добавлено +' + result.added : 'колонки не найдены');
            });
        }
        if (companyDictExportBtn) {
            companyDictExportBtn.addEventListener('click', exportCompanyDictionary);
        }
        if (companyDictImportBtn && companyDictImportInput) {
            companyDictImportBtn.addEventListener('click', function () { companyDictImportInput.click(); });
            companyDictImportInput.addEventListener('change', function () {
                var file = this.files && this.files[0];
                if (!file) { return; }
                var reader = new FileReader();
                reader.onload = function (e) {
                    try {
                        var result = mergeCompanyDictionary(JSON.parse(e.target.result), true);
                        renderCompanyDictionaryStatus('импорт: +' + result.added + ', обновлено ' + result.updated);
                    } catch (err) {
                        alert('Не удалось импортировать словарь: ' + err.message);
                    }
                    companyDictImportInput.value = '';
                };
                reader.readAsText(file, 'UTF-8');
            });
        }
        if (companyDictClearBtn) {
            companyDictClearBtn.addEventListener('click', function () {
                if (!confirm('Очистить локальный словарь компаний?')) { return; }
                companyDictionary = {};
                saveCompanyDictionary();
            });
        }
        loadCompanyDictionaryFromStorage();
        renderCompanyDictionaryStatus();
        loadCompanyDictionaryFromFile();
    }

    function normalizeCompanyNames(data, headers) {
        var count = 0;
        var addedToDictionary = 0;
        companyDictionaryLastAdded = 0;
        var targetCols = findCompanyColumns(headers);
        if (targetCols.length === 0) { return 0; }
        var originalCols = {};

        targetCols.forEach(function (col) {
            var originalCol = getOriginalCompanyColumnName(col);
            originalCols[col] = originalCol;
            ensureAdjacentHeader(headers, col, originalCol);
        });

        data.forEach(function (row) {
            targetCols.forEach(function (col) {
                var val = row[col];
                var originalCol = originalCols[col];
                row[originalCol] = val === undefined || val === null ? '' : val;
                if (typeof val !== 'string' || !val.trim()) { return; }
                var norm = normalizeCompanyName(val);
                if (autoAddCompanyDictionaryEntry(val, norm)) { addedToDictionary++; }
                if (norm !== val) {
                    row[col] = norm;
                    count++;
                }
            });
        });
        if (addedToDictionary) {
            companyDictionaryLastAdded = addedToDictionary;
            saveCompanyDictionary();
            renderCompanyDictionaryStatus('автодобавлено +' + addedToDictionary);
        }
        return count;
    }

    initializeCompanyDictionary();

    // Нормализация страны происхождения:
    // если "Страна происхождения" пустая или "ПРОЧИЕ/НЕУСТАНОВЛЕННЫЕ" —
    // заполнить из "Код страны отправления" (формат "EC - ЭКВАДОР" → "ЭКВАДОР")
    // или из "Код торгующей страны"
    function normalizeCountryOrigin(data, headers) {
        var originCol = findColumn(headers, 'Страна происхождения');
        var dispatchCol = findColumn(headers, 'Код страны отправления');
        var tradingCol = findColumn(headers, 'Код торгующей страны');
        if (!originCol) { return 0; }
        if (!dispatchCol && !tradingCol) { return 0; }

        var count = 0;
        var EMPTY_VALS = ['', 'ПРОЧИЕ/НЕУСТАНОВЛЕННЫЕ СТРАНЫ', 'ПРОЧИЕ', 'РАЗНЫЕ', '0'];

        data.forEach(function (row) {
            var origin = String(row[originCol] || '').trim().toUpperCase();
            if (EMPTY_VALS.indexOf(origin) === -1) { return; } // уже заполнено

            // Пытаемся взять из Код страны отправления, затем из Торгующей страны
            var source = null;
            if (dispatchCol) { source = String(row[dispatchCol] || '').trim(); }
            if (!source && tradingCol) { source = String(row[tradingCol] || '').trim(); }
            if (!source) { return; }

            // Формат "EC - ЭКВАДОР" → берём часть после " - "
            var dashIdx = source.indexOf(' - ');
            var name = dashIdx !== -1 ? source.slice(dashIdx + 3).trim() : source;

            // Не подставляем "РАЗНЫЕ", "00 - РАЗНЫЕ" и т.п.
            var nameLower = name.toUpperCase();
            if (EMPTY_VALS.indexOf(nameLower) !== -1 || nameLower === 'РАЗНЫЕ') { return; }

            row[originCol] = name;
            count++;
        });
        return count;
    }

    function removeDuplicates(data) {
        var seen = {};
        return data.filter(function (row) {
            var key = JSON.stringify(row);
            if (seen[key]) { return false; }
            seen[key] = true;
            return true;
        });
    }

    function removeEmpty(data, headers) {
        return data.filter(function (row) {
            var allEmpty = true;
            for (var i = 0; i < headers.length; i++) {
                var val = row[headers[i]];
                if (val !== undefined && val !== null && val !== '') {
                    allEmpty = false;
                    break;
                }
            }
            return !allEmpty;
        });
    }

    function normalizeDates(data, headers) {
        var count = 0;
        var dateCols = headers.filter(isDateColumn);
        data.forEach(function (row) {
            dateCols.forEach(function (col) {
                if (row[col]) {
                    var d = parseDate(row[col]);
                    if (d) {
                        row[col] = d.toISOString().split('T')[0];
                        count++;
                    }
                }
            });
        });
        return count;
    }

    function normalizeNumbers(data, headers) {
        var count = 0;
        data.forEach(function (row) {
            headers.forEach(function (h) {
                var val = row[h];
                if (typeof val === 'string' && val !== '') {
                    // "1 234,56" → "1234.56", "1.234,56" → "1234.56"
                    var cleaned = val.replace(/\s/g, '');
                    // Если есть и точка и запятая — запятая = десятичный разделитель
                    if (cleaned.indexOf(',') !== -1 && cleaned.indexOf('.') !== -1) {
                        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
                    } else if (cleaned.indexOf(',') !== -1) {
                        cleaned = cleaned.replace(',', '.');
                    }
                    var num = Number(cleaned);
                    if (!isNaN(num) && cleaned !== '' && val !== String(num)) {
                        row[h] = num;
                        count++;
                    }
                }
            });
        });
        return count;
    }

    function normalizeHsCodes(data, headers) {
        var count = 0;
        var hsCol = findColumn(headers, COL_HS_CODE);
        if (!hsCol) { return count; }

        /*
         * Статистика ООН отчитывается на уровне HS6, и добивать её нулями
         * нельзя: 030617 превратится в 0306170000, то есть группа выдаст
         * себя за конкретную подсубпозицию и склеится с таможенными
         * данными неверно. Разделители чистим в любом случае.
         */
        var padToFull = appState.dataSource !== 'comtrade';

        data.forEach(function (row) {
            var val = row[hsCol];
            if (val !== undefined && val !== null && val !== '') {
                var str = String(val).replace(/[\s.\-]/g, '');
                if (padToFull) {
                    while (str.length < HS_CODE_LENGTH) { str = str + '0'; }
                }
                if (str.length > HS_CODE_LENGTH) { str = str.substring(0, HS_CODE_LENGTH); }
                if (row[hsCol] !== str) {
                    row[hsCol] = str;
                    count++;
                }
            }
        });
        return count;
    }

    function calcUsdPerKgStat(data, headers) {
        var valueCol = findColumn(headers, COL_STAT_USD);
        var weightCol = findColumn(headers, COL_WEIGHT);
        if (!valueCol || !weightCol) { return { colName: null, count: 0, error: 'Не найдены столбцы «' + COL_STAT_USD + '» или «' + COL_WEIGHT + '»' }; }

        var colName = 'USD за КГ статистическая';
        var count = 0;
        data.forEach(function (row) {
            var v = Number(row[valueCol]);
            var w = Number(row[weightCol]);
            if (!isNaN(v) && !isNaN(w) && w > 0) {
                row[colName] = round2(v / w);
                count++;
            } else {
                row[colName] = '';
            }
        });
        return { colName: colName, count: count };
    }

    function calcUsdPerKgInvoice(data, headers) {
        var valueCol = findColumn(headers, COL_CUSTOMS);
        var weightCol = findColumn(headers, COL_WEIGHT);
        if (!valueCol || !weightCol) { return { colName: null, count: 0, error: 'Не найдены столбцы «' + COL_CUSTOMS + '» или «' + COL_WEIGHT + '»' }; }

        var colName = 'USD за КГ таможенная';
        var count = 0;
        data.forEach(function (row) {
            var v = Number(row[valueCol]);
            var w = Number(row[weightCol]);
            if (!isNaN(v) && !isNaN(w) && w > 0) {
                row[colName] = round2(v / w);
                count++;
            } else {
                row[colName] = '';
            }
        });
        return { colName: colName, count: count };
    }

    function calcRurPerKg(data, headers) {
        var valueCol = findColumn(headers, COL_CUSTOMS);
        var weightCol = findColumn(headers, COL_WEIGHT);
        if (!valueCol || !weightCol) { return { colName: null, count: 0, error: 'Не найдены столбцы «' + COL_CUSTOMS + '» или «' + COL_WEIGHT + '»' }; }

        var colName = 'Нац. вал. за КГ';
        var count = 0;
        data.forEach(function (row) {
            var v = Number(row[valueCol]);
            var w = Number(row[weightCol]);
            if (!isNaN(v) && !isNaN(w) && w > 0) {
                row[colName] = round2(v / w);
                count++;
            } else {
                row[colName] = '';
            }
        });
        return { colName: colName, count: count };
    }

    function calcRatio(data, numeratorCol, denominatorCol) {
        var count = 0;
        var colName = numeratorCol + '_per_' + denominatorCol;
        data.forEach(function (row) {
            var n = Number(row[numeratorCol]);
            var d = Number(row[denominatorCol]);
            if (!isNaN(n) && !isNaN(d) && d !== 0) {
                row[colName] = round2(n / d);
                count++;
            } else {
                row[colName] = '';
            }
        });
        return { colName: colName, count: count };
    }

    // --- Курс ЦБ РФ (из localStorage → fallback JSON-файл) ---

    // Предзагрузка при старте: сначала localStorage (мгновенно), потом JSON в фоне
    try {
        var saved = localStorage.getItem(LS_CBR_KEY);
        if (saved) { rateCache = JSON.parse(saved); }
    } catch (e) { /* ignore */ }

    function loadRateCache() {
        if (rateCache) { return Promise.resolve(rateCache); }
        return fetch(CBR_RATES_URL)
            .then(function (resp) {
                if (!resp.ok) { throw new Error(resp.status); }
                return resp.json();
            })
            .then(function (json) {
                rateCache = json;
                try { localStorage.setItem(LS_CBR_KEY, JSON.stringify(json)); } catch (e) { /* ignore */ }
                return rateCache;
            })
            .catch(function () {
                rateCache = {};
                return rateCache;
            });
    }

    // Предзагружаем JSON в фоне при старте (если ещё нет в localStorage)
    if (!rateCache) { loadRateCache(); }

    function findClosestRate(iso) {
        if (!rateCache) { return null; }
        if (rateCache[iso]) { return rateCache[iso]; }
        // Если дата — выходной, берём предыдущий рабочий день (до 5 дней назад)
        var d = new Date(iso);
        for (var i = 1; i <= 5; i++) {
            d.setDate(d.getDate() - 1);
            var prev = d.toISOString().split('T')[0];
            if (rateCache[prev]) { return rateCache[prev]; }
        }
        return null;
    }

    // API fallback для дат новее JSON-файла (максимум 5 дат)
    function fetchRateFromAPI(dateStr) {
        function tryDate(ds, attempt) {
            if (attempt > 3) { return Promise.resolve(null); }
            if (rateCache[ds]) { return Promise.resolve(rateCache[ds]); }
            var parts = ds.split('-');
            var url = CBR_API_BASE + '/archive/' + parts[0] + '/' + parts[1] + '/' + parts[2] + '/daily_json.js';
            return fetch(url, { signal: AbortSignal.timeout(5000) })
                .then(function (resp) {
                    if (!resp.ok) { throw new Error(resp.status); }
                    return resp.json();
                })
                .then(function (json) {
                    var rates = {};
                    var valute = json.Valute || {};
                    Object.keys(valute).forEach(function (key) {
                        var cur = valute[key];
                        rates[cur.CharCode] = round2(cur.Value / cur.Nominal);
                    });
                    rates['RUB'] = 1;
                    rateCache[ds] = rates;
                    rateCache[dateStr] = rates;
                    return rates;
                })
                .catch(function () {
                    var d = new Date(ds);
                    d.setDate(d.getDate() - 1);
                    var prev = d.toISOString().split('T')[0];
                    return tryDate(prev, attempt + 1);
                });
        }
        return tryDate(dateStr, 0);
    }

    function fetchMissingRates(dateList) {
        // Находим последнюю дату в JSON
        var cachedDates = Object.keys(rateCache).sort();
        var lastCached = cachedDates.length > 0 ? cachedDates[cachedDates.length - 1] : '';

        // Только даты НОВЕЕ JSON-файла (не старые пропуски)
        var missing = dateList.filter(function (iso) {
            return iso > lastCached && !findClosestRate(iso);
        });

        if (missing.length === 0) { return Promise.resolve(0); }

        // Ограничиваем до 5 дат максимум — не более чем неделя вперёд
        missing = missing.slice(0, 5);
        console.log('[ЦБ] Догрузка из API:', missing.length, 'новых дат:', missing.join(', '));

        // Последовательно, чтобы не перегрузить
        var idx = 0;
        function next() {
            if (idx >= missing.length) { return Promise.resolve(); }
            return fetchRateFromAPI(missing[idx++]).then(next);
        }
        return next().then(function () { return missing.length; });
    }

    function applyCBRRates(data, headers) {
        var dateCol = findColumn(headers, COL_DATE_REG) || findColumn(headers, COL_DATE_RELEASE);
        var currCol = findColumn(headers, COL_CURRENCY_CODE);
        var invoiceCol = findColumn(headers, COL_CUSTOMS);

        if (!dateCol || !currCol || !invoiceCol) {
            return Promise.resolve({
                count: 0, errors: 0, colNames: [],
                error: 'Не найдены столбцы «' + COL_DATE_REG + '», «' + COL_CURRENCY_CODE + '» или «' + COL_CUSTOMS + '»'
            });
        }

        return loadRateCache().then(function () {
            // Собираем уникальные даты из данных
            var uniqueDates = {};
            data.forEach(function (row) {
                var d = parseDate(row[dateCol]);
                if (d) { uniqueDates[d.toISOString().split('T')[0]] = true; }
            });
            var dateList = Object.keys(uniqueDates).sort();

            // Догружаем недостающие через API
            return fetchMissingRates(dateList).then(function (fetched) {
                var count = 0;
                var errors = 0;

                data.forEach(function (row) {
                    var d = parseDate(row[dateCol]);
                    if (!d) { row[COL_CBR_RATE] = ''; row[COL_INVOICE_RUB_CBR] = ''; errors++; return; }

                    var iso = d.toISOString().split('T')[0];
                    var currency = String(row[currCol] || '').trim().toUpperCase();
                    var invoiceVal = Number(row[invoiceCol]);

                    if (!currency) { row[COL_CBR_RATE] = ''; row[COL_INVOICE_RUB_CBR] = ''; errors++; return; }

                    if (currency === 'RUB' || currency === 'RUR') {
                        row[COL_CBR_RATE] = 1;
                        row[COL_INVOICE_RUB_CBR] = !isNaN(invoiceVal) ? round2(invoiceVal) : '';
                        count++;
                        return;
                    }

                    var rates = findClosestRate(iso);
                    if (!rates || !rates[currency]) {
                        row[COL_CBR_RATE] = '';
                        row[COL_INVOICE_RUB_CBR] = '';
                        errors++;
                        return;
                    }

                    var rate = rates[currency];
                    row[COL_CBR_RATE] = rate;
                    row[COL_INVOICE_RUB_CBR] = !isNaN(invoiceVal) ? round2(invoiceVal * rate) : '';
                    count++;
                });

                if (headers.indexOf(COL_CBR_RATE) === -1) { headers.push(COL_CBR_RATE); }
                if (headers.indexOf(COL_INVOICE_RUB_CBR) === -1) { headers.push(COL_INVOICE_RUB_CBR); }

                return { count: count, errors: errors, colNames: [COL_CBR_RATE, COL_INVOICE_RUB_CBR], dates: dateList.length, fetched: fetched };
            });
        });
    }

    // --- Хелпер: рублёвая стоимость строки (ИМ → G45, ЭК → G46 × курс ЦБ) ---

    function getRowRubValue(row, ctx) {
        var direction = ctx.directionCol ? String(row[ctx.directionCol] || '').trim().toUpperCase() : '';

        // Импорт: таможенная стоимость уже в рублях (таможенные выгрузки)
        if (direction !== 'ЭК') {
            if (ctx.customsCol) { return Number(row[ctx.customsCol]) || 0; }
            if (ctx.invoiceRubCol) { return Number(row[ctx.invoiceRubCol]) || 0; }
        }

        // Экспорт, либо импорт без рублёвого столбца (напр. UN Comtrade — только
        // USD): пересчитываем статистическую стоимость в рубли по курсу ЦБ на дату
        if (ctx.statUsdCol && ctx.dateReleaseCol) {
            var usdVal = Number(row[ctx.statUsdCol]) || 0;
            if (usdVal === 0) { return 0; }
            var d = parseDate(row[ctx.dateReleaseCol]);
            if (d) {
                var iso = d.toISOString().split('T')[0];
                var rates = findClosestRate(iso);
                if (rates && rates['USD']) { return round2(usdVal * rates['USD']); }
            }
        }

        // Экспорт без курса — рублёвые столбцы как запасной вариант
        if (ctx.customsCol) { return Number(row[ctx.customsCol]) || 0; }
        if (ctx.invoiceRubCol) { return Number(row[ctx.invoiceRubCol]) || 0; }
        return 0;
    }

    // Контекст для getRowRubValue — создаётся один раз при запуске анализа
    function buildRubCtx(headers) {
        return {
            directionCol: findColumn(headers, COL_DIRECTION),
            statUsdCol: findColumn(headers, COL_STAT_USD),
            dateReleaseCol: findColumn(headers, COL_DATE_RELEASE) || findColumn(headers, COL_DATE_REG),
            customsCol: findColumn(headers, COL_CUSTOMS),
            invoiceRubCol: findColumn(headers, COL_INVOICE_RUB)
        };
    }

    function removeEmptyColumns(data, headers) {
        var emptyCols = [];
        headers.forEach(function (h) {
            var allEmpty = true;
            for (var i = 0; i < data.length; i++) {
                var val = data[i][h];
                if (val !== undefined && val !== null && val !== '') {
                    allEmpty = false;
                    break;
                }
            }
            if (allEmpty) { emptyCols.push(h); }
        });

        if (emptyCols.length > 0) {
            var newHeaders = headers.filter(function (h) {
                return emptyCols.indexOf(h) === -1;
            });
            data.forEach(function (row) {
                emptyCols.forEach(function (h) { delete row[h]; });
            });
            return { headers: newHeaders, removed: emptyCols };
        }
        return { headers: headers, removed: [] };
    }

    // --- Извлечение дат ---

    function parseDate(val) {
        if (!val && val !== 0) { return null; }
        // Excel serial number
        if (typeof val === 'number') {
            var d = new Date((val - EXCEL_EPOCH_OFFSET) * MS_PER_DAY);
            return isNaN(d.getTime()) ? null : d;
        }
        var s = String(val).trim();
        if (!s) { return null; }
        // DD.MM.YYYY
        var m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (m) { return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])); }
        // YYYY-MM-DD
        var iso = new Date(s);
        return isNaN(iso.getTime()) ? null : iso;
    }

    function getQuarter(month) {
        return Math.ceil(month / 3);
    }

    var MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

    function extractDateParts(data, headers) {
        // Ищем колонку с датой (после маппинга — русские имена)
        var dateCol = findColumn(headers, COL_DATE_REG) || findColumn(headers, COL_DATE_RELEASE);
        if (!dateCol) { return { headers: headers, count: 0, error: 'Не найдены столбцы «' + COL_DATE_REG + '» или «' + COL_DATE_RELEASE + '»' }; }

        var count = 0;
        var newCols = [COL_MONTH, COL_QUARTER, COL_YEAR];
        newCols.forEach(function (c) {
            if (headers.indexOf(c) === -1) { headers.push(c); }
        });

        data.forEach(function (row) {
            var d = parseDate(row[dateCol]);
            if (d) {
                var mon = d.getMonth() + 1;
                row[COL_MONTH] = MONTH_NAMES[mon - 1];
                row[COL_QUARTER] = getQuarter(mon);
                row[COL_YEAR] = d.getFullYear();
                count++;
            } else {
                row[COL_MONTH] = '';
                row[COL_QUARTER] = '';
                row[COL_YEAR] = '';
            }
        });

        return { headers: headers, count: count };
    }

    // --- Справочник (lookup) ---

    appState.lookupData = [];
    appState.lookupHeaders = [];

    var lookupUploadBtn = document.querySelector('.lookup-upload-btn');
    var lookupInput = document.querySelector('.lookup-input');
    var lookupStatus = document.querySelector('.lookup-status');
    var lookupKeysDiv = document.querySelector('.lookup-keys');
    var lookupKeyData = document.querySelector('.lookup-key-data');
    var lookupKeyRef = document.querySelector('.lookup-key-ref');

    if (lookupUploadBtn && lookupInput) {
        lookupUploadBtn.addEventListener('click', function () {
            lookupInput.click();
        });

        lookupInput.addEventListener('change', function () {
            if (this.files.length > 0) {
                handleLookupFile(this.files[0]);
            }
        });
    }

    function handleLookupFile(file) {
        var ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
            lookupStatus.textContent = 'Поддерживаются CSV, XLS, XLSX';
            return;
        }

        if (ext === 'csv') {
            var reader = new FileReader();
            reader.onload = function (e) {
                var parsed = parseCSV(e.target.result);
                applyLookupData(parsed, file.name);
            };
            reader.readAsText(file, 'UTF-8');
        } else {
            var reader = new FileReader();
            reader.onload = function (e) {
                try {
                    var workbook = XLSX.read(e.target.result, { type: 'array' });
                    if (workbook.SheetNames.length > 1) {
                        // Переиспользуем модалку выбора листа
                        pendingWorkbook = workbook;
                        pendingFile = file;
                        pendingLookupMode = true;
                        var html = '';
                        workbook.SheetNames.forEach(function (name) {
                            html += '<option value="' + name + '">' + name + '</option>';
                        });
                        sheetSelect.innerHTML = html;
                        sheetModalOverlay.style.display = '';
                    } else {
                        var sheet = workbook.Sheets[workbook.SheetNames[0]];
                        var json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                        applyLookupData({ headers: json.length > 0 ? Object.keys(json[0]) : [], rows: json }, file.name);
                    }
                } catch (err) {
                    lookupStatus.textContent = 'Ошибка: ' + err.message;
                }
            };
            reader.readAsArrayBuffer(file);
        }
    }

    function applyLookupData(parsed, fileName) {
        appState.lookupData = parsed.rows;
        appState.lookupHeaders = parsed.headers;

        lookupStatus.textContent = fileName + ' — ' + parsed.rows.length + ' строк, ' + parsed.headers.length + ' столбцов';

        // Заполняем селекты ключей
        var dataHeaders = getActiveHeaders().length > 0 ? getActiveHeaders() : appState.headers;
        var htmlData = '';
        dataHeaders.forEach(function (h) {
            htmlData += '<option value="' + h + '">' + h + '</option>';
        });
        lookupKeyData.innerHTML = htmlData;

        var htmlRef = '';
        parsed.headers.forEach(function (h) {
            htmlRef += '<option value="' + h + '">' + h + '</option>';
        });
        lookupKeyRef.innerHTML = htmlRef;

        // Авто-выбор ключа «ИНН получателя»
        if (dataHeaders.indexOf(COL_INN) !== -1) {
            lookupKeyData.value = COL_INN;
        }
        if (parsed.headers.indexOf(COL_INN) !== -1) {
            lookupKeyRef.value = COL_INN;
        }

        lookupKeysDiv.style.display = '';
    }

    function joinLookup(data, headers) {
        if (appState.lookupData.length === 0) {
            return { headers: headers, count: 0, added: 0, error: 'Справочник не загружен' };
        }

        var keyData = lookupKeyData ? lookupKeyData.value : '';
        var keyRef = lookupKeyRef ? lookupKeyRef.value : '';
        if (!keyData || !keyRef) {
            return { headers: headers, count: 0, added: 0, error: 'Не выбраны ключи для связи' };
        }

        // Строим индекс справочника
        var index = {};
        appState.lookupData.forEach(function (row) {
            var key = String(row[keyRef]).trim();
            if (key) { index[key] = row; }
        });

        // Определяем новые колонки (все из справочника кроме ключа)
        var newCols = appState.lookupHeaders.filter(function (h) {
            return h !== keyRef;
        });
        newCols.forEach(function (c) {
            if (headers.indexOf(c) === -1) { headers.push(c); }
        });

        var count = 0;
        data.forEach(function (row) {
            var key = String(row[keyData]).trim();
            var match = index[key];
            if (match) {
                newCols.forEach(function (c) {
                    row[c] = match[c] !== undefined ? match[c] : '';
                });
                count++;
            } else {
                newCols.forEach(function (c) {
                    row[c] = '';
                });
            }
        });

        return { headers: headers, count: count, added: newCols.length };
    }

    // --- Главный pipeline ---

    if (applyBtn) {
        applyBtn.addEventListener('click', function () {
            if (appState.rawData.length === 0) {
                renderProcessingMessage('Сначала загрузите данные');
                return;
            }

            var ops = getSelectedOps();
            var selectedCols = getSelectedColumns();

            if (ops.length === 0 && selectedCols.length === appState.headers.length) {
                renderProcessingMessage('Выберите операции или уберите ненужные столбцы');
                return;
            }

            if (selectedCols.length === 0) {
                renderProcessingMessage('Выберите хотя бы один столбец');
                return;
            }

            setApplyBtnState('loading');

            try {

            var data = JSON.parse(JSON.stringify(appState.rawData));
            var headers = appState.headers.slice();
            var log = [];

            // 1. Маппинг
            if (ops.indexOf('mapping') !== -1) {
                var mapResult = autoMapColumns(data, headers);
                data = mapResult.data;
                headers = mapResult.headers;
                log.push('Маппинг: переименовано ' + mapResult.mappings.length + ' из ' + Object.keys(COLUMN_MAP).length + ' колонок');
                if (mapResult.missing.length > 0) {
                    log.push('Не найдены: ' + mapResult.missing.join(', '));
                }
            }

            // 1.5. Пользовательский маппинг
            if (ops.indexOf('custom-mapping') !== -1) {
                var custMap = getCustomMapping();
                var custResult = applyCustomMapping(data, headers, custMap);
                data = custResult.data;
                headers = custResult.headers;
                if (custResult.count > 0) {
                    log.push('Пользовательский маппинг: ' + custResult.count + ' колонок (' + custResult.mappings.join(', ') + ')');
                } else {
                    log.push('Пользовательский маппинг: нет правил или колонки не найдены');
                }
                saveCustomMapping();
            }

            // 2. Извлечение дат
            if (ops.indexOf('extract-dates') !== -1) {
                var dateResult = extractDateParts(data, headers);
                headers = dateResult.headers;
                if (dateResult.error) {
                    log.push('Извлечение дат: ' + dateResult.error);
                } else {
                    log.push('Извлечение дат: Месяц/Квартал/Год для ' + dateResult.count + ' строк');
                }
            }

            // 3. Обогащение из справочника
            if (ops.indexOf('join-lookup') !== -1) {
                var joinResult = joinLookup(data, headers);
                headers = joinResult.headers;
                if (joinResult.error) {
                    log.push('Справочник: ' + joinResult.error);
                } else {
                    log.push('Справочник: обогащено ' + joinResult.count + ' из ' + data.length + ' строк, добавлено ' + joinResult.added + ' колонок');
                }
            }

            // 4. Очистка
            if (ops.indexOf('trim') !== -1) {
                var trimCount = trimValues(data, headers);
                log.push('Пробелы: обрезано ' + trimCount + ' значений');
            }
            if (ops.indexOf('lowercase') !== -1) {
                var lcCount = lowercaseText(data, headers);
                log.push('Регистр: приведено к нижнему ' + lcCount + ' значений');
            }
            if (ops.indexOf('duplicates') !== -1) {
                var before = data.length;
                data = removeDuplicates(data);
                log.push('Дубликаты: удалено ' + (before - data.length) + ' строк');
            }
            if (ops.indexOf('empty') !== -1) {
                var before2 = data.length;
                data = removeEmpty(data, headers);
                log.push('Пустые: удалено ' + (before2 - data.length) + ' строк');
            }
            if (ops.indexOf('normalize-companies') !== -1) {
                var ncCount = normalizeCompanyNames(data, headers);
                log.push('Названия компаний: нормализовано ' + ncCount + ' значений' +
                    (companyDictionaryLastAdded ? ', в словарь добавлено ' + companyDictionaryLastAdded : ''));
            }
            if (ops.indexOf('normalize-country') !== -1) {
                var ncoCount = normalizeCountryOrigin(data, headers);
                log.push('Страна происхождения: заполнено ' + ncoCount + ' пустых значений');
            }

            // 5. Нормализация
            if (ops.indexOf('dates') !== -1) {
                var dateCount = normalizeDates(data, headers);
                log.push('Даты: нормализовано ' + dateCount + ' значений');
            }
            if (ops.indexOf('numbers') !== -1) {
                var numCount = normalizeNumbers(data, headers);
                log.push('Числа: нормализовано ' + numCount + ' значений');
            }
            if (ops.indexOf('hs-code') !== -1) {
                var hsCount = normalizeHsCodes(data, headers);
                if (hsCount > 0) {
                    log.push('ТН ВЭД: нормализовано ' + hsCount + ' кодов (строка, 10 знаков)');
                } else {
                    log.push('ТН ВЭД: столбец не найден или нечего нормализовать');
                }
            }

            // 5.5 Курс ЦБ РФ (async)
            var cbrPromise;
            if (ops.indexOf('cbr-rate') !== -1) {
                applyBtn.disabled = true;
                applyBtn.textContent = 'Загрузка курсов ЦБ…';
                cbrPromise = applyCBRRates(data, headers);
            } else {
                cbrPromise = Promise.resolve(null);
            }

            cbrPromise.then(function (cbrResult) {
                if (cbrResult) {
                    if (cbrResult.error) {
                        log.push('Курс ЦБ: ' + cbrResult.error);
                    } else {
                        log.push('Курс ЦБ: загружено ' + cbrResult.dates + ' дат, пересчитано ' + cbrResult.count + ' строк' +
                            (cbrResult.errors > 0 ? ' (пропущено ' + cbrResult.errors + ')' : ''));
                    }
                }

                // 6. Расчёт производных
                if (ops.indexOf('usd-per-kg-stat') !== -1) {
                    var r1 = calcUsdPerKgStat(data, headers);
                    if (r1.colName) {
                        if (headers.indexOf(r1.colName) === -1) { headers.push(r1.colName); }
                        log.push('USD/кг стат.: ' + r1.count + ' значений');
                    } else {
                        log.push('USD/кг стат.: ' + r1.error);
                    }
                }
                if (ops.indexOf('usd-per-kg-invoice') !== -1) {
                    var r2 = calcUsdPerKgInvoice(data, headers);
                    if (r2.colName) {
                        if (headers.indexOf(r2.colName) === -1) { headers.push(r2.colName); }
                        log.push('USD/кг факт.: ' + r2.count + ' значений');
                    } else {
                        log.push('USD/кг факт.: ' + r2.error);
                    }
                }
                if (ops.indexOf('rur-per-kg') !== -1) {
                    var r3 = calcRurPerKg(data, headers);
                    if (r3.colName) {
                        if (headers.indexOf(r3.colName) === -1) { headers.push(r3.colName); }
                        log.push('Нац. вал./кг: ' + r3.count + ' значений');
                    } else {
                        log.push('Нац. вал./кг: ' + r3.error);
                    }
                }
                if (ops.indexOf('ratio') !== -1) {
                    var numCol = ratioNumerator ? ratioNumerator.value : '';
                    var denCol = ratioDenominator ? ratioDenominator.value : '';
                    if (numCol && denCol) {
                        var ratioResult = calcRatio(data, numCol, denCol);
                        headers.push(ratioResult.colName);
                        log.push('Отношение: ' + ratioResult.colName + ' (' + ratioResult.count + ' значений)');
                    } else {
                        log.push('Отношение: не выбраны столбцы');
                    }
                }

                // 7. Удаление пустых столбцов
                if (ops.indexOf('empty-cols') !== -1) {
                    var emptyColResult = removeEmptyColumns(data, headers);
                    if (emptyColResult.removed.length > 0) {
                        headers = emptyColResult.headers;
                        log.push('Пустые столбцы: удалено ' + emptyColResult.removed.length + ' (' + emptyColResult.removed.join(', ') + ')');
                    } else {
                        log.push('Пустые столбцы: не найдены');
                    }
                }

                // 8. Фильтрация столбцов
                var finalCols = [];
                headers.forEach(function (h) {
                    var origIdx = appState.headers.indexOf(h);
                    if (origIdx === -1) {
                        finalCols.push(h);
                    } else if (selectedCols.indexOf(appState.headers[origIdx]) !== -1) {
                        finalCols.push(h);
                    }
                });
                if (ops.indexOf('mapping') !== -1) {
                    finalCols = headers.slice();
                }

                finalCols = finalCols.filter(function (h) {
                    return EXCLUDED_FINAL_HEADERS.indexOf(String(h || '').trim().toUpperCase()) === -1;
                });

                var removedCols = headers.filter(function (h) {
                    return finalCols.indexOf(h) === -1;
                });
                if (removedCols.length > 0) {
                    data = data.map(function (row) {
                        var filtered = {};
                        finalCols.forEach(function (col) {
                            filtered[col] = row[col];
                        });
                        return filtered;
                    });
                    log.push('Столбцы: удалено ' + removedCols.length + ' (' + removedCols.join(', ') + ')');
                }

                appState.processedData = data;
                appState.processedHeaders = finalCols;
                appState.isProcessed = true;

                renderPreviewResult(data, log, finalCols);
                updateVisualizationFields();
                setApplyBtnState('done');
            }).catch(function (err) {
                renderProcessingMessage('Ошибка обработки: ' + err.message);
                console.error('Processing error:', err);
                setApplyBtnState('error');
            });

            } catch (err) {
                renderProcessingMessage('Ошибка обработки: ' + err.message);
                console.error('Processing error:', err);
                setApplyBtnState('error');
            }
        });
    }

    function renderProcessingMessage(text) {
        // Модуля может не быть: в демонстрационном режиме он заменён витриной
        var container = document.querySelector('.processing-preview');
        if (!container) { return; }
        container.innerHTML =
            '<div class="preview-placeholder">' +
            '  <p class="preview-placeholder-text">' + text + '</p>' +
            '</div>';
    }

    function renderPreviewResult(data, log, headers) {
        var container = document.querySelector('.processing-preview');
        if (!container) { return; }
        var html = '<h3 class="processing-section-title">Отчёт об обработке</h3>';

        html += '<div class="processing-log">';
        log.forEach(function (msg) {
            html += '<p class="processing-log-item">' + msg + '</p>';
        });
        html += '<p class="processing-log-item processing-log-total">Итого: ' +
            formatNumber(data.length) + ' строк, ' + headers.length + ' столбцов</p>';
        html += '</div>';

        html += '<div class="processing-export">';
        html += '<button class="btn btn-primary processing-download-xlsx">Скачать XLSX</button>';
        html += '<button class="btn btn-secondary processing-download-csv">Скачать CSV</button>';
        html += '<button class="btn btn-primary processing-download-brief-xlsx">Скачать краткий XLSX</button>';
        html += '<button class="btn btn-secondary processing-download-brief-csv">Скачать краткий CSV</button>';
        html += '</div>';
        html += '<button class="btn btn-outline processing-download-report">Скачать отчёт об обработке</button>';

        container.innerHTML = html;

        container.querySelector('.processing-download-csv').addEventListener('click', function () {
            downloadProcessedCSV();
        });
        container.querySelector('.processing-download-xlsx').addEventListener('click', function () {
            downloadProcessedXLSX();
        });
        container.querySelector('.processing-download-brief-csv').addEventListener('click', function () {
            downloadBriefProcessedCSV();
        });
        container.querySelector('.processing-download-brief-xlsx').addEventListener('click', function () {
            downloadBriefProcessedXLSX();
        });
        container.querySelector('.processing-download-report').addEventListener('click', function () {
            downloadProcessingReport(log, data, headers);
        });
    }

    function downloadProcessingReport(log, data, headers) {
        var text = 'ОТЧЁТ ОБ ОБРАБОТКЕ ДАННЫХ\n';
        text += '========================\n';
        text += 'Дата: ' + new Date().toLocaleString('ru-RU') + '\n';
        text += 'Файл: ' + appState.fileName + '\n';
        text += 'Исходных строк: ' + formatNumber(appState.rawData.length) + '\n';
        text += 'Исходных столбцов: ' + appState.headers.length + '\n';
        text += '\nОПЕРАЦИИ:\n';
        log.forEach(function (msg) {
            text += '  • ' + msg + '\n';
        });
        text += '\nРЕЗУЛЬТАТ:\n';
        text += '  Строк: ' + formatNumber(data.length) + '\n';
        text += '  Столбцов: ' + headers.length + '\n';
        text += '  Столбцы: ' + headers.join(', ') + '\n';

        var blob = new Blob([UTF8_BOM + text], { type: 'text/plain;charset=utf-8' });
        triggerDownload(blob, baseFileName() + '_report.txt');
    }

    function triggerDownload(blob, fileName) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
        }, 100);
    }

    function downloadCsvData(data, headers, fileName) {
        var csv = headers.join(CSV_SEPARATOR) + '\n';
        data.forEach(function (row) {
            var line = headers.map(function (h) {
                var val = row[h] !== undefined ? String(row[h]) : '';
                if (val.indexOf(';') !== -1 || val.indexOf('"') !== -1) {
                    val = '"' + val.replace(/"/g, '""') + '"';
                }
                return val;
            });
            csv += line.join(CSV_SEPARATOR) + '\n';
        });

        var blob = new Blob([UTF8_BOM + csv], { type: MIME_CSV });
        triggerDownload(blob, fileName);
    }

    /*
     * Подпись об источнике отдельным листом: вставлять её строкой в лист
     * с данными нельзя — закрепление шапки и автоширина считают, что
     * первая строка это заголовки.
     */
    function appendSourceSheet(wb) {
        var note = dataSourceNote();
        if (!note) { return; }

        /*
         * Уровень агрегации у источников разный, и подпись обязана его
         * называть честно: Comtrade даёт HS6, а WITS (tradestats) — только
         * 16 крупных товарных разделов. Общая формулировка «статистика ООН,
         * уровень HS6» на выгрузке WITS вводила в заблуждение.
         */
        var levelNote = appState.dataSource === 'wits'
            ? ['Данные Всемирного банка агрегированы по крупным товарным разделам ТН ВЭД',
               '(16 групп), а не по отдельным кодам, и не содержат сведений',
               'об отправителях, получателях и изготовителях.']
            : ['Статистика ООН агрегирована по кодам ТН ВЭД (уровень HS6) и не содержит',
               'сведений об отправителях, получателях и изготовителях.'];

        var ws = XLSX.utils.aoa_to_sheet([
            ['Источник данных'],
            [note],
            ['Выгружено', new Date().toLocaleDateString('ru-RU')],
            [],
        ].concat(levelNote.map(function (line) { return [line]; })));
        ws['!cols'] = [{ wch: 72 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Источник');
    }

    function downloadXlsxData(data, headers, sheetName, fileName) {
        if (data.length === 0 || typeof XLSX === 'undefined') { return; }

        var ws = XLSX.utils.json_to_sheet(data, { header: headers });

        // Автоширина колонок по содержимому
        var colWidths = headers.map(function (h) {
            var maxLen = h.length;
            var sampleSize = Math.min(data.length, 100);
            for (var r = 0; r < sampleSize; r++) {
                var val = data[r][h];
                if (val != null) {
                    var len = String(val).length;
                    if (len > maxLen) { maxLen = len; }
                }
            }
            return { wch: Math.min(maxLen + 2, 50) };
        });
        ws['!cols'] = colWidths;

        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        appendSourceSheet(wb);

        // Генерируем XLSX как ArrayBuffer, затем патчим XML для freeze pane
        var wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

        try {
            var jszip = new JSZip();
            jszip.loadAsync(wbout).then(function (z) {
                return z.file('xl/worksheets/sheet1.xml').async('string');
            }).then(function (xml) {
                // Вставляем sheetViews с freeze pane после <sheetData> нет — нужно перед <sheetData>
                var freezeXml = '<sheetViews><sheetView tabSelected="1" workbookViewId="0">' +
                    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
                    '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>' +
                    '</sheetView></sheetViews>';

                if (xml.indexOf('<sheetViews') !== -1) {
                    xml = xml.replace(/<sheetViews[^]*?<\/sheetViews>/, freezeXml);
                } else {
                    xml = xml.replace('<sheetData', freezeXml + '<sheetData');
                }

                var jszip2 = new JSZip();
                return jszip2.loadAsync(wbout).then(function (z2) {
                    z2.file('xl/worksheets/sheet1.xml', xml);
                    return z2.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                });
            }).then(function (blob) {
                triggerDownload(blob, fileName);
            }).catch(function () {
                // Fallback: скачать без freeze pane
                var blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                triggerDownload(blob, fileName);
            });
        } catch (e) {
            // JSZip не доступен — скачать как есть
            var blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            triggerDownload(blob, fileName);
        }
    }

    function getBriefProcessedHeaders() {
        var headers = getActiveHeaders();
        return getBriefColumnMatches(headers);
    }

    function projectRows(data, headers) {
        return data.map(function (row) {
            var projected = {};
            headers.forEach(function (h) {
                projected[h] = row[h];
            });
            return projected;
        });
    }

    function downloadProcessedCSV() {
        var data = appState.processedData;
        if (data.length === 0) { return; }
        downloadCsvData(data, getActiveHeaders(), baseFileName() + '_processed.csv');
    }

    function downloadProcessedXLSX() {
        var data = appState.processedData;
        downloadXlsxData(data, getActiveHeaders(), 'Processed', baseFileName() + '_processed.xlsx');
    }

    function downloadBriefProcessedCSV() {
        var data = appState.processedData;
        var headers = getBriefProcessedHeaders();
        if (data.length === 0 || headers.length === 0) { return; }
        downloadCsvData(projectRows(data, headers), headers, baseFileName() + '_brief_processed.csv');
    }

    function downloadBriefProcessedXLSX() {
        var data = appState.processedData;
        var headers = getBriefProcessedHeaders();
        if (headers.length === 0) { return; }
        downloadXlsxData(projectRows(data, headers), headers, 'Brief', baseFileName() + '_brief_processed.xlsx');
    }

    function updateProcessingState() {
        // Очищаем область результатов при загрузке новых данных
        var container = document.querySelector('.processing-preview');
        if (container) { container.innerHTML = ''; }
    }

    /* ================================
       Module: Analysis
       ================================ */
    var analysisButtons = document.querySelectorAll('.module-analysis .action-card .btn');
    var analysisResults = document.querySelector('.analysis-results');

    analysisButtons.forEach(function (button) {
        var card = button.closest('.action-card');
        var analysisType = card ? card.getAttribute('data-analysis') : '';
        if (analysisType) {
            button.addEventListener('click', function () { runAnalysis(analysisType); });
        }
    });

    // --- Фильтр по направлению ИМ/ЭК ---
    var analysisDirectionFilter = 'ИМ';
    var lastAnalysisType = '';

    function setDirectionFilter(dir) {
        analysisDirectionFilter = dir;
        document.querySelectorAll('.analysis-direction-filter .btn-filter').forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-dir') === dir);
        });
    }

    document.querySelectorAll('.analysis-direction-filter .btn-filter').forEach(function (btn) {
        btn.addEventListener('click', function () {
            setDirectionFilter(btn.getAttribute('data-dir'));
            if (lastAnalysisType) { runAnalysis(lastAnalysisType); }
        });
    });

    function getFilteredAnalysisData() {
        var data = getActiveData();
        var headers = getActiveHeaders();
        if (!analysisDirectionFilter) return { data: data, headers: headers };
        var dirCol = findColumn(headers, COL_DIRECTION);
        if (!dirCol) return { data: data, headers: headers };
        var filtered = data.filter(function (row) {
            return String(row[dirCol] || '').trim().toUpperCase() === analysisDirectionFilter;
        });
        return { data: filtered, headers: headers };
    }

    /* ================================
       Сигналы и риски рынка
       ================================
       Считаются арифметикой по уже загруженным данным — без моделей и
       внешних запросов. Смысл: перевести цифры в утверждения, которые
       нельзя оспорить, и на которых потом можно строить тексты отчёта.

       Каждый сигнал несёт уровень (ok/watch/risk), число и формулировку
       с объяснением, почему это важно. */

    function signalLevelWord(level) {
        return level === 'risk' ? 'Риск' : (level === 'watch' ? 'Внимание' : 'Норма');
    }

    /** Индекс Херфиндаля–Хиршмана: сумма квадратов долей, 0–10000. */
    function computeHHI(shares) {
        return shares.reduce(function (s, p) { return s + p * p; }, 0);
    }

    function computeMarketSignals(data, headers) {
        var countryCol = findColumn(headers, 'Страна отправления') ||
                         findColumn(headers, 'Страна назначения') ||
                         findColumn(headers, 'Страна-импортёр') ||
                         findColumn(headers, 'Страна-экспортёр');
        var yearCol = findColumn(headers, COL_YEAR);
        var wCol = findAnyColumn(headers, WEIGHT_COLS);
        var uCol = findAnyColumn(headers, USD_COLS);

        if (!uCol && !wCol) {
            return { error: 'Нужен столбец стоимости USD или веса.' };
        }

        // Основная метрика: вес, если он есть (натуральный объём устойчивее
        // к валютным колебаниям), иначе стоимость
        var useWeight = !!wCol;
        var valOf = function (row) {
            var v = useWeight ? row[wCol] : row[uCol];
            return typeof v === 'number' ? v : (parseFloat(String(v).replace(',', '.')) || 0);
        };

        var byCountry = {}, byYear = {}, byCountryYear = {};
        var total = 0, totalUsd = 0, totalW = 0;

        data.forEach(function (row) {
            var v = valOf(row);
            var c = countryCol ? String(row[countryCol] || '').trim() : '';
            var y = yearCol ? String(row[yearCol] || '').trim() : '';
            var usd = uCol ? (typeof row[uCol] === 'number' ? row[uCol] : parseFloat(String(row[uCol]).replace(',', '.')) || 0) : 0;
            var w = wCol ? (typeof row[wCol] === 'number' ? row[wCol] : parseFloat(String(row[wCol]).replace(',', '.')) || 0) : 0;

            total += v; totalUsd += usd; totalW += w;
            if (c) {
                if (!byCountry[c]) { byCountry[c] = { v: 0, usd: 0, w: 0 }; }
                byCountry[c].v += v; byCountry[c].usd += usd; byCountry[c].w += w;
            }
            if (y) {
                if (!byYear[y]) { byYear[y] = { v: 0, usd: 0, w: 0 }; }
                byYear[y].v += v; byYear[y].usd += usd; byYear[y].w += w;
            }
            if (c && y) {
                var k = c + '|' + y;
                if (!byCountryYear[k]) { byCountryYear[k] = 0; }
                byCountryYear[k] += v;
            }
        });

        var years = Object.keys(byYear).sort();
        var countries = Object.keys(byCountry).sort(function (a, b) {
            return byCountry[b].v - byCountry[a].v;
        });
        var signals = [];
        var unit = useWeight ? 'объёму' : 'стоимости';
        // Числа для матрицы рекомендаций: правила работают по значениям,
        // а не по текстам, поэтому собираем их отдельно от формулировок
        var m = {
            hhi: null, leadShare: null, leadName: '', core: null,
            growthV: null, growthUsd: null, gap: null, cv: null,
            appeared: [], gone: [], premiumHi: null, premiumLo: null,
            partial: false, years: 0
        };

        /* --- Концентрация рынка (HHI) --- */
        if (countries.length > 1 && total > 0) {
            var shares = countries.map(function (c) { return byCountry[c].v / total * 100; });
            var hhi = Math.round(computeHHI(shares));
            m.hhi = hhi;
            var lvl = hhi >= 2500 ? 'risk' : (hhi >= 1500 ? 'watch' : 'ok');
            signals.push({
                id: 'hhi', level: lvl, title: 'Концентрация рынка',
                value: formatNumber(hhi) + ' HHI',
                text: 'Индекс Херфиндаля–Хиршмана по ' + unit + ' равен ' + formatNumber(hhi) + '. ' +
                    (lvl === 'risk' ? 'Рынок высококонцентрированный, поставки сосредоточены у немногих стран.'
                     : lvl === 'watch' ? 'Концентрация умеренная, рынок определяют несколько стран.'
                     : 'Рынок распределённый, зависимости от отдельных поставщиков нет.'),
                why: 'Значение выше 1500 говорит об умеренной концентрации, выше 2500 о высокой. Так считают антимонопольные ведомства.'
            });

            /* --- Зависимость от лидера --- */
            var leadShare = shares[0];
            m.leadShare = leadShare; m.leadName = countries[0];
            var lvl2 = leadShare >= 50 ? 'risk' : (leadShare >= 30 ? 'watch' : 'ok');
            signals.push({
                id: 'leader', level: lvl2, title: 'Зависимость от лидера',
                value: round2(leadShare) + '%',
                text: 'На ' + countries[0] + ' приходится ' + round2(leadShare) + '% рынка по ' + unit + '. ' +
                    (lvl2 === 'risk' ? 'Сбой у этого поставщика ударит по большей части поставок.'
                     : lvl2 === 'watch' ? 'Зависимость заметная, стоит держать запасные варианты.'
                     : 'Критической зависимости от одной страны нет.'),
                why: 'Если на одну страну приходится больше половины рынка, заменить её быстро не получится.'
            });

            /* --- Сколько стран держат 80% рынка --- */
            var acc = 0, core = 0;
            for (var i = 0; i < shares.length; i++) {
                acc += shares[i]; core++;
                if (acc >= 80) { break; }
            }
            m.core = core;
            signals.push({
                id: 'core', level: core <= 2 ? 'watch' : 'ok', title: 'Ядро рынка',
                value: core + ' из ' + countries.length,
                text: core + ' ' + (core === 1 ? 'страна обеспечивает' : 'стран(ы) обеспечивают') +
                    ' 80% поставок из ' + countries.length + ' присутствующих на рынке.',
                why: 'Чем меньше стран держат основную долю, тем уже реальный выбор поставщиков.'
            });
        }

        /* --- Новые и ушедшие страны между первым и последним периодом --- */
        if (countries.length && years.length >= 2) {
            var firstY = years[0], lastY = years[years.length - 1];
            var appeared = [], gone = [];
            countries.forEach(function (c) {
                var was = (byCountryYear[c + '|' + firstY] || 0) > 0;
                var now = (byCountryYear[c + '|' + lastY] || 0) > 0;
                if (!was && now) { appeared.push(c); }
                if (was && !now) { gone.push(c); }
            });
            m.appeared = appeared; m.gone = gone;
            if (appeared.length || gone.length) {
                signals.push({
                    id: 'churn', level: gone.length > appeared.length ? 'watch' : 'ok',
                    title: 'Обновление состава поставщиков',
                    value: '+' + appeared.length + ' / −' + gone.length,
                    text: 'С ' + firstY + ' по ' + lastY + ' появилось ' + appeared.length +
                        ' новых стран' + (appeared.length ? ' (' + appeared.slice(0, 3).join(', ') + (appeared.length > 3 ? '…' : '') + ')' : '') +
                        ', перестало поставлять ' + gone.length +
                        (gone.length ? ' (' + gone.slice(0, 3).join(', ') + (gone.length > 3 ? '…' : '') + ')' : '') + '.',
                    why: 'Новые поставщики расширяют выбор, а уход прежних его сужает.'
                });
            }
        }

        /* --- Расхождение натуральной и стоимостной динамики --- */
        if (years.length >= 2 && wCol && uCol) {
            var f = byYear[years[0]], l = byYear[years[years.length - 1]];
            if (f.w > 0 && f.usd > 0) {
                var dW = (l.w / f.w - 1) * 100;
                var dU = (l.usd / f.usd - 1) * 100;
                var gap = dU - dW;
                m.growthV = dW; m.growthUsd = dU; m.gap = gap;
                var lvl3 = Math.abs(gap) >= 15 ? 'watch' : 'ok';
                signals.push({
                    id: 'gap', level: lvl3, title: 'Объём против стоимости',
                    value: (gap >= 0 ? '+' : '') + round2(gap) + ' п.п.',
                    text: 'За ' + years[0] + '–' + years[years.length - 1] + ' объём изменился на ' +
                        (dW >= 0 ? '+' : '') + round2(dW) + '%, а стоимость на ' + (dU >= 0 ? '+' : '') + round2(dU) + '%. ' +
                        (gap > 15 ? 'Стоимость растёт быстрее объёма, значит рынок дорожает.'
                         : gap < -15 ? 'Объём растёт быстрее стоимости, значит цены падают.'
                         : 'Динамика объёма и стоимости сопоставима.'),
                    why: 'По расхождению видно, чем вызван рост рынка: спросом или подорожанием.'
                });
            }
        }

        /* --- Волатильность цены по годам --- */
        if (years.length >= 3 && wCol && uCol) {
            var prices = years.map(function (y) {
                var a = byYear[y];
                return a.w > 0 ? a.usd / a.w : null;
            }).filter(function (p) { return p !== null; });
            if (prices.length >= 3) {
                var mean = prices.reduce(function (s, p) { return s + p; }, 0) / prices.length;
                var sd = Math.sqrt(prices.reduce(function (s, p) { return s + Math.pow(p - mean, 2); }, 0) / prices.length);
                var cv = mean > 0 ? sd / mean * 100 : 0;
                m.cv = cv;
                var lvl4 = cv >= 25 ? 'risk' : (cv >= 12 ? 'watch' : 'ok');
                signals.push({
                    id: 'vol', level: lvl4, title: 'Волатильность цены',
                    value: round2(cv) + '%',
                    text: 'Средняя цена по годам колеблется на ' + round2(cv) + '% от среднего уровня ($' +
                        round2(mean) + '/кг). ' +
                        (lvl4 === 'risk' ? 'Цена нестабильна, закупку стоит планировать с запасом.'
                         : lvl4 === 'watch' ? 'Умеренные колебания цены.'
                         : 'Цена стабильна.'),
                    why: 'Коэффициент вариации показывает, насколько сильно цена отклоняется от своего среднего значения.'
                });
            }
        }

        /* --- Ценовая премия стран относительно рынка --- */
        if (wCol && uCol && totalW > 0 && countries.length > 1) {
            var mktPrice = totalUsd / totalW;
            var prem = countries.filter(function (c) { return byCountry[c].w > 0; })
                .map(function (c) {
                    return { name: c, price: byCountry[c].usd / byCountry[c].w,
                             share: byCountry[c].v / total * 100 };
                })
                .filter(function (p) { return p.share >= 3; }) // мелочь искажает картину
                .map(function (p) { p.prem = (p.price / mktPrice - 1) * 100; return p; })
                .sort(function (a, b) { return b.prem - a.prem; });
            if (prem.length >= 2) {
                var hi = prem[0], lo = prem[prem.length - 1];
                m.premiumHi = hi; m.premiumLo = lo;
                signals.push({
                    id: 'premium', level: 'ok', title: 'Ценовой разброс по странам',
                    value: round2(hi.prem) + '% … ' + round2(lo.prem) + '%',
                    text: 'Дороже всего покупает ' + hi.name + ' ($' + round2(hi.price) + '/кг, ' +
                        (hi.prem >= 0 ? '+' : '') + round2(hi.prem) + '% к средней $' + round2(mktPrice) + '/кг). ' +
                        'Дешевле всего ' + lo.name + ' ($' + round2(lo.price) + '/кг, ' + round2(lo.prem) + '%).',
                    why: 'Разница в цене обычно объясняется качеством, сортом или условиями поставки. Стоит сравнить предложения.'
                });
            }
        }

        /* --- Полнота последнего периода --- */
        if (years.length >= 3) {
            var vals = years.map(function (y) { return byYear[y].v; });
            var prev = vals.slice(0, -1);
            var avgPrev = prev.reduce(function (s, v) { return s + v; }, 0) / prev.length;
            var lastV = vals[vals.length - 1];
            if (avgPrev > 0 && lastV < avgPrev * 0.6) {
                m.partial = true;
                signals.push({
                    id: 'partial', level: 'watch', title: 'Последний период неполный',
                    value: round2(lastV / avgPrev * 100) + '% от среднего',
                    text: 'За ' + years[years.length - 1] + ' учтено заметно меньше обычного. ' +
                        'Скорее всего период ещё не закрыт, поэтому не сравнивайте его с полными годами напрямую.',
                    why: 'Страхует от вывода «рынок рухнул» в ситуации, когда данные за период просто не успели прийти.'
                });
            }
        }

        m.years = years.length;
        return {
            signals: signals,
            metrics: m,
            base: { unit: useWeight ? 'вес нетто' : 'стоимость USD',
                    countries: countries.length, years: years, total: total }
        };
    }

    /*
     * Матрица рекомендаций.
     *
     * Действие выводится правилами из уже посчитанных чисел, а не
     * свободным текстом: основание рекомендации остаётся прозрачным и
     * проверяемым, а формулировку при желании можно потом причесать
     * моделью, не трогая саму логику.
     *
     * Порог роста ±10% выбран как заметное изменение, которое не спишешь
     * на статистический шум в годовых данных.
     */
    function computeRecommendations(m) {
        var recs = [];
        var GROW = 10, DROP = -10;
        var concentrated = m.hhi !== null && m.hhi >= 2500;
        var dependent = m.leadShare !== null && m.leadShare >= 50;
        var growing = m.growthV !== null && m.growthV >= GROW;
        var shrinking = m.growthV !== null && m.growthV <= DROP;
        // Цена: если стоимость росла быстрее объёма — рынок дорожал
        var pricierMkt = m.gap !== null && m.gap >= 10;
        var cheaperMkt = m.gap !== null && m.gap <= -10;

        if (growing && !concentrated) {
            recs.push({ level: 'ok', action: 'Рассмотреть расширение закупок',
                because: 'Рынок растёт (' + (m.growthV >= 0 ? '+' : '') + round2(m.growthV) +
                    '% по объёму), при этом поставки распределены между многими странами (HHI ' +
                    formatNumber(m.hhi) + '), так что выбор поставщиков есть.' });
        }
        if (growing && concentrated) {
            recs.push({ level: 'watch', action: 'Искать альтернативных поставщиков',
                because: 'Рынок растёт, но сильно концентрирован (HHI ' + formatNumber(m.hhi) +
                    '): вход возможен, однако торг будет вести сильная сторона.' });
        }
        if (dependent) {
            recs.push({ level: 'risk', action: 'Снизить зависимость от ключевого поставщика',
                because: 'На ' + m.leadName + ' приходится ' + round2(m.leadShare) +
                    '% рынка. Сбой у него затронет большую часть поставок.' });
        }
        if (shrinking && pricierMkt) {
            recs.push({ level: 'risk', action: 'Готовиться к дефициту и росту цен',
                because: 'Объём падает (' + round2(m.growthV) + '%), а стоимость держится или растёт. Это ' +
                    'похоже на сокращение предложения, а не спроса.' });
        }
        if (growing && cheaperMkt) {
            recs.push({ level: 'ok', action: 'Благоприятное окно для закупки',
                because: 'Объём растёт, а цены снижаются. Предложение опережает спрос.' });
        }
        if (m.appeared && m.appeared.length) {
            recs.push({ level: 'watch', action: 'Квалифицировать новых поставщиков',
                because: 'На рынке появились: ' + m.appeared.slice(0, 4).join(', ') +
                    (m.appeared.length > 4 ? ' и другие' : '') +
                    '. Новые направления стоит проверить до того, как они понадобятся срочно.' });
        }
        if (m.gone && m.gone.length) {
            recs.push({ level: 'watch', action: 'Проверить причины ухода поставщиков',
                because: 'Перестали поставлять: ' + m.gone.slice(0, 4).join(', ') +
                    (m.gone.length > 4 ? ' и другие' : '') +
                    '. Если это регуляторные ограничения, они могут затронуть и другие направления.' });
        }
        if (m.cv !== null && m.cv >= 25) {
            recs.push({ level: 'watch', action: 'Фиксировать цену контрактом',
                because: 'Цена колеблется на ' + round2(m.cv) +
                    '% от среднего уровня, поэтому закупка по споту несёт ценовой риск.' });
        }
        if (m.premiumHi && m.premiumLo && (m.premiumHi.prem - m.premiumLo.prem) >= 40) {
            recs.push({ level: 'ok', action: 'Сравнить условия дорогих и дешёвых направлений',
                because: 'Разница цен между ' + m.premiumHi.name + ' и ' + m.premiumLo.name +
                    ' превышает ' + round2(m.premiumHi.prem - m.premiumLo.prem) +
                    ' п.п. Стоит понять, чем она объясняется: сортом, качеством или логистикой.' });
        }
        if (m.partial) {
            recs.push({ level: 'watch', action: 'Не сравнивать последний период с полными годами',
                because: 'За последний период учтено заметно меньше данных, скорее всего он ещё не закрыт.' });
        }

        return recs;
    }

    function renderSignalsAnalysis(data, headers) {
        var res = computeMarketSignals(data, headers);
        if (res.error) {
            analysisResults.innerHTML = '<div class="analysis-empty"><p>' + marketEsc(res.error) + '</p></div>';
            return;
        }
        if (!res.signals.length) {
            analysisResults.innerHTML = '<div class="analysis-empty"><p>Для сигналов нужны страны и хотя бы два периода.</p></div>';
            return;
        }

        var order = { risk: 0, watch: 1, ok: 2 };
        var list = res.signals.slice().sort(function (a, b) { return order[a.level] - order[b.level]; });

        var html = '<div class="signals-head">' +
            '<h3>Сигналы и риски</h3>' +
            '<span class="signals-base">база: ' + marketEsc(res.base.unit) + ' · ' +
            res.base.countries + ' стран · ' + res.base.years.length + ' периодов</span></div>';
        html += '<p class="signals-note">Все значения посчитаны по загруженным данным, без внешних источников и без моделей.</p>';
        html += '<div class="signals-grid">';
        list.forEach(function (s) {
            html += '<div class="signal-card signal-' + s.level + '">' +
                '<div class="signal-top">' +
                    '<span class="signal-title">' + marketEsc(s.title) + '</span>' +
                    '<span class="signal-level">' + signalLevelWord(s.level) + '</span>' +
                '</div>' +
                '<div class="signal-value">' + marketEsc(s.value) + '</div>' +
                '<div class="signal-text">' + marketEsc(s.text) + '</div>' +
                '<div class="signal-why">' + marketEsc(s.why) + '</div>' +
            '</div>';
        });
        html += '</div>';

        // Рекомендации: что делать с тем, что показали сигналы
        var recs = computeRecommendations(res.metrics);
        if (recs.length) {
            var rOrder = { risk: 0, watch: 1, ok: 2 };
            recs.sort(function (a, b) { return rOrder[a.level] - rOrder[b.level]; });
            html += '<div class="recs-head"><h3>Что делать</h3>' +
                '<span class="signals-base">выведено правилами из показателей выше</span></div>';
            html += '<div class="recs-list">';
            recs.forEach(function (r) {
                // Оба текста в одной обёртке: карточка это сетка «точка + текст»,
                // без неё второй абзац уезжал в колонку под точку и ломался
                // по одному слову в строке
                html += '<div class="rec-card rec-' + r.level + '">' +
                    '<div class="rec-body">' +
                        '<div class="rec-action">' + marketEsc(r.action) + '</div>' +
                        '<div class="rec-because">' + marketEsc(r.because) + '</div>' +
                    '</div>' +
                '</div>';
            });
            html += '</div>';
        }

        html += '<div class="analysis-export-actions">' +
            '<button class="btn btn-primary signals-export-xlsx">Скачать XLSX</button>' +
            '<button class="btn btn-secondary signals-export-csv">Скачать CSV</button></div>';
        analysisResults.innerHTML = html;

        var rows = list.map(function (s) {
            return {
                'Раздел': 'Сигнал',
                'Название': s.title, 'Уровень': signalLevelWord(s.level),
                'Значение': s.value, 'Вывод': s.text, 'Как считается': s.why
            };
        }).concat(recs.map(function (r) {
            return {
                'Раздел': 'Рекомендация',
                'Название': r.action, 'Уровень': signalLevelWord(r.level),
                'Значение': '', 'Вывод': r.because, 'Как считается': 'Правило матрицы решений'
            };
        }));
        var hdrs = ['Раздел', 'Название', 'Уровень', 'Значение', 'Вывод', 'Как считается'];
        analysisResults.querySelector('.signals-export-xlsx').addEventListener('click', function () {
            exportAnalysisXLSX(rows, hdrs, 'market_signals');
        });
        analysisResults.querySelector('.signals-export-csv').addEventListener('click', function () {
            exportAnalysisCSV(rows, hdrs, 'market_signals');
        });
    }

    // Контрагентский уровень (получатели/отправители/изготовители) —
    // отдельный тариф, в экспертном режиме недоступен даже в обход
    // скрытых карточек (напр. через консоль).
    var CONTRACTOR_ANALYSIS_TYPES = ['topReceivers', 'topSenders', 'topManufacturers'];

    function runAnalysis(type) {
        try {
            lastAnalysisType = type;

            if (isExpert && CONTRACTOR_ANALYSIS_TYPES.indexOf(type) !== -1) {
                analysisResults.innerHTML =
                    '<div class="analysis-empty"><p>Доступно на других тарифах</p></div>';
                return;
            }

            var fd = getFilteredAnalysisData();
            var data = fd.data;
            var headers = fd.headers;
            if (data.length === 0) {
                analysisResults.innerHTML =
                    '<div class="analysis-empty"><p>Сначала загрузите данные</p></div>';
                return;
            }

            if (type === 'volumes') {
                renderVolumesAnalysis(data, headers);
                return;
            }
            if (type === 'countries') {
                renderCountriesAnalysis(data, headers);
                return;
            }
            if (type === 'priceDynamics') {
                renderPriceDynamicsAnalysis(data, headers);
                return;
            }
            if (type === 'importStructure') {
                renderImportStructureAnalysis(data, headers);
                return;
            }
            if (type === 'manufacturerStructure') {
                renderImportStructureAnalysis(data, headers, null, null, {
                    sourceCol: COL_MANUFACTURER,
                    targetCol: COL_RECEIVER,
                    sourceLabel: 'Изготовитель',
                    targetLabel: 'Получатель',
                    exportName: 'manufacturer_structure'
                });
                return;
            }
            if (type === 'quarterlyPrices') {
                renderQuarterlyPricesAnalysis(data, headers);
                return;
            }
            if (type === 'topReceivers') {
                renderCompanyRankingAnalysis(data, headers);
                return;
            }
            if (type === 'topSenders') {
                renderCompanyRankingAnalysis(data, headers, null, null, {
                    companyCol: COL_SENDER,
                    companyLabel: 'Отправитель',
                    exportName: 'top_senders'
                });
                return;
            }
            if (type === 'topManufacturers') {
                renderCompanyRankingAnalysis(data, headers, null, null, {
                    companyCol: COL_MANUFACTURER,
                    companyLabel: 'Изготовитель',
                    exportName: 'top_manufacturers'
                });
                return;
            }
            if (type === 'signals') {
                renderSignalsAnalysis(data, headers);
                return;
            }
            if (type === 'marketChanges') {
                renderMarketChangesAnalysis(data, headers);
                return;
            }

            analysisResults.innerHTML = '';
        } catch (err) {
            analysisResults.innerHTML =
                '<div class="analysis-empty"><p>Ошибка анализа: ' + err.message + '</p></div>';
            console.error('Analysis error:', err);
        }
    }

    /* --- Анализ: изменения рынка между двумя сопоставимыми периодами --- */

    var MARKET_MONTH_INDEX = {
        'Январь': 1, 'Февраль': 2, 'Март': 3, 'Апрель': 4,
        'Май': 5, 'Июнь': 6, 'Июль': 7, 'Август': 8,
        'Сентябрь': 9, 'Октябрь': 10, 'Ноябрь': 11, 'Декабрь': 12
    };

    function marketEsc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function marketNumber(value) {
        if (typeof value === 'number') { return isFinite(value) ? value : 0; }
        var normalized = String(value == null ? '' : value)
            .replace(/[\s\u00A0]/g, '').replace(',', '.');
        var parsed = Number(normalized);
        return isFinite(parsed) ? parsed : 0;
    }

    function marketPeriodContext(headers, granularity) {
        return {
            granularity: granularity,
            dateCol: findColumn(headers, COL_DATE_REG) || findColumn(headers, COL_DATE_RELEASE),
            yearCol: findColumn(headers, COL_YEAR),
            quarterCol: findColumn(headers, COL_QUARTER),
            monthCol: findColumn(headers, COL_MONTH)
        };
    }

    function marketPeriodKey(row, ctx) {
        var date = ctx.dateCol ? parseDate(row[ctx.dateCol]) : null;
        var year = date ? date.getFullYear() : parseInt(row[ctx.yearCol], 10);
        if (!year || isNaN(year)) { return ''; }
        if (ctx.granularity === 'year') { return String(year); }

        if (ctx.granularity === 'quarter') {
            var quarter = date ? getQuarter(date.getMonth() + 1) :
                parseInt(String(row[ctx.quarterCol] || '').replace(/\D/g, ''), 10);
            return quarter >= 1 && quarter <= 4 ? year + '-Q' + quarter : '';
        }

        var month = date ? date.getMonth() + 1 : MARKET_MONTH_INDEX[String(row[ctx.monthCol] || '').trim()];
        return month >= 1 && month <= 12 ? year + '-' + String(month).padStart(2, '0') : '';
    }

    function marketCollectPeriods(data, headers, granularity) {
        var ctx = marketPeriodContext(headers, granularity);
        var found = {};
        data.forEach(function (row) {
            var key = marketPeriodKey(row, ctx);
            if (key) { found[key] = true; }
        });
        return Object.keys(found).sort();
    }

    function marketDimensionOptions(headers) {
        var result = [];
        var seen = {};
        function add(column, label, type) {
            if (column && !seen[column]) {
                seen[column] = true;
                result.push({ column: column, label: label, type: type || 'text' });
            }
        }
        add(findColumn(headers, COL_HS_CODE), 'Код ТН ВЭД', 'hs');
        add(findColumn(headers, 'Страна отправления'), 'Страна отправления');
        add(findColumn(headers, 'Страна происхождения'), 'Страна происхождения');
        add(findColumn(headers, 'Страна назначения'), 'Страна назначения');
        add(findColumn(headers, 'Регион получателя'), 'Регион получателя');
        add(findColumn(headers, COL_RECEIVER), 'Получатель');
        add(findColumn(headers, COL_SENDER), 'Отправитель');
        add(findColumn(headers, COL_MANUFACTURER), 'Изготовитель');
        add(findColumn(headers, 'Сегмент'), 'Сегмент получателя');
        add(findColumn(headers, 'Более крупный холдинг/объединение'), 'Холдинг / объединение');
        return result;
    }

    function marketMetricOptions(headers) {
        var result = [];
        if (findColumn(headers, COL_WEIGHT)) { result.push({ key: 'weight', label: 'Вес нетто, кг' }); }
        if (findColumn(headers, COL_STAT_USD)) { result.push({ key: 'usd', label: 'Стоимость, USD' }); }
        if (findColumn(headers, COL_WEIGHT) && findColumn(headers, COL_STAT_USD)) {
            result.push({ key: 'price', label: 'Средневзвешенная цена, USD/кг' });
        }
        result.push({ key: 'count', label: 'Количество строк' });
        return result;
    }

    function marketDimensionValue(row, column, isHs, hsLevel) {
        var raw = String(row[column] == null ? '' : row[column]).trim();
        if (!raw) { return ''; }
        if (!isHs) { return raw; }
        /*
         * У WITS «код товара» — это название раздела с диапазоном:
         * «Минеральное топливо, нефть, газ (27-27)». Срезать из него цифры
         * нельзя: получалось «2727», а из «(72-83)» — «7283», то есть
         * несуществующие коды вместо понятных разделов. Строку с буквами
         * оставляем как есть — это уже читаемое имя, а не код.
         */
        if (/[A-Za-zА-Яа-я]/.test(raw)) { return raw; }
        var digits = raw.replace(/\D/g, '');
        if (!digits) { return raw; }
        var level = Math.max(2, Math.min(parseInt(hsLevel, 10) || 10, 10));
        return digits.length > level ? digits.slice(0, level) : digits;
    }

    function marketAccumulatorValue(acc, metric) {
        if (metric === 'weight') { return acc.weight; }
        if (metric === 'usd') { return acc.usd; }
        if (metric === 'price') { return acc.weight > 0 ? acc.usd / acc.weight : 0; }
        return acc.count;
    }

    function computeMarketChanges(data, headers, options) {
        options = options || {};
        var granularity = options.granularity || 'year';
        var periods = marketCollectPeriods(data, headers, granularity);
        if (periods.length < 2) {
            return { error: 'Для сравнения нужны как минимум два периода.', periods: periods };
        }

        var currentPeriod = periods.indexOf(options.currentPeriod) !== -1
            ? options.currentPeriod : periods[periods.length - 1];
        var currentIndex = periods.indexOf(currentPeriod);
        var defaultBaseIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        var basePeriod = periods.indexOf(options.basePeriod) !== -1
            ? options.basePeriod : periods[defaultBaseIndex];
        if (basePeriod === currentPeriod) {
            return { error: 'Выберите разные периоды для сравнения.', periods: periods };
        }

        var dimensions = marketDimensionOptions(headers);
        var dimension = options.dimension || (dimensions[0] ? dimensions[0].column : '');
        var dimensionMeta = dimensions.filter(function (d) { return d.column === dimension; })[0];
        if (!dimensionMeta) { return { error: 'Не найден подходящий разрез данных.', periods: periods }; }

        var weightCol = findColumn(headers, COL_WEIGHT);
        var usdCol = findColumn(headers, COL_STAT_USD);
        var metric = options.metric || (weightCol ? 'weight' : (usdCol ? 'usd' : 'count'));
        if (metric === 'weight' && !weightCol) { return { error: 'Не найден столбец веса.', periods: periods }; }
        if ((metric === 'usd' || metric === 'price') && !usdCol) { return { error: 'Не найден столбец стоимости USD.', periods: periods }; }
        if (metric === 'price' && !weightCol) { return { error: 'Для цены USD/кг нужен столбец веса.', periods: periods }; }

        var ctx = marketPeriodContext(headers, granularity);
        var grouped = {};
        var totals = {
            base: { weight: 0, usd: 0, count: 0 },
            current: { weight: 0, usd: 0, count: 0 }
        };
        var hsLevel = parseInt(options.hsLevel, 10) || 10;

        data.forEach(function (row) {
            var period = marketPeriodKey(row, ctx);
            var side = period === basePeriod ? 'base' : (period === currentPeriod ? 'current' : '');
            if (!side) { return; }
            var key = marketDimensionValue(row, dimension, dimensionMeta.type === 'hs', hsLevel);
            if (!key) { return; }
            if (!grouped[key]) {
                grouped[key] = {
                    base: { weight: 0, usd: 0, count: 0 },
                    current: { weight: 0, usd: 0, count: 0 }
                };
            }
            var weight = weightCol ? marketNumber(row[weightCol]) : 0;
            var usd = usdCol ? marketNumber(row[usdCol]) : 0;
            grouped[key][side].weight += weight;
            grouped[key][side].usd += usd;
            grouped[key][side].count += 1;
            totals[side].weight += weight;
            totals[side].usd += usd;
            totals[side].count += 1;
        });

        var threshold = Math.max(0, marketNumber(options.threshold));
        var all = [];
        var growth = [], decline = [], added = [], disappeared = [];
        var EPS = 1e-9;

        Object.keys(grouped).forEach(function (key) {
            var baseValue = marketAccumulatorValue(grouped[key].base, metric);
            var currentValue = marketAccumulatorValue(grouped[key].current, metric);
            if (Math.max(Math.abs(baseValue), Math.abs(currentValue)) < threshold) { return; }
            var delta = currentValue - baseValue;
            var pct = Math.abs(baseValue) > EPS ? delta / Math.abs(baseValue) * 100 : null;
            var status;
            if (Math.abs(baseValue) <= EPS && currentValue > EPS) { status = 'new'; }
            else if (baseValue > EPS && Math.abs(currentValue) <= EPS) { status = 'disappeared'; }
            else if (delta > EPS) { status = 'growth'; }
            else if (delta < -EPS) { status = 'decline'; }
            else { status = 'stable'; }
            var item = {
                key: key, base: baseValue, current: currentValue,
                delta: delta, pct: pct, status: status
            };
            all.push(item);
            if (status === 'growth') { growth.push(item); }
            if (status === 'decline') { decline.push(item); }
            if (status === 'new') { added.push(item); }
            if (status === 'disappeared') { disappeared.push(item); }
        });

        growth.sort(function (a, b) { return b.delta - a.delta; });
        decline.sort(function (a, b) { return a.delta - b.delta; });
        added.sort(function (a, b) { return b.current - a.current; });
        disappeared.sort(function (a, b) { return b.base - a.base; });
        all.sort(function (a, b) { return Math.abs(b.delta) - Math.abs(a.delta); });

        var baseTotal = marketAccumulatorValue(totals.base, metric);
        var currentTotal = marketAccumulatorValue(totals.current, metric);
        return {
            periods: periods,
            basePeriod: basePeriod,
            currentPeriod: currentPeriod,
            granularity: granularity,
            dimension: dimension,
            dimensionLabel: dimensionMeta.label,
            metric: metric,
            baseTotal: baseTotal,
            currentTotal: currentTotal,
            totalDelta: currentTotal - baseTotal,
            totalPct: Math.abs(baseTotal) > EPS ? (currentTotal - baseTotal) / Math.abs(baseTotal) * 100 : null,
            all: all,
            growth: growth,
            decline: decline,
            added: added,
            disappeared: disappeared
        };
    }

    function marketMetricLabel(metric) {
        if (metric === 'weight') { return 'Вес нетто, кг'; }
        if (metric === 'usd') { return 'Стоимость, USD'; }
        if (metric === 'price') { return 'Цена, USD/кг'; }
        return 'Количество строк';
    }

    function marketFormatValue(value, metric) {
        if (metric === 'weight') {
            return formatNumber(round2(value / 1000)) + ' т';
        }
        if (metric === 'usd') { return '$ ' + formatNumber(round2(value)); }
        if (metric === 'price') { return '$ ' + formatNumber(round2(value)) + '/кг'; }
        return formatNumber(Math.round(value));
    }

    var MARKET_KIND_META = {
        growth:      { icon: '📈', sign: 'positive' },
        decline:     { icon: '📉', sign: 'negative' },
        new:         { icon: '✨', sign: 'positive' },
        disappeared: { icon: '👋', sign: 'negative' }
    };

    /*
     * Карточки-строки вместо сухой таблицы: имя позиции, база → текущее
     * значение, цветная пилюля с % и полоса-бар, наглядно показывающая
     * масштаб изменения относительно самой заметной позиции в списке.
     */
    function marketChangeTable(title, rows, result, topN, kind) {
        var meta = MARKET_KIND_META[kind] || { icon: '', sign: 'positive' };
        var shown = rows.slice(0, topN);
        var maxAbs = shown.reduce(function (m, r) { return Math.max(m, Math.abs(r.delta)); }, 0) || 1;

        var html = '<section class="market-change-section market-change-' + kind + '">';
        html += '<h4><span class="market-change-icon" aria-hidden="true">' + meta.icon + '</span>' +
            marketEsc(title) + '<span class="market-change-count">' + formatNumber(rows.length) + '</span></h4>';

        if (!shown.length) {
            html += '<div class="market-change-empty">Нет позиций</div></section>';
            return html;
        }

        html += '<div class="market-change-list">';
        shown.forEach(function (row) {
            var sign = row.delta >= 0 ? 'positive' : 'negative';
            var pctLabel = row.pct == null
                ? (kind === 'new' ? 'новая позиция' : 'позиция ушла')
                : (row.pct >= 0 ? '+' : '') + round2(row.pct) + '%';
            var barWidth = Math.max(4, Math.round(Math.abs(row.delta) / maxAbs * 100));
            var valuesLine = (kind === 'new')
                ? 'было 0 → стало ' + marketFormatValue(row.current, result.metric)
                : (kind === 'disappeared')
                    ? 'было ' + marketFormatValue(row.base, result.metric) + ' → стало 0'
                    : marketFormatValue(row.base, result.metric) + ' → ' + marketFormatValue(row.current, result.metric);

            // Голый код мало о чём говорит — подписываем товар из справочника
            var hsTitle = hsNameFor(row.key);
            var titleAttr = hsTitle ? row.key + ' — ' + hsTitle : row.key;

            html += '<div class="market-row">' +
                '<div class="market-row-top">' +
                    '<span class="market-row-name" title="' + marketEsc(titleAttr) + '">' + marketEsc(row.key) +
                        (hsTitle ? '<span class="market-row-hs">' + marketEsc(hsTitle) + '</span>' : '') +
                    '</span>' +
                    '<span class="market-row-pct ' + sign + '">' + pctLabel + '</span>' +
                '</div>' +
                '<div class="market-row-values">' + valuesLine +
                    ' <span class="market-row-delta ' + sign + '">(' + (row.delta >= 0 ? '+' : '') +
                    marketFormatValue(row.delta, result.metric) + ')</span></div>' +
                '<div class="market-row-bar"><div class="market-row-fill ' + sign + '" style="width:' + barWidth + '%"></div></div>' +
            '</div>';
        });
        html += '</div></section>';
        return html;
    }

    function renderMarketChangesResult(data, headers) {
        var output = analysisResults.querySelector('.market-changes-output');
        var options = {
            granularity: analysisResults.querySelector('.market-granularity').value,
            basePeriod: analysisResults.querySelector('.market-base-period').value,
            currentPeriod: analysisResults.querySelector('.market-current-period').value,
            dimension: analysisResults.querySelector('.market-dimension').value,
            hsLevel: analysisResults.querySelector('.market-hs-level').value,
            metric: analysisResults.querySelector('.market-metric').value,
            threshold: analysisResults.querySelector('.market-threshold').value
        };
        var topN = Math.max(3, Math.min(parseInt(analysisResults.querySelector('.market-topn').value, 10) || 10, 50));
        var result = computeMarketChanges(data, headers, options);
        if (result.error) {
            output.innerHTML = '<div class="analysis-empty"><p>' + marketEsc(result.error) + '</p></div>';
            return;
        }

        /*
         * В разрезе по ТН ВЭД позиции — это коды. Подтягиваем справочник
         * названий и перерисовываем: после загрузки hsNamesData всегда
         * объект (пусть и пустой), поэтому второго захода не будет.
         */
        var dimOpt = analysisResults.querySelector('.market-dimension');
        var isHsDim = dimOpt && dimOpt.options[dimOpt.selectedIndex] &&
            dimOpt.options[dimOpt.selectedIndex].getAttribute('data-type') === 'hs';
        if (isHsDim && !hsNamesData) {
            loadHsNames().then(function () { renderMarketChangesResult(data, headers); });
        }

        var deltaClass = result.totalDelta >= 0 ? 'growth' : 'decline';
        var totalPct = result.totalPct == null ? 'нет базы' :
            (result.totalPct >= 0 ? '+' : '') + round2(result.totalPct) + '%';
        var html = '<div class="market-change-summary">';
        html += '<div class="market-change-context">' + marketEsc(result.dimensionLabel) + ' · ' +
            marketEsc(marketMetricLabel(result.metric)) + ' · ' + marketEsc(result.basePeriod) + ' → ' +
            marketEsc(result.currentPeriod) + '</div>';
        html += '<div class="kpi-grid">' +
            '<div class="kpi-card"><div class="kpi-card-title">Базовый период</div><div class="kpi-card-value">' + marketFormatValue(result.baseTotal, result.metric) + '</div></div>' +
            '<div class="kpi-card"><div class="kpi-card-title">Сравниваемый период</div><div class="kpi-card-value">' + marketFormatValue(result.currentTotal, result.metric) + '</div></div>' +
            '<div class="kpi-card"><div class="kpi-card-title">Общее изменение</div><div class="kpi-card-value">' + totalPct + '</div><div class="kpi-card-delta ' + deltaClass + '">' + marketFormatValue(result.totalDelta, result.metric) + '</div></div>' +
            '<div class="kpi-card"><div class="kpi-card-title">Новые / исчезнувшие</div><div class="kpi-card-value">' + formatNumber(result.added.length) + ' / ' + formatNumber(result.disappeared.length) + '</div></div>' +
            '</div></div>';
        html += '<div class="market-change-grid">';
        html += marketChangeTable('Лидеры роста', result.growth, result, topN, 'growth');
        html += marketChangeTable('Лидеры падения', result.decline, result, topN, 'decline');
        html += marketChangeTable('Новые позиции', result.added, result, topN, 'new');
        html += marketChangeTable('Исчезнувшие позиции', result.disappeared, result, topN, 'disappeared');
        html += '</div>';
        html += '<div class="analysis-export-actions"><button class="btn btn-primary market-export-xlsx">Скачать XLSX</button>' +
            '<button class="btn btn-secondary market-export-csv">Скачать CSV</button></div>';
        output.innerHTML = html;

        var statusLabels = { growth: 'Рост', decline: 'Падение', new: 'Новая позиция', disappeared: 'Исчезнувшая позиция', stable: 'Без изменений' };
        var exportRows = result.all.map(function (row) {
            return {
                'Статус': statusLabels[row.status] || row.status,
                'Разрез': result.dimensionLabel,
                'Позиция': row.key,
                'Базовый период': result.basePeriod,
                'Сравниваемый период': result.currentPeriod,
                'Показатель': marketMetricLabel(result.metric),
                'База': round2(row.base),
                'Текущее значение': round2(row.current),
                'Изменение': round2(row.delta),
                'Изменение, %': row.pct == null ? '' : round2(row.pct)
            };
        });
        var exportHeaders = ['Статус', 'Разрез', 'Позиция', 'Базовый период', 'Сравниваемый период',
            'Показатель', 'База', 'Текущее значение', 'Изменение', 'Изменение, %'];
        output.querySelector('.market-export-xlsx').addEventListener('click', function () {
            exportAnalysisXLSX(exportRows, exportHeaders, 'market_changes');
        });
        output.querySelector('.market-export-csv').addEventListener('click', function () {
            exportAnalysisCSV(exportRows, exportHeaders, 'market_changes');
        });
    }

    function renderMarketChangesAnalysis(data, headers) {
        var dimensions = marketDimensionOptions(headers);
        var metrics = marketMetricOptions(headers);
        var granularities = [
            { key: 'year', label: 'Год' },
            { key: 'quarter', label: 'Квартал' },
            { key: 'month', label: 'Месяц' }
        ].filter(function (g) { return marketCollectPeriods(data, headers, g.key).length >= 2; });

        if (!dimensions.length || !granularities.length) {
            analysisResults.innerHTML = '<div class="analysis-empty"><p>Для анализа нужны два периода и хотя бы один разрез: ТН ВЭД, страна, регион или компания.</p></div>';
            return;
        }

        var html = '<div class="market-changes-config"><h3>Радар изменений рынка</h3>' +
            '<p class="market-config-hint">Сравните одинаковые по масштабу периоды. Минимальный порог помогает убрать статистический шум.</p>' +
            '<div class="market-config-grid">';
        html += '<label><span>Периодичность</span><select class="market-granularity">' +
            granularities.map(function (g) { return '<option value="' + g.key + '">' + g.label + '</option>'; }).join('') + '</select></label>';
        html += '<label><span>Базовый период</span><select class="market-base-period"></select></label>';
        html += '<label><span>Сравниваемый период</span><select class="market-current-period"></select></label>';
        html += '<label><span>Разрез</span><select class="market-dimension">' +
            dimensions.map(function (d) { return '<option value="' + marketEsc(d.column) + '" data-type="' + d.type + '">' + marketEsc(d.label) + '</option>'; }).join('') + '</select></label>';
        html += '<label class="market-hs-field"><span>Уровень ТН ВЭД</span><select class="market-hs-level">' +
            '<option value="2">HS2</option><option value="4" selected>HS4</option><option value="6">HS6</option><option value="10">HS10</option></select></label>';
        html += '<label><span>Показатель</span><select class="market-metric">' +
            metrics.map(function (m) { return '<option value="' + m.key + '">' + marketEsc(m.label) + '</option>'; }).join('') + '</select></label>';
        html += '<label><span>Минимальный объём</span><input class="market-threshold" type="number" min="0" step="any" value="0"></label>';
        html += '<label><span>Показывать позиций</span><input class="market-topn" type="number" min="3" max="50" value="10"></label>';
        html += '<button class="btn btn-primary market-run-btn">Сравнить периоды</button></div></div>';
        html += '<div class="market-changes-output"></div>';
        analysisResults.innerHTML = html;

        var granularityEl = analysisResults.querySelector('.market-granularity');
        var baseEl = analysisResults.querySelector('.market-base-period');
        var currentEl = analysisResults.querySelector('.market-current-period');
        var dimensionEl = analysisResults.querySelector('.market-dimension');
        var hsField = analysisResults.querySelector('.market-hs-field');

        function refreshPeriods() {
            var periods = marketCollectPeriods(data, headers, granularityEl.value);
            baseEl.innerHTML = periods.map(function (p) { return '<option value="' + p + '">' + p + '</option>'; }).join('');
            currentEl.innerHTML = baseEl.innerHTML;
            currentEl.value = periods[periods.length - 1];
            baseEl.value = periods[periods.length - 2];
        }
        function refreshHsField() {
            var opt = dimensionEl.options[dimensionEl.selectedIndex];
            hsField.hidden = !opt || opt.getAttribute('data-type') !== 'hs';
        }

        granularityEl.addEventListener('change', refreshPeriods);
        dimensionEl.addEventListener('change', refreshHsField);
        analysisResults.querySelector('.market-run-btn').addEventListener('click', function () {
            renderMarketChangesResult(data, headers);
        });
        refreshPeriods();
        refreshHsField();
        renderMarketChangesResult(data, headers);
    }

    // --- Анализ: Объёмы и стоимость по периодам ---
    function renderVolumesAnalysis(data, headers) {
        var weightCol = findColumn(headers, COL_WEIGHT);
        var statUsdCol = findColumn(headers, COL_STAT_USD);
        var rubCtx = buildRubCtx(headers);
        var rubCol = rubCtx.customsCol || rubCtx.invoiceRubCol || rubCtx.statUsdCol;
        var yearCol = findColumn(headers, COL_YEAR);
        var quarterCol = findColumn(headers, COL_QUARTER);
        var monthCol = findColumn(headers, COL_MONTH);

        if (!weightCol && !statUsdCol && !rubCol) {
            analysisResults.innerHTML = '<div class="analysis-empty"><p>Не найдены столбцы веса или стоимости. Выполните обработку с маппингом.</p></div>';
            return;
        }
        if (!yearCol) {
            analysisResults.innerHTML = '<div class="analysis-empty"><p>Не найден столбец «Год». Выполните обработку с извлечением дат.</p></div>';
            return;
        }

        // Группируем по годам
        var byYear = {};
        // Группируем по год+квартал
        var byQuarter = {};
        // Группируем по год+месяц
        var byMonth = {};
        var MONTH_ORDER = { 'Январь':1,'Февраль':2,'Март':3,'Апрель':4,'Май':5,'Июнь':6,'Июль':7,'Август':8,'Сентябрь':9,'Октябрь':10,'Ноябрь':11,'Декабрь':12 };

        data.forEach(function (row) {
            var year = String(row[yearCol] || '').trim();
            if (!year) { return; }

            var weight = Number(row[weightCol]) || 0;
            var usd = Number(row[statUsdCol]) || 0;
            var rub = rubCol ? getRowRubValue(row, rubCtx) : 0;

            if (!byYear[year]) { byYear[year] = { weight: 0, usd: 0, rub: 0 }; }
            byYear[year].weight += weight;
            byYear[year].usd += usd;
            byYear[year].rub += rub;

            if (quarterCol) {
                var q = String(row[quarterCol] || '').trim();
                if (q) {
                    var key = year + ' Q' + q;
                    if (!byQuarter[key]) { byQuarter[key] = { weight: 0, usd: 0, rub: 0, year: year, q: q }; }
                    byQuarter[key].weight += weight;
                    byQuarter[key].usd += usd;
                    byQuarter[key].rub += rub;
                }
            }

            if (monthCol) {
                var mon = String(row[monthCol] || '').trim();
                if (mon) {
                    var mkey = year + '_' + String(MONTH_ORDER[mon] || 0).padStart(2, '0') + '_' + mon;
                    if (!byMonth[mkey]) { byMonth[mkey] = { weight: 0, usd: 0, rub: 0, year: year, mon: mon }; }
                    byMonth[mkey].weight += weight;
                    byMonth[mkey].usd += usd;
                    byMonth[mkey].rub += rub;
                }
            }
        });

        var yearKeys = Object.keys(byYear).sort();
        var quarterKeys = Object.keys(byQuarter).sort();

        // --- Определяем неполный год (последний, если у него меньше кварталов) ---
        var fullYears = yearKeys.slice();
        var partialYear = null;
        var partialLabel = '';
        if (quarterCol && yearKeys.length >= 2) {
            var lastY = yearKeys[yearKeys.length - 1];
            var lastYearQuarters = quarterKeys.filter(function (k) { return byQuarter[k].year === lastY; });
            var prevY = yearKeys[yearKeys.length - 2];
            var prevYearQuarters = quarterKeys.filter(function (k) { return byQuarter[k].year === prevY; });
            if (lastYearQuarters.length < prevYearQuarters.length && lastYearQuarters.length < 4) {
                partialYear = lastY;
                partialLabel = 'Q' + lastYearQuarters.map(function (k) { return byQuarter[k].q; }).join('-') + ' ' + lastY;
                fullYears = yearKeys.slice(0, -1);
            }
        }

        // --- Рассчёт CAGR ---
        function calcCAGR(first, last, years) {
            if (!first || first <= 0 || years <= 0) { return null; }
            return (Math.pow(last / first, 1 / years) - 1) * 100;
        }

        var cagrYears = fullYears.length >= 2 ? fullYears.length - 1 : 0;
        var cagrWeight = null, cagrUsd = null, cagrRub = null;
        if (cagrYears > 0) {
            var fy = fullYears[0], ly = fullYears[fullYears.length - 1];
            if (weightCol) { cagrWeight = calcCAGR(byYear[fy].weight, byYear[ly].weight, cagrYears); }
            if (statUsdCol) { cagrUsd = calcCAGR(byYear[fy].usd, byYear[ly].usd, cagrYears); }
            if (rubCol) { cagrRub = calcCAGR(byYear[fy].rub, byYear[ly].rub, cagrYears); }
        }

        // --- Таблица по годам ---
        var html = '<div class="analysis-section">';
        html += '<h3 class="analysis-section-title">По годам</h3>';
        html += '<div class="data-table-wrapper"><table class="data-table">';
        html += '<thead><tr><th>Год</th>';
        if (weightCol) { html += '<th>Объём (тонн)</th>'; }
        if (statUsdCol) { html += '<th>Стоимость (тыс. USD)</th>'; }
        if (rubCol) { html += '<th>Стоимость (тыс. нац. вал.)</th>'; }
        html += '</tr></thead><tbody>';
        yearKeys.forEach(function (y) {
            var d = byYear[y];
            var label = (y === partialYear) ? partialLabel : y;
            html += '<tr><td>' + label + '</td>';
            if (weightCol) { html += '<td class="numeric">' + formatNumber(round2(d.weight / 1000)) + '</td>'; }
            if (statUsdCol) { html += '<td class="numeric">' + formatNumber(round2(d.usd / 1000)) + '</td>'; }
            if (rubCol) { html += '<td class="numeric">' + formatNumber(round2(d.rub / 1000)) + '</td>'; }
            html += '</tr>';
        });
        // Строка CAGR
        if (cagrYears > 0) {
            html += '<tr style="font-weight:600;border-top:2px solid var(--color-border)"><td>CAGR</td>';
            if (weightCol) { html += '<td class="numeric">' + (cagrWeight !== null ? round2(cagrWeight) + '%' : '—') + '</td>'; }
            if (statUsdCol) { html += '<td class="numeric">' + (cagrUsd !== null ? round2(cagrUsd) + '%' : '—') + '</td>'; }
            if (rubCol) { html += '<td class="numeric">' + (cagrRub !== null ? round2(cagrRub) + '%' : '—') + '</td>'; }
            html += '</tr>';
        }
        html += '</tbody></table></div></div>';

        // Годовые данные не имеют кварталов: приложение кладёт весь год в Q1.
        // Тогда «по кварталам» — это те же годовые суммы под ярлыком Q1, что
        // вводит в заблуждение. Определяем такой случай: единственный квартал
        // среди всех данных — Q1.
        var distinctQ = {};
        quarterKeys.forEach(function (k) { distinctQ[byQuarter[k].q] = true; });
        var qNums = Object.keys(distinctQ);
        var quartersAreAnnual = qNums.length === 1 && qNums[0] === '1';

        // --- Таблица по кварталам ---
        if (quarterKeys.length > 0 && quartersAreAnnual) {
            html += '<div class="analysis-section">';
            html += '<h3 class="analysis-section-title">По кварталам</h3>';
            html += '<div class="analysis-note">Разбивка по кварталам недоступна: ' +
                'загружены годовые данные (по одному значению на год). ' +
                'Чтобы увидеть кварталы Q1–Q4, загрузите данные с частотой ' +
                'При месячной частоте приложение сложит месяцы в кварталы.</div>';
            html += '</div>';
        } else if (quarterKeys.length > 0) {
            html += '<div class="analysis-section">';
            html += '<h3 class="analysis-section-title">По кварталам</h3>';
            html += '<div class="data-table-wrapper"><table class="data-table">';
            html += '<thead><tr><th>Период</th>';
            if (weightCol) { html += '<th>Объём (тонн)</th>'; }
            if (statUsdCol) { html += '<th>Стоимость (тыс. USD)</th>'; }
            if (rubCol) { html += '<th>Стоимость (тыс. нац. вал.)</th>'; }
            html += '</tr></thead><tbody>';
            quarterKeys.forEach(function (key) {
                var d = byQuarter[key];
                html += '<tr><td>' + key + '</td>';
                if (weightCol) { html += '<td class="numeric">' + formatNumber(round2(d.weight / 1000)) + '</td>'; }
                if (statUsdCol) { html += '<td class="numeric">' + formatNumber(round2(d.usd / 1000)) + '</td>'; }
                if (rubCol) { html += '<td class="numeric">' + formatNumber(round2(d.rub / 1000)) + '</td>'; }
                html += '</tr>';
            });
            html += '</tbody></table></div></div>';
        }

        // --- Таблица по месяцам ---
        var monthKeys = Object.keys(byMonth).sort();
        if (monthKeys.length > 0) {
            html += '<div class="analysis-section">';
            html += '<h3 class="analysis-section-title">По месяцам</h3>';
            html += '<div class="data-table-wrapper"><table class="data-table">';
            html += '<thead><tr><th>Период</th>';
            if (weightCol) { html += '<th>Объём (тонн)</th>'; }
            if (statUsdCol) { html += '<th>Стоимость (тыс. USD)</th>'; }
            if (rubCol) { html += '<th>Стоимость (тыс. нац. вал.)</th>'; }
            html += '</tr></thead><tbody>';
            monthKeys.forEach(function (key) {
                var d = byMonth[key];
                var label = d.mon + ' ' + d.year;
                html += '<tr><td>' + label + '</td>';
                if (weightCol) { html += '<td class="numeric">' + formatNumber(round2(d.weight / 1000)) + '</td>'; }
                if (statUsdCol) { html += '<td class="numeric">' + formatNumber(round2(d.usd / 1000)) + '</td>'; }
                if (rubCol) { html += '<td class="numeric">' + formatNumber(round2(d.rub / 1000)) + '</td>'; }
                html += '</tr>';
            });
            html += '</tbody></table></div></div>';
        }

        // --- Графики по метрикам (по 1 на каждую) ---
        var metrics = [];
        if (weightCol) { metrics.push({ key: 'weight', title: 'тонн', unit: 'тонн', div: 1000, cagr: cagrWeight }); }
        if (statUsdCol) { metrics.push({ key: 'usd', title: 'млн долл. США', unit: 'млн USD', div: 1000000, cagr: cagrUsd }); }
        if (rubCol) { metrics.push({ key: 'rub', title: 'млн нац. вал.', unit: 'млн нац. вал.', div: 1000000, cagr: cagrRub }); }

        if (yearKeys.length >= 1 && metrics.length > 0) {
            html += '<div class="analysis-section">';
            html += '<h3 class="analysis-section-title">Динамика по годам</h3>';
            html += '<div class="analysis-charts-row">';

            metrics.forEach(function (m, mi) {
                // Собираем значения: полные годы + неполный
                var labels = [];
                var values = [];
                var isPartial = [];
                fullYears.forEach(function (y) {
                    labels.push(y);
                    values.push(round2(byYear[y][m.key] / m.div));
                    isPartial.push(false);
                });
                if (partialYear) {
                    labels.push(partialLabel);
                    values.push(round2(byYear[partialYear][m.key] / m.div));
                    isPartial.push(true);
                }

                // YoY рост % между полными годами
                var yoyGrowth = [];
                for (var g = 1; g < fullYears.length; g++) {
                    var prev = byYear[fullYears[g - 1]][m.key];
                    var curr = byYear[fullYears[g]][m.key];
                    yoyGrowth.push(prev > 0 ? round2((curr - prev) / prev * 100) : null);
                }

                var colSlot = 90; // ширина слота на один столбец (столбец + отступ + место для %)
                var pad = { top: 50, right: 20, bottom: 45, left: 20 };
                var innerW = Math.max(labels.length * colSlot, 200);
                var chartW = innerW + pad.left + pad.right;
                var chartH = 280;
                var innerH = chartH - pad.top - pad.bottom;

                var maxVal = Math.max.apply(null, values) * 1.2;
                if (maxVal === 0) { maxVal = 1; }

                var gap = innerW / labels.length;
                var barW = Math.min(52, gap * 0.55);

                html += '<div class="analysis-chart-card">';
                html += '<svg class="analysis-chart analysis-chart-metric" width="' + chartW + '" height="' + chartH + '" viewBox="0 0 ' + chartW + ' ' + chartH + '">';
                html += '<style>text { font-family: ' + CHART_FONT + '; }</style>';

                // Заголовок метрики
                html += '<text x="' + pad.left + '" y="18" font-size="12" font-weight="600" fill="' + CHART_COLORS.textMuted + '">' + m.title + '</text>';

                // CAGR бейдж
                if (m.cagr !== null) {
                    var cagrText = round2(m.cagr) + '%';
                    var cagrX = chartW - pad.right;
                    html += '<text x="' + (cagrX - 40) + '" y="16" font-size="11" font-weight="700" fill="' + CHART_COLORS.primary + '">CAGR</text>';
                    // Бейдж фон
                    html += '<rect x="' + (cagrX - 40) + '" y="20" width="50" height="20" rx="10" fill="' + CHART_COLORS.primary + '" opacity="0.1"/>';
                    html += '<text x="' + (cagrX - 15) + '" y="34" font-size="12" font-weight="700" fill="' + CHART_COLORS.primary + '" text-anchor="middle">' + cagrText + '</text>';
                }

                // Столбцы
                labels.forEach(function (label, i) {
                    var val = values[i];
                    var barH = (val / maxVal) * innerH;
                    var x = pad.left + gap * i + (gap - barW) / 2;
                    var yBar = pad.top + innerH - barH;
                    var fillColor = isPartial[i] ? '#93B4F0' : CHART_COLORS.primary;

                    html += '<rect x="' + x + '" y="' + yBar + '" width="' + barW + '" height="' + barH + '" fill="' + fillColor + '" rx="3"/>';
                    // Значение над столбцом
                    html += '<text x="' + (x + barW / 2) + '" y="' + (yBar - 6) + '" text-anchor="middle" font-size="10" font-weight="600" fill="' + CHART_COLORS.text + '">' + formatNumber(val) + '</text>';
                    // Подпись под столбцом
                    html += '<text x="' + (x + barW / 2) + '" y="' + (pad.top + innerH + 16) + '" text-anchor="middle" font-size="10" fill="' + CHART_COLORS.textMuted + '">' + label + '</text>';
                });

                // YoY рост % — линия и подписи между столбцами
                if (yoyGrowth.length > 0) {
                    var points = [];
                    for (var gi = 0; gi < fullYears.length; gi++) {
                        var cx = pad.left + gap * gi + gap / 2;
                        var val = values[gi];
                        var cy = pad.top + innerH - (val / maxVal) * innerH;
                        points.push({ x: cx, y: cy });
                    }
                    // Линия роста (кривая)
                    if (points.length >= 2) {
                        var pathD = 'M' + points[0].x + ',' + points[0].y;
                        for (var pi = 1; pi < points.length; pi++) {
                            var cpx = (points[pi - 1].x + points[pi].x) / 2;
                            pathD += ' C' + cpx + ',' + points[pi - 1].y + ' ' + cpx + ',' + points[pi].y + ' ' + points[pi].x + ',' + points[pi].y;
                        }
                        html += '<path d="' + pathD + '" fill="none" stroke="#C4B5FD" stroke-width="2"/>';
                    }
                    // Подписи % роста между столбцами
                    for (var yi = 0; yi < yoyGrowth.length; yi++) {
                        if (yoyGrowth[yi] === null) { continue; }
                        var midX = (points[yi].x + points[yi + 1].x) / 2;
                        var midY = Math.min(points[yi].y, points[yi + 1].y) - 2;
                        var growthTxt = round2(yoyGrowth[yi]) + '%';
                        html += '<text x="' + midX + '" y="' + midY + '" text-anchor="middle" font-size="10" fill="#8B5CF6">' + growthTxt + '</text>';
                    }
                }

                html += '</svg>';
                html += '</div>';
            });

            html += '</div>'; // .analysis-charts-row
            html += '<button class="btn btn-secondary analysis-export-chart-png" style="margin-top:8px;font-size:12px">Скачать графики PNG</button>';
            html += '</div>'; // .analysis-section
        }

        // --- Графики по месяцам ---
        if (monthKeys.length > 1 && metrics.length > 0) {
            html += '<div class="analysis-section">';
            html += '<h3 class="analysis-section-title">Динамика по месяцам</h3>';

            metrics.forEach(function (m) {
                var mLabels = [];
                var mValues = [];
                var mYears = [];
                monthKeys.forEach(function (key) {
                    var d = byMonth[key];
                    mLabels.push(d.mon.slice(0, 3) + ' ' + String(d.year).slice(2));
                    mValues.push(round2(d[m.key] / m.div));
                    mYears.push(d.year);
                });

                var colSlotM = Math.max(28, Math.min(48, 700 / mLabels.length));
                var padM = { top: 50, right: 20, bottom: 50, left: 20 };
                var innerWM = Math.max(mLabels.length * colSlotM, 300);
                var chartWM = innerWM + padM.left + padM.right;
                var chartHM = 280;
                var innerHM = chartHM - padM.top - padM.bottom;

                var maxValM = Math.max.apply(null, mValues) * 1.2;
                if (maxValM === 0) { maxValM = 1; }

                var gapM = innerWM / mLabels.length;
                var barWM = Math.min(36, gapM * 0.7);

                var uniqueYears = [];
                mYears.forEach(function (y) { if (uniqueYears.indexOf(y) === -1) { uniqueYears.push(y); } });

                html += '<div style="overflow-x:auto;margin-bottom:16px">';
                html += '<svg class="analysis-chart analysis-chart-monthly" width="' + chartWM + '" height="' + chartHM + '" viewBox="0 0 ' + chartWM + ' ' + chartHM + '">';
                html += '<style>text { font-family: ' + CHART_FONT + '; }</style>';

                html += '<text x="' + padM.left + '" y="18" font-size="12" font-weight="600" fill="' + CHART_COLORS.textMuted + '">' + m.title + '</text>';

                for (var gridI = 0; gridI <= 4; gridI++) {
                    var gridY = padM.top + innerHM * (1 - gridI / 4);
                    html += '<line x1="' + padM.left + '" y1="' + gridY + '" x2="' + (padM.left + innerWM) + '" y2="' + gridY + '" stroke="' + CHART_COLORS.grid + '" stroke-width="0.5"/>';
                }

                mLabels.forEach(function (label, i) {
                    var val = mValues[i];
                    var barH = (val / maxValM) * innerHM;
                    var x = padM.left + gapM * i + (gapM - barWM) / 2;
                    var yBar = padM.top + innerHM - barH;
                    var yearIdx = uniqueYears.indexOf(mYears[i]);
                    var fillColor = YEAR_COLORS[yearIdx % YEAR_COLORS.length];

                    html += '<rect x="' + x + '" y="' + yBar + '" width="' + barWM + '" height="' + barH + '" fill="' + fillColor + '" rx="2"/>';
                    html += '<text x="' + (x + barWM / 2) + '" y="' + (padM.top + innerHM + 14) + '" text-anchor="middle" font-size="8" fill="' + CHART_COLORS.textMuted + '" transform="rotate(-45,' + (x + barWM / 2) + ',' + (padM.top + innerHM + 14) + ')">' + label + '</text>';
                });

                html += '</svg></div>';

                if (uniqueYears.length > 1) {
                    html += '<div class="chart-legend" style="margin-bottom:12px">';
                    uniqueYears.forEach(function (y, yi) {
                        html += '<span class="chart-legend-item"><span class="chart-legend-color" style="background:' + YEAR_COLORS[yi % YEAR_COLORS.length] + '"></span>' + y + '</span>';
                    });
                    html += '</div>';
                }
            });

            html += '<button class="btn btn-secondary analysis-export-monthly-png" style="margin-top:8px;font-size:12px">Скачать графики по месяцам PNG</button>';
            html += '</div>';
        }

        // --- Кнопки экспорта ---
        html += '<div class="processing-export" style="margin-top:20px">';
        html += '<button class="btn btn-primary analysis-export-xlsx">Скачать XLSX</button>';
        html += '<button class="btn btn-secondary analysis-export-csv">Скачать CSV</button>';
        html += '</div>';

        analysisResults.innerHTML = html;

        // Обработчик экспорта графиков PNG (все метрики в одну картинку)
        var chartPngBtn = analysisResults.querySelector('.analysis-export-chart-png');
        if (chartPngBtn) {
            chartPngBtn.addEventListener('click', function () {
                var svgs = analysisResults.querySelectorAll('.analysis-chart-metric');
                if (svgs.length === 0) { return; }
                exportChartsRowPNG(svgs, baseFileName() + '_volumes_charts.png');
            });
        }

        // Обработчик экспорта графиков по месяцам PNG
        var monthlyPngBtn = analysisResults.querySelector('.analysis-export-monthly-png');
        if (monthlyPngBtn) {
            monthlyPngBtn.addEventListener('click', function () {
                var svgs = analysisResults.querySelectorAll('.analysis-chart-monthly');
                if (svgs.length === 0) { return; }
                exportChartsRowPNG(svgs, baseFileName() + '_volumes_monthly.png');
            });
        }

        // Подготовим данные для экспорта
        var exportRows = [];

        // Годовые данные
        exportRows.push({ 'Период': '--- По годам ---' });
        yearKeys.forEach(function (y) {
            var d = byYear[y];
            var label = (y === partialYear) ? partialLabel : y;
            var row = { 'Период': label };
            if (weightCol) { row['Объём (тонн)'] = round2(d.weight / 1000); }
            if (statUsdCol) { row['Стоимость (тыс. USD)'] = round2(d.usd / 1000); }
            if (rubCol) { row['Стоимость (тыс. нац. вал.)'] = round2(d.rub / 1000); }
            exportRows.push(row);
        });
        // CAGR в экспорт
        if (cagrYears > 0) {
            var cagrRow = { 'Период': 'CAGR' };
            if (weightCol) { cagrRow['Объём (тонн)'] = cagrWeight !== null ? round2(cagrWeight) + '%' : ''; }
            if (statUsdCol) { cagrRow['Стоимость (тыс. USD)'] = cagrUsd !== null ? round2(cagrUsd) + '%' : ''; }
            if (rubCol) { cagrRow['Стоимость (тыс. нац. вал.)'] = cagrRub !== null ? round2(cagrRub) + '%' : ''; }
            exportRows.push(cagrRow);
        }

        // Квартальные данные
        if (quarterKeys.length > 0) {
            exportRows.push({ 'Период': '' });
            exportRows.push({ 'Период': '--- По кварталам ---' });
            quarterKeys.forEach(function (key) {
                var d = byQuarter[key];
                var row = { 'Период': key };
                if (weightCol) { row['Объём (тонн)'] = round2(d.weight / 1000); }
                if (statUsdCol) { row['Стоимость (тыс. USD)'] = round2(d.usd / 1000); }
                if (rubCol) { row['Стоимость (тыс. нац. вал.)'] = round2(d.rub / 1000); }
                exportRows.push(row);
            });
        }

        // Месячные данные
        if (monthKeys.length > 0) {
            exportRows.push({ 'Период': '' });
            exportRows.push({ 'Период': '--- По месяцам ---' });
            monthKeys.forEach(function (key) {
                var d = byMonth[key];
                var row = { 'Период': d.mon + ' ' + d.year };
                if (weightCol) { row['Объём (тонн)'] = round2(d.weight / 1000); }
                if (statUsdCol) { row['Стоимость (тыс. USD)'] = round2(d.usd / 1000); }
                if (rubCol) { row['Стоимость (тыс. нац. вал.)'] = round2(d.rub / 1000); }
                exportRows.push(row);
            });
        }

        var exportHeaders = ['Период'];
        if (weightCol) { exportHeaders.push('Объём (тонн)'); }
        if (statUsdCol) { exportHeaders.push('Стоимость (тыс. USD)'); }
        if (rubCol) { exportHeaders.push('Стоимость (тыс. нац. вал.)'); }

        // Обработчики экспорта
        analysisResults.querySelector('.analysis-export-xlsx').addEventListener('click', function () {
            exportAnalysisXLSX(exportRows, exportHeaders, 'volumes');
        });
        analysisResults.querySelector('.analysis-export-csv').addEventListener('click', function () {
            exportAnalysisCSV(exportRows, exportHeaders, 'volumes');
        });
    }

    // --- Общие функции экспорта анализа ---
    function exportAnalysisXLSX(rows, headers, name) {
        if (typeof XLSX === 'undefined') { return; }
        var ws = XLSX.utils.json_to_sheet(rows, { header: headers });
        ws['!cols'] = headers.map(function (h) {
            return { wch: Math.max(h.length + 2, 15) };
        });
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, name);
        appendSourceSheet(wb);
        XLSX.writeFile(wb, baseFileName() + '_' + name + '.xlsx');
    }

    function exportAnalysisCSV(rows, headers, name) {
        function csvCell(value) {
            var text = value != null ? String(value) : '';
            if (text.indexOf(CSV_SEPARATOR) !== -1 || /["\r\n]/.test(text)) {
                return '"' + text.replace(/"/g, '""') + '"';
            }
            return text;
        }
        var lines = [headers.map(csvCell).join(CSV_SEPARATOR)];
        rows.forEach(function (row) {
            var vals = headers.map(function (h) { return csvCell(row[h]); });
            lines.push(vals.join(CSV_SEPARATOR));
        });
        var blob = new Blob([UTF8_BOM + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        triggerDownload(blob, baseFileName() + '_' + name + '.csv');
    }

    function exportChartPNG(svgEl, fileName) {
        var svgData = new XMLSerializer().serializeToString(svgEl);
        var canvas = document.createElement('canvas');
        var scale = 2; // Retina
        canvas.width = svgEl.width.baseVal.value * scale;
        canvas.height = svgEl.height.baseVal.value * scale;
        var ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        var img = new Image();
        img.onload = function () {
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(function (blob) {
                triggerDownload(blob, fileName);
            }, 'image/png');
        };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
    }

    // SVG-элемент → PNG dataUrl (Promise)
    function svgElementToDataUrl(svgEl) {
        return new Promise(function(resolve, reject) {
            var vb = svgEl.viewBox && svgEl.viewBox.baseVal;
            var w = (vb && vb.width) || parseFloat(svgEl.getAttribute('width')) || 800;
            var h = (vb && vb.height) || parseFloat(svgEl.getAttribute('height')) || 400;
            var scale = 2;
            var svgData = new XMLSerializer().serializeToString(svgEl);
            var dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement('canvas');
                canvas.width = w * scale;
                canvas.height = h * scale;
                var ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve({ dataUrl: canvas.toDataURL('image/png'), w: w, h: h });
            };
            img.onerror = function() { reject(new Error('SVG render failed')); };
            img.src = dataUrl;
        });
    }

    // Рендерит HTML слайда в невидимый div, извлекает SVG-графики, конвертирует в PNG
    // Возвращает Promise<Array<{dataUrl, w, h}>>
    function renderSlideSvgs(slide, data, headers) {
        return new Promise(function(resolve) {
            var html = renderPresSlideByType(slide, data, headers);
            var tmp = document.createElement('div');
            tmp.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:960px;visibility:hidden';
            document.body.appendChild(tmp);
            tmp.innerHTML = html;
            setTimeout(function() {
                var svgs = Array.prototype.slice.call(tmp.querySelectorAll('svg'));
                if (svgs.length === 0) {
                    document.body.removeChild(tmp);
                    resolve([]);
                    return;
                }
                Promise.all(svgs.map(svgElementToDataUrl))
                    .then(function(pngs) { document.body.removeChild(tmp); resolve(pngs); })
                    .catch(function() { document.body.removeChild(tmp); resolve([]); });
            }, 150);
        });
    }

    // Экспорт нескольких SVG в одну PNG (горизонтально)
    function exportChartsRowPNG(svgEls, fileName) {
        var scale = 2;
        var gap = 20;
        var totalW = 0;
        var maxH = 0;
        var svgArr = Array.prototype.slice.call(svgEls);
        svgArr.forEach(function (svg) {
            totalW += svg.width.baseVal.value;
            maxH = Math.max(maxH, svg.height.baseVal.value);
        });
        totalW += gap * (svgArr.length - 1);

        var canvas = document.createElement('canvas');
        canvas.width = totalW * scale;
        canvas.height = maxH * scale;
        var ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, totalW, maxH);

        var loaded = 0;
        var images = [];
        svgArr.forEach(function (svg, i) {
            var data = new XMLSerializer().serializeToString(svg);
            var img = new Image();
            images[i] = { img: img, w: svg.width.baseVal.value };
            img.onload = function () {
                loaded++;
                if (loaded === svgArr.length) {
                    var xOff = 0;
                    images.forEach(function (item) {
                        ctx.drawImage(item.img, xOff, 0);
                        xOff += item.w + gap;
                    });
                    canvas.toBlob(function (blob) { triggerDownload(blob, fileName); }, 'image/png');
                }
            };
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data);
        });
    }

    // --- Анализ: Объёмы по странам ---
    function renderCountriesAnalysis(data, headers) {
        // «Страна назначения» — для экспортных данных, где отправитель всегда Россия
        var sendCol = findColumn(headers, 'Страна отправления') || findColumn(headers, 'Страна назначения');
        var originCol = findColumn(headers, 'Страна происхождения');
        var weightCol = findColumn(headers, COL_WEIGHT);
        var statUsdCol = findColumn(headers, COL_STAT_USD);
        var yearCol = findColumn(headers, COL_YEAR);
        var quarterCol = findColumn(headers, COL_QUARTER);

        if (!sendCol && !originCol) {
            analysisResults.innerHTML = '<div class="analysis-empty"><p>Не найден столбец «Страна отправления» или «Страна происхождения». Выполните обработку с маппингом.</p></div>';
            return;
        }

        var countryCols = [];
        if (sendCol) { countryCols.push(sendCol); }
        if (originCol) { countryCols.push(originCol); }

        // Собираем годы
        var yearsSet = {};
        if (yearCol) {
            data.forEach(function (row) {
                var y = String(row[yearCol] || '').trim();
                if (y) { yearsSet[y] = true; }
            });
        }
        var years = Object.keys(yearsSet).sort();

        // Определяем неполный год (последний, если у него меньше кварталов)
        var partialYear = null;
        var partialQuarters = 0;
        if (yearCol && quarterCol && years.length >= 2) {
            var qSet = {};
            data.forEach(function (row) {
                var y = String(row[yearCol] || '').trim();
                var q = String(row[quarterCol] || '').trim();
                if (y && q) {
                    if (!qSet[y]) { qSet[y] = {}; }
                    qSet[y][q] = true;
                }
            });
            var lastY = years[years.length - 1];
            var prevY = years[years.length - 2];
            var lastQCount = Object.keys(qSet[lastY] || {}).length;
            var prevQCount = Object.keys(qSet[prevY] || {}).length;
            if (lastQCount < prevQCount) {
                partialYear = lastY;
                partialQuarters = lastQCount;
            }
        }

        var html = '';
        var chartIdx = 0;
        var allExportBlocks = [];

        // Хелпер: строит таблицу «страна × год» (кг) + строки ВСЕГО и Доля лидера
        function buildPivotTable(countryCol, metric, metricLabel, unit, divisor) {
            // Группировка: страна → год → value
            var byCountryYear = {};
            var totalByCountry = {};
            data.forEach(function (row) {
                var country = String(row[countryCol] || '').trim();
                var year = yearCol ? String(row[yearCol] || '').trim() : 'Всего';
                if (!country || !year) { return; }
                var val = Number(row[metric]) || 0;
                if (!byCountryYear[country]) { byCountryYear[country] = {}; }
                byCountryYear[country][year] = (byCountryYear[country][year] || 0) + val;
                totalByCountry[country] = (totalByCountry[country] || 0) + val;
            });

            // Сортировка по общему объёму
            var countries = Object.keys(totalByCountry).sort(function (a, b) {
                return totalByCountry[b] - totalByCountry[a];
            });
            if (countries.length === 0) { return { html: '', exportRows: [] }; }

            var cols = years.length > 0 ? years : ['Всего'];

            // Итого по годам
            var totalByYear = {};
            cols.forEach(function (y) {
                totalByYear[y] = 0;
                countries.forEach(function (c) {
                    totalByYear[y] += (byCountryYear[c][y] || 0);
                });
            });

            // Лидер
            var leader = countries[0];

            // Заголовки колонок с пометкой неполного года
            var h = '<div class="analysis-section">';
            h += '<h3 class="analysis-section-title">' + metricLabel + ' (' + countryCol + ')</h3>';
            h += '<div class="data-table-wrapper"><table class="data-table">';
            h += '<thead><tr><th>' + unit + '</th>';
            cols.forEach(function (y) {
                var label = (y === partialYear) ? 'Q1' + (partialQuarters > 1 ? '-Q' + partialQuarters : '') + ' ' + y : y;
                h += '<th>' + label + '</th>';
            });
            h += '</tr></thead><tbody>';

            countries.forEach(function (c) {
                h += '<tr><td>' + c + '</td>';
                cols.forEach(function (y) {
                    var val = byCountryYear[c][y] || 0;
                    var display = val > 0 ? formatNumber(Math.round(val / divisor)) : '-';
                    h += '<td class="numeric">' + display + '</td>';
                });
                h += '</tr>';
            });

            // ВСЕГО
            h += '<tr style="font-weight:600;border-top:2px solid var(--color-border)"><td>ВСЕГО</td>';
            cols.forEach(function (y) {
                h += '<td class="numeric">' + formatNumber(Math.round(totalByYear[y] / divisor)) + '</td>';
            });
            h += '</tr>';

            // Доля лидера
            h += '<tr style="font-style:italic"><td>Доля ' + leader + ', %</td>';
            cols.forEach(function (y) {
                var leaderVal = byCountryYear[leader][y] || 0;
                var total = totalByYear[y];
                var pct = total > 0 ? round2(leaderVal / total * 100) : 0;
                h += '<td class="numeric">' + (pct > 0 ? pct + '%' : '-') + '</td>';
            });
            h += '</tr>';
            h += '</tbody></table></div></div>';

            // Экспорт
            var exportRows = [];
            countries.forEach(function (c) {
                var row = { 'Страна': c };
                cols.forEach(function (y) {
                    var label = (y === partialYear) ? 'Q1-Q' + partialQuarters + ' ' + y : y;
                    row[label] = Math.round((byCountryYear[c][y] || 0) / divisor);
                });
                exportRows.push(row);
            });
            var totalRow = { 'Страна': 'ВСЕГО' };
            var leaderRow = { 'Страна': 'Доля ' + leader + ', %' };
            cols.forEach(function (y) {
                var label = (y === partialYear) ? 'Q1-Q' + partialQuarters + ' ' + y : y;
                totalRow[label] = Math.round(totalByYear[y] / divisor);
                var pct = totalByYear[y] > 0 ? round2((byCountryYear[leader][y] || 0) / totalByYear[y] * 100) + '%' : '-';
                leaderRow[label] = pct;
            });
            exportRows.push(totalRow);
            exportRows.push(leaderRow);

            return { html: h, exportRows: exportRows };
        }

        // Хелпер: горизонтальный график топ-10 (по общему весу)
        function buildBarChart(countryCol, cIdx) {
            var byCountry = {};
            var totalWeight = 0;
            data.forEach(function (row) {
                var country = String(row[countryCol] || '').trim();
                if (!country) { return; }
                var weight = Number(row[weightCol]) || 0;
                if (!byCountry[country]) { byCountry[country] = 0; }
                byCountry[country] += weight;
                totalWeight += weight;
            });

            var countries = Object.keys(byCountry).sort(function (a, b) {
                return byCountry[b] - byCountry[a];
            });
            if (!weightCol || countries.length < 2) { return ''; }

            var top = countries.slice(0, 10);
            var barHeight = 28;
            var maxLabelLen = 0;
            top.forEach(function (c) { if (c.length > maxLabelLen) { maxLabelLen = c.length; } });
            var labelWidth = Math.max(160, maxLabelLen * 7.5 + 16);
            var cw = Math.max(700, labelWidth + 500);
            var padding = { top: 10, right: 80, bottom: 10, left: labelWidth };
            var ch = padding.top + top.length * (barHeight + 8) + padding.bottom;
            var innerW = cw - padding.left - padding.right;
            var maxVal = byCountry[top[0]];
            if (maxVal === 0) { maxVal = 1; }

            var h = '<div class="analysis-section">';
            h += '<h3 class="analysis-section-title">Топ-10 по объёму (' + countryCol + ', кг)</h3>';
            h += '<svg class="analysis-chart" data-chart-idx="' + cIdx + '" width="' + cw + '" height="' + ch + '" viewBox="0 0 ' + cw + ' ' + ch + '">';
            h += '<style>text { font-family: ' + CHART_FONT + '; font-size: 12px; fill: ' + CHART_COLORS.text + '; }</style>';

            top.forEach(function (c, i) {
                var val = Math.round(byCountry[c]);
                var pct = totalWeight > 0 ? round2(byCountry[c] / totalWeight * 100) : 0;
                var bw = (val / maxVal) * innerW;
                var y = padding.top + i * (barHeight + 8);
                h += '<text x="' + (padding.left - 8) + '" y="' + (y + barHeight / 2 + 4) + '" text-anchor="end" font-size="11" fill="' + CHART_COLORS.text + '">' + c + '</text>';
                h += '<rect x="' + padding.left + '" y="' + y + '" width="' + bw + '" height="' + barHeight + '" fill="' + CHART_COLORS.primary + '" rx="3"/>';
                h += '<text x="' + (padding.left + bw + 6) + '" y="' + (y + barHeight / 2 + 4) + '" font-size="11" fill="' + CHART_COLORS.textMuted + '">' + formatNumber(val) + ' (' + pct + '%)</text>';
            });

            h += '</svg>';
            h += '<button class="btn btn-secondary analysis-export-chart-png" data-chart-idx="' + cIdx + '" style="margin-top:8px;font-size:12px">Скачать график PNG</button>';
            h += '</div>';
            return h;
        }

        countryCols.forEach(function (countryCol) {
            // Таблица кг (страна × год)
            if (weightCol) {
                var wBlock = buildPivotTable(countryCol, weightCol, 'Структура импорта, кг', 'кг', 1);
                html += wBlock.html;
                allExportBlocks.push({ label: countryCol + ' — кг', rows: wBlock.exportRows });
            }

            // Таблица тыс. USD (страна × год)
            if (statUsdCol) {
                var uBlock = buildPivotTable(countryCol, statUsdCol, 'Структура импорта, тыс. USD', 'тыс. USD', 1000);
                html += uBlock.html;
                allExportBlocks.push({ label: countryCol + ' — тыс. USD', rows: uBlock.exportRows });
            }

            // Горизонтальный график топ-10
            html += buildBarChart(countryCol, chartIdx++);
        });

        // Кнопки экспорта
        html += '<div class="processing-export" style="margin-top:20px">';
        html += '<button class="btn btn-primary analysis-export-xlsx">Скачать XLSX</button>';
        html += '<button class="btn btn-secondary analysis-export-csv">Скачать CSV</button>';
        html += '</div>';

        analysisResults.innerHTML = html;

        // Обработчики PNG
        var chartPngBtns = analysisResults.querySelectorAll('.analysis-export-chart-png');
        for (var b = 0; b < chartPngBtns.length; b++) {
            (function (btn) {
                var idx = btn.getAttribute('data-chart-idx');
                btn.addEventListener('click', function () {
                    var svg = analysisResults.querySelector('.analysis-chart[data-chart-idx="' + idx + '"]');
                    if (svg) { exportChartPNG(svg, baseFileName() + '_countries_' + idx + '.png'); }
                });
            })(chartPngBtns[b]);
        }

        // Экспорт — все блоки
        var combinedRows = [];
        var exportHeaders = ['Страна'];
        if (allExportBlocks.length > 0 && allExportBlocks[0].rows.length > 0) {
            var firstRow = allExportBlocks[0].rows[0];
            Object.keys(firstRow).forEach(function (k) {
                if (k !== 'Страна') { exportHeaders.push(k); }
            });
        }

        allExportBlocks.forEach(function (block, bi) {
            if (bi > 0) { combinedRows.push({}); }
            combinedRows.push({ 'Страна': '--- ' + block.label + ' ---' });
            block.rows.forEach(function (r) { combinedRows.push(r); });
        });

        analysisResults.querySelector('.analysis-export-xlsx').addEventListener('click', function () {
            exportAnalysisXLSX(combinedRows, exportHeaders, 'countries');
        });
        analysisResults.querySelector('.analysis-export-csv').addEventListener('click', function () {
            exportAnalysisCSV(combinedRows, exportHeaders, 'countries');
        });
    }

    // --- Анализ: Динамика цен по странам ---
    var LINE_COLORS = ['#2563EB', '#DC2626', '#16A34A', '#F59E0B', '#8B5CF6',
                       '#EC4899', '#0891B2', '#EA580C', '#4F46E5', '#059669'];

    function renderPriceDynamicsAnalysis(data, headers) {
        var countryCol = findColumn(headers, 'Страна отправления') || findColumn(headers, 'Страна назначения') || findColumn(headers, 'Страна происхождения');
        var statUsdCol = findColumn(headers, COL_STAT_USD);
        var weightCol = findColumn(headers, COL_WEIGHT);
        var yearCol = findColumn(headers, COL_YEAR);

        if (!countryCol) {
            analysisResults.innerHTML = '<div class="analysis-empty"><p>Не найден столбец «Страна отправления» или «Страна происхождения».</p></div>';
            return;
        }
        if (!statUsdCol || !weightCol) {
            analysisResults.innerHTML = '<div class="analysis-empty"><p>Не найдены столбцы «' + COL_STAT_USD + '» и/или «' + COL_WEIGHT + '».</p></div>';
            return;
        }
        if (!yearCol) {
            analysisResults.innerHTML = '<div class="analysis-empty"><p>Не найден столбец «Год». Выполните обработку с извлечением дат.</p></div>';
            return;
        }

        // Группировка: страна → год → { statUsd, weight }
        var byCountryYear = {};
        var totalWeightByCountry = {};
        var yearsSet = {};

        data.forEach(function (row) {
            var country = String(row[countryCol] || '').trim();
            var year = String(row[yearCol] || '').trim();
            if (!country || !year) { return; }

            var statUsd = Number(row[statUsdCol]) || 0;
            var weight = Number(row[weightCol]) || 0;

            if (!byCountryYear[country]) { byCountryYear[country] = {}; }
            if (!byCountryYear[country][year]) { byCountryYear[country][year] = { statUsd: 0, weight: 0 }; }
            byCountryYear[country][year].statUsd += statUsd;
            byCountryYear[country][year].weight += weight;

            totalWeightByCountry[country] = (totalWeightByCountry[country] || 0) + weight;
            yearsSet[year] = true;
        });

        var years = Object.keys(yearsSet).sort();
        // Топ-10 стран по общему весу
        var allCountries = Object.keys(totalWeightByCountry).sort(function (a, b) {
            return totalWeightByCountry[b] - totalWeightByCountry[a];
        });
        var top = allCountries.slice(0, 10);

        // Рассчитываем средневзвешенную цену USD/кг
        var priceData = {}; // { country: { year: price } }
        top.forEach(function (c) {
            priceData[c] = {};
            years.forEach(function (y) {
                var d = byCountryYear[c] && byCountryYear[c][y];
                if (d && d.weight > 0) {
                    priceData[c][y] = round2(d.statUsd / d.weight);
                }
            });
        });

        // --- Таблица ---
        var html = '<div class="analysis-section">';
        html += '<h3 class="analysis-section-title">Динамика цен по странам (долл. США/кг)</h3>';
        html += '<div class="data-table-wrapper"><table class="data-table">';
        html += '<thead><tr><th>Страна</th>';
        years.forEach(function (y) { html += '<th>' + y + '</th>'; });
        html += '</tr></thead><tbody>';

        top.forEach(function (c, ci) {
            html += '<tr><td>' + c + '</td>';
            years.forEach(function (y) {
                var price = priceData[c][y];
                html += '<td class="numeric">' + (price != null ? formatNumber(price) : '—') + '</td>';
            });
            html += '</tr>';
        });
        html += '</tbody></table></div></div>';

        // --- Линейный график ---
        if (years.length >= 1 && top.length >= 1) {
            var chartW = 700;
            var chartH = 400;
            var pad = { top: 30, right: 30, bottom: 50, left: 70 };
            var innerW = chartW - pad.left - pad.right;
            var innerH = chartH - pad.top - pad.bottom;

            // Находим min/max цен
            var allPrices = [];
            top.forEach(function (c) {
                years.forEach(function (y) {
                    if (priceData[c][y] != null) { allPrices.push(priceData[c][y]); }
                });
            });
            var minPrice = Math.min.apply(null, allPrices);
            var maxPrice = Math.max.apply(null, allPrices);
            var priceRange = maxPrice - minPrice;
            if (priceRange === 0) { priceRange = 1; }
            var yMin = Math.max(0, minPrice - priceRange * 0.1);
            var yMax = maxPrice + priceRange * 0.15;
            var yRange = yMax - yMin;

            html += '<div class="analysis-section">';
            html += '<h3 class="analysis-section-title">Статистическая стоимость, долл. США/кг</h3>';
            html += '<svg class="analysis-chart" width="' + chartW + '" height="' + chartH + '" viewBox="0 0 ' + chartW + ' ' + chartH + '">';
            html += '<style>text { font-family: ' + CHART_FONT + '; }</style>';

            // Сетка Y
            var yTicks = 5;
            for (var t = 0; t <= yTicks; t++) {
                var yVal = round2(yMin + yRange * t / yTicks);
                var yPos = pad.top + innerH - (innerH * t / yTicks);
                html += '<line x1="' + pad.left + '" y1="' + yPos + '" x2="' + (chartW - pad.right) + '" y2="' + yPos + '" stroke="' + CHART_COLORS.grid + '" stroke-width="1"/>';
                html += '<text x="' + (pad.left - 8) + '" y="' + (yPos + 4) + '" text-anchor="end" font-size="11" fill="' + CHART_COLORS.textMuted + '">' + formatNumber(yVal) + '</text>';
            }

            // Подписи годов по X
            var xPadPDA = innerW * 0.06;
            var plotWPDA = innerW - xPadPDA * 2;
            var xStep = years.length > 1 ? plotWPDA / (years.length - 1) : plotWPDA / 2;
            years.forEach(function (y, i) {
                var x = pad.left + xPadPDA + (years.length > 1 ? xStep * i : plotWPDA / 2);
                html += '<text x="' + x + '" y="' + (chartH - pad.bottom + 25) + '" text-anchor="middle" font-size="11" fill="' + CHART_COLORS.textMuted + '">' + y + '</text>';
            });

            // Линии для каждой страны
            top.forEach(function (c, ci) {
                var color = LINE_COLORS[ci % LINE_COLORS.length];
                var points = [];
                years.forEach(function (y, yi) {
                    var price = priceData[c][y];
                    if (price != null) {
                        var x = pad.left + xPadPDA + (years.length > 1 ? xStep * yi : plotWPDA / 2);
                        var yp = pad.top + innerH - ((price - yMin) / yRange) * innerH;
                        points.push({ x: x, y: yp, val: price });
                    }
                });

                if (points.length >= 2) {
                    // Кривая линия
                    var pathD = 'M' + points[0].x + ',' + points[0].y;
                    for (var pi = 1; pi < points.length; pi++) {
                        var cpx = (points[pi - 1].x + points[pi].x) / 2;
                        pathD += ' C' + cpx + ',' + points[pi - 1].y + ' ' + cpx + ',' + points[pi].y + ' ' + points[pi].x + ',' + points[pi].y;
                    }
                    html += '<path d="' + pathD + '" fill="none" stroke="' + color + '" stroke-width="2.5"/>';
                }

                // Точки и подписи значений
                points.forEach(function (p) {
                    html += '<circle cx="' + p.x + '" cy="' + p.y + '" r="4" fill="' + color + '"/>';
                    html += '<text x="' + p.x + '" y="' + (p.y - 8) + '" text-anchor="middle" font-size="9" fill="' + color + '">' + formatNumber(p.val) + '</text>';
                });
            });

            html += '</svg>';

            // Легенда
            html += '<div class="chart-legend">';
            top.forEach(function (c, ci) {
                var color = LINE_COLORS[ci % LINE_COLORS.length];
                html += '<span class="chart-legend-item"><span class="chart-legend-color" style="background:' + color + '"></span>' + c + '</span>';
            });
            html += '</div>';

            html += '<button class="btn btn-secondary analysis-export-chart-png" style="margin-top:8px;font-size:12px">Скачать график PNG</button>';
            html += '</div>';
        }

        // --- Кнопки экспорта ---
        html += '<div class="processing-export" style="margin-top:20px">';
        html += '<button class="btn btn-primary analysis-export-xlsx">Скачать XLSX</button>';
        html += '<button class="btn btn-secondary analysis-export-csv">Скачать CSV</button>';
        html += '</div>';

        analysisResults.innerHTML = html;

        // Обработчик PNG
        var chartPngBtn = analysisResults.querySelector('.analysis-export-chart-png');
        if (chartPngBtn) {
            chartPngBtn.addEventListener('click', function () {
                var svg = analysisResults.querySelector('.analysis-chart');
                if (svg) { exportChartPNG(svg, baseFileName() + '_price_dynamics.png'); }
            });
        }

        // Данные для экспорта
        var exportRows = [];
        top.forEach(function (c) {
            var row = { 'Страна': c };
            years.forEach(function (y) {
                row[y] = priceData[c][y] != null ? priceData[c][y] : '';
            });
            exportRows.push(row);
        });
        var exportHeaders = ['Страна'].concat(years);

        analysisResults.querySelector('.analysis-export-xlsx').addEventListener('click', function () {
            exportAnalysisXLSX(exportRows, exportHeaders, 'price_dynamics');
        });
        analysisResults.querySelector('.analysis-export-csv').addEventListener('click', function () {
            exportAnalysisCSV(exportRows, exportHeaders, 'price_dynamics');
        });
    }

    // --- Анализ: Структура импорта (Sankey) ---
    var SANKEY_COLORS = ['#2563EB', '#16A34A', '#F59E0B', '#DC2626', '#8B5CF6',
                         '#EC4899', '#0891B2', '#EA580C', '#4F46E5', '#059669',
                         '#64748B'];

    function renderImportStructureAnalysis(data, headers, selectedYear, topN, opts) {
        if (!topN) { topN = 15; }
        if (!opts) { opts = {}; }
        var sourceColName = opts.sourceCol || COL_SENDER;
        var targetColName = opts.targetCol || COL_RECEIVER;
        var sourceLabel = opts.sourceLabel || 'Отправитель';
        var targetLabel = opts.targetLabel || 'Получатель';
        var exportName = opts.exportName || 'import_structure';
        var otherSourceLabel = sourceLabel === 'Изготовитель' ? 'Прочие изг.' : 'Прочие отпр.';
        var otherTargetLabel = targetLabel === 'Получатель' ? 'Прочие пол.' : 'Прочие';

        var senderCol = findColumn(headers, sourceColName);
        var receiverCol = findColumn(headers, targetColName);
        var weightCol = findColumn(headers, COL_WEIGHT);
        var yearCol = findColumn(headers, COL_YEAR);

        // На статистике ООН этих колонок не бывает в принципе — объясняем
        // причину, иначе выглядит как отсутствие маппинга
        if ((!senderCol || !receiverCol) && !isContractorDataAvailable()) {
            analysisResults.innerHTML = renderContractorUnavailable();
            return;
        }
        if (!senderCol) {
            analysisResults.innerHTML = '<div class="analysis-empty"><p>Не найден столбец «' + sourceColName + '».</p></div>';
            return;
        }
        if (!receiverCol) {
            analysisResults.innerHTML = '<div class="analysis-empty"><p>Не найден столбец «' + targetColName + '».</p></div>';
            return;
        }
        if (!weightCol) {
            analysisResults.innerHTML = '<div class="analysis-empty"><p>Не найден столбец «Вес нетто, кг».</p></div>';
            return;
        }

        // Собираем доступные годы
        var yearsSet = {};
        data.forEach(function (row) {
            if (yearCol) {
                var y = String(row[yearCol] || '').trim();
                if (y) { yearsSet[y] = true; }
            }
        });
        var years = Object.keys(yearsSet).sort();

        // Фильтруем по году
        var filteredData = data;
        if (selectedYear && selectedYear !== 'all' && yearCol) {
            filteredData = data.filter(function (row) {
                return String(row[yearCol] || '').trim() === selectedYear;
            });
        }

        // Нормализация названий компаний
        function normalizeCompany(name) {
            return normalizeCompanyName(name);
        }

        // Группировка: отправитель → получатель → тонны
        var senderTotals = {};
        var receiverTotals = {};
        var flows = {}; // "sender|||receiver" → weight

        filteredData.forEach(function (row) {
            var sender = normalizeCompany(String(row[senderCol] || ''));
            var receiver = normalizeCompany(String(row[receiverCol] || ''));
            var weight = Number(row[weightCol]) || 0;
            if (!sender || !receiver || weight <= 0) { return; }

            senderTotals[sender] = (senderTotals[sender] || 0) + weight;
            receiverTotals[receiver] = (receiverTotals[receiver] || 0) + weight;

            var fk = sender + KEY_SEPARATOR + receiver;
            flows[fk] = (flows[fk] || 0) + weight;
        });

        // Отправители и получатели по убыванию веса
        var sendersSorted = Object.keys(senderTotals).sort(function (a, b) { return senderTotals[b] - senderTotals[a]; });
        var receiversSorted = Object.keys(receiverTotals).sort(function (a, b) { return receiverTotals[b] - receiverTotals[a]; });

        var leftNodes, rightNodes;
        var sankeyFlows = [];

        if (topN === 'all' || topN >= sendersSorted.length) {
            // Все
            leftNodes = sendersSorted;
            rightNodes = receiversSorted;
            Object.keys(flows).forEach(function (fk) {
                var parts = fk.split(KEY_SEPARATOR);
                sankeyFlows.push({ source: parts[0], target: parts[1], value: flows[fk] });
            });
        } else {
            // Топ-N + Прочие
            var topS = sendersSorted.slice(0, topN);
            var otherSW = 0;
            var otherSSet = {};
            sendersSorted.slice(topN).forEach(function (s) { otherSW += senderTotals[s]; otherSSet[s] = true; });

            var topR = receiversSorted.slice(0, topN);
            var otherRW = 0;
            var otherRSet = {};
            receiversSorted.slice(topN).forEach(function (r) { otherRW += receiverTotals[r]; otherRSet[r] = true; });

            leftNodes = topS.slice();
            if (otherSW > 0) { leftNodes.push(otherSourceLabel); senderTotals[otherSourceLabel] = otherSW; }
            rightNodes = topR.slice();
            if (otherRW > 0) { rightNodes.push(otherTargetLabel); receiverTotals[otherTargetLabel] = otherRW; }

            var flowMap = {};
            Object.keys(flows).forEach(function (fk) {
                var parts = fk.split(KEY_SEPARATOR);
                var s = otherSSet[parts[0]] ? otherSourceLabel : parts[0];
                var r = otherRSet[parts[1]] ? otherTargetLabel : parts[1];
                var key = s + KEY_SEPARATOR + r;
                flowMap[key] = (flowMap[key] || 0) + flows[fk];
            });
            leftNodes.forEach(function (s) {
                rightNodes.forEach(function (r) {
                    var key = s + KEY_SEPARATOR + r;
                    if (flowMap[key] && flowMap[key] > 0) {
                        sankeyFlows.push({ source: s, target: r, value: flowMap[key] });
                    }
                });
            });
        }

        // Итого
        var totalWeight = 0;
        leftNodes.forEach(function (s) { totalWeight += (senderTotals[s] || 0); });

        // --- HTML: селектор года + таблица + Sankey ---
        var html = '<div class="analysis-section">';
        html += '<div class="sankey-controls">';
        html += '<h3 class="analysis-section-title" style="margin:0">Структура импорта: ' + sourceLabel + ' → ' + targetLabel + '</h3>';
        if (yearCol && years.length > 0) {
            html += '<select class="sankey-year-select">';
            html += '<option value="all"' + (!selectedYear || selectedYear === 'all' ? ' selected' : '') + '>Все годы</option>';
            years.forEach(function (y) {
                html += '<option value="' + y + '"' + (selectedYear === y ? ' selected' : '') + '>' + y + '</option>';
            });
            html += '</select>';
        }
        // Селектор топ-N
        html += '<select class="sankey-topn-select">';
        [10, 15, 20, 'all'].forEach(function (v) {
            var label = v === 'all' ? 'Все' : 'Топ-' + v;
            var sel = (String(topN) === String(v)) ? ' selected' : '';
            html += '<option value="' + v + '"' + sel + '>' + label + '</option>';
        });
        html += '</select>';
        html += '</div>';

        // Таблица: топ связей
        var topFlows = sankeyFlows.slice().sort(function (a, b) { return b.value - a.value; }).slice(0, 20);
        html += '<div class="data-table-wrapper"><table class="data-table">';
        html += '<thead><tr><th>' + sourceLabel + '</th><th>' + targetLabel + '</th><th>Объём (тонн)</th><th>Доля, %</th></tr></thead><tbody>';
        topFlows.forEach(function (f) {
            var pct = totalWeight > 0 ? round2(f.value / totalWeight * 100) : 0;
            html += '<tr><td>' + f.source + '</td><td>' + f.target + '</td>';
            html += '<td class="numeric">' + formatNumber(round2(f.value / 1000)) + '</td>';
            html += '<td class="numeric">' + pct + '%</td></tr>';
        });
        html += '</tbody></table></div></div>';

        // --- Sankey SVG ---
        var svgW = 900;
        var nodeW = 18;
        var nodePad = 8;
        var labelPadL = 10;
        var labelPadR = 10;
        var leftX = 180;
        var rightX = svgW - 180;
        var topPad = 20;

        // Высоты узлов пропорционально весу
        var leftTotal = 0;
        leftNodes.forEach(function (s) { leftTotal += senderTotals[s] || 0; });
        var rightTotal = 0;
        rightNodes.forEach(function (r) { rightTotal += receiverTotals[r] || 0; });

        var availH = Math.max(400, Math.max(leftNodes.length, rightNodes.length) * 45);
        var svgH = availH + topPad * 2;

        var leftGap = leftNodes.length > 1 ? nodePad : 0;
        var leftUsable = availH - leftGap * (leftNodes.length - 1);
        var rightGap = rightNodes.length > 1 ? nodePad : 0;
        var rightUsable = availH - rightGap * (rightNodes.length - 1);

        // Позиции левых узлов
        var leftPositions = {};
        var yOff = topPad;
        leftNodes.forEach(function (s, i) {
            var h = Math.max(4, (senderTotals[s] / leftTotal) * leftUsable);
            leftPositions[s] = { y: yOff, h: h, color: SANKEY_COLORS[i % SANKEY_COLORS.length] };
            yOff += h + leftGap;
        });

        // Позиции правых узлов
        var rightPositions = {};
        yOff = topPad;
        rightNodes.forEach(function (r, i) {
            var h = Math.max(4, (receiverTotals[r] / rightTotal) * rightUsable);
            rightPositions[r] = { y: yOff, h: h, color: SANKEY_COLORS[i % SANKEY_COLORS.length] };
            yOff += h + rightGap;
        });

        html += '<div class="analysis-section">';
        html += '<svg class="analysis-chart sankey-chart" width="' + svgW + '" height="' + svgH + '" viewBox="0 0 ' + svgW + ' ' + svgH + '">';
        html += '<style>text { font-family: ' + CHART_FONT + '; }</style>';

        // Рисуем потоки (кривые Безье)
        // Сначала сортируем потоки по source порядку для красивой укладки
        var leftFlowOffset = {};
        leftNodes.forEach(function (s) { leftFlowOffset[s] = 0; });
        var rightFlowOffset = {};
        rightNodes.forEach(function (r) { rightFlowOffset[r] = 0; });

        // Сортируем потоки: по левому узлу, потом по правому
        sankeyFlows.sort(function (a, b) {
            var ai = leftNodes.indexOf(a.source);
            var bi = leftNodes.indexOf(b.source);
            if (ai !== bi) { return ai - bi; }
            return rightNodes.indexOf(a.target) - rightNodes.indexOf(b.target);
        });

        sankeyFlows.forEach(function (f) {
            var lp = leftPositions[f.source];
            var rp = rightPositions[f.target];
            if (!lp || !rp) { return; }

            var flowH_left = (f.value / (senderTotals[f.source] || 1)) * lp.h;
            var flowH_right = (f.value / (receiverTotals[f.target] || 1)) * rp.h;

            var y0 = lp.y + leftFlowOffset[f.source];
            var y1 = rp.y + rightFlowOffset[f.target];

            var x0 = leftX + nodeW;
            var x1 = rightX;

            var cpx = (x0 + x1) / 2;

            // Путь: верхняя кривая + нижняя кривая (замкнутая область)
            var pathD = 'M' + x0 + ',' + y0 +
                ' C' + cpx + ',' + y0 + ' ' + cpx + ',' + y1 + ' ' + x1 + ',' + y1 +
                ' L' + x1 + ',' + (y1 + flowH_right) +
                ' C' + cpx + ',' + (y1 + flowH_right) + ' ' + cpx + ',' + (y0 + flowH_left) + ' ' + x0 + ',' + (y0 + flowH_left) +
                ' Z';

            html += '<path d="' + pathD + '" fill="' + lp.color + '" opacity="0.35"/>';

            leftFlowOffset[f.source] += flowH_left;
            rightFlowOffset[f.target] += flowH_right;
        });

        // Рисуем левые узлы (прямоугольники + подписи)
        leftNodes.forEach(function (s) {
            var p = leftPositions[s];
            var tons = round2(senderTotals[s] / 1000);
            html += '<rect x="' + leftX + '" y="' + p.y + '" width="' + nodeW + '" height="' + p.h + '" fill="' + p.color + '" rx="2"/>';
            // Подпись слева
            var labelY = p.y + p.h / 2;
            html += '<text x="' + (leftX - labelPadL) + '" y="' + (labelY - 2) + '" text-anchor="end" font-size="11" font-weight="600" fill="' + CHART_COLORS.text + '">' + s + '</text>';
            html += '<text x="' + (leftX - labelPadL) + '" y="' + (labelY + 12) + '" text-anchor="end" font-size="10" fill="' + CHART_COLORS.textMuted + '">' + formatNumber(tons) + '</text>';
        });

        // Рисуем правые узлы
        rightNodes.forEach(function (r) {
            var p = rightPositions[r];
            var tons = round2(receiverTotals[r] / 1000);
            html += '<rect x="' + rightX + '" y="' + p.y + '" width="' + nodeW + '" height="' + p.h + '" fill="' + p.color + '" rx="2"/>';
            // Подпись справа
            var labelY = p.y + p.h / 2;
            html += '<text x="' + (rightX + nodeW + labelPadR) + '" y="' + (labelY - 2) + '" font-size="11" font-weight="600" fill="' + CHART_COLORS.text + '">' + r + '</text>';
            html += '<text x="' + (rightX + nodeW + labelPadR) + '" y="' + (labelY + 12) + '" font-size="10" fill="' + CHART_COLORS.textMuted + '">' + formatNumber(tons) + '</text>';
        });

        // Заголовки колонок
        html += '<text x="' + (leftX + nodeW / 2) + '" y="14" text-anchor="middle" font-size="12" font-weight="700" fill="' + CHART_COLORS.primary + '">' + sourceLabel + '</text>';
        html += '<text x="' + (rightX + nodeW / 2) + '" y="14" text-anchor="middle" font-size="12" font-weight="700" fill="' + CHART_COLORS.primary + '">' + targetLabel + '</text>';

        html += '</svg>';
        html += '<button class="btn btn-secondary analysis-export-chart-png" style="margin-top:8px;font-size:12px">Скачать график PNG</button>';
        html += '</div>';

        // --- Кнопки экспорта ---
        html += '<div class="processing-export" style="margin-top:20px">';
        html += '<button class="btn btn-primary analysis-export-xlsx">Скачать XLSX</button>';
        html += '<button class="btn btn-secondary analysis-export-csv">Скачать CSV</button>';
        html += '</div>';

        analysisResults.innerHTML = html;

        // Получаем текущие значения селекторов для перерисовки
        var yearSelect = analysisResults.querySelector('.sankey-year-select');
        var topnSelect = analysisResults.querySelector('.sankey-topn-select');

        function rerender() {
            var curYear = yearSelect ? yearSelect.value : 'all';
            var curTopN = topnSelect.value === 'all' ? 'all' : Number(topnSelect.value);
            renderImportStructureAnalysis(data, headers, curYear, curTopN, opts);
        }

        if (yearSelect) { yearSelect.addEventListener('change', rerender); }
        topnSelect.addEventListener('change', rerender);

        // PNG
        var chartPngBtn = analysisResults.querySelector('.analysis-export-chart-png');
        if (chartPngBtn) {
            chartPngBtn.addEventListener('click', function () {
                var svg = analysisResults.querySelector('.sankey-chart');
                if (svg) { exportChartPNG(svg, baseFileName() + '_' + exportName + '.png'); }
            });
        }

        // Данные для экспорта
        var exportRows = [];
        sankeyFlows.sort(function (a, b) { return b.value - a.value; }).forEach(function (f) {
            exportRows.push({
                [sourceLabel]: f.source,
                [targetLabel]: f.target,
                'Объём (тонн)': round2(f.value / 1000),
                'Доля, %': totalWeight > 0 ? round2(f.value / totalWeight * 100) : 0
            });
        });
        var exportHeaders = [sourceLabel, targetLabel, 'Объём (тонн)', 'Доля, %'];

        analysisResults.querySelector('.analysis-export-xlsx').addEventListener('click', function () {
            exportAnalysisXLSX(exportRows, exportHeaders, exportName);
        });
        analysisResults.querySelector('.analysis-export-csv').addEventListener('click', function () {
            exportAnalysisCSV(exportRows, exportHeaders, exportName);
        });
    }

    // --- Анализ: Поквартальная динамика цен ---
    var YEAR_COLORS = ['#2563EB', '#8B5CF6', '#F59E0B', '#16A34A', '#DC2626', '#EC4899', '#0891B2'];

    function renderQuarterlyPricesAnalysis(data, headers) {
        var weightCol = findColumn(headers, COL_WEIGHT);
        var statUsdCol = findColumn(headers, COL_STAT_USD);
        var rubCtx = buildRubCtx(headers);
        var rubCol = rubCtx.customsCol || rubCtx.invoiceRubCol || rubCtx.statUsdCol;
        var yearCol = findColumn(headers, COL_YEAR);
        var quarterCol = findColumn(headers, COL_QUARTER);

        if (!weightCol) {
            analysisResults.innerHTML = '<div class="analysis-empty"><p>Не найден столбец «Вес нетто, кг».</p></div>';
            return;
        }
        if (!statUsdCol && !rubCol) {
            analysisResults.innerHTML = '<div class="analysis-empty"><p>Не найдены столбцы «' + COL_STAT_USD + '» или «' + COL_CUSTOMS + '».</p></div>';
            return;
        }
        if (!yearCol || !quarterCol) {
            analysisResults.innerHTML = '<div class="analysis-empty"><p>Не найдены столбцы «Год» и «КВАРТАЛ». Выполните обработку с извлечением дат.</p></div>';
            return;
        }

        // Группируем: год → квартал → { statUsd, rub, weight }
        var byYearQuarter = {};
        var byYear = {};
        var yearsSet = {};

        data.forEach(function (row) {
            var year = String(row[yearCol] || '').trim();
            var q = String(row[quarterCol] || '').trim();
            if (!year || !q) { return; }

            var weight = Number(row[weightCol]) || 0;
            var statUsd = statUsdCol ? (Number(row[statUsdCol]) || 0) : 0;
            var rub = rubCol ? getRowRubValue(row, rubCtx) : 0;

            yearsSet[year] = true;

            if (!byYearQuarter[year]) { byYearQuarter[year] = {}; }
            if (!byYearQuarter[year][q]) { byYearQuarter[year][q] = { statUsd: 0, rub: 0, weight: 0 }; }
            byYearQuarter[year][q].statUsd += statUsd;
            byYearQuarter[year][q].rub += rub;
            byYearQuarter[year][q].weight += weight;

            if (!byYear[year]) { byYear[year] = { statUsd: 0, rub: 0, weight: 0 }; }
            byYear[year].statUsd += statUsd;
            byYear[year].rub += rub;
            byYear[year].weight += weight;
        });

        var years = Object.keys(yearsSet).sort();
        var quarters = ['1', '2', '3', '4'];

        // Вычисляем средневзвешенные цены
        // priceData[year][q] = { usd: ..., rub: ... }
        var priceData = {};
        var avgPrices = {}; // год → { usd, rub }
        years.forEach(function (y) {
            priceData[y] = {};
            quarters.forEach(function (q) {
                var d = byYearQuarter[y] && byYearQuarter[y][q];
                if (d && d.weight > 0) {
                    priceData[y][q] = {
                        usd: statUsdCol ? round2(d.statUsd / d.weight) : null,
                        rub: rubCol ? round2(d.rub / d.weight) : null
                    };
                }
            });
            var yd = byYear[y];
            if (yd && yd.weight > 0) {
                avgPrices[y] = {
                    usd: statUsdCol ? round2(yd.statUsd / yd.weight) : null,
                    rub: rubCol ? round2(yd.rub / yd.weight) : null
                };
            }
        });

        // Определяем метрики
        var metrics = [];
        if (rubCol) { metrics.push({ key: 'rub', title: 'Поквартальная динамика цен, нац. вал./кг', unit: 'нац. вал./кг' }); }
        if (statUsdCol) { metrics.push({ key: 'usd', title: 'Поквартальная динамика цен, долл. США/кг', unit: 'USD/кг' }); }

        var html = '';

        metrics.forEach(function (m) {
            // Собираем все значения для масштаба
            var allVals = [];
            years.forEach(function (y) {
                quarters.forEach(function (q) {
                    var pd = priceData[y][q];
                    if (pd && pd[m.key] != null) { allVals.push(pd[m.key]); }
                });
            });
            if (allVals.length === 0) { return; }

            var minV = Math.min.apply(null, allVals);
            var maxV = Math.max.apply(null, allVals);
            var range = maxV - minV;
            if (range === 0) { range = 1; }
            var yMin = Math.max(0, minV - range * 0.15);
            var yMax = maxV + range * 0.2;
            var yRange = yMax - yMin;

            var chartW = 550;
            var chartH = 320;
            var pad = { top: 30, right: 200, bottom: 50, left: 60 };
            var innerW = chartW - pad.left - pad.right;
            var innerH = chartH - pad.top - pad.bottom;

            html += '<div class="analysis-section">';
            html += '<h3 class="analysis-section-title">' + m.title + '</h3>';
            html += '<svg class="analysis-chart analysis-chart-quarterly" width="' + chartW + '" height="' + chartH + '" viewBox="0 0 ' + chartW + ' ' + chartH + '">';
            html += '<style>text { font-family: ' + CHART_FONT + '; }</style>';

            // Сетка Y
            var yTicks = 5;
            for (var t = 0; t <= yTicks; t++) {
                var yVal = round2(yMin + yRange * t / yTicks);
                var yPos = pad.top + innerH - (innerH * t / yTicks);
                html += '<line x1="' + pad.left + '" y1="' + yPos + '" x2="' + (pad.left + innerW) + '" y2="' + yPos + '" stroke="' + CHART_COLORS.grid + '" stroke-width="1"/>';
                html += '<text x="' + (pad.left - 8) + '" y="' + (yPos + 4) + '" text-anchor="end" font-size="10" fill="' + CHART_COLORS.textMuted + '">' + formatNumber(yVal) + '</text>';
            }

            // Подписи кварталов по X
            var xPadQ = innerW * 0.08;
            var plotWQ = innerW - xPadQ * 2;
            var xStep = quarters.length > 1 ? plotWQ / (quarters.length - 1) : plotWQ / 2;
            quarters.forEach(function (q, qi) {
                var x = pad.left + xPadQ + xStep * qi;
                html += '<text x="' + x + '" y="' + (chartH - pad.bottom + 25) + '" text-anchor="middle" font-size="11" fill="' + CHART_COLORS.textMuted + '">Q' + q + '</text>';
            });

            // Линии для каждого года
            years.forEach(function (y, yi) {
                var color = YEAR_COLORS[yi % YEAR_COLORS.length];
                var points = [];
                quarters.forEach(function (q, qi) {
                    var pd = priceData[y][q];
                    if (pd && pd[m.key] != null) {
                        var x = pad.left + xPadQ + xStep * qi;
                        var yp = pad.top + innerH - ((pd[m.key] - yMin) / yRange) * innerH;
                        points.push({ x: x, y: yp, val: pd[m.key] });
                    }
                });

                if (points.length >= 2) {
                    var pathD = 'M' + points[0].x + ',' + points[0].y;
                    for (var pi = 1; pi < points.length; pi++) {
                        pathD += ' L' + points[pi].x + ',' + points[pi].y;
                    }
                    html += '<path d="' + pathD + '" fill="none" stroke="' + color + '" stroke-width="2.5"/>';
                }

                // Точки и подписи
                points.forEach(function (p) {
                    html += '<circle cx="' + p.x + '" cy="' + p.y + '" r="4" fill="' + color + '"/>';
                    html += '<text x="' + p.x + '" y="' + (p.y - 10) + '" text-anchor="middle" font-size="10" font-weight="600" fill="' + color + '">' + formatNumber(p.val) + '</text>';
                });
            });

            // Средневзвешенная цена справа
            var rightX = pad.left + innerW + 30;
            html += '<text x="' + (rightX + 50) + '" y="' + (pad.top - 5) + '" text-anchor="middle" font-size="11" font-weight="700" fill="' + CHART_COLORS.text + '">Средневзвешенная</text>';
            html += '<text x="' + (rightX + 50) + '" y="' + (pad.top + 10) + '" text-anchor="middle" font-size="11" font-weight="700" fill="' + CHART_COLORS.text + '">цена</text>';

            years.forEach(function (y, yi) {
                var color = YEAR_COLORS[yi % YEAR_COLORS.length];
                var avg = avgPrices[y] && avgPrices[y][m.key];
                var cardY = pad.top + 25 + yi * 45;

                // Год
                html += '<text x="' + (rightX + 50) + '" y="' + cardY + '" text-anchor="middle" font-size="12" font-weight="700" fill="' + color + '">' + y + '</text>';
                // Рамка + значение
                html += '<rect x="' + (rightX + 10) + '" y="' + (cardY + 4) + '" width="80" height="22" rx="4" fill="none" stroke="' + color + '" stroke-width="1.5"/>';
                html += '<text x="' + (rightX + 50) + '" y="' + (cardY + 19) + '" text-anchor="middle" font-size="12" font-weight="600" fill="' + color + '">' + (avg != null ? formatNumber(avg) : '—') + '</text>';
            });

            html += '</svg>';
            html += '</div>';
        });

        // Легенда
        html += '<div class="chart-legend" style="margin-top:8px">';
        years.forEach(function (y, yi) {
            var color = YEAR_COLORS[yi % YEAR_COLORS.length];
            html += '<span class="chart-legend-item"><span class="chart-legend-color" style="background:' + color + ';height:3px;width:20px"></span>' + y + '</span>';
        });
        html += '</div>';

        // Кнопки экспорта
        html += '<div class="processing-export" style="margin-top:20px">';
        html += '<button class="btn btn-primary analysis-export-xlsx">Скачать XLSX</button>';
        html += '<button class="btn btn-secondary analysis-export-csv">Скачать CSV</button>';
        html += '<button class="btn btn-secondary analysis-export-chart-png" style="font-size:12px">Скачать графики PNG</button>';
        html += '</div>';

        analysisResults.innerHTML = html;

        // PNG — все графики
        var chartPngBtn = analysisResults.querySelector('.analysis-export-chart-png');
        if (chartPngBtn) {
            chartPngBtn.addEventListener('click', function () {
                var svgs = analysisResults.querySelectorAll('.analysis-chart-quarterly');
                if (svgs.length === 1) {
                    exportChartPNG(svgs[0], baseFileName() + '_quarterly_prices.png');
                } else if (svgs.length > 1) {
                    exportChartsRowPNG(svgs, baseFileName() + '_quarterly_prices.png');
                }
            });
        }

        // Данные для экспорта
        var exportRows = [];
        years.forEach(function (y) {
            quarters.forEach(function (q) {
                var pd = priceData[y][q];
                var row = { 'Год': y, 'Квартал': 'Q' + q };
                if (statUsdCol) { row['USD/кг'] = pd && pd.usd != null ? pd.usd : ''; }
                if (rubCol) { row['Нац. вал./кг'] = pd && pd.rub != null ? pd.rub : ''; }
                exportRows.push(row);
            });
            // Средневзвешенная
            var avg = avgPrices[y];
            var avgRow = { 'Год': y, 'Квартал': 'Средневзвешенная' };
            if (statUsdCol) { avgRow['USD/кг'] = avg && avg.usd != null ? avg.usd : ''; }
            if (rubCol) { avgRow['Нац. вал./кг'] = avg && avg.rub != null ? avg.rub : ''; }
            exportRows.push(avgRow);
            exportRows.push({ 'Год': '', 'Квартал': '' });
        });

        var exportHeaders = ['Год', 'Квартал'];
        if (statUsdCol) { exportHeaders.push('USD/кг'); }
        if (rubCol) { exportHeaders.push('Нац. вал./кг'); }

        analysisResults.querySelector('.analysis-export-xlsx').addEventListener('click', function () {
            exportAnalysisXLSX(exportRows, exportHeaders, 'quarterly_prices');
        });
        analysisResults.querySelector('.analysis-export-csv').addEventListener('click', function () {
            exportAnalysisCSV(exportRows, exportHeaders, 'quarterly_prices');
        });
    }

    // --- Анализ: Топ получателей / Топ отправителей ---
    function renderCompanyRankingAnalysis(data, headers, selectedYear, topN, opts) {
        if (!topN) { topN = 15; }
        if (!opts) { opts = {}; }
        var companyColName = opts.companyCol || COL_RECEIVER;
        var companyLabel = opts.companyLabel || 'Получатель';
        var exportName = opts.exportName || 'top_receivers';

        var companyCol = findColumn(headers, companyColName);
        var weightCol = findColumn(headers, COL_WEIGHT);
        var statUsdCol = findColumn(headers, COL_STAT_USD);
        var yearCol = findColumn(headers, COL_YEAR);
        var quarterCol = findColumn(headers, COL_QUARTER);

        if (!companyCol && !isContractorDataAvailable()) {
            analysisResults.innerHTML = renderContractorUnavailable();
            return;
        }
        if (!companyCol) {
            analysisResults.innerHTML = '<div class="analysis-empty"><p>Не найден столбец «' + companyColName + '». Выполните обработку с маппингом.</p></div>';
            return;
        }
        if (!weightCol && !statUsdCol) {
            analysisResults.innerHTML = '<div class="analysis-empty"><p>Не найдены столбцы «Вес нетто, кг» или «Статистическая стоимость, USD».</p></div>';
            return;
        }

        // Нормализация компании
        function normalizeCompany(name) {
            return normalizeCompanyName(name);
        }

        // Годы
        var yearsSet = {};
        if (yearCol) {
            data.forEach(function (row) {
                var y = String(row[yearCol] || '').trim();
                if (y) { yearsSet[y] = true; }
            });
        }
        var years = Object.keys(yearsSet).sort();

        // Фильтр по году
        var filteredData = data;
        if (selectedYear && selectedYear !== 'all' && yearCol) {
            filteredData = data.filter(function (row) {
                return String(row[yearCol] || '').trim() === selectedYear;
            });
        }

        // Определяем неполный год
        var partialYear = null;
        var partialQuarters = 0;
        if (yearCol && quarterCol && years.length >= 2) {
            var qSet = {};
            data.forEach(function (row) {
                var y = String(row[yearCol] || '').trim();
                var q = String(row[quarterCol] || '').trim();
                if (y && q) {
                    if (!qSet[y]) { qSet[y] = {}; }
                    qSet[y][q] = true;
                }
            });
            var lastY = years[years.length - 1];
            var prevY = years[years.length - 2];
            var lastQCount = Object.keys(qSet[lastY] || {}).length;
            var prevQCount = Object.keys(qSet[prevY] || {}).length;
            if (lastQCount < prevQCount) {
                partialYear = lastY;
                partialQuarters = lastQCount;
            }
        }

        // Агрегация: компания → год → { weight, usd }
        var byCompanyYear = {};
        var totalByCompany = {};
        var grandTotalByYear = {};

        filteredData.forEach(function (row) {
            var company = normalizeCompany(String(row[companyCol] || ''));
            if (!company) { return; }
            var year = yearCol ? String(row[yearCol] || '').trim() : 'Всего';
            if (!year) { return; }
            var w = weightCol ? (Number(row[weightCol]) || 0) : 0;
            var u = statUsdCol ? (Number(row[statUsdCol]) || 0) : 0;

            if (!byCompanyYear[company]) { byCompanyYear[company] = {}; }
            if (!byCompanyYear[company][year]) { byCompanyYear[company][year] = { weight: 0, usd: 0 }; }
            byCompanyYear[company][year].weight += w;
            byCompanyYear[company][year].usd += u;

            if (!totalByCompany[company]) { totalByCompany[company] = { weight: 0, usd: 0 }; }
            totalByCompany[company].weight += w;
            totalByCompany[company].usd += u;

            if (!grandTotalByYear[year]) { grandTotalByYear[year] = { weight: 0, usd: 0 }; }
            grandTotalByYear[year].weight += w;
            grandTotalByYear[year].usd += u;
        });

        // Сортировка по весу (или USD если веса нет)
        var sortKey = weightCol ? 'weight' : 'usd';
        var companiesSorted = Object.keys(totalByCompany).sort(function (a, b) {
            return totalByCompany[b][sortKey] - totalByCompany[a][sortKey];
        });

        var displayN = (topN === 'all' || topN >= companiesSorted.length) ? companiesSorted.length : topN;
        var companies = companiesSorted.slice(0, displayN);
        if (companies.length === 0) {
            analysisResults.innerHTML = '<div class="analysis-empty"><p>Нет данных для анализа.</p></div>';
            return;
        }

        var cols = years.length > 0 ? years : ['Всего'];
        var leader = companies[0];

        // Общий итог
        var grandTotal = { weight: 0, usd: 0 };
        companiesSorted.forEach(function (c) {
            grandTotal.weight += totalByCompany[c].weight;
            grandTotal.usd += totalByCompany[c].usd;
        });

        // --- HTML ---
        var html = '<div class="analysis-section">';
        html += '<div class="sankey-controls">';
        html += '<h3 class="analysis-section-title" style="margin:0">Топ ' + companyLabel.toLowerCase() + 'ей: объёмы и стоимость</h3>';

        // Селектор года
        if (yearCol && years.length > 0) {
            html += '<select class="company-ranking-year-select">';
            html += '<option value="all"' + (!selectedYear || selectedYear === 'all' ? ' selected' : '') + '>Все годы</option>';
            years.forEach(function (y) {
                html += '<option value="' + y + '"' + (selectedYear === y ? ' selected' : '') + '>' + y + '</option>';
            });
            html += '</select>';
        }
        // Селектор topN
        html += '<select class="company-ranking-topn-select">';
        [10, 15, 20, 'all'].forEach(function (v) {
            var label = v === 'all' ? 'Все' : 'Топ-' + v;
            var sel = (String(topN) === String(v)) ? ' selected' : '';
            html += '<option value="' + v + '"' + sel + '>' + label + '</option>';
        });
        html += '</select>';
        html += '</div>';

        // --- Таблица кг ---
        if (weightCol) {
            html += '<div class="analysis-section">';
            html += '<h3 class="analysis-section-title">Объём, кг (' + companyLabel + ')</h3>';
            html += '<div class="data-table-wrapper"><table class="data-table">';
            html += '<thead><tr><th>' + companyLabel + '</th>';
            cols.forEach(function (y) {
                var label = (y === partialYear) ? 'Q1' + (partialQuarters > 1 ? '-Q' + partialQuarters : '') + ' ' + y : y;
                html += '<th>' + label + '</th>';
            });
            html += '<th>Доля, %</th></tr></thead><tbody>';

            companies.forEach(function (c) {
                html += '<tr><td title="' + c + '">' + (c.length > 40 ? c.slice(0, 39) + '\u2026' : c) + '</td>';
                cols.forEach(function (y) {
                    var d = byCompanyYear[c] && byCompanyYear[c][y];
                    var val = d ? d.weight : 0;
                    html += '<td class="numeric">' + (val > 0 ? formatNumber(Math.round(val)) : '-') + '</td>';
                });
                var pct = grandTotal.weight > 0 ? round2(totalByCompany[c].weight / grandTotal.weight * 100) : 0;
                html += '<td class="numeric">' + (pct > 0 ? pct + '%' : '-') + '</td>';
                html += '</tr>';
            });

            // ИТОГО
            html += '<tr style="font-weight:600;border-top:2px solid var(--color-border)"><td>ИТОГО</td>';
            cols.forEach(function (y) {
                var t = grandTotalByYear[y] ? grandTotalByYear[y].weight : 0;
                html += '<td class="numeric">' + formatNumber(Math.round(t)) + '</td>';
            });
            html += '<td class="numeric">100%</td></tr>';

            // Доля лидера
            html += '<tr style="font-style:italic"><td>Доля ' + (leader.length > 30 ? leader.slice(0, 29) + '\u2026' : leader) + ', %</td>';
            cols.forEach(function (y) {
                var lv = byCompanyYear[leader] && byCompanyYear[leader][y] ? byCompanyYear[leader][y].weight : 0;
                var tv = grandTotalByYear[y] ? grandTotalByYear[y].weight : 0;
                var p = tv > 0 ? round2(lv / tv * 100) : 0;
                html += '<td class="numeric">' + (p > 0 ? p + '%' : '-') + '</td>';
            });
            html += '<td class="numeric"></td></tr>';

            html += '</tbody></table></div></div>';
        }

        // --- Таблица тыс. USD ---
        if (statUsdCol) {
            html += '<div class="analysis-section">';
            html += '<h3 class="analysis-section-title">Стоимость, тыс. USD (' + companyLabel + ')</h3>';
            html += '<div class="data-table-wrapper"><table class="data-table">';
            html += '<thead><tr><th>' + companyLabel + '</th>';
            cols.forEach(function (y) {
                var label = (y === partialYear) ? 'Q1' + (partialQuarters > 1 ? '-Q' + partialQuarters : '') + ' ' + y : y;
                html += '<th>' + label + '</th>';
            });
            html += '<th>Доля, %</th></tr></thead><tbody>';

            companies.forEach(function (c) {
                html += '<tr><td title="' + c + '">' + (c.length > 40 ? c.slice(0, 39) + '\u2026' : c) + '</td>';
                cols.forEach(function (y) {
                    var d = byCompanyYear[c] && byCompanyYear[c][y];
                    var val = d ? d.usd : 0;
                    html += '<td class="numeric">' + (val > 0 ? formatNumber(round2(val / 1000)) : '-') + '</td>';
                });
                var pct = grandTotal.usd > 0 ? round2(totalByCompany[c].usd / grandTotal.usd * 100) : 0;
                html += '<td class="numeric">' + (pct > 0 ? pct + '%' : '-') + '</td>';
                html += '</tr>';
            });

            // ИТОГО
            html += '<tr style="font-weight:600;border-top:2px solid var(--color-border)"><td>ИТОГО</td>';
            cols.forEach(function (y) {
                var t = grandTotalByYear[y] ? grandTotalByYear[y].usd : 0;
                html += '<td class="numeric">' + formatNumber(round2(t / 1000)) + '</td>';
            });
            html += '<td class="numeric">100%</td></tr>';

            // Доля лидера
            html += '<tr style="font-style:italic"><td>Доля ' + (leader.length > 30 ? leader.slice(0, 29) + '\u2026' : leader) + ', %</td>';
            cols.forEach(function (y) {
                var lv = byCompanyYear[leader] && byCompanyYear[leader][y] ? byCompanyYear[leader][y].usd : 0;
                var tv = grandTotalByYear[y] ? grandTotalByYear[y].usd : 0;
                var p = tv > 0 ? round2(lv / tv * 100) : 0;
                html += '<td class="numeric">' + (p > 0 ? p + '%' : '-') + '</td>';
            });
            html += '<td class="numeric"></td></tr>';

            html += '</tbody></table></div></div>';
        }

        // --- Горизонтальный bar-chart (по весу или USD) ---
        var chartMetric = weightCol ? 'weight' : 'usd';
        var chartUnit = weightCol ? 'кг' : 'тыс. USD';
        var chartDivisor = weightCol ? 1 : 1000;

        var barTop = companies.slice(0, Math.min(companies.length, 20));
        var barHeight = 28;
        var maxLabelLen = 0;
        barTop.forEach(function (c) { if (c.length > maxLabelLen) { maxLabelLen = c.length; } });
        var labelWidth = Math.max(200, Math.min(350, maxLabelLen * 6.5 + 16));
        var cw = Math.max(750, labelWidth + 500);
        var padding = { top: 10, right: 100, bottom: 10, left: labelWidth };
        var ch = padding.top + barTop.length * (barHeight + 8) + padding.bottom;
        var innerW = cw - padding.left - padding.right;
        var maxVal = totalByCompany[barTop[0]][chartMetric] / chartDivisor;
        if (maxVal === 0) { maxVal = 1; }

        html += '<div class="analysis-section">';
        html += '<h3 class="analysis-section-title">Топ ' + companyLabel.toLowerCase() + 'ей по объёму (' + chartUnit + ')</h3>';
        html += '<svg class="analysis-chart company-ranking-chart" width="' + cw + '" height="' + ch + '" viewBox="0 0 ' + cw + ' ' + ch + '">';
        html += '<style>text { font-family: ' + CHART_FONT + '; font-size: 12px; fill: ' + CHART_COLORS.text + '; }</style>';

        barTop.forEach(function (c, i) {
            var val = totalByCompany[c][chartMetric] / chartDivisor;
            var pct = grandTotal[chartMetric] > 0 ? round2(totalByCompany[c][chartMetric] / grandTotal[chartMetric] * 100) : 0;
            var bw = Math.max(1, (val / maxVal) * innerW);
            var y = padding.top + i * (barHeight + 8);
            var label = c.length > 35 ? c.slice(0, 34) + '\u2026' : c;
            html += '<text x="' + (padding.left - 8) + '" y="' + (y + barHeight / 2 + 4) + '" text-anchor="end" font-size="11" fill="' + CHART_COLORS.text + '">' + label + '</text>';
            html += '<rect x="' + padding.left + '" y="' + y + '" width="' + bw + '" height="' + barHeight + '" fill="' + CHART_COLORS.primary + '" rx="3"/>';
            html += '<text x="' + (padding.left + bw + 6) + '" y="' + (y + barHeight / 2 + 4) + '" font-size="11" fill="' + CHART_COLORS.textMuted + '">' + formatNumber(weightCol ? Math.round(val) : round2(val)) + ' (' + pct + '%)</text>';
        });

        html += '</svg>';
        html += '<button class="btn btn-secondary analysis-export-chart-png" style="margin-top:8px;font-size:12px">Скачать график PNG</button>';
        html += '</div>';

        // Кнопки экспорта
        html += '<div class="processing-export" style="margin-top:20px">';
        html += '<button class="btn btn-primary analysis-export-xlsx">Скачать XLSX</button>';
        html += '<button class="btn btn-secondary analysis-export-csv">Скачать CSV</button>';
        html += '</div>';

        analysisResults.innerHTML = html;

        // --- Post-render: селекторы ---
        var yearSelect = analysisResults.querySelector('.company-ranking-year-select');
        var topnSelect = analysisResults.querySelector('.company-ranking-topn-select');

        function rerun() {
            var sy = yearSelect ? yearSelect.value : 'all';
            var sn = topnSelect ? topnSelect.value : '15';
            var tn = sn === 'all' ? 'all' : parseInt(sn, 10);
            renderCompanyRankingAnalysis(data, headers, sy, tn, opts);
        }
        if (yearSelect) { yearSelect.addEventListener('change', rerun); }
        if (topnSelect) { topnSelect.addEventListener('change', rerun); }

        // PNG
        var chartPngBtn = analysisResults.querySelector('.analysis-export-chart-png');
        if (chartPngBtn) {
            chartPngBtn.addEventListener('click', function () {
                var svg = analysisResults.querySelector('.company-ranking-chart');
                if (svg) { exportChartPNG(svg, baseFileName() + '_' + exportName + '.png'); }
            });
        }

        // Экспорт данных
        var exportRows = [];
        var exportHeaders = [companyLabel];
        cols.forEach(function (y) {
            var label = (y === partialYear) ? 'Q1-Q' + partialQuarters + ' ' + y : y;
            exportHeaders.push(label + ' (кг)');
            if (statUsdCol) { exportHeaders.push(label + ' (тыс. USD)'); }
        });
        exportHeaders.push('Доля, %');

        companies.forEach(function (c) {
            var row = {};
            row[companyLabel] = c;
            cols.forEach(function (y) {
                var label = (y === partialYear) ? 'Q1-Q' + partialQuarters + ' ' + y : y;
                var d = byCompanyYear[c] && byCompanyYear[c][y];
                if (weightCol) { row[label + ' (кг)'] = d ? Math.round(d.weight) : 0; }
                if (statUsdCol) { row[label + ' (тыс. USD)'] = d ? round2(d.usd / 1000) : 0; }
            });
            row['Доля, %'] = grandTotal[sortKey] > 0 ? round2(totalByCompany[c][sortKey] / grandTotal[sortKey] * 100) + '%' : '-';
            exportRows.push(row);
        });

        // ИТОГО
        var totalRow = {};
        totalRow[companyLabel] = 'ИТОГО';
        cols.forEach(function (y) {
            var label = (y === partialYear) ? 'Q1-Q' + partialQuarters + ' ' + y : y;
            if (weightCol) { totalRow[label + ' (кг)'] = grandTotalByYear[y] ? Math.round(grandTotalByYear[y].weight) : 0; }
            if (statUsdCol) { totalRow[label + ' (тыс. USD)'] = grandTotalByYear[y] ? round2(grandTotalByYear[y].usd / 1000) : 0; }
        });
        totalRow['Доля, %'] = '100%';
        exportRows.push(totalRow);

        analysisResults.querySelector('.analysis-export-xlsx').addEventListener('click', function () {
            exportAnalysisXLSX(exportRows, exportHeaders, exportName);
        });
        analysisResults.querySelector('.analysis-export-csv').addEventListener('click', function () {
            exportAnalysisCSV(exportRows, exportHeaders, exportName);
        });
    }

    function getNumericColumns(data, headers) {
        var result = [];
        headers.forEach(function (h) {
            var numeric = true;
            var checked = 0;
            for (var i = 0; i < Math.min(data.length, 20); i++) {
                var val = data[i][h];
                if (val !== '' && val !== null && val !== undefined) {
                    if (isNaN(Number(val))) { numeric = false; break; }
                    checked++;
                }
            }
            if (numeric && checked > 0) { result.push(h); }
        });
        return result;
    }

    function renderGrowthAnalysis(data, numericCols) {
        var html = '<div class="analysis-section"><h3 class="analysis-section-title">Темп роста</h3>';
        html += '<div class="kpi-grid">';

        numericCols.forEach(function (col) {
            var values = data.map(function (r) { return Number(r[col]); }).filter(function (v) { return !isNaN(v); });
            if (values.length < 2) { return; }

            var half = Math.floor(values.length / 2);
            var firstHalf = values.slice(0, half);
            var secondHalf = values.slice(half);
            var avgFirst = firstHalf.reduce(function (a, b) { return a + b; }, 0) / firstHalf.length;
            var avgSecond = secondHalf.reduce(function (a, b) { return a + b; }, 0) / secondHalf.length;

            var growth = avgFirst !== 0 ? ((avgSecond - avgFirst) / Math.abs(avgFirst) * 100) : 0;
            var deltaClass = growth >= 0 ? 'growth' : 'decline';
            var sign = growth >= 0 ? '+' : '';

            html += '<div class="kpi-card">' +
                '<h3 class="kpi-card-title">' + col + '</h3>' +
                '<div class="kpi-card-value">' + sign + growth.toFixed(1) + '%</div>' +
                '<div class="kpi-card-delta ' + deltaClass + '">' +
                (growth >= 0 ? 'Рост' : 'Снижение') +
                '</div></div>';
        });

        html += '</div></div>';
        return html;
    }

    function renderStatisticsAnalysis(data, numericCols) {
        var html = '<div class="analysis-section"><h3 class="analysis-section-title">Статистика</h3>';
        html += '<div class="data-table-wrapper"><table class="data-table">';
        html += '<thead><tr>' +
            '<th>Столбец</th><th>Мин</th><th>Макс</th><th>Среднее</th><th>Медиана</th><th>Сумма</th>' +
            '</tr></thead><tbody>';

        numericCols.forEach(function (col) {
            var values = data.map(function (r) { return Number(r[col]); })
                .filter(function (v) { return !isNaN(v); });
            if (values.length === 0) { return; }

            var sorted = values.slice().sort(function (a, b) { return a - b; });
            var min = sorted[0];
            var max = sorted[sorted.length - 1];
            var sum = values.reduce(function (a, b) { return a + b; }, 0);
            var avg = sum / values.length;
            var mid = Math.floor(sorted.length / 2);
            var median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

            html += '<tr>' +
                '<td>' + col + '</td>' +
                '<td>' + formatNumber(min.toFixed(2)) + '</td>' +
                '<td>' + formatNumber(max.toFixed(2)) + '</td>' +
                '<td>' + formatNumber(avg.toFixed(2)) + '</td>' +
                '<td>' + formatNumber(median.toFixed(2)) + '</td>' +
                '<td>' + formatNumber(sum.toFixed(2)) + '</td>' +
                '</tr>';
        });

        html += '</tbody></table></div></div>';
        return html;
    }

    function renderTrendsAnalysis(data, numericCols) {
        var html = '<div class="analysis-section"><h3 class="analysis-section-title">Тренды</h3>';
        html += '<div class="action-cards">';

        numericCols.forEach(function (col) {
            var values = data.map(function (r) { return Number(r[col]); })
                .filter(function (v) { return !isNaN(v); });
            if (values.length < 3) { return; }

            var n = values.length;
            var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
            for (var i = 0; i < n; i++) {
                sumX += i;
                sumY += values[i];
                sumXY += i * values[i];
                sumX2 += i * i;
            }
            var slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
            var direction = slope > TREND_THRESHOLD ? 'Восходящий' : (slope < -TREND_THRESHOLD ? 'Нисходящий' : 'Стабильный');
            var icon = slope > TREND_THRESHOLD ? '📈' : (slope < -TREND_THRESHOLD ? '📉' : '➡️');

            html += '<div class="action-card">' +
                '<span class="action-card-icon">' + icon + '</span>' +
                '<div class="action-card-body">' +
                '<h3 class="action-card-title">' + col + '</h3>' +
                '<p class="action-card-description">' + direction +
                ' (наклон: ' + slope.toFixed(4) + ')</p>' +
                '</div></div>';
        });

        html += '</div></div>';
        return html;
    }

    /* ================================
       Analysis: Pivot Table
       ================================ */
    function renderPivotConfig(headers, numericCols) {
        var optAll = headers.map(function (h) { return '<option value="' + h + '">' + h + '</option>'; }).join('');
        var optNum = numericCols.map(function (h) { return '<option value="' + h + '">' + h + '</option>'; }).join('');

        var html = '<div class="pivot-config">' +
            '<h3 class="analysis-section-title">Сводная таблица</h3>' +
            '<div class="pivot-config-grid">' +
            '<div class="settings-group"><label class="settings-label">Строки</label>' +
            '<select id="pivot-row">' + optAll + '</select></div>' +
            '<div class="settings-group"><label class="settings-label">Столбцы</label>' +
            '<select id="pivot-col"><option value="">Нет</option>' + optAll + '</select></div>' +
            '<div class="settings-group"><label class="settings-label">Значение</label>' +
            '<select id="pivot-val">' + optNum + '</select></div>' +
            '<div class="settings-group"><label class="settings-label">Агрегация</label>' +
            '<select id="pivot-agg">' +
            '<option value="sum">Сумма</option>' +
            '<option value="avg">Среднее</option>' +
            '<option value="count">Количество</option>' +
            '<option value="min">Минимум</option>' +
            '<option value="max">Максимум</option>' +
            '</select></div>' +
            '</div>' +
            '<button class="btn btn-primary" id="pivot-build">Построить</button>' +
            '</div>' +
            '<div id="pivot-output"></div>';

        analysisResults.innerHTML = html;
        document.getElementById('pivot-build').addEventListener('click', buildPivotTable);
    }

    function buildPivotTable() {
        var data = getActiveData();
        var rowField = document.getElementById('pivot-row').value;
        var colField = document.getElementById('pivot-col').value;
        var valField = document.getElementById('pivot-val').value;
        var aggType = document.getElementById('pivot-agg').value;

        var pivot = computePivot(data, rowField, colField, valField, aggType);
        var html = renderPivotResult(pivot, rowField, colField, valField, aggType);
        document.getElementById('pivot-output').innerHTML = html;

        var csvBtn = document.getElementById('pivot-csv-btn');
        var xlsxBtn = document.getElementById('pivot-xlsx-btn');
        if (csvBtn) csvBtn.addEventListener('click', function () { exportPivotCSV(pivot, rowField, colField, aggType); });
        if (xlsxBtn) xlsxBtn.addEventListener('click', function () { exportPivotXLSX(pivot, rowField, colField, valField, aggType); });
    }

    function computePivot(data, rowField, colField, valField, aggType) {
        var rowKeysSet = {};
        var colKeysSet = {};
        var matrix = {};
        var hasCol = colField !== '';

        for (var i = 0; i < data.length; i++) {
            var row = data[i];
            var rk = String(row[rowField] || '');
            var ck = hasCol ? String(row[colField] || '') : '__total__';
            var val = Number(row[valField]);
            if (isNaN(val)) val = 0;

            rowKeysSet[rk] = true;
            colKeysSet[ck] = true;
            var key = rk + KEY_SEPARATOR + ck;

            if (!matrix[key]) {
                matrix[key] = { sum: 0, count: 0, min: Infinity, max: -Infinity };
            }
            matrix[key].sum += val;
            matrix[key].count++;
            if (val < matrix[key].min) matrix[key].min = val;
            if (val > matrix[key].max) matrix[key].max = val;
        }

        var rowKeys = Object.keys(rowKeysSet).sort();
        var colKeys = Object.keys(colKeysSet).sort();

        function getVal(cell) {
            if (!cell) return 0;
            if (aggType === 'sum') return cell.sum;
            if (aggType === 'avg') return cell.count > 0 ? cell.sum / cell.count : 0;
            if (aggType === 'count') return cell.count;
            if (aggType === 'min') return cell.min === Infinity ? 0 : cell.min;
            if (aggType === 'max') return cell.max === -Infinity ? 0 : cell.max;
            return cell.sum;
        }

        var rowTotals = {};
        var colTotals = {};
        var grandCells = { sum: 0, count: 0, min: Infinity, max: -Infinity };

        rowKeys.forEach(function (rk) {
            var rc = { sum: 0, count: 0, min: Infinity, max: -Infinity };
            colKeys.forEach(function (ck) {
                var cell = matrix[rk + KEY_SEPARATOR + ck];
                if (cell) {
                    rc.sum += cell.sum;
                    rc.count += cell.count;
                    if (cell.min < rc.min) rc.min = cell.min;
                    if (cell.max > rc.max) rc.max = cell.max;
                }
            });
            rowTotals[rk] = getVal(rc);
        });

        colKeys.forEach(function (ck) {
            var cc = { sum: 0, count: 0, min: Infinity, max: -Infinity };
            rowKeys.forEach(function (rk) {
                var cell = matrix[rk + KEY_SEPARATOR + ck];
                if (cell) {
                    cc.sum += cell.sum;
                    cc.count += cell.count;
                    if (cell.min < cc.min) cc.min = cell.min;
                    if (cell.max > cc.max) cc.max = cell.max;
                }
            });
            colTotals[ck] = getVal(cc);
            grandCells.sum += cc.sum;
            grandCells.count += cc.count;
            if (cc.min < grandCells.min) grandCells.min = cc.min;
            if (cc.max > grandCells.max) grandCells.max = cc.max;
        });

        return {
            rowKeys: rowKeys, colKeys: colKeys, matrix: matrix,
            rowTotals: rowTotals, colTotals: colTotals,
            grandTotal: getVal(grandCells), getVal: getVal, hasCol: hasCol
        };
    }

    function renderPivotResult(pivot, rowField, colField, valField, aggType) {
        var aggLabel = { sum: 'Сумма', avg: 'Среднее', count: 'Кол-во', min: 'Мин', max: 'Макс' }[aggType];
        var html = '<div class="analysis-section">';
        html += '<h3 class="analysis-section-title">' + aggLabel + ': ' + valField + '</h3>';
        html += '<div class="data-table-wrapper"><table class="data-table pivot-table">';

        /* Header */
        html += '<thead><tr><th>' + rowField + '</th>';
        if (pivot.hasCol) {
            pivot.colKeys.forEach(function (ck) { html += '<th>' + ck + '</th>'; });
        }
        html += '<th class="pivot-total">Итого</th></tr></thead>';

        /* Body */
        html += '<tbody>';
        pivot.rowKeys.forEach(function (rk) {
            html += '<tr><td>' + rk + '</td>';
            if (pivot.hasCol) {
                pivot.colKeys.forEach(function (ck) {
                    var cell = pivot.matrix[rk + KEY_SEPARATOR + ck];
                    var v = pivot.getVal(cell);
                    html += '<td class="numeric">' + formatNumber(v.toFixed(2)) + '</td>';
                });
            }
            html += '<td class="numeric pivot-total">' + formatNumber(pivot.rowTotals[rk].toFixed(2)) + '</td>';
            html += '</tr>';
        });

        /* Footer totals */
        html += '<tr class="pivot-total"><td>Итого</td>';
        if (pivot.hasCol) {
            pivot.colKeys.forEach(function (ck) {
                html += '<td class="numeric">' + formatNumber(pivot.colTotals[ck].toFixed(2)) + '</td>';
            });
        }
        html += '<td class="numeric">' + formatNumber(pivot.grandTotal.toFixed(2)) + '</td>';
        html += '</tr></tbody></table></div>';

        html += '<div class="pivot-export-btns">' +
            '<button class="btn btn-secondary" id="pivot-csv-btn">Экспорт CSV</button>' +
            '<button class="btn btn-secondary" id="pivot-xlsx-btn">Экспорт XLSX</button>' +
            '</div></div>';
        return html;
    }

    function exportPivotCSV(pivot, rowField, colField, aggType) {
        var sep = CSV_SEPARATOR;
        var lines = [];
        var header = [rowField];
        if (pivot.hasCol) pivot.colKeys.forEach(function (ck) { header.push(ck); });
        header.push('Итого');
        lines.push(header.join(sep));

        pivot.rowKeys.forEach(function (rk) {
            var row = [rk];
            if (pivot.hasCol) {
                pivot.colKeys.forEach(function (ck) {
                    row.push(pivot.getVal(pivot.matrix[rk + KEY_SEPARATOR + ck]).toFixed(2));
                });
            }
            row.push(pivot.rowTotals[rk].toFixed(2));
            lines.push(row.join(sep));
        });

        var totalRow = ['Итого'];
        if (pivot.hasCol) pivot.colKeys.forEach(function (ck) { totalRow.push(pivot.colTotals[ck].toFixed(2)); });
        totalRow.push(pivot.grandTotal.toFixed(2));
        lines.push(totalRow.join(sep));

        var csv = UTF8_BOM + lines.join('\n');
        var blob = new Blob([csv], { type: MIME_CSV });
        triggerDownload(blob, 'pivot_export.csv');
    }

    function exportPivotXLSX(pivot, rowField, colField, valField, aggType) {
        var aoa = [];
        var header = [rowField];
        if (pivot.hasCol) pivot.colKeys.forEach(function (ck) { header.push(ck); });
        header.push('Итого');
        aoa.push(header);

        pivot.rowKeys.forEach(function (rk) {
            var row = [rk];
            if (pivot.hasCol) {
                pivot.colKeys.forEach(function (ck) {
                    row.push(pivot.getVal(pivot.matrix[rk + KEY_SEPARATOR + ck]));
                });
            }
            row.push(pivot.rowTotals[rk]);
            aoa.push(row);
        });

        var totalRow = ['Итого'];
        if (pivot.hasCol) pivot.colKeys.forEach(function (ck) { totalRow.push(pivot.colTotals[ck]); });
        totalRow.push(pivot.grandTotal);
        aoa.push(totalRow);

        var wb = XLSX.utils.book_new();
        var ws = XLSX.utils.aoa_to_sheet(aoa);
        XLSX.utils.book_append_sheet(wb, ws, 'Сводная');
        XLSX.writeFile(wb, 'pivot_export.xlsx');
    }

    /* ================================
       Analysis: CAGR & Growth
       ================================ */
    function renderCAGRConfig(headers, numericCols) {
        var optNum = numericCols.map(function (h) { return '<option value="' + h + '">' + h + '</option>'; }).join('');
        var optGroup = '<option value="">Нет (общий итог)</option>' +
            headers.map(function (h) { return '<option value="' + h + '">' + h + '</option>'; }).join('');

        var html = '<div class="cagr-config">' +
            '<h3 class="analysis-section-title">CAGR и темпы роста</h3>' +
            '<div class="cagr-config-grid">' +
            '<div class="settings-group"><label class="settings-label">Значение</label>' +
            '<select id="cagr-val">' + optNum + '</select></div>' +
            '<div class="settings-group"><label class="settings-label">Группировка</label>' +
            '<select id="cagr-group">' + optGroup + '</select></div>' +
            '</div>' +
            '<button class="btn btn-primary" id="cagr-build">Рассчитать</button>' +
            '</div>' +
            '<div id="cagr-output"></div>';

        analysisResults.innerHTML = html;
        document.getElementById('cagr-build').addEventListener('click', buildCAGRAnalysis);
    }

    function computeCAGR(startVal, endVal, years) {
        if (startVal <= 0 || years <= 0) return null;
        return Math.pow(endVal / startVal, 1 / years) - 1;
    }

    function buildCAGRAnalysis() {
        var data = getActiveData();
        var headers = getActiveHeaders();
        var valField = document.getElementById('cagr-val').value;
        var groupField = document.getElementById('cagr-group').value;

        var yearCol = findColumn(headers, COL_YEAR);
        if (!yearCol) {
            document.getElementById('cagr-output').innerHTML =
                '<div class="analysis-empty"><p>Колонка "' + COL_YEAR + '" не найдена. Выполните извлечение дат в обработке.</p></div>';
            return;
        }
        var yearName = headers[yearCol];

        /* Group by year (and optionally by group) */
        var groups = {};
        for (var i = 0; i < data.length; i++) {
            var row = data[i];
            var year = String(row[yearName] || '');
            var gk = groupField ? String(row[groupField] || '') : '__all__';
            var val = Number(row[valField]);
            if (isNaN(val)) continue;

            if (!groups[gk]) groups[gk] = {};
            if (!groups[gk][year]) groups[gk][year] = 0;
            groups[gk][year] += val;
        }

        var html = '<div class="analysis-section"><h3 class="analysis-section-title">CAGR: ' + valField + '</h3>';

        var groupKeys = Object.keys(groups).sort();
        groupKeys.forEach(function (gk) {
            var yearlyData = groups[gk];
            var years = Object.keys(yearlyData).sort();
            if (years.length < 2) return;

            var first = yearlyData[years[0]];
            var last = yearlyData[years[years.length - 1]];
            var n = years.length - 1;
            var cagr = computeCAGR(first, last, n);
            var cagrPct = cagr !== null ? (cagr * 100).toFixed(1) : 'N/A';
            var cagrClass = cagr !== null && cagr >= 0 ? 'growth' : 'decline';

            var title = gk === '__all__' ? 'Общий итог' : gk;
            html += '<div class="kpi-grid" style="margin-bottom:16px">' +
                '<div class="kpi-card"><h3 class="kpi-card-title">' + title + '</h3>' +
                '<div class="kpi-card-value">' + cagrPct + '%</div>' +
                '<div class="kpi-card-delta ' + cagrClass + '">CAGR (' + years[0] + '–' + years[years.length - 1] + ')</div>' +
                '</div></div>';

            /* YoY table */
            html += '<div class="data-table-wrapper"><table class="data-table cagr-result-table">';
            html += '<thead><tr><th>Год</th><th>Значение</th><th>Рост (%)</th></tr></thead><tbody>';
            for (var j = 0; j < years.length; j++) {
                var v = yearlyData[years[j]];
                var yoy = '';
                var yoyClass = '';
                if (j > 0) {
                    var prev = yearlyData[years[j - 1]];
                    if (prev !== 0) {
                        var pct = ((v - prev) / Math.abs(prev) * 100).toFixed(1);
                        yoy = (pct >= 0 ? '+' : '') + pct + '%';
                        yoyClass = pct >= 0 ? 'growth-positive' : 'growth-negative';
                    }
                }
                html += '<tr><td>' + years[j] + '</td><td class="numeric">' +
                    formatNumber(v.toFixed(2)) + '</td><td class="' + yoyClass + '">' + yoy + '</td></tr>';
            }
            html += '</tbody></table></div>';
        });

        html += '</div>';
        document.getElementById('cagr-output').innerHTML = html;
    }

    /* ================================
       Analysis: Sankey Diagram
       ================================ */
    var SANKEY_COLORS = [
        '#2563EB', '#16A34A', '#DC2626', '#F59E0B', '#8B5CF6',
        '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#6366F1',
        '#14B8A6', '#E11D48', '#A855F7', '#0EA5E9', '#EAB308'
    ];

    function renderSankeyConfig(headers, numericCols) {
        var optAll = headers.map(function (h) { return '<option value="' + h + '">' + h + '</option>'; }).join('');
        var optNum = numericCols.map(function (h) { return '<option value="' + h + '">' + h + '</option>'; }).join('');

        /* Pre-select defaults if available */
        var srcDefault = COL_MANUFACTURER;
        var tgtDefault = COL_RECEIVER;
        var valDefault = COL_WEIGHT;

        function makeOpt(arr, def) {
            return arr.map(function (h) {
                var sel = h === def ? ' selected' : '';
                return '<option value="' + h + '"' + sel + '>' + h + '</option>';
            }).join('');
        }

        var html = '<div class="sankey-config">' +
            '<h3 class="analysis-section-title">Диаграмма Санки</h3>' +
            '<div class="sankey-config-grid">' +
            '<div class="settings-group"><label class="settings-label">Источник</label>' +
            '<select id="sankey-src">' + makeOpt(headers, srcDefault) + '</select></div>' +
            '<div class="settings-group"><label class="settings-label">Приёмник</label>' +
            '<select id="sankey-tgt">' + makeOpt(headers, tgtDefault) + '</select></div>' +
            '<div class="settings-group"><label class="settings-label">Значение</label>' +
            '<select id="sankey-val">' + makeOpt(numericCols, valDefault) + '</select></div>' +
            '<div class="settings-group"><label class="settings-label">ТОП-N</label>' +
            '<input type="number" id="sankey-topn" value="10" min="3" max="20"></div>' +
            '<div class="settings-group"><label class="settings-label">&nbsp;</label>' +
            '<button class="btn btn-primary" id="sankey-build">Построить</button></div>' +
            '</div></div>' +
            '<div id="sankey-output"></div>';

        analysisResults.innerHTML = html;
        document.getElementById('sankey-build').addEventListener('click', buildSankeyDiagram);
    }

    function buildSankeyData(data, srcField, tgtField, valField, topN) {
        var flows = {};
        var srcTotals = {};
        var tgtTotals = {};

        for (var i = 0; i < data.length; i++) {
            var row = data[i];
            var s = String(row[srcField] || '').trim();
            var t = String(row[tgtField] || '').trim();
            var v = Number(row[valField]);
            if (!s || !t || isNaN(v) || v <= 0) continue;

            var fk = s + KEY_SEPARATOR + t;
            flows[fk] = (flows[fk] || 0) + v;
            srcTotals[s] = (srcTotals[s] || 0) + v;
            tgtTotals[t] = (tgtTotals[t] || 0) + v;
        }

        /* Top N sources and targets */
        function topKeys(obj, n) {
            return Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; }).slice(0, n);
        }

        var topSrc = topKeys(srcTotals, topN);
        var topTgt = topKeys(tgtTotals, topN);
        var topSrcSet = {};
        var topTgtSet = {};
        topSrc.forEach(function (s) { topSrcSet[s] = true; });
        topTgt.forEach(function (t) { topTgtSet[t] = true; });

        var sources = topSrc.map(function (s) { return { name: s, total: srcTotals[s] }; });
        var targets = topTgt.map(function (t) { return { name: t, total: tgtTotals[t] }; });

        var filteredFlows = [];
        Object.keys(flows).forEach(function (fk) {
            var parts = fk.split(KEY_SEPARATOR);
            if (topSrcSet[parts[0]] && topTgtSet[parts[1]]) {
                filteredFlows.push({ source: parts[0], target: parts[1], value: flows[fk] });
            }
        });
        filteredFlows.sort(function (a, b) { return b.value - a.value; });

        /* Recalculate totals based on filtered flows */
        var srcFiltered = {};
        var tgtFiltered = {};
        filteredFlows.forEach(function (f) {
            srcFiltered[f.source] = (srcFiltered[f.source] || 0) + f.value;
            tgtFiltered[f.target] = (tgtFiltered[f.target] || 0) + f.value;
        });
        sources.forEach(function (s) { s.total = srcFiltered[s.name] || 0; });
        targets.forEach(function (t) { t.total = tgtFiltered[t.name] || 0; });
        sources = sources.filter(function (s) { return s.total > 0; });
        targets = targets.filter(function (t) { return t.total > 0; });

        return { sources: sources, targets: targets, flows: filteredFlows };
    }

    function renderSankeyDiagram(sankeyData, optW, optH) {
        var W = optW || 900, H = optH || 600;
        var padT = 20, padB = 20, padL = 20, padR = 20;
        var nodeW = 16;
        var labelOffset = 6;
        var srcX = padL;
        var tgtX = W - padR - nodeW;
        var gap = 6;
        var availH = H - padT - padB;

        var sources = sankeyData.sources;
        var targets = sankeyData.targets;
        var flows = sankeyData.flows;

        var srcTotal = sources.reduce(function (a, s) { return a + s.total; }, 0);
        var tgtTotal = targets.reduce(function (a, t) { return a + t.total; }, 0);
        var maxTotal = Math.max(srcTotal, tgtTotal);

        var srcScale = (availH - (sources.length - 1) * gap) / maxTotal;
        var tgtScale = (availH - (targets.length - 1) * gap) / maxTotal;
        var scale = Math.min(srcScale, tgtScale);

        /* Position nodes */
        var srcY = padT;
        sources.forEach(function (s) {
            s.h = Math.max(4, s.total * scale);
            s.y = srcY;
            s.offset = 0;
            srcY += s.h + gap;
        });

        var tgtY = padT;
        targets.forEach(function (t) {
            t.h = Math.max(4, t.total * scale);
            t.y = tgtY;
            t.offset = 0;
            tgtY += t.h + gap;
        });

        /* Build SVG */
        var svg = '<svg class="sankey-svg" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">';

        /* Index for fast lookup */
        var srcIdx = {};
        sources.forEach(function (s, i) { srcIdx[s.name] = i; });
        var tgtIdx = {};
        targets.forEach(function (t, i) { tgtIdx[t.name] = i; });

        /* Draw flows */
        var ctrlDist = (tgtX - srcX - nodeW) * 0.4;
        flows.forEach(function (f) {
            var si = srcIdx[f.source];
            var ti = tgtIdx[f.target];
            if (si === undefined || ti === undefined) return;
            var s = sources[si];
            var t = targets[ti];
            var fh = Math.max(1, f.value * scale);

            var sy = s.y + s.offset;
            var ty = t.y + t.offset;
            s.offset += fh;
            t.offset += fh;

            var x0 = srcX + nodeW;
            var x1 = tgtX;
            var color = SANKEY_COLORS[si % SANKEY_COLORS.length];

            var d = 'M' + x0 + ',' + sy +
                ' C' + (x0 + ctrlDist) + ',' + sy + ' ' + (x1 - ctrlDist) + ',' + ty + ' ' + x1 + ',' + ty +
                ' L' + x1 + ',' + (ty + fh) +
                ' C' + (x1 - ctrlDist) + ',' + (ty + fh) + ' ' + (x0 + ctrlDist) + ',' + (sy + fh) + ' ' + x0 + ',' + (sy + fh) +
                ' Z';

            svg += '<path class="sankey-flow" d="' + d + '" fill="' + color + '">' +
                '<title>' + f.source + ' → ' + f.target + ': ' + formatNumber(f.value.toFixed(0)) + '</title></path>';
        });

        /* Draw source nodes */
        sources.forEach(function (s, i) {
            var color = SANKEY_COLORS[i % SANKEY_COLORS.length];
            svg += '<rect x="' + srcX + '" y="' + s.y + '" width="' + nodeW + '" height="' + s.h +
                '" fill="' + color + '" rx="2"/>';
            var label = s.name.length > 22 ? s.name.substring(0, 20) + '...' : s.name;
            svg += '<text class="sankey-node-label" x="' + (srcX + nodeW + labelOffset) + '" y="' +
                (s.y + s.h / 2) + '" dominant-baseline="middle">' + label + '</text>';
            svg += '<text class="sankey-node-value" x="' + (srcX + nodeW + labelOffset) + '" y="' +
                (s.y + s.h / 2 + 14) + '" dominant-baseline="middle">' + formatNumber(s.total.toFixed(0)) + '</text>';
        });

        /* Draw target nodes */
        targets.forEach(function (t, i) {
            var color = SANKEY_COLORS[i % SANKEY_COLORS.length];
            svg += '<rect x="' + tgtX + '" y="' + t.y + '" width="' + nodeW + '" height="' + t.h +
                '" fill="' + color + '" rx="2"/>';
            var label = t.name.length > 22 ? t.name.substring(0, 20) + '...' : t.name;
            svg += '<text class="sankey-node-label" x="' + (tgtX - labelOffset) + '" y="' +
                (t.y + t.h / 2) + '" dominant-baseline="middle" text-anchor="end">' + label + '</text>';
            svg += '<text class="sankey-node-value" x="' + (tgtX - labelOffset) + '" y="' +
                (t.y + t.h / 2 + 14) + '" dominant-baseline="middle" text-anchor="end">' + formatNumber(t.total.toFixed(0)) + '</text>';
        });

        svg += '</svg>';
        return svg;
    }

    function buildSankeyDiagram() {
        var data = getActiveData();
        var srcField = document.getElementById('sankey-src').value;
        var tgtField = document.getElementById('sankey-tgt').value;
        var valField = document.getElementById('sankey-val').value;
        var topN = parseInt(document.getElementById('sankey-topn').value) || 10;

        var sankeyData = buildSankeyData(data, srcField, tgtField, valField, topN);

        if (sankeyData.flows.length === 0) {
            document.getElementById('sankey-output').innerHTML =
                '<div class="analysis-empty"><p>Нет данных для построения диаграммы</p></div>';
            return;
        }

        var svgStr = renderSankeyDiagram(sankeyData);
        var html = '<div class="sankey-container">' + svgStr + '</div>';
        html += '<div class="sankey-export-btns">' +
            '<button class="btn btn-secondary" id="sankey-png-btn">Экспорт PNG</button>' +
            '<button class="btn btn-secondary" id="sankey-svg-btn">Экспорт SVG</button>' +
            '</div>';

        document.getElementById('sankey-output').innerHTML = html;

        /* Export handlers */
        document.getElementById('sankey-png-btn').addEventListener('click', function () {
            var svgEl = document.querySelector('.sankey-svg');
            if (!svgEl) return;
            var serializer = new XMLSerializer();
            var svgString = serializer.serializeToString(svgEl);
            var canvas = document.createElement('canvas');
            canvas.width = 1800; canvas.height = 1200;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = CHART_COLORS.bg;
            ctx.fillRect(0, 0, 1800, 1200);
            var img = new Image();
            img.onload = function () {
                ctx.drawImage(img, 0, 0, 1800, 1200);
                canvas.toBlob(function (blob) { triggerDownload(blob, 'sankey.png'); });
            };
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
        });

        document.getElementById('sankey-svg-btn').addEventListener('click', function () {
            var svgEl = document.querySelector('.sankey-svg');
            if (!svgEl) return;
            var serializer = new XMLSerializer();
            var svgString = serializer.serializeToString(svgEl);
            var blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            triggerDownload(blob, 'sankey.svg');
        });
    }

    /* ================================
       Analysis: Weighted Average Prices
       ================================ */
    function renderWeightedPriceConfig(headers, numericCols) {
        var optGroup = headers.map(function (h) { return '<option value="' + h + '">' + h + '</option>'; }).join('');

        /* Pre-select value fields */
        var valOptions = '';
        var priceFields = [COL_STAT_USD, COL_INVOICE_RUB, COL_INVOICE, COL_CUSTOMS];
        var availPrice = numericCols.filter(function (h) { return priceFields.indexOf(h) !== -1; });
        if (availPrice.length === 0) availPrice = numericCols;
        valOptions = availPrice.map(function (h) { return '<option value="' + h + '">' + h + '</option>'; }).join('');

        var html = '<div class="wp-config">' +
            '<h3 class="analysis-section-title">Средневзвешенные цены</h3>' +
            '<div class="wp-config-grid">' +
            '<div class="settings-group"><label class="settings-label">Группировка</label>' +
            '<select id="wp-group">' + optGroup + '</select></div>' +
            '<div class="settings-group"><label class="settings-label">Стоимость</label>' +
            '<select id="wp-val">' + valOptions + '</select></div>' +
            '<div class="settings-group"><label class="settings-label">&nbsp;</label>' +
            '<button class="btn btn-primary" id="wp-build">Рассчитать</button></div>' +
            '</div></div>' +
            '<div id="wp-output"></div>';

        analysisResults.innerHTML = html;
        document.getElementById('wp-build').addEventListener('click', buildWeightedPrices);
    }

    function buildWeightedPrices() {
        var data = getActiveData();
        var headers = getActiveHeaders();
        var groupField = document.getElementById('wp-group').value;
        var valField = document.getElementById('wp-val').value;

        var weightField = findColumn(headers, COL_WEIGHT);
        if (!weightField) {
            document.getElementById('wp-output').innerHTML =
                '<div class="analysis-empty"><p>Колонка "' + COL_WEIGHT + '" не найдена</p></div>';
            return;
        }

        var groups = {};
        for (var i = 0; i < data.length; i++) {
            var row = data[i];
            var gk = String(row[groupField] || '');
            var val = Number(row[valField]);
            var w = Number(row[weightField]);
            if (isNaN(val) || isNaN(w)) continue;

            if (!groups[gk]) groups[gk] = { sumVal: 0, sumW: 0, count: 0 };
            groups[gk].sumVal += val;
            groups[gk].sumW += w;
            groups[gk].count++;
        }

        var results = Object.keys(groups).map(function (gk) {
            var g = groups[gk];
            return {
                group: gk,
                sumValue: g.sumVal,
                sumWeight: g.sumW,
                weightedAvg: g.sumW > 0 ? g.sumVal / g.sumW : 0,
                count: g.count
            };
        });
        results.sort(function (a, b) { return b.sumWeight - a.sumWeight; });

        /* Determine unit */
        var unit = valField.indexOf('USD') !== -1 ? 'USD/кг' : 'нац. вал./кг';

        var html = '<div class="analysis-section">';
        html += '<h3 class="analysis-section-title">Средневзвешенная цена (' + unit + ')</h3>';
        html += '<p class="wp-unit-label">' + valField + ' / ' + weightField + '</p>';

        /* Table */
        html += '<div class="data-table-wrapper"><table class="data-table">';
        html += '<thead><tr><th>' + groupField + '</th><th>Сумма стоимости</th><th>Сумма веса (кг)</th><th>Цена (' + unit + ')</th><th>Записей</th></tr></thead><tbody>';

        var totalVal = 0, totalW = 0, totalCount = 0;
        results.forEach(function (r) {
            html += '<tr><td>' + r.group + '</td>' +
                '<td class="numeric">' + formatNumber(r.sumValue.toFixed(2)) + '</td>' +
                '<td class="numeric">' + formatNumber(r.sumWeight.toFixed(2)) + '</td>' +
                '<td class="numeric">' + formatNumber(r.weightedAvg.toFixed(2)) + '</td>' +
                '<td class="numeric">' + formatNumber(r.count) + '</td></tr>';
            totalVal += r.sumValue;
            totalW += r.sumWeight;
            totalCount += r.count;
        });

        var totalAvg = totalW > 0 ? totalVal / totalW : 0;
        html += '<tr class="pivot-total"><td>Итого</td>' +
            '<td class="numeric">' + formatNumber(totalVal.toFixed(2)) + '</td>' +
            '<td class="numeric">' + formatNumber(totalW.toFixed(2)) + '</td>' +
            '<td class="numeric">' + formatNumber(totalAvg.toFixed(2)) + '</td>' +
            '<td class="numeric">' + formatNumber(totalCount) + '</td></tr>';

        html += '</tbody></table></div>';

        /* Bar chart */
        html += '<div style="margin-top:16px;background:#fff;border:1px solid #E2E8F0;border-radius:8px;padding:24px">';
        html += renderWPBarChart(results, groupField, unit);
        html += '</div>';

        html += '</div>';
        document.getElementById('wp-output').innerHTML = html;
    }

    function renderWPBarChart(results, groupField, unit) {
        if (results.length === 0) return '';
        var W = 700, H = 320;
        var padL = 70, padR = 20, padT = 20, padB = 60;
        var chartW = W - padL - padR;
        var chartH = H - padT - padB;

        var maxVal = 0;
        results.forEach(function (r) { if (r.weightedAvg > maxVal) maxVal = r.weightedAvg; });
        if (maxVal === 0) maxVal = 1;

        var barW = Math.min(40, chartW / results.length * 0.7);
        var barGap = (chartW - barW * results.length) / (results.length + 1);

        var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">';

        /* Grid */
        for (var g = 0; g <= 4; g++) {
            var gy = padT + chartH - (g / 4) * chartH;
            var gv = (maxVal * g / 4).toFixed(2);
            svg += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" stroke="' + CHART_COLORS.grid + '" stroke-width="1"/>';
            svg += '<text x="' + (padL - 8) + '" y="' + (gy + 4) + '" text-anchor="end" font-size="11" fill="' + CHART_COLORS.textMuted + '" font-family="' + CHART_FONT + '">' + gv + '</text>';
        }

        /* Bars */
        results.forEach(function (r, idx) {
            var x = padL + barGap + idx * (barW + barGap);
            var barH = (r.weightedAvg / maxVal) * chartH;
            var y = padT + chartH - barH;
            svg += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + barH + '" fill="' + CHART_COLORS.primary + '" rx="2"/>';

            /* Value label */
            svg += '<text x="' + (x + barW / 2) + '" y="' + (y - 4) + '" text-anchor="middle" font-size="10" fill="' + CHART_COLORS.text + '" font-family="' + CHART_FONT + '">' + r.weightedAvg.toFixed(2) + '</text>';

            /* X label */
            var label = r.group.length > 12 ? r.group.substring(0, 10) + '..' : r.group;
            svg += '<text x="' + (x + barW / 2) + '" y="' + (padT + chartH + 16) + '" text-anchor="middle" font-size="10" fill="' + CHART_COLORS.textMuted + '" font-family="' + CHART_FONT + '" transform="rotate(-30,' + (x + barW / 2) + ',' + (padT + chartH + 16) + ')">' + label + '</text>';
        });

        svg += '</svg>';
        return svg;
    }

    /* ================================
       Analysis: Product Classification
       ================================ */
    var PRODUCT_CATEGORIES = [
        { keywords: ['жарен', 'roast', 'обжар'], category: 'Жареный' },
        { keywords: ['бланшир', 'blanch'], category: 'Бланшированный' },
        { keywords: ['готов', 'продукц', 'паст', 'масл', 'халв', 'конфет'], category: 'Готовая продукция' },
        { keywords: ['дроблен', 'половинк', 'кусочк', 'split', 'broken', 'piece'], category: 'Дробленый' },
        { keywords: ['очищен', 'лущен', 'шелушен', 'без скорлуп', 'без кожур', 'shelled', 'peeled', 'kernel'], category: 'Очищенный' },
        { keywords: ['неочищен', 'в скорлуп', 'in shell', 'нелущен', 'in-shell'], category: 'Неочищенный' },
        { keywords: ['сушен', 'dried'], category: 'Сушеный' }
    ];

    function classifyProduct(description) {
        if (!description) return 'Прочее';
        var lower = String(description).toLowerCase();
        for (var i = 0; i < PRODUCT_CATEGORIES.length; i++) {
            var rule = PRODUCT_CATEGORIES[i];
            for (var j = 0; j < rule.keywords.length; j++) {
                if (lower.indexOf(rule.keywords[j]) !== -1) {
                    return rule.category;
                }
            }
        }
        return 'Прочее';
    }

    function renderClassificationAnalysis() {
        var data = getActiveData();
        var headers = getActiveHeaders();
        var descCol = findColumn(headers, COL_PRODUCT_NAME);
        if (!descCol) {
            analysisResults.innerHTML =
                '<div class="analysis-empty"><p>Колонка "' + COL_PRODUCT_NAME + '" не найдена. Выполните маппинг колонок в обработке.</p></div>';
            return;
        }
        var descField = headers[descCol];
        var newColName = 'Характеристика товара';

        /* Add classification column */
        var alreadyExists = headers.indexOf(newColName) !== -1;
        var dist = {};
        for (var i = 0; i < data.length; i++) {
            var cat = classifyProduct(data[i][descField]);
            data[i][newColName] = cat;
            dist[cat] = (dist[cat] || 0) + 1;
        }
        if (!alreadyExists) {
            if (appState.isProcessed) {
                appState.processedHeaders.push(newColName);
            } else {
                appState.headers.push(newColName);
            }
            renderColumnsList();
            updateVisualizationFields();
        }

        /* Render results */
        var categories = Object.keys(dist).sort(function (a, b) { return dist[b] - dist[a]; });
        var total = data.length;

        var html = '<div class="analysis-section">';
        html += '<h3 class="analysis-section-title">Классификация товаров</h3>';

        /* KPI */
        html += '<div class="kpi-grid">';
        html += '<div class="kpi-card"><h3 class="kpi-card-title">Всего записей</h3>' +
            '<div class="kpi-card-value">' + formatNumber(total) + '</div></div>';
        html += '<div class="kpi-card"><h3 class="kpi-card-title">Категорий</h3>' +
            '<div class="kpi-card-value">' + categories.length + '</div></div>';
        html += '</div>';

        /* Distribution */
        html += '<div class="classification-distribution">';

        /* Table */
        html += '<div><div class="data-table-wrapper"><table class="data-table">';
        html += '<thead><tr><th>Характеристика</th><th>Количество</th><th>Доля (%)</th></tr></thead><tbody>';
        categories.forEach(function (cat) {
            var pct = (dist[cat] / total * 100).toFixed(1);
            html += '<tr><td>' + cat + '</td><td class="numeric">' + formatNumber(dist[cat]) + '</td><td class="numeric">' + pct + '%</td></tr>';
        });
        html += '</tbody></table></div></div>';

        /* Bar chart */
        html += '<div>' + renderClassificationChart(categories, dist, total) + '</div>';

        html += '</div>';

        html += '<div class="classification-note">Колонка «' + newColName + '» добавлена в данные. Используйте Сводную таблицу для дальнейшего анализа.</div>';
        html += '</div>';

        analysisResults.innerHTML = html;
    }

    function renderClassificationChart(categories, dist, total) {
        var W = 340, H = 280;
        var padL = 140, padR = 10, padT = 10, padB = 10;
        var chartW = W - padL - padR;
        var chartH = H - padT - padB;

        var maxVal = 0;
        categories.forEach(function (c) { if (dist[c] > maxVal) maxVal = dist[c]; });
        if (maxVal === 0) maxVal = 1;

        var barH = Math.min(24, chartH / categories.length * 0.7);
        var barGap = (chartH - barH * categories.length) / (categories.length + 1);

        var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">';

        categories.forEach(function (cat, idx) {
            var y = padT + barGap + idx * (barH + barGap);
            var bw = (dist[cat] / maxVal) * chartW;
            svg += '<rect x="' + padL + '" y="' + y + '" width="' + bw + '" height="' + barH + '" fill="' + CHART_COLORS.primary + '" rx="2"/>';

            /* Label */
            var label = cat.length > 18 ? cat.substring(0, 16) + '..' : cat;
            svg += '<text x="' + (padL - 6) + '" y="' + (y + barH / 2 + 4) + '" text-anchor="end" font-size="11" fill="' + CHART_COLORS.text + '" font-family="' + CHART_FONT + '">' + label + '</text>';

            /* Value */
            svg += '<text x="' + (padL + bw + 4) + '" y="' + (y + barH / 2 + 4) + '" font-size="10" fill="' + CHART_COLORS.textMuted + '" font-family="' + CHART_FONT + '">' + dist[cat] + '</text>';
        });

        svg += '</svg>';
        return svg;
    }

    /* ================================
       Module: Visualization
       ================================ */
    var vizChart = document.querySelector('.visualization-chart');
    var vizSettings = document.querySelector('.visualization-settings');
    var vizSettingsSelects = vizSettings ? vizSettings.querySelectorAll('.settings-select') : [];
    var vizTypeSelect = vizSettingsSelects[0];
    var vizXSelect = vizSettingsSelects[1];
    var vizYSelect = vizSettingsSelects[2];
    var vizActions = vizSettings ? vizSettings.querySelector('.settings-actions') : null;
    var vizBuildBtn = vizActions ? vizActions.querySelector('.btn-primary') : null;
    var vizExportPNG = vizActions ? vizActions.querySelectorAll('.btn-secondary')[0] : null;
    var vizExportSVG = vizActions ? vizActions.querySelectorAll('.btn-secondary')[1] : null;

    function updateVisualizationFields() {
        if (!vizXSelect || !vizYSelect) { return; }
        var headers = getActiveHeaders();

        var xHTML = '<option value="">Выберите поле</option>';
        var yHTML = '<option value="">Выберите поле</option>';
        headers.forEach(function (h) {
            xHTML += '<option value="' + h + '">' + h + '</option>';
            yHTML += '<option value="' + h + '">' + h + '</option>';
        });
        vizXSelect.innerHTML = xHTML;
        vizYSelect.innerHTML = yHTML;
    }

    if (vizBuildBtn) {
        vizBuildBtn.addEventListener('click', function () {
            var data = getActiveData();
            if (data.length === 0) {
                vizChart.innerHTML = '<div class="chart-placeholder"><p class="chart-placeholder-text">Сначала загрузите данные</p></div>';
                return;
            }

            var xField = vizXSelect.value;
            var yField = vizYSelect.value;
            if (!xField || !yField) {
                vizChart.innerHTML = '<div class="chart-placeholder"><p class="chart-placeholder-text">Выберите оси X и Y</p></div>';
                return;
            }

            var chartType = vizTypeSelect.value;
            renderSVGChart(data, xField, yField, chartType);
        });
    }

    function renderSVGChart(data, xField, yField, chartType) {
        try {
        var values = [];
        data.forEach(function (row) {
            var y = Number(row[yField]);
            if (!isNaN(y)) {
                values.push({ x: row[xField], y: y });
            }
        });

        if (values.length === 0) {
            vizChart.innerHTML = '<div class="chart-placeholder"><p class="chart-placeholder-text">Нет числовых данных для оси Y</p></div>';
            return;
        }

        var width = 700;
        var height = 320;
        var padL = 60, padR = 20, padT = 20, padB = 40;
        var chartW = width - padL - padR;
        var chartH = height - padT - padB;

        var yMin = Math.min.apply(null, values.map(function (v) { return v.y; }));
        var yMax = Math.max.apply(null, values.map(function (v) { return v.y; }));
        if (yMin === yMax) { yMin -= 1; yMax += 1; }
        var yRange = yMax - yMin;

        function scaleX(i) { return padL + (i / (values.length - 1 || 1)) * chartW; }
        function scaleY(v) { return padT + chartH - ((v - yMin) / yRange) * chartH; }

        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + ' ' + height + '" class="viz-svg">';

        // Grid lines
        for (var g = 0; g <= 4; g++) {
            var gy = padT + (g / 4) * chartH;
            var gVal = yMax - (g / 4) * yRange;
            svg += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (width - padR) + '" y2="' + gy + '" stroke="' + CHART_COLORS.grid + '" stroke-width="1"/>';
            svg += '<text x="' + (padL - 8) + '" y="' + (gy + 4) + '" text-anchor="end" font-size="11" fill="' + CHART_COLORS.textMuted + '" font-family="' + CHART_FONT + '">' + gVal.toFixed(0) + '</text>';
        }

        // X labels
        var step = Math.max(1, Math.floor(values.length / 8));
        for (var xi = 0; xi < values.length; xi += step) {
            var lx = scaleX(xi);
            var label = String(values[xi].x);
            if (label.length > 10) { label = label.substring(0, 10); }
            svg += '<text x="' + lx + '" y="' + (height - 8) + '" text-anchor="middle" font-size="11" fill="' + CHART_COLORS.textMuted + '" font-family="' + CHART_FONT + '">' + label + '</text>';
        }

        if (chartType === 'bar') {
            var barW = Math.max(2, chartW / values.length * 0.7);
            values.forEach(function (v, i) {
                var bx = scaleX(i) - barW / 2;
                var by = scaleY(v.y);
                var bh = padT + chartH - by;
                svg += '<rect x="' + bx + '" y="' + by + '" width="' + barW + '" height="' + bh + '" fill="' + CHART_COLORS.primary + '" rx="2"/>';
            });
        } else if (chartType === 'scatter') {
            values.forEach(function (v, i) {
                svg += '<circle cx="' + scaleX(i) + '" cy="' + scaleY(v.y) + '" r="4" fill="' + CHART_COLORS.primary + '"/>';
            });
        } else {
            // Line or Area
            var points = values.map(function (v, i) { return scaleX(i) + ',' + scaleY(v.y); }).join(' ');

            if (chartType === 'area') {
                var areaPoints = padL + ',' + (padT + chartH) + ' ' + points + ' ' + scaleX(values.length - 1) + ',' + (padT + chartH);
                svg += '<polygon points="' + areaPoints + '" fill="' + CHART_COLORS.primary + '" fill-opacity="0.1"/>';
            }
            svg += '<polyline points="' + points + '" fill="none" stroke="' + CHART_COLORS.primary + '" stroke-width="2"/>';

            values.forEach(function (v, i) {
                svg += '<circle cx="' + scaleX(i) + '" cy="' + scaleY(v.y) + '" r="3" fill="' + CHART_COLORS.primary + '"/>';
            });
        }

        svg += '</svg>';

        vizChart.innerHTML =
            '<h3 class="chart-title">' + yField + ' по ' + xField + '</h3>' + svg;
        } catch (err) {
            vizChart.innerHTML = '<div class="chart-placeholder"><p class="chart-placeholder-text">Ошибка построения графика: ' + err.message + '</p></div>';
            console.error('Chart error:', err);
        }
    }

    // Export PNG
    if (vizExportPNG) {
        vizExportPNG.addEventListener('click', function () {
            var svgEl = vizChart.querySelector('svg');
            if (!svgEl) { return; }
            var svgData = new XMLSerializer().serializeToString(svgEl);
            var canvas = document.createElement('canvas');
            canvas.width = 1400;
            canvas.height = 640;
            var ctx = canvas.getContext('2d');
            var img = new Image();
            img.onload = function () {
                ctx.fillStyle = CHART_COLORS.bg;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(function (blob) {
                    triggerDownload(blob, 'chart.png');
                }, 'image/png');
            };
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
        });
    }

    // Export SVG
    if (vizExportSVG) {
        vizExportSVG.addEventListener('click', function () {
            var svgEl = vizChart.querySelector('svg');
            if (!svgEl) { return; }
            var svgData = new XMLSerializer().serializeToString(svgEl);
            var blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            triggerDownload(blob, 'chart.svg');
        });
    }

    /* ================================
       Module: Reports
       ================================ */
    var reportsBtn = document.querySelector('.reports-header .btn-primary');
    var reportsList = document.querySelector('.reports-list');
    var reports = [];

    if (reportsBtn) {
        reportsBtn.addEventListener('click', function () {
            var data = getActiveData();
            if (data.length === 0) {
                reportsList.innerHTML = '<p class="reports-list-empty">Сначала загрузите данные</p>';
                return;
            }

            var report = {
                id: Date.now(),
                name: 'Отчёт от ' + new Date().toLocaleDateString('ru-RU') + ' ' +
                    new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                rows: data.length,
                columns: getActiveHeaders().length,
                created: new Date()
            };
            reports.push(report);
            renderReportsList();
        });
    }

    function renderReportsList() {
        if (reports.length === 0) {
            reportsList.innerHTML = '<p class="reports-list-empty">Нет доступных отчётов</p>';
            return;
        }

        var html = '';
        reports.forEach(function (r) {
            html +=
                '<div class="report-item" data-id="' + r.id + '">' +
                '  <span class="action-card-icon">📄</span>' +
                '  <div class="action-card-body">' +
                '    <h4 class="action-card-title">' + r.name + '</h4>' +
                '    <p class="action-card-description">Строк: ' + formatNumber(r.rows) +
                ' | Столбцов: ' + r.columns + '</p>' +
                '  </div>' +
                '  <div class="report-actions">' +
                '    <button class="btn btn-secondary report-csv" data-id="' + r.id + '">CSV</button>' +
                '  </div>' +
                '</div>';
        });

        reportsList.innerHTML = html;

        reportsList.querySelectorAll('.report-csv').forEach(function (btn) {
            btn.addEventListener('click', function () {
                exportCSV();
            });
        });
    }

    function exportCSV() {
        var data = getActiveData();
        if (data.length === 0) { return; }

        var hdrs = getActiveHeaders();
        var csv = hdrs.join(CSV_SEPARATOR) + '\n';
        data.forEach(function (row) {
            var line = hdrs.map(function (h) {
                var val = row[h] !== undefined ? String(row[h]) : '';
                if (val.indexOf(';') !== -1 || val.indexOf('"') !== -1) {
                    val = '"' + val.replace(/"/g, '""') + '"';
                }
                return val;
            });
            csv += line.join(CSV_SEPARATOR) + '\n';
        });

        var blob = new Blob([UTF8_BOM + csv], { type: MIME_CSV });
        triggerDownload(blob, baseFileName() + '_export.csv');
    }

    /* ================================
       Shared: Table Renderer
       ================================ */
    function renderTable(data, headers, maxRows) {
        var limit = maxRows || 10;
        var html = '<div class="data-table-wrapper"><table class="data-table">';
        html += '<thead><tr>';
        headers.forEach(function (h) { html += '<th>' + h + '</th>'; });
        html += '</tr></thead><tbody>';

        var rows = data.slice(0, limit);
        rows.forEach(function (row) {
            html += '<tr>';
            headers.forEach(function (h) { html += '<td>' + (row[h] !== undefined ? row[h] : '') + '</td>'; });
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        if (data.length > limit) {
            html += '<p class="table-footer">Показано ' + limit + ' из ' + formatNumber(data.length) + ' строк</p>';
        }
        return html;
    }

    /* ================================
       Module: Enrichment (обогащение данных)
       ================================ */

    var COL_SEGMENT  = 'Сегмент';
    var COL_PRICE_KG = 'Цена, USD/кг';
    var COL_REGION   = 'Регион получателя';
    var COL_HS_NAME  = 'Наименование товара (ТН ВЭД)';
    var COL_GEO      = 'Регион мира';
    var COL_TARIFF   = 'Ставка пошлины, %';
    var COL_TARIFF_Y = 'Год ставки';

    var LS_SEGMENT_DICT = 'delomant_segment_dictionary';
    var segmentDict = {};
    try { segmentDict = JSON.parse(localStorage.getItem(LS_SEGMENT_DICT) || '{}') || {}; } catch (e) { segmentDict = {}; }

    // Сегменты в формулировках компании (взяты из их размеченных отчётов)
    var SEGMENT_LIST = [
        'Переработка и производство',
        'Оптовая торговля',
        'Дистрибуция',
        'Кондитерское производство',
        'Розничная торговля',
        'Прочее'
    ];

    // Правила-резерв: используются, только если в словаре нет записи.
    // Порядок важен — узкие категории раньше широких.
    var SEGMENT_RULES = [
        { segment: 'Кондитерское производство', keys: ['КОНДИТЕР', 'ШОКОЛАД', 'КОНФЕТ', 'СЛАДОСТ'] },
        { segment: 'Розничная торговля',        keys: ['РИТЕЙЛ', 'RETAIL', 'МАРКЕТ', 'МАГАЗИН', 'ПЯТЕРОЧКА', 'ПЯТЁРОЧКА', 'ПЕРЕКРЕСТОК', 'ПЕРЕКРЁСТОК', 'МАГНИТ', 'АШАН'] },
        { segment: 'Переработка и производство', keys: ['ЗАВОД', 'ФАБРИКА', 'КОМБИНАТ', 'ПРОИЗВОДСТВ', 'ПЕРЕРАБОТ', 'АГРО'] },
        { segment: 'Дистрибуция',               keys: ['ДИСТРИБ', 'DISTRIB', 'ЛОГИСТИК'] },
        { segment: 'Оптовая торговля',          keys: ['ОПТ', 'ТОРГОВЫЙ ДОМ', 'ТРЕЙД', 'TRADE'] }
    ];

    // Колонки в сырых выгрузках названы иначе, чем после «Обработки»,
    // поэтому ищем по нескольким вариантам.
    function findAnyColumn(headers, names) {
        for (var i = 0; i < names.length; i++) {
            if (headers.indexOf(names[i]) !== -1) return names[i];
        }
        return null;
    }

    var RECEIVER_COLS = ['Наименование получателя', 'G082 (Наименование получателя)', '083 Наименование/ФИО получателя'];
    var INN_COLS      = ['ИНН получателя', 'G081 (ИНН получателя)', '081 ИНН получателя'];
    var SEGMENT_COLS  = ['Сегмент получателя', 'Сегмент'];
    var HOLDING_COLS  = ['Более крупный холдинг/объединение', 'Холдинг'];
    var PRODUCT_COLS  = ['Продукт получателя'];

    // Ручной словарь имеет приоритет над правилами: сначала ИНН, потом название
    function detectSegment(name, inn) {
        var key = String(name || '').toUpperCase().trim();
        var innKey = String(inn || '').trim();
        if (innKey && segmentDict[innKey]) return segmentDict[innKey];
        if (key && segmentDict[key]) return segmentDict[key];
        for (var i = 0; i < SEGMENT_RULES.length; i++) {
            var r = SEGMENT_RULES[i];
            for (var k = 0; k < r.keys.length; k++) {
                if (key.indexOf(r.keys[k]) !== -1) return r.segment;
            }
        }
        return 'Прочее';
    }

    /*
     * Обобщённый обогатитель «учись на разметке».
     *
     * Рабочие файлы компании уже содержат ручную разметку (сегмент, холдинг,
     * продукт получателя). Поэтому обогатитель сначала УЧИТСЯ: пополняет
     * словарь «ИНН/название → значение» из заполненных строк, — и только
     * потом проставляет значение там, где оно пустое. Существующая разметка
     * никогда не перезаписывается.
     *
     * На новой сырой выгрузке словарь (плюс правила, если заданы) проставляет
     * значения автоматически — это и заменяет ручную работу в Excel.
     */
    function enrichByDict(data, headers, cfg) {
        if (!isContractorDataAvailable()) {
            return { skipped: true, note: 'Недоступно на данных ' + dataSourceName() +
                ': статистика агрегирована ' + dataSourceLevel() +
                ' и не содержит контрагентов (получателей, ИНН). Загрузите таможенную выгрузку.' };
        }

        var recvCol = findAnyColumn(headers, RECEIVER_COLS);
        var innCol  = findAnyColumn(headers, INN_COLS);
        var target  = findAnyColumn(headers, cfg.targetCols);

        if (!recvCol && !innCol) {
            return { error: 'Не найдены столбцы «' + RECEIVER_COLS[0] + '» или «' + INN_COLS[0] + '»' };
        }
        if (!target) {
            if (!cfg.createIfMissing) {
                return { error: 'Нет столбца «' + cfg.targetCols[0] + '», не на чем учиться. Загрузите файл с вашей разметкой.' };
            }
            target = cfg.targetCols[0];
            headers.push(target);
        }

        // name — канонический ключ для словаря (нормализация схлопывает
        // «ООО Ромашка» и «Ромашка, ООО» в одно), nameRaw — для правил,
        // которые ищут ключевые слова в исходном названии.
        function keysOf(row) {
            var rawName = recvCol ? String(row[recvCol] || '') : '';
            return {
                inn: innCol ? String(row[innCol] || '').trim() : '',
                name: rawName ? normalizeCompanyName(rawName) : '',
                nameRaw: rawName.toUpperCase().trim()
            };
        }

        // 1. Учимся на заполненных строках
        var learned = 0;
        data.forEach(function (row) {
            var val = String(row[target] || '').trim();
            if (!val) return;
            var k = keysOf(row);
            var key = k.inn || k.name;
            if (key && !cfg.dict[key]) { cfg.dict[key] = val; learned++; }
        });
        if (learned) cfg.save();

        // 2. Заполняем пустые
        var stats = {}, filled = 0, already = 0;
        data.forEach(function (row) {
            var cur = String(row[target] || '').trim();
            if (cur) { stats[cur] = (stats[cur] || 0) + 1; already++; return; }
            var k = keysOf(row);
            var val = (k.inn && cfg.dict[k.inn]) || (k.name && cfg.dict[k.name]) || '';
            if (!val && cfg.rules) val = applySegmentRules(k.nameRaw);
            if (!val && cfg.fallbackToName) val = k.name;
            if (!val && cfg.fallback) val = cfg.fallback;
            if (val) {
                row[target] = val;
                stats[val] = (stats[val] || 0) + 1;
                filled++;
            }
        });

        return { total: data.length, recognized: filled, already: already, learned: learned, stats: stats };
    }

    function applySegmentRules(name) {
        for (var i = 0; i < SEGMENT_RULES.length; i++) {
            var r = SEGMENT_RULES[i];
            for (var k = 0; k < r.keys.length; k++) {
                if (name.indexOf(r.keys[k]) !== -1) return r.segment;
            }
        }
        return '';
    }

    // --- Словари обогатителей ---
    var LS_HOLDING_DICT = 'delomant_holding_dictionary';
    var LS_PRODUCT_DICT = 'delomant_product_dictionary';
    var holdingDict = {}, productDict = {};
    try { holdingDict = JSON.parse(localStorage.getItem(LS_HOLDING_DICT) || '{}') || {}; } catch (e) { holdingDict = {}; }
    try { productDict = JSON.parse(localStorage.getItem(LS_PRODUCT_DICT) || '{}') || {}; } catch (e) { productDict = {}; }

    function saveHoldingDict() { try { localStorage.setItem(LS_HOLDING_DICT, JSON.stringify(holdingDict)); } catch (e) {} }
    function saveProductDict() { try { localStorage.setItem(LS_PRODUCT_DICT, JSON.stringify(productDict)); } catch (e) {} }

    // --- Обогатитель: сегмент получателя (словарь + правила) ---
    function enrichSegment(data, headers) {
        var res = enrichByDict(data, headers, {
            targetCols: SEGMENT_COLS,
            dict: segmentDict,
            save: function () { saveSegmentDict(); renderSegmentDict(); },
            rules: true,
            fallback: 'Прочее',
            createIfMissing: true
        });
        return res;
    }

    // --- Обогатитель: холдинг/объединение ---
    function enrichHolding(data, headers) {
        return enrichByDict(data, headers, {
            targetCols: HOLDING_COLS,
            dict: holdingDict,
            save: saveHoldingDict,
            // компания вне холдинга группируется сама по себе
            fallbackToName: true,
            createIfMissing: true
        });
    }

    // --- Обогатитель: продукт получателя ---
    function enrichProduct(data, headers) {
        return enrichByDict(data, headers, {
            targetCols: PRODUCT_COLS,
            dict: productDict,
            save: saveProductDict,
            // угадать продукт по названию нельзя — оставляем пустым
            createIfMissing: false
        });
    }

    // --- Обогатитель: цена за килограмм ---
    var PRICE_COLS  = ['USD за КГ статистическая', 'Цена, USD/кг'];
    var WEIGHT_COLS = ['Вес нетто, кг', 'G38 (Вес нетто, кг)'];
    var USD_COLS    = ['Статистическая стоимость, USD', 'G46 (Статистическая стоимость, USD.)', 'USD статистическая'];

    /*
     * Название товара по коду ТН ВЭД.
     *
     * Работает на любых данных с кодом — в том числе на агрегатах Comtrade
     * и WITS, где контрагентов нет и остальные обогатители бессильны.
     * Справочник тот же, что у поиска кода: hs6, при промахе — hs4.
     */
    function enrichHsName(data, headers) {
        var codeCol = findColumn(headers, COL_HS_CODE);
        if (!codeCol) {
            return { error: 'Нужен столбец «' + COL_HS_CODE + '»' };
        }
        if (!hsNamesData) {
            return { error: 'Справочник названий не загружен, откройте раздел «Данные» и повторите' };
        }
        if (headers.indexOf(COL_HS_NAME) === -1) { headers.push(COL_HS_NAME); }

        var filled = 0, missed = 0;
        data.forEach(function (row) {
            if (row[COL_HS_NAME]) { return; }
            var name = hsNameFor(row[codeCol]);
            if (name) { row[COL_HS_NAME] = name; filled++; }
            else { missed++; }
        });
        return {
            filled: filled,
            note: missed > 0
                ? ('Не нашлось в справочнике: ' + formatNumber(missed) + ' строк')
                : ''
        };
    }

    /*
     * Регион мира по стране. Берём те же группы, что и в выборе стран
     * (континенты), — тогда разрезы «Данных» и анализа сходятся.
     */
    function enrichGeo(data, headers) {
        var countryCol = findColumn(headers, 'Страна отправления') ||
                         findColumn(headers, 'Страна назначения') ||
                         findColumn(headers, 'Страна-импортёр') ||
                         findColumn(headers, 'Страна-экспортёр');
        if (!countryCol) {
            return { error: 'Нужен столбец со страной' };
        }
        if (!comtradeRegions || comtradeRegions.length === 0) {
            return { error: 'Справочник регионов не загружен, откройте раздел «Данные» и повторите' };
        }

        // имя страны → континент (берём только группу «Континенты»:
        // экономические блоки пересекаются, одна страна попала бы в несколько)
        var nameByCode = {};
        comtradeCountries.forEach(function (c) { nameByCode[String(c.code)] = c.name; });

        var regionByCountry = {};
        comtradeRegions.forEach(function (r) {
            if (r.group !== 'Континенты') { return; }
            (r.codes || []).forEach(function (code) {
                var nm = nameByCode[String(code)];
                if (nm && !regionByCountry[nm]) { regionByCountry[nm] = r.name; }
            });
        });

        if (headers.indexOf(COL_GEO) === -1) { headers.push(COL_GEO); }
        var filled = 0, missed = 0;
        data.forEach(function (row) {
            if (row[COL_GEO]) { return; }
            var reg = regionByCountry[String(row[countryCol] || '').trim()];
            if (reg) { row[COL_GEO] = reg; filled++; }
            else { missed++; }
        });
        return {
            filled: filled,
            note: missed > 0 ? ('Страна не найдена в справочнике: ' + formatNumber(missed) + ' строк') : ''
        };
    }

    /*
     * Ставка ввозной пошлины (WITS TRAINS) отдельной колонкой.
     *
     * Comtrade отвечает, сколько страна ввозит, но не по какой ставке.
     * Ставки живут в TRAINS и совпадают по ключу: коды стран там числовые
     * M49 — те же, что reporterCode у Comtrade. Запрос берёт все страны и
     * коды выгрузки разом, поэтому обогащение стоит одного обращения.
     *
     * Данные приходят асинхронно, а обогатители синхронные, поэтому ставки
     * заранее складываются в tariffCache (см. prefetchTariffs).
     */
    var tariffCache = null; // 'код страны|код товара' → {rate, year}

    function tariffKeysFrom(data, headers) {
        var codeCol = findColumn(headers, COL_HS_CODE);
        var countryCol = findColumn(headers, 'Страна отправления') ||
                         findColumn(headers, 'Страна назначения') ||
                         findColumn(headers, 'Страна-импортёр') ||
                         findColumn(headers, 'Страна-экспортёр');
        if (!codeCol || !countryCol) { return null; }

        var codeByName = {};
        comtradeCountries.forEach(function (c) { codeByName[c.name] = String(c.code); });

        var countries = {}, products = {};
        data.forEach(function (row) {
            var cc = codeByName[String(row[countryCol] || '').trim()];
            if (cc) { countries[cc] = 1; }
            var hs = String(row[codeCol] || '').replace(/\D/g, '');
            if (hs.length >= 4) { products[hs.slice(0, 6)] = 1; }
        });
        return {
            codeCol: codeCol, countryCol: countryCol, codeByName: codeByName,
            // Прокси ограничивает длину списков — берём столько, сколько примет
            countries: Object.keys(countries).slice(0, 40),
            products: Object.keys(products).slice(0, 40)
        };
    }

    /** Тянет ставки для стран и кодов выгрузки; результат кладёт в tariffCache. */
    function prefetchTariffs(data, headers) {
        var k = tariffKeysFrom(data, headers);
        if (!k || !k.countries.length || !k.products.length) {
            tariffCache = {};
            return Promise.resolve();
        }
        // TRAINS отстаёт от торговой статистики, и горизонт у стран разный —
        // просим широкое окно и берём по каждой паре самый свежий год
        var thisYear = new Date().getFullYear();
        var years = [];
        for (var y = thisYear - 1; y >= thisYear - 10; y--) { years.push(y); }

        var url = WITS_PROXY_URL + '?datasource=trn' +
            '&reporter=' + encodeURIComponent(k.countries.join(',')) +
            '&partner=000' +
            '&product=' + encodeURIComponent(k.products.join(',')) +
            '&year=' + encodeURIComponent(years.join(',')) +
            '&datatype=reported';

        return fetch(url, { cache: 'no-store' })
            .then(function (r) { return r.json(); })
            .then(function (json) {
                var map = {};
                (json.data || []).forEach(function (r) {
                    if (r.value === null || r.value === undefined) { return; }
                    var key = String(parseInt(r.reporter, 10)) + '|' + String(r.product);
                    var yr = parseInt(r.year, 10);
                    if (!map[key] || yr > map[key].year) {
                        map[key] = { rate: r.value, year: yr };
                    }
                });
                tariffCache = map;
            })
            .catch(function () { tariffCache = {}; });
    }

    function enrichTariff(data, headers) {
        var k = tariffKeysFrom(data, headers);
        if (!k) { return { error: 'Нужны столбцы со страной и кодом ТН ВЭД' }; }
        if (!tariffCache) { return { error: 'Ставки не загружены' }; }
        if (!Object.keys(tariffCache).length) {
            return { skipped: true, note: 'Ставок по этим странам и кодам в базе TRAINS не нашлось: ' +
                'она отстаёт от торговой статистики, и не все страны отчитываются.' };
        }

        if (headers.indexOf(COL_TARIFF) === -1) { headers.push(COL_TARIFF); }
        if (headers.indexOf(COL_TARIFF_Y) === -1) { headers.push(COL_TARIFF_Y); }

        var filled = 0, missed = 0;
        data.forEach(function (row) {
            if (row[COL_TARIFF] !== undefined && row[COL_TARIFF] !== '') { return; }
            var cc = k.codeByName[String(row[k.countryCol] || '').trim()];
            var hs = String(row[k.codeCol] || '').replace(/\D/g, '').slice(0, 6);
            var hit = cc && hs ? tariffCache[String(parseInt(cc, 10)) + '|' + hs] : null;
            if (hit) {
                row[COL_TARIFF] = round2(hit.rate);
                row[COL_TARIFF_Y] = hit.year;
                filled++;
            } else { missed++; }
        });
        return {
            filled: filled,
            note: missed > 0 ? ('Ставка не найдена: ' + formatNumber(missed) +
                ' строк (страна не отчиталась за доступные годы)') : ''
        };
    }

    function enrichPriceKg(data, headers) {
        var existing = findAnyColumn(headers, PRICE_COLS);
        if (existing) {
            return { skipped: true, note: 'В данных уже есть столбец «' + existing + '» — расчёт не нужен.' };
        }
        var wCol = findAnyColumn(headers, WEIGHT_COLS);
        var uCol = findAnyColumn(headers, USD_COLS);
        if (!wCol || !uCol) {
            return { error: 'Нужны столбцы веса («' + WEIGHT_COLS[0] + '») и стоимости («' + USD_COLS[0] + '»)' };
        }
        if (headers.indexOf(COL_PRICE_KG) === -1) headers.push(COL_PRICE_KG);
        var filled = 0, sum = 0;
        data.forEach(function (row) {
            var w = Number(row[wCol]) || 0, u = Number(row[uCol]) || 0;
            if (w > 0 && u > 0) { var p = round2(u / w); row[COL_PRICE_KG] = p; filled++; sum += p; }
            else { row[COL_PRICE_KG] = ''; }
        });
        return { total: data.length, recognized: filled, avg: filled ? round2(sum / filled) : null };
    }

    // --- Обогатитель: регион получателя по ИНН ---
    // Первые две цифры ИНН — код региона налогового органа (по справочнику
    // ФНС). Для ИНН он отличается от «конституционных»/ГИБДД-кодов: Крым — 91,
    // Севастополь — 92. Спорные и неактуальные коды (упразднённые округа,
    // новые регионы) не заводим — лучше пустая ячейка, чем неверный регион.
    var REGION_BY_INN = {
        '01': 'Республика Адыгея', '02': 'Республика Башкортостан', '03': 'Республика Бурятия',
        '04': 'Республика Алтай', '05': 'Республика Дагестан', '06': 'Республика Ингушетия',
        '07': 'Кабардино-Балкарская Республика', '08': 'Республика Калмыкия',
        '09': 'Карачаево-Черкесская Республика', '10': 'Республика Карелия', '11': 'Республика Коми',
        '12': 'Республика Марий Эл', '13': 'Республика Мордовия', '14': 'Республика Саха (Якутия)',
        '15': 'Республика Северная Осетия — Алания', '16': 'Республика Татарстан', '17': 'Республика Тыва',
        '18': 'Удмуртская Республика', '19': 'Республика Хакасия', '20': 'Чеченская Республика',
        '21': 'Чувашская Республика', '22': 'Алтайский край', '23': 'Краснодарский край',
        '24': 'Красноярский край', '25': 'Приморский край', '26': 'Ставропольский край',
        '27': 'Хабаровский край', '28': 'Амурская область', '29': 'Архангельская область',
        '30': 'Астраханская область', '31': 'Белгородская область', '32': 'Брянская область',
        '33': 'Владимирская область', '34': 'Волгоградская область', '35': 'Вологодская область',
        '36': 'Воронежская область', '37': 'Ивановская область', '38': 'Иркутская область',
        '39': 'Калининградская область', '40': 'Калужская область', '41': 'Камчатский край',
        '42': 'Кемеровская область', '43': 'Кировская область', '44': 'Костромская область',
        '45': 'Курганская область', '46': 'Курская область', '47': 'Ленинградская область',
        '48': 'Липецкая область', '49': 'Магаданская область', '50': 'Московская область',
        '51': 'Мурманская область', '52': 'Нижегородская область', '53': 'Новгородская область',
        '54': 'Новосибирская область', '55': 'Омская область', '56': 'Оренбургская область',
        '57': 'Орловская область', '58': 'Пензенская область', '59': 'Пермский край',
        '60': 'Псковская область', '61': 'Ростовская область', '62': 'Рязанская область',
        '63': 'Самарская область', '64': 'Саратовская область', '65': 'Сахалинская область',
        '66': 'Свердловская область', '67': 'Смоленская область', '68': 'Тамбовская область',
        '69': 'Тверская область', '70': 'Томская область', '71': 'Тульская область',
        '72': 'Тюменская область', '73': 'Ульяновская область', '74': 'Челябинская область',
        '75': 'Забайкальский край', '76': 'Ярославская область', '77': 'Москва',
        '78': 'Санкт-Петербург', '79': 'Еврейская автономная область',
        '83': 'Ненецкий автономный округ', '86': 'Ханты-Мансийский автономный округ — Югра',
        '87': 'Чукотский автономный округ', '89': 'Ямало-Ненецкий автономный округ',
        '91': 'Республика Крым', '92': 'Севастополь'
    };

    function enrichRegion(data, headers) {
        if (!isContractorDataAvailable()) {
            return { skipped: true, note: 'Недоступно на данных ' + dataSourceName() +
                ': нет ИНН получателя. Загрузите таможенную выгрузку.' };
        }
        var innCol = findAnyColumn(headers, INN_COLS);
        if (!innCol) {
            return { error: 'Не найден столбец «' + INN_COLS[0] + '» — регион определяется по ИНН.' };
        }
        if (headers.indexOf(COL_REGION) === -1) { headers.push(COL_REGION); }

        var stats = {}, filled = 0, already = 0, unknown = 0;
        data.forEach(function (row) {
            var cur = String(row[COL_REGION] || '').trim();
            if (cur) { stats[cur] = (stats[cur] || 0) + 1; already++; return; }

            // ИНН может прийти числом — приводим к строке и убираем дробную часть
            var inn = String(row[innCol] == null ? '' : row[innCol]).trim().split('.')[0];
            var region = /^\d{2}/.test(inn) ? (REGION_BY_INN[inn.slice(0, 2)] || '') : '';
            if (region) {
                row[COL_REGION] = region;
                stats[region] = (stats[region] || 0) + 1;
                filled++;
            } else {
                row[COL_REGION] = '';
                if (inn !== '') { unknown++; }
            }
        });

        return { total: data.length, recognized: filled, already: already, stats: stats, unknown: unknown };
    }

    // --- Реестр обогатителей ---
    var ENRICHERS = [
        {
            id: 'segment',
            label: 'Сегмент получателя',
            description: 'Опт, розница, производство, кондитерская, HoReCa или дистрибуция. Определяется по названию и словарю',
            adds: [COL_SEGMENT],
            run: enrichSegment
        },
        {
            id: 'region',
            label: 'Регион получателя (по ИНН)',
            description: 'Субъект РФ по первым двум цифрам ИНН, чтобы смотреть продажи по регионам. Это регион налогового органа, обычно он совпадает с местом компании',
            adds: [COL_REGION],
            run: enrichRegion
        },
        {
            id: 'holding',
            label: 'Холдинг / объединение',
            description: 'Группирует юрлица в холдинги по вашей разметке; компания вне холдинга остаётся сама собой',
            adds: [HOLDING_COLS[0]],
            run: enrichHolding
        },
        {
            id: 'product',
            label: 'Продукт получателя',
            description: 'Чем занимается получатель, по вашей разметке. Нужен файл с размеченным столбцом',
            adds: [PRODUCT_COLS[0]],
            run: enrichProduct
        },
        {
            id: 'price-kg',
            label: 'Цена за килограмм',
            description: 'Стоимость USD за кг по каждой строке, чтобы сравнивать цены и искать аномалии',
            adds: [COL_PRICE_KG],
            run: enrichPriceKg
        },
        // Работают и на агрегатах (Comtrade, WITS), где контрагентов нет
        {
            id: 'hs-name',
            label: 'Наименование товара по коду',
            description: 'Расшифровывает код ТН ВЭД в название товара. Работает и на статистике ООН, где есть только коды',
            adds: [COL_HS_NAME],
            run: enrichHsName
        },
        {
            id: 'geo',
            label: 'Регион мира по стране',
            description: 'Континент страны: Европа, Азия, Африка и так далее. Позволяет группировать выгрузку по регионам, а не по отдельным странам',
            adds: [COL_GEO],
            run: enrichGeo
        },
        {
            id: 'tariff',
            label: 'Ставка ввозной пошлины',
            description: 'Базовая ставка РНБ по стране и коду ТН ВЭД из WITS TRAINS. Показывает, во сколько обойдётся вход на рынок',
            adds: [COL_TARIFF, COL_TARIFF_Y],
            run: enrichTariff
        }
    ];

    // --- UI: каталог ---
    var enrichList    = document.querySelector('.enrich-list');
    var enrichRunBtn  = document.querySelector('.enrich-run-btn');
    var enrichSummary = document.querySelector('.enrich-summary');
    var enrichDictList = document.querySelector('.enrich-dict-list');
    var enrichDictCount = document.querySelector('.enrich-dict-count');

    function escEnrich(v) {
        return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /*
     * Применимо ли обогащение к загруженным данным.
     *
     * Часть обогатителей работает по контрагенту, которого в агрегатах ООН
     * и Всемирного банка нет вовсе. Без пометки пользователь отмечал всё
     * подряд и получал список ошибок вместо результата.
     */
    function enricherAvailability(e, headers) {
        var needContractor = ['segment', 'region', 'holding', 'product'];
        if (needContractor.indexOf(e.id) !== -1 && !isContractorDataAvailable()) {
            return 'В данных ' + dataSourceName() + ' нет компаний-контрагентов';
        }
        if (!headers || !headers.length) { return ''; }
        if (e.id === 'hs-name' && !findColumn(headers, COL_HS_CODE)) {
            return 'Нет столбца с кодом ТН ВЭД';
        }
        if (e.id === 'price-kg' &&
            (!findAnyColumn(headers, WEIGHT_COLS) || !findAnyColumn(headers, USD_COLS))) {
            return 'Нужны вес и стоимость USD';
        }
        var hasCountry = findColumn(headers, 'Страна отправления') ||
            findColumn(headers, 'Страна назначения') || findColumn(headers, 'Страна-импортёр') ||
            findColumn(headers, 'Страна-экспортёр');
        if (e.id === 'geo' && !hasCountry) {
            return 'Нет столбца со страной';
        }
        if (e.id === 'tariff') {
            if (!hasCountry) { return 'Нет столбца со страной'; }
            if (!findColumn(headers, COL_HS_CODE)) { return 'Нет столбца с кодом ТН ВЭД'; }
        }
        return '';
    }

    function renderEnrichList() {
        if (!enrichList) return;
        var headers = getActiveHeaders();
        var html = '';
        ENRICHERS.forEach(function (e) {
            var why = enricherAvailability(e, headers);
            var off = !!why;
            html += '<label class="enrich-item' + (off ? ' enrich-item-off' : '') +
                '" style="display:flex;gap:10px;align-items:flex-start;padding:10px;border:1px solid var(--color-border);border-radius:8px;cursor:pointer">';
            html += '<input type="checkbox" class="enrich-cb" value="' + e.id + '"' +
                (off ? ' disabled' : ' checked') + ' style="margin-top:3px">';
            html += '<span><span style="font-weight:600">' + escEnrich(e.label) + '</span>';
            html += '<br><span style="font-size:12px;color:var(--color-text-secondary)">' + escEnrich(e.description) + '</span>';
            html += '<br><span style="font-size:11px;color:var(--color-text-muted)">Столбцы: ' + e.adds.map(escEnrich).join(', ') + ' · без нейросети</span>';
            if (off) {
                html += '<br><span class="enrich-why">Недоступно: ' + escEnrich(why) + '</span>';
            }
            html += '</span></label>';
        });
        enrichList.innerHTML = html;
    }

    function renderEnrichSummary(results) {
        if (!enrichSummary) return;
        var html = '';
        results.forEach(function (r) {
            html += '<div style="margin-bottom:16px">';
            html += '<div style="font-weight:600;margin-bottom:6px">' + escEnrich(r.label) + '</div>';
            if (r.error) {
                html += '<div style="color:var(--color-error);font-size:13px">' + escEnrich(r.error) + '</div>';
            } else if (r.skipped) {
                html += '<div style="font-size:13px;color:var(--color-text-secondary)">' + escEnrich(r.note || 'Пропущено') + '</div>';
            } else {
                if (r.learned) {
                    html += '<div style="font-size:13px;color:var(--color-success)">Выучено из вашей разметки: ' +
                        formatNumber(r.learned) + ' компаний → в словарь</div>';
                }
                if (r.already) {
                    html += '<div style="font-size:13px;color:var(--color-text-secondary)">Уже было размечено: ' +
                        formatNumber(r.already) + ' строк (не изменены)</div>';
                }
                html += '<div style="font-size:13px;color:var(--color-text-secondary)">Заполнено строк: ' +
                    formatNumber(r.recognized) + ' из ' + formatNumber(r.total) + '</div>';
                if (r.avg != null) {
                    html += '<div style="font-size:13px;color:var(--color-text-secondary)">Средняя цена: ' + formatNumber(r.avg) + ' USD/кг</div>';
                }
                if (r.stats) {
                    var keys = Object.keys(r.stats).sort(function (a, b) { return r.stats[b] - r.stats[a]; });
                    var TOP = 10;
                    var shown = keys.slice(0, TOP);
                    html += '<table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13px">';
                    shown.forEach(function (k) {
                        var pct = r.total ? Math.round(r.stats[k] / r.total * 100) : 0;
                        html += '<tr>';
                        html += '<td style="padding:3px 6px 3px 0">' + escEnrich(k) + '</td>';
                        html += '<td style="padding:3px 0;text-align:right;white-space:nowrap">' + formatNumber(r.stats[k]) + ' · ' + pct + '%</td>';
                        html += '</tr>';
                    });
                    html += '</table>';
                    if (keys.length > TOP) {
                        var rest = keys.slice(TOP).reduce(function (sum, k) { return sum + r.stats[k]; }, 0);
                        html += '<div style="font-size:12px;color:var(--color-text-muted);margin-top:4px">и ещё ' +
                            (keys.length - TOP) + ' значений · ' + formatNumber(rest) + ' строк</div>';
                    }
                }
            }
            html += '</div>';
        });
        enrichSummary.innerHTML = html || '<p class="pres-hint">Ничего не выбрано.</p>';
    }

    function runEnrichment() {
        var data = getActiveData();
        var headers = getActiveHeaders();
        if (!data || !data.length) { alert('Сначала загрузите данные во вкладке «Данные».'); return; }

        var selected = Array.prototype.map.call(document.querySelectorAll('.enrich-cb:checked'), function (cb) { return cb.value; });
        if (!selected.length) { alert('Выберите хотя бы одно обогащение.'); return; }

        /*
         * Справочники грузятся лениво, а обогатители синхронные. Если нужный
         * справочник ещё не в памяти — дотягиваем и повторяем запуск, иначе
         * пришлось бы просить пользователя сходить в другой раздел.
         */
        if (selected.indexOf('hs-name') !== -1 && !hsNamesData) {
            loadHsNames().then(runEnrichment);
            return;
        }
        if (selected.indexOf('geo') !== -1 && (!comtradeRegions || !comtradeRegions.length)) {
            Promise.all([loadComtradeCountries(), loadComtradeRegions()]).then(runEnrichment);
            return;
        }
        // Ставки приходят из WITS, поэтому тянем их до синхронного прохода
        if (selected.indexOf('tariff') !== -1 && !tariffCache) {
            if (enrichRunBtn) { enrichRunBtn.disabled = true; }
            loadComtradeCountries()
                .then(function () { return prefetchTariffs(data, headers); })
                .then(function () {
                    if (enrichRunBtn) { enrichRunBtn.disabled = false; }
                    runEnrichment();
                });
            return;
        }

        var results = [];
        ENRICHERS.forEach(function (e) {
            if (selected.indexOf(e.id) === -1) return;
            var res = e.run(data, headers) || {};
            res.label = e.label;
            results.push(res);
        });
        renderEnrichSummary(results);
    }

    // --- UI: словарь сегментов ---
    function saveSegmentDict() {
        try { localStorage.setItem(LS_SEGMENT_DICT, JSON.stringify(segmentDict)); } catch (e) { /* переполнение — игнорируем */ }
    }

    function renderSegmentDict() {
        if (!enrichDictList) return;
        var keys = Object.keys(segmentDict);
        if (enrichDictCount) enrichDictCount.textContent = '(' + keys.length + ')';
        if (!keys.length) {
            enrichDictList.innerHTML = '<p class="pres-hint">Пока пусто, сегменты определяются правилами. Добавьте запись, если правило ошиблось.</p>';
            return;
        }
        var html = '<table style="width:100%;border-collapse:collapse;font-size:13px">';
        keys.forEach(function (k) {
            html += '<tr>';
            html += '<td style="padding:4px 6px 4px 0">' + escEnrich(k) + '</td>';
            html += '<td style="padding:4px 6px;color:var(--color-text-secondary)">' + escEnrich(segmentDict[k]) + '</td>';
            html += '<td style="padding:4px 0;text-align:right"><button class="enrich-dict-del" data-key="' + escEnrich(k) + '" title="Удалить">✕</button></td>';
            html += '</tr>';
        });
        html += '</table>';
        enrichDictList.innerHTML = html;
        enrichDictList.querySelectorAll('.enrich-dict-del').forEach(function (b) {
            b.addEventListener('click', function () {
                delete segmentDict[this.getAttribute('data-key')];
                saveSegmentDict();
                renderSegmentDict();
            });
        });
    }

    // --- Инициализация модуля ---
    if (enrichList) {
        renderEnrichList();
        renderSegmentDict();

        enrichRunBtn.addEventListener('click', runEnrichment);

        document.querySelector('.enrich-dict-add-btn').addEventListener('click', function () {
            var keyEl = document.querySelector('.enrich-dict-key');
            var valEl = document.querySelector('.enrich-dict-value');
            var key = keyEl.value.trim();
            if (!key) { keyEl.focus(); return; }
            // ИНН оставляем как есть, название — через ту же нормализацию, что и
            // при обогащении, иначе ручная запись не совпадёт с данными
            var dictKey = /^\d+$/.test(key) ? key : normalizeCompanyName(key);
            if (!dictKey) { keyEl.focus(); return; }
            segmentDict[dictKey] = valEl.value;
            saveSegmentDict();
            keyEl.value = '';
            renderSegmentDict();
        });

        document.querySelector('.enrich-dict-export').addEventListener('click', function () {
            var blob = new Blob([JSON.stringify(segmentDict, null, 2)], { type: 'application/json' });
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'segment_dictionary.json';
            a.click();
            URL.revokeObjectURL(a.href);
        });

        document.querySelector('.enrich-dict-import-btn').addEventListener('click', function () {
            document.querySelector('.enrich-dict-import').click();
        });
        document.querySelector('.enrich-dict-import').addEventListener('change', function () {
            var f = this.files[0];
            if (!f) return;
            var reader = new FileReader();
            reader.onload = function (ev) {
                try {
                    var obj = JSON.parse(ev.target.result);
                    if (obj && typeof obj === 'object') {
                        Object.keys(obj).forEach(function (k) { segmentDict[k] = obj[k]; });
                        saveSegmentDict();
                        renderSegmentDict();
                    }
                } catch (e) { alert('Не удалось прочитать JSON.'); }
            };
            reader.readAsText(f);
            this.value = '';
        });
    }

    /* ================================
       Module: Presentation Constructor
       ================================ */

    var presState = {
        slides: [],
        activeIndex: 0,
        nextId: 1
    };

    // --- Реестр блоков ---
    var PRES_BLOCKS = [
        { type: 'title', label: 'Титульный', icon: '\uD83D\uDCCB', category: 'special', hasHsFilter: false, hasTopN: false, hasYear: false, hasSubtitle: true, hasBullets: false },
        { type: 'toc', label: 'Содержание', icon: '\uD83D\uDCD1', category: 'special', hasHsFilter: false, hasTopN: false, hasYear: false, hasSubtitle: false, hasBullets: false },
        { type: 'text', label: 'Текст', icon: '\uD83D\uDCDD', category: 'special', hasHsFilter: false, hasTopN: false, hasYear: false, hasSubtitle: false, hasBullets: true },
        { type: 'intro', label: 'Введение', icon: '\uD83D\uDCD6', category: 'special', hasHsFilter: true, hasTopN: false, hasYear: false, hasSubtitle: false, hasBullets: true },
        { type: 'section-divider', label: 'Разделитель', icon: '\uD83D\uDCCC', category: 'special', hasHsFilter: true, hasTopN: false, hasYear: false, hasSubtitle: false, hasBullets: false },
        { type: 'facts', label: 'Ключевые факты', icon: '\uD83D\uDCCA', category: 'analysis', hasHsFilter: true, hasTopN: false, hasYear: false, hasSubtitle: false, hasBullets: false, hasCommentary: false },
        { type: 'volumes', label: 'Объёмы', icon: '\uD83D\uDCE6', category: 'analysis', hasHsFilter: true, hasTopN: false, hasYear: false, hasSubtitle: false, hasBullets: false, hasCommentary: true },
        { type: 'countries', label: 'Страны', icon: '\uD83C\uDF0D', category: 'analysis', hasHsFilter: true, hasTopN: true, hasYear: false, hasSubtitle: false, hasBullets: false, hasCommentary: true },
        { type: 'price-dynamics', label: 'Цены/страны', icon: '\uD83D\uDCB0', category: 'analysis', hasHsFilter: true, hasTopN: true, hasYear: false, hasSubtitle: false, hasBullets: false, hasCommentary: true },
        { type: 'sankey-sender', label: 'Санки: Отпр\u2192Пол', icon: '\uD83C\uDFED', category: 'analysis', hasHsFilter: true, hasTopN: true, hasYear: true, hasSubtitle: false, hasBullets: false, hasCommentary: true },
        { type: 'sankey-manufacturer', label: 'Санки: Изг\u2192Пол', icon: '\uD83C\uDFED', category: 'analysis', hasHsFilter: true, hasTopN: true, hasYear: true, hasSubtitle: false, hasBullets: false, hasCommentary: true },
        { type: 'quarterly-prices', label: 'Кварт. цены', icon: '\uD83D\uDCC8', category: 'analysis', hasHsFilter: true, hasTopN: false, hasYear: false, hasSubtitle: false, hasBullets: false, hasCommentary: true },
        { type: 'market-changes', label: 'Изменения рынка', icon: '⚡', category: 'analysis', hasHsFilter: true, hasTopN: true, hasYear: false, hasSubtitle: false, hasBullets: false, hasCommentary: true },
        { type: 'segments', label: 'Каналы сбыта', icon: '\uD83C\uDFEC', category: 'analysis', hasHsFilter: true, hasTopN: false, hasYear: false, hasSubtitle: false, hasBullets: false, hasCommentary: true },
        { type: 'summary', label: 'Итоги', icon: '\u2705', category: 'special', hasHsFilter: false, hasTopN: false, hasYear: false, hasSubtitle: false, hasBullets: true },
        { type: 'recommendations', label: 'Рекомендации', icon: '\uD83D\uDCCB', category: 'special', hasHsFilter: false, hasTopN: false, hasYear: false, hasSubtitle: false, hasBullets: true },
        { type: 'contacts', label: 'Контакты', icon: '\u2139\uFE0F', category: 'special', hasHsFilter: false, hasTopN: false, hasYear: false, hasSubtitle: false, hasBullets: false }
    ];

    function findPresBlock(type) {
        for (var i = 0; i < PRES_BLOCKS.length; i++) {
            if (PRES_BLOCKS[i].type === type) return PRES_BLOCKS[i];
        }
        return null;
    }

    // --- Фильтр по ТН ВЭД ---
    function filterDataByHS(data, headers, hsPrefix) {
        if (!hsPrefix) return data;
        var hsCol = findColumn(headers, COL_HS_CODE);
        if (!hsCol) return data;
        return data.filter(function (row) {
            return String(row[hsCol] || '').indexOf(hsPrefix) === 0;
        });
    }

    // --- DOM-элементы ---
    var presPaletteList = document.querySelector('.pres-palette-list');
    var presSlidesList = document.querySelector('.pres-slides-list');
    var presSlidesCount = document.querySelector('.pres-slides-count');
    var presPreviewSlide = document.querySelector('.pres-preview-slide');
    var presSlideIndicator = document.querySelector('.pres-slide-indicator');
    var presPrevBtn = document.querySelector('.pres-prev-slide');
    var presNextBtn = document.querySelector('.pres-next-slide');
    var presExportBtn = document.querySelector('.pres-export-pdf');
    var presExportPptxBtn = document.querySelector('.pres-export-pptx');
    var presExportHtmlBtn = document.querySelector('.pres-export-html');
    var presClearBtn = document.querySelector('.pres-clear-btn');
    var presSettingsOverlay = document.querySelector('.pres-settings-overlay');

    // --- Рендер палитры ---
    function renderPresPalette() {
        var html = '';
        PRES_BLOCKS.forEach(function (b) {
            html += '<div class="pres-palette-item" data-type="' + b.type + '" title="' + b.label + '">';
            html += '<span>' + b.icon + '</span> ' + b.label;
            html += '</div>';
        });
        presPaletteList.innerHTML = html;

        presPaletteList.querySelectorAll('.pres-palette-item').forEach(function (el) {
            el.addEventListener('click', function () {
                addPresSlide(this.getAttribute('data-type'));
            });
        });
    }

    // --- Управление слайдами ---
    function addPresSlide(type) {
        var block = findPresBlock(type);
        if (!block) return;
        var slide = {
            id: presState.nextId++,
            type: type,
            title: block.label,
            hsFilter: '',
            topN: 10,
            year: '',
            opts: { subtitle: '', bullets: '' }
        };
        // Введение и Итоги — сразу заполняем обзорным текстом из данных
        if (type === 'intro' || type === 'summary') {
            try {
                var _d = getActiveData(), _h = getActiveHeaders();
                if (_d && _d.length) {
                    var _lines = generateReportText(type === 'intro' ? 'intro' : 'resume', _d, _h, slide);
                    if (_lines.length) slide.opts.bullets = _lines.join('\n');
                }
            } catch (e) { /* нет данных — оставляем пустым */ }
        }
        presState.slides.push(slide);
        presState.activeIndex = presState.slides.length - 1;
        renderPresSlideList();
        previewPresSlide(presState.activeIndex);
        updatePresButtons();
    }

    function removePresSlide(id) {
        presState.slides = presState.slides.filter(function (s) { return s.id !== id; });
        if (presState.activeIndex >= presState.slides.length) {
            presState.activeIndex = Math.max(0, presState.slides.length - 1);
        }
        renderPresSlideList();
        if (presState.slides.length > 0) {
            previewPresSlide(presState.activeIndex);
        } else {
            presPreviewSlide.innerHTML = '<div class="pres-preview-empty">\u0414\u043e\u0431\u0430\u0432\u044c\u0442\u0435 \u0431\u043b\u043e\u043a\u0438 \u0438\u0437 \u043f\u0430\u043b\u0438\u0442\u0440\u044b \u0441\u043b\u0435\u0432\u0430</div>';
        }
        updatePresButtons();
    }

    function movePresSlide(fromIdx, toIdx) {
        if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return;
        if (fromIdx >= presState.slides.length || toIdx >= presState.slides.length) return;
        var item = presState.slides.splice(fromIdx, 1)[0];
        presState.slides.splice(toIdx, 0, item);
        presState.activeIndex = toIdx;
        renderPresSlideList();
        updatePresButtons();
    }

    // --- Рендер списка слайдов ---
    function renderPresSlideList() {
        presSlidesCount.textContent = '(' + presState.slides.length + ')';
        if (presState.slides.length === 0) {
            presSlidesList.innerHTML = '<div style="color:var(--color-text-muted);font-size:12px;padding:8px 0">\u041f\u0443\u0441\u0442\u043e</div>';
            return;
        }
        var html = '';
        presState.slides.forEach(function (slide, idx) {
            var block = findPresBlock(slide.type);
            var isActive = idx === presState.activeIndex;
            html += '<div class="pres-slide-card' + (isActive ? ' active' : '') + '" data-idx="' + idx + '" data-id="' + slide.id + '" draggable="true">';
            html += '<span class="pres-card-icon">' + (block ? block.icon : '?') + '</span>';
            html += '<span class="pres-card-label" title="' + slide.title + '">' + slide.title + '</span>';
            if (slide.hsFilter) {
                html += '<span class="pres-hs-badge">' + slide.hsFilter.substring(0, 6) + '</span>';
            }
            html += '<span class="pres-card-actions">';
            html += '<button class="pres-card-btn pres-edit-btn" data-id="' + slide.id + '" title="\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438">\u2699</button>';
            html += '<button class="pres-card-btn pres-dup-btn" data-id="' + slide.id + '" title="\u0414\u0443\u0431\u043b\u0438\u0440\u043e\u0432\u0430\u0442\u044c">\u229A</button>';
            html += '<button class="pres-card-btn pres-del-btn" data-id="' + slide.id + '" title="\u0423\u0434\u0430\u043b\u0438\u0442\u044c">\u2715</button>';
            html += '</span>';
            html += '</div>';
        });
        presSlidesList.innerHTML = html;

        // Event listeners
        presSlidesList.querySelectorAll('.pres-slide-card').forEach(function (card) {
            var idx = parseInt(card.getAttribute('data-idx'));
            card.addEventListener('click', function (e) {
                if (e.target.closest('.pres-card-btn')) return;
                presState.activeIndex = idx;
                renderPresSlideList();
                previewPresSlide(idx);
                updatePresButtons();
            });

            // Drag-and-drop
            card.addEventListener('dragstart', function (e) {
                e.dataTransfer.setData('text/plain', String(idx));
                card.style.opacity = '0.5';
            });
            card.addEventListener('dragend', function () {
                card.style.opacity = '';
            });
            card.addEventListener('dragover', function (e) {
                e.preventDefault();
                card.classList.add('drag-over');
            });
            card.addEventListener('dragleave', function () {
                card.classList.remove('drag-over');
            });
            card.addEventListener('drop', function (e) {
                e.preventDefault();
                card.classList.remove('drag-over');
                var from = parseInt(e.dataTransfer.getData('text/plain'));
                movePresSlide(from, idx);
                previewPresSlide(presState.activeIndex);
            });
        });

        // Edit/delete/duplicate buttons
        presSlidesList.querySelectorAll('.pres-del-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                removePresSlide(parseInt(this.getAttribute('data-id')));
            });
        });
        presSlidesList.querySelectorAll('.pres-edit-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                openPresSettings(parseInt(this.getAttribute('data-id')));
            });
        });
        presSlidesList.querySelectorAll('.pres-dup-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                duplicatePresSlide(parseInt(this.getAttribute('data-id')));
            });
        });
    }

    function duplicatePresSlide(id) {
        var src = null;
        for (var i = 0; i < presState.slides.length; i++) {
            if (presState.slides[i].id === id) { src = presState.slides[i]; break; }
        }
        if (!src) return;
        var copy = JSON.parse(JSON.stringify(src));
        copy.id = presState.nextId++;
        var srcIdx = presState.slides.indexOf(src);
        presState.slides.splice(srcIdx + 1, 0, copy);
        presState.activeIndex = srcIdx + 1;
        renderPresSlideList();
        previewPresSlide(presState.activeIndex);
        updatePresButtons();
    }

    function updatePresButtons() {
        var len = presState.slides.length;
        presExportBtn.disabled = len === 0;
        presExportPptxBtn.disabled = len === 0;
        if (presExportHtmlBtn) presExportHtmlBtn.disabled = len === 0;
        presPrevBtn.disabled = presState.activeIndex <= 0;
        presNextBtn.disabled = presState.activeIndex >= len - 1;
        presSlideIndicator.textContent = len > 0
            ? (presState.activeIndex + 1) + ' / ' + len
            : '0 / 0';
    }

    // --- Настройки блока ---
    var presEditingSlideId = null;

    function openPresSettings(id) {
        var slide = null;
        for (var i = 0; i < presState.slides.length; i++) {
            if (presState.slides[i].id === id) { slide = presState.slides[i]; break; }
        }
        if (!slide) return;
        presEditingSlideId = id;
        var block = findPresBlock(slide.type);

        // Populate fields
        document.querySelector('.pres-set-title').value = slide.title || '';
        document.querySelector('.pres-set-hs').value = slide.hsFilter || '';
        document.querySelector('.pres-set-topn').value = slide.topN || 10;
        document.querySelector('.pres-set-subtitle').value = (slide.opts && slide.opts.subtitle) || '';
        document.querySelector('.pres-set-bullets').value = (slide.opts && slide.opts.bullets) || '';
        document.querySelector('.pres-set-commentary').value = (slide.opts && slide.opts.commentary) || '';

        // Show/hide fields
        document.querySelector('.pres-set-hs-group').style.display = block.hasHsFilter ? '' : 'none';
        document.querySelector('.pres-set-topn-group').style.display = block.hasTopN ? '' : 'none';
        document.querySelector('.pres-set-year-group').style.display = block.hasYear ? '' : 'none';
        document.querySelector('.pres-set-subtitle-group').style.display = block.hasSubtitle ? '' : 'none';
        document.querySelector('.pres-set-bullets-group').style.display = block.hasBullets ? '' : 'none';
        document.querySelector('.pres-set-commentary-group').style.display = block.hasCommentary ? '' : 'none';
        // Populate HS datalist
        populateHSDatalist();

        // Populate year select
        if (block.hasYear) {
            populateYearSelect(slide.year);
        }

        presSettingsOverlay.style.display = '';
    }

    function populateHSDatalist() {
        var data = getActiveData();
        var headers = getActiveHeaders();
        var hsCol = findColumn(headers, COL_HS_CODE);
        var datalist = document.getElementById('pres-hs-datalist');
        datalist.innerHTML = '';
        if (!hsCol) return;

        var codes = {};
        data.forEach(function (row) {
            var c = String(row[hsCol] || '').trim();
            if (c.length >= 4) { codes[c.substring(0, 4)] = true; }
            if (c.length >= 6) { codes[c.substring(0, 6)] = true; }
            if (c.length >= 8) { codes[c.substring(0, 8)] = true; }
            if (c.length >= 10) { codes[c.substring(0, 10)] = true; }
        });
        Object.keys(codes).sort().forEach(function (c) {
            datalist.innerHTML += '<option value="' + c + '">';
        });
    }

    function populateYearSelect(currentVal) {
        var data = getActiveData();
        var headers = getActiveHeaders();
        var yearCol = findColumn(headers, COL_YEAR);
        var sel = document.querySelector('.pres-set-year');
        sel.innerHTML = '<option value="">\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439</option>';
        if (!yearCol) return;

        var years = {};
        data.forEach(function (row) {
            var y = String(row[yearCol] || '').trim();
            if (y) years[y] = true;
        });
        Object.keys(years).sort().forEach(function (y) {
            sel.innerHTML += '<option value="' + y + '"' + (y === currentVal ? ' selected' : '') + '>' + y + '</option>';
        });
    }

    function savePresSettings() {
        if (presEditingSlideId === null) return;
        var slide = null;
        for (var i = 0; i < presState.slides.length; i++) {
            if (presState.slides[i].id === presEditingSlideId) { slide = presState.slides[i]; break; }
        }
        if (!slide) return;

        slide.title = document.querySelector('.pres-set-title').value.trim() || findPresBlock(slide.type).label;
        slide.hsFilter = document.querySelector('.pres-set-hs').value.trim();
        slide.topN = parseInt(document.querySelector('.pres-set-topn').value) || 10;
        slide.year = document.querySelector('.pres-set-year').value;
        if (!slide.opts) slide.opts = {};
        slide.opts.subtitle = document.querySelector('.pres-set-subtitle').value.trim();
        slide.opts.bullets = document.querySelector('.pres-set-bullets').value;
        var rawCommentary = document.querySelector('.pres-set-commentary').value.trim();
        var cleanedCommentary = stripMarkdown(rawCommentary);
        var allLines = cleanedCommentary.split('\n').filter(function (l) { return l.trim(); });
        var LINES_PER_SLIDE = 6;

        // Первые 6 строк остаются в текущем слайде
        slide.opts.commentary = allLines.slice(0, LINES_PER_SLIDE).join('\n');

        // Если строк больше — создаём дополнительные текстовые слайды сразу после текущего
        if (allLines.length > LINES_PER_SLIDE) {
            var slideIdx = 0;
            for (var si = 0; si < presState.slides.length; si++) {
                if (presState.slides[si].id === slide.id) { slideIdx = si; break; }
            }
            // Удаляем ранее авто-созданные продолжения (по маркеру в заголовке)
            var contTitle = slide.title + ' (продолжение)';
            presState.slides = presState.slides.filter(function (s) {
                return s.title !== contTitle || s.id === slide.id;
            });
            // Вставляем новые слайды-продолжения
            var insertAt = slideIdx + 1;
            for (var offset = LINES_PER_SLIDE; offset < allLines.length; offset += LINES_PER_SLIDE) {
                var chunk = allLines.slice(offset, offset + LINES_PER_SLIDE).join('\n');
                var contSlide = {
                    id: presState.nextId++,
                    type: 'text',
                    title: contTitle,
                    hsFilter: '', topN: 10, year: '',
                    opts: { subtitle: '', bullets: chunk }
                };
                presState.slides.splice(insertAt, 0, contSlide);
                insertAt++;
            }
        }

        presSettingsOverlay.style.display = 'none';
        presEditingSlideId = null;
        renderPresSlideList();
        previewPresSlide(presState.activeIndex);
    }

    // --- Превью ---
    function previewPresSlide(idx) {
        if (idx < 0 || idx >= presState.slides.length) return;
        presState.activeIndex = idx;

        var slide = presState.slides[idx];
        var data = getActiveData();
        var headers = getActiveHeaders();
        var filteredData = filterDataByHS(data, headers, slide.hsFilter);

        var slideHTML = renderPresSlideByType(slide, filteredData, headers);

        presPreviewSlide.innerHTML = slideHTML;

        // Scale to fit container
        var slideEl = presPreviewSlide.querySelector('.pres-slide');
        if (slideEl) {
            var containerW = presPreviewSlide.clientWidth;
            var scale = containerW / 960;
            slideEl.style.transform = 'scale(' + scale + ')';
        }

        // Inline editing: dblclick on editable elements
        presPreviewSlide.querySelectorAll('[data-editable]').forEach(function (el) {
            el.style.cursor = 'pointer';
            el.title = 'Двойной клик, чтобы редактировать';
            el.addEventListener('dblclick', function (e) {
                e.stopPropagation();
                if (el.contentEditable === 'true') return;
                // Очищаем placeholder-текст для новой пустой строки
                if (el.getAttribute('data-editable') === 'bullet-new') el.textContent = '';
                el.contentEditable = 'true';
                el.style.color = '#0F172A';
                el.style.outline = '2px solid #2563EB';
                el.style.outlineOffset = '2px';
                el.style.borderRadius = '4px';
                el.style.opacity = '1';
                el.focus();

                // Select all text
                var range = document.createRange();
                range.selectNodeContents(el);
                var sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);

                function save() {
                    el.contentEditable = 'false';
                    el.style.outline = '';
                    el.style.outlineOffset = '';
                    var field = el.getAttribute('data-editable');
                    var value = el.textContent.trim();
                    var s = presState.slides[presState.activeIndex];
                    if (!s) return;

                    if (field === 'title') {
                        s.title = value;
                        renderPresSlideList();
                    } else if (field === 'subtitle') {
                        if (!s.opts) s.opts = {};
                        s.opts.subtitle = value;
                    } else if (field === 'tagline') {
                        if (!s.opts) s.opts = {};
                        s.opts.tagline = value;
                    } else if (field === 'bullet-new') {
                        if (!s.opts) s.opts = {};
                        if (value) {
                            s.opts.bullets = value;
                            previewPresSlide(presState.activeIndex);
                        }
                    } else if (field.indexOf('bullet-') === 0) {
                        var bi = parseInt(field.split('-')[1]);
                        if (!s.opts) s.opts = {};
                        var bLines = (s.opts.bullets || '').split('\n').filter(function(l) { return l.trim(); });
                        if (bi < bLines.length) {
                            bLines[bi] = value;
                            s.opts.bullets = bLines.join('\n');
                        }
                    } else if (field.indexOf('commentary-') === 0) {
                        var ci = parseInt(field.split('-')[1]);
                        if (!s.opts) s.opts = {};
                        var cLines = (s.opts.commentary || '').split('\n').filter(function(l) { return l.trim(); });
                        if (ci < cLines.length) {
                            cLines[ci] = value;
                            s.opts.commentary = cLines.join('\n');
                        }
                    }
                }

                el.addEventListener('blur', save, { once: true });
                el.addEventListener('keydown', function (ke) {
                    if (ke.key === 'Enter') { ke.preventDefault(); el.blur(); }
                    if (ke.key === 'Escape') { el.blur(); }
                });
            });
        });

        updatePresButtons();
    }

    // --- Диспетчер рендера по типу ---
    // Собирает столбцы (товары) и строки-аспекты для матрицы рекомендаций.
    // Товары задаются в поле «Пункты» построчно как «Название|ТНВЭД-префикс»;
    // если пусто — весь набор данных одним столбцом «Рынок».
    function buildRecommendationRows(data, headers, slide) {
        var raw = (slide.opts && slide.opts.bullets) || '';
        var items = raw.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
            var p = l.split('|');
            return { name: (p[0] || '').trim() || 'Товар', hs: (p[1] || '').trim() };
        });
        if (items.length === 0) items = [{ name: 'Рынок', hs: '' }];

        var cols = items.map(function (it) {
            var fd = filterDataByHS(data, headers, it.hs);
            return {
                name: it.name,
                vm: computeSlideMetrics('volumes', fd, headers, { topN: 10 }),
                cm: computeSlideMetrics('countries', fd, headers, { topN: 10 }),
                pm: computeSlideMetrics('price-dynamics', fd, headers, { topN: 10 })
            };
        });

        function yy(vm) { return (vm.firstYear && vm.lastYear) ? ' ' + vm.firstYear.slice(-2) + '–' + vm.lastYear.slice(-2) : ''; }
        function cagrStr(vm) {
            if (vm.cagrWeight == null) return '—';
            var parts = [];
            if (vm.cagrRub != null) parts.push('~' + presRuNum(Math.round(vm.cagrRub)) + '% руб.');
            if (vm.cagrUsd != null) parts.push('~' + presRuNum(Math.round(vm.cagrUsd)) + '% долл.');
            parts.push('~' + presRuNum(Math.round(vm.cagrWeight)) + '% шт.');
            return 'CAGR' + yy(vm) + ': ' + parts.join(', ');
        }
        function supplyStr(cm) {
            if (!cm.leader) return '—';
            if (cm.leaderShare >= 70) return 'Основной поставщик — ' + cm.leader + ' (' + presRuNum(cm.leaderShare, 1) + '%); нужен поиск альтернатив для снижения рисков';
            if (cm.leaderShare >= 40) return 'Ведущий поставщик — ' + cm.leader + ' (' + presRuNum(cm.leaderShare, 1) + '%) при выраженной концентрации';
            return 'Диверсифицированный портфель поставщиков; лидер ' + cm.leader + ' (' + presRuNum(cm.leaderShare, 1) + '%), риски сбалансированы';
        }
        function priceStr(pm) {
            if (pm.priceMin == null) return '—';
            return 'Диапазон закупочных цен ' + presRuNum(pm.priceMin, 1) + '–' + presRuNum(pm.priceMax, 1) + ' USD/кг';
        }
        function keyStr(vm, cm) {
            var t = presTrendPhrase(vm.cagrWeight);
            if (cm.leaderShare >= 70 && t.dir === 'up') return 'Рынок привлекателен высокими темпами роста, но зависит от одного поставщика. Это ключевой риск';
            if (t.dir === 'up') return 'Растущий рынок с приемлемым уровнем риска, благоприятен для входа';
            if (t.dir === 'down') return 'Рынок сжимается, поэтому вход требует осторожности и ценовых преимуществ';
            return 'Рынок стабилен, успех определяется операционной эффективностью в условиях конкуренции';
        }

        var rows = [
            { label: 'Общий рынок (объём)', vals: cols.map(function (c) { return cagrStr(c.vm); }) },
            { label: 'Цепочка поставок', vals: cols.map(function (c) { return supplyStr(c.cm); }) },
            { label: 'Ценовое позиционирование', vals: cols.map(function (c) { return priceStr(c.pm); }) },
            { label: 'Ключевой вывод', vals: cols.map(function (c) { return keyStr(c.vm, c.cm); }), bold: true }
        ];
        return { cols: cols, rows: rows };
    }

    function renderPresRecommendations(data, headers, slide) {
        if (!data || data.length === 0) return presNoData(slide.title || 'Рекомендации');
        var r = buildRecommendationRows(data, headers, slide);
        var colW = Math.floor(74 / r.cols.length);
        var body = '<table style="width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed">';
        body += '<tr><th style="text-align:left;padding:8px;border-bottom:2px solid #2563EB;color:#2563EB;width:26%">Аспект анализа</th>';
        r.cols.forEach(function (c) {
            body += '<th style="text-align:left;padding:8px;border-bottom:2px solid #2563EB;color:#2563EB;width:' + colW + '%">' + svgEscFact(c.name) + '</th>';
        });
        body += '</tr>';
        r.rows.forEach(function (row, ri) {
            var bg = ri % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
            var fw = row.bold ? '700' : '400';
            var color = row.bold ? '#0F172A' : '#334155';
            body += '<tr style="background:' + bg + '">';
            body += '<td style="padding:8px;font-weight:600;color:#0F172A;vertical-align:top">' + svgEscFact(row.label) + '</td>';
            row.vals.forEach(function (v) {
                body += '<td style="padding:8px;font-weight:' + fw + ';color:' + color + ';vertical-align:top;line-height:1.35">' + svgEscFact(v) + '</td>';
            });
            body += '</tr>';
        });
        body += '</table>';
        return slideWrapper(slide.title || 'Рекомендации', body, {});
    }

    // --- Каналы сбыта: структура потребления по сегментам получателей ---
    function renderPresSegments(data, headers, slide) {
        var segCol = findAnyColumn(headers, SEGMENT_COLS);
        var yearCol = findColumn(headers, COL_YEAR);
        var wCol = findAnyColumn(headers, WEIGHT_COLS);
        if (!segCol) return presNoData((slide.title || 'Каналы сбыта') + ': нет столбца «Сегмент получателя». Выполните обогащение данных.');
        if (!wCol || !yearCol || data.length === 0) return presNoData(slide.title || 'Каналы сбыта');

        // Сегмент × год по весу
        var byYear = {}, bySeg = {}, years = {};
        data.forEach(function (row) {
            var y = String(row[yearCol] || '').trim();
            var sg = String(row[segCol] || '').trim() || 'Прочее';
            var w = Number(row[wCol]) || 0;
            if (!y || w <= 0) return;
            years[y] = true;
            if (!byYear[y]) byYear[y] = {};
            byYear[y][sg] = (byYear[y][sg] || 0) + w;
            bySeg[sg] = (bySeg[sg] || 0) + w;
        });
        var yrs = Object.keys(years).sort();
        var segs = Object.keys(bySeg).sort(function (a, b) { return bySeg[b] - bySeg[a]; });
        if (!yrs.length || !segs.length) return presNoData(slide.title || 'Каналы сбыта');

        var totalByYear = {};
        yrs.forEach(function (y) {
            totalByYear[y] = segs.reduce(function (sum, sg) { return sum + (byYear[y][sg] || 0); }, 0);
        });

        var COLORS = ['#2563EB', '#16A34A', '#F59E0B', '#8B5CF6', '#DC2626', '#0EA5E9', '#94A3B8'];
        var svgW = 880;
        var rowH = 24, headH = 28;
        var tblH = headH + segs.length * rowH + 4;
        var colW0 = 300, colWRest = Math.floor((svgW - colW0) / yrs.length);
        var barH = 150;
        var totalSvgH = tblH + barH + 30;

        var body = '<svg width="' + svgW + '" height="' + totalSvgH + '" viewBox="0 0 ' + svgW + ' ' + totalSvgH + '">';
        body += '<style>text{font-family:DejaVu Sans,sans-serif;font-size:12px}</style>';

        // Заголовок таблицы
        body += '<rect x="0" y="0" width="' + svgW + '" height="' + headH + '" fill="#1E3A5F" rx="4"/>';
        body += '<text x="6" y="' + (headH / 2 + 5) + '" fill="#FFFFFF" font-weight="700">Сегмент</text>';
        yrs.forEach(function (y, i) {
            body += '<text x="' + (colW0 + colWRest * i + colWRest - 6) + '" y="' + (headH / 2 + 5) + '" text-anchor="end" fill="#FFFFFF" font-weight="700">' + y + '</text>';
        });

        // Строки: доли по годам
        segs.forEach(function (sg, ri) {
            var ry = headH + ri * rowH;
            body += '<rect x="0" y="' + ry + '" width="' + svgW + '" height="' + rowH + '" fill="' + (ri % 2 === 0 ? '#F8FAFC' : '#FFFFFF') + '"/>';
            body += '<rect x="6" y="' + (ry + 7) + '" width="10" height="10" rx="2" fill="' + COLORS[ri % COLORS.length] + '"/>';
            body += '<text x="22" y="' + (ry + rowH / 2 + 5) + '" fill="#0F172A">' + svgEscFact(truncFact(sg, 40)) + '</text>';
            yrs.forEach(function (y, i) {
                var share = totalByYear[y] > 0 ? (byYear[y][sg] || 0) / totalByYear[y] * 100 : 0;
                body += '<text x="' + (colW0 + colWRest * i + colWRest - 6) + '" y="' + (ry + rowH / 2 + 5) + '" text-anchor="end" fill="#334155">' + presRuNum(share, 1) + '%</text>';
            });
            body += '<line x1="0" y1="' + (ry + rowH) + '" x2="' + svgW + '" y2="' + (ry + rowH) + '" stroke="#E2E8F0" stroke-width="0.5"/>';
        });
        body += '<rect x="0" y="0" width="' + svgW + '" height="' + tblH + '" fill="none" stroke="#CBD5E1" rx="4"/>';

        // Стопка долей по годам
        var barTop = tblH + 20;
        var bPad = { l: 8, r: 8, b: 22, t: 6 };
        var innerW = svgW - bPad.l - bPad.r;
        var innerH = barH - bPad.t - bPad.b;
        var slot = innerW / yrs.length;
        var bW = Math.min(90, slot * 0.55);
        yrs.forEach(function (y, i) {
            var bx = bPad.l + slot * i + (slot - bW) / 2;
            var acc = 0;
            segs.forEach(function (sg, si) {
                var share = totalByYear[y] > 0 ? (byYear[y][sg] || 0) / totalByYear[y] : 0;
                var h = share * innerH;
                if (h <= 0) return;
                var by = barTop + bPad.t + innerH - acc - h;
                body += '<rect x="' + bx + '" y="' + by + '" width="' + bW + '" height="' + h + '" fill="' + COLORS[si % COLORS.length] + '"/>';
                if (share >= 0.08) {
                    body += '<text x="' + (bx + bW / 2) + '" y="' + (by + h / 2 + 4) + '" text-anchor="middle" font-size="10" fill="#FFFFFF" font-weight="700">' + Math.round(share * 100) + '%</text>';
                }
                acc += h;
            });
            body += '<text x="' + (bx + bW / 2) + '" y="' + (barTop + bPad.t + innerH + 15) + '" text-anchor="middle" font-size="10" fill="#64748B">' + y + '</text>';
        });

        body += '</svg>';
        return slideWrapper(slide.title || 'Каналы сбыта', body, { commentary: slide.opts && slide.opts.commentary });
    }

    function marketPresPanel(title, rows, result, color, topN) {
        var shown = rows.slice(0, topN);
        var maxDelta = shown.reduce(function (max, row) {
            return Math.max(max, Math.abs(row.delta));
        }, 0) || 1;
        var svg = '<svg class="pres-market-panel" viewBox="0 0 390 320" xmlns="http://www.w3.org/2000/svg">';
        svg += '<rect x="0" y="0" width="390" height="320" rx="10" fill="#F8FAFC" stroke="#E2E8F0"/>';
        svg += '<text x="18" y="28" font-size="15" font-weight="700" fill="' + color + '">' + svgEscFact(title) + '</text>';
        if (!shown.length) {
            svg += '<text x="195" y="168" text-anchor="middle" font-size="13" fill="#94A3B8">Нет позиций</text>';
            return svg + '</svg>';
        }
        shown.forEach(function (row, index) {
            var y = 54 + index * 48;
            var barW = Math.max(3, Math.abs(row.delta) / maxDelta * 180);
            var status = row.status === 'new' ? 'новая' : (row.status === 'disappeared' ? 'исчезла' : '');
            svg += '<text x="18" y="' + y + '" font-size="10" font-weight="600" fill="#0F172A">' + svgEscFact(truncFact(row.key, 34)) + '</text>';
            if (status) {
                svg += '<text x="372" y="' + y + '" text-anchor="end" font-size="8" font-weight="700" fill="' + color + '">' + status + '</text>';
            }
            svg += '<rect x="18" y="' + (y + 8) + '" width="' + barW + '" height="12" rx="3" fill="' + color + '" opacity="0.82"/>';
            svg += '<text x="' + (Math.min(18 + barW + 7, 280)) + '" y="' + (y + 18) + '" font-size="9" fill="#334155">' +
                svgEscFact((row.delta >= 0 ? '+' : '') + marketFormatValue(row.delta, result.metric)) + '</text>';
            if (row.pct != null) {
                svg += '<text x="372" y="' + (y + 18) + '" text-anchor="end" font-size="9" fill="#64748B">' +
                    svgEscFact((row.pct >= 0 ? '+' : '') + round2(row.pct) + '%') + '</text>';
            }
        });
        return svg + '</svg>';
    }

    function renderPresMarketChanges(data, headers, slide) {
        var dimensions = marketDimensionOptions(headers);
        if (!dimensions.length) { return presNoData(slide.title || 'Изменения рынка'); }
        var hsDimension = dimensions.filter(function (d) { return d.type === 'hs'; })[0];
        var dimension = hsDimension ? hsDimension.column : dimensions[0].column;
        var metric = findColumn(headers, COL_WEIGHT) ? 'weight' :
            (findColumn(headers, COL_STAT_USD) ? 'usd' : 'count');
        var result = computeMarketChanges(data, headers, {
            granularity: 'year',
            dimension: dimension,
            hsLevel: 4,
            metric: metric,
            threshold: 0
        });
        if (result.error) { return presNoData(slide.title || 'Изменения рынка'); }

        var topN = Math.max(3, Math.min(slide.topN || 5, 5));
        var up = result.added.concat(result.growth).sort(function (a, b) { return b.delta - a.delta; });
        var down = result.disappeared.concat(result.decline).sort(function (a, b) { return a.delta - b.delta; });
        var body = '<div class="pres-market-caption">' + marketEsc(result.dimensionLabel) + ' · ' +
            marketEsc(marketMetricLabel(result.metric)) + ' · ' + marketEsc(result.basePeriod) + ' → ' +
            marketEsc(result.currentPeriod) + '</div>';
        body += '<div class="pres-market-grid">';
        body += marketPresPanel('Рост и новые позиции', up, result, '#16A34A', topN);
        body += marketPresPanel('Падение и исчезнувшие', down, result, '#DC2626', topN);
        body += '</div>';
        return slideWrapper(slide.title || 'Изменения рынка', body, {
            commentary: slide.opts && slide.opts.commentary
        });
    }

    function renderPresSlideByType(slide, data, headers) {
        var type = slide.type;
        if (type === 'title') return renderPresTitle(slide);
        if (type === 'toc') return renderPresTOC();
        if (type === 'text') return renderPresText(slide);
        if (type === 'intro') return renderPresText(slide);
        if (type === 'section-divider') return renderPresSectionDivider(slide);
        if (type === 'contacts') return renderPresContacts();
        if (type === 'summary') return renderPresText(slide);
        if (type === 'recommendations') return renderPresRecommendations(data, headers, slide);
        // Аналитические блоки — будут добавлены в Фазе 4
        if (type === 'volumes') return renderPresVolumes(data, headers, slide);
        if (type === 'countries') return renderPresCountries(data, headers, slide);
        if (type === 'price-dynamics') return renderPresPriceDynamics(data, headers, slide);
        if (type === 'sankey-sender') return renderPresSankeySender(data, headers, slide);
        if (type === 'sankey-manufacturer') return renderPresSankeyManufacturer(data, headers, slide);
        if (type === 'quarterly-prices') return renderPresQuarterlyPrices(data, headers, slide);
        if (type === 'market-changes') return renderPresMarketChanges(data, headers, slide);
        if (type === 'facts') return renderPresFacts(data, headers, slide);
        if (type === 'segments') return renderPresSegments(data, headers, slide);
        return slideWrapper('\u041e\u0448\u0438\u0431\u043a\u0430', '<p>\u041d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u044b\u0439 \u0442\u0438\u043f \u0431\u043b\u043e\u043a\u0430</p>', {});
    }

    // --- Обёртка слайда ---
    /* Убирает markdown-разметку для отображения в слайде */
    function stripMarkdown(text) {
        return text
            .replace(/^#{1,6}\s+/gm, '')          // ### заголовки
            .replace(/\*\*\*(.+?)\*\*\*/g, '$1')  // ***жирный курсив***
            .replace(/\*\*(.+?)\*\*/g, '$1')       // **жирный**
            .replace(/\*(.+?)\*/g, '$1')           // *курсив*
            .replace(/`(.+?)`/g, '$1')             // `код`
            .replace(/^[-*]\s+/gm, '')             // - bullet / * bullet
            .replace(/^\d+\.\s+/gm, '')            // 1. нумерация
            .replace(/^>\s+/gm, '')                // > цитата
            .replace(/---+/g, '')                  // ---
            .replace(/^\|.*\|$/gm, '')             // | таблица |
            .replace(/^\s*[-|:]+\s*$/gm, '')       // |---|---| разделитель таблицы
            .replace(/\n{3,}/g, '\n\n')            // лишние переносы
            .trim();
    }

    function slideWrapper(headerText, bodyHTML, opts) {
        opts = opts || {};
        var slideNum = opts.slideNum || '';
        var commentary = opts.commentary || '';
        var html = '<div class="pres-slide">';
        html += '<div class="pres-slide-header">';
        html += '<span class="pres-slide-header-text" data-editable="title">' + headerText + '</span>';
        html += '</div>';
        if (commentary) {
            var cleanCommentary = stripMarkdown(commentary);
            var commentLines = cleanCommentary.split('\n').filter(function (l) { return l.trim(); }).slice(0, 6);
            html += '<div class="pres-slide-body"><div class="pres-slide-body-cols">';
            html += '<div class="pres-col-data">' + bodyHTML + '</div>';
            html += '<div class="pres-col-comment">';
            html += '<p class="pres-comment-title">Аналитика</p>';
            commentLines.forEach(function (line, ci) {
                html += '<div class="pres-comment-card" data-editable="commentary-' + ci + '">' + line.trim() + '</div>';
            });
            html += '</div>';
            html += '</div></div>';
        } else {
            html += '<div class="pres-slide-body">' + bodyHTML + '</div>';
        }
        html += '<div class="pres-slide-footer">';
        html += '<span>DELOMANT</span>';
        var srcNote = dataSourceNote();
        html += '<span>' + (srcNote || 'delomant.ru') + '</span>';
        if (slideNum) html += '<span>' + slideNum + '</span>';
        html += '</div>';
        html += '</div>';
        return html;
    }

    // --- Статические рендереры ---

    // Геометрический узор-лепестки Delomant (правая часть обложки, эталон)
    function presCoverPattern() {
        return '<svg class="pres-title-pattern" viewBox="0 0 460 560" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">' +
            '<g fill="#FFFFFF" fill-opacity="0.06">' +
            '<path d="M120 40h100v100a100 100 0 0 1-100-100z"/>' +
            '<path d="M340 40v100a100 100 0 0 1-100-100z"/>' +
            '<path d="M240 260a100 100 0 0 1 100-100v100z"/>' +
            '<path d="M120 260a100 100 0 0 0 100 100V260z"/>' +
            '<path d="M340 380h100v100a100 100 0 0 1-100-100z"/>' +
            '<path d="M240 480a100 100 0 0 1 100-100v100z"/>' +
            '<circle cx="180" cy="430" r="72"/></g>' +
            '<rect x="242" y="262" width="96" height="96" fill="none" stroke="#FFFFFF" stroke-opacity="0.28" stroke-width="1.5" stroke-dasharray="4 5"/></svg>';
    }

    function renderPresTitle(slide) {
        var tagline = (slide.opts && slide.opts.tagline) ||
            'Аналитическая справка\nпо итогам маркетингового исследования';
        var tagHtml = tagline.split('\n').map(function (l) { return l.trim(); }).join('<br>');
        var html = '<div class="pres-slide">';
        html += '<div class="pres-slide-title-bg">';
        html += presCoverPattern();
        html += '<div class="pres-title-top">';
        html += '<img src="data/Logo.png" class="pres-title-logo" onerror="this.style.display=\'none\'">';
        html += '<div class="pres-title-tag" data-editable="tagline">' + tagHtml + '</div>';
        html += '</div>';
        html += '<div class="pres-title-body">';
        html += '<div class="pres-title-main" data-editable="title">' + (slide.title || 'Аналитическая справка') + '</div>';
        if (slide.opts && slide.opts.subtitle) {
            html += '<div class="pres-title-sub" data-editable="subtitle">' + slide.opts.subtitle + '</div>';
        } else {
            html += '<div class="pres-title-sub" data-editable="subtitle" style="opacity:0.4">Подзаголовок (двойной клик)</div>';
        }
        html += '</div>';
        html += '<div class="pres-title-footer"><span>delomant.ru</span><span>' + new Date().getFullYear() + '</span></div>';
        html += '</div></div>';
        return html;
    }

    function renderPresTOC() {
        // Считаем пункты заранее, чтобы подобрать плотность под их количество
        var entries = [];
        presState.slides.forEach(function (s, idx) {
            if (s.type === 'toc') return;
            var block = findPresBlock(s.type);
            var label = s.title || (block ? block.label : '');
            if (s.hsFilter) label += ' (' + s.hsFilter + ')';
            entries.push({ label: label, pg: idx + 1 });
        });
        // Адаптивная высота строки: список всегда вписывается в рамку слайда.
        // Внутренняя высота под список ≈ 400px (540 − паддинги − кикер).
        var n = Math.max(1, entries.length);
        var rowH = Math.min(42, Math.floor(400 / n));
        var fs = Math.max(11, Math.min(15, Math.round(rowH * 0.42)));
        var pad = Math.max(2, Math.floor((rowH - fs * 1.35 - 1) / 2));
        var liStyle = 'padding:' + pad + 'px 0;font-size:' + fs + 'px';
        var items = '';
        entries.forEach(function (e, i) {
            items += '<li style="' + liStyle + '"><span class="pres-toc-num">' + (i + 1) + '</span>' +
                '<span class="pres-toc-label">' + e.label + '</span>' +
                '<span class="pres-toc-pg">' + e.pg + '</span></li>';
        });
        var html = '<div class="pres-slide"><div class="pres-toc-bg">';
        html += '<div class="pres-toc-kicker">DELOMANT GROUP</div>';
        html += '<ul class="pres-toc-list">' + items + '</ul>';
        html += '<div class="pres-toc-big">\u041e\u0433\u043b\u0430\u0432\u043b\u0435\u043d\u0438\u0435</div>';
        html += '<div class="pres-toc-foot"><span>DELOMANT</span><span>delomant.ru</span></div>';
        html += '</div></div>';
        return html;
    }

    function renderPresText(slide) {
        var bullets = stripMarkdown((slide.opts && slide.opts.bullets) || '');
        var lines = bullets.split('\n').filter(function (l) { return l.trim(); });
        var body = '';
        if (lines.length > 0) {
            body += '<div class="pres-text-cards">';
            lines.forEach(function (l, i) {
                body += '<div class="pres-text-card" data-editable="bullet-' + i + '">' + l.trim() + '</div>';
            });
            body += '</div>';
        } else {
            body += '<p class="pres-text-empty" data-editable="bullet-new" style="color:#64748B;cursor:pointer" title="Двойной клик — редактировать">Двойной клик чтобы добавить текст</p>';
        }
        return slideWrapper(slide.title || 'Текст', body, {});
    }

    function renderPresSectionDivider(slide) {
        // Count which section this is
        var secNum = 0;
        for (var i = 0; i < presState.slides.length; i++) {
            if (presState.slides[i].type === 'section-divider') secNum++;
            if (presState.slides[i].id === slide.id) break;
        }
        var html = '<div class="pres-slide">';
        html += '<div class="pres-slide-divider-bg">';
        html += '<div class="pres-divider-num">' + secNum + '</div>';
        html += '<div class="pres-divider-text" data-editable="title">' + (slide.title || 'Раздел ' + secNum) + '</div>';
        html += '<div class="pres-divider-footer">DELOMANT</div>';
        html += '</div></div>';
        return html;
    }

    function renderPresContacts() {
        var html = '<div class="pres-slide">';
        html += '<div class="pres-contacts-bg">';
        html += '<img src="data/Logo.png" class="pres-contacts-logo" onerror="this.style.display=\'none\'">';
        html += '<div class="pres-contacts-title">\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b</div>';
        html += '<div class="pres-contacts-line">\u041c\u043e\u0441\u043a\u0432\u0430</div>';
        html += '<div class="pres-contacts-line">\u041a\u0443\u0442\u0443\u0437\u043e\u0432\u0441\u043a\u0438\u0439 \u043f\u0440\u043e\u0441\u043f\u0435\u043a\u0442, 35</div>';
        html += '<div class="pres-contacts-line">+7 (495) 445 97 77</div>';
        html += '<div class="pres-contacts-line">info@delomant.ru</div>';
        html += '</div></div>';
        return html;
    }

    // --- Аналитические рендереры слайдов ---

    function presNoData(title) {
        return slideWrapper(title, '<p style="color:#94A3B8;font-size:14px;text-align:center;margin-top:80px">\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445. \u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u0438 \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u0430\u0439\u0442\u0435 \u0434\u0430\u043d\u043d\u044b\u0435.</p>', {});
    }

    function presCalcCAGR(first, last, years) {
        if (!first || first <= 0 || years <= 0) return null;
        return (Math.pow(last / first, 1 / years) - 1) * 100;
    }
    // --- Ключевые факты (KPI-доска, точные цифры без ИИ) ---
    function svgEscFact(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function truncFact(s, n) {
        s = String(s || '');
        return s.length > n ? s.slice(0, n - 1) + '…' : s;
    }
    function renderPresFacts(data, headers, slide) {
        var title = slide.title || 'Ключевые факты';
        var yearCol = findColumn(headers, COL_YEAR);
        var quarterCol = findColumn(headers, COL_QUARTER);
        var weightCol = findColumn(headers, COL_WEIGHT);
        var statUsdCol = findColumn(headers, COL_STAT_USD);
        var hsCol = findColumn(headers, COL_HS_CODE);
        var countryCol = findColumn(headers, 'Страна отправления') || findColumn(headers, 'Страна назначения') || findColumn(headers, 'Страна происхождения');
        if (!data || data.length === 0) return presNoData(title);

        var byYear = {}, byYearQ = {}, byCountry = {}, hsSet = {};
        var totalW = 0, totalU = 0, grandC = 0;
        data.forEach(function (row) {
            var w = Number(row[weightCol]) || 0;
            var u = Number(row[statUsdCol]) || 0;
            totalW += w; totalU += u;
            if (yearCol) {
                var y = String(row[yearCol] || '').trim();
                if (y) {
                    if (!byYear[y]) byYear[y] = { w: 0, u: 0 };
                    byYear[y].w += w; byYear[y].u += u;
                    if (quarterCol) {
                        var q = String(row[quarterCol] || '').trim();
                        if (q) { if (!byYearQ[y]) byYearQ[y] = {}; byYearQ[y][q] = true; }
                    }
                }
            }
            if (countryCol) {
                var c = String(row[countryCol] || '').trim();
                if (c) { byCountry[c] = (byCountry[c] || 0) + w; grandC += w; }
            }
            if (hsCol) {
                var code = String(row[hsCol] || '').trim();
                if (code) hsSet[code] = true;
            }
        });

        var years = Object.keys(byYear).sort();
        var partialYear = '';
        if (quarterCol && years.length) {
            var ly = years[years.length - 1];
            var lq = Object.keys(byYearQ[ly] || {});
            if (lq.length > 0 && lq.length < 4) partialYear = ly;
        }
        var fullYears = partialYear ? years.filter(function (y) { return y !== partialYear; }) : years;

        var cagrW = null, cagrU = null;
        if (fullYears.length >= 2) {
            var yfrst = byYear[fullYears[0]], ylast = byYear[fullYears[fullYears.length - 1]];
            var nn = fullYears.length - 1;
            cagrW = presCalcCAGR(yfrst.w, ylast.w, nn);
            cagrU = presCalcCAGR(yfrst.u, ylast.u, nn);
        }

        var leader = '', leaderShare = 0;
        var cKeys = Object.keys(byCountry);
        if (cKeys.length) {
            cKeys.sort(function (a, b) { return byCountry[b] - byCountry[a]; });
            leader = cKeys[0];
            leaderShare = grandC > 0 ? round2(byCountry[leader] / grandC * 100) : 0;
        }

        var avgPrice = totalW > 0 ? round2(totalU / totalW) : null;

        var cards = [];
        var periodVal = years.length ? (years[0] === years[years.length - 1] ? years[0] : years[0] + '–' + years[years.length - 1]) : '—';
        cards.push({ value: periodVal, label: 'Период данных', note: partialYear ? partialYear + ' — неполный' : '', accent: '#2563EB' });
        cards.push({ value: formatNumber(data.length), label: 'Деклараций', note: '', accent: '#2563EB' });
        cards.push({ value: formatNumber(round2(totalW / 1000)), label: 'Объём, тонн', note: '', accent: '#0EA5E9' });
        cards.push({ value: formatNumber(round2(totalU / 1000)), label: 'Стоимость, тыс. USD', note: '', accent: '#0EA5E9' });
        if (avgPrice != null) cards.push({ value: formatNumber(avgPrice), label: 'Средняя цена, USD/кг', note: '', accent: '#F59E0B' });
        if (cagrW != null) cards.push({ value: (cagrW > 0 ? '+' : '') + round2(cagrW) + '%', label: 'CAGR объёма', note: partialYear ? 'по полным годам' : '', accent: cagrW >= 0 ? '#10B981' : '#EF4444' });
        if (cagrU != null) cards.push({ value: (cagrU > 0 ? '+' : '') + round2(cagrU) + '%', label: 'CAGR стоимости', note: partialYear ? 'по полным годам' : '', accent: cagrU >= 0 ? '#10B981' : '#EF4444' });
        if (leader) cards.push({ value: leaderShare + '%', label: 'Доля лидера: ' + truncFact(leader, 18), note: '', accent: '#8B5CF6' });
        if (cKeys.length) cards.push({ value: formatNumber(cKeys.length), label: 'Стран-поставщиков', note: '', accent: '#64748B' });
        else if (Object.keys(hsSet).length) cards.push({ value: formatNumber(Object.keys(hsSet).length), label: 'Кодов ТН ВЭД', note: '', accent: '#64748B' });

        var svgW = 900, cols = 3, gap = 16;
        var cardW = Math.floor((svgW - gap * (cols - 1)) / cols);
        var cardH = 104;
        var rows = Math.ceil(cards.length / cols);
        var svgH = rows * cardH + (rows - 1) * gap;

        var body = '<svg width="' + svgW + '" height="' + svgH + '" viewBox="0 0 ' + svgW + ' ' + svgH + '">';
        body += '<style>text{font-family:DejaVu Sans,Arial,sans-serif}</style>';
        cards.forEach(function (card, i) {
            var cx = (i % cols) * (cardW + gap);
            var cy = Math.floor(i / cols) * (cardH + gap);
            body += '<rect x="' + cx + '" y="' + cy + '" width="' + cardW + '" height="' + cardH + '" rx="10" fill="#F8FAFC" stroke="#E2E8F0"/>';
            body += '<rect x="' + cx + '" y="' + cy + '" width="5" height="' + cardH + '" rx="2.5" fill="' + card.accent + '"/>';
            var vlen = String(card.value).length;
            var vsize = vlen > 12 ? 22 : (vlen > 8 ? 27 : 32);
            body += '<text x="' + (cx + 22) + '" y="' + (cy + 47) + '" font-size="' + vsize + '" font-weight="700" fill="#0F172A">' + svgEscFact(card.value) + '</text>';
            body += '<text x="' + (cx + 22) + '" y="' + (cy + 73) + '" font-size="13" fill="#475569">' + svgEscFact(card.label) + '</text>';
            if (card.note) body += '<text x="' + (cx + 22) + '" y="' + (cy + 91) + '" font-size="11" fill="#94A3B8">' + svgEscFact(card.note) + '</text>';
        });
        body += '</svg>';

        return slideWrapper(title, body, {});
    }


    // --- Объёмы и стоимость ---
    function renderPresVolumes(data, headers, slide) {
        var weightCol = findColumn(headers, COL_WEIGHT);
        var statUsdCol = findColumn(headers, COL_STAT_USD);
        var rubCtx = buildRubCtx(headers);
        var hasRub = rubCtx.customsCol || rubCtx.invoiceRubCol || rubCtx.statUsdCol;
        var yearCol = findColumn(headers, COL_YEAR);
        if (!yearCol || data.length === 0) return presNoData(slide.title);

        var byYear = {};
        data.forEach(function (row) {
            var y = String(row[yearCol] || '').trim();
            if (!y) return;
            if (!byYear[y]) byYear[y] = { weight: 0, usd: 0, rub: 0 };
            byYear[y].weight += (Number(row[weightCol]) || 0);
            byYear[y].usd += (Number(row[statUsdCol]) || 0);
            byYear[y].rub += hasRub ? getRowRubValue(row, rubCtx) : 0;
        });
        var years = Object.keys(byYear).sort();
        if (years.length === 0) return presNoData(slide.title);

        // CAGR
        var n = years.length >= 2 ? years.length - 1 : 0;
        var cagrW = n > 0 && weightCol ? presCalcCAGR(byYear[years[0]].weight, byYear[years[n]].weight, n) : null;
        var cagrU = n > 0 && statUsdCol ? presCalcCAGR(byYear[years[0]].usd, byYear[years[n]].usd, n) : null;
        var cagrR = n > 0 && hasRub ? presCalcCAGR(byYear[years[0]].rub, byYear[years[n]].rub, n) : null;

        // SVG: таблица + бар-чарт в одном SVG
        var cols = ['\u0413\u043e\u0434'];
        if (weightCol) cols.push('\u0442\u043e\u043d\u043d');
        if (statUsdCol) cols.push('\u0442\u044b\u0441. USD');
        if (hasRub) cols.push('\u0442\u044b\u0441. \u0440\u0443\u0431.');
        var nCols = cols.length;
        var svgW = 880;
        var rowH = 24, headH = 28;
        var dataRows = years.length + (n > 0 ? 1 : 0); // +CAGR
        var tblH = headH + dataRows * rowH + 4;
        var colW0 = 60, colWRest = Math.floor((svgW - colW0) / (nCols - 1));
        // Bar chart under table
        var barH = weightCol && years.length >= 2 ? 140 : 0;
        var totalSvgH = tblH + (barH > 0 ? barH + 16 : 0);

        var body = '<svg width="' + svgW + '" height="' + totalSvgH + '" viewBox="0 0 ' + svgW + ' ' + totalSvgH + '">';
        body += '<style>text{font-family:DejaVu Sans,sans-serif;font-size:12px}</style>';

        // Header row
        body += '<rect x="0" y="0" width="' + svgW + '" height="' + headH + '" fill="#1E3A5F" rx="4"/>';
        cols.forEach(function(c, ci) {
            var x = ci === 0 ? colW0 / 2 : colW0 + colWRest * (ci - 1) + colWRest / 2;
            body += '<text x="' + x + '" y="' + (headH / 2 + 5) + '" text-anchor="middle" fill="#FFFFFF" font-weight="700" font-size="12">' + c + '</text>';
        });

        // Data rows
        var rowVals = years.map(function(y) {
            var d = byYear[y];
            var cells = [y];
            if (weightCol) cells.push(formatNumber(round2(d.weight / 1000)));
            if (statUsdCol) cells.push(formatNumber(round2(d.usd / 1000)));
            if (hasRub) cells.push(formatNumber(round2(d.rub / 1000)));
            return cells;
        });
        if (n > 0) {
            var cagrRow = ['CAGR'];
            if (weightCol) cagrRow.push(cagrW !== null ? round2(cagrW) + '%' : '\u2014');
            if (statUsdCol) cagrRow.push(cagrU !== null ? round2(cagrU) + '%' : '\u2014');
            if (hasRub) cagrRow.push(cagrR !== null ? round2(cagrR) + '%' : '\u2014');
            rowVals.push(cagrRow);
        }
        rowVals.forEach(function(cells, ri) {
            var ry = headH + ri * rowH;
            var isCagr = n > 0 && ri === rowVals.length - 1;
            var bg = isCagr ? '#EFF6FF' : (ri % 2 === 0 ? '#F8FAFC' : '#FFFFFF');
            body += '<rect x="0" y="' + ry + '" width="' + svgW + '" height="' + rowH + '" fill="' + bg + '"/>';
            if (isCagr) body += '<line x1="0" y1="' + ry + '" x2="' + svgW + '" y2="' + ry + '" stroke="#CBD5E1" stroke-width="1.5"/>';
            cells.forEach(function(cell, ci) {
                var anchor = ci === 0 ? 'start' : 'end';
                var x = ci === 0 ? 6 : colW0 + colWRest * (ci - 1) + colWRest - 6;
                var fw = (isCagr || ci === 0) ? '700' : '400';
                var fill = isCagr ? '#2563EB' : '#0F172A';
                body += '<text x="' + x + '" y="' + (ry + rowH / 2 + 5) + '" text-anchor="' + anchor + '" fill="' + fill + '" font-weight="' + fw + '" font-size="12">' + cell + '</text>';
            });
            // bottom border
            body += '<line x1="0" y1="' + (ry + rowH) + '" x2="' + svgW + '" y2="' + (ry + rowH) + '" stroke="#E2E8F0" stroke-width="0.5"/>';
        });
        // Table border
        body += '<rect x="0" y="0" width="' + svgW + '" height="' + tblH + '" fill="none" stroke="#CBD5E1" stroke-width="1" rx="4"/>';

        // Bar chart (think-cell стиль: подписи прироста между столбцами + плашка CAGR)
        if (barH > 0) {
            var vals = years.map(function(y) { return round2(byYear[y].weight / 1000); });
            var maxV = Math.max.apply(null, vals) || 1;
            var barTop = tblH + 16;
            var bPad = { l: 8, r: 8, b: 28, t: 34 };
            var bInnerW = svgW - bPad.l - bPad.r;
            var bInnerH = barH - bPad.t - bPad.b;
            var slot = bInnerW / years.length;
            var bW = Math.min(60, slot * 0.6);
            var centers = [];
            years.forEach(function(y, i) {
                var v = vals[i];
                var bh = Math.max(2, (v / maxV) * bInnerH);
                var bx = bPad.l + slot * i + (slot - bW) / 2;
                var by2 = barTop + bPad.t + bInnerH - bh;
                centers.push({ x: bx + bW / 2, topY: by2, v: v });
                body += '<rect x="' + bx + '" y="' + by2 + '" width="' + bW + '" height="' + bh + '" fill="#2563EB" rx="2"/>';
                body += '<text x="' + (bx + bW / 2) + '" y="' + (by2 - 4) + '" text-anchor="middle" font-size="10" fill="#0F172A">' + formatNumber(v) + '</text>';
                body += '<text x="' + (bx + bW / 2) + '" y="' + (barTop + bPad.t + bInnerH + 16) + '" text-anchor="middle" font-size="10" fill="#64748B">' + y + '</text>';
            });
            // Проценты прироста между соседними столбцами
            for (var ci = 1; ci < centers.length; ci++) {
                var prev = centers[ci - 1], cur = centers[ci];
                if (prev.v > 0) {
                    var pct = Math.round((cur.v - prev.v) / prev.v * 100);
                    var y1 = prev.topY - 14, y2 = cur.topY - 14;
                    body += '<line x1="' + prev.x + '" y1="' + y1 + '" x2="' + cur.x + '" y2="' + y2 + '" stroke="#CBD5E1" stroke-width="1" stroke-dasharray="3,2"/>';
                    var sign = pct > 0 ? '+' : '';
                    var pctColor = pct >= 0 ? '#16A34A' : '#DC2626';
                    body += '<text x="' + ((prev.x + cur.x) / 2) + '" y="' + (Math.min(y1, y2) - 4) + '" text-anchor="middle" font-size="9" font-weight="700" fill="' + pctColor + '">' + sign + pct + '%</text>';
                }
            }
            // Плашка CAGR
            if (cagrW !== null) {
                var badgeW = 84, badgeH = 20, badgeX = svgW - badgeW - 6, badgeY = barTop;
                body += '<rect x="' + badgeX + '" y="' + badgeY + '" width="' + badgeW + '" height="' + badgeH + '" rx="4" fill="#EFF6FF" stroke="#2563EB" stroke-width="1"/>';
                body += '<text x="' + (badgeX + badgeW / 2) + '" y="' + (badgeY + 14) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#2563EB">CAGR ' + round2(cagrW) + '%</text>';
            }
        }

        body += '</svg>';

        return slideWrapper(slide.title || '\u041e\u0431\u044a\u0451\u043c\u044b \u0438 \u0441\u0442\u043e\u0438\u043c\u043e\u0441\u0442\u044c', body, { commentary: slide.opts && slide.opts.commentary });
    }

    // --- Объёмы по странам (pivot) ---
    function renderPresCountries(data, headers, slide) {
        var countryCol = findColumn(headers, '\u0421\u0442\u0440\u0430\u043d\u0430 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044f') || findColumn(headers, '\u0421\u0442\u0440\u0430\u043d\u0430 \u043f\u0440\u043e\u0438\u0441\u0445\u043e\u0436\u0434\u0435\u043d\u0438\u044f');
        var weightCol = findColumn(headers, COL_WEIGHT);
        var yearCol = findColumn(headers, COL_YEAR);
        if (!countryCol || !weightCol || !yearCol || data.length === 0) return presNoData(slide.title);

        var topN = slide.topN || 10;
        var byCountryYear = {};
        var totalByCountry = {};
        data.forEach(function (row) {
            var c = String(row[countryCol] || '').trim();
            var y = String(row[yearCol] || '').trim();
            if (!c || !y) return;
            var v = Number(row[weightCol]) || 0;
            if (!byCountryYear[c]) byCountryYear[c] = {};
            byCountryYear[c][y] = (byCountryYear[c][y] || 0) + v;
            totalByCountry[c] = (totalByCountry[c] || 0) + v;
        });

        var countries = Object.keys(totalByCountry).sort(function (a, b) { return totalByCountry[b] - totalByCountry[a]; }).slice(0, topN);
        var years = [];
        data.forEach(function (row) { var y = String(row[yearCol] || '').trim(); if (y && years.indexOf(y) === -1) years.push(y); });
        years.sort();
        if (countries.length === 0) return presNoData(slide.title);

        var totalByYear = {};
        years.forEach(function (y) { totalByYear[y] = 0; countries.forEach(function (c) { totalByYear[y] += (byCountryYear[c] && byCountryYear[c][y]) || 0; }); });
        var grandTotal = countries.reduce(function (s, c) { return s + totalByCountry[c]; }, 0);

        // SVG-таблица: страна + по годам
        var svgW = 880;
        var rowH = 22, headH = 28;
        var leader = countries[0];
        var extraRows = 1 + (leader ? 1 : 0); // ИТОГО + Доля лидера
        var totalRows = countries.length + extraRows;
        var col0W = Math.min(220, Math.max(120, svgW * 0.28));
        var colYW = Math.floor((svgW - col0W) / years.length);
        var tblH = headH + totalRows * rowH + 4;

        var body = '<svg width="' + svgW + '" height="' + tblH + '" viewBox="0 0 ' + svgW + ' ' + tblH + '">';
        body += '<style>text{font-family:DejaVu Sans,sans-serif;font-size:11px}</style>';

        // Header
        body += '<rect x="0" y="0" width="' + svgW + '" height="' + headH + '" fill="#1E3A5F" rx="4"/>';
        body += '<text x="6" y="' + (headH / 2 + 5) + '" fill="#FFFFFF" font-weight="700" font-size="11">\u0421\u0442\u0440\u0430\u043d\u0430 (\u043a\u0433)</text>';
        years.forEach(function(y, yi) {
            var x = col0W + colYW * yi + colYW / 2;
            body += '<text x="' + x + '" y="' + (headH / 2 + 5) + '" text-anchor="middle" fill="#FFFFFF" font-weight="700" font-size="11">' + y + '</text>';
        });

        // Country rows
        countries.forEach(function(c, ri) {
            var ry = headH + ri * rowH;
            var bg = ri % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
            body += '<rect x="0" y="' + ry + '" width="' + svgW + '" height="' + rowH + '" fill="' + bg + '"/>';
            var label = c.length > 28 ? c.slice(0, 27) + '\u2026' : c;
            body += '<text x="6" y="' + (ry + rowH / 2 + 4) + '" fill="#0F172A" font-size="11">' + label + '</text>';
            years.forEach(function(y, yi) {
                var v = (byCountryYear[c] && byCountryYear[c][y]) || 0;
                var x = col0W + colYW * yi + colYW - 6;
                body += '<text x="' + x + '" y="' + (ry + rowH / 2 + 4) + '" text-anchor="end" fill="#0F172A" font-size="11">' + formatNumber(Math.round(v)) + '</text>';
            });
            body += '<line x1="0" y1="' + (ry + rowH) + '" x2="' + svgW + '" y2="' + (ry + rowH) + '" stroke="#E2E8F0" stroke-width="0.5"/>';
        });

        // ИТОГО row
        var totRy = headH + countries.length * rowH;
        body += '<rect x="0" y="' + totRy + '" width="' + svgW + '" height="' + rowH + '" fill="#EFF6FF"/>';
        body += '<line x1="0" y1="' + totRy + '" x2="' + svgW + '" y2="' + totRy + '" stroke="#CBD5E1" stroke-width="1.5"/>';
        body += '<text x="6" y="' + (totRy + rowH / 2 + 4) + '" fill="#2563EB" font-weight="700" font-size="11">\u0418\u0422\u041e\u0413\u041e</text>';
        years.forEach(function(y, yi) {
            var x = col0W + colYW * yi + colYW - 6;
            body += '<text x="' + x + '" y="' + (totRy + rowH / 2 + 4) + '" text-anchor="end" fill="#2563EB" font-weight="700" font-size="11">' + formatNumber(Math.round(totalByYear[y])) + '</text>';
        });

        // Доля лидера
        if (leader) {
            var shareRy = totRy + rowH;
            body += '<rect x="0" y="' + shareRy + '" width="' + svgW + '" height="' + rowH + '" fill="#F8FAFC"/>';
            var shareLabel = ('\u0414\u043e\u043b\u044f ' + leader + ', %');
            if (shareLabel.length > 35) shareLabel = shareLabel.slice(0, 34) + '\u2026';
            body += '<text x="6" y="' + (shareRy + rowH / 2 + 4) + '" fill="#64748B" font-size="11">' + shareLabel + '</text>';
            years.forEach(function(y, yi) {
                var total = totalByYear[y];
                var lv = (byCountryYear[leader] && byCountryYear[leader][y]) || 0;
                var val = total > 0 ? round2(lv / total * 100) + '%' : '\u2014';
                var x = col0W + colYW * yi + colYW - 6;
                body += '<text x="' + x + '" y="' + (shareRy + rowH / 2 + 4) + '" text-anchor="end" fill="#64748B" font-size="11">' + val + '</text>';
            });
        }
        body += '<rect x="0" y="0" width="' + svgW + '" height="' + tblH + '" fill="none" stroke="#CBD5E1" stroke-width="1" rx="4"/>';
        body += '</svg>';

        return slideWrapper(slide.title || '\u041e\u0431\u044a\u0451\u043c\u044b \u043f\u043e \u0441\u0442\u0440\u0430\u043d\u0430\u043c', body, { commentary: slide.opts && slide.opts.commentary });
    }

    // --- Динамика цен по странам (USD/кг) ---
    function renderPresPriceDynamics(data, headers, slide) {
        var statUsdCol = findColumn(headers, COL_STAT_USD);
        var weightCol = findColumn(headers, COL_WEIGHT);
        var countryCol = findColumn(headers, '\u0421\u0442\u0440\u0430\u043d\u0430 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044f') || findColumn(headers, '\u0421\u0442\u0440\u0430\u043d\u0430 \u043f\u0440\u043e\u0438\u0441\u0445\u043e\u0436\u0434\u0435\u043d\u0438\u044f');
        var yearCol = findColumn(headers, COL_YEAR);
        if (!statUsdCol || !weightCol || !countryCol || !yearCol || data.length === 0) return presNoData(slide.title);

        var topN = slide.topN || 10;
        var byCY = {};
        var totalW = {};
        data.forEach(function (row) {
            var c = String(row[countryCol] || '').trim();
            var y = String(row[yearCol] || '').trim();
            if (!c || !y) return;
            var w = Number(row[weightCol]) || 0;
            var u = Number(row[statUsdCol]) || 0;
            var k = c + '|' + y;
            if (!byCY[k]) byCY[k] = { usd: 0, weight: 0 };
            byCY[k].usd += u;
            byCY[k].weight += w;
            totalW[c] = (totalW[c] || 0) + w;
        });

        var countries = Object.keys(totalW).sort(function (a, b) { return totalW[b] - totalW[a]; }).slice(0, topN);
        var yearsSet = {};
        data.forEach(function (row) { var y = String(row[yearCol] || '').trim(); if (y) yearsSet[y] = true; });
        var years = Object.keys(yearsSet).sort();
        if (countries.length === 0 || years.length === 0) return presNoData(slide.title);

        // Price data
        var priceData = {};
        countries.forEach(function (c) {
            priceData[c] = {};
            years.forEach(function (y) {
                var d = byCY[c + '|' + y];
                if (d && d.weight > 0) priceData[c][y] = round2(d.usd / d.weight);
            });
        });

        // Chart
        var allVals = [];
        countries.forEach(function (c) { years.forEach(function (y) { if (priceData[c][y] != null) allVals.push(priceData[c][y]); }); });
        if (allVals.length === 0) return presNoData(slide.title);

        var minV = Math.min.apply(null, allVals);
        var maxV = Math.max.apply(null, allVals);
        var range = maxV - minV || 1;
        var yMin = Math.max(0, minV - range * 0.15);
        var yMax = maxV + range * 0.15;
        var yRange = yMax - yMin;

        var cW = 580, cH = 360, pad = { top: 20, right: 200, bottom: 30, left: 50 };
        var innerW = cW - pad.left - pad.right;
        var innerH = cH - pad.top - pad.bottom;
        var xPadPD = innerW * 0.06;
        var plotWPD = innerW - xPadPD * 2;
        var xStep = years.length > 1 ? plotWPD / (years.length - 1) : plotWPD / 2;

        var body = '<svg width="' + cW + '" height="' + cH + '" viewBox="0 0 ' + cW + ' ' + cH + '">';
        body += '<style>text{font-family:DejaVu Sans,sans-serif}</style>';

        // Grid
        for (var t = 0; t <= 4; t++) {
            var yVal = round2(yMin + yRange * t / 4);
            var yPos = pad.top + innerH - (innerH * t / 4);
            body += '<line x1="' + pad.left + '" y1="' + yPos + '" x2="' + (pad.left + innerW) + '" y2="' + yPos + '" stroke="#E2E8F0" stroke-width="1"/>';
            body += '<text x="' + (pad.left - 6) + '" y="' + (yPos + 3) + '" text-anchor="end" font-size="8" fill="#64748B">' + formatNumber(yVal) + '</text>';
        }
        // X labels
        years.forEach(function (y, i) {
            body += '<text x="' + (pad.left + xPadPD + xStep * i) + '" y="' + (cH - 8) + '" text-anchor="middle" font-size="8" fill="#64748B">' + y + '</text>';
        });

        // Lines
        countries.forEach(function (c, ci) {
            var color = LINE_COLORS[ci % LINE_COLORS.length];
            var pts = [];
            years.forEach(function (y, yi) {
                if (priceData[c][y] != null) {
                    pts.push({ x: pad.left + xPadPD + xStep * yi, y: pad.top + innerH - ((priceData[c][y] - yMin) / yRange) * innerH });
                }
            });
            if (pts.length >= 2) {
                var d = 'M' + pts[0].x + ',' + pts[0].y;
                for (var pi = 1; pi < pts.length; pi++) d += ' L' + pts[pi].x + ',' + pts[pi].y;
                body += '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2"/>';
            }
            pts.forEach(function (p) { body += '<circle cx="' + p.x + '" cy="' + p.y + '" r="3" fill="' + color + '"/>'; });

            // Legend
            var ly = pad.top + ci * 16;
            body += '<rect x="' + (pad.left + innerW + 10) + '" y="' + ly + '" width="10" height="10" fill="' + color + '" rx="2"/>';
            var lbl = c.length > 18 ? c.substring(0, 16) + '..' : c;
            body += '<text x="' + (pad.left + innerW + 24) + '" y="' + (ly + 9) + '" font-size="8" fill="#0F172A">' + lbl + '</text>';
        });

        body += '</svg>';

        return slideWrapper(slide.title || '\u0414\u0438\u043d\u0430\u043c\u0438\u043a\u0430 \u0446\u0435\u043d \u043f\u043e \u0441\u0442\u0440\u0430\u043d\u0430\u043c, USD/\u043a\u0433', body, { commentary: slide.opts && slide.opts.commentary });
    }

    // --- Санки: Отправитель → Получатель ---
    function renderPresSankeySender(data, headers, slide) {
        var srcCol = findColumn(headers, COL_SENDER);
        var tgtCol = findColumn(headers, COL_RECEIVER);
        var valCol = findColumn(headers, COL_WEIGHT);
        var yearCol = findColumn(headers, COL_YEAR);
        if (!srcCol || !tgtCol || !valCol || data.length === 0) return presNoData(slide.title);

        // Filter by year if set
        var filtered = data;
        if (slide.year && yearCol) {
            filtered = data.filter(function (row) { return String(row[yearCol] || '').trim() === slide.year; });
        } else if (yearCol) {
            // Latest year
            var maxY = '';
            data.forEach(function (row) { var y = String(row[yearCol] || '').trim(); if (y > maxY) maxY = y; });
            if (maxY) filtered = data.filter(function (row) { return String(row[yearCol] || '').trim() === maxY; });
        }

        var topN = slide.topN || 10;
        var sankeyData = buildSankeyData(filtered, srcCol, tgtCol, valCol, topN);
        if (sankeyData.flows.length === 0) return presNoData(slide.title);

        var sankeyW = (slide.opts && slide.opts.commentary) ? 520 : 900;
        var body = renderSankeyDiagram(sankeyData, sankeyW, 440);
        return slideWrapper(slide.title || '\u0421\u0442\u0440\u0443\u043a\u0442\u0443\u0440\u0430: \u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u0435\u043b\u044c \u2192 \u041f\u043e\u043b\u0443\u0447\u0430\u0442\u0435\u043b\u044c', body, { commentary: slide.opts && slide.opts.commentary });
    }

    // --- Санки: Изготовитель → Получатель ---
    function renderPresSankeyManufacturer(data, headers, slide) {
        var srcCol = findColumn(headers, COL_MANUFACTURER);
        var tgtCol = findColumn(headers, COL_RECEIVER);
        var valCol = findColumn(headers, COL_WEIGHT);
        var yearCol = findColumn(headers, COL_YEAR);
        if (!srcCol || !tgtCol || !valCol || data.length === 0) return presNoData(slide.title);

        var filtered = data;
        if (slide.year && yearCol) {
            filtered = data.filter(function (row) { return String(row[yearCol] || '').trim() === slide.year; });
        } else if (yearCol) {
            var maxY = '';
            data.forEach(function (row) { var y = String(row[yearCol] || '').trim(); if (y > maxY) maxY = y; });
            if (maxY) filtered = data.filter(function (row) { return String(row[yearCol] || '').trim() === maxY; });
        }

        var topN = slide.topN || 10;
        var sankeyData = buildSankeyData(filtered, srcCol, tgtCol, valCol, topN);
        if (sankeyData.flows.length === 0) return presNoData(slide.title);

        var sankeyW = (slide.opts && slide.opts.commentary) ? 520 : 900;
        var body = renderSankeyDiagram(sankeyData, sankeyW, 440);
        return slideWrapper(slide.title || '\u0421\u0442\u0440\u0443\u043a\u0442\u0443\u0440\u0430: \u0418\u0437\u0433\u043e\u0442\u043e\u0432\u0438\u0442\u0435\u043b\u044c \u2192 \u041f\u043e\u043b\u0443\u0447\u0430\u0442\u0435\u043b\u044c', body, { commentary: slide.opts && slide.opts.commentary });
    }

    // --- Поквартальная динамика цен ---
    function renderPresQuarterlyPrices(data, headers, slide) {
        var weightCol = findColumn(headers, COL_WEIGHT);
        var statUsdCol = findColumn(headers, COL_STAT_USD);
        var rubCtx = buildRubCtx(headers);
        var hasRub = rubCtx.customsCol || rubCtx.invoiceRubCol || rubCtx.statUsdCol;
        var yearCol = findColumn(headers, COL_YEAR);
        var quarterCol = findColumn(headers, COL_QUARTER);
        if (!weightCol || (!statUsdCol && !hasRub) || !yearCol || !quarterCol || data.length === 0) return presNoData(slide.title);

        var byYQ = {};
        var yearsSet = {};
        data.forEach(function (row) {
            var y = String(row[yearCol] || '').trim();
            var q = String(row[quarterCol] || '').trim();
            if (!y || !q) return;
            yearsSet[y] = true;
            var k = y + '|' + q;
            if (!byYQ[k]) byYQ[k] = { usd: 0, rub: 0, weight: 0 };
            byYQ[k].weight += (Number(row[weightCol]) || 0);
            byYQ[k].usd += statUsdCol ? (Number(row[statUsdCol]) || 0) : 0;
            byYQ[k].rub += hasRub ? getRowRubValue(row, rubCtx) : 0;
        });

        var years = Object.keys(yearsSet).sort();
        var quarters = ['1', '2', '3', '4'];

        // Choose metric: prefer rub, then usd
        var metrics = [];
        if (hasRub) metrics.push({ key: 'rub', title: '\u0440\u0443\u0431./\u043a\u0433' });
        if (statUsdCol) metrics.push({ key: 'usd', title: 'USD/\u043a\u0433' });

        var body = '';
        metrics.forEach(function (m) {
            var allVals = [];
            years.forEach(function (y) {
                quarters.forEach(function (q) {
                    var d = byYQ[y + '|' + q];
                    if (d && d.weight > 0) {
                        var v = m.key === 'usd' ? d.usd / d.weight : d.rub / d.weight;
                        allVals.push(round2(v));
                    }
                });
            });
            if (allVals.length === 0) return;

            var minV = Math.min.apply(null, allVals);
            var maxV = Math.max.apply(null, allVals);
            var range = maxV - minV || 1;
            var yMin = Math.max(0, minV - range * 0.15);
            var yMax = maxV + range * 0.15;
            var yRange = yMax - yMin;

            var cW = 420, cH = 200, pad = { top: 16, right: 120, bottom: 24, left: 50 };
            var innerW = cW - pad.left - pad.right;
            var innerH = cH - pad.top - pad.bottom;
            // Горизонтальный отступ внутри области для Q1 и Q4 — равный с обоих сторон
            var xPad = innerW * 0.08;
            var plotW = innerW - xPad * 2;
            var xStep = plotW / 3;

            body += '<div style="display:inline-block;vertical-align:top;margin-right:12px">';
            body += '<div style="font-size:11px;font-weight:600;margin-bottom:4px">' + m.title + '</div>';
            body += '<svg width="' + cW + '" height="' + cH + '">';
            body += '<style>text{font-family:DejaVu Sans,sans-serif}</style>';

            // Grid
            for (var t = 0; t <= 3; t++) {
                var yVal = round2(yMin + yRange * t / 3);
                var yPos = pad.top + innerH - (innerH * t / 3);
                body += '<line x1="' + pad.left + '" y1="' + yPos + '" x2="' + (pad.left + innerW) + '" y2="' + yPos + '" stroke="#E2E8F0"/>';
                body += '<text x="' + (pad.left - 4) + '" y="' + (yPos + 3) + '" text-anchor="end" font-size="7" fill="#64748B">' + formatNumber(yVal) + '</text>';
            }
            quarters.forEach(function (q, qi) {
                body += '<text x="' + (pad.left + xPad + xStep * qi) + '" y="' + (cH - 6) + '" text-anchor="middle" font-size="8" fill="#64748B">Q' + q + '</text>';
            });

            years.forEach(function (y, yi) {
                var color = YEAR_COLORS[yi % YEAR_COLORS.length];
                var pts = [];
                quarters.forEach(function (q, qi) {
                    var d = byYQ[y + '|' + q];
                    if (d && d.weight > 0) {
                        var v = m.key === 'usd' ? d.usd / d.weight : d.rub / d.weight;
                        pts.push({ x: pad.left + xPad + xStep * qi, y: pad.top + innerH - ((round2(v) - yMin) / yRange) * innerH });
                    }
                });
                if (pts.length >= 2) {
                    var dp = 'M' + pts[0].x + ',' + pts[0].y;
                    for (var pi = 1; pi < pts.length; pi++) dp += ' L' + pts[pi].x + ',' + pts[pi].y;
                    body += '<path d="' + dp + '" fill="none" stroke="' + color + '" stroke-width="2"/>';
                }
                pts.forEach(function (p) { body += '<circle cx="' + p.x + '" cy="' + p.y + '" r="2.5" fill="' + color + '"/>'; });
                // Legend
                var ly = pad.top + yi * 14;
                body += '<rect x="' + (pad.left + innerW + 8) + '" y="' + ly + '" width="8" height="8" fill="' + color + '" rx="1"/>';
                body += '<text x="' + (pad.left + innerW + 20) + '" y="' + (ly + 8) + '" font-size="8" fill="#0F172A">' + y + '</text>';
            });
            body += '</svg></div>';
        });

        return slideWrapper(slide.title || '\u041f\u043e\u043a\u0432\u0430\u0440\u0442\u0430\u043b\u044c\u043d\u0430\u044f \u0434\u0438\u043d\u0430\u043c\u0438\u043a\u0430 \u0446\u0435\u043d', body, { commentary: slide.opts && slide.opts.commentary });
    }

    // --- Автоматические тексты для слайдов ---

    function computeSlideMetrics(type, data, headers, slide) {
        var m = { years: [], trend: 'stable' };
        var yearCol = findColumn(headers, COL_YEAR);
        var weightCol = findColumn(headers, COL_WEIGHT);
        var statUsdCol = findColumn(headers, COL_STAT_USD);
        var rubCtx = buildRubCtx(headers);
        var hasRub = rubCtx.customsCol || rubCtx.invoiceRubCol || rubCtx.statUsdCol;

        // Collect years
        if (yearCol) {
            var ySet = {};
            data.forEach(function (row) { var y = String(row[yearCol] || '').trim(); if (y) ySet[y] = true; });
            m.years = Object.keys(ySet).sort();
        }
        m.firstYear = m.years[0] || '';
        m.lastYear = m.years[m.years.length - 1] || '';

        if (type === 'volumes') {
            var byYear = {};
            data.forEach(function (row) {
                var y = String(row[yearCol] || '').trim();
                if (!y) return;
                if (!byYear[y]) byYear[y] = { w: 0, u: 0, r: 0 };
                byYear[y].w += (Number(row[weightCol]) || 0);
                byYear[y].u += (Number(row[statUsdCol]) || 0);
                byYear[y].r += hasRub ? getRowRubValue(row, rubCtx) : 0;
            });
            var ys = m.years;
            if (ys.length >= 2) {
                var n = ys.length - 1;
                m.cagrWeight = presCalcCAGR(byYear[ys[0]].w, byYear[ys[n]].w, n);
                m.cagrUsd = presCalcCAGR(byYear[ys[0]].u, byYear[ys[n]].u, n);
                m.cagrRub = hasRub ? presCalcCAGR(byYear[ys[0]].r, byYear[ys[n]].r, n) : null;
            }
            var last = byYear[m.lastYear] || {};
            var first = byYear[m.firstYear] || {};
            m.latestWeight = round2((last.w || 0) / 1000);
            m.latestUsd = round2((last.u || 0) / 1000);
            m.latestRub = round2((last.r || 0) / 1000);
            // Значения первого и последнего года — для формулировок «выросли с X до Y»
            m.firstWeight = round2((first.w || 0) / 1000);
            m.lastWeight = m.latestWeight;
            m.firstUsd = round2((first.u || 0) / 1000);
            m.lastUsd = m.latestUsd;
            m.firstRub = round2((first.r || 0) / 1000);
            m.lastRub = m.latestRub;
            m.totalWeight = round2(Object.keys(byYear).reduce(function (s, y) { return s + byYear[y].w; }, 0) / 1000);
            m.totalUsd = round2(Object.keys(byYear).reduce(function (s, y) { return s + byYear[y].u; }, 0) / 1000);
            if (m.cagrWeight > 1) m.trend = 'growth';
            else if (m.cagrWeight < -1) m.trend = 'decline';
        }

        if (type === 'countries' || type === 'price-dynamics') {
            var countryCol = findColumn(headers, '\u0421\u0442\u0440\u0430\u043d\u0430 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044f') || findColumn(headers, '\u0421\u0442\u0440\u0430\u043d\u0430 \u043f\u0440\u043e\u0438\u0441\u0445\u043e\u0436\u0434\u0435\u043d\u0438\u044f');
            if (countryCol && weightCol) {
                var totalByC = {};
                var grand = 0;
                data.forEach(function (row) {
                    var c = String(row[countryCol] || '').trim();
                    var w = Number(row[weightCol]) || 0;
                    if (c) { totalByC[c] = (totalByC[c] || 0) + w; grand += w; }
                });
                var sorted = Object.keys(totalByC).sort(function (a, b) { return totalByC[b] - totalByC[a]; });
                var topN = slide.topN || 10;
                m.leader = sorted[0] || '';
                m.leaderShare = grand > 0 ? round2(totalByC[m.leader] / grand * 100) : 0;
                m.topN = topN;
                var topSum = sorted.slice(0, topN).reduce(function (s, c) { return s + totalByC[c]; }, 0);
                m.topCoverage = grand > 0 ? round2(topSum / grand * 100) : 0;
                m.countriesCount = sorted.length;
                m.secondName = sorted[1] || '';
                m.secondShare = (grand > 0 && sorted[1]) ? round2(totalByC[sorted[1]] / grand * 100) : 0;
            }
            if (type === 'price-dynamics' && statUsdCol && weightCol) {
                var prices = [];
                var byCY = {};
                // Только топ-N стран — как в реальном рендерере графика
                var topCountriesSet = {};
                sorted.slice(0, topN).forEach(function(c) { topCountriesSet[c] = true; });
                data.forEach(function (row) {
                    var c = String(row[countryCol] || '').trim();
                    var y = String(row[yearCol] || '').trim();
                    if (!c || !y || !topCountriesSet[c]) return;
                    var k = c + '|' + y;
                    if (!byCY[k]) byCY[k] = { u: 0, w: 0 };
                    byCY[k].u += (Number(row[statUsdCol]) || 0);
                    byCY[k].w += (Number(row[weightCol]) || 0);
                });
                // Порог: группа страна×год должна иметь вес >= 100 кг (исключить аномалии)
                Object.keys(byCY).forEach(function (k) { var d = byCY[k]; if (d.w >= 100) prices.push(round2(d.u / d.w)); });
                if (prices.length > 0) {
                    m.priceMin = round2(Math.min.apply(null, prices));
                    m.priceMax = round2(Math.max.apply(null, prices));
                }
            }
        }

        if (type === 'sankey-sender' || type === 'sankey-manufacturer') {
            var srcCol = type === 'sankey-sender' ? findColumn(headers, COL_SENDER) : findColumn(headers, COL_MANUFACTURER);
            var tgtCol = findColumn(headers, COL_RECEIVER);
            if (srcCol && tgtCol && weightCol) {
                var filtered = data;
                if (slide.year && yearCol) {
                    filtered = data.filter(function (row) { return String(row[yearCol] || '').trim() === slide.year; });
                }
                var topN = slide.topN || 10;
                var sd = buildSankeyData(filtered, srcCol, tgtCol, weightCol, topN);
                m.leader = sd.sources.length > 0 ? sd.sources[0].name : '';
                // total — в кг (вес нетто); в тексте показываем в тоннах
                m.leaderVolume = sd.sources.length > 0 ? Math.round(sd.sources[0].total / 1000) : 0;
                var totalFlow = sd.flows.reduce(function (s, f) { return s + f.value; }, 0);
                m.topN = topN;
                m.year = slide.year || m.lastYear;
                m.sourceLabel = type === 'sankey-sender' ? '\u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u0435\u043b\u0435\u0439' : '\u0438\u0437\u0433\u043e\u0442\u043e\u0432\u0438\u0442\u0435\u043b\u0435\u0439';
                m.targetCount = sd.targets.length;
                m.topTarget = sd.targets.length > 0 ? sd.targets[0].name : '';
            }
        }

        if (type === 'segments') {
            var segCol2 = findAnyColumn(headers, SEGMENT_COLS);
            var wCol2 = findAnyColumn(headers, WEIGHT_COLS);
            if (segCol2 && wCol2) {
                var bySegY = {}, totY = {}, segTot = {};
                data.forEach(function (row) {
                    var y = String(row[yearCol] || '').trim();
                    var sg = String(row[segCol2] || '').trim() || 'Прочее';
                    var w = Number(row[wCol2]) || 0;
                    if (!y || w <= 0) return;
                    if (!bySegY[sg]) bySegY[sg] = {};
                    bySegY[sg][y] = (bySegY[sg][y] || 0) + w;
                    totY[y] = (totY[y] || 0) + w;
                    segTot[sg] = (segTot[sg] || 0) + w;
                });
                var sortedSegs = Object.keys(segTot).sort(function (a, b) { return segTot[b] - segTot[a]; });
                var grandTot = Object.keys(segTot).reduce(function (s2, k) { return s2 + segTot[k]; }, 0);
                m.leadSegment = sortedSegs[0] || '';
                m.leadSegmentShare = grandTot > 0 ? round2(segTot[m.leadSegment] / grandTot * 100) : 0;
                m.segmentsCount = sortedSegs.length;
                if (m.firstYear && m.lastYear && m.leadSegment) {
                    var f = totY[m.firstYear] > 0 ? (bySegY[m.leadSegment][m.firstYear] || 0) / totY[m.firstYear] * 100 : null;
                    var l = totY[m.lastYear] > 0 ? (bySegY[m.leadSegment][m.lastYear] || 0) / totY[m.lastYear] * 100 : null;
                    if (f != null) m.leadShareFirst = round2(f);
                    if (l != null) m.leadShareLast = round2(l);
                }
                // сегмент с наибольшим приростом доли
                var bestGrow = null;
                sortedSegs.forEach(function (sg) {
                    if (!m.firstYear || !m.lastYear) return;
                    var f2 = totY[m.firstYear] > 0 ? (bySegY[sg][m.firstYear] || 0) / totY[m.firstYear] * 100 : 0;
                    var l2 = totY[m.lastYear] > 0 ? (bySegY[sg][m.lastYear] || 0) / totY[m.lastYear] * 100 : 0;
                    var d2 = l2 - f2;
                    if (bestGrow === null || d2 > bestGrow.delta) bestGrow = { seg: sg, delta: round2(d2), from: round2(f2), to: round2(l2) };
                });
                if (bestGrow && bestGrow.delta > 1) m.growSegment = bestGrow;
            }
        }

        if (type === 'market-changes') {
            var marketDims = marketDimensionOptions(headers);
            if (marketDims.length) {
                var marketHs = marketDims.filter(function (d) { return d.type === 'hs'; })[0];
                var marketMetric = weightCol ? 'weight' : (statUsdCol ? 'usd' : 'count');
                var marketResult = computeMarketChanges(data, headers, {
                    granularity: 'year',
                    dimension: marketHs ? marketHs.column : marketDims[0].column,
                    hsLevel: 4,
                    metric: marketMetric,
                    threshold: 0
                });
                if (!marketResult.error) {
                    m.marketBasePeriod = marketResult.basePeriod;
                    m.marketCurrentPeriod = marketResult.currentPeriod;
                    m.marketMetric = marketResult.metric;
                    m.marketDelta = marketResult.totalDelta;
                    m.marketPct = marketResult.totalPct;
                    m.marketNewCount = marketResult.added.length;
                    m.marketGoneCount = marketResult.disappeared.length;
                    m.marketGrowthLeader = marketResult.growth[0] || marketResult.added[0] || null;
                    m.marketDeclineLeader = marketResult.decline[0] || marketResult.disappeared[0] || null;
                }
            }
        }

        if (type === 'quarterly-prices') {
            var quarterCol = findColumn(headers, COL_QUARTER);
            var byYQ = {};
            data.forEach(function (row) {
                var y = String(row[yearCol] || '').trim();
                var q = String(row[quarterCol] || '').trim();
                if (!y || !q) return;
                var k = y + '|' + q;
                if (!byYQ[k]) byYQ[k] = { u: 0, r: 0, w: 0 };
                byYQ[k].w += (Number(row[weightCol]) || 0);
                byYQ[k].u += statUsdCol ? (Number(row[statUsdCol]) || 0) : 0;
                byYQ[k].r += hasRub ? getRowRubValue(row, rubCtx) : 0;
            });
            var usdPrices = [];
            var rubPrices = [];
            Object.keys(byYQ).forEach(function (k) {
                var d = byYQ[k];
                if (d.w > 0) {
                    if (statUsdCol) usdPrices.push(round2(d.u / d.w));
                    if (hasRub) rubPrices.push(round2(d.r / d.w));
                }
            });
            if (usdPrices.length > 0) {
                m.usdMin = round2(Math.min.apply(null, usdPrices));
                m.usdMax = round2(Math.max.apply(null, usdPrices));
                m.usdAvg = round2(usdPrices.reduce(function (s, v) { return s + v; }, 0) / usdPrices.length);
            }
            if (rubPrices.length > 0) {
                m.rubMin = round2(Math.min.apply(null, rubPrices));
                m.rubMax = round2(Math.max.apply(null, rubPrices));
                m.rubAvg = round2(rubPrices.reduce(function (s, v) { return s + v; }, 0) / rubPrices.length);
            }
        }

        return m;
    }

    // --- Помощники для детерминированной генерации текста (без ИИ) ---
    // Число в русском формате: разделитель тысяч — пробел, десятичный — запятая
    function presRuNum(n, digits) {
        if (n == null || isNaN(n)) return '—';
        var str = (digits != null ? Number(n).toFixed(digits) : String(round2(n))).replace('.', ',');
        var parts = str.split(',');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        return parts.join(',');
    }
    // Подбор удобной единицы для веса (вход — тонны)
    function presWeightUnit(tonnes) {
        if (Math.abs(tonnes) >= 1000) return { div: 1000, unit: 'тыс. тонн', d: 1 };
        return { div: 1, unit: 'тонн', d: 0 };
    }
    // Качественная характеристика тренда по величине CAGR
    function presTrendPhrase(cagr) {
        if (cagr == null) return { adj: 'стабильную динамику', dir: 'stable' };
        if (cagr >= 25) return { adj: 'бурный рост', dir: 'up' };
        if (cagr >= 8)  return { adj: 'устойчивый рост', dir: 'up' };
        if (cagr > 1)   return { adj: 'умеренный рост', dir: 'up' };
        if (cagr < -8)  return { adj: 'заметное сокращение', dir: 'down' };
        if (cagr < -1)  return { adj: 'сокращение', dir: 'down' };
        return { adj: 'стабильные объёмы', dir: 'stable' };
    }
    // Заголовок-вывод (action title) из метрик. '' если данных мало.
    function generateActionTitle(type, m) {
        var product = (m.product || '').trim();
        var subj = product ? 'Импорт ' + product : 'Импорт';
        var of = product ? ' ' + product : '';
        var period = (m.firstYear && m.lastYear) ? m.firstYear + '–' + m.lastYear : '';

        if (type === 'volumes' && m.cagrWeight != null) {
            var t = presTrendPhrase(m.cagrWeight);
            if (t.dir === 'up' && m.cagrUsd != null) {
                return subj + ' демонстрирует ' + t.adj + ': за ' + period +
                    ' поставки выросли на ' + presRuNum(Math.round(m.cagrWeight)) +
                    '% в натуральном и на ' + presRuNum(Math.round(m.cagrUsd)) +
                    '% в долларовом выражении';
            }
            if (t.dir === 'down') {
                return subj + ': за ' + period + ' наблюдается ' + t.adj +
                    ' физических объёмов (CAGR ' + presRuNum(Math.round(m.cagrWeight)) + '%)';
            }
            return subj + ' за ' + period + ' сохраняет ' + t.adj;
        }

        if (type === 'countries' && m.leader) {
            if (m.leaderShare >= 70) {
                return m.leader + ' — абсолютный лидер поставок' + of + ', формируя ' + presRuNum(m.leaderShare, 1) + '% импорта в натуральном выражении';
            }
            if (m.leaderShare >= 40) {
                return m.leader + ' доминирует в поставках' + of + ' (' + presRuNum(m.leaderShare, 1) + '% объёма) при высокой концентрации рынка';
            }
            return 'Поставки' + of + ' диверсифицированы: ни одна страна не превышает ' + presRuNum(m.leaderShare, 1) + '%, риски по отдельным направлениям снижены';
        }

        if (type === 'price-dynamics' && m.priceMin != null) {
            return 'Цены на импорт' + of + ' варьируются от ' + presRuNum(m.priceMin, 1) + ' до ' + presRuNum(m.priceMax, 1) + ' USD/кг в зависимости от страны происхождения';
        }

        if ((type === 'sankey-sender' || type === 'sankey-manufacturer') && m.leader) {
            var srcWord = type === 'sankey-manufacturer' ? 'производителей' : 'поставщиков';
            return 'В ' + (m.year || m.lastYear) + ' году импорт' + of + ' концентрирован: крупнейший из ' + srcWord + ' — ' + m.leader + ' (' + presRuNum(m.leaderVolume) + ' тонн)';
        }

        if (type === 'segments' && m.leadSegment) {
            if (m.growSegment && m.growSegment.seg) {
                return 'Структура потребления' + of + ' смещается в сторону «' + m.growSegment.seg +
                    '»: доля выросла с ' + presRuNum(m.growSegment.from, 1) + '% до ' + presRuNum(m.growSegment.to, 1) + '%';
            }
            return 'Основной канал сбыта' + of + ' — «' + m.leadSegment + '» (' + presRuNum(m.leadSegmentShare, 1) +
                '% объёма); всего задействовано ' + (m.segmentsCount || '?') + ' сегментов';
        }

        if (type === 'quarterly-prices' && m.usdMin != null) {
            return 'Поквартальная цена импорта' + of + ' колебалась в диапазоне ' + presRuNum(m.usdMin, 1) + '–' + presRuNum(m.usdMax, 1) + ' USD/кг';
        }

        if (type === 'market-changes' && m.marketBasePeriod) {
            var marketDirection = m.marketDelta >= 0 ? 'вырос' : 'снизился';
            var marketPct = m.marketPct == null ? '' : ' на ' + presRuNum(Math.abs(m.marketPct), 1) + '%';
            return subj + ' ' + marketDirection + marketPct + ': ' + m.marketNewCount +
                ' новых и ' + m.marketGoneCount + ' исчезнувших позиций';
        }

        return '';
    }

    function generateTemplateText(type, m) {
        var lines = [];
        var trendWord = m.trend === 'growth' ? '\u0443\u0441\u0442\u043e\u0439\u0447\u0438\u0432\u044b\u0439 \u0440\u043e\u0441\u0442' : m.trend === 'decline' ? '\u0441\u043d\u0438\u0436\u0435\u043d\u0438\u0435' : '\u0441\u0442\u0430\u0431\u0438\u043b\u044c\u043d\u0443\u044e \u0434\u0438\u043d\u0430\u043c\u0438\u043a\u0443';

        if (type === 'volumes') {
            var t = presTrendPhrase(m.cagrWeight);
            // 1. Натуральный объём: «вырос с X до Y тыс. тонн (CAGR N%)»
            if (m.firstWeight != null && m.lastWeight != null) {
                var wu = presWeightUnit(Math.max(Math.abs(m.firstWeight), Math.abs(m.lastWeight)));
                var verb = t.dir === 'down' ? 'снизился' : (t.dir === 'up' ? 'вырос' : 'изменился');
                var l1 = 'Натуральный объём импорта ' + verb +
                    ' с ' + presRuNum(m.firstWeight / wu.div, wu.d) + ' до ' + presRuNum(m.lastWeight / wu.div, wu.d) + ' ' + wu.unit;
                if (m.cagrWeight != null) l1 += ' (CAGR ' + presRuNum(Math.round(m.cagrWeight)) + '%)';
                lines.push(l1 + '.');
            }
            // 2. Долларовая vs натуральная динамика → вывод про среднюю цену
            if (m.cagrUsd != null && m.cagrWeight != null) {
                var l2;
                if (m.cagrUsd < m.cagrWeight - 2) {
                    l2 = 'Рост в долларах (' + presRuNum(Math.round(m.cagrUsd)) + '%) отстаёт от физического (' + presRuNum(Math.round(m.cagrWeight)) + '%) — средняя цена закупки снижается';
                } else if (m.cagrUsd > m.cagrWeight + 2) {
                    l2 = 'Рост в долларах (' + presRuNum(Math.round(m.cagrUsd)) + '%) опережает физический (' + presRuNum(Math.round(m.cagrWeight)) + '%) — средняя цена закупки растёт';
                } else {
                    l2 = 'Долларовая стоимость (' + presRuNum(Math.round(m.cagrUsd)) + '%) растёт соразмерно объёму, средняя цена стабильна';
                }
                lines.push(l2 + '.');
            }
            // 3. Рублёвая динамика → валютный фактор
            if (m.cagrRub != null && m.cagrUsd != null) {
                var l3;
                if (m.cagrRub > m.cagrUsd + 2) {
                    l3 = 'Рублёвая стоимость растёт быстрее (CAGR ' + presRuNum(Math.round(m.cagrRub)) + '%) из-за ослабления курса, это давит на себестоимость для импортёров';
                } else {
                    l3 = 'Рублёвая стоимость (CAGR ' + presRuNum(Math.round(m.cagrRub)) + '%) отражает динамику долларовых цен и курса';
                }
                lines.push(l3 + '.');
            }
        }

        if (type === 'countries') {
            if (m.leader) {
                lines.push('Ведущий поставщик — ' + m.leader + ' с долей ' + presRuNum(m.leaderShare, 1) + '% от общего объёма импорта.');
            }
            if (m.leaderShare != null) {
                var c;
                if (m.leaderShare >= 70) c = 'Рынок зависит от одного поставщика, что создаёт логистические и ценовые риски';
                else if (m.leaderShare >= 40) c = 'Концентрация высокая: лидер формирует основную часть поставок';
                else c = 'Структура диверсифицирована, зависимость от отдельных стран умеренная';
                if (m.secondName) c += ' (второй по объёму — ' + m.secondName + ', ' + presRuNum(m.secondShare, 1) + '%)';
                lines.push(c + '.');
            }
            if (m.topCoverage) {
                lines.push('ТОП-' + m.topN + ' стран обеспечивают ' + presRuNum(m.topCoverage, 1) + '% поставок; всего в импорте участвует ' + (m.countriesCount || '?') + ' стран.');
            }
        }

        if (type === 'price-dynamics') {
            if (m.priceMin != null) {
                lines.push('Средневзвешенная цена варьируется от ' + presRuNum(m.priceMin, 1) + ' до ' + presRuNum(m.priceMax, 1) + ' USD/кг в зависимости от страны происхождения.');
                var spread = m.priceMin > 0 ? round2((m.priceMax - m.priceMin) / m.priceMin * 100) : 0;
                if (spread >= 30) {
                    lines.push('Разброс цен между странами значительный (' + presRuNum(Math.round(spread)) + '%), поэтому выбор поставщика существенно влияет на закупочную стоимость.');
                }
            }
            if (m.leader) {
                lines.push(m.leader + ' как основной поставщик (' + presRuNum(m.leaderShare, 1) + '% объёма) задаёт ценовой ориентир рынка.');
            }
        }

        if (type === 'sankey-sender' || type === 'sankey-manufacturer') {
            var srcWord = m.sourceLabel || 'поставщиков';
            if (m.leader) {
                lines.push('Крупнейший из ' + srcWord + ' в ' + (m.year || m.lastYear) + ' году — ' + m.leader + ' (' + presRuNum(m.leaderVolume) + ' тонн).');
            }
            if (m.topTarget) {
                lines.push('Ключевой получатель поставок — ' + m.topTarget + '.');
            }
            var structWord = (m.targetCount && m.targetCount <= m.topN) ? 'концентрированная' : 'разветвлённая';
            lines.push('ТОП-' + m.topN + ' ' + srcWord + ' распределяют поставки между ' + (m.targetCount || '?') + ' получателями — структура ' + structWord + '.');
        }

        if (type === 'segments') {
            if (m.leadSegment) {
                lines.push('Основной канал сбыта — «' + m.leadSegment + '» с долей ' + presRuNum(m.leadSegmentShare, 1) + '% от общего объёма импорта.');
            }
            if (m.growSegment && m.growSegment.seg) {
                lines.push('Доля сегмента «' + m.growSegment.seg + '» выросла с ' + presRuNum(m.growSegment.from, 1) +
                    '% до ' + presRuNum(m.growSegment.to, 1) + '%, структура потребления смещается в его сторону.');
            }
            if (m.leadShareFirst != null && m.leadShareLast != null) {
                var dlt = round2(m.leadShareLast - m.leadShareFirst);
                lines.push('Доля лидера за период ' + (dlt >= 0 ? 'выросла на ' : 'снизилась на ') + presRuNum(Math.abs(dlt), 1) +
                    ' п.п. (с ' + presRuNum(m.leadShareFirst, 1) + '% до ' + presRuNum(m.leadShareLast, 1) + '%).');
            }
            if (m.segmentsCount) {
                lines.push('Всего в поставках задействовано ' + m.segmentsCount + ' сегментов потребления.');
            }
        }

        if (type === 'quarterly-prices') {
            if (m.usdMin != null) {
                lines.push('Цена в долларах колебалась от ' + presRuNum(m.usdMin, 1) + ' до ' + presRuNum(m.usdMax, 1) + ' USD/кг (в среднем ' + presRuNum(m.usdAvg, 1) + ').');
            }
            if (m.rubMin != null) {
                lines.push('Цена в рублях: от ' + presRuNum(m.rubMin) + ' до ' + presRuNum(m.rubMax) + ' руб./кг (в среднем ' + presRuNum(m.rubAvg) + ').');
            }
            if (m.usdMax && m.usdMin && m.usdMin > 0) {
                var vol = round2((m.usdMax - m.usdMin) / m.usdMin * 100);
                if (vol >= 30) lines.push('Высокая волатильность цен (размах ' + presRuNum(Math.round(vol)) + '%), рынок подвержен ценовым шокам.');
                else lines.push('Цены относительно стабильны (размах ' + presRuNum(Math.round(vol)) + '%), ценовой коридор предсказуем.');
            }
        }

        if (type === 'market-changes' && m.marketBasePeriod) {
            var direction = m.marketDelta >= 0 ? 'увеличился' : 'сократился';
            var pctText = m.marketPct == null ? '' : ' на ' + presRuNum(Math.abs(m.marketPct), 1) + '%';
            lines.push('За период ' + m.marketBasePeriod + '–' + m.marketCurrentPeriod + ' совокупный показатель ' + direction + pctText + '.');
            lines.push('Появилось ' + m.marketNewCount + ' новых позиций, исчезло ' + m.marketGoneCount + '.');
            if (m.marketGrowthLeader) {
                lines.push('Лидер роста — ' + m.marketGrowthLeader.key + ': +' + marketFormatValue(m.marketGrowthLeader.delta, m.marketMetric) + '.');
            }
            if (m.marketDeclineLeader) {
                lines.push('Наибольшее снижение — ' + m.marketDeclineLeader.key + ': ' + marketFormatValue(m.marketDeclineLeader.delta, m.marketMetric) + '.');
            }
        }

        return lines;
    }

    // Обзорный текст для «Введения» (kind='intro') и «Резюме» (kind='resume').
    // Собирается детерминированно из метрик объёмов и стран. Без ИИ.
    function generateReportText(kind, data, headers, slide) {
        var vm = computeSlideMetrics('volumes', data, headers, slide);
        var cm = computeSlideMetrics('countries', data, headers, slide);
        var product = (slide && slide.opts && slide.opts.product ? slide.opts.product : '').trim();
        var of = product ? ' ' + product : '';
        var period = (vm.firstYear && vm.lastYear) ? vm.firstYear + '–' + vm.lastYear : '';
        var t = presTrendPhrase(vm.cagrWeight);
        var lines = [];

        if (kind === 'intro') {
            if (vm.cagrWeight != null && vm.firstWeight != null) {
                var wu = presWeightUnit(Math.max(Math.abs(vm.firstWeight), Math.abs(vm.lastWeight)));
                lines.push('Российский рынок импорта' + of + (period ? ' в ' + period + ' гг.' : '') + ' демонстрирует ' + t.adj +
                    ': объём поставок ' + (t.dir === 'down' ? 'снизился' : (t.dir === 'up' ? 'вырос' : 'изменился')) +
                    ' с ' + presRuNum(vm.firstWeight / wu.div, wu.d) + ' до ' + presRuNum(vm.lastWeight / wu.div, wu.d) + ' ' + wu.unit +
                    ' (CAGR ' + presRuNum(Math.round(vm.cagrWeight)) + '%).');
            }
            if (cm.leader) {
                var concPhrase = cm.leaderShare >= 70 ? 'высокая зависимость от одного поставщика'
                    : (cm.leaderShare >= 40 ? 'выраженная концентрация поставок' : 'диверсифицированная география поставок');
                lines.push('Структура импорта характеризуется: ' + concPhrase + ' — ключевой поставщик ' + cm.leader +
                    ' (' + presRuNum(cm.leaderShare, 1) + '% объёма), всего в поставках участвует ' + (cm.countriesCount || '?') + ' стран.');
            }
            if (vm.cagrUsd != null && vm.cagrWeight != null) {
                var priceMove = vm.cagrUsd < vm.cagrWeight - 2 ? 'снижении средней цены закупки'
                    : (vm.cagrUsd > vm.cagrWeight + 2 ? 'росте средней цены закупки' : 'стабильности средней цены');
                lines.push('Динамика стоимости (CAGR ' + presRuNum(Math.round(vm.cagrUsd)) + '% в долларах' +
                    (vm.cagrRub != null ? ', ' + presRuNum(Math.round(vm.cagrRub)) + '% в рублях' : '') +
                    ') свидетельствует о ' + priceMove + ' на фоне валютного фактора.');
            }
        }

        if (kind === 'resume') {
            if (vm.cagrWeight != null) {
                lines.push('Рынок импорта' + of + (period ? ' в ' + period + ' гг.' : '') + ' развивался в режиме «' + t.adj + '»: ' +
                    'ключевые показатели подтверждают ' + (t.dir === 'up' ? 'растущий спрос' : (t.dir === 'down' ? 'сжатие спроса' : 'устойчивое состояние')) + ' сегмента.');
            }
            if (cm.leader && cm.leaderShare >= 70) {
                lines.push('Главный риск это высокая зависимость от одного поставщика (' + cm.leader + ' — ' + presRuNum(cm.leaderShare, 1) +
                    '%): диверсификация географии закупок становится приоритетной задачей.');
            } else if (cm.leader) {
                lines.push('Структура поставок относительно устойчива (лидер ' + cm.leader + ' — ' + presRuNum(cm.leaderShare, 1) +
                    '%), что снижает чувствительность рынка к шокам по отдельным направлениям.');
            }
            if (vm.cagrUsd != null && vm.cagrWeight != null && vm.cagrUsd < vm.cagrWeight - 2) {
                lines.push('Рост физических объёмов опережает стоимостный. Рынок растёт за счёт спроса, а не цены, и это создаёт условия для входа новых импортёров.');
            } else if (vm.cagrRub != null && vm.cagrUsd != null && vm.cagrRub > vm.cagrUsd + 2) {
                lines.push('Опережающий рост рублёвой стоимости усиливает давление на себестоимость переработчиков. Закупочные цены стоит держать под контролем.');
            }
            lines.push('В среднесрочной перспективе устойчивость рынка будет определяться диверсификацией поставок и управлением валютными и логистическими рисками.');
        }

        return lines;
    }

    // --- PDF-экспорт (Фаза 5) ---
    // --- Мастер: собрать отчёт по шаблону компании из данных ---
    function presRunWizard() {
        var data = getActiveData(), headers = getActiveHeaders();
        if (!data || !data.length) { alert('Сначала загрузите данные во вкладке «Данные».'); return; }
        function q(sel) { return document.querySelector(sel); }

        var repTitle = q('.pres-wiz-title').value.trim() || 'Аналитическая справка';
        var part = q('.pres-wiz-part').value.trim();
        var prodRaw = q('.pres-wiz-products').value.trim();
        var products = prodRaw.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
            var p = l.split('|');
            return { name: (p[0] || '').trim(), hs: (p[1] || '').trim() };
        });
        if (products.length === 0) products = [{ name: '', hs: '' }];
        var sections = Array.prototype.map.call(document.querySelectorAll('.pres-wiz-sections input:checked'), function (e) { return e.value; });
        var extras = Array.prototype.map.call(document.querySelectorAll('.pres-wiz-extras input:checked'), function (e) { return e.value; });
        var single = products.length === 1 ? products[0].name : '';

        var nid = presState.nextId;
        function mk(type, over) {
            var b = findPresBlock(type);
            var sl = { id: nid++, type: type, title: b ? b.label : type, hsFilter: '', topN: 10, year: '', opts: { subtitle: '', bullets: '', commentary: '', product: '' } };
            if (over) {
                if (over.title != null) sl.title = over.title;
                if (over.hsFilter != null) sl.hsFilter = over.hsFilter;
                if (over.opts) { for (var k in over.opts) sl.opts[k] = over.opts[k]; }
            }
            return sl;
        }
        function fillAnalytical(sl, product) {
            var fd = filterDataByHS(data, headers, sl.hsFilter);
            var m = computeSlideMetrics(sl.type, fd, headers, sl);
            m.product = product || '';
            var at = generateActionTitle(sl.type, m);
            if (at) sl.title = at;
            var lines = generateTemplateText(sl.type, m);
            if (lines.length) sl.opts.commentary = lines.join('\n');
        }

        var slides = [];
        slides.push(mk('title', { title: repTitle, opts: { subtitle: part } }));
        slides.push(mk('toc'));

        if (extras.indexOf('intro') !== -1) {
            var intro = mk('intro');
            var il = generateReportText('intro', data, headers, { opts: { product: single } });
            if (il.length) intro.opts.bullets = il.join('\n');
            slides.push(intro);
        }

        products.forEach(function (p) {
            if (products.length > 1 || p.name) {
                slides.push(mk('section-divider', { title: p.name || 'Анализ рынка', hsFilter: p.hs }));
            }
            sections.forEach(function (type) {
                var sl = mk(type, { hsFilter: p.hs, opts: { product: p.name } });
                fillAnalytical(sl, p.name);
                slides.push(sl);
            });
        });

        if (extras.indexOf('summary') !== -1) {
            var sum = mk('summary');
            var rl = generateReportText('resume', data, headers, { opts: { product: single } });
            if (rl.length) sum.opts.bullets = rl.join('\n');
            slides.push(sum);
        }
        if (extras.indexOf('recommendations') !== -1) {
            var rec = mk('recommendations');
            var prodLines = products.filter(function (p) { return p.name || p.hs; }).map(function (p) { return p.name + '|' + p.hs; });
            if (prodLines.length) rec.opts.bullets = prodLines.join('\n');
            slides.push(rec);
        }
        slides.push(mk('contacts'));

        presState.slides = slides;
        presState.nextId = nid;
        presState.activeIndex = 0;
        renderPresSlideList();
        previewPresSlide(0);
        updatePresButtons();
        document.querySelector('.pres-wizard-overlay').style.display = 'none';
    }

    function exportPresPDF() {
        if (presState.slides.length === 0) return;
        if (!window.jspdf || !window.html2canvas) {
            alert('\u0411\u0438\u0431\u043b\u0438\u043e\u0442\u0435\u043a\u0438 jsPDF/html2canvas \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u044b');
            return;
        }

        var data = getActiveData();
        var headers = getActiveHeaders();
        var offscreen = document.querySelector('.pres-offscreen');
        var progressOverlay = document.querySelector('.pres-progress-overlay');
        var progressFill = document.querySelector('.pres-progress-fill');
        var progressDetail = document.querySelector('.pres-progress-detail');

        var pdf = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        var slideIndex = 0;
        var total = presState.slides.length;

        progressOverlay.style.display = '';
        progressFill.style.width = '0%';
        progressDetail.textContent = '0 / ' + total;

        var PDF_ANALYTICS = ['facts', 'volumes', 'countries', 'price-dynamics', 'sankey-sender', 'sankey-manufacturer', 'quarterly-prices', 'market-changes', 'segments'];
        // PDF page dimensions in points at 10px/mm: 297mm × 210mm
        var PDF_W = 2970, PDF_H = 2100;

        function pdfAddPageCanvas(canvas) {
            var imgData = canvas.toDataURL('image/jpeg', 0.92);
            if (slideIndex > 0) pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210);
        }

        function pdfDrawAnalyticsPage(title, pngs) {
            var canvas = document.createElement('canvas');
            canvas.width = PDF_W; canvas.height = PDF_H;
            var ctx = canvas.getContext('2d');

            // Белый фон
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, PDF_W, PDF_H);

            // Синяя шапка
            ctx.fillStyle = '#2563EB';
            ctx.fillRect(0, 0, PDF_W, 185);

            // Заголовок в шапке
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 52px Arial';
            ctx.fillText(title || '', 80, 130);

            // Чарты
            if (pngs.length === 0) {
                ctx.fillStyle = '#94A3B8';
                ctx.font = '40px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Нет данных', PDF_W / 2, PDF_H / 2);
                ctx.textAlign = 'left';
            } else {
                var padding = 60;
                var areaY = 200, areaH = PDF_H - 280;
                var areaW = PDF_W - padding * 2;

                if (pngs.length === 1) {
                    var img = new Image();
                    img.src = pngs[0].dataUrl;
                    var aspect = pngs[0].w / pngs[0].h;
                    var drawW = areaW, drawH = drawW / aspect;
                    if (drawH > areaH) { drawH = areaH; drawW = drawH * aspect; }
                    var drawX = padding + (areaW - drawW) / 2;
                    ctx.drawImage(img, drawX, areaY, drawW, drawH);
                } else {
                    var colW2 = (areaW - padding) / 2;
                    pngs.forEach(function(png, i) {
                        var img2 = new Image();
                        img2.src = png.dataUrl;
                        var aspect2 = png.w / png.h;
                        var dW = colW2, dH = dW / aspect2;
                        if (dH > areaH) { dH = areaH; dW = dH * aspect2; }
                        ctx.drawImage(img2, padding + i * (colW2 + padding), areaY, dW, dH);
                    });
                }
            }

            // Футер
            ctx.fillStyle = '#94A3B8';
            ctx.font = '28px Arial';
            ctx.fillText('delomant.ru', 80, PDF_H - 40);
            ctx.textAlign = 'right';
            ctx.fillText(String(new Date().getFullYear()), PDF_W - 80, PDF_H - 40);
            ctx.textAlign = 'left';

            return canvas;
        }

        function renderNext() {
            if (slideIndex >= total) {
                pdf.save(baseFileName() + '_presentation.pdf');
                offscreen.innerHTML = '';
                progressOverlay.style.display = 'none';
                return;
            }

            var slide = presState.slides[slideIndex];
            var filteredData = filterDataByHS(data, headers, slide.hsFilter);

            if (PDF_ANALYTICS.indexOf(slide.type) !== -1) {
                // Аналитический слайд: SVG → PNG → Canvas → PDF
                renderSlideSvgs(slide, filteredData, headers).then(function(pngs) {
                    // Нужно чтобы Image объекты загрузились перед drawImage
                    var loadPromises = pngs.map(function(png) {
                        return new Promise(function(res) {
                            var img = new Image();
                            img.onload = function() { png._img = img; res(); };
                            img.onerror = res;
                            img.src = png.dataUrl;
                        });
                    });
                    Promise.all(loadPromises).then(function() {
                        var canvas = document.createElement('canvas');
                        canvas.width = PDF_W; canvas.height = PDF_H;
                        var ctx = canvas.getContext('2d');
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, PDF_W, PDF_H);
                        ctx.fillStyle = '#2563EB';
                        ctx.fillRect(0, 0, PDF_W, 185);
                        ctx.fillStyle = '#FFFFFF';
                        ctx.font = 'bold 52px Arial';
                        ctx.fillText(slide.title || '', 80, 130);

                        var padding = 60;
                        var areaY = 200, areaH = PDF_H - 280;
                        var areaW = PDF_W - padding * 2;

                        if (pngs.length === 0) {
                            ctx.fillStyle = '#94A3B8';
                            ctx.font = '40px Arial';
                            ctx.textAlign = 'center';
                            ctx.fillText('Нет данных', PDF_W / 2, PDF_H / 2);
                            ctx.textAlign = 'left';
                        } else if (pngs.length === 1 && pngs[0]._img) {
                            var aspect = pngs[0].w / pngs[0].h;
                            var drawW = areaW, drawH = drawW / aspect;
                            if (drawH > areaH) { drawH = areaH; drawW = drawH * aspect; }
                            var drawX = padding + (areaW - drawW) / 2;
                            ctx.drawImage(pngs[0]._img, drawX, areaY, drawW, drawH);
                        } else {
                            var colW2 = (areaW - padding) / pngs.length;
                            pngs.forEach(function(png, i) {
                                if (!png._img) return;
                                var aspect2 = png.w / png.h;
                                var dW = colW2, dH = dW / aspect2;
                                if (dH > areaH) { dH = areaH; dW = dH * aspect2; }
                                ctx.drawImage(png._img, padding + i * (colW2 + padding / 2), areaY, dW, dH);
                            });
                        }

                        ctx.fillStyle = '#94A3B8';
                        ctx.font = '28px Arial';
                        ctx.fillText('delomant.ru', 80, PDF_H - 40);
                        ctx.textAlign = 'right';
                        ctx.fillText(String(new Date().getFullYear()), PDF_W - 80, PDF_H - 40);
                        ctx.textAlign = 'left';

                        pdfAddPageCanvas(canvas);
                        slideIndex++;
                        progressFill.style.width = Math.round(slideIndex / total * 100) + '%';
                        progressDetail.textContent = slideIndex + ' / ' + total;
                        renderNext();
                    });
                });
                return;
            }

            // Простые слайды — html2canvas
            var slideHTML = renderPresSlideByType(slide, filteredData, headers);
            offscreen.innerHTML = slideHTML;

            setTimeout(function () {
                var el = offscreen.querySelector('.pres-slide');
                if (!el) { slideIndex++; renderNext(); return; }

                window.html2canvas(el, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#FFFFFF',
                    width: 960,
                    height: 540
                }).then(function (canvas) {
                    pdfAddPageCanvas(canvas);
                    slideIndex++;
                    progressFill.style.width = Math.round(slideIndex / total * 100) + '%';
                    progressDetail.textContent = slideIndex + ' / ' + total;
                    renderNext();
                }).catch(function () {
                    slideIndex++;
                    renderNext();
                });
            }, 150);
        }

        renderNext();
    }

    // --- Инициализация модуля ---
    renderPresPalette();
    renderPresSlideList();
    updatePresButtons();

    // Navigation
    presPrevBtn.addEventListener('click', function () {
        if (presState.activeIndex > 0) {
            presState.activeIndex--;
            renderPresSlideList();
            previewPresSlide(presState.activeIndex);
        }
    });
    presNextBtn.addEventListener('click', function () {
        if (presState.activeIndex < presState.slides.length - 1) {
            presState.activeIndex++;
            renderPresSlideList();
            previewPresSlide(presState.activeIndex);
        }
    });

    // Export PDF
    presExportBtn.addEventListener('click', exportPresPDF);

    // Мастер сборки отчёта
    var presWizardBtn = document.querySelector('.pres-wizard-btn');
    if (presWizardBtn) {
        presWizardBtn.addEventListener('click', function () {
            document.querySelector('.pres-wizard-overlay').style.display = '';
        });
        document.querySelector('.pres-wiz-cancel').addEventListener('click', function () {
            document.querySelector('.pres-wizard-overlay').style.display = 'none';
        });
        document.querySelector('.pres-wiz-build').addEventListener('click', presRunWizard);
    }

    // Export PPTX
    presExportPptxBtn.addEventListener('click', exportPresPPTX);

    // --- Export: самодостаточный HTML-дек ---
    // Слайды уже рендерятся инлайновым SVG (векторно), поэтому дек полностью
    // самодостаточен: встраиваем CSS приложения + логотип, добавляем навигацию
    // и печать в PDF (@page landscape) — без растеризации и без сервера.
    function buildDeckDocument(title, appCss, slidesBody) {
        var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
        var deckCss = [
            'html,body{margin:0!important;padding:0!important;height:auto!important;display:block!important;background:#20232B!important;overflow:auto!important}',
            'body{font-family:"Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif}',
            '.pres-slide{font-family:"Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif!important}',
            '.deck-stage{width:100vw;height:calc(100vh - 66px);display:flex;align-items:center;justify-content:center;overflow:hidden}',
            '.deck-slide{display:none;align-items:center;justify-content:center}',
            '.deck-slide.on{display:flex}',
            '.deck-slide .pres-slide{transform:scale(var(--s,0.9));box-shadow:0 20px 60px -20px rgba(0,0,0,.6)}',
            '.deck-nav{height:66px;display:flex;align-items:center;justify-content:center;gap:14px;background:#171A21;color:#E8EAF0}',
            '.deck-nav button{font:inherit;font-size:14px;font-weight:600;background:#252A34;color:#E8EAF0;border:1px solid #333A46;border-radius:8px;padding:8px 15px;cursor:pointer}',
            '.deck-nav button:hover{border-color:#5E8DF6}',
            '.deck-nav .c{min-width:56px;text-align:center;color:#AAB2C4}',
            '.deck-nav .p{border-color:#5E8DF6;color:#9DBBFF}',
            '@media print{@page{size:A4 landscape;margin:0}body{background:#fff!important}.deck-nav{display:none}',
            '.deck-stage{display:block!important;width:auto;height:auto;overflow:visible}',
            '.deck-slide{display:block!important;width:297mm;height:210mm;page-break-after:always;overflow:hidden;position:relative}',
            '.deck-slide:last-child{page-break-after:auto}',
            '.deck-slide .pres-slide{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) scale(1.169);box-shadow:none}}'
        ].join('\n');
        var js = '(function(){var s=[].slice.call(document.querySelectorAll(".deck-slide")),' +
            'st=document.getElementById("deckStage"),c=document.getElementById("deckCounter"),i=0;' +
            'function fit(){var aw=st.clientWidth-40,ah=st.clientHeight-40;document.documentElement.style.setProperty("--s",Math.min(aw/960,ah/540));}' +
            'function go(n){i=Math.max(0,Math.min(s.length-1,n));s.forEach(function(e,k){e.classList.toggle("on",k===i);});c.textContent=(i+1)+" / "+s.length;fit();}' +
            'document.getElementById("dPrev").onclick=function(){go(i-1);};document.getElementById("dNext").onclick=function(){go(i+1);};' +
            'document.getElementById("dPrint").onclick=function(){window.print();};' +
            'document.addEventListener("keydown",function(e){if(e.key==="ArrowRight"||e.key==="PageDown")go(i+1);else if(e.key==="ArrowLeft"||e.key==="PageUp")go(i-1);else if(e.key==="Home")go(0);else if(e.key==="End")go(s.length-1);});' +
            'window.addEventListener("resize",fit);go(0);})();';
        var nav = '<div class="deck-nav"><button id="dPrev">← Назад</button>' +
            '<span class="c" id="deckCounter">1 / 1</span><button id="dNext">Вперёд →</button>' +
            '<button class="p" id="dPrint">Скачать PDF (печать)</button></div>';
        return '<!doctype html><html lang="ru"><head><meta charset="utf-8">' +
            '<meta name="viewport" content="width=device-width, initial-scale=1">' +
            '<title>' + esc(title) + '</title><style>' + appCss + '\n' + deckCss + '</style></head><body>' +
            '<div class="deck-stage" id="deckStage">' + slidesBody + '</div>' + nav +
            '<scr' + 'ipt>' + js + '</scr' + 'ipt></body></html>';
    }

    function exportPresHTMLDeck() {
        if (presState.slides.length === 0) return;
        var data = getActiveData(), headers = getActiveHeaders();
        var slidesHTML = '';
        presState.slides.forEach(function (slide) {
            var inner;
            try { inner = renderPresSlideByType(slide, data, headers); }
            catch (e) { inner = '<div class="pres-slide"><div class="pres-slide-header"><span class="pres-slide-header-text">' + (slide.title || 'Слайд') + '</span></div><div class="pres-slide-body"><p>Не удалось построить слайд.</p></div><div class="pres-slide-footer"><span>DELOMANT</span><span></span></div></div>'; }
            slidesHTML += '<div class="deck-slide">' + inner + '</div>';
        });
        var titleRaw = (presState.slides[0] && presState.slides[0].title) || 'Презентация';
        var docTitle = String(titleRaw).replace(/<[^>]*>/g, '').trim() || 'Презентация';

        var cssP = fetch('styles/main.css').then(function (r) { return r.ok ? r.text() : ''; }).catch(function () { return ''; });
        var logoP = fetch('data/Logo.png').then(function (r) { return r.ok ? r.blob() : null; }).then(function (b) {
            if (!b) return '';
            return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = function () { res(''); }; fr.readAsDataURL(b); });
        }).catch(function () { return ''; });

        Promise.all([cssP, logoP]).then(function (arr) {
            var body = arr[1] ? slidesHTML.split('data/Logo.png').join(arr[1]) : slidesHTML;
            var doc = buildDeckDocument(docTitle, arr[0], body);
            triggerDownload(new Blob([doc], { type: 'text/html;charset=utf-8' }),
                'presentation_' + new Date().toISOString().slice(0, 10) + '.html');
        });
    }

    if (presExportHtmlBtn) presExportHtmlBtn.addEventListener('click', exportPresHTMLDeck);

    // --- PPTX-экспорт через PptxGenJS ---
    function exportPresPPTX() {
        if (presState.slides.length === 0) return;
        if (typeof PptxGenJS === 'undefined') {
            alert('Библиотека PptxGenJS не загружена');
            return;
        }

        var data = getActiveData();
        var headers = getActiveHeaders();
        var offscreen = document.querySelector('.pres-offscreen');
        var progressOverlay = document.querySelector('.pres-progress-overlay');
        var progressFill = document.querySelector('.pres-progress-fill');
        var progressDetail = document.querySelector('.pres-progress-detail');

        progressOverlay.style.display = '';
        progressFill.style.width = '0%';
        progressDetail.textContent = 'Подготовка PPTX...';

        var pres = new PptxGenJS();
        pres.layout = 'LAYOUT_16x9';
        pres.author = 'Delomant';
        pres.title = presState.slides[0] ? (presState.slides[0].title || 'Презентация') : 'Презентация';

        var SIMPLE_TYPES = ['title', 'text', 'summary', 'toc', 'section-divider', 'contacts', 'recommendations'];
        var PPTX_COLORS = LINE_COLORS.map(function(c) { return c.replace('#', ''); });
        var PPTX_YEAR_COLORS = YEAR_COLORS.map(function(c) { return c.replace('#', ''); });
        var FONT = 'Arial';

        // --- Utilities ---

        function pptxHeader(sl, title) {
            sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: '100%', h: 0.55, fill: { color: '2563EB' } });
            sl.addText(title || '', {
                x: 0.3, y: 0.05, w: 9.4, h: 0.45,
                fontSize: 18, fontFace: FONT, color: 'FFFFFF', bold: true, valign: 'middle'
            });
        }

        function pptxFooter(sl) {
            var srcNote = dataSourceNote();
            sl.addText(srcNote || 'delomant.ru', {
                x: 0.2, y: 5.3, w: srcNote ? 6 : 2, h: 0.25,
                fontSize: 8, fontFace: FONT, color: '94A3B8', valign: 'middle'
            });
            sl.addText(String(new Date().getFullYear()), {
                x: 7.8, y: 5.3, w: 2, h: 0.25,
                fontSize: 8, fontFace: FONT, color: '94A3B8', align: 'right', valign: 'middle'
            });
        }

        function pptxLine(sl, x, y, w) {
            sl.addShape(pres.shapes.LINE, {
                x: x, y: y, w: w, h: 0,
                line: { color: 'CBD5E1', width: 0.5 }
            });
        }

        function pptxCommentary(sl, commentary, x, y, w, h) {
            if (!commentary) return;
            var clean = typeof stripMarkdown === 'function' ? stripMarkdown(commentary) : commentary;
            var lines = clean.split('\n').filter(function(l) { return l.trim(); }).slice(0, 8);
            var textRows = lines.map(function(l) {
                return { text: l.trim(), options: { fontSize: 9, fontFace: FONT, color: '334155', bullet: true, breakLine: true } };
            });
            sl.addText([{ text: 'Аналитика', options: { fontSize: 10, fontFace: FONT, color: '0E15AE', bold: true, breakLine: true } }].concat(textRows), {
                x: x, y: y, w: w, h: h,
                valign: 'top', paraSpaceAfter: 4
            });
        }

        // Таблица: headerRow + dataRows → PptxGenJS rows
        function pptxTableRows(headerCells, dataRows, opts) {
            opts = opts || {};
            var hdrStyle = { bold: true, fill: { color: '0F172A' }, color: 'FFFFFF', fontSize: opts.fontSize || 9, fontFace: FONT, align: 'center', valign: 'middle' };
            var rows = [headerCells.map(function(h) { return { text: h, options: hdrStyle }; })];
            dataRows.forEach(function(row, ri) {
                var bg = ri % 2 === 0 ? 'F8FAFC' : 'FFFFFF';
                rows.push(row.map(function(cell, ci) {
                    var cellOpts = { fill: { color: bg }, fontSize: opts.fontSize || 9, fontFace: FONT, valign: 'middle' };
                    if (ci > 0) cellOpts.align = 'right';
                    if (typeof cell === 'object' && cell.options) {
                        var merged = {};
                        for (var k in cellOpts) merged[k] = cellOpts[k];
                        for (var k2 in cell.options) merged[k2] = cell.options[k2];
                        return { text: cell.text, options: merged };
                    }
                    return { text: String(cell), options: cellOpts };
                }));
            });
            return rows;
        }

        // --- Простые слайды ---

        function addTitleSlide(slideData) {
            var sl = pres.addSlide();
            sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: '0F172A' } });
            sl.addText(slideData.title || 'Аналитическая справка', {
                x: 0.8, y: 2.0, w: 8.4, h: 1.0,
                fontSize: 32, fontFace: FONT, color: 'FFFFFF', bold: true, align: 'center', valign: 'middle'
            });
            var subtitle = (slideData.opts && slideData.opts.subtitle) || '';
            if (subtitle) {
                sl.addText(subtitle, {
                    x: 0.8, y: 3.0, w: 8.4, h: 0.6,
                    fontSize: 18, fontFace: FONT, color: 'CBD5E1', align: 'center', valign: 'middle'
                });
            }
            sl.addText('delomant.ru  \u00b7  ' + new Date().getFullYear(), {
                x: 0.8, y: 4.8, w: 8.4, h: 0.4,
                fontSize: 12, fontFace: FONT, color: '64748B', align: 'center', valign: 'middle'
            });
        }

        function addRecommendationsSlide(slideData) {
            var data = getActiveData(), headers = getActiveHeaders();
            var r = buildRecommendationRows(data, headers, slideData);
            var sl = pres.addSlide();
            pptxHeader(sl, slideData.title || 'Рекомендации');
            var tableRows = [];
            var hdr = [{ text: 'Аспект анализа', options: { bold: true, color: '2563EB', fill: { color: 'EFF6FF' } } }];
            r.cols.forEach(function (c) { hdr.push({ text: c.name, options: { bold: true, color: '2563EB', fill: { color: 'EFF6FF' } } }); });
            tableRows.push(hdr);
            r.rows.forEach(function (row) {
                var tr = [{ text: row.label, options: { bold: true, color: '0F172A' } }];
                row.vals.forEach(function (v) { tr.push({ text: v, options: { bold: !!row.bold, color: row.bold ? '0F172A' : '334155' } }); });
                tableRows.push(tr);
            });
            var firstW = 1.9;
            var restW = (9.4 - firstW) / Math.max(1, r.cols.length);
            var colW = [firstW].concat(r.cols.map(function () { return restW; }));
            sl.addTable(tableRows, { x: 0.3, y: 0.7, w: 9.4, colW: colW, fontSize: 9, fontFace: FONT, valign: 'top', border: { type: 'solid', color: 'E2E8F0', pt: 0.5 }, autoPage: false });
            pptxFooter(sl);
        }

        function addTextSlide(slideData) {
            var rawBullets = ((slideData.opts && slideData.opts.bullets) || '');
            var cleanAll = typeof stripMarkdown === 'function' ? stripMarkdown(rawBullets) : rawBullets;
            var bullets = cleanAll.split('\n').filter(function(l) { return l.trim(); });
            var LINES_PER_SLIDE = 18;
            var pages = [];
            for (var pi = 0; pi < Math.max(1, bullets.length); pi += LINES_PER_SLIDE) {
                pages.push(bullets.slice(pi, pi + LINES_PER_SLIDE));
            }
            pages.forEach(function(pageBullets, pageIdx) {
                var sl = pres.addSlide();
                var pageTitle = (slideData.title || 'Текст') + (pages.length > 1 && pageIdx > 0 ? ' (продолжение)' : '');
                pptxHeader(sl, pageTitle);
                if (pageBullets.length > 0) {
                    var textRows = pageBullets.map(function(l) {
                        return { text: l.trim(), options: { fontSize: 13, fontFace: FONT, color: '0F172A', bullet: true, breakLine: true } };
                    });
                    sl.addText(textRows, { x: 0.3, y: 0.7, w: 9.4, h: 4.5, valign: 'top', paraSpaceAfter: 6 });
                }
                pptxFooter(sl);
            });
        }

        function addTocSlide() {
            var sl = pres.addSlide();
            pptxHeader(sl, 'Содержание');
            var num = 1;
            var items = [];
            presState.slides.forEach(function(s) {
                if (s.type === 'toc') return;
                var block = findPresBlock(s.type);
                var label = s.title || (block ? block.label : '');
                items.push({ text: num + '.  ' + label, options: { fontSize: 14, fontFace: FONT, color: '334155', breakLine: true } });
                num++;
            });
            sl.addText(items, { x: 0.4, y: 0.7, w: 9.2, h: 4.4, valign: 'top', paraSpaceAfter: 6 });
            pptxFooter(sl);
        }

        function addSectionSlide(slideData) {
            var sl = pres.addSlide();
            sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: '1E40AF' } });
            var title = slideData.title || 'Раздел';
            if (slideData.hsFilter) title += '  (' + slideData.hsFilter + ')';
            sl.addText(title, {
                x: 0.8, y: 2.0, w: 8.4, h: 1.5,
                fontSize: 28, fontFace: FONT, color: 'FFFFFF', bold: true, align: 'center', valign: 'middle'
            });
            pptxFooter(sl);
        }

        function addContactsSlide() {
            var sl = pres.addSlide();
            sl.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: '0F172A' } });
            sl.addText('Контакты', {
                x: 0.8, y: 1.2, w: 8.4, h: 0.8,
                fontSize: 28, fontFace: FONT, color: 'FFFFFF', bold: true, align: 'center'
            });
            var lines = [
                { text: 'Москва', options: { fontSize: 16, color: 'E2E8F0', breakLine: true } },
                { text: 'Кутузовский проспект, 35', options: { fontSize: 16, color: 'CBD5E1', breakLine: true } },
                { text: '+7 (495) 445 97 77', options: { fontSize: 16, color: 'CBD5E1', breakLine: true } },
                { text: 'info@delomant.ru', options: { fontSize: 16, color: '93C5FD', breakLine: true } }
            ];
            sl.addText(lines, { x: 0.8, y: 2.2, w: 8.4, h: 2.5, fontFace: FONT, align: 'center', paraSpaceAfter: 10 });
            sl.addText('delomant.ru', { x: 0.8, y: 4.8, w: 8.4, h: 0.4, fontSize: 12, fontFace: FONT, color: '64748B', align: 'center' });
        }

        // --- Аналитические слайды: SVG → PNG через Canvas ---

        function addAnalyticsSlide(slideData) {
            var fd = filterDataByHS(data, headers, slideData.hsFilter);
            return renderSlideSvgs(slideData, fd, headers).then(function(pngs) {
                var sl = pres.addSlide();
                pptxHeader(sl, slideData.title || '');
                var hasComm = !!(slideData.opts && slideData.opts.commentary);
                var maxW = hasComm ? 7.0 : 9.4;

                if (pngs.length === 0) {
                    sl.addText('Нет данных', { x: 0.3, y: 2.0, w: maxW, h: 1, fontSize: 14, fontFace: FONT, color: '94A3B8', align: 'center' });
                } else if (pngs.length === 1) {
                    var aspect = pngs[0].w / pngs[0].h;
                    var imgH = Math.min(maxW / aspect, 4.5);
                    sl.addImage({ data: pngs[0].dataUrl, x: 0.3, y: 0.65, w: maxW, h: imgH });
                } else {
                    var colW = (maxW - 0.2) / 2;
                    pngs.forEach(function(png, i) {
                        var aspect = png.w / png.h;
                        var imgH = Math.min(colW / aspect, 4.5);
                        sl.addImage({ data: png.dataUrl, x: 0.3 + i * (colW + 0.2), y: 0.65, w: colW, h: imgH });
                    });
                }
                if (hasComm) pptxCommentary(sl, slideData.opts.commentary, 7.5, 0.65, 2.3, 4.5);
                pptxFooter(sl);
            });
        }

        // --- Последовательная обработка слайдов ---
        var slideIndex = 0;
        var total = presState.slides.length;

        function processNext() {
            if (slideIndex >= total) {
                progressFill.style.width = '100%';
                progressDetail.textContent = 'Генерация файла...';
                pres.writeFile({ fileName: baseFileName() + '_presentation.pptx' })
                    .then(function() {
                        offscreen.innerHTML = '';
                        progressOverlay.style.display = 'none';
                    }).catch(function(err) {
                        console.error('PPTX export error:', err);
                        offscreen.innerHTML = '';
                        progressOverlay.style.display = 'none';
                        alert('Ошибка экспорта PPTX: ' + err.message);
                    });
                return;
            }

            var slideData = presState.slides[slideIndex];
            progressFill.style.width = Math.round(slideIndex / total * 100) + '%';
            progressDetail.textContent = 'Слайд ' + (slideIndex + 1) + ' / ' + total;

            var isSimple = SIMPLE_TYPES.indexOf(slideData.type) !== -1;

            var ANALYTICS_TYPES = ['facts', 'volumes', 'countries', 'price-dynamics', 'sankey-sender', 'sankey-manufacturer', 'quarterly-prices', 'market-changes', 'segments'];

            if (isSimple) {
                if (slideData.type === 'title') addTitleSlide(slideData);
                else if (slideData.type === 'toc') addTocSlide();
                else if (slideData.type === 'section-divider') addSectionSlide(slideData);
                else if (slideData.type === 'contacts') addContactsSlide();
                else if (slideData.type === 'recommendations') addRecommendationsSlide(slideData);
                else addTextSlide(slideData);
                slideIndex++;
                setTimeout(processNext, 0);
            } else if (ANALYTICS_TYPES.indexOf(slideData.type) !== -1) {
                addAnalyticsSlide(slideData).then(function() {
                    slideIndex++;
                    processNext();
                });
            } else {
                // Неизвестный тип — пропускаем
                slideIndex++;
                setTimeout(processNext, 0);
            }
        }

        processNext();
    }

    // Clear
    presClearBtn.addEventListener('click', function () {
        if (presState.slides.length === 0) return;
        presState.slides = [];
        presState.activeIndex = 0;
        renderPresSlideList();
        presPreviewSlide.innerHTML = '<div class="pres-preview-empty">\u0414\u043e\u0431\u0430\u0432\u044c\u0442\u0435 \u0431\u043b\u043e\u043a\u0438 \u0438\u0437 \u043f\u0430\u043b\u0438\u0442\u0440\u044b \u0441\u043b\u0435\u0432\u0430</div>';
        updatePresButtons();
    });

    // Settings save/cancel
    document.querySelector('.pres-settings-save').addEventListener('click', savePresSettings);
    document.querySelector('.pres-settings-cancel').addEventListener('click', function () {
        presSettingsOverlay.style.display = 'none';
        presEditingSlideId = null;
    });
    presSettingsOverlay.addEventListener('click', function (e) {
        if (e.target === presSettingsOverlay) {
            presSettingsOverlay.style.display = 'none';
            presEditingSlideId = null;
        }
    });

    // Commentary generation: Template
    document.querySelector('.pres-gen-template').addEventListener('click', function () {
        if (presEditingSlideId === null) return;
        var slide = null;
        for (var i = 0; i < presState.slides.length; i++) {
            if (presState.slides[i].id === presEditingSlideId) { slide = presState.slides[i]; break; }
        }
        if (!slide) return;

        var data = getActiveData();
        var headers = getActiveHeaders();
        var filteredData = filterDataByHS(data, headers, slide.hsFilter);

        var metrics = computeSlideMetrics(slide.type, filteredData, headers, slide);

        // Название товара для заголовка-вывода берём из поля «Заголовок»,
        // если пользователь вписал туда товар (напр. «кешью»), а не оставил дефолт блока
        var titleField = document.querySelector('.pres-set-title');
        var blockLabel = findPresBlock(slide.type).label;
        var typed = titleField.value.trim();
        metrics.product = (typed && typed !== blockLabel) ? typed : '';

        var actionTitle = generateActionTitle(slide.type, metrics);
        if (actionTitle) { titleField.value = actionTitle; }

        var lines = generateTemplateText(slide.type, metrics);
        if (lines.length === 0) {
            document.querySelector('.pres-set-commentary').value = 'Недостаточно данных для генерации текста';
        } else {
            document.querySelector('.pres-set-commentary').value = lines.join('\n');
        }
    });

});
