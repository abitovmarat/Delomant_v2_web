<?php
/*
 * Прокси к World Bank WITS (World Integrated Trade Solution).
 *
 * WITS отдаёт мировую торговую статистику (tradestats-trade) и тарифы
 * (tradestats-tariff) по 266 странам-репортёрам, партнёрам и товарным группам.
 * Данные бесплатны, ключ не нужен. Источник потоков — во многом UN Comtrade,
 * поэтому уникальная ценность WITS для нас — широкий охват стран одним запросом
 * и тарифные ставки (TRAINS), которых больше нигде в приложении нет.
 *
 * Зачем прокси (те же причины, что и у comtrade.php):
 *   - WITS не отдаёт заголовки CORS, из браузера напрямую не вызвать;
 *   - прокси живёт на том же домене и закрыт той же сессией, что и статика;
 *   - белый список параметров — наружу уходит только собранное нами;
 *   - файловый кэш на сутки: годовая статистика за прошлые периоды не меняется;
 *   - троттлинг: публичный API ограничивает частоту запросов.
 *
 * В отличие от comtrade.php здесь ещё конвертируем ответ: WITS отдаёт SDMX-XML,
 * а фронтенду удобнее плоский JSON — разбираем <Series>/<Obs> в массив записей.
 */

declare(strict_types=1);

session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => true,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

header('Content-Type: application/json; charset=UTF-8');

if (empty($_SESSION['auth'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Требуется вход']);
    exit;
}

const CACHE_DIR     = __DIR__ . '/cache';
const CACHE_TTL     = 86400;   // сутки
const THROTTLE_USEC = 1000000; // пауза между обращениями к API, мкс
const TIMEOUT       = 40;

/** Аварийный выход с понятным фронтенду телом ответа. */
function fail(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

/* --- Разбор и проверка параметров --------------------------------- */

// Датасорс: торговля или тарифы. Только эти два — произвольный не пускаем.
$datasource = (string)($_GET['datasource'] ?? 'tradestats-trade');
if ($datasource !== 'tradestats-trade' && $datasource !== 'tradestats-tariff') {
    fail(400, 'datasource должен быть tradestats-trade или tradestats-tariff');
}

/**
 * Списки значений через запятую: проверяем каждый элемент по шаблону и
 * ограничиваем количество — и от опечаток, и от подстановки лишнего.
 */
function codeList(string $raw, string $pattern, int $max, string $label): string
{
    $raw = trim($raw);
    if ($raw === '') {
        fail(400, $label . ': пустое значение');
    }
    $parts = explode(',', $raw);
    if (count($parts) > $max) {
        fail(400, $label . ': не больше ' . $max . ' значений за запрос');
    }
    foreach ($parts as $part) {
        if (!preg_match($pattern, trim($part))) {
            fail(400, $label . ': недопустимое значение «' . $part . '»');
        }
    }
    return implode(',', array_map('trim', $parts));
}

// Страны — коды ISO3 (три латинские буквы) либо служебные ALL/WLD.
function countryCode(string $raw, int $max, string $label): string
{
    $up = strtoupper(trim($raw));
    if ($up === 'ALL' || $up === 'WLD') {
        return strtolower($up);
    }
    return strtolower(codeList($up, '/^[A-Z]{3}$/', $max, $label));
}

$reporter = countryCode((string)($_GET['reporter'] ?? ''), 10, 'Репортёр');
$partner  = countryCode((string)($_GET['partner']  ?? 'WLD'), 10, 'Партнёр');

// Годы: 4 знака, не больше 15 за запрос.
$year = codeList((string)($_GET['year'] ?? ''), '/^\d{4}$/', 15, 'Год');

// Товар: all / total либо код (2–6 знаков или группы вида «01-05_Animal»).
$productRaw = trim((string)($_GET['product'] ?? 'all'));
$productLow = strtolower($productRaw);
if ($productLow === 'all' || $productLow === 'total') {
    $product = $productLow;
} else {
    $product = codeList($productRaw, '/^[\w-]{2,20}$/', 40, 'Товар');
}

// Индикатор: белый список известных кодов WITS.
$indicatorWhitelist = [
    // tradestats-trade
    'MPRT-TRD-VL', 'XPRT-TRD-VL',       // стоимость импорта / экспорта
    'MPRT-PRTNR-SHR', 'XPRT-PRTNR-SHR', // доля партнёра
    'MPRT-PRODT-SHR', 'XPRT-PRODT-SHR', // доля товара
    'NMBR-XPRT-PRDCT', 'NMBR-MPRT-PRDCT',
    // tradestats-tariff
    'AHS-SMPL-AVRG', 'AHS-WGHTD-AVRG',  // простая / взвешенная ставка (факт.)
    'MFN-SMPL-AVRG', 'MFN-WGHTD-AVRG',  // ставка режима наибольшего благоприятствования
];
$indicator = strtoupper(trim((string)($_GET['indicator'] ?? 'MPRT-TRD-VL')));
if (!in_array($indicator, $indicatorWhitelist, true)) {
    fail(400, 'Неизвестный индикатор: ' . $indicator);
}

/* --- Кэш ----------------------------------------------------------- */

/*
 * Списки во фронтенде идут через запятую, а WITS в пути ждёт «;»
 * (проверено: reporter/rus;chn и year/2019;2020 работают, «,» и «.» — нет).
 * Переводим здесь, у самой границы с API. rawurlencode не трогаем: «;» в
 * сегменте пути допустим, а кодировать его в %3B WITS не понимает.
 */
$toWits = static function (string $s): string {
    return str_replace(',', ';', $s);
};

$path = sprintf(
    '%s/reporter/%s/year/%s/partner/%s/product/%s/indicator/%s',
    $datasource,
    $toWits($reporter),
    $toWits($year),
    $toWits($partner),
    $toWits($product),
    rawurlencode($indicator)
);

$cacheKey  = sha1($path);
$cacheFile = CACHE_DIR . '/wits_' . $cacheKey . '.json';

if (is_file($cacheFile) && (time() - filemtime($cacheFile)) < CACHE_TTL) {
    header('X-Wits-Cache: hit');
    readfile($cacheFile);
    exit;
}

/* --- Запрос к API -------------------------------------------------- */

$url = 'https://wits.worldbank.org/API/V1/SDMX/V21/datasource/' . $path;

if (!is_dir(CACHE_DIR)) {
    @mkdir(CACHE_DIR, 0775, true);
}

// Пауза между обращениями — общий с comtrade.php приём против 429.
$lockFile = CACHE_DIR . '/.wits_throttle';
$lock = @fopen($lockFile, 'c+');
if ($lock !== false) {
    flock($lock, LOCK_EX);
    $last = (int)stream_get_contents($lock);
    $wait = $last + THROTTLE_USEC - (int)(microtime(true) * 1000000);
    if ($wait > 0) {
        usleep(min($wait, 3000000));
    }
}

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => TIMEOUT,
    CURLOPT_HTTPHEADER     => ['Accept: application/xml'],
    CURLOPT_USERAGENT      => 'Delomant-Analytics/2.0',
]);
$body    = curl_exec($ch);
$status  = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr = curl_error($ch);
curl_close($ch);

if ($lock !== false) {
    ftruncate($lock, 0);
    rewind($lock);
    fwrite($lock, (string)(int)(microtime(true) * 1000000));
    flock($lock, LOCK_UN);
    fclose($lock);
}

if ($body === false) {
    fail(502, 'WITS недоступен: ' . ($curlErr !== '' ? $curlErr : 'нет ответа'));
}
if ($status === 429) {
    fail(429, 'WITS: превышен лимит запросов, повторите через несколько секунд');
}
if ($status !== 200) {
    fail(502, 'WITS вернул ' . $status);
}

/* --- Разбор SDMX-XML в плоский JSON -------------------------------- */

$records = parseWitsSdmx((string)$body);
if ($records === null) {
    fail(502, 'WITS вернул неожиданный ответ');
}

$result = json_encode([
    'datasource' => $datasource,
    'indicator'  => $indicator,
    'count'      => count($records),
    'data'       => $records,
], JSON_UNESCAPED_UNICODE);

file_put_contents($cacheFile, $result, LOCK_EX);

header('X-Wits-Cache: miss');
echo $result;

/**
 * Разбирает SDMX StructureSpecificData: каждый <Series> несёт измерения в
 * атрибутах, внутри — <Obs> с TIME_PERIOD и OBS_VALUE. Возвращает массив
 * записей либо null, если это не похоже на ответ WITS (например, footer с
 * ошибкой вместо данных).
 */
function parseWitsSdmx(string $xml): ?array
{
    $prev = libxml_use_internal_errors(true);
    $doc  = simplexml_load_string($xml);
    libxml_use_internal_errors($prev);
    if ($doc === false) {
        return null;
    }

    // <Series> лежат в неймспейсе ss; берём их без привязки к префиксу.
    $seriesNodes = $doc->xpath('//*[local-name()="Series"]');
    if ($seriesNodes === false) {
        return null;
    }

    $out = [];
    foreach ($seriesNodes as $series) {
        $sAttr = [];
        foreach ($series->attributes() as $k => $v) {
            $sAttr[(string)$k] = (string)$v;
        }
        foreach ($series->xpath('.//*[local-name()="Obs"]') as $obs) {
            $oAttr = [];
            foreach ($obs->attributes() as $k => $v) {
                $oAttr[(string)$k] = (string)$v;
            }
            $out[] = [
                'reporter'  => $sAttr['REPORTER']    ?? '',
                'partner'   => $sAttr['PARTNER']     ?? '',
                'product'   => $sAttr['PRODUCTCODE'] ?? '',
                'indicator' => $sAttr['INDICATOR']   ?? '',
                'year'      => $oAttr['TIME_PERIOD'] ?? '',
                'value'     => isset($oAttr['OBS_VALUE']) ? (float)$oAttr['OBS_VALUE'] : null,
                'source'    => $oAttr['DATASOURCE']  ?? ($sAttr['DATASOURCE'] ?? ''),
            ];
        }
    }
    return $out;
}
