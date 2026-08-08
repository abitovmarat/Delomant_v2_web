# -*- coding: utf-8 -*-
"""
Длинный ряд Казахстана 2019–2026 по кодам ТН ВЭД из «Динамических рядов»
(stat.gov.kz): товарооборот в иностранной валюте, импорт и экспорт.

ЗАЧЕМ. Публикация «товар-страна» отдаёт только последнюю редакцию (2025), и
ретроспективы 2019–2024 в нужном разрезе не существует. Динамические ряды её
дают, но в разрезе ПО ОБЛАСТЯМ КАЗАХСТАНА, без страны-партнёра. Здесь области
СВОРАЧИВАЮТСЯ в итог по стране: получается длинный ряд по товарам, который
закрывает пробел 2019–2024. Ответ «откуда ввезли» этот файл не даёт в принципе —
за ним по-прежнему только kz_series (2025 помесячно).

РАЗМЕТКА (одинакова на всех листах-годах):
  Строка 2 — месяцы: «январь 2020 года» в D, далее шаг 3 колонки.
  Строка 3 — мера: тонн / доп.ед.изм / тыс.долларов США.
  Данные с 4-й: строка, где A — НАЗВАНИЕ ОБЛАСТИ, открывает секцию региона;
  под ней строки, где A — код ТН ВЭД (10 знаков). Итоги области не берём —
  суммируем сами по кодам, иначе задвоение.

HS10 -> HS6: текущий ряд kz_series живёт на HS6, и ряды должны сшиваться по коду.

Файлы большие (99 и 55 МБ), лист читается ПОТОКОВО по строкам — целиком в
память он не помещается.

ЗАПУСК (PowerShell):
  python scripts/parse_kazakhstan_dynamic.py [<каталог архива>] [<каталог вывода>]
"""
import zipfile, re, io, os, sys, json
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_ARCHIVE = os.path.join(HERE, "..", "data", "foreign", "archive")
FILES = [("kz_dynamic_import_by_region.xlsx", "import"),
         ("kz_dynamic_export_by_region.xlsx", "export")]
MONTHS = {"январь": "01", "февраль": "02", "март": "03", "апрель": "04",
          "май": "05", "июнь": "06", "июль": "07", "август": "08",
          "сентябрь": "09", "октябрь": "10", "ноябрь": "11", "декабрь": "12"}
ROW = re.compile(r"<row[^>]*r=\"(\d+)\"[^>]*>(.*?)</row>", re.S)
CELL = re.compile(r'<c r="([A-Z]+)\d+"(?:[^>]*?t="(\w+)")?[^>]*?>(?:<v>([^<]*)</v>)?')


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def ci(col):
    n = 0
    for ch in col:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def ic(i):
    s = ""
    i += 1
    while i:
        i, r = divmod(i - 1, 26)
        s = chr(65 + r) + s
    return s


def load_ss(z):
    raw = z.read("xl/sharedStrings.xml").decode("utf-8", "replace")
    return ["".join(re.findall(r"<t[^>]*>(.*?)</t>", si, re.S))
            for si in re.findall(r"<si>(.*?)</si>", raw, re.S)]


def sheets(z):
    wb = z.read("xl/workbook.xml").decode("utf-8", "replace")
    rels = z.read("xl/_rels/workbook.xml.rels").decode("utf-8", "replace")
    relmap = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels))
    out = []
    for nm, rid in re.findall(r'<sheet name="([^"]+)"[^>]*r:id="([^"]+)"', wb):
        t = relmap[rid]
        out.append((nm, t if t.startswith("xl/") else "xl/" + t.replace("../", "")))
    return out


def stream_rows(z, path, ss):
    """Потоково отдаёт (номер строки, {колонка: значение}) — файл не влезает в память."""
    buf = ""
    with z.open(path) as f:
        while True:
            chunk = f.read(1 << 22)
            if not chunk:
                break
            buf += chunk.decode("utf-8", "replace")
            while True:
                e = buf.find("</row>")
                if e < 0:
                    break
                s = buf.rfind("<row", 0, e)
                piece = buf[s:e + 6]; buf = buf[e + 6:]
                m = re.match(r'<row[^>]*r="(\d+)"', piece)
                if not m:
                    continue
                cells = {}
                for cm in CELL.finditer(piece):
                    col, ty, v = cm.group(1), cm.group(2), cm.group(3)
                    cells[col] = ss[int(v)] if ty == "s" and v and v.isdigit() else (v or "")
                yield int(m.group(1)), cells


def parse_sheet(z, path, ss, flow, acc, names):
    """Складывает в acc[(period, hs6)] суммы по всем областям."""
    hdr = None
    groups = []
    for rn, c in stream_rows(z, path, ss):
        if hdr is None:
            # ищем строку месяцев
            found = False
            for col, v in c.items():
                m = re.match(r"^([а-я]+)\s+(\d{4})", str(v).strip().lower())
                if m and m.group(1) in MONTHS:
                    found = True
                    break
            if not found:
                continue
            hdr = rn
            for col, v in c.items():
                m = re.match(r"^([а-я]+)\s+(\d{4})", str(v).strip().lower())
                if not m or m.group(1) not in MONTHS:
                    continue
                b = ci(col)
                groups.append(("%s-%s" % (m.group(2), MONTHS[m.group(1)]),
                               ic(b + 2), ic(b + 0)))   # USD, тонн
            groups.sort(key=lambda g: g[0])
            continue
        if rn <= hdr + 1:
            continue
        A = str(c.get("A", "")).strip()
        if not A:
            continue
        if not re.fullmatch(r"\d{6,10}", A):
            continue                     # название области — секция, суммы не берём
        hs6 = A[:6]
        nm = str(c.get("B", "")).strip()
        if nm:
            names.setdefault(hs6, nm)
        for period, cu, ct in groups:
            u = num(c.get(cu, "")) * 1000
            t = num(c.get(ct, ""))
            if not (u or t):
                continue
            d = acc[(period, hs6)]
            d[flow + "_usd"] += u
            d[flow + "_t"] += t


def main():
    archive = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_ARCHIVE)
    outdir = sys.argv[2] if len(sys.argv) > 2 else archive
    acc = defaultdict(lambda: {"import_usd": 0.0, "import_t": 0.0,
                               "export_usd": 0.0, "export_t": 0.0})
    names = {}

    for fname, flow in FILES:
        p = os.path.join(archive, "kz", fname)
        if not os.path.isfile(p):
            print("пропуск (нет файла):", fname); continue
        z = zipfile.ZipFile(p)
        ss = load_ss(z)
        print("=== %s (%s) ===" % (fname, flow))
        for nm, path in sheets(z):
            if not re.search(r"20\d\d", nm):
                continue                 # Метаданные / Показатель / Условные обозначения
            before = len(acc)
            parse_sheet(z, path, ss, flow, acc, names)
            print("  лист %-22s -> ключей всего %d (+%d)" % (nm, len(acc), len(acc) - before))

    out = os.path.join(outdir, "kz_dynamic_series.jsonl")
    jf = io.open(out, "w", encoding="utf-8")
    periods = sorted({k[0] for k in acc})
    for (period, hs6) in sorted(acc):
        d = acc[(period, hs6)]
        jf.write(json.dumps({
            "src": "KZ", "scope": "total", "hs6": hs6, "hs_level": 6,
            "product": names.get(hs6, ""), "period": period, "year": period[:4],
            "import_usd": round(d["import_usd"]), "import_t": round(d["import_t"], 1),
            "export_usd": round(d["export_usd"]), "export_t": round(d["export_t"], 1),
        }, ensure_ascii=False) + "\n")
    jf.close()

    by_year = defaultdict(lambda: {"i": 0.0, "e": 0.0})
    for (period, hs6), d in acc.items():
        by_year[period[:4]]["i"] += d["import_usd"]
        by_year[period[:4]]["e"] += d["export_usd"]
    io.open(os.path.join(outdir, "kz_dynamic_index.json"), "w", encoding="utf-8").write(
        json.dumps({"periods": periods, "records": len(acc),
                    "by_year": {y: {"import_usd": round(v["i"]), "export_usd": round(v["e"])}
                                for y, v in sorted(by_year.items())}},
                   ensure_ascii=False, indent=2))
    print("=== готово ===")
    print("периодов:", len(periods), "| записей:", len(acc), "| кодов HS6:", len(names))
    for y in sorted(by_year):
        print("  %s: импорт %14.0f | экспорт %14.0f USD"
              % (y, by_year[y]["i"], by_year[y]["e"]))
    print("вывод:", out)


if __name__ == "__main__":
    main()
