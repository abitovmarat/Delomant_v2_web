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
    var COL_DIRECTION = 'Направление перемещения';

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

    function autoFillResearchCommodity(rows, headers) {
        var el = document.querySelector('.research-commodity');
        if (!el) return;

        var parts = [];

        // 1. ТН ВЭД — берём самый частый код среди первых 200 строк
        var hsCol = findColumn(headers, COL_HS_CODE);
        if (!hsCol) hsCol = findColumn(headers, 'Код ТН ВЭД');
        if (!hsCol) {
            for (var h = 0; h < headers.length; h++) {
                if (/G33|ТН\s*ВЭД|HS.?code/i.test(headers[h])) { hsCol = headers[h]; break; }
            }
        }
        if (hsCol) {
            var hsCounts = {};
            var limit = Math.min(rows.length, 200);
            for (var i = 0; i < limit; i++) {
                var code = String(rows[i][hsCol] || '').trim().replace(/\D/g, '').slice(0, 10);
                if (code.length >= 4) hsCounts[code] = (hsCounts[code] || 0) + 1;
            }
            var topCode = Object.keys(hsCounts).sort(function(a, b) { return hsCounts[b] - hsCounts[a]; })[0];
            if (topCode) parts.push('ТН ВЭД ' + topCode);
        }

        // 2. Описание товара — ищем по множеству вариантов названий колонок (до и после маппинга)
        var descCandidates = [
            COL_PRODUCT_NAME,
            'Наименование и характеристики товаров',
            'Описание товара',
            'Наименование товара',
            'Краткое описание',
            'Описание',
            'Товар',
            'Наименование'
        ];
        var descCol = null;
        for (var d = 0; d < descCandidates.length; d++) {
            descCol = findColumn(headers, descCandidates[d]);
            if (descCol) break;
        }
        // Фоллбэк: ищем по подстрокам в заголовках (G31_1, «описание», «товар»)
        if (!descCol) {
            for (var h2 = 0; h2 < headers.length; h2++) {
                if (/G31_1|описание.*товар|характеристик.*товар/i.test(headers[h2])) {
                    descCol = headers[h2]; break;
                }
            }
        }
        if (descCol) {
            for (var j = 0; j < Math.min(rows.length, 50); j++) {
                var desc = String(rows[j][descCol] || '').trim();
                if (desc.length > 3) {
                    parts.push(desc.slice(0, 150));
                    break;
                }
            }
        }

        if (parts.length > 0) {
            el.value = parts.join(', ');
        }
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
        autoFillResearchCommodity(parsed.rows, parsed.headers);
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
        'G36 (Преференции, особ.уплаты)': 'Преференции',
        'G36 (преференции, особенности уплаты платежей)': 'Преференции',
        'G37 (Процедура)': 'Процедура',
        'G37 (код таможенной процедуры)': 'Процедура',
        '37 Процедура': 'Процедура',
        '36 Преференции': 'Преференции',
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
        'Условие поставки': 'Условие поставки (расшифровка)',
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
        'G42RUB (Фактурная стоимость в рублях)': 'Фактурная стоимость в рублях',
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
        'Преференции': 'Преференции',
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

    function autoMapColumns(data, headers) {
        var mapped = [];
        var missing = [];
        var newHeaders = [];

        // Для каждой записи в COLUMN_MAP ищем точное совпадение в headers
        var mapKeys = Object.keys(COLUMN_MAP);
        var usedStd = {}; // дедупликация: не добавлять одно stdName дважды
        mapKeys.forEach(function (origName) {
            var stdName = COLUMN_MAP[origName];
            if (headers.indexOf(origName) !== -1) {
                if (!usedStd[stdName]) {
                    mapped.push(origName + ' → ' + stdName);
                    newHeaders.push(stdName);
                    usedStd[stdName] = origName;
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
                    .replace(/\s*-\s*/g, '-')  // ГРАНД- ТРЕЙД → ГРАНД-ТРЕЙД
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

    // --- Хелпер: рублёвая стоимость строки (ИМ → G45, ЭК → G46 × курс ЦБ) ---

    function getRowRubValue(row, ctx) {
        var direction = ctx.directionCol ? String(row[ctx.directionCol] || '').trim().toUpperCase() : '';

        if (direction === 'ЭК' && ctx.statUsdCol && ctx.dateReleaseCol) {
            var usdVal = Number(row[ctx.statUsdCol]) || 0;
            if (usdVal === 0) { return 0; }
            var d = parseDate(row[ctx.dateReleaseCol]);
            if (!d) { return 0; }
            var iso = d.toISOString().split('T')[0];
            var rates = findClosestRate(iso);
            if (rates && rates['USD']) {
                return round2(usdVal * rates['USD']);
            }
            return 0;
        }

        // ИМ или направление не определено — таможенная стоимость (рубли)
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
        var rubCtx = buildRubCtx(headers);
        var rubCol = rubCtx.customsCol || rubCtx.invoiceRubCol || rubCtx.statUsdCol;
        var yearCol = findColumn(headers, COL_YEAR);
        var quarterCol = findColumn(headers, COL_QUARTER);

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
        if (rubCol) { html += '<th>Стоимость (тыс. руб.)</th>'; }
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

        // --- Таблица по кварталам ---
        if (quarterKeys.length > 0) {
            html += '<div class="analysis-section">';
            html += '<h3 class="analysis-section-title">По кварталам</h3>';
            html += '<div class="data-table-wrapper"><table class="data-table">';
            html += '<thead><tr><th>Период</th>';
            if (weightCol) { html += '<th>Объём (тонн)</th>'; }
            if (statUsdCol) { html += '<th>Стоимость (тыс. USD)</th>'; }
            if (rubCol) { html += '<th>Стоимость (тыс. руб.)</th>'; }
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

        // --- Графики по метрикам (по 1 на каждую) ---
        var metrics = [];
        if (weightCol) { metrics.push({ key: 'weight', title: 'тонн', unit: 'тонн', div: 1000, cagr: cagrWeight }); }
        if (statUsdCol) { metrics.push({ key: 'usd', title: 'млн долл. США', unit: 'млн USD', div: 1000000, cagr: cagrUsd }); }
        if (rubCol) { metrics.push({ key: 'rub', title: 'млн руб.', unit: 'млн руб.', div: 1000000, cagr: cagrRub }); }

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
            if (weightCol) { row['Объём (тонн)'] = round2(d.weight / 1000); }
            if (statUsdCol) { row['Стоимость (тыс. USD)'] = round2(d.usd / 1000); }
            if (rubCol) { row['Стоимость (тыс. руб.)'] = round2(d.rub / 1000); }
            exportRows.push(row);
        });
        // CAGR в экспорт
        if (cagrYears > 0) {
            var cagrRow = { 'Период': 'CAGR' };
            if (weightCol) { cagrRow['Объём (тонн)'] = cagrWeight !== null ? round2(cagrWeight) + '%' : ''; }
            if (statUsdCol) { cagrRow['Стоимость (тыс. USD)'] = cagrUsd !== null ? round2(cagrUsd) + '%' : ''; }
            if (rubCol) { cagrRow['Стоимость (тыс. руб.)'] = cagrRub !== null ? round2(cagrRub) + '%' : ''; }
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
                if (rubCol) { row['Стоимость (тыс. руб.)'] = round2(d.rub / 1000); }
                exportRows.push(row);
            });
        }

        var exportHeaders = ['Период'];
        if (weightCol) { exportHeaders.push('Объём (тонн)'); }
        if (statUsdCol) { exportHeaders.push('Стоимость (тыс. USD)'); }
        if (rubCol) { exportHeaders.push('Стоимость (тыс. руб.)'); }

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
        var sendCol = findColumn(headers, 'Страна отправления');
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

        // Хелпер: строит таблицу «страна × год» (тонны) + строки ВСЕГО и Доля лидера
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
            var maxVal = byCountry[top[0]] / 1000;
            if (maxVal === 0) { maxVal = 1; }

            var h = '<div class="analysis-section">';
            h += '<h3 class="analysis-section-title">Топ-10 по объёму (' + countryCol + ', тонн)</h3>';
            h += '<svg class="analysis-chart" data-chart-idx="' + cIdx + '" width="' + cw + '" height="' + ch + '" viewBox="0 0 ' + cw + ' ' + ch + '">';
            h += '<style>text { font-family: ' + CHART_FONT + '; font-size: 12px; fill: ' + CHART_COLORS.text + '; }</style>';

            top.forEach(function (c, i) {
                var val = round2(byCountry[c] / 1000);
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
            // Таблица тонны (страна × год)
            if (weightCol) {
                var wBlock = buildPivotTable(countryCol, weightCol, 'Структура импорта, тонны', 'тонн', 1);
                html += wBlock.html;
                allExportBlocks.push({ label: countryCol + ' — тонны', rows: wBlock.exportRows });
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
        var countryCol = findColumn(headers, 'Страна отправления') || findColumn(headers, 'Страна происхождения');
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
        if (rubCol) { metrics.push({ key: 'rub', title: 'Поквартальная динамика цен, руб./кг', unit: 'руб./кг' }); }
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
                if (statUsdCol) { row['USD/кг'] = pd && pd.usd != null ? pd.usd : ''; }
                if (rubCol) { row['Руб./кг'] = pd && pd.rub != null ? pd.rub : ''; }
                exportRows.push(row);
            });
            // Средневзвешенная
            var avg = avgPrices[y];
            var avgRow = { 'Год': y, 'Квартал': 'Средневзвешенная' };
            if (statUsdCol) { avgRow['USD/кг'] = avg && avg.usd != null ? avg.usd : ''; }
            if (rubCol) { avgRow['Руб./кг'] = avg && avg.rub != null ? avg.rub : ''; }
            exportRows.push(avgRow);
            exportRows.push({ 'Год': '', 'Квартал': '' });
        });

        var exportHeaders = ['Год', 'Квартал'];
        if (statUsdCol) { exportHeaders.push('USD/кг'); }
        if (rubCol) { exportHeaders.push('Руб./кг'); }

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

    /* ================================
       Module: Research (AI Chat)
       ================================ */

    var LS_RESEARCH_APIKEY   = 'delomant_research_apikey';
    var LS_RESEARCH_PROVIDER = 'delomant_research_provider';
    var LS_RESEARCH_AIURL    = 'delomant_research_aiurl';
    var LS_RESEARCH_MODEL    = 'delomant_research_model';
    var LS_RESEARCH_NOTES    = 'delomant_research_notes';

    var researchHistory = []; // {role, content}
    var researchNotes   = JSON.parse(localStorage.getItem(LS_RESEARCH_NOTES) || '[]'); // {id, text, ts}

    var researchMsgs        = document.querySelector('.research-messages');
    var researchInput       = document.querySelector('.research-input');
    var researchSendBtn     = document.querySelector('.research-send-btn');
    var researchClearBtn    = document.querySelector('.research-clear-btn');
    var researchProvider    = document.querySelector('.research-provider');
    var researchModelSel    = document.querySelector('.research-model-select');
    var researchModelCst    = document.querySelector('.research-model-custom');
    var researchUrlGroup    = document.querySelector('.research-url-group');
    var researchUrl         = document.querySelector('.research-url');
    var researchApiKey      = document.querySelector('.research-apikey');
    var researchNotesList   = document.querySelector('.research-notes-list');
    var researchNotesCount  = document.querySelector('.research-notes-count');
    var researchNotesToSlide = document.querySelector('.research-notes-to-slide');

    // Restore saved settings
    (function () {
        var p = localStorage.getItem(LS_RESEARCH_PROVIDER) || 'openrouter';
        var k = localStorage.getItem(LS_RESEARCH_APIKEY) || '';
        var u = localStorage.getItem(LS_RESEARCH_AIURL) || '';
        var m = localStorage.getItem(LS_RESEARCH_MODEL) || '';
        researchProvider.value = p;
        researchApiKey.value = k;
        researchUrl.value = u;
        updateResearchProviderUI(p);
        if (m && researchModelSel) {
            var found = false;
            for (var oi = 0; oi < researchModelSel.options.length; oi++) {
                if (researchModelSel.options[oi].value === m) { found = true; break; }
            }
            if (found) {
                researchModelSel.value = m;
            } else {
                researchModelSel.value = 'custom';
                researchModelCst.value = m;
                researchModelCst.style.display = '';
            }
        }
    })();

    function updateResearchProviderUI(pKey) {
        var isLocal = pKey === 'ollama' || pKey === 'lmstudio';
        var isClaude = pKey === 'claude';
        researchUrlGroup.style.display = isLocal ? '' : 'none';
        document.querySelector('.research-model-select-group').style.display = isClaude ? 'none' : '';
        if (isLocal) {
            researchModelSel.style.display = 'none';
            researchModelCst.style.display = '';
            researchModelCst.placeholder = pKey === 'ollama' ? 'qwen3:8b' : 'local-model';
            researchUrl.placeholder = pKey === 'ollama' ? 'http://localhost:11434' : 'http://localhost:1234';
        } else {
            researchModelSel.style.display = '';
            researchModelCst.style.display = researchModelSel.value === 'custom' ? '' : 'none';
        }
    }

    researchProvider.addEventListener('change', function () {
        updateResearchProviderUI(this.value);
    });

    researchModelSel.addEventListener('change', function () {
        researchModelCst.style.display = this.value === 'custom' ? '' : 'none';
        if (this.value === 'custom') researchModelCst.focus();
    });

    function getResearchModel() {
        var pKey = researchProvider.value;
        if (pKey === 'claude') return 'claude-sonnet-4-20250514';
        if (pKey === 'ollama' || pKey === 'lmstudio') {
            return researchModelCst.value.trim() || (pKey === 'ollama' ? 'qwen3:8b' : 'local-model');
        }
        if (researchModelSel.value === 'custom') {
            return researchModelCst.value.trim() || 'meta-llama/llama-3.3-70b-instruct:free';
        }
        return researchModelSel.value || 'meta-llama/llama-3.3-70b-instruct:free';
    }

    function buildResearchContext() {
        var data = getActiveData();
        var headers = getActiveHeaders();
        if (!data || data.length === 0) return '';

        var weightCol = findColumn(headers, COL_WEIGHT);
        var statUsdCol = findColumn(headers, COL_STAT_USD);
        var yearCol = findColumn(headers, COL_YEAR);
        var quarterCol = findColumn(headers, COL_QUARTER);

        // Описание товара
        var commodityEl = document.querySelector('.research-commodity');
        var commodity = commodityEl ? commodityEl.value.trim() : '';

        var ctx = '';
        if (commodity) ctx += 'Товар/тема: ' + commodity + '\n';
        ctx += 'Источник: таможенные данные ВЭД (' + data.length + ' деклараций).\n';

        // --- Определяем полные и неполные годы по кварталам ---
        if (yearCol) {
            var byYear = {};
            var byYearQ = {};
            data.forEach(function (row) {
                var y = String(row[yearCol] || '').trim();
                if (!y) return;
                var w = Number(row[weightCol]) || 0;
                var u = Number(row[statUsdCol]) || 0;
                if (!byYear[y]) byYear[y] = { w: 0, u: 0 };
                byYear[y].w += w;
                byYear[y].u += u;
                if (quarterCol) {
                    var q = String(row[quarterCol] || '').trim();
                    if (q) {
                        if (!byYearQ[y]) byYearQ[y] = {};
                        byYearQ[y][q] = true;
                    }
                }
            });

            var ys = Object.keys(byYear).sort();
            if (ys.length === 0) return ctx;

            // Определяем неполный год: последний год, у которого < 4 кварталов
            var partialYear = null;
            var partialQs = [];
            if (quarterCol && ys.length >= 2) {
                var lastY = ys[ys.length - 1];
                var prevY = ys[ys.length - 2];
                var lastQs = Object.keys(byYearQ[lastY] || {}).sort();
                var prevQs = Object.keys(byYearQ[prevY] || {}).sort();
                if (lastQs.length < prevQs.length || lastQs.length < 4) {
                    partialYear = lastY;
                    partialQs = lastQs;
                }
            }

            if (document.querySelector('.research-ctx-summary').checked) {
                ctx += 'Период данных: ' + ys[0] + '–' + ys[ys.length - 1] + '.\n';

                // Явно указываем какие годы полные, какой частичный
                var fullYears = partialYear ? ys.filter(function(y) { return y !== partialYear; }) : ys;
                if (fullYears.length > 0) {
                    ctx += 'Полные годы (январь–декабрь): ' + fullYears.join(', ') + '.\n';
                }
                if (partialYear) {
                    var qLabel = partialQs.length > 0 ? 'Q' + partialQs.join('+Q') : 'неполный';
                    ctx += 'ВАЖНО: ' + partialYear + ' г. — данные только за ' + qLabel +
                        ' (' + partialQs.length + ' из 4 кварталов). ' +
                        'При сравнении с другими годами делать поправку на неполноту периода!\n';
                }
            }

            if (document.querySelector('.research-ctx-years').checked) {
                ctx += 'Объёмы по годам (тонн / тыс. USD):\n';
                ys.forEach(function (y) {
                    var d = byYear[y];
                    var note = '';
                    if (y === partialYear) {
                        note = ' [неполный год, только ' + partialQs.length + ' кв.]';
                    }
                    ctx += '  ' + y + note + ': ' +
                        round2(d.w / 1000) + ' тонн, ' +
                        round2(d.u / 1000) + ' тыс. USD\n';
                });
            }
        }

        if (document.querySelector('.research-ctx-countries').checked) {
            var cCol = findColumn(headers, 'Страна отправления') || findColumn(headers, 'Страна происхождения');
            var wCol = findColumn(headers, COL_WEIGHT);
            if (cCol && wCol) {
                var byC = {};
                var grand = 0;
                data.forEach(function (row) {
                    var c = String(row[cCol] || '').trim();
                    var w = Number(row[wCol]) || 0;
                    if (c) { byC[c] = (byC[c] || 0) + w; grand += w; }
                });
                var top5 = Object.keys(byC).sort(function (a, b) { return byC[b] - byC[a]; }).slice(0, 5);
                ctx += 'Топ-5 стран-поставщиков: ' + top5.map(function (c) {
                    return c + ' (' + round2(byC[c] / grand * 100) + '%)';
                }).join(', ') + '.\n';
            }
        }

        return ctx;
    }

    var RESEARCH_PRESETS = {
        'Анализ рынка': 'Проанализируй текущее состояние рынка по данным. Найди актуальную информацию о рыночных тенденциях, объёмах торговли и ключевых участниках.',
        'Тренды и прогноз': 'На основе динамики по годам определи тренды и дай прогноз на следующий год. Учти глобальные факторы.',
        'Ключевые игроки': 'Кто является ключевыми поставщиками и покупателями на этом рынке? Найди информацию о ведущих компаниях.',
        'Ценовые факторы': 'Какие факторы влияют на цены в этом сегменте? Проанализируй динамику цен и внешние факторы.',
        'Регуляторные риски': 'Какие регуляторные риски и торговые ограничения существуют для данного вида товаров? Проверь актуальные санкции и пошлины.'
    };

    function renderMarkdown(text) {
        // Экранируем HTML
        var s = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        // Заголовки
        s = s.replace(/^#{4,6}\s+(.+)$/gm, '<strong>$1</strong>');
        s = s.replace(/^###\s+(.+)$/gm, '<strong style="font-size:1.05em">$1</strong>');
        s = s.replace(/^##\s+(.+)$/gm, '<strong style="font-size:1.1em">$1</strong>');
        s = s.replace(/^#\s+(.+)$/gm, '<strong style="font-size:1.15em">$1</strong>');
        // Жирный и курсив
        s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
        // Инлайн-код
        s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Горизонтальная линия
        s = s.replace(/^---+$/gm, '<hr>');
        // Ненумерованные списки
        s = s.replace(/^[\*\-]\s+(.+)$/gm, '<li>$1</li>');
        s = s.replace(/(<li>.*<\/li>\n?)+/g, function(m) { return '<ul>' + m + '</ul>'; });
        // Нумерованные списки
        s = s.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
        // Переносы строк → <br> (только там где нет блочных элементов)
        s = s.replace(/\n{2,}/g, '<br><br>');
        s = s.replace(/\n/g, '<br>');
        return s;
    }

    function researchAddMessage(role, text, isLoading) {
        var div = document.createElement('div');
        div.className = 'research-msg ' + role + (isLoading ? ' loading' : '');

        var label = document.createElement('div');
        label.className = 'research-msg-label';
        label.textContent = role === 'user' ? 'Вы' : 'AI';

        var bubble = document.createElement('div');
        bubble.className = 'research-msg-bubble';
        if (role === 'assistant' && !isLoading) {
            bubble.innerHTML = renderMarkdown(text);
        } else {
            bubble.textContent = text;
        }

        div.appendChild(label);
        div.appendChild(bubble);

        // Кнопки для ответа ассистента
        if (role === 'assistant' && !isLoading) {
            var actions = document.createElement('div');
            actions.className = 'research-msg-actions';

            var copyBtn = document.createElement('button');
            copyBtn.textContent = 'Копировать';
            copyBtn.addEventListener('click', function () {
                navigator.clipboard.writeText(text).then(function () {
                    copyBtn.textContent = 'Скопировано!';
                    setTimeout(function () { copyBtn.textContent = 'Копировать'; }, 1500);
                });
            });
            actions.appendChild(copyBtn);

            var noteBtn = document.createElement('button');
            noteBtn.className = 'research-note-btn';
            noteBtn.textContent = 'В отчёт';
            noteBtn.addEventListener('click', function () {
                addResearchNote(text);
                noteBtn.textContent = '✓ Сохранено';
                noteBtn.disabled = true;
            });
            actions.appendChild(noteBtn);

            div.appendChild(actions);
        }

        // Убрать заглушку если есть
        var empty = researchMsgs.querySelector('.research-empty');
        if (empty) empty.remove();

        researchMsgs.appendChild(div);
        researchMsgs.scrollTop = researchMsgs.scrollHeight;
        return div;
    }

    function researchShowEmpty() {
        researchMsgs.innerHTML = '';
        var div = document.createElement('div');
        div.className = 'research-empty';
        div.innerHTML = '<div class="research-empty-icon">🔍</div>' +
            '<div class="research-empty-text">Задайте вопрос — AI ответит с учётом ваших данных</div>';
        researchMsgs.appendChild(div);
    }

    researchShowEmpty();

    // --- Заметки для отчёта ---

    function saveResearchNotes() {
        localStorage.setItem(LS_RESEARCH_NOTES, JSON.stringify(researchNotes));
    }

    function renderResearchNotes() {
        researchNotesCount.textContent = researchNotes.length;
        researchNotesList.innerHTML = '';
        researchNotes.forEach(function (note) {
            var item = document.createElement('div');
            item.className = 'research-note-item';

            var preview = document.createElement('div');
            preview.className = 'research-note-preview';
            preview.textContent = note.text.slice(0, 120) + (note.text.length > 120 ? '…' : '');

            var del = document.createElement('button');
            del.className = 'research-note-del';
            del.title = 'Удалить';
            del.textContent = '✕';
            del.addEventListener('click', function () {
                researchNotes = researchNotes.filter(function (n) { return n.id !== note.id; });
                saveResearchNotes();
                renderResearchNotes();
            });

            item.appendChild(preview);
            item.appendChild(del);
            researchNotesList.appendChild(item);
        });

        researchNotesToSlide.style.display = researchNotes.length ? '' : 'none';
    }

    function addResearchNote(text) {
        researchNotes.push({ id: Date.now(), text: text, ts: new Date().toISOString() });
        saveResearchNotes();
        renderResearchNotes();
    }

    // Кнопка «+ Слайд в презентацию» — собирает все заметки в один текстовый слайд
    researchNotesToSlide.addEventListener('click', function () {
        if (!researchNotes.length) return;
        var combined = researchNotes.map(function (n) { return n.text; }).join('\n\n');
        // Создаём текстовый слайд
        var block = findPresBlock('text');
        if (!block) return;
        var slide = {
            id: presState.nextId++,
            type: 'text',
            title: 'Аналитические выводы (AI)',
            hsFilter: '',
            topN: 10,
            year: '',
            opts: { subtitle: '', bullets: combined }
        };
        presState.slides.push(slide);
        presState.activeIndex = presState.slides.length - 1;
        renderPresSlideList();
        previewPresSlide(presState.activeIndex);
        updatePresButtons();
        // Переходим в презентацию
        document.querySelector('[data-module="presentation"]').click();
    });

    // Инициальный рендер заметок из localStorage
    renderResearchNotes();

    function researchSend(text) {
        text = (text || researchInput.value).trim();
        if (!text) return;

        var pKey = researchProvider.value;
        var apiKey = researchApiKey.value.trim() || localStorage.getItem(LS_RESEARCH_APIKEY) || '';
        var model = getResearchModel();

        if ((pKey === 'openrouter' || pKey === 'claude') && !apiKey) {
            alert('Введите API-ключ в панели настроек слева');
            researchApiKey.focus();
            return;
        }

        researchInput.value = '';
        researchInput.style.height = '';

        researchHistory.push({ role: 'user', content: text });
        researchAddMessage('user', text);

        var loadingEl = researchAddMessage('assistant', 'Генерирую ответ...', true);
        researchSendBtn.disabled = true;

        // Сохранить настройки
        localStorage.setItem(LS_RESEARCH_PROVIDER, pKey);
        localStorage.setItem(LS_RESEARCH_MODEL, model);
        if (apiKey) localStorage.setItem(LS_RESEARCH_APIKEY, apiKey);

        var systemCtx = buildResearchContext();
        researchCallAI(pKey, apiKey, model, researchHistory, systemCtx)
            .then(function (reply) {
                researchHistory.push({ role: 'assistant', content: reply });
                loadingEl.remove();
                researchAddMessage('assistant', reply);
            })
            .catch(function (err) {
                researchHistory.pop(); // убрать незавершённый запрос
                loadingEl.remove();
                var msg = err.message;
                if ((pKey === 'ollama' || pKey === 'lmstudio') && msg === 'Failed to fetch') {
                    msg = 'Не удалось подключиться. Запустите сервер и разрешите CORS:\n$env:OLLAMA_ORIGINS="*"; ollama serve';
                }
                researchAddMessage('assistant', 'Ошибка: ' + msg);
            })
            .then(function () {
                researchSendBtn.disabled = false;
            });
    }

    function researchCallAI(pKey, apiKey, model, messages, systemCtx) {
        var provider = AI_PROVIDERS[pKey] || AI_PROVIDERS.openrouter;
        apiKey = sanitizeAscii(apiKey);
        model = sanitizeAscii(model);

        if (provider.format === 'claude') {
            var claudeBody = { model: model, max_tokens: 4096, messages: messages };
            if (systemCtx) claudeBody.system = systemCtx;
            return fetch(provider.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify(claudeBody)
            })
            .then(function (r) {
                if (!r.ok) throw new Error('Claude API: ' + r.status);
                return r.json();
            })
            .then(function (j) {
                return (j.content && j.content[0] && j.content[0].text) ? j.content[0].text.trim() : '';
            });
        }

        var customUrl = researchUrl.value.trim();
        var url = customUrl || provider.url;
        if ((pKey === 'ollama' || pKey === 'lmstudio') && customUrl && customUrl.indexOf('/v1/') === -1) {
            url = url.replace(/\/+$/, '') + '/v1/chat/completions';
        }

        var hdrs = { 'Content-Type': 'application/json' };
        if (apiKey) hdrs['Authorization'] = 'Bearer ' + apiKey;
        if (pKey === 'openrouter') hdrs['HTTP-Referer'] = 'https://delomant.ru';

        // System message с контекстом — всегда первым
        var msgsWithCtx = systemCtx
            ? [{ role: 'system', content: systemCtx }].concat(messages)
            : messages;

        return fetch(url, {
            method: 'POST',
            headers: hdrs,
            body: JSON.stringify({
                model: model,
                max_tokens: 4096,
                messages: msgsWithCtx
            })
        })
        .then(function (r) {
            if (!r.ok) throw new Error(pKey + ' API: ' + r.status);
            return r.json();
        })
        .then(function (j) {
            return (j.choices && j.choices[0] && j.choices[0].message)
                ? j.choices[0].message.content.trim() : '';
        });
    }

    // Send button
    researchSendBtn.addEventListener('click', function () { researchSend(); });

    // Enter to send (Shift+Enter = newline)
    researchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            researchSend();
        }
    });

    // Auto-resize textarea
    researchInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    // Preset buttons
    document.querySelectorAll('.research-preset-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var preset = RESEARCH_PRESETS[btn.textContent];
            if (preset) researchSend(preset);
        });
    });

    // Clear
    researchClearBtn.addEventListener('click', function () {
        researchHistory = [];
        researchShowEmpty();
    });

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
        { type: 'section-divider', label: 'Разделитель', icon: '\uD83D\uDCCC', category: 'special', hasHsFilter: true, hasTopN: false, hasYear: false, hasSubtitle: false, hasBullets: false },
        { type: 'volumes', label: 'Объёмы', icon: '\uD83D\uDCE6', category: 'analysis', hasHsFilter: true, hasTopN: false, hasYear: false, hasSubtitle: false, hasBullets: false, hasCommentary: true },
        { type: 'countries', label: 'Страны', icon: '\uD83C\uDF0D', category: 'analysis', hasHsFilter: true, hasTopN: true, hasYear: false, hasSubtitle: false, hasBullets: false, hasCommentary: true },
        { type: 'price-dynamics', label: 'Цены/страны', icon: '\uD83D\uDCB0', category: 'analysis', hasHsFilter: true, hasTopN: true, hasYear: false, hasSubtitle: false, hasBullets: false, hasCommentary: true },
        { type: 'sankey-sender', label: 'Санки: Отпр\u2192Пол', icon: '\uD83C\uDFED', category: 'analysis', hasHsFilter: true, hasTopN: true, hasYear: true, hasSubtitle: false, hasBullets: false, hasCommentary: true },
        { type: 'sankey-manufacturer', label: 'Санки: Изг\u2192Пол', icon: '\uD83C\uDFED', category: 'analysis', hasHsFilter: true, hasTopN: true, hasYear: true, hasSubtitle: false, hasBullets: false, hasCommentary: true },
        { type: 'quarterly-prices', label: 'Кварт. цены', icon: '\uD83D\uDCC8', category: 'analysis', hasHsFilter: true, hasTopN: false, hasYear: false, hasSubtitle: false, hasBullets: false, hasCommentary: true },
        { type: 'summary', label: 'Итоги', icon: '\u2705', category: 'special', hasHsFilter: false, hasTopN: false, hasYear: false, hasSubtitle: false, hasBullets: true },
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
        presPrevBtn.disabled = presState.activeIndex <= 0;
        presNextBtn.disabled = presState.activeIndex >= len - 1;
        presSlideIndicator.textContent = len > 0
            ? (presState.activeIndex + 1) + ' / ' + len
            : '0 / 0';
    }

    // --- Настройки блока ---
    var presEditingSlideId = null;

    function updateProviderFields(providerKey) {
        var p = AI_PROVIDERS[providerKey] || AI_PROVIDERS.openrouter;
        document.querySelector('.pres-set-apikey-group').style.display = p.needsKey ? '' : 'none';
        document.querySelector('.pres-set-aiurl-group').style.display = p.needsUrl ? '' : 'none';
        if (p.keyPlaceholder) {
            document.querySelector('.pres-set-apikey').placeholder = p.keyPlaceholder;
        }
        if (p.needsUrl) {
            document.querySelector('.pres-set-aiurl').placeholder = p.url;
        }

        // Блок выбора модели: только для openrouter и локальных
        var modelGroup = document.querySelector('.pres-set-model-group');
        var modelSelect = document.querySelector('.pres-set-model-select');
        var modelCustom = document.querySelector('.pres-set-model-custom');

        if (providerKey === 'openrouter') {
            modelGroup.style.display = '';
            modelSelect.style.display = '';
            // Показываем кастомное поле если выбрано "custom"
            modelCustom.style.display = modelSelect.value === 'custom' ? '' : 'none';
        } else if (providerKey === 'ollama' || providerKey === 'lmstudio') {
            modelGroup.style.display = '';
            modelSelect.style.display = 'none';
            modelCustom.style.display = '';
            modelCustom.placeholder = providerKey === 'ollama' ? 'qwen3:8b' : 'local-model';
        } else {
            // Claude — модель фиксирована
            modelGroup.style.display = 'none';
        }
    }

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

        // AI provider settings from localStorage
        var storedProvider = localStorage.getItem(LS_PRES_PROVIDER) || 'openrouter';
        var storedKey = localStorage.getItem(LS_PRES_APIKEY) || '';
        var storedUrl = localStorage.getItem(LS_PRES_AIURL) || '';
        var storedModel = localStorage.getItem(LS_PRES_MODEL) || '';
        document.querySelector('.pres-set-provider').value = storedProvider;
        document.querySelector('.pres-set-apikey').value = storedKey;
        document.querySelector('.pres-set-aiurl').value = storedUrl;

        // Show/hide fields
        document.querySelector('.pres-set-hs-group').style.display = block.hasHsFilter ? '' : 'none';
        document.querySelector('.pres-set-topn-group').style.display = block.hasTopN ? '' : 'none';
        document.querySelector('.pres-set-year-group').style.display = block.hasYear ? '' : 'none';
        document.querySelector('.pres-set-subtitle-group').style.display = block.hasSubtitle ? '' : 'none';
        document.querySelector('.pres-set-bullets-group').style.display = block.hasBullets ? '' : 'none';
        document.querySelector('.pres-set-commentary-group').style.display = block.hasCommentary ? '' : 'none';
        document.querySelector('.pres-set-provider-group').style.display = block.hasCommentary ? '' : 'none';
        updateProviderFields(storedProvider);

        // Восстановить выбранную модель после updateProviderFields
        var modelSelect = document.querySelector('.pres-set-model-select');
        var modelCustom = document.querySelector('.pres-set-model-custom');
        if (storedProvider === 'openrouter' && storedModel) {
            // Проверяем, есть ли такая опция в select
            var found = false;
            for (var oi = 0; oi < modelSelect.options.length; oi++) {
                if (modelSelect.options[oi].value === storedModel) { found = true; break; }
            }
            if (found) {
                modelSelect.value = storedModel;
                modelCustom.style.display = storedModel === 'custom' ? '' : 'none';
                if (storedModel === 'custom') modelCustom.value = '';
            } else {
                // Сохранённая модель не в списке — считаем её кастомной
                modelSelect.value = 'custom';
                modelCustom.style.display = '';
                modelCustom.value = storedModel;
            }
        } else if ((storedProvider === 'ollama' || storedProvider === 'lmstudio') && storedModel) {
            modelCustom.value = storedModel;
        }

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

        // Save API key to localStorage
        var apiKey = document.querySelector('.pres-set-apikey').value.trim();
        if (apiKey) {
            localStorage.setItem(LS_PRES_APIKEY, apiKey);
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
            el.title = 'Двойной клик — редактировать';
            el.addEventListener('dblclick', function (e) {
                e.stopPropagation();
                if (el.contentEditable === 'true') return;
                el.contentEditable = 'true';
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
    function renderPresSlideByType(slide, data, headers) {
        var type = slide.type;
        if (type === 'title') return renderPresTitle(slide);
        if (type === 'toc') return renderPresTOC();
        if (type === 'text') return renderPresText(slide);
        if (type === 'section-divider') return renderPresSectionDivider(slide);
        if (type === 'contacts') return renderPresContacts();
        if (type === 'summary') return renderPresText(slide);
        // Аналитические блоки — будут добавлены в Фазе 4
        if (type === 'volumes') return renderPresVolumes(data, headers, slide);
        if (type === 'countries') return renderPresCountries(data, headers, slide);
        if (type === 'price-dynamics') return renderPresPriceDynamics(data, headers, slide);
        if (type === 'sankey-sender') return renderPresSankeySender(data, headers, slide);
        if (type === 'sankey-manufacturer') return renderPresSankeyManufacturer(data, headers, slide);
        if (type === 'quarterly-prices') return renderPresQuarterlyPrices(data, headers, slide);
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
            .replace(/\n{3,}/g, '\n\n')            // лишние переносы
            .trim();
    }

    function slideWrapper(headerText, bodyHTML, opts) {
        opts = opts || {};
        var slideNum = opts.slideNum || '';
        var commentary = opts.commentary || '';
        var html = '<div class="pres-slide">';
        html += '<div class="pres-slide-header">';
        html += '<img src="data/Logo.png" class="pres-slide-logo" onerror="this.style.display=\'none\'">';
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
        html += '<span>delomant.ru</span>';
        if (slideNum) html += '<span>' + slideNum + '</span>';
        html += '</div>';
        html += '</div>';
        return html;
    }

    // --- Статические рендереры ---

    function renderPresTitle(slide) {
        var html = '<div class="pres-slide">';
        html += '<div class="pres-slide-title-bg">';
        html += '<img src="data/Logo.png" class="pres-title-logo" onerror="this.style.display=\'none\'">';
        html += '<div class="pres-title-main" data-editable="title">' + (slide.title || 'Аналитическая справка') + '</div>';
        if (slide.opts && slide.opts.subtitle) {
            html += '<div class="pres-title-sub" data-editable="subtitle">' + slide.opts.subtitle + '</div>';
        } else {
            html += '<div class="pres-title-sub" data-editable="subtitle" style="opacity:0.4">Подзаголовок (двойной клик)</div>';
        }
        html += '<div class="pres-title-footer"><span>delomant.ru</span><span>' + new Date().getFullYear() + '</span></div>';
        html += '</div></div>';
        return html;
    }

    function renderPresTOC() {
        var body = '<h3>\u041e\u0433\u043b\u0430\u0432\u043b\u0435\u043d\u0438\u0435</h3>';
        body += '<ul class="pres-toc-list">';
        var num = 1;
        presState.slides.forEach(function (s, idx) {
            if (s.type === 'toc') return;
            var block = findPresBlock(s.type);
            var label = s.title || (block ? block.label : '');
            if (s.hsFilter) label += ' (' + s.hsFilter + ')';
            body += '<li><span class="pres-toc-num">' + num + '</span><span style="flex:1">' + label + '</span><span>' + (idx + 1) + '</span></li>';
            num++;
        });
        body += '</ul>';
        return slideWrapper('\u0421\u043e\u0434\u0435\u0440\u0436\u0430\u043d\u0438\u0435', body, {});
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
            body += '<p style="color:#64748B">Двойной клик чтобы добавить текст</p>';
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

        // Table
        var body = '<table>';
        body += '<thead><tr><th>\u0413\u043e\u0434</th>';
        if (weightCol) body += '<th>\u0442\u043e\u043d\u043d</th>';
        if (statUsdCol) body += '<th>\u0442\u044b\u0441. USD</th>';
        if (hasRub) body += '<th>\u0442\u044b\u0441. \u0440\u0443\u0431.</th>';
        body += '</tr></thead><tbody>';
        years.forEach(function (y) {
            var d = byYear[y];
            body += '<tr><td>' + y + '</td>';
            if (weightCol) body += '<td class="numeric">' + formatNumber(round2(d.weight / 1000)) + '</td>';
            if (statUsdCol) body += '<td class="numeric">' + formatNumber(round2(d.usd / 1000)) + '</td>';
            if (hasRub) body += '<td class="numeric">' + formatNumber(round2(d.rub / 1000)) + '</td>';
            body += '</tr>';
        });
        // CAGR row
        if (n > 0) {
            body += '<tr style="font-weight:700;border-top:2px solid #CBD5E1"><td>CAGR</td>';
            if (weightCol) body += '<td class="numeric">' + (cagrW !== null ? round2(cagrW) + '%' : '\u2014') + '</td>';
            if (statUsdCol) body += '<td class="numeric">' + (cagrU !== null ? round2(cagrU) + '%' : '\u2014') + '</td>';
            if (hasRub) body += '<td class="numeric">' + (cagrR !== null ? round2(cagrR) + '%' : '\u2014') + '</td>';
            body += '</tr>';
        }
        body += '</tbody></table>';

        // Bar chart (weight in tons)
        if (weightCol && years.length >= 2) {
            var vals = years.map(function (y) { return round2(byYear[y].weight / 1000); });
            var maxV = Math.max.apply(null, vals);
            if (maxV > 0) {
                var cW = 880, cH = 160, barW = Math.min(60, Math.floor((cW - 40) / years.length) - 8);
                body += '<svg width="' + cW + '" height="' + cH + '" style="margin-top:8px">';
                body += '<style>text{font-family:DejaVu Sans,sans-serif}</style>';
                years.forEach(function (y, i) {
                    var v = vals[i];
                    var bh = Math.max(2, (v / maxV) * (cH - 40));
                    var x = 30 + i * (barW + 8);
                    var by = cH - 20 - bh;
                    body += '<rect x="' + x + '" y="' + by + '" width="' + barW + '" height="' + bh + '" fill="#2563EB" rx="2"/>';
                    body += '<text x="' + (x + barW / 2) + '" y="' + (by - 4) + '" text-anchor="middle" font-size="9" fill="#0F172A">' + formatNumber(v) + '</text>';
                    body += '<text x="' + (x + barW / 2) + '" y="' + (cH - 6) + '" text-anchor="middle" font-size="9" fill="#64748B">' + y + '</text>';
                });
                body += '</svg>';
            }
        }

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

        var body = '<table>';
        body += '<thead><tr><th>\u0442\u043e\u043d\u043d</th>';
        years.forEach(function (y) { body += '<th>' + y + '</th>'; });
        body += '</tr></thead><tbody>';
        countries.forEach(function (c) {
            body += '<tr><td>' + c + '</td>';
            years.forEach(function (y) {
                var v = (byCountryYear[c] && byCountryYear[c][y]) || 0;
                body += '<td class="numeric">' + formatNumber(Math.round(v)) + '</td>';
            });
            body += '</tr>';
        });
        // Total row
        body += '<tr style="font-weight:700;border-top:2px solid #CBD5E1"><td>\u0412\u0421\u0415\u0413\u041e</td>';
        years.forEach(function (y) { body += '<td class="numeric">' + formatNumber(Math.round(totalByYear[y])) + '</td>'; });
        body += '</tr>';
        // Leader share
        if (countries.length > 0) {
            var leader = countries[0];
            body += '<tr><td>\u0414\u043e\u043b\u044f ' + leader + ', %</td>';
            years.forEach(function (y) {
                var total = totalByYear[y];
                var lv = (byCountryYear[leader] && byCountryYear[leader][y]) || 0;
                body += '<td class="numeric">' + (total > 0 ? round2(lv / total * 100) + '%' : '\u2014') + '</td>';
            });
            body += '</tr>';
        }
        body += '</tbody></table>';

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
        var xStep = years.length > 1 ? innerW / (years.length - 1) : innerW / 2;

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
            body += '<text x="' + (pad.left + xStep * i) + '" y="' + (cH - 8) + '" text-anchor="middle" font-size="8" fill="#64748B">' + y + '</text>';
        });

        // Lines
        countries.forEach(function (c, ci) {
            var color = LINE_COLORS[ci % LINE_COLORS.length];
            var pts = [];
            years.forEach(function (y, yi) {
                if (priceData[c][y] != null) {
                    pts.push({ x: pad.left + xStep * yi, y: pad.top + innerH - ((priceData[c][y] - yMin) / yRange) * innerH });
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
            var xStep = 3 > 0 ? innerW / 3 : innerW;

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
                body += '<text x="' + (pad.left + xStep * qi) + '" y="' + (cH - 6) + '" text-anchor="middle" font-size="8" fill="#64748B">Q' + q + '</text>';
            });

            years.forEach(function (y, yi) {
                var color = YEAR_COLORS[yi % YEAR_COLORS.length];
                var pts = [];
                quarters.forEach(function (q, qi) {
                    var d = byYQ[y + '|' + q];
                    if (d && d.weight > 0) {
                        var v = m.key === 'usd' ? d.usd / d.weight : d.rub / d.weight;
                        pts.push({ x: pad.left + xStep * qi, y: pad.top + innerH - ((round2(v) - yMin) / yRange) * innerH });
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

    // --- Авто-генерация текста для слайдов ---

    var LS_PRES_APIKEY = 'delomant_pres_apikey';
    var LS_PRES_PROVIDER = 'delomant_pres_provider';
    var LS_PRES_AIURL = 'delomant_pres_aiurl';
    var LS_PRES_MODEL = 'delomant_pres_model';

    var AI_PROVIDERS = {
        openrouter: {
            url: 'https://openrouter.ai/api/v1/chat/completions',
            model: 'meta-llama/llama-3.3-70b-instruct:free',
            needsKey: true,
            needsUrl: false,
            keyPlaceholder: 'sk-or-...',
            format: 'openai'
        },
        ollama: {
            url: 'http://localhost:11434/v1/chat/completions',
            model: 'qwen3:8b',
            needsKey: false,
            needsUrl: true,
            format: 'openai'
        },
        lmstudio: {
            url: 'http://localhost:1234/v1/chat/completions',
            model: 'local-model',
            needsKey: false,
            needsUrl: true,
            format: 'openai'
        },
        claude: {
            url: 'https://api.anthropic.com/v1/messages',
            model: 'claude-sonnet-4-20250514',
            needsKey: true,
            needsUrl: false,
            keyPlaceholder: 'sk-ant-...',
            format: 'claude'
        }
    };

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
            m.latestWeight = round2((last.w || 0) / 1000);
            m.latestUsd = round2((last.u || 0) / 1000);
            m.latestRub = round2((last.r || 0) / 1000);
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
            }
            if (type === 'price-dynamics' && statUsdCol && weightCol) {
                var prices = [];
                var byCY = {};
                data.forEach(function (row) {
                    var c = String(row[countryCol] || '').trim();
                    var y = String(row[yearCol] || '').trim();
                    if (!c || !y) return;
                    var k = c + '|' + y;
                    if (!byCY[k]) byCY[k] = { u: 0, w: 0 };
                    byCY[k].u += (Number(row[statUsdCol]) || 0);
                    byCY[k].w += (Number(row[weightCol]) || 0);
                });
                Object.keys(byCY).forEach(function (k) { var d = byCY[k]; if (d.w > 0) prices.push(round2(d.u / d.w)); });
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
                m.leaderVolume = sd.sources.length > 0 ? round2(sd.sources[0].total) : 0;
                var totalFlow = sd.flows.reduce(function (s, f) { return s + f.value; }, 0);
                m.topN = topN;
                m.year = slide.year || m.lastYear;
                m.sourceLabel = type === 'sankey-sender' ? '\u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u0435\u043b\u0435\u0439' : '\u0438\u0437\u0433\u043e\u0442\u043e\u0432\u0438\u0442\u0435\u043b\u0435\u0439';
                m.targetCount = sd.targets.length;
                m.topTarget = sd.targets.length > 0 ? sd.targets[0].name : '';
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

    function generateTemplateText(type, m) {
        var lines = [];
        var trendWord = m.trend === 'growth' ? '\u0443\u0441\u0442\u043e\u0439\u0447\u0438\u0432\u044b\u0439 \u0440\u043e\u0441\u0442' : m.trend === 'decline' ? '\u0441\u043d\u0438\u0436\u0435\u043d\u0438\u0435' : '\u0441\u0442\u0430\u0431\u0438\u043b\u044c\u043d\u0443\u044e \u0434\u0438\u043d\u0430\u043c\u0438\u043a\u0443';

        if (type === 'volumes') {
            if (m.cagrWeight != null) {
                lines.push('\u0418\u043c\u043f\u043e\u0440\u0442 \u0434\u0435\u043c\u043e\u043d\u0441\u0442\u0440\u0438\u0440\u0443\u0435\u0442 ' + trendWord + ': CAGR ' + round2(m.cagrWeight) + '% \u0432 \u043d\u0430\u0442\u0443\u0440\u0430\u043b\u044c\u043d\u043e\u043c \u0432\u044b\u0440\u0430\u0436\u0435\u043d\u0438\u0438 \u0437\u0430 ' + m.firstYear + '\u2013' + m.lastYear);
            }
            if (m.cagrUsd != null) {
                lines.push('\u0412 \u0434\u043e\u043b\u043b\u0430\u0440\u043e\u0432\u043e\u043c \u0432\u044b\u0440\u0430\u0436\u0435\u043d\u0438\u0438 CAGR \u0441\u043e\u0441\u0442\u0430\u0432\u043b\u044f\u0435\u0442 ' + round2(m.cagrUsd) + '%');
            }
            if (m.cagrRub != null && m.cagrUsd != null && m.cagrRub > m.cagrUsd + 5) {
                lines.push('\u0420\u0443\u0431\u043b\u0451\u0432\u0430\u044f \u0441\u0442\u043e\u0438\u043c\u043e\u0441\u0442\u044c \u0440\u0430\u0441\u0442\u0451\u0442 \u043e\u043f\u0435\u0440\u0435\u0436\u0430\u044e\u0449\u0438\u043c\u0438 \u0442\u0435\u043c\u043f\u0430\u043c\u0438 (CAGR ' + round2(m.cagrRub) + '%), \u043e\u0442\u0440\u0430\u0436\u0430\u044f \u0432\u0430\u043b\u044e\u0442\u043d\u044b\u0439 \u0444\u0430\u043a\u0442\u043e\u0440');
            }
            if (m.latestWeight) {
                lines.push('Данные за ' + m.lastYear + ': ' + formatNumber(m.latestWeight) + ' тонн на сумму ' + formatNumber(m.latestUsd) + ' тыс. USD');
            }
        }

        if (type === 'countries') {
            if (m.leader) {
                lines.push('\u041b\u0438\u0434\u0435\u0440 \u2014 ' + m.leader + ' \u0441 \u0434\u043e\u043b\u0435\u0439 ' + m.leaderShare + '% \u043e\u0442 \u043e\u0431\u0449\u0435\u0433\u043e \u043e\u0431\u044a\u0451\u043c\u0430');
            }
            if (m.topCoverage) {
                lines.push('\u0422\u041e\u041f-' + m.topN + ' \u0441\u0442\u0440\u0430\u043d \u043e\u0431\u0435\u0441\u043f\u0435\u0447\u0438\u0432\u0430\u044e\u0442 ' + m.topCoverage + '% \u043f\u043e\u0441\u0442\u0430\u0432\u043e\u043a');
            }
            var concLevel = m.leaderShare > 40 ? '\u0432\u044b\u0441\u043e\u043a\u0430\u044f' : m.leaderShare > 20 ? '\u0443\u043c\u0435\u0440\u0435\u043d\u043d\u0430\u044f' : '\u043d\u0438\u0437\u043a\u0430\u044f';
            lines.push('\u041a\u043e\u043d\u0446\u0435\u043d\u0442\u0440\u0430\u0446\u0438\u044f \u0440\u044b\u043d\u043a\u0430: ' + concLevel + ' (\u0432\u0441\u0435\u0433\u043e ' + (m.countriesCount || '?') + ' \u0441\u0442\u0440\u0430\u043d)');
        }

        if (type === 'price-dynamics') {
            if (m.priceMin != null) {
                lines.push('\u0421\u0440\u0435\u0434\u043d\u0435\u0432\u0437\u0432\u0435\u0448\u0435\u043d\u043d\u0430\u044f \u0446\u0435\u043d\u0430 \u0432\u0430\u0440\u044c\u0438\u0440\u0443\u0435\u0442\u0441\u044f \u043e\u0442 ' + formatNumber(m.priceMin) + ' \u0434\u043e ' + formatNumber(m.priceMax) + ' USD/\u043a\u0433');
            }
            if (m.leader) {
                lines.push(m.leader + ' \u2014 \u043e\u0441\u043d\u043e\u0432\u043d\u043e\u0439 \u0446\u0435\u043d\u043e\u0432\u043e\u0439 \u043e\u0440\u0438\u0435\u043d\u0442\u0438\u0440 \u0440\u044b\u043d\u043a\u0430 (\u0434\u043e\u043b\u044f ' + m.leaderShare + '% \u043f\u043e \u043e\u0431\u044a\u0451\u043c\u0443)');
            }
        }

        if (type === 'sankey-sender' || type === 'sankey-manufacturer') {
            if (m.leader) {
                lines.push('\u0412 ' + (m.year || m.lastYear) + ' \u0433\u043e\u0434\u0443 \u043a\u0440\u0443\u043f\u043d\u0435\u0439\u0448\u0438\u0439 \u0438\u0437 ' + m.sourceLabel + ': ' + m.leader + ' (' + formatNumber(m.leaderVolume) + ' \u0442\u043e\u043d\u043d)');
            }
            if (m.topTarget) {
                lines.push('\u041a\u0440\u0443\u043f\u043d\u0435\u0439\u0448\u0438\u0439 \u043f\u043e\u043b\u0443\u0447\u0430\u0442\u0435\u043b\u044c: ' + m.topTarget);
            }
            lines.push('\u0422\u041e\u041f-' + m.topN + ' ' + m.sourceLabel + ' \u043f\u043e\u0441\u0442\u0430\u0432\u043b\u044f\u044e\u0442 \u0432 ' + (m.targetCount || '?') + ' \u043a\u043e\u043c\u043f\u0430\u043d\u0438\u0439-\u043f\u043e\u043b\u0443\u0447\u0430\u0442\u0435\u043b\u0435\u0439');
        }

        if (type === 'quarterly-prices') {
            if (m.rubMin != null) {
                lines.push('\u0426\u0435\u043d\u044b \u0432 \u0440\u0443\u0431\u043b\u044f\u0445: \u043e\u0442 ' + formatNumber(m.rubMin) + ' \u0434\u043e ' + formatNumber(m.rubMax) + ' \u0440\u0443\u0431./\u043a\u0433 (\u0441\u0440\u0435\u0434\u043d\u0435\u0435 ' + formatNumber(m.rubAvg) + ')');
            }
            if (m.usdMin != null) {
                lines.push('\u0426\u0435\u043d\u044b \u0432 \u0434\u043e\u043b\u043b\u0430\u0440\u0430\u0445: \u043e\u0442 ' + formatNumber(m.usdMin) + ' \u0434\u043e ' + formatNumber(m.usdMax) + ' USD/\u043a\u0433 (\u0441\u0440\u0435\u0434\u043d\u0435\u0435 ' + formatNumber(m.usdAvg) + ')');
            }
            if (m.rubMax && m.rubMin && m.rubMin > 0) {
                var volatility = round2((m.rubMax - m.rubMin) / m.rubMin * 100);
                if (volatility > 30) {
                    lines.push('\u0412\u044b\u0441\u043e\u043a\u0430\u044f \u0432\u043e\u043b\u0430\u0442\u0438\u043b\u044c\u043d\u043e\u0441\u0442\u044c: \u0440\u0430\u0437\u0431\u0440\u043e\u0441 \u0446\u0435\u043d ' + volatility + '%');
                }
            }
        }

        return lines;
    }

    var SEARCH_MODELS = ['perplexity/sonar', 'perplexity/sonar-pro'];

    /* Удаляет символы вне ASCII (>255) из строки — защита от ошибки ByteString при вставке ключей с Unicode */
    function sanitizeAscii(str) {
        if (!str) return str;
        return str.replace(/[^\x00-\xFF]/g, '');
    }

    function buildAIPrompt(type, metrics, model) {
        var typeLabels = {
            'volumes': 'Объёмы и стоимость импорта',
            'countries': 'Объёмы по странам',
            'price-dynamics': 'Динамика цен по странам',
            'sankey-sender': 'Структура поставок: отправители и получатели',
            'sankey-manufacturer': 'Структура поставок: изготовители и получатели',
            'quarterly-prices': 'Поквартальная динамика цен'
        };
        var typeLabel = typeLabels[type] || type;
        var years = (metrics.years || []).join('–');

        var basePrompt = 'Ты аналитик ВЭД (внешнеэкономическая деятельность). На основе метрик напиши 3–5 аналитических тезисов для слайда презентации.\n\n' +
            'Тип слайда: ' + typeLabel + '\n' +
            'Метрики из данных: ' + JSON.stringify(metrics, null, 2) + '\n\n' +
            'Формат: каждый тезис с новой строки, без нумерации, деловой стиль, на русском. Только тезисы, без вступлений.';

        if (model && SEARCH_MODELS.indexOf(model) !== -1) {
            return basePrompt +
                '\n\nДополнительно: найди в интернете актуальные рыночные данные по этой теме' +
                (years ? ' (период ' + years + ')' : '') +
                (metrics.leader ? ', включая информацию по стране/компании: ' + metrics.leader : '') +
                '. Добавь 1–2 тезиса на основе найденных внешних данных, указав источник в скобках в конце тезиса.';
        }

        return basePrompt;
    }

    function generateAIText(type, metrics, providerKey, apiKey, customUrl, selectedModel) {
        var provider = AI_PROVIDERS[providerKey] || AI_PROVIDERS.openrouter;
        apiKey = sanitizeAscii(apiKey);
        selectedModel = sanitizeAscii(selectedModel);
        var model = selectedModel || provider.model;
        var prompt = buildAIPrompt(type, metrics, model);

        // Claude API — отдельный формат
        if (provider.format === 'claude') {
            return fetch(provider.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify({
                    model: model,
                    max_tokens: 500,
                    messages: [{ role: 'user', content: prompt }]
                })
            })
            .then(function (resp) {
                if (!resp.ok) throw new Error('Claude API: ' + resp.status);
                return resp.json();
            })
            .then(function (json) {
                var text = '';
                if (json.content && json.content[0] && json.content[0].text) {
                    text = json.content[0].text;
                }
                return text.trim();
            });
        }

        // OpenAI-совместимый формат (OpenRouter, Ollama, LM Studio)
        var url = customUrl || provider.url;
        // Для Ollama/LM Studio: добавить /v1/chat/completions если только хост
        if ((providerKey === 'ollama' || providerKey === 'lmstudio') && customUrl && customUrl.indexOf('/v1/') === -1) {
            url = url.replace(/\/+$/, '') + '/v1/chat/completions';
        }

        var hdrs = { 'Content-Type': 'application/json' };
        if (apiKey) { hdrs['Authorization'] = 'Bearer ' + apiKey; }
        if (providerKey === 'openrouter') {
            hdrs['HTTP-Referer'] = 'https://delomant.ru';
        }

        return fetch(url, {
            method: 'POST',
            headers: hdrs,
            body: JSON.stringify({
                model: model,
                max_tokens: 500,
                messages: [{ role: 'user', content: prompt }]
            })
        })
        .then(function (resp) {
            if (!resp.ok) throw new Error(providerKey + ' API: ' + resp.status);
            return resp.json();
        })
        .then(function (json) {
            var text = '';
            if (json.choices && json.choices[0] && json.choices[0].message) {
                text = json.choices[0].message.content;
            }
            return (text || '').trim();
        });
    }

    // --- PDF-экспорт (Фаза 5) ---
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

        function renderNext() {
            if (slideIndex >= total) {
                pdf.save(baseFileName() + '_presentation.pdf');
                offscreen.innerHTML = '';
                progressOverlay.style.display = 'none';
                return;
            }

            var slide = presState.slides[slideIndex];
            var filteredData = filterDataByHS(data, headers, slide.hsFilter);
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
                    var imgData = canvas.toDataURL('image/jpeg', 0.92);
                    if (slideIndex > 0) pdf.addPage();
                    pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210);

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

    // Export PPTX
    presExportPptxBtn.addEventListener('click', exportPresPPTX);

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
        pres.layout = 'LAYOUT_16x9'; // 10" × 5.625"
        pres.author = 'Delomant';
        pres.title = presState.slides[0] ? (presState.slides[0].title || 'Презентация') : 'Презентация';

        var SIMPLE_TYPES = ['title', 'text', 'summary', 'toc', 'section-divider', 'contacts'];

        // --- Простые слайды (нативные shape'ы) ---

        function addTitleSlide(slideData) {
            var sl = pres.addSlide();
            sl.background = { color: '0F172A' };
            sl.addText(slideData.title || 'Аналитическая справка', {
                x: 0.8, y: 2.0, w: 8.4, h: 1.0,
                fontSize: 32, fontFace: 'Arial', color: 'FFFFFF', bold: true, align: 'center', valign: 'middle'
            });
            var subtitle = (slideData.opts && slideData.opts.subtitle) || '';
            if (subtitle) {
                sl.addText(subtitle, {
                    x: 0.8, y: 3.0, w: 8.4, h: 0.6,
                    fontSize: 18, fontFace: 'Arial', color: 'CBD5E1', align: 'center', valign: 'middle'
                });
            }
            sl.addText('delomant.ru  ·  ' + new Date().getFullYear(), {
                x: 0.8, y: 4.8, w: 8.4, h: 0.4,
                fontSize: 12, fontFace: 'Arial', color: '64748B', align: 'center', valign: 'middle'
            });
        }

        function addTextSlide(slideData) {
            var sl = pres.addSlide();
            sl.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.55, fill: { color: '2563EB' } });
            sl.addText(slideData.title || 'Текст', {
                x: 0.3, y: 0.05, w: 9.4, h: 0.45,
                fontSize: 20, fontFace: 'Arial', color: 'FFFFFF', bold: true, valign: 'middle'
            });
            var bullets = ((slideData.opts && slideData.opts.bullets) || '').split('\n').filter(function(l) { return l.trim(); });
            if (bullets.length > 0) {
                var textRows = bullets.map(function(l) {
                    var clean = typeof stripMarkdown === 'function' ? stripMarkdown(l) : l;
                    return { text: clean.trim(), options: { fontSize: 14, fontFace: 'Arial', color: '0F172A', bullet: true, breakLine: true } };
                });
                sl.addText(textRows, {
                    x: 0.3, y: 0.7, w: 9.4, h: 4.6,
                    valign: 'top', paraSpaceAfter: 8
                });
            }
        }

        function addTocSlide() {
            var sl = pres.addSlide();
            sl.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.55, fill: { color: '2563EB' } });
            sl.addText('Содержание', {
                x: 0.3, y: 0.05, w: 9.4, h: 0.45,
                fontSize: 20, fontFace: 'Arial', color: 'FFFFFF', bold: true, valign: 'middle'
            });
            var num = 1;
            var items = [];
            presState.slides.forEach(function(s) {
                if (s.type === 'toc') return;
                var block = findPresBlock(s.type);
                var label = s.title || (block ? block.label : '');
                items.push({ text: num + '.  ' + label, options: { fontSize: 14, fontFace: 'Arial', color: '334155', breakLine: true } });
                num++;
            });
            sl.addText(items, {
                x: 0.4, y: 0.7, w: 9.2, h: 4.6,
                valign: 'top', paraSpaceAfter: 6
            });
        }

        function addSectionSlide(slideData) {
            var sl = pres.addSlide();
            sl.background = { color: '1E40AF' };
            var title = slideData.title || 'Раздел';
            if (slideData.hsFilter) title += '  (' + slideData.hsFilter + ')';
            sl.addText(title, {
                x: 0.8, y: 2.0, w: 8.4, h: 1.5,
                fontSize: 28, fontFace: 'Arial', color: 'FFFFFF', bold: true, align: 'center', valign: 'middle'
            });
        }

        function addContactsSlide() {
            var sl = pres.addSlide();
            sl.background = { color: '0F172A' };
            sl.addText('Контакты', {
                x: 0.8, y: 1.2, w: 8.4, h: 0.8,
                fontSize: 28, fontFace: 'Arial', color: 'FFFFFF', bold: true, align: 'center'
            });
            var lines = [
                { text: 'Москва', options: { fontSize: 16, color: 'E2E8F0', breakLine: true } },
                { text: 'Кутузовский проспект, 35', options: { fontSize: 16, color: 'CBD5E1', breakLine: true } },
                { text: '+7 (495) 445 97 77', options: { fontSize: 16, color: 'CBD5E1', breakLine: true } },
                { text: 'info@delomant.ru', options: { fontSize: 16, color: '93C5FD', breakLine: true } }
            ];
            sl.addText(lines, {
                x: 0.8, y: 2.2, w: 8.4, h: 2.5,
                fontFace: 'Arial', align: 'center', paraSpaceAfter: 10
            });
            sl.addText('delomant.ru', {
                x: 0.8, y: 4.8, w: 8.4, h: 0.4,
                fontSize: 12, fontFace: 'Arial', color: '64748B', align: 'center'
            });
        }

        // --- Рендер аналитического слайда в JPEG через html2canvas ---
        function renderSlideToJpeg(slide) {
            return new Promise(function(resolve) {
                var filteredData = filterDataByHS(data, headers, slide.hsFilter);
                var html = renderPresSlideByType(slide, filteredData, headers);
                offscreen.innerHTML = html;
                setTimeout(function() {
                    var el = offscreen.querySelector('.pres-slide');
                    if (!el) { offscreen.innerHTML = ''; resolve(null); return; }
                    window.html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#FFFFFF', width: 960, height: 540 })
                        .then(function(canvas) {
                            offscreen.innerHTML = '';
                            resolve(canvas.toDataURL('image/jpeg', 0.92));
                        }).catch(function() { offscreen.innerHTML = ''; resolve(null); });
                }, 200);
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

            if (isSimple) {
                if (slideData.type === 'title') addTitleSlide(slideData);
                else if (slideData.type === 'toc') addTocSlide();
                else if (slideData.type === 'section-divider') addSectionSlide(slideData);
                else if (slideData.type === 'contacts') addContactsSlide();
                else addTextSlide(slideData); // text, summary
                slideIndex++;
                setTimeout(processNext, 0);
            } else {
                // Аналитический слайд — рендерим в JPEG, вставляем как изображение
                renderSlideToJpeg(slideData).then(function(jpegDataUrl) {
                    var sl = pres.addSlide();
                    if (jpegDataUrl) {
                        sl.addImage({ data: jpegDataUrl, x: 0, y: 0, w: 10, h: 5.625 });
                    }
                    // Редактируемый заголовок поверх картинки
                    sl.addShape(pres.ShapeType.rect, {
                        x: 0, y: 0, w: 10, h: 0.55,
                        fill: { color: '2563EB', transparency: 10 }
                    });
                    sl.addText(slideData.title || '', {
                        x: 0.15, y: 0.05, w: 9.7, h: 0.45,
                        fontSize: 18, fontFace: 'Arial', color: 'FFFFFF', bold: true, valign: 'middle'
                    });
                    slideIndex++;
                    processNext();
                });
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
        var lines = generateTemplateText(slide.type, metrics);
        if (lines.length === 0) {
            document.querySelector('.pres-set-commentary').value = 'Недостаточно данных для генерации текста';
        } else {
            document.querySelector('.pres-set-commentary').value = lines.join('\n');
        }
    });

    // Provider select change
    document.querySelector('.pres-set-provider').addEventListener('change', function () {
        updateProviderFields(this.value);
    });

    // Model select change — показ кастомного поля
    document.querySelector('.pres-set-model-select').addEventListener('change', function () {
        var modelCustom = document.querySelector('.pres-set-model-custom');
        modelCustom.style.display = this.value === 'custom' ? '' : 'none';
        if (this.value === 'custom') modelCustom.focus();
    });

    // Хелпер: получить выбранную модель из формы
    function getSelectedModel(providerKey) {
        var modelSelect = document.querySelector('.pres-set-model-select');
        var modelCustom = document.querySelector('.pres-set-model-custom');
        if (providerKey === 'openrouter') {
            if (modelSelect.value === 'custom') {
                return modelCustom.value.trim() || AI_PROVIDERS.openrouter.model;
            }
            return modelSelect.value || AI_PROVIDERS.openrouter.model;
        }
        if (providerKey === 'ollama' || providerKey === 'lmstudio') {
            return modelCustom.value.trim() || AI_PROVIDERS[providerKey].model;
        }
        return AI_PROVIDERS[providerKey] ? AI_PROVIDERS[providerKey].model : '';
    }

    // Commentary generation: AI
    document.querySelector('.pres-gen-ai').addEventListener('click', function () {
        if (presEditingSlideId === null) return;
        var slide = null;
        for (var i = 0; i < presState.slides.length; i++) {
            if (presState.slides[i].id === presEditingSlideId) { slide = presState.slides[i]; break; }
        }
        if (!slide) return;

        var providerKey = document.querySelector('.pres-set-provider').value || 'openrouter';
        var provider = AI_PROVIDERS[providerKey] || AI_PROVIDERS.openrouter;
        var apiKey = document.querySelector('.pres-set-apikey').value.trim() || localStorage.getItem(LS_PRES_APIKEY) || '';
        var customUrl = document.querySelector('.pres-set-aiurl').value.trim() || localStorage.getItem(LS_PRES_AIURL) || '';
        var selectedModel = getSelectedModel(providerKey);

        if (provider.needsKey && !apiKey) {
            alert('Введите API-ключ для ' + providerKey);
            document.querySelector('.pres-set-apikey').focus();
            return;
        }

        var data = getActiveData();
        var headers = getActiveHeaders();
        var filteredData = filterDataByHS(data, headers, slide.hsFilter);

        var metrics = computeSlideMetrics(slide.type, filteredData, headers, slide);
        var btn = document.querySelector('.pres-gen-ai');
        btn.classList.add('loading');
        btn.textContent = 'Генерация...';

        generateAIText(slide.type, metrics, providerKey, apiKey, customUrl, selectedModel)
            .then(function (text) {
                document.querySelector('.pres-set-commentary').value = text;
                localStorage.setItem(LS_PRES_PROVIDER, providerKey);
                localStorage.setItem(LS_PRES_MODEL, selectedModel);
                if (apiKey) localStorage.setItem(LS_PRES_APIKEY, apiKey);
                if (customUrl) localStorage.setItem(LS_PRES_AIURL, customUrl);
                btn.classList.remove('loading');
                btn.textContent = 'AI генерация';
            })
            .catch(function (err) {
                var msg = 'Ошибка AI: ' + err.message;
                if ((providerKey === 'ollama' || providerKey === 'lmstudio') && (err.message === 'Failed to fetch' || err.name === 'TypeError')) {
                    msg = 'Не удалось подключиться к ' + providerKey + '.\n\n' +
                        '1. Убедитесь, что сервер запущен\n' +
                        '2. Для Ollama разрешите CORS:\n' +
                        '   Windows PowerShell: $env:OLLAMA_ORIGINS="*"; ollama serve\n' +
                        '   Linux/Mac: OLLAMA_ORIGINS=* ollama serve\n' +
                        '3. Страница должна открываться через http://, не file://';
                }
                alert(msg);
                btn.classList.remove('loading');
                btn.textContent = 'AI генерация';
            });
    });

});
