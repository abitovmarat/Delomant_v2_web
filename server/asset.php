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

// Ключ → [файл в assets/, MIME-тип]
$map = [
    'js'   => ['main.js.dat',               'application/javascript; charset=UTF-8'],
    'css'  => ['main.css.dat',              'text/css; charset=UTF-8'],
    'logo' => ['Logo.png.dat',              'image/png'],
    'cbr'  => ['cbr_rates.dat',             'application/json; charset=UTF-8'],
    'dict' => ['company_dictionary.dat',    'application/json; charset=UTF-8'],
    'ctry' => ['comtrade_countries.dat',    'application/json; charset=UTF-8'],
    'fcjs' => ['foreign_customs.js.dat',    'application/javascript; charset=UTF-8'],
    'fchs' => ['fc_hs_names.dat',           'application/json; charset=UTF-8'],
    'fcco' => ['fc_co.dat',                 'application/json; charset=UTF-8'],
    'fcpe' => ['fc_pe.dat',                 'application/json; charset=UTF-8'],
    'fckz' => ['fc_kz.dat',                 'application/json; charset=UTF-8'],
    'fckg' => ['fc_kg.dat',                 'application/json; charset=UTF-8'],
    'fckgs'=> ['fc_kgs.dat',                'application/json; charset=UTF-8'],
    'fckzs'=> ['fc_kzs.dat',                'application/json; charset=UTF-8'],
    'fckzd'=> ['fc_kzd.dat',                'application/json; charset=UTF-8'],
];

$key = (string)($_GET['f'] ?? '');
if (!isset($map[$key])) {
    http_response_code(404);
    exit;
}

[$file, $type] = $map[$key];
$path = __DIR__ . '/assets/' . $file;

if (!is_file($path)) {
    http_response_code(404);
    exit;
}

header('Content-Type: ' . $type);
header('Content-Length: ' . filesize($path));
header('Cache-Control: private, max-age=300');
readfile($path);
