<?php
/*
 * Отдаёт статику приложения (JS, CSS, логотип, JSON) только вошедшим.
 *
 * Файлы физически лежат в assets/ под расширением .dat, чтобы их не
 * перехватывал nginx в обход Apache, и закрыты от прямого доступа
 * правилом в .htaccess. Сюда запросы приходят через RewriteRule,
 * фронтенд по-прежнему обращается к обычным путям вида scripts/main.js.
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

if (empty($_SESSION['auth'])) {
    http_response_code(403);
    exit;
}

/*
 * Сессия больше не нужна — закрываем её сразу.
 *
 * PHP держит файл сессии заблокированным до конца скрипта, поэтому
 * параллельные запросы к asset.php выстраивались бы в очередь. Дальше идёт
 * только чтение файла с диска, запись в сессию не потребуется.
 */
session_write_close();

// Отдача большого файла не должна упираться в лимит времени скрипта
@set_time_limit(0);

// Ключ → [файл в assets/, MIME-тип]
$map = [
    'js'   => ['main.js.dat',               'application/javascript; charset=UTF-8'],
    'css'  => ['main.css.dat',              'text/css; charset=UTF-8'],
    'logo' => ['Logo.png.dat',              'image/png'],
    'cbr'  => ['cbr_rates.dat',             'application/json; charset=UTF-8'],
    'dict' => ['company_dictionary.dat',    'application/json; charset=UTF-8'],
    'ctry' => ['comtrade_countries.dat',    'application/json; charset=UTF-8'],
    'creg' => ['comtrade_regions.dat',      'application/json; charset=UTF-8'],
    'wits' => ['wits_countries.dat',        'application/json; charset=UTF-8'],
    'witsreg' => ['wits_regions.dat',       'application/json; charset=UTF-8'],
    'hsnames' => ['hs_names_ru.dat',         'application/json; charset=UTF-8'],
];

$key = (string)($_GET['f'] ?? '');
if (!isset($map[$key])) {
    http_response_code(404);
    exit;
}

// Пользовательский справочник компаний не входит в демонстрационный доступ.
if ($key === 'dict' && (($_SESSION['role'] ?? 'full') !== 'full')) {
    http_response_code(403);
    exit;
}

[$file, $type] = $map[$key];
$path = __DIR__ . '/assets/' . $file;

if (!is_file($path)) {
    http_response_code(404);
    exit;
}

/*
 * Кэш с обязательной ревалидацией. max-age=300 раньше заставлял браузер
 * 5 минут отдавать старый JS/CSS из кэша без перезапроса — после каждого
 * деплоя приходилось жать Ctrl+F5. Теперь `no-cache` (revalidate-каждый-раз)
 * + ETag/Last-Modified: неизменный файл отдаётся быстрым 304, новая сборка
 * подхватывается обычным обновлением страницы.
 */
/*
 * Предсжатая версия. Рядом с крупным файлом сборка кладёт .gz; если браузер
 * сообщил, что понимает gzip, отдаём его и помечаем Content-Encoding.
 */
$useGzip = false;
$gzPath  = $path . '.gz';
if (is_file($gzPath) &&
    strpos(strtolower((string)($_SERVER['HTTP_ACCEPT_ENCODING'] ?? '')), 'gzip') !== false) {
    $useGzip = true;
    $path = $gzPath;
}

$mtime = filemtime($path);
$size  = filesize($path);
// Кодировка входит в ETag: иначе сжатый и обычный ответы делили бы один
// ключ кэша, и браузер мог получить не тот вариант.
$etag  = '"' . $mtime . '-' . $size . ($useGzip ? '-gz' : '') . '"';

header('Content-Type: ' . $type);
header('Vary: Accept-Encoding');
if ($useGzip) {
    header('Content-Encoding: gzip');
}
header('Cache-Control: private, no-cache');
header('ETag: ' . $etag);
header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $mtime) . ' GMT');

$ifNoneMatch = trim((string)($_SERVER['HTTP_IF_NONE_MATCH'] ?? ''));
$ifModSince  = trim((string)($_SERVER['HTTP_IF_MODIFIED_SINCE'] ?? ''));
if ($ifNoneMatch === $etag ||
    ($ifNoneMatch === '' && $ifModSince !== '' && @strtotime($ifModSince) >= $mtime)) {
    http_response_code(304);
    exit;
}

/*
 * Отдача большого файла.
 *
 * Заявленный Content-Length должен совпадать с числом реально отданных
 * байт. Если поверх включено сжатие (zlib.output_compression) или остался
 * буфер вывода, счёт расходится: браузер верит заголовку и обрывает чтение
 * на середине, а фронтенд получает усечённый JSON («unterminated string»
 * на крупном JSON). Поэтому сжатие для этих ответов выключаем и чистим
 * буферы.
 *
 * Читаем и шлём кусками: readfile() на файле в несколько мегабайт может
 * упереться в memory_limit и оборваться.
 */
@ini_set('zlib.output_compression', '0');
while (ob_get_level() > 0) { @ob_end_clean(); }

header('Content-Length: ' . $size);

$fh = fopen($path, 'rb');
if ($fh === false) {
    http_response_code(500);
    exit;
}
while (!feof($fh)) {
    $chunk = fread($fh, 262144);
    if ($chunk === false) { break; }
    echo $chunk;
    flush();
}
fclose($fh);
