<?php
/*
 * Одноразовая установка пароля для входа.
 *
 * Пишет config.php с bcrypt-хешем. Защищена токеном (подставляется при
 * сборке, см. build.mjs), чтобы в промежутке между выкладкой и настройкой
 * пароль не задал посторонний. Как только config.php создан — setup
 * полностью отключается.
 *
 * Пароль вводится по HTTPS и превращается в хеш прямо здесь: в открытом
 * виде он никуда не записывается и не передаётся.
 */

declare(strict_types=1);

const SETUP_TOKEN = '__SETUP_TOKEN__';

$configFile = __DIR__ . '/config.php';

// Пароль уже задан — установка закрыта навсегда
if (is_file($configFile)) {
    http_response_code(410);
    exit('Установка уже выполнена.');
}

// Без верного токена страница не открывается
if ((string)($_GET['token'] ?? '') !== SETUP_TOKEN && (string)($_POST['token'] ?? '') !== SETUP_TOKEN) {
    http_response_code(403);
    exit('Доступ запрещён.');
}

$error = '';
$done  = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $p1 = (string)($_POST['password'] ?? '');
    $p2 = (string)($_POST['password2'] ?? '');
    $pe = (string)($_POST['password_expert'] ?? ''); // необязательный экспертный пароль

    if (mb_strlen($p1) < 8) {
        $error = 'Пароль должен быть не короче 8 символов.';
    } elseif ($p1 !== $p2) {
        $error = 'Пароли не совпадают.';
    } elseif ($pe !== '' && mb_strlen($pe) < 8) {
        $error = 'Экспертный пароль должен быть не короче 8 символов.';
    } elseif ($pe !== '' && $pe === $p1) {
        $error = 'Экспертный пароль должен отличаться от основного.';
    } else {
        $hash = password_hash($p1, PASSWORD_BCRYPT);
        $body = "<?php\n// Хеш пароля для входа. Сгенерирован setup.php.\n\$AUTH_HASH = " . var_export($hash, true) . ";\n";
        if ($pe !== '') {
            // Экспертный доступ: ограниченный режим для проверяющих реестра
            // (без загрузки пользовательских выгрузок).
            $hashExpert = password_hash($pe, PASSWORD_BCRYPT);
            $body .= "// Хеш экспертного пароля (ограниченный доступ для проверяющих).\n\$AUTH_HASH_EXPERT = " . var_export($hashExpert, true) . ";\n";
        }
        if (file_put_contents($configFile, $body, LOCK_EX) === false) {
            $error = 'Не удалось записать config.php, проверьте права на папку.';
        } else {
            @chmod($configFile, 0600);
            $done = true;
        }
    }
}

header('Content-Type: text/html; charset=UTF-8');
?>
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Delomant — Установка пароля</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        min-height: 100vh; display: flex; align-items: center; justify-content: center;
        background: radial-gradient(circle at 30% 20%, #1E293B 0%, #0F172A 55%, #020617 100%);
        padding: 24px;
    }
    .card {
        width: 100%; max-width: 420px; background: #fff; border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.4); padding: 40px 36px 32px;
    }
    h1 { font-size: 20px; color: #0F172A; margin-bottom: 6px; }
    .sub { font-size: 13px; color: #94A3B8; margin-bottom: 24px; }
    form { display: flex; flex-direction: column; gap: 14px; }
    label { font-size: 13px; font-weight: 500; color: #0F172A; }
    input[type="password"] {
        width: 100%; padding: 12px 14px; font-size: 15px; font-family: inherit; color: #0F172A;
        background: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 10px;
    }
    input:focus { outline: none; border-color: #2563EB; background: #fff; box-shadow: 0 0 0 3px rgba(37,99,235,0.12); }
    button {
        margin-top: 4px; padding: 12px; font-size: 15px; font-weight: 600; font-family: inherit;
        color: #fff; background: #2563EB; border: none; border-radius: 10px; cursor: pointer;
    }
    button:hover { background: #1D4ED8; }
    .msg { font-size: 13px; border-radius: 8px; padding: 10px 12px; }
    .msg.err { color: #DC2626; background: #FEF2F2; border: 1px solid #FECACA; }
    .msg.ok  { color: #16A34A; background: #F0FDF4; border: 1px solid #BBF7D0; }
    a.btn {
        display: block; text-align: center; margin-top: 16px; padding: 12px;
        font-size: 15px; font-weight: 600; color: #fff; background: #2563EB;
        border-radius: 10px; text-decoration: none;
    }
</style>
</head>
<body>
    <div class="card">
    <?php if ($done): ?>
        <h1>Пароль установлен</h1>
        <div class="sub">Теперь можно войти в приложение.</div>
        <div class="msg ok">Готово. Установка отключена.</div>
        <a class="btn" href="/">Перейти ко входу</a>
    <?php else: ?>
        <h1>Установка пароля</h1>
        <div class="sub">Задайте пароль для входа в Delomant Analytics.</div>
        <form method="post" autocomplete="off">
            <input type="hidden" name="token" value="<?= htmlspecialchars(SETUP_TOKEN, ENT_QUOTES) ?>">
            <?php if ($error): ?><div class="msg err"><?= htmlspecialchars($error, ENT_QUOTES) ?></div><?php endif; ?>
            <label for="p1">Новый пароль <span style="color:#94A3B8">(от 8 символов)</span></label>
            <input type="password" id="p1" name="password" autofocus required autocomplete="new-password">
            <label for="p2">Повторите пароль</label>
            <input type="password" id="p2" name="password2" required autocomplete="new-password">
            <label for="pe" style="margin-top:10px">Пароль для проверяющих <span style="color:#94A3B8">(необязательно, это ограниченный доступ без загрузки данных)</span></label>
            <input type="password" id="pe" name="password_expert" autocomplete="new-password">
            <button type="submit">Сохранить</button>
        </form>
    <?php endif; ?>
    </div>
</body>
</html>
