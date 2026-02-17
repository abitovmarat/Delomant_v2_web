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
       Navigation
       ================================ */
    var navItems = document.querySelectorAll('.sidebar-nav-item');
    var modules = document.querySelectorAll('.module');

    navItems.forEach(function (item) {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            var targetId = this.getAttribute('href').substring(1);

            navItems.forEach(function (nav) { nav.classList.remove('active'); });
            this.classList.add('active');

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
            var h = headers[i].toLowerCase();
            if (h.indexOf('date') !== -1 || h.indexOf('дата') !== -1 ||
                h.indexOf('time') !== -1 || h.indexOf('период') !== -1) {
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
                if (columnsList.scrollHeight > 300) {
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
        var priceCol = findColumn(headers, 'Таможенная стоимость');
        var weightCol = findColumn(headers, 'Вес нетто, кг');
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
        var dateCols = headers.filter(function (h) {
            var l = h.toLowerCase();
            return l.indexOf('date') !== -1 || l.indexOf('дата') !== -1 ||
                l.indexOf('time') !== -1 || l.indexOf('период') !== -1;
        });
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
        var hsCol = findColumn(headers, 'Код товара по ТН ВЭД');
        if (!hsCol) { return count; }

        data.forEach(function (row) {
            var val = row[hsCol];
            if (val !== undefined && val !== null && val !== '') {
                var str = String(val).replace(/[\s.\-]/g, '');
                // Дополняем нулями до 10 знаков
                while (str.length < 10) { str = str + '0'; }
                if (str.length > 10) { str = str.substring(0, 10); }
                if (row[hsCol] !== str) {
                    row[hsCol] = str;
                    count++;
                }
            }
        });
        return count;
    }

    function calcUsdPerKgStat(data, headers) {
        var valueCol = findColumn(headers, 'Статистическая стоимость, USD');
        var weightCol = findColumn(headers, 'Вес нетто, кг');
        if (!valueCol || !weightCol) { return { colName: null, count: 0, error: 'Не найдены столбцы «Статистическая стоимость, USD» или «Вес нетто, кг»' }; }

        var colName = 'USD за КГ статистическая';
        var count = 0;
        data.forEach(function (row) {
            var v = Number(row[valueCol]);
            var w = Number(row[weightCol]);
            if (!isNaN(v) && !isNaN(w) && w > 0) {
                row[colName] = Math.round((v / w) * 100) / 100;
                count++;
            } else {
                row[colName] = '';
            }
        });
        return { colName: colName, count: count };
    }

    function calcUsdPerKgInvoice(data, headers) {
        var valueCol = findColumn(headers, 'Фактурная стоимость');
        var weightCol = findColumn(headers, 'Вес нетто, кг');
        if (!valueCol || !weightCol) { return { colName: null, count: 0, error: 'Не найдены столбцы «Фактурная стоимость» или «Вес нетто, кг»' }; }

        var colName = 'USD за КГ фактурная';
        var count = 0;
        data.forEach(function (row) {
            var v = Number(row[valueCol]);
            var w = Number(row[weightCol]);
            if (!isNaN(v) && !isNaN(w) && w > 0) {
                row[colName] = Math.round((v / w) * 100) / 100;
                count++;
            } else {
                row[colName] = '';
            }
        });
        return { colName: colName, count: count };
    }

    function calcRurPerKg(data, headers) {
        var valueCol = findColumn(headers, 'Фактурная стоимость в рублях');
        var weightCol = findColumn(headers, 'Вес нетто, кг');
        if (!valueCol || !weightCol) { return { colName: null, count: 0, error: 'Не найдены столбцы «Фактурная стоимость в рублях» или «Вес нетто, кг»' }; }

        var colName = 'RUR за КГ';
        var count = 0;
        data.forEach(function (row) {
            var v = Number(row[valueCol]);
            var w = Number(row[weightCol]);
            if (!isNaN(v) && !isNaN(w) && w > 0) {
                row[colName] = Math.round((v / w) * 100) / 100;
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
                row[colName] = Math.round((n / d) * 100) / 100;
                count++;
            } else {
                row[colName] = '';
            }
        });
        return { colName: colName, count: count };
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
            var d = new Date((val - 25569) * 86400000);
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
        var dateCol = findColumn(headers, 'Дата регистрации') || findColumn(headers, 'Дата выпуска');
        if (!dateCol) { return { headers: headers, count: 0, error: 'Не найдены столбцы «Дата регистрации» или «Дата выпуска»' }; }

        var count = 0;
        var newCols = ['Месяц', 'КВАРТАЛ', 'Год'];
        newCols.forEach(function (c) {
            if (headers.indexOf(c) === -1) { headers.push(c); }
        });

        data.forEach(function (row) {
            var d = parseDate(row[dateCol]);
            if (d) {
                var mon = d.getMonth() + 1;
                row['Месяц'] = MONTH_NAMES[mon - 1];
                row['КВАРТАЛ'] = getQuarter(mon);
                row['Год'] = d.getFullYear();
                count++;
            } else {
                row['Месяц'] = '';
                row['КВАРТАЛ'] = '';
                row['Год'] = '';
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
        if (dataHeaders.indexOf('ИНН получателя') !== -1) {
            lookupKeyData.value = 'ИНН получателя';
        }
        if (parsed.headers.indexOf('ИНН получателя') !== -1) {
            lookupKeyRef.value = 'ИНН получателя';
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

            // 6. Фильтрация столбцов
            // Обновляем selectedCols с учётом маппинга и новых столбцов
            var finalCols = [];
            headers.forEach(function (h) {
                // Включаем столбец если он новый (ratio) или был выбран пользователем
                var origIdx = appState.headers.indexOf(h);
                if (origIdx === -1) {
                    // Новый столбец (от маппинга или расчёта) — включаем
                    finalCols.push(h);
                } else if (selectedCols.indexOf(appState.headers[origIdx]) !== -1) {
                    finalCols.push(h);
                }
            });
            // Для маппинга: столбец мог быть переименован
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
        html += '<button class="btn btn-primary processing-download-csv">Скачать CSV</button>';
        html += '<button class="btn btn-secondary processing-download-xlsx">Скачать XLSX</button>';
        html += '<button class="btn btn-secondary processing-download-report">Скачать отчёт</button>';
        html += '</div>';

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

        var blob = new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8' });
        triggerDownload(blob, appState.fileName.replace(/\.[^.]+$/, '') + '_report.txt');
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
        var csv = headers.join(';') + '\n';
        data.forEach(function (row) {
            var line = headers.map(function (h) {
                var val = row[h] !== undefined ? String(row[h]) : '';
                if (val.indexOf(';') !== -1 || val.indexOf('"') !== -1) {
                    val = '"' + val.replace(/"/g, '""') + '"';
                }
                return val;
            });
            csv += line.join(';') + '\n';
        });

        var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        triggerDownload(blob, appState.fileName.replace(/\.[^.]+$/, '') + '_processed.csv');
    }

    function downloadProcessedXLSX() {
        var data = appState.processedData;
        if (data.length === 0 || typeof XLSX === 'undefined') { return; }

        var ws = XLSX.utils.json_to_sheet(data, { header: getActiveHeaders() });
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Processed');
        XLSX.writeFile(wb, appState.fileName.replace(/\.[^.]+$/, '') + '_processed.xlsx');
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
    }

    function runAnalysis(type) {
        var data = getActiveData();
        if (data.length === 0) {
            analysisResults.innerHTML =
                '<div class="analysis-empty">' +
                '  <p>Сначала загрузите данные</p>' +
                '</div>';
            return;
        }

        var numericCols = getNumericColumns(data, getActiveHeaders());
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
            var direction = slope > 0.001 ? 'Восходящий' : (slope < -0.001 ? 'Нисходящий' : 'Стабильный');
            var icon = slope > 0.001 ? '📈' : (slope < -0.001 ? '📉' : '➡️');

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
            svg += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (width - padR) + '" y2="' + gy + '" stroke="#E2E8F0" stroke-width="1"/>';
            svg += '<text x="' + (padL - 8) + '" y="' + (gy + 4) + '" text-anchor="end" font-size="11" fill="#64748B" font-family="DejaVu Sans, sans-serif">' + gVal.toFixed(0) + '</text>';
        }

        // X labels
        var step = Math.max(1, Math.floor(values.length / 8));
        for (var xi = 0; xi < values.length; xi += step) {
            var lx = scaleX(xi);
            var label = String(values[xi].x);
            if (label.length > 10) { label = label.substring(0, 10); }
            svg += '<text x="' + lx + '" y="' + (height - 8) + '" text-anchor="middle" font-size="11" fill="#64748B" font-family="DejaVu Sans, sans-serif">' + label + '</text>';
        }

        if (chartType === 'bar') {
            var barW = Math.max(2, chartW / values.length * 0.7);
            values.forEach(function (v, i) {
                var bx = scaleX(i) - barW / 2;
                var by = scaleY(v.y);
                var bh = padT + chartH - by;
                svg += '<rect x="' + bx + '" y="' + by + '" width="' + barW + '" height="' + bh + '" fill="#2563EB" rx="2"/>';
            });
        } else if (chartType === 'scatter') {
            values.forEach(function (v, i) {
                svg += '<circle cx="' + scaleX(i) + '" cy="' + scaleY(v.y) + '" r="4" fill="#2563EB"/>';
            });
        } else {
            // Line or Area
            var points = values.map(function (v, i) { return scaleX(i) + ',' + scaleY(v.y); }).join(' ');

            if (chartType === 'area') {
                var areaPoints = padL + ',' + (padT + chartH) + ' ' + points + ' ' + scaleX(values.length - 1) + ',' + (padT + chartH);
                svg += '<polygon points="' + areaPoints + '" fill="#2563EB" fill-opacity="0.1"/>';
            }
            svg += '<polyline points="' + points + '" fill="none" stroke="#2563EB" stroke-width="2"/>';

            values.forEach(function (v, i) {
                svg += '<circle cx="' + scaleX(i) + '" cy="' + scaleY(v.y) + '" r="3" fill="#2563EB"/>';
            });
        }

        svg += '</svg>';

        vizChart.innerHTML =
            '<h3 class="chart-title">' + yField + ' по ' + xField + '</h3>' + svg;
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
                ctx.fillStyle = '#FFFFFF';
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
        var csv = hdrs.join(';') + '\n';
        data.forEach(function (row) {
            var line = hdrs.map(function (h) {
                var val = row[h] !== undefined ? String(row[h]) : '';
                if (val.indexOf(';') !== -1 || val.indexOf('"') !== -1) {
                    val = '"' + val.replace(/"/g, '""') + '"';
                }
                return val;
            });
            csv += line.join(';') + '\n';
        });

        var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        triggerDownload(blob, appState.fileName.replace(/\.[^.]+$/, '') + '_export.csv');
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
