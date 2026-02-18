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
    var COL_SENDER = 'Наименование отправителя';
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

    var COMPANY_COLUMNS = [COL_SENDER, COL_RECEIVER, COL_MANUFACTURER];

    function normalizeCompanyNames(data, headers) {
        var count = 0;
        var targetCols = [];
        COMPANY_COLUMNS.forEach(function (c) {
            if (headers.indexOf(c) !== -1) { targetCols.push(c); }
        });
        if (targetCols.length === 0) { return 0; }

        data.forEach(function (row) {
            targetCols.forEach(function (col) {
                var val = row[col];
                if (typeof val !== 'string' || !val.trim()) { return; }
                var norm = val.trim().toUpperCase()
                    .replace(/\.\s*/g, ' ')   // S.A. → S A  → SA после trim
                    .replace(/\s+/g, ' ')      // лишние пробелы
                    .replace(/,\s*$/, '')       // запятая в конце
                    .trim();
                if (norm !== val) {
                    row[col] = norm;
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
            if (ops.indexOf('normalize-companies') !== -1) {
                var ncCount = normalizeCompanyNames(data, headers);
                log.push('Названия компаний: нормализовано ' + ncCount + ' значений');
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
        if (analysisButtons[0]) analysisButtons[0].addEventListener('click', function () { runAnalysis('volumes'); });
        if (analysisButtons[1]) analysisButtons[1].addEventListener('click', function () { runAnalysis('countries'); });
        if (analysisButtons[2]) analysisButtons[2].addEventListener('click', function () { runAnalysis('priceDynamics'); });
        if (analysisButtons[3]) analysisButtons[3].addEventListener('click', function () { runAnalysis('importStructure'); });
        if (analysisButtons[4]) analysisButtons[4].addEventListener('click', function () { runAnalysis('manufacturerStructure'); });
        if (analysisButtons[5]) analysisButtons[5].addEventListener('click', function () { runAnalysis('quarterlyPrices'); });
    }

    function runAnalysis(type) {
        try {
            var data = getActiveData();
            var headers = getActiveHeaders();
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

            analysisResults.innerHTML = '';
        } catch (err) {
            analysisResults.innerHTML =
                '<div class="analysis-empty"><p>Ошибка анализа: ' + err.message + '</p></div>';
            console.error('Analysis error:', err);
        }
    }

    // --- Анализ: Объёмы и стоимость по периодам ---
    function renderVolumesAnalysis(data, headers) {
        var weightCol = findColumn(headers, COL_WEIGHT);
        var statUsdCol = findColumn(headers, COL_STAT_USD);
        var invoiceRubCol = findColumn(headers, COL_INVOICE_RUB);
        var yearCol = findColumn(headers, COL_YEAR);
        var quarterCol = findColumn(headers, COL_QUARTER);

        if (!weightCol && !statUsdCol && !invoiceRubCol) {
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

        data.forEach(function (row) {
            var year = String(row[yearCol] || '').trim();
            if (!year) { return; }

            var weight = Number(row[weightCol]) || 0;
            var usd = Number(row[statUsdCol]) || 0;
            var rub = Number(row[invoiceRubCol]) || 0;

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
            if (invoiceRubCol) { cagrRub = calcCAGR(byYear[fy].rub, byYear[ly].rub, cagrYears); }
        }

        // --- Таблица по годам ---
        var html = '<div class="analysis-section">';
        html += '<h3 class="analysis-section-title">По годам</h3>';
        html += '<div class="data-table-wrapper"><table class="data-table">';
        html += '<thead><tr><th>Год</th>';
        if (weightCol) { html += '<th>Объём (тыс. тонн)</th>'; }
        if (statUsdCol) { html += '<th>Стоимость (тыс. USD)</th>'; }
        if (invoiceRubCol) { html += '<th>Стоимость (тыс. руб.)</th>'; }
        html += '</tr></thead><tbody>';
        yearKeys.forEach(function (y) {
            var d = byYear[y];
            var label = (y === partialYear) ? partialLabel : y;
            html += '<tr><td>' + label + '</td>';
            if (weightCol) { html += '<td class="numeric">' + formatNumber(round2(d.weight / 1000)) + '</td>'; }
            if (statUsdCol) { html += '<td class="numeric">' + formatNumber(round2(d.usd / 1000)) + '</td>'; }
            if (invoiceRubCol) { html += '<td class="numeric">' + formatNumber(round2(d.rub / 1000)) + '</td>'; }
            html += '</tr>';
        });
        // Строка CAGR
        if (cagrYears > 0) {
            html += '<tr style="font-weight:600;border-top:2px solid var(--color-border)"><td>CAGR</td>';
            if (weightCol) { html += '<td class="numeric">' + (cagrWeight !== null ? round2(cagrWeight) + '%' : '—') + '</td>'; }
            if (statUsdCol) { html += '<td class="numeric">' + (cagrUsd !== null ? round2(cagrUsd) + '%' : '—') + '</td>'; }
            if (invoiceRubCol) { html += '<td class="numeric">' + (cagrRub !== null ? round2(cagrRub) + '%' : '—') + '</td>'; }
            html += '</tr>';
        }
        html += '</tbody></table></div></div>';

        // --- Таблица по кварталам ---
        if (quarterKeys.length > 0) {
            html += '<div class="analysis-section">';
            html += '<h3 class="analysis-section-title">По кварталам</h3>';
            html += '<div class="data-table-wrapper"><table class="data-table">';
            html += '<thead><tr><th>Период</th>';
            if (weightCol) { html += '<th>Объём (тыс. тонн)</th>'; }
            if (statUsdCol) { html += '<th>Стоимость (тыс. USD)</th>'; }
            if (invoiceRubCol) { html += '<th>Стоимость (тыс. руб.)</th>'; }
            html += '</tr></thead><tbody>';
            quarterKeys.forEach(function (key) {
                var d = byQuarter[key];
                html += '<tr><td>' + key + '</td>';
                if (weightCol) { html += '<td class="numeric">' + formatNumber(round2(d.weight / 1000)) + '</td>'; }
                if (statUsdCol) { html += '<td class="numeric">' + formatNumber(round2(d.usd / 1000)) + '</td>'; }
                if (invoiceRubCol) { html += '<td class="numeric">' + formatNumber(round2(d.rub / 1000)) + '</td>'; }
                html += '</tr>';
            });
            html += '</tbody></table></div></div>';
        }

        // --- Графики по метрикам (по 1 на каждую) ---
        var metrics = [];
        if (weightCol) { metrics.push({ key: 'weight', title: 'тыс. тонн', unit: 'тыс. тонн', div: 1000, cagr: cagrWeight }); }
        if (statUsdCol) { metrics.push({ key: 'usd', title: 'млн долл. США', unit: 'млн USD', div: 1000000, cagr: cagrUsd }); }
        if (invoiceRubCol) { metrics.push({ key: 'rub', title: 'млн руб.', unit: 'млн руб.', div: 1000000, cagr: cagrRub }); }

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

        // Подготовим данные для экспорта
        var exportRows = [];

        // Годовые данные
        exportRows.push({ 'Период': '--- По годам ---' });
        yearKeys.forEach(function (y) {
            var d = byYear[y];
            var label = (y === partialYear) ? partialLabel : y;
            var row = { 'Период': label };
            if (weightCol) { row['Объём (тыс. тонн)'] = round2(d.weight / 1000); }
            if (statUsdCol) { row['Стоимость (тыс. USD)'] = round2(d.usd / 1000); }
            if (invoiceRubCol) { row['Стоимость (тыс. руб.)'] = round2(d.rub / 1000); }
            exportRows.push(row);
        });
        // CAGR в экспорт
        if (cagrYears > 0) {
            var cagrRow = { 'Период': 'CAGR' };
            if (weightCol) { cagrRow['Объём (тыс. тонн)'] = cagrWeight !== null ? round2(cagrWeight) + '%' : ''; }
            if (statUsdCol) { cagrRow['Стоимость (тыс. USD)'] = cagrUsd !== null ? round2(cagrUsd) + '%' : ''; }
            if (invoiceRubCol) { cagrRow['Стоимость (тыс. руб.)'] = cagrRub !== null ? round2(cagrRub) + '%' : ''; }
            exportRows.push(cagrRow);
        }

        // Квартальные данные
        if (quarterKeys.length > 0) {
            exportRows.push({ 'Период': '' });
            exportRows.push({ 'Период': '--- По кварталам ---' });
            quarterKeys.forEach(function (key) {
                var d = byQuarter[key];
                var row = { 'Период': key };
                if (weightCol) { row['Объём (тыс. тонн)'] = round2(d.weight / 1000); }
                if (statUsdCol) { row['Стоимость (тыс. USD)'] = round2(d.usd / 1000); }
                if (invoiceRubCol) { row['Стоимость (тыс. руб.)'] = round2(d.rub / 1000); }
                exportRows.push(row);
            });
        }

        var exportHeaders = ['Период'];
        if (weightCol) { exportHeaders.push('Объём (тыс. тонн)'); }
        if (statUsdCol) { exportHeaders.push('Стоимость (тыс. USD)'); }
        if (invoiceRubCol) { exportHeaders.push('Стоимость (тыс. руб.)'); }

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
        XLSX.writeFile(wb, baseFileName() + '_' + name + '.xlsx');
    }

    function exportAnalysisCSV(rows, headers, name) {
        var lines = [headers.join(CSV_SEPARATOR)];
        rows.forEach(function (row) {
            var vals = headers.map(function (h) { return row[h] != null ? String(row[h]) : ''; });
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
        var countryCol = findColumn(headers, 'Страна отправления') || findColumn(headers, 'Страна происхождения');
        var weightCol = findColumn(headers, COL_WEIGHT);
        var statUsdCol = findColumn(headers, COL_STAT_USD);

        if (!countryCol) {
            analysisResults.innerHTML = '<div class="analysis-empty"><p>Не найден столбец «Страна отправления» или «Страна происхождения». Выполните обработку с маппингом.</p></div>';
            return;
        }

        // Группируем по странам
        var byCountry = {};
        var totalWeight = 0;
        var totalUsd = 0;

        data.forEach(function (row) {
            var country = String(row[countryCol] || '').trim();
            if (!country) { return; }

            var weight = Number(row[weightCol]) || 0;
            var usd = Number(row[statUsdCol]) || 0;

            if (!byCountry[country]) { byCountry[country] = { weight: 0, usd: 0 }; }
            byCountry[country].weight += weight;
            byCountry[country].usd += usd;
            totalWeight += weight;
            totalUsd += usd;
        });

        // Сортируем по весу (по убыванию)
        var countries = Object.keys(byCountry).sort(function (a, b) {
            return byCountry[b].weight - byCountry[a].weight;
        });

        // --- Таблица ---
        var html = '<div class="analysis-section">';
        html += '<h3 class="analysis-section-title">Объёмы по странам (' + countryCol + ')</h3>';
        html += '<div class="data-table-wrapper"><table class="data-table">';
        html += '<thead><tr><th>Страна</th>';
        if (weightCol) { html += '<th>Объём (тыс. тонн)</th><th>Доля, %</th>'; }
        if (statUsdCol) { html += '<th>Стоимость (тыс. USD)</th><th>Доля, %</th>'; }
        html += '</tr></thead><tbody>';

        countries.forEach(function (c) {
            var d = byCountry[c];
            var weightPct = totalWeight > 0 ? round2(d.weight / totalWeight * 100) : 0;
            var usdPct = totalUsd > 0 ? round2(d.usd / totalUsd * 100) : 0;
            html += '<tr><td>' + c + '</td>';
            if (weightCol) {
                html += '<td class="numeric">' + formatNumber(round2(d.weight / 1000)) + '</td>';
                html += '<td class="numeric">' + weightPct + '%</td>';
            }
            if (statUsdCol) {
                html += '<td class="numeric">' + formatNumber(round2(d.usd / 1000)) + '</td>';
                html += '<td class="numeric">' + usdPct + '%</td>';
            }
            html += '</tr>';
        });

        // Итого
        html += '<tr style="font-weight:600;border-top:2px solid var(--color-border)"><td>Итого</td>';
        if (weightCol) {
            html += '<td class="numeric">' + formatNumber(round2(totalWeight / 1000)) + '</td>';
            html += '<td class="numeric">100%</td>';
        }
        if (statUsdCol) {
            html += '<td class="numeric">' + formatNumber(round2(totalUsd / 1000)) + '</td>';
            html += '<td class="numeric">100%</td>';
        }
        html += '</tr>';
        html += '</tbody></table></div></div>';

        // --- Горизонтальный столбчатый график (топ-10 по весу) ---
        if (weightCol && countries.length >= 2) {
            var top = countries.slice(0, 10);
            var barHeight = 28;
            var maxLabelLen = 0;
            top.forEach(function (c) { if (c.length > maxLabelLen) { maxLabelLen = c.length; } });
            var labelWidth = Math.max(160, maxLabelLen * 7.5 + 16);
            var chartWidth = Math.max(700, labelWidth + 500);
            var padding = { top: 10, right: 80, bottom: 10, left: labelWidth };
            var chartHeight = padding.top + top.length * (barHeight + 8) + padding.bottom;
            var innerW = chartWidth - padding.left - padding.right;
            var maxVal = byCountry[top[0]].weight / 1000;
            if (maxVal === 0) { maxVal = 1; }

            html += '<div class="analysis-section">';
            html += '<h3 class="analysis-section-title">Топ-10 стран по объёму (тыс. тонн)</h3>';
            html += '<svg class="analysis-chart" width="' + chartWidth + '" height="' + chartHeight + '" viewBox="0 0 ' + chartWidth + ' ' + chartHeight + '">';
            html += '<style>text { font-family: ' + CHART_FONT + '; font-size: 12px; fill: ' + CHART_COLORS.text + '; }</style>';

            top.forEach(function (c, i) {
                var val = round2(byCountry[c].weight / 1000);
                var pct = totalWeight > 0 ? round2(byCountry[c].weight / totalWeight * 100) : 0;
                var bw = (val / maxVal) * innerW;
                var y = padding.top + i * (barHeight + 8);

                // Название страны
                html += '<text x="' + (padding.left - 8) + '" y="' + (y + barHeight / 2 + 4) + '" text-anchor="end" font-size="11" fill="' + CHART_COLORS.text + '">' + c + '</text>';
                // Столбец
                html += '<rect x="' + padding.left + '" y="' + y + '" width="' + bw + '" height="' + barHeight + '" fill="' + CHART_COLORS.primary + '" rx="3"/>';
                // Значение + процент
                html += '<text x="' + (padding.left + bw + 6) + '" y="' + (y + barHeight / 2 + 4) + '" font-size="11" fill="' + CHART_COLORS.textMuted + '">' + formatNumber(val) + ' (' + pct + '%)</text>';
            });

            html += '</svg>';
            html += '<button class="btn btn-secondary analysis-export-chart-png" style="margin-top:8px;font-size:12px">Скачать график PNG</button>';
            html += '</div>';
        }

        // --- Кнопки экспорта ---
        html += '<div class="processing-export" style="margin-top:20px">';
        html += '<button class="btn btn-primary analysis-export-xlsx">Скачать XLSX</button>';
        html += '<button class="btn btn-secondary analysis-export-csv">Скачать CSV</button>';
        html += '</div>';

        analysisResults.innerHTML = html;

        // Обработчик экспорта графика PNG
        var chartPngBtn = analysisResults.querySelector('.analysis-export-chart-png');
        if (chartPngBtn) {
            chartPngBtn.addEventListener('click', function () {
                var svg = analysisResults.querySelector('.analysis-chart');
                if (svg) { exportChartPNG(svg, baseFileName() + '_countries_chart.png'); }
            });
        }

        // Подготовка данных для экспорта
        var exportRows = [];
        countries.forEach(function (c) {
            var d = byCountry[c];
            var row = { 'Страна': c };
            if (weightCol) {
                row['Объём (тыс. тонн)'] = round2(d.weight / 1000);
                row['Доля по весу, %'] = totalWeight > 0 ? round2(d.weight / totalWeight * 100) : 0;
            }
            if (statUsdCol) {
                row['Стоимость (тыс. USD)'] = round2(d.usd / 1000);
                row['Доля по USD, %'] = totalUsd > 0 ? round2(d.usd / totalUsd * 100) : 0;
            }
            exportRows.push(row);
        });

        var exportHeaders = ['Страна'];
        if (weightCol) { exportHeaders.push('Объём (тыс. тонн)', 'Доля по весу, %'); }
        if (statUsdCol) { exportHeaders.push('Стоимость (тыс. USD)', 'Доля по USD, %'); }

        analysisResults.querySelector('.analysis-export-xlsx').addEventListener('click', function () {
            exportAnalysisXLSX(exportRows, exportHeaders, 'countries');
        });
        analysisResults.querySelector('.analysis-export-csv').addEventListener('click', function () {
            exportAnalysisCSV(exportRows, exportHeaders, 'countries');
        });
    }

    // --- Анализ: Динамика цен по странам ---
    var LINE_COLORS = ['#2563EB', '#DC2626', '#16A34A', '#F59E0B', '#8B5CF6',
                       '#EC4899', '#0891B2', '#EA580C', '#4F46E5', '#059669'];

    function renderPriceDynamicsAnalysis(data, headers) {
        var countryCol = findColumn(headers, 'Страна отправления') || findColumn(headers, 'Страна происхождения');
        var customsCol = findColumn(headers, COL_CUSTOMS);
        var weightCol = findColumn(headers, COL_WEIGHT);
        var yearCol = findColumn(headers, COL_YEAR);

        if (!countryCol) {
            analysisResults.innerHTML = '<div class="analysis-empty"><p>Не найден столбец «Страна отправления» или «Страна происхождения».</p></div>';
            return;
        }
        if (!customsCol || !weightCol) {
            analysisResults.innerHTML = '<div class="analysis-empty"><p>Не найдены столбцы «Таможенная стоимость» и/или «Вес нетто, кг».</p></div>';
            return;
        }
        if (!yearCol) {
            analysisResults.innerHTML = '<div class="analysis-empty"><p>Не найден столбец «Год». Выполните обработку с извлечением дат.</p></div>';
            return;
        }

        // Группировка: страна → год → { customs, weight }
        var byCountryYear = {};
        var totalWeightByCountry = {};
        var yearsSet = {};

        data.forEach(function (row) {
            var country = String(row[countryCol] || '').trim();
            var year = String(row[yearCol] || '').trim();
            if (!country || !year) { return; }

            var customs = Number(row[customsCol]) || 0;
            var weight = Number(row[weightCol]) || 0;

            if (!byCountryYear[country]) { byCountryYear[country] = {}; }
            if (!byCountryYear[country][year]) { byCountryYear[country][year] = { customs: 0, weight: 0 }; }
            byCountryYear[country][year].customs += customs;
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
                    priceData[c][y] = round2(d.customs / d.weight);
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
            html += '<h3 class="analysis-section-title">Таможенная стоимость, долл. США/кг</h3>';
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
            var xStep = years.length > 1 ? innerW / (years.length - 1) : innerW / 2;
            years.forEach(function (y, i) {
                var x = pad.left + (years.length > 1 ? xStep * i : innerW / 2);
                html += '<text x="' + x + '" y="' + (chartH - pad.bottom + 25) + '" text-anchor="middle" font-size="11" fill="' + CHART_COLORS.textMuted + '">' + y + '</text>';
            });

            // Линии для каждой страны
            top.forEach(function (c, ci) {
                var color = LINE_COLORS[ci % LINE_COLORS.length];
                var points = [];
                years.forEach(function (y, yi) {
                    var price = priceData[c][y];
                    if (price != null) {
                        var x = pad.left + (years.length > 1 ? xStep * yi : innerW / 2);
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

        var senderCol = findColumn(headers, sourceColName);
        var receiverCol = findColumn(headers, targetColName);
        var weightCol = findColumn(headers, COL_WEIGHT);
        var yearCol = findColumn(headers, COL_YEAR);

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
            var s = name.trim().toUpperCase();
            // Убираем точки в аббревиатурах: S.A. → SA, Co. → Co, LTD. → LTD
            s = s.replace(/\.\s*/g, ' ').replace(/\s+/g, ' ').trim();
            // Убираем запятые в конце
            s = s.replace(/,\s*$/, '');
            return s;
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
            if (otherSW > 0) { leftNodes.push('Прочие отпр.'); senderTotals['Прочие отпр.'] = otherSW; }
            rightNodes = topR.slice();
            if (otherRW > 0) { rightNodes.push('Прочие пол.'); receiverTotals['Прочие пол.'] = otherRW; }

            var flowMap = {};
            Object.keys(flows).forEach(function (fk) {
                var parts = fk.split(KEY_SEPARATOR);
                var s = otherSSet[parts[0]] ? 'Прочие отпр.' : parts[0];
                var r = otherRSet[parts[1]] ? 'Прочие пол.' : parts[1];
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
            var pct = totalWeight > 0 ? round2(f.value / 1000 / (totalWeight / 1000) * 100) : 0;
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
        var customsCol = findColumn(headers, COL_CUSTOMS);
        var invoiceRubCol = findColumn(headers, COL_INVOICE_RUB);
        var yearCol = findColumn(headers, COL_YEAR);
        var quarterCol = findColumn(headers, COL_QUARTER);

        if (!weightCol) {
            analysisResults.innerHTML = '<div class="analysis-empty"><p>Не найден столбец «Вес нетто, кг».</p></div>';
            return;
        }
        if (!customsCol && !invoiceRubCol) {
            analysisResults.innerHTML = '<div class="analysis-empty"><p>Не найдены столбцы «Таможенная стоимость» или «Фактурная стоимость в рублях».</p></div>';
            return;
        }
        if (!yearCol || !quarterCol) {
            analysisResults.innerHTML = '<div class="analysis-empty"><p>Не найдены столбцы «Год» и «КВАРТАЛ». Выполните обработку с извлечением дат.</p></div>';
            return;
        }

        // Группируем: год → квартал → { customs, rub, weight }
        var byYearQuarter = {};
        var byYear = {};
        var yearsSet = {};

        data.forEach(function (row) {
            var year = String(row[yearCol] || '').trim();
            var q = String(row[quarterCol] || '').trim();
            if (!year || !q) { return; }

            var weight = Number(row[weightCol]) || 0;
            var customs = customsCol ? (Number(row[customsCol]) || 0) : 0;
            var rub = invoiceRubCol ? (Number(row[invoiceRubCol]) || 0) : 0;

            yearsSet[year] = true;

            if (!byYearQuarter[year]) { byYearQuarter[year] = {}; }
            if (!byYearQuarter[year][q]) { byYearQuarter[year][q] = { customs: 0, rub: 0, weight: 0 }; }
            byYearQuarter[year][q].customs += customs;
            byYearQuarter[year][q].rub += rub;
            byYearQuarter[year][q].weight += weight;

            if (!byYear[year]) { byYear[year] = { customs: 0, rub: 0, weight: 0 }; }
            byYear[year].customs += customs;
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
                        usd: customsCol ? round2(d.customs / d.weight) : null,
                        rub: invoiceRubCol ? round2(d.rub / d.weight) : null
                    };
                }
            });
            var yd = byYear[y];
            if (yd && yd.weight > 0) {
                avgPrices[y] = {
                    usd: customsCol ? round2(yd.customs / yd.weight) : null,
                    rub: invoiceRubCol ? round2(yd.rub / yd.weight) : null
                };
            }
        });

        // Определяем метрики
        var metrics = [];
        if (invoiceRubCol) { metrics.push({ key: 'rub', title: 'Поквартальная динамика цен, руб./кг', unit: 'руб./кг' }); }
        if (customsCol) { metrics.push({ key: 'usd', title: 'Поквартальная динамика цен, долл. США/кг', unit: 'USD/кг' }); }

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
            var xStep = quarters.length > 1 ? innerW / (quarters.length - 1) : innerW / 2;
            quarters.forEach(function (q, qi) {
                var x = pad.left + xStep * qi;
                html += '<text x="' + x + '" y="' + (chartH - pad.bottom + 25) + '" text-anchor="middle" font-size="11" fill="' + CHART_COLORS.textMuted + '">Q' + q + '</text>';
            });

            // Линии для каждого года
            years.forEach(function (y, yi) {
                var color = YEAR_COLORS[yi % YEAR_COLORS.length];
                var points = [];
                quarters.forEach(function (q, qi) {
                    var pd = priceData[y][q];
                    if (pd && pd[m.key] != null) {
                        var x = pad.left + xStep * qi;
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
                if (customsCol) { row['USD/кг'] = pd && pd.usd != null ? pd.usd : ''; }
                if (invoiceRubCol) { row['Руб./кг'] = pd && pd.rub != null ? pd.rub : ''; }
                exportRows.push(row);
            });
            // Средневзвешенная
            var avg = avgPrices[y];
            var avgRow = { 'Год': y, 'Квартал': 'Средневзвешенная' };
            if (customsCol) { avgRow['USD/кг'] = avg && avg.usd != null ? avg.usd : ''; }
            if (invoiceRubCol) { avgRow['Руб./кг'] = avg && avg.rub != null ? avg.rub : ''; }
            exportRows.push(avgRow);
            exportRows.push({ 'Год': '', 'Квартал': '' });
        });

        var exportHeaders = ['Год', 'Квартал'];
        if (customsCol) { exportHeaders.push('USD/кг'); }
        if (invoiceRubCol) { exportHeaders.push('Руб./кг'); }

        analysisResults.querySelector('.analysis-export-xlsx').addEventListener('click', function () {
            exportAnalysisXLSX(exportRows, exportHeaders, 'quarterly_prices');
        });
        analysisResults.querySelector('.analysis-export-csv').addEventListener('click', function () {
            exportAnalysisCSV(exportRows, exportHeaders, 'quarterly_prices');
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
