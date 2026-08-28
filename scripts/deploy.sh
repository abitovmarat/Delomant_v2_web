#!/usr/bin/env bash
#
# Выкладка собранного сайта (dist/) на хостинг cloud4box по FTP.
#
# Запуск из корня проекта:
#     node build.mjs && bash scripts/deploy.sh
#
# Доступы берутся из окружения, в репозиторий они не попадают:
#     FTP_HOST=185.154.20.52 FTP_USER=user841943 FTP_PASS=... bash scripts/deploy.sh
# Либо кладутся в .env.deploy рядом с проектом (файл в .gitignore).
#
# Что НЕ трогается на сервере (создаётся там и содержит секреты):
#     config.php, users.php, comtrade_key.php — их в dist/ и нет,
#     а заливка идёт пофайлово, без зеркалирования и удаления.
#
# Пробный прогон, без реальной отправки:
#     DRY_RUN=1 bash scripts/deploy.sh

set -euo pipefail

cd "$(dirname "$0")/.."

# Доступы из .env.deploy, если он есть
if [ -f .env.deploy ]; then
    # shellcheck disable=SC1091
    . ./.env.deploy
fi

FTP_HOST="${FTP_HOST:-}"
FTP_USER="${FTP_USER:-}"
FTP_PASS="${FTP_PASS:-}"
FTP_DIR="${FTP_DIR:-/www/delomant-analytics-system.ru}"
DRY_RUN="${DRY_RUN:-}"

if [ -z "$FTP_HOST" ] || [ -z "$FTP_USER" ] || [ -z "$FTP_PASS" ]; then
    echo "Не заданы доступы. Укажите FTP_HOST, FTP_USER и FTP_PASS" >&2
    echo "в окружении или в файле .env.deploy рядом с проектом." >&2
    exit 1
fi

if [ ! -d dist ]; then
    echo "Нет каталога dist/. Сначала выполните: node build.mjs" >&2
    exit 1
fi

total=$(find dist -type f | wc -l | tr -d ' ')
echo "К выкладке: $total файлов в $FTP_DIR на $FTP_HOST"
[ -n "$DRY_RUN" ] && echo "(пробный прогон — ничего не отправляется)"
echo

ok=0
fail=0
failed_list=""

# --ftp-create-dirs сам заводит недостающие каталоги (app/, assets/, data/demo/)
while IFS= read -r file; do
    rel="${file#dist/}"
    printf '  %-52s ' "$rel"

    if [ -n "$DRY_RUN" ]; then
        echo "→ пропуск"
        ok=$((ok + 1))
        continue
    fi

    if curl --silent --show-error --fail \
            --connect-timeout 20 --max-time 300 \
            --ftp-create-dirs \
            --user "$FTP_USER:$FTP_PASS" \
            --upload-file "$file" \
            "ftp://$FTP_HOST$FTP_DIR/$rel" 2>/tmp/deploy_err; then
        echo "ok"
        ok=$((ok + 1))
    else
        echo "ОШИБКА: $(head -1 /tmp/deploy_err)"
        fail=$((fail + 1))
        failed_list="$failed_list$rel\n"
    fi
done < <(find dist -type f | sort)

echo
echo "Загружено: $ok, ошибок: $fail"

if [ "$fail" -gt 0 ]; then
    echo
    echo "Не удалось загрузить:"
    printf "%b" "$failed_list"
    echo "Сайт может остаться в промежуточном состоянии — повторите запуск." >&2
    exit 1
fi

echo
echo "Готово. Проверьте вручную:"
echo "  https://delomant-analytics-system.ru/         — витрина"
echo "  https://delomant-analytics-system.ru/login    — вход в систему"
echo "  https://delomant-analytics-system.ru/docs/    — документация"
