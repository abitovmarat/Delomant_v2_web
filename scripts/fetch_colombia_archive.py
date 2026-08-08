# -*- coding: utf-8 -*-
"""
Загрузка архива деклараций импорта Колумбии (DIAN) за 2020–2026.

ОБЪЁМ. DIAN публикует НЕДЕЛЬНЫЕ файлы (~130 МБ каждый, накопительно внутри
месяца). Полный охват 2020–2026 — это сотни файлов и десятки гигабайт, поэтому:
  * качаем только ПОСЛЕДНИЙ файл каждого месяца — он накопительный и содержит
    месяц целиком, промежуточные недели скачивать незачем;
  * файл, уже лежащий на диске нужного размера, не перекачивается — прерванную
    загрузку можно просто запустить заново;
  * загрузка идёт по одному файлу: параллельные потоки на этот сервер приводят
    к обрывам.

ИМЕНОВАНИЕ. Угадывать шаблон НЕЛЬЗЯ — за годы он менялся минимум четырежды:
  Importaciones-500-enero-2020.zip            (2020, помесячно)
  Importaciones-500-abril-2021-total.zip      (2021–2022, суффикс -total)
  Importaciones%20junio%2030-2025.zip         (2025, пробелы вместо дефисов)
  Importaciones-Junio-30-2026.zip             (2026, недельные накопительные)
Поэтому скрипт СНИМАЕТ СПИСОК ССЫЛОК СО СТРАНИЦЫ реестра и разбирает из имени
год и месяц. Когда за месяц выложено несколько файлов (недельные срезы 2025–2026),
берётся файл с наибольшим днём: он накопительный и содержит месяц целиком.

ЗАПУСК (PowerShell):
  python scripts/fetch_colombia_archive.py [<каталог>] [--from 2020] [--to 2026]
  python scripts/fetch_colombia_archive.py --list      # только проверить наличие
"""
import io, os, re, sys, json, time

try:
    from urllib.request import urlopen, Request
    from urllib.error import HTTPError, URLError
    from urllib.parse import unquote
except ImportError:                      # pragma: no cover
    from urllib2 import urlopen, Request, HTTPError, URLError
    from urllib import unquote

BASE = ("https://www.dian.gov.co/dian/cifras/Documents/"
        "Registro-declaraciones-de-importacion-y-exportacion")
PAGE = "https://www.dian.gov.co/dian/cifras/Paginas/Registro-de-las-Declaraciones-de-Impo-Expo.aspx"
MONTHS = {"enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
          "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
          "noviembre": 11, "diciembre": 12}
UA = "Mozilla/5.0 (compatible; Delomant-analytics/1.0; +offline data prep)"


def head(url, timeout=40):
    """Размер файла по URL или None, если его нет."""
    try:
        req = Request(url, headers={"User-Agent": UA})
        req.get_method = lambda: "HEAD"
        with urlopen(req, timeout=timeout) as r:
            return int(r.headers.get("Content-Length") or 0)
    except (HTTPError, URLError, OSError, ValueError):
        return None


def page_links():
    """Ссылки на файлы импорта со страницы реестра: {'ГГГГ-ММ': (url, день)}."""
    req = Request(PAGE, headers={"User-Agent": UA})
    with urlopen(req, timeout=120) as r:
        html = r.read().decode("utf-8", "replace")
    best = {}
    for m in re.finditer(r'href="([^"]*?Importaciones[^"]*?\.zip)"', html, re.I):
        href = m.group(1)
        url = href if href.startswith("http") else "https://www.dian.gov.co" + href
        name = unquote(href.rsplit("/", 1)[-1]).lower()
        ym = re.search(r"(20\d\d)", name)
        if not ym:
            continue
        year = int(ym.group(1))
        mon = None
        for word, num_ in MONTHS.items():
            if word in name:
                mon = num_
                break
        if not mon:
            continue
        # Ранг файла — насколько полно он покрывает месяц:
        #   2 — явный полный месяц: «-total» или имя без дня (Importaciones-500-enero-2020)
        #   1 — накопительный на дату: Importaciones-enero-31-2025 (месяц с начала)
        #   0 — недельный СРЕЗ: Importaciones-enero-26-al-31-2022 (только эти дни!)
        # Срез брать нельзя — в нём часть месяца, а не месяц.
        is_range = " al " in name or "-al-" in name
        dm = re.search(r"[\s-](\d{1,2})[\s-]*20\d\d", name)
        day = int(dm.group(1)) if dm else 0
        if is_range:
            rank, day = 0, day
        elif "total" in name or not dm:
            rank, day = 2, 99
        else:
            rank = 1
        key = "%d-%02d" % (year, mon)
        slot = best.setdefault(key, {"url": None, "day": -1, "rank": -1, "parts": []})
        if is_range:
            slot["parts"].append(url)          # копим все срезы месяца
        if (rank, day) > (slot["rank"], slot["day"]):
            slot.update(url=url, day=day, rank=rank)

    # Если у месяца нашёлся только срез (rank 0), одного файла мало — это часть
    # месяца. Тогда берём ВСЕ срезы: декабрь 2022 существует лишь четырьмя
    # кусками, и любой один занизил бы месяц втрое.
    out = {}
    for key, s in best.items():
        out[key] = sorted(s["parts"]) if s["rank"] == 0 else [s["url"]]
    return out


def download(url, dest, expect):
    if os.path.isfile(dest) and abs(os.path.getsize(dest) - expect) < 1024:
        print("    = уже есть (%.0f МБ)" % (expect / 1048576.0))
        return True
    t0 = time.time()
    try:
        req = Request(url, headers={"User-Agent": UA})
        with urlopen(req, timeout=900) as r, io.open(dest, "wb") as f:
            done = 0
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                f.write(chunk); done += len(chunk)
    except Exception as e:
        print("    ! ошибка:", e)
        return False
    got = os.path.getsize(dest)
    ok = abs(got - expect) < 1024
    print("    %s %.0f МБ за %.0f с" % ("+" if ok else "!", got / 1048576.0, time.time() - t0))
    return ok


def main():
    argv = sys.argv[1:]
    only_list = "--list" in argv
    def opt(name, default):
        if name in argv:
            i = argv.index(name)
            if i + 1 < len(argv):
                return int(argv[i + 1])
        return default
    y_from, y_to = opt("--from", 2020), opt("--to", 2026)
    args = [a for a in argv if not a.startswith("--") and not a.isdigit()]
    outdir = os.path.abspath(args[0] if args else os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "..", "data", "foreign", "archive", "co"))
    os.makedirs(outdir, exist_ok=True)
    print("каталог:", outdir, "| годы:", y_from, "-", y_to)

    mpath = os.path.join(outdir, "manifest.json")
    man = {"retrieved": time.strftime("%Y-%m-%d"), "page": PAGE, "months": {}}
    if os.path.isfile(mpath):
        try:
            man["months"] = json.load(io.open(mpath, encoding="utf-8")).get("months", {})
        except Exception:
            pass

    print("читаю страницу реестра…")
    links = page_links()
    keys = sorted(k for k in links if y_from <= int(k[:4]) <= y_to)
    print("файлов на странице: %d | в диапазоне: %d\n" % (len(links), len(keys)))

    total = 0; got = 0
    for key in keys:
        urls = links[key]
        files = []
        for n, url in enumerate(urls):
            size = head(url) or 0
            total += size
            tag = "" if len(urls) == 1 else " [часть %d/%d]" % (n + 1, len(urls))
            print("  %s — %6.0f МБ  %s%s" % (key, size / 1048576.0,
                                             unquote(url.rsplit("/", 1)[-1]), tag))
            if only_list or not size:
                continue
            suffix = "" if len(urls) == 1 else "_p%d" % (n + 1)
            dest = os.path.join(outdir, "co_%s%s.zip" % (key, suffix))
            if download(url, dest, size):
                files.append({"file": os.path.basename(dest), "url": url, "size": size})
        if files:
            got += len(files)
            man["months"][key] = {"parts": files, "retrieved": time.strftime("%Y-%m-%d")}
            io.open(mpath, "w", encoding="utf-8").write(
                json.dumps(man, ensure_ascii=False, indent=2))
    print("\nмесяцев в диапазоне: %d | суммарный объём %.1f ГБ" % (len(keys), total / 1073741824.0))
    if only_list:
        print("(--list: только проверка наличия, ничего не скачано)")
    else:
        print("скачано за этот запуск: %d | всего в манифесте: %d" % (got, len(man["months"])))


if __name__ == "__main__":
    main()
