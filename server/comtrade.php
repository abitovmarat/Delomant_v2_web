<?php
/*
 * Прокси к UN Comtrade для загрузчика зеркальной статистики.
 *
 * Зачем прокси: comtradeapi.un.org не отдаёт заголовки Access-Control-*,
 * поэтому из браузера напрямую не вызвать. Прокси живёт на том же домене,
 * что и приложение, — CORS не нужен, доступ закрыт той же сессией, что и
 * остальная статика (см. asset.php).
 *
 * Что здесь ещё делается:
 *   - белый список параметров: наружу уходит только то, что мы собрали
 *     сами, произвольный URL прокинуть нельзя (иначе это open proxy);
 *   - файловый кэш на сутки: таможенная статистика за прошлые периоды
 *     не меняется, а лимиты у публичного эндпоинта жёсткие;
 *   - троттлинг: публичный preview отдаёт 429 при частых запросах,
 *     поэтому обращения к API сериализуются с паузой.
 *
 * Ключ подписки (Comtrade Plus) не обязателен. Если положить рядом файл
 * comtrade_key.php вида «<?php return 'ключ';», запросы пойдут на полный
 * эндпоинт /data/v1/get — выше лимиты и объём выдачи.
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
const CACHE_TTL     = 86400;  // сутки
const THROTTLE_USEC = 1300000; // пауза между обращениями к API, мкс
const TIMEOUT       = 45;      // «весь мир» тяжелее — даём апстриму больше времени

/** Аварийный выход с понятным фронтенду телом ответа. */
function fail(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

/* --- Разбор и проверка параметров --------------------------------- */

// Частота: годовая или месячная
$freq = (string)($_GET['freq'] ?? 'A');
if ($freq !== 'A' && $freq !== 'M') {
    fail(400, 'Частота должна быть A или M');
}

// Направление: экспорт или импорт страны-репортёра
$flow = (string)($_GET['flow'] ?? 'X');
if ($flow !== 'X' && $flow !== 'M') {
    fail(400, 'Направление должно быть X или M');
}

/**
 * Списки кодов приходят через запятую. Проверяем каждый элемент и
 * заодно ограничиваем длину — и от опечаток, и от попыток подсунуть
 * лишнее в строку запроса.
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

// Публичный preview принимает только один период за запрос («Maximum number
// of periods for preview is 1»), с ключом подписки лимит выше. Здесь стоит
// верхняя граница на всякий случай — разбивку делает фронтенд.
$reporter = codeList((string)($_GET['reporter'] ?? ''), '/^\d{1,4}$/',       40, 'Страны');
$period   = codeList((string)($_GET['period']   ?? ''), '/^\d{4}(\d{2})?$/', 12, 'Периоды');

// Партнёр всегда один — это та сторона, чью торговлю мы смотрим (обычно РФ).
// Пустое значение мог прислать старый кэшированный фронтенд после обновления
// списка <option>; для обратной совместимости восстанавливаем значение РФ.
$partner = trim((string)($_GET['partner'] ?? '643'));
if ($partner === '') {
    $partner = '643';
}
if (!preg_match('/^\d{1,4}$/', $partner)) {
    fail(400, 'Некорректный код партнёра');
}

// Коды ТН ВЭД: 2–6 знаков либо TOTAL/ALL
$cmdRaw = trim((string)($_GET['cmd'] ?? 'TOTAL'));
$cmd = ($cmdRaw === 'TOTAL' || $cmdRaw === 'ALL')
    ? $cmdRaw
    : codeList($cmdRaw, '/^\d{2,6}$/', 40, 'Коды ТН ВЭД');

/* --- Кэш ----------------------------------------------------------- */

$query = [
    'reporterCode' => $reporter,
    'period'       => $period,
    'partnerCode'  => $partner,
    'cmdCode'      => $cmd,
    'flowCode'     => $flow,
];

/*
 * Режим «весь мир» просит итог явно: partner2Code=0.
 *
 * Без этого запрос с partnerCode=0 возвращает разбивку по каждой второй
 * стране — у Германии за 2023 это 202 значения partner2Code, — а сам итог
 * не помещается в лимит выдачи и пропадает. Фронтенд тогда не находит
 * итоговой строки и складывает обрезанные разрезы, занижая сумму.
 *
 * Ставим только здесь: при партнёре-стране этот же параметр, наоборот,
 * отдаёт пустой ответ (проверено на Вьетнам→РФ, код 030617 за 2023).
 */
if ($partner === '0') {
    $query['partner2Code'] = '0';
}

$cacheKey  = sha1($freq . '|' . implode('|', $query));
$cacheFile = CACHE_DIR . '/' . $cacheKey . '.json';

if (is_file($cacheFile) && (time() - filemtime($cacheFile)) < CACHE_TTL) {
    header('X-Comtrade-Cache: hit');
    readfile($cacheFile);
    exit;
}

/* --- Запрос к API -------------------------------------------------- */

$keyFile = __DIR__ . '/comtrade_key.php';
$apiKey  = '';
if (is_file($keyFile)) {
    $apiKey = (string)(require $keyFile);
}

$base = $apiKey !== ''
    ? 'https://comtradeapi.un.org/data/v1/get/C/' . $freq . '/HS'
    : 'https://comtradeapi.un.org/public/v1/preview/C/' . $freq . '/HS';

$url = $base . '?' . http_build_query($query);

/*
 * Пауза между обращениями. Блокировка нужна, чтобы две вкладки не ушли
 * в API одновременно и не поймали 429 на двоих.
 */
if (!is_dir(CACHE_DIR)) {
    @mkdir(CACHE_DIR, 0775, true);
}
$lockFile = CACHE_DIR . '/.throttle';
$lock = @fopen($lockFile, 'c+');
if ($lock !== false) {
    flock($lock, LOCK_EX);
    $last = (int)stream_get_contents($lock);
    $wait = $last + THROTTLE_USEC - (int)(microtime(true) * 1000000);
    if ($wait > 0) {
        usleep(min($wait, 3000000));
    }
}

$headers = ['Accept: application/json'];
if ($apiKey !== '') {
    $headers[] = 'Ocp-Apim-Subscription-Key: ' . $apiKey;
}

// Чтобы PHP не оборвал скрипт раньше, чем cURL дождётся ответа апстрима
@set_time_limit(TIMEOUT + 15);

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => TIMEOUT,
    CURLOPT_CONNECTTIMEOUT => 15,
    CURLOPT_HTTPHEADER     => $headers,
    CURLOPT_USERAGENT      => 'Delomant-Analytics/2.0',
]);
$body   = curl_exec($ch);
$status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
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
    fail(502, 'Comtrade недоступен: ' . ($curlErr !== '' ? $curlErr : 'нет ответа'));
}

// 429 отдаём как есть — фронтенд по этому коду повторит запрос
if ($status === 429) {
    fail(429, 'Comtrade: превышен лимит запросов, повторите через несколько секунд');
}

if ($status !== 200) {
    fail(502, 'Comtrade вернул ' . $status);
}

// Кэшируем только валидный JSON с данными, чтобы не залипнуть на ошибке
$parsed = json_decode((string)$body, true);
if (!is_array($parsed) || !isset($parsed['data'])) {
    fail(502, 'Comtrade вернул неожиданный ответ');
}

file_put_contents($cacheFile, (string)$body, LOCK_EX);

header('X-Comtrade-Cache: miss');
echo $body;
