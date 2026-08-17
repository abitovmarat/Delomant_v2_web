<?php
/*
 * Управление аккаунтами проверяющих. Доступно только владельцу
 * (сессия с ролью full — вход по общему паролю из config.php).
 *
 * Хранилище — server/users.php: PHP-массив логин → {hash, ФИО, role}.
 * Пароли хранятся только как bcrypt-хеши, создаются здесь. Файл пишется
 * с правами 0600 и в репозиторий не попадает (как config.php).
 *
 * Формы защищены CSRF-токеном сессии.
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

// Только владелец с полным доступом
if (empty($_SESSION['auth']) || (($_SESSION['role'] ?? '') !== 'full')) {
    http_response_code(403);
    header('Content-Type: text/html; charset=UTF-8');
    exit('Доступ только для владельца. <a href="/">Войти</a>');
}

$usersFile = __DIR__ . '/users.php';

/** Прочитать текущий список аккаунтов. */
function loadUsers(string $file): array
{
    if (!is_file($file)) { return []; }
    $data = require $file;
    return is_array($data) ? $data : [];
}

/** Записать список аккаунтов обратно в users.php. */
function saveUsers(string $file, array $users): bool
{
    $body = "<?php\n// Аккаунты проверяющих. Создаются admin.php. Не редактировать вручную.\n"
          . 'return ' . var_export($users, true) . ";\n";
    if (file_put_contents($file, $body, LOCK_EX) === false) { return false; }
    @chmod($file, 0600);
    return true;
}

// CSRF-токен сессии
if (empty($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(16));
}
$csrf = $_SESSION['csrf'];

$users  = loadUsers($usersFile);
$error  = '';
$notice = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!hash_equals($csrf, (string)($_POST['csrf'] ?? ''))) {
        $error = 'Сессия устарела, обновите страницу и повторите.';
    } else {
        $action = (string)($_POST['action'] ?? '');

        if ($action === 'add') {
            $login = trim((string)($_POST['login'] ?? ''));
            $name  = trim((string)($_POST['name'] ?? ''));
            $pass  = (string)($_POST['password'] ?? '');

            if (!preg_match('/^[a-zA-Z0-9_.-]{3,32}$/', $login)) {
                $error = 'Логин: 3–32 символа, латиница, цифры, . _ -';
            } elseif (isset($users[$login])) {
                $error = 'Такой логин уже есть.';
            } elseif ($name === '' || mb_strlen($name) > 120) {
                $error = 'Укажите ФИО (до 120 символов).';
            } elseif (mb_strlen($pass) < 8) {
                $error = 'Пароль должен быть не короче 8 символов.';
            } else {
                $users[$login] = [
                    'hash'    => password_hash($pass, PASSWORD_BCRYPT),
                    'name'    => $name,
                    'role'    => 'expert',
                    'created' => date('Y-m-d'),
                ];
                if (saveUsers($usersFile, $users)) {
                    $notice = 'Аккаунт «' . $login . '» создан.';
                } else {
                    $error = 'Не удалось записать users.php — проверьте права на папку.';
                    unset($users[$login]);
                }
            }
        } elseif ($action === 'delete') {
            $login = (string)($_POST['login'] ?? '');
            if (isset($users[$login])) {
                unset($users[$login]);
                if (saveUsers($usersFile, $users)) {
                    $notice = 'Аккаунт «' . $login . '» удалён.';
                } else {
                    $error = 'Не удалось записать users.php.';
                    $users = loadUsers($usersFile);
                }
            }
        }
    }
}

header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-cache, private');

function h(string $s): string { return htmlspecialchars($s, ENT_QUOTES); }
?>
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Delomant — Проверяющие</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'DejaVu Sans', sans-serif;
        min-height: 100vh; color: #0F172A; background: #F1F5F9; padding: 40px 20px;
    }
    .wrap { max-width: 760px; margin: 0 auto; }
    .top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    h1 { font-size: 22px; }
    .top a { font-size: 13px; color: #2563EB; text-decoration: none; }
    .panel { background: #fff; border: 1px solid #E2E8F0; border-radius: 14px; padding: 24px 26px; margin-bottom: 22px; }
    .panel h2 { font-size: 15px; margin-bottom: 16px; color: #334155; }
    .msg { font-size: 13px; border-radius: 8px; padding: 10px 12px; margin-bottom: 16px; }
    .msg.err { color: #DC2626; background: #FEF2F2; border: 1px solid #FECACA; }
    .msg.ok  { color: #16A34A; background: #F0FDF4; border: 1px solid #BBF7D0; }
    form.add { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    form.add .full { grid-column: 1 / -1; }
    label { font-size: 12px; font-weight: 600; color: #64748B; display: block; margin-bottom: 5px; }
    input {
        width: 100%; padding: 10px 12px; font-size: 14px; font-family: inherit; color: #0F172A;
        background: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 9px;
    }
    input:focus { outline: none; border-color: #2563EB; background: #fff; box-shadow: 0 0 0 3px rgba(37,99,235,.12); }
    button.primary {
        padding: 11px 20px; font-size: 14px; font-weight: 600; font-family: inherit; color: #fff;
        background: #2563EB; border: none; border-radius: 9px; cursor: pointer;
    }
    button.primary:hover { background: #1D4ED8; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { text-align: left; padding: 11px 8px; border-bottom: 1px solid #E2E8F0; }
    th { font-size: 12px; color: #94A3B8; font-weight: 600; }
    td .del {
        padding: 6px 12px; font-size: 13px; color: #DC2626; background: #FEF2F2;
        border: 1px solid #FECACA; border-radius: 7px; cursor: pointer; font-family: inherit;
    }
    td .del:hover { background: #FEE2E2; }
    .empty { color: #94A3B8; font-size: 14px; padding: 8px 0; }
</style>
</head>
<body>
    <div class="wrap">
        <div class="top">
            <h1>Проверяющие реестра</h1>
            <a href="/">← в приложение</a>
        </div>

        <?php if ($error): ?><div class="msg err"><?= h($error) ?></div><?php endif; ?>
        <?php if ($notice): ?><div class="msg ok"><?= h($notice) ?></div><?php endif; ?>

        <div class="panel">
            <h2>Добавить проверяющего</h2>
            <form class="add" method="post" autocomplete="off">
                <input type="hidden" name="csrf" value="<?= h($csrf) ?>">
                <input type="hidden" name="action" value="add">
                <div>
                    <label for="login">Логин</label>
                    <input type="text" id="login" name="login" placeholder="ivanov" required>
                </div>
                <div>
                    <label for="name">ФИО</label>
                    <input type="text" id="name" name="name" placeholder="Иванов И. И." required>
                </div>
                <div class="full">
                    <label for="password">Пароль <span style="color:#94A3B8;font-weight:400">(от 8 символов)</span></label>
                    <input type="password" id="password" name="password" autocomplete="new-password" required>
                </div>
                <div class="full">
                    <button class="primary" type="submit">Создать аккаунт</button>
                </div>
            </form>
        </div>

        <div class="panel">
            <h2>Аккаунты (<?= count($users) ?>)</h2>
            <?php if (empty($users)): ?>
                <div class="empty">Пока нет ни одного аккаунта проверяющего.</div>
            <?php else: ?>
                <table>
                    <thead><tr><th>Логин</th><th>ФИО</th><th>Роль</th><th>Создан</th><th></th></tr></thead>
                    <tbody>
                    <?php foreach ($users as $login => $u): ?>
                        <tr>
                            <td><?= h((string)$login) ?></td>
                            <td><?= h((string)($u['name'] ?? '')) ?></td>
                            <td><?= h((string)($u['role'] ?? 'expert')) ?></td>
                            <td><?= h((string)($u['created'] ?? '—')) ?></td>
                            <td>
                                <form method="post" onsubmit="return confirm('Удалить аккаунт «<?= h((string)$login) ?>»?');" style="margin:0">
                                    <input type="hidden" name="csrf" value="<?= h($csrf) ?>">
                                    <input type="hidden" name="action" value="delete">
                                    <input type="hidden" name="login" value="<?= h((string)$login) ?>">
                                    <button class="del" type="submit">Удалить</button>
                                </form>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>
        </div>
    </div>
</body>
</html>
