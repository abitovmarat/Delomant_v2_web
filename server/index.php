<?php
/*
 * Точка входа сайта. Показывает форму входа, а после успешной
 * авторизации отдаёт само приложение (app/index.html).
 *
 * Пароль хранится как bcrypt-хеш в config.php (создаётся setup.php,
 * в репозиторий не попадает). Ассеты приложения отдаёт asset.php
 * с той же проверкой сессии — см. .htaccess и build.mjs.
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

// Пароль ещё не задан — отправляем на установку
if (!is_file($configFile)) {
    header('Location: /setup.php');
    exit;
}
require $configFile; // задаёт $AUTH_HASH

// Подстраховка на случай повреждённого config.php
if (empty($AUTH_HASH) || !is_string($AUTH_HASH)) {
    http_response_code(500);
    exit('Ошибка конфигурации. Переустановите пароль.');
}

// Выход
if (isset($_GET['logout'])) {
    $_SESSION = [];
    session_destroy();
    header('Location: /');
    exit;
}

$error = false;

// Проверка введённого пароля
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $password = (string)($_POST['password'] ?? '');
    if ($password !== '' && password_verify($password, $AUTH_HASH)) {
        session_regenerate_id(true); // защита от фиксации сессии
        $_SESSION['auth'] = true;
        header('Location: /');
        exit;
    }
    $error = true;
    usleep(600000); // мягко тормозим перебор
}

// Уже вошли — отдаём приложение
if (!empty($_SESSION['auth'])) {
    $appFile = __DIR__ . '/app/index.html';
    if (!is_file($appFile)) {
        http_response_code(500);
        exit('Приложение не найдено.');
    }
    header('Content-Type: text/html; charset=UTF-8');
    readfile($appFile);
    exit;
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
    .field {
        position: relative;
        display: flex;
        align-items: center;
    }
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
            <div class="brand-sub">Аналитика ВЭД</div>
        </div>
        <form method="post" autocomplete="off">
            <div class="error">Неверный пароль. Попробуйте ещё раз.</div>
            <label for="password">Пароль</label>
            <div class="field">
                <input type="password" id="password" name="password"
                       autofocus required autocomplete="current-password"
                       placeholder="Введите пароль">
            </div>
            <button type="submit">Войти</button>
        </form>
        <div class="foot">© <?= date('Y') ?> Delomant Group</div>
    </div>
</body>
</html>
