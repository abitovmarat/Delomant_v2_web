# -*- coding: utf-8 -*-
"""
Загрузка архивов статистики внешней торговли Казахстана и Кыргызстана
для построения годовых рядов (2020–2025) + текущий неполный период.

ЗАЧЕМ: витрина «Зарубежная таможня» показывала один период, сравнивать было не с
чем. Обе статслужбы публикуют архив, но по-разному, и «одинаковый файл за каждый
год» ни одна из них не отдаёт — отсюда два разных способа получения ниже.

КЫРГЫЗСТАН (stat.gov.kg)
  Архив бюллетеней: каждая годовая публикация — отдельный xlsx по прямой ссылке
  /media/publicationarchive/<UUID>.xlsx. UUID непредсказуем, поэтому список ссылок
  зафиксирован в KG_ARCHIVE (получен со страницы архива). При появлении нового года
  добавить строку — страница архива указана в KG_ARCHIVE_PAGE.
  Нужный лист — «таб.3-Импорт (4зн)», он есть во всех годах.

КАЗАХСТАН (stat.gov.kz)
  Разреза «товар-страна» за прошлые годы в каталоге нет: публикуется только
  последняя редакция (KZ_CURRENT — весь 2025 помесячно + текущий период).
  Ретроспектива 2019+ есть лишь в «Динамических рядах» (KZ_DYNAMIC), но там разрез
  ПО РЕГИОНАМ КАЗАХСТАНА, а не по странам-партнёрам — это ответ на другой вопрос,
  и подменять им страновой ряд нельзя. Поэтому качаем оба и держим раздельно.

ЗАПУСК (PowerShell):
  python scripts/fetch_foreign_archives.py [<каталог вывода>] [--only kg|kz]
Повторный запуск не перекачивает уже скачанное (проверка по размеру), поэтому
прерванную загрузку можно просто запустить снова.
"""
import io, os, sys, json, time, zipfile

try:
    from urllib.request import urlopen, Request
except ImportError:                      # pragma: no cover
    from urllib2 import urlopen, Request

KG_ARCHIVE_PAGE = "https://stat.gov.kg/ru/publications/vneshnyaya-i-vzaimnaya-torgovlya-tovarami-kyrgyzskoj-respubliki/"
KG_BASE = "https://stat.gov.kg/media/publicationarchive/"

# год -> (UUID файла, охват, помечать ли период неполным)
KG_ARCHIVE = {
    "2019": ("ea815973-205c-4e91-9ddd-06c200a35524", "январь–декабрь 2019", False),
    "2020": ("da7268b9-e20d-461b-a6eb-1d7d89ff7413", "январь–декабрь 2020", False),
    "2021": ("c2002ea2-be8c-4260-a475-fc1a5dcdab8e", "январь–декабрь 2021", False),
    "2022": ("2029270f-5c67-4245-a432-dde9865c2352", "январь–декабрь 2022", False),
    "2023": ("3cf0e850-e574-47bb-b9d3-5160cf5356ab", "январь–декабрь 2023", False),
    "2024": ("49df9aab-175d-4dee-874b-5ab833ee13a6", "январь–декабрь 2024", False),
    "2025": ("e960bdab-539a-47e2-8dde-b4daf811d0d4", "январь–декабрь 2025", False),
    "2026": ("20455206-39e0-41d8-ae84-31cbc2a004eb", "январь–май 2026", True),
}

KZ_CATALOG_PAGE = "https://stat.gov.kz/ru/industries/economy/foreign-market/spreadsheets/"
KZ_DYNAMIC_PAGE = "https://stat.gov.kz/ru/industries/economy/foreign-market/dynamic-tables/"
KZ_FILES = {
    # разрез «товар-страна» (нужный нам), последняя редакция: 2025 помесячно
    "kz_trade_country_2025.xlsx": (
        "https://stat.gov.kz/api/iblock/element/347505/file/ru/",
        "Экспорт и импорт РК со странами ЕАЭС по 4/6/10 знакам ТН ВЭД, разрез «товар-страна»",
        "2025 год помесячно"),
    # ретроспектива 2019+, но разрез ПО РЕГИОНАМ РК, не по странам-партнёрам
    "kz_dynamic_import_by_region.xlsx": (
        "https://stat.gov.kz/api/iblock/element/446906/file/ru/",
        "Динамические ряды: товарооборот в иностранной валюте (импорт), разрез по регионам РК",
        "2019–2026, помесячно"),
    "kz_dynamic_export_by_region.xlsx": (
        "https://stat.gov.kz/api/iblock/element/446905/file/ru/",
        "Динамические ряды: товарооборот в иностранной валюте (экспорт), разрез по регионам РК",
        "2019–2026, помесячно"),
}

UA = "Mozilla/5.0 (compatible; Delomant-analytics/1.0; +offline data prep)"


def fetch(url, dest, min_bytes=10000):
    """Качает url в dest. Уже скачанный валидный файл не трогает."""
    if os.path.isfile(dest) and os.path.getsize(dest) >= min_bytes and is_xlsx(dest):
        print("  = уже есть:", os.path.basename(dest),
              "(%.1f МБ)" % (os.path.getsize(dest) / 1048576.0))
        return True
    t0 = time.time()
    try:
        req = Request(url, headers={"User-Agent": UA})
        with urlopen(req, timeout=600) as r, io.open(dest, "wb") as f:
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                f.write(chunk)
    except Exception as e:
        print("  ! ошибка загрузки:", e)
        return False
    size = os.path.getsize(dest)
    if not is_xlsx(dest):
        # статслужбы отдают HTML-заглушку вместо файла, когда публикация переехала
        print("  ! не xlsx (%d б) — вероятно, ссылка устарела: %s" % (size, url))
        return False
    print("  + %s — %.1f МБ за %.0f с" % (os.path.basename(dest), size / 1048576.0, time.time() - t0))
    return True


def is_xlsx(path):
    try:
        with zipfile.ZipFile(path) as z:
            return "xl/workbook.xml" in z.namelist()
    except Exception:
        return False


def sheets_of(path):
    import re
    with zipfile.ZipFile(path) as z:
        wb = z.read("xl/workbook.xml").decode("utf-8", "replace")
    return re.findall(r'<sheet name="([^"]+)"', wb)


def main():
    # значение --only не должно попасть в позиционные аргументы как каталог вывода
    argv = sys.argv[1:]
    only = None
    if "--only" in argv:
        i = argv.index("--only")
        only = argv[i + 1].lower() if i + 1 < len(argv) else None
        del argv[i:i + 2]
    args = [a for a in argv if not a.startswith("--")]
    outdir = args[0] if args else os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                               "..", "data", "foreign", "archive")
    outdir = os.path.abspath(outdir)
    os.makedirs(outdir, exist_ok=True)
    print("каталог:", outdir)

    # Манифест ДОПОЛНЯЕМ, а не перезаписываем: запуск с --only kz не должен
    # стирать секцию kg (и наоборот) — иначе парсер ряда перестаёт видеть годы,
    # файлы которых лежат на диске.
    mpath = os.path.join(outdir, "manifest.json")
    manifest = {"retrieved": time.strftime("%Y-%m-%d"), "kg": {}, "kz": {}}
    if os.path.isfile(mpath):
        try:
            old = json.load(io.open(mpath, encoding="utf-8"))
            manifest["kg"] = old.get("kg", {})
            manifest["kz"] = old.get("kz", {})
        except Exception as e:
            print("  ! манифест повреждён, пересоздаю:", e)

    if only in (None, "kg"):
        print("\n=== Кыргызстан (stat.gov.kg), архив бюллетеней ===")
        kgdir = os.path.join(outdir, "kg")
        os.makedirs(kgdir, exist_ok=True)
        for year in sorted(KG_ARCHIVE):
            uuid, period, partial = KG_ARCHIVE[year]
            dest = os.path.join(kgdir, "kg_%s.xlsx" % year)
            if fetch(KG_BASE + uuid + ".xlsx", dest):
                manifest["kg"][year] = {
                    "file": os.path.relpath(dest, outdir).replace("\\", "/"),
                    "period": period, "partial": partial,
                    "sheets": sheets_of(dest),
                    "url": KG_BASE + uuid + ".xlsx",
                    "archive_page": KG_ARCHIVE_PAGE,
                }

    if only in (None, "kz"):
        print("\n=== Казахстан (stat.gov.kz) ===")
        kzdir = os.path.join(outdir, "kz")
        os.makedirs(kzdir, exist_ok=True)
        for name in KZ_FILES:
            url, title, coverage = KZ_FILES[name]
            dest = os.path.join(kzdir, name)
            if fetch(url, dest):
                manifest["kz"][name] = {
                    "file": os.path.relpath(dest, outdir).replace("\\", "/"),
                    "title": title, "coverage": coverage,
                    "sheets": sheets_of(dest), "url": url,
                    "catalog_page": KZ_DYNAMIC_PAGE if "dynamic" in name else KZ_CATALOG_PAGE,
                }

    io.open(mpath, "w", encoding="utf-8").write(
        json.dumps(manifest, ensure_ascii=False, indent=2))
    print("\nманифест:", mpath)
    print("КГ годовых файлов:", len(manifest["kg"]), "| КЗ файлов:", len(manifest["kz"]))


if __name__ == "__main__":
    main()
