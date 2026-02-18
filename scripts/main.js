document.addEventListener('DOMContentLoaded', function () {

    /* ================================
       App State
       ================================ */
    var appState = {
        rawData: [],
        headers: [],
        fileName: '',
        processedData: [],
        processedHeaders: [],
        isProcessed: false
    };

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
    var COL_INVOICE_RUB = 'Фактурная стоимость в рублях';
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
    var COL_RECEIVER = 'Наименование получателя';

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
    var COL_INVOICE_RUB_CBR = 'Фактурная стоимость в рублях (ЦБ)';

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
    var fileList = document.querySelector('.file-list');

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

    function showLoading(fileName) {
        uploadArea.classList.add('loading');
        uploadTitle.textContent = fileName;
        uploadDesc.textContent = 'Загрузка...';

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
        uploadArea.classList.remove('loading');
    }

    function handleFile(file) {
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

    function applyParsedData(file, parsed) {
        appState.rawData = parsed.rows;
        appState.headers = parsed.headers;
        appState.fileName = file.name;
        appState.processedData = [];
        appState.isProcessed = false;

        console.log('[Delomant] Данные загружены:', parsed.rows.length, 'строк,', parsed.headers.length, 'столбцов');

        renderFileCard(file, parsed);
        updateProcessingState();
        renderColumnsList();
        updateRatioSelects();
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

        uploadTitle.textContent = file.name;
        uploadDesc.textContent = formatNumber(parsed.rows.length) + ' строк загружено';
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
       Module: Processing — Columns
       ================================ */
    var columnsList = document.querySelector('.columns-list');
    var columnsHint = document.querySelector('.columns-hint');
    var columnsSelectAll = document.querySelector('.columns-select-all');
    var columnsDeselectAll = document.querySelector('.columns-deselect-all');
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
    var ratioNumerator = document.querySelector('.ratio-numerator');
    var ratioDenominator = document.querySelector('.ratio-denominator');

    // --- Пользовательский маппинг ---
    var customMappingSub = document.querySelector('.operation-sub-custom-mapping');
    var customMappingList = document.querySelector('.custom-mapping-list');
    var customMappingAddBtn = document.querySelector('.custom-mapping-add-btn');
    var LS_CUSTOM_MAPPING_KEY = 'delomant_custom_mapping';

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
        'ND (Номер декларации)': 'Номер декларации',
        'G072 (Дата регистрации)': 'Дата регистрации',
        'GD1 (Дата выпуска)': 'Дата выпуска',
        'G011 (Направление перемещения)': 'Направление перемещения',
        'G0121 (Таможенный режим)': 'Таможенный режим',
        'G022 (Наименование отправителя)': 'Наименование отправителя',
        'G023 (Адрес отправителя)': 'Адрес отправителя',
        'G0231 (Код страны отправителя)': 'Код страны отправителя',
        'G081 (ИНН получателя)': 'ИНН получателя',
        'G082 (Наименование получателя)': 'Наименование получателя',
        'G0831 (Код страны получателя)': 'Код страны получателя',
        'G05 (Всего наименований товаров)': 'Всего наименований товаров',
        'G06 (Кол-во мест)': 'Кол-во мест',
        'G12 (Общая таможенная стоимость по ГТД)': 'Общая таможенная стоимость по ГТД',
        'G15 (Страна отправления)': 'Страна отправления',
        'G16 (Страна происхождения)': 'Страна происхождения',
        'G17B (Страна назначения)': 'Страна назначения',
        'G202 (Условие поставки)': 'Условие поставки',
        'G2021 (Пункт поставки товара)': 'Пункт поставки товара',
        'G221 (Букв.код валюты контракта)': 'Код валюты',
        'G23 (Курс валюты)': 'Курс валюты',
        'G31_1 (Наименование и характеристики товаров)': 'Наименование и характеристики товаров',
        'G31_11 (Фирма-изготовитель)': 'Фирма-изготовитель',
        'G33 (Код товара по ТН ВЭД)': 'Код товара по ТН ВЭД',
        'G34 (Код страны происхождения)': 'Код страны происхождения',
        'G35 (Вес брутто, кг)': 'Вес брутто, кг',
        'G38 (Вес нетто, кг)': 'Вес нетто, кг',
        'G42 (Фактурная стоимость)': 'Фактурная стоимость',
        'G42RUB (Фактурная стоимость в рублях)': 'Фактурная стоимость в рублях',
        'G45 (Таможенная стоимость)': 'Таможенная стоимость',
        'G46 (Статистическая стоимость, USD.)': 'Статистическая стоимость, USD',
        'USDKG (USD за КГ)': 'USD за КГ'
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
            document.querySelectorAll('.operation-list .operation-item[data-op]').forEach(function (item) {
                var op = item.getAttribute('data-op');
                if (op !== 'ratio' && op !== 'custom-mapping') {
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

    function autoMapColumns(data, headers) {
        var mapped = [];
        var missing = [];
        var newHeaders = [];

        // Для каждой записи в COLUMN_MAP ищем точное совпадение в headers
        var mapKeys = Object.keys(COLUMN_MAP);
        mapKeys.forEach(function (origName) {
            var stdName = COLUMN_MAP[origName];
            if (headers.indexOf(origName) !== -1) {
                mapped.push(origName + ' → ' + stdName);
                newHeaders.push(stdName);
            } else {
                missing.push(origName + ' (→ ' + stdName + ')');
            }
        });

        // Переименовываем и оставляем только найденные колонки
        data = data.map(function (row) {
            var newRow = {};
            mapKeys.forEach(function (origName) {
                var stdName = COLUMN_MAP[origName];
                if (headers.indexOf(origName) !== -1) {
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
                    var d = new Date(row[col]);
                    if (!isNaN(d.getTime())) {
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

        data.forEach(function (row) {
            var val = row[hsCol];
            if (val !== undefined && val !== null && val !== '') {
                var str = String(val).replace(/[\s.\-]/g, '');
                while (str.length < HS_CODE_LENGTH) { str = str + '0'; }
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
        var valueCol = findColumn(headers, COL_INVOICE);
        var weightCol = findColumn(headers, COL_WEIGHT);
        if (!valueCol || !weightCol) { return { colName: null, count: 0, error: 'Не найдены столбцы «' + COL_INVOICE + '» или «' + COL_WEIGHT + '»' }; }

        var colName = 'USD за КГ фактурная';
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
        var valueCol = findColumn(headers, COL_INVOICE_RUB);
        var weightCol = findColumn(headers, COL_WEIGHT);
        if (!valueCol || !weightCol) { return { colName: null, count: 0, error: 'Не найдены столбцы «' + COL_INVOICE_RUB + '» или «' + COL_WEIGHT + '»' }; }

        var colName = 'RUR за КГ';
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
        var invoiceCol = findColumn(headers, COL_INVOICE);

        if (!dateCol || !currCol || !invoiceCol) {
            return Promise.resolve({
                count: 0, errors: 0, colNames: [],
                error: 'Не найдены столбцы «' + COL_DATE_REG + '», «' + COL_CURRENCY_CODE + '» или «' + COL_INVOICE + '»'
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
                        log.push('RUR/кг: ' + r3.count + ' значений');
                    } else {
                        log.push('RUR/кг: ' + r3.error);
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
            }).catch(function (err) {
                renderProcessingMessage('Ошибка обработки: ' + err.message);
                console.error('Processing error:', err);
            }).then(function () {
                applyBtn.disabled = false;
                applyBtn.textContent = 'Применить обработку';
            });

            } catch (err) {
                renderProcessingMessage('Ошибка обработки: ' + err.message);
                console.error('Processing error:', err);
                applyBtn.disabled = false;
                applyBtn.textContent = 'Применить обработку';
            }
        });
    }

    function renderProcessingMessage(text) {
        var container = document.querySelector('.processing-preview');
        container.innerHTML =
            '<div class="preview-placeholder">' +
            '  <p class="preview-placeholder-text">' + text + '</p>' +
            '</div>';
    }

    function renderPreviewResult(data, log, headers) {
        var container = document.querySelector('.processing-preview');
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
        html += '</div>';
        html += '<button class="btn btn-outline processing-download-report">Скачать отчёт об обработке</button>';

        container.innerHTML = html;

        container.querySelector('.processing-download-csv').addEventListener('click', function () {
            downloadProcessedCSV();
        });
        container.querySelector('.processing-download-xlsx').addEventListener('click', function () {
            downloadProcessedXLSX();
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

    function downloadProcessedCSV() {
        var data = appState.processedData;
        if (data.length === 0) { return; }

        var headers = getActiveHeaders();
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
        triggerDownload(blob, baseFileName() + '_processed.csv');
    }

    function downloadProcessedXLSX() {
        var data = appState.processedData;
        var headers = getActiveHeaders();
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
        XLSX.utils.book_append_sheet(wb, ws, 'Processed');

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
                triggerDownload(blob, baseFileName() + '_processed.xlsx');
            }).catch(function () {
                // Fallback: скачать без freeze pane
                var blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                triggerDownload(blob, baseFileName() + '_processed.xlsx');
            });
        } catch (e) {
            // JSZip не доступен — скачать как есть
            var blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            triggerDownload(blob, baseFileName() + '_processed.xlsx');
        }
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

    if (analysisButtons.length > 0) {
        analysisButtons[0].addEventListener('click', function () { runAnalysis('growth'); });
        analysisButtons[1].addEventListener('click', function () { runAnalysis('statistics'); });
        analysisButtons[2].addEventListener('click', function () { runAnalysis('trends'); });
        if (analysisButtons[3]) analysisButtons[3].addEventListener('click', function () { runAnalysis('pivot'); });
        if (analysisButtons[4]) analysisButtons[4].addEventListener('click', function () { runAnalysis('cagr'); });
        if (analysisButtons[5]) analysisButtons[5].addEventListener('click', function () { runAnalysis('sankey'); });
        if (analysisButtons[6]) analysisButtons[6].addEventListener('click', function () { runAnalysis('weighted-price'); });
        if (analysisButtons[7]) analysisButtons[7].addEventListener('click', function () { runAnalysis('classification'); });
    }

    function runAnalysis(type) {
        try {
            var data = getActiveData();
            var headers = getActiveHeaders();
            if (data.length === 0) {
                analysisResults.innerHTML =
                    '<div class="analysis-empty">' +
                    '  <p>Сначала загрузите данные</p>' +
                    '</div>';
                return;
            }

            var numericCols = getNumericColumns(data, headers);

            /* Config-based features (render form, attach handlers) */
            if (type === 'pivot') { renderPivotConfig(headers, numericCols); return; }
            if (type === 'cagr') { renderCAGRConfig(headers, numericCols); return; }
            if (type === 'sankey') { renderSankeyConfig(headers, numericCols); return; }
            if (type === 'weighted-price') { renderWeightedPriceConfig(headers, numericCols); return; }
            if (type === 'classification') { renderClassificationAnalysis(); return; }

            if (numericCols.length === 0) {
                analysisResults.innerHTML =
                    '<div class="analysis-empty">' +
                    '  <p>Числовые столбцы не найдены</p>' +
                    '</div>';
                return;
            }

            var html = '';
            if (type === 'growth') { html = renderGrowthAnalysis(data, numericCols); }
            if (type === 'statistics') { html = renderStatisticsAnalysis(data, numericCols); }
            if (type === 'trends') { html = renderTrendsAnalysis(data, numericCols); }

            analysisResults.innerHTML = html;
        } catch (err) {
            analysisResults.innerHTML =
                '<div class="analysis-empty"><p>Ошибка анализа: ' + err.message + '</p></div>';
            console.error('Analysis error:', err);
        }
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

    function renderSankeyDiagram(sankeyData) {
        var W = 900, H = 600;
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
        var unit = valField.indexOf('USD') !== -1 ? 'USD/кг' : 'руб./кг';

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

});
