<?php
/*
 * Точка входа сайта. Показывает форму входа, а после успешной
 * авторизации отдаёт личный кабинет (для проверяющих) или само
 * приложение (app/index.html).
 *
 * Два способа авторизации:
 *   1. Индивидуальные аккаунты — server/users.php (создаются в admin.php):
 *      логин + пароль, у каждого своя роль и ФИО. Основной путь для
 *      проверяющих реестра.
 *   2. Общий пароль владельца — config.php ($AUTH_HASH, полный доступ)
 *      и необязательный экспертный ($AUTH_HASH_EXPERT). Запасной путь:
 *      логин оставляют пустым, вводят только пароль.
 *
 * Роль определяет, что видит вошедший:
 *   - full   → сразу приложение (владелец);
 *   - expert → личный кабинет (проверяющий), из него кнопка ведёт в
 *              демо-стенд (?stand=1), где загрузка чужих выгрузок скрыта.
 *
 * config.php/users.php создаются на сервере и в репозиторий не попадают.
 * Ассеты приложения отдаёт asset.php с той же проверкой сессии.
 */

declare(strict_types=1);

// Cookie сессии: только по HTTPS, недоступна из JS, не уходит на чужие сайты
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => true,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

$configFile = __DIR__ . '/config.php';
$usersFile  = __DIR__ . '/users.php';

// Пароль ещё не задан — отправляем на установку
if (!is_file($configFile)) {
    header('Location: /setup.php');
    exit;
}
$AUTH_HASH_EXPERT = null; // необязательный хеш экспертного пароля
require $configFile; // задаёт $AUTH_HASH (и, возможно, $AUTH_HASH_EXPERT)

// Подстраховка на случай повреждённого config.php
if (empty($AUTH_HASH) || !is_string($AUTH_HASH)) {
    http_response_code(500);
    exit('Ошибка конфигурации. Переустановите пароль.');
}

// Индивидуальные аккаунты проверяющих (могут отсутствовать).
// Формат: ['login' => ['hash' => '…', 'name' => 'ФИО', 'role' => 'expert'], …]
$USERS = [];
if (is_file($usersFile)) {
    $loaded = require $usersFile;
    if (is_array($loaded)) { $USERS = $loaded; }
}

// Выход
if (isset($_GET['logout'])) {
    $_SESSION = [];
    session_destroy();
    header('Location: /');
    exit;
}

$error = false;

// Проверка введённых учётных данных
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $login    = trim((string)($_POST['login'] ?? ''));
    $password = (string)($_POST['password'] ?? '');

    $role = null;   // null → не вошли
    $name = null;   // ФИО для персонального аккаунта
    $uid  = null;   // логин аккаунта (для журнала/отображения)

    if ($login !== '' && isset($USERS[$login]) && is_array($USERS[$login])
        && !empty($USERS[$login]['hash']) && is_string($USERS[$login]['hash'])
        && password_verify($password, $USERS[$login]['hash'])) {
        // Персональный аккаунт. По умолчанию роль expert (проверяющий).
        $role = (($USERS[$login]['role'] ?? 'expert') === 'full') ? 'full' : 'expert';
        $name = (string)($USERS[$login]['name'] ?? $login);
        $uid  = $login;
    } elseif ($login === '' && $password !== '' && password_verify($password, $AUTH_HASH)) {
        // Общий пароль владельца — полный доступ
        $role = 'full';
    } elseif ($login === '' && $password !== '' && !empty($AUTH_HASH_EXPERT) && is_string($AUTH_HASH_EXPERT)
              && password_verify($password, $AUTH_HASH_EXPERT)) {
        // Общий экспертный пароль (запасной путь для проверяющих)
        $role = 'expert';
    }

    if ($role !== null) {
        session_regenerate_id(true); // защита от фиксации сессии
        $_SESSION['auth'] = true;
        $_SESSION['role'] = $role;
        $_SESSION['name'] = $name;
        $_SESSION['uid']  = $uid;
        header('Location: /');
        exit;
    }
    $error = true;
    usleep(600000); // мягко тормозим перебор
}

// Уже вошли
if (!empty($_SESSION['auth'])) {
    $role = (($_SESSION['role'] ?? 'full') === 'expert') ? 'expert' : 'full';

    // Проверяющий (expert) сначала попадает в личный кабинет. В стенд —
    // только по явному переходу (?stand=1), чтобы вход не кидал сразу в
    // приложение, а показывал, что это за стенд и как его проверять.
    if ($role === 'expert' && !isset($_GET['stand'])) {
        renderCabinet($_SESSION['name'] ?? null);
        exit;
    }

    $appFile = __DIR__ . '/app/index.html';
    if (!is_file($appFile)) {
        http_response_code(500);
        exit('Приложение не найдено.');
    }
    // no-cache: браузер каждый раз проверяет свежесть разметки, поэтому
    // новая сборка подхватывается обычным обновлением, без Ctrl+F5.
    header('Content-Type: text/html; charset=UTF-8');
    header('Cache-Control: no-cache, private');
    // Подставляем роль сессии в плейсхолдер <meta name="app-role" content="__ROLE__">.
    // HTML отдаётся с no-cache, поэтому персональная роль в кэш не попадает.
    $user = (string)($_SESSION['uid'] ?? ''); // логин индивидуального аккаунта (или пусто)
    $html = (string)file_get_contents($appFile);
    $html = str_replace('content="__ROLE__"', 'content="' . $role . '"', $html);
    $html = str_replace('content="__USER__"', 'content="' . htmlspecialchars($user, ENT_QUOTES) . '"', $html);
    echo $html;
    exit;
}

/**
 * Личный кабинет проверяющего: приветствие, инструкция «как проверять»
 * и переход в демо-стенд. Отдельная страница, а не приложение.
 */
function renderCabinet(?string $name): void
{
    $who = ($name !== null && $name !== '') ? htmlspecialchars($name, ENT_QUOTES) : 'пользователь';
    header('Content-Type: text/html; charset=UTF-8');
    header('Cache-Control: no-cache, private');
    ?>
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Delomant — Личный кабинет</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'DejaVu Sans', sans-serif;
        min-height: 100vh; color: #0F172A;
        background: radial-gradient(circle at 30% 20%, #1E293B 0%, #0F172A 55%, #020617 100%);
        display: flex; align-items: center; justify-content: center; padding: 24px;
    }
    .card {
        width: 100%; max-width: 680px; background: #fff; border-radius: 18px;
        box-shadow: 0 24px 70px rgba(0,0,0,0.45); overflow: hidden; animation: rise .4s ease;
    }
    @keyframes rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    .head {
        background: linear-gradient(135deg, #211CB0 0%, #2F2BC7 100%); color: #fff;
        padding: 30px 36px; display: flex; align-items: center; justify-content: space-between;
    }
    .head .who { font-size: 20px; font-weight: 700; }
    .head .sub { font-size: 13px; opacity: .85; margin-top: 4px; }
    .head .logout { color: #C7D2FE; font-size: 13px; text-decoration: none; }
    .head .logout:hover { color: #fff; }
    .body { padding: 30px 36px 34px; }
    .lead { font-size: 15px; color: #475569; line-height: 1.55; margin-bottom: 24px; }
    .lead b { color: #0F172A; }
    .steps { display: flex; flex-direction: column; gap: 14px; margin-bottom: 28px; }
    .step { display: flex; gap: 14px; align-items: flex-start; }
    .step .n {
        flex: 0 0 auto; width: 28px; height: 28px; border-radius: 8px; background: #EEF0FF;
        color: #211CB0; font-weight: 800; font-size: 14px; display: flex; align-items: center; justify-content: center;
    }
    .step p { font-size: 14.5px; line-height: 1.5; color: #334155; padding-top: 3px; }
    .step p b { color: #0F172A; }
    .cta {
        display: inline-flex; align-items: center; gap: 10px; padding: 14px 26px;
        font-size: 16px; font-weight: 700; color: #fff; text-decoration: none;
        background: #2F2BC7; border-radius: 12px; transition: background .15s ease;
    }
    .cta:hover { background: #211CB0; }
    .cta-top { margin-bottom: 6px; }
    .guide-title {
        margin: 26px 0 14px; font-size: 15px; font-weight: 700; color: #0F172A;
        padding-top: 20px; border-top: 1px solid #E2E8F0;
    }
    .note { margin-top: 22px; font-size: 13px; color: #94A3B8; line-height: 1.5; }
    .foot { text-align: center; padding: 16px; font-size: 12px; color: #94A3B8; border-top: 1px solid #E2E8F0; }
</style>
</head>
<body>
    <div class="card">
        <div class="head">
            <div>
                <div class="who">Здравствуйте, <?= $who ?></div>
                <div class="sub">Demo-стенд «Delomant Analytics» · доступ для экспертизы реестра</div>
            </div>
            <a class="logout" href="/?logout=1">Выйти</a>
        </div>
        <div class="body">
            <div class="lead">
                Это демонстрационный стенд аналитической системы <b>Delomant Analytics</b>.
                Он работает на открытых источниках (UN Comtrade, World Bank WITS, зарубежная
                таможенная статистика) и предназначен для проверки функциональности при
                экспертизе. В этом режиме доступны не все возможности программы.
            </div>

            <!-- Кнопка идёт до инструкции: она длинная, и искать переход
                 под ней пришлось бы прокруткой. -->
            <a class="cta cta-top" href="/?stand=1">Открыть демо-стенд →</a>
            <div class="guide-title">Как пользоваться</div>

            <div class="steps">
                <div class="step"><div class="n">1</div><p>Нажмите <b>«Открыть демо-стенд»</b> — приложение откроется в этом же окне.</p></div>

                <div class="step"><div class="n">2</div><p><b>Найдите товар, не зная кода.</b> В разделе <b>«Данные»</b> → <b>«UN Comtrade»</b> есть <b>справочник кодов</b>: впишите название товара («клубника», «сыр», «подшипники») — стенд покажет подходящие коды ТН ВЭД. Нажатие на код подставляет его в поле рядом; можно набрать сразу несколько кодов.</p></div>

                <div class="step"><div class="n">3</div><p><b>Задайте условия запроса.</b> Направление — <b>импорт или экспорт</b>; с кем идёт торговля — с конкретной страной или со всем миром; страны-партнёры можно выбрать поштучно или целым регионом («Европа», «ЕАЭС»); период — годами или месяцами. Затем <b>«Загрузить данные»</b>.</p></div>

                <div class="step"><div class="n">4</div><p><b>Заберите результат в удобном виде:</b><br>
                    • <b>Аналитическая записка (HTML)</b> — готовый отчёт в фирменном стиле: рейтинг стран, динамика, цены, выводы. Открывается в браузере и печатается в PDF;<br>
                    • <b>Для презентации (Excel)</b> — подготовленные листы, из которых удобно брать цифры для слайдов;<br>
                    • <b>Оригинал (Excel)</b> — выгрузка как её отдал источник, без обработки;<br>
                    • <b>Показать тарифы</b> — ставка ввозной пошлины по выбранному коду: видно не только сколько рынок покупает, но и во сколько обойдётся вход на него.</p></div>

                <div class="step"><div class="n">5</div><p><b>«Анализ» — расчёты уже готовы.</b> Объёмы и стоимость по периодам, рейтинг стран, динамика цен, изменения рынка между периодами. Отдельно — <b>«Сигналы и риски»</b>: концентрация рынка, зависимость от главного поставщика, кто пришёл и ушёл, разброс цен, а следом блок <b>«Что делать»</b> с рекомендациями, выведенными из этих цифр.</p></div>

                <div class="step"><div class="n">6</div><p><b>«Обогащение»</b> дополняет выгрузку: расшифровывает коды ТН ВЭД в названия товаров, подставляет регион мира по стране, считает цену за килограмм и ставку пошлины.</p></div>

                <div class="step"><div class="n">7</div><p><b>«Зарубежная таможня»</b> — готовая статистика Казахстана, Кыргызстана и Колумбии, загружать ничего не нужно. <b>«Презентация»</b> — сборка слайдов из рассчитанных показателей.</p></div>
            </div>
            <div class="note">Стенд открывается в этом же окне. Чтобы вернуться в кабинет — нажмите свой логин в шапке приложения.</div>
        </div>
        <div class="foot">© <?= date('Y') ?> Delomant Group</div>
    </div>
</body>
</html>
<?php
}

// Иначе — форма входа
http_response_code($error ? 401 : 200);
header('Content-Type: text/html; charset=UTF-8');
?>
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Delomant — Вход</title>
<style>
    :root {
        --primary: #2563EB;
        --primary-dark: #1D4ED8;
        --sidebar: #0F172A;
        --surface: #FFFFFF;
        --border: #E2E8F0;
        --text: #0F172A;
        --text-muted: #94A3B8;
        --error: #DC2626;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'DejaVu Sans', sans-serif;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: radial-gradient(circle at 30% 20%, #1E293B 0%, #0F172A 55%, #020617 100%);
        padding: 24px;
    }
    .card {
        width: 100%;
        max-width: 400px;
        background: var(--surface);
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        padding: 40px 36px 32px;
        animation: rise 0.4s ease;
    }
    @keyframes rise {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
    }
    .brand {
        text-align: center;
        margin-bottom: 28px;
    }
    .brand-mark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 56px;
        height: 56px;
        border-radius: 14px;
        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
        color: #fff;
        font-size: 26px;
        font-weight: 700;
        letter-spacing: -1px;
        margin-bottom: 16px;
    }
    .brand-name {
        font-size: 22px;
        font-weight: 700;
        color: var(--text);
        letter-spacing: -0.5px;
    }
    .brand-sub {
        font-size: 13px;
        color: var(--text-muted);
        margin-top: 4px;
    }
    form { display: flex; flex-direction: column; gap: 14px; }
    label {
        font-size: 13px;
        font-weight: 500;
        color: var(--text);
    }
    input[type="text"],
    input[type="password"] {
        width: 100%;
        padding: 12px 14px;
        font-size: 15px;
        font-family: inherit;
        color: var(--text);
        background: #F8FAFC;
        border: 1.5px solid var(--border);
        border-radius: 10px;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    input[type="text"]:focus,
    input[type="password"]:focus {
        outline: none;
        border-color: var(--primary);
        background: #fff;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
    }
    button {
        margin-top: 4px;
        padding: 12px;
        font-size: 15px;
        font-weight: 600;
        font-family: inherit;
        color: #fff;
        background: var(--primary);
        border: none;
        border-radius: 10px;
        cursor: pointer;
        transition: background 0.15s ease;
    }
    button:hover { background: var(--primary-dark); }
    button:active { transform: translateY(1px); }
    .error {
        display: <?= $error ? 'flex' : 'none' ?>;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--error);
        background: #FEF2F2;
        border: 1px solid #FECACA;
        border-radius: 8px;
        padding: 10px 12px;
    }
    .foot {
        text-align: center;
        margin-top: 24px;
        font-size: 12px;
        color: var(--text-muted);
    }
</style>
</head>
<body>
    <div class="card">
        <div class="brand">
            <div class="brand-mark">D</div>
            <div class="brand-name">Delomant Analytics</div>
        </div>
        <form method="post" autocomplete="off">
            <div class="error">Неверный логин или пароль. Попробуйте ещё раз.</div>
            <label for="login">Логин</label>
            <input type="text" id="login" name="login" autofocus
                   autocomplete="username" placeholder="Выданный логин пользователя"
                   value="<?= htmlspecialchars((string)($_POST['login'] ?? ''), ENT_QUOTES) ?>">
            <label for="password">Пароль</label>
            <input type="password" id="password" name="password"
                   required autocomplete="current-password" placeholder="Введите пароль">
            <button type="submit">Войти</button>
        </form>
        <div class="foot">© <?= date('Y') ?> Delomant Group · v0.9</div>
    </div>
</body>
</html>
