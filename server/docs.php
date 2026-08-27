<?php
/*
 * Публичная страница документации: https://delomant-analytics-system.ru/docs/
 *
 * Открыта без авторизации намеренно. Требование реестра — документация с
 * описанием функциональных характеристик и сведениями для установки и
 * эксплуатации должна быть доступна по прямой ссылке, иначе эксперт не
 * сможет её открыть.
 *
 * Само приложение остаётся за формой входа: здесь отдаются только PDF из
 * каталога docs_files/, файл выбирается по белому списку.
 */

declare(strict_types=1);

// Отдача файла: ?f=<ключ>
/*
 * Публикуются только документы без учётных данных экспертного доступа.
 * «Информация для эксплуатации» сюда не входит: в ней напечатаны логин и
 * пароль. В инструкции по установке те же значения вырезаны — публичная
 * версия отличается от передаваемой эксперту.
 */
$FILES = [
    'features'   => ['funkcionalnye-harakteristiki.pdf',  'Функциональные характеристики'],
    'install'    => ['instrukciya-po-ustanovke.pdf',      'Инструкция по установке'],
    'lifecycle'  => ['processy-zhiznennogo-cikla.pdf',    'Процессы жизненного цикла'],
];

$key = isset($_GET['f']) ? (string)$_GET['f'] : '';
if ($key !== '') {
    if (!isset($FILES[$key])) {
        http_response_code(404);
        exit('Документ не найден.');
    }
    $path = __DIR__ . '/docs_files/' . $FILES[$key][0];
    if (!is_file($path)) {
        http_response_code(404);
        exit('Файл недоступен.');
    }
    header('Content-Type: application/pdf');
    header('Content-Length: ' . filesize($path));
    // inline — документ открывается в браузере, а не скачивается: эксперту
    // удобнее посмотреть сразу.
    header('Content-Disposition: inline; filename="' . $FILES[$key][0] . '"');
    header('X-Content-Type-Options: nosniff');
    readfile($path);
    exit;
}

/** Размер файла в читаемом виде, либо пустая строка, если файла нет. */
function fileSizeLabel(string $name): string {
    $path = __DIR__ . '/docs_files/' . $name;
    if (!is_file($path)) { return ''; }
    $kb = filesize($path) / 1024;
    return $kb >= 1024
        ? number_format($kb / 1024, 1, ',', ' ') . ' МБ'
        : number_format($kb, 0, ',', ' ') . ' КБ';
}

$updated = '';
foreach ($FILES as $meta) {
    $p = __DIR__ . '/docs_files/' . $meta[0];
    if (is_file($p)) {
        $t = filemtime($p);
        if ($t > 0 && ($updated === '' || $t > (int)$updated)) { $updated = (string)$t; }
    }
}
$months = [1=>'января','февраля','марта','апреля','мая','июня',
           'июля','августа','сентября','октября','ноября','декабря'];
$updatedLabel = $updated !== ''
    ? (int)date('j', (int)$updated) . ' ' . $months[(int)date('n', (int)$updated)] . ' ' . date('Y', (int)$updated)
    : '';

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Документация — Delomant Analytics System</title>
<meta name="description" content="Документация Delomant Analytics System: функциональные характеристики, установка, эксплуатация и процессы жизненного цикла.">
<style>
    * { box-sizing: border-box; }
    body {
        margin: 0; padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'DejaVu Sans', sans-serif;
        color: #0F172A; line-height: 1.55;
        background: radial-gradient(circle at 30% 20%, #1E293B 0%, #0F172A 55%, #020617 100%);
        min-height: 100vh; padding: 32px 16px;
    }
    .wrap { max-width: 860px; margin: 0 auto; }
    .card { background: #fff; border-radius: 18px; overflow: hidden; box-shadow: 0 18px 50px rgba(2,6,23,.45); }
    .head { background: linear-gradient(135deg, #211CB0 0%, #2F2BC7 100%); color: #fff; padding: 30px 34px; }
    .head h1 { margin: 0 0 6px; font-size: 25px; font-weight: 800; letter-spacing: -.2px; }
    .head p { margin: 0; font-size: 14.5px; color: #C7D2FE; }
    .body { padding: 30px 34px 34px; }
    .lead { font-size: 15px; color: #475569; margin: 0 0 26px; }
    .lead b { color: #0F172A; }
    h2 { font-size: 17px; margin: 0 0 16px; color: #0F172A; }
    ul.docs { list-style: none; margin: 0 0 28px; padding: 0; }
    ul.docs li { border: 1px solid #E2E8F0; border-radius: 12px; margin-bottom: 10px; transition: border-color .15s, background .15s; }
    ul.docs li:hover { border-color: #211CB0; background: #F8FAFF; }
    ul.docs a { display: flex; align-items: center; gap: 14px; padding: 15px 18px; text-decoration: none; color: inherit; }
    .ico { flex: 0 0 auto; width: 38px; height: 38px; border-radius: 9px; background: #EEF0FF; color: #211CB0;
           display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; letter-spacing: .3px; }
    .txt { flex: 1 1 auto; min-width: 0; }
    .txt .t { font-size: 15px; font-weight: 600; color: #0F172A; }
    .txt .d { font-size: 13px; color: #64748B; margin-top: 2px; }
    .size { flex: 0 0 auto; font-size: 12.5px; color: #94A3B8; white-space: nowrap; }
    .meta { border-top: 1px solid #E2E8F0; padding-top: 22px; font-size: 13.5px; color: #475569; }
    .meta dl { display: grid; grid-template-columns: minmax(140px, auto) 1fr; gap: 8px 18px; margin: 0; }
    .meta dt { color: #64748B; }
    .meta dd { margin: 0; color: #0F172A; }
    .meta a { color: #211CB0; }
    .foot { margin-top: 22px; font-size: 12.5px; color: #94A3B8; text-align: center; }
    @media (max-width: 560px) {
        .head, .body { padding-left: 20px; padding-right: 20px; }
        .meta dl { grid-template-columns: 1fr; gap: 2px 0; }
        .meta dt { margin-top: 8px; }
        .size { display: none; }
    }
</style>
</head>
<body>
<div class="wrap">
    <div class="card">
        <div class="head">
            <h1>Delomant Analytics System</h1>
            <p>Документация программного обеспечения. Версия 0.9</p>
        </div>
        <div class="body">
            <p class="lead">
                Веб-приложение для анализа внешнеэкономической деятельности:
                получение открытой международной торговой статистики,
                расчёт рыночных показателей, подготовка отчётов и презентаций.
                Ниже размещена документация, содержащая <b>описание функциональных
                характеристик</b> программного обеспечения и <b>информацию, необходимую
                для его установки и эксплуатации</b>.
            </p>

            <h2>Документы</h2>
            <ul class="docs">
                <li>
                    <a href="?f=features">
                        <span class="ico">PDF</span>
                        <span class="txt">
                            <span class="t">Функциональные характеристики</span>
                            <span class="d">Назначение, возможности версии 0.9, источники данных, форматы экспорта</span>
                        </span>
                        <span class="size"><?= htmlspecialchars(fileSizeLabel($FILES['features'][0]), ENT_QUOTES) ?></span>
                    </a>
                </li>
                <li>
                    <a href="?f=install">
                        <span class="ico">PDF</span>
                        <span class="txt">
                            <span class="t">Инструкция по установке</span>
                            <span class="d">Требования к рабочему месту, порядок входа и признаки успешного запуска. Учётные данные предоставляются правообладателем отдельно</span>
                        </span>
                        <span class="size"><?= htmlspecialchars(fileSizeLabel($FILES['install'][0]), ENT_QUOTES) ?></span>
                    </a>
                </li>
                <li>
                    <a href="?f=lifecycle">
                        <span class="ico">PDF</span>
                        <span class="txt">
                            <span class="t">Процессы жизненного цикла</span>
                            <span class="d">Сопровождение, обновления, устранение неисправностей, техническая поддержка</span>
                        </span>
                        <span class="size"><?= htmlspecialchars(fileSizeLabel($FILES['lifecycle'][0]), ENT_QUOTES) ?></span>
                    </a>
                </li>
            </ul>

            <div class="meta">
                <dl>
                    <dt>Правообладатель</dt>
                    <dd>ООО «ДЕЛОМАНТ ГРУПП»</dd>

                    <dt>Версия</dt>
                    <dd>0.9</dd>

                    <dt>Адрес приложения</dt>
                    <dd><a href="/">delomant-analytics-system.ru</a></dd>

                    <dt>Техническая поддержка</dt>
                    <dd><a href="mailto:info@delomant.ru">info@delomant.ru</a>, +7 937 531-55-48<br>
                        понедельник — пятница, 09:00–18:00 по московскому времени</dd>
<?php if ($updatedLabel !== ''): ?>

                    <dt>Документы обновлены</dt>
                    <dd><?= htmlspecialchars($updatedLabel, ENT_QUOTES) ?></dd>
<?php endif; ?>
                </dl>
            </div>
        </div>
    </div>
    <p class="foot">© <?= date('Y') ?> ООО «ДЕЛОМАНТ ГРУПП»</p>
</div>
</body>
</html>
