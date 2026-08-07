# -*- coding: utf-8 -*-
"""
Разбор помесячного ряда Казахстана (stat.gov.kz), разрез «товар-страна» со
странами ЕАЭС, лист «6 знаков ТН ВЭД».

Отличие от parse_kazakhstan_stat.py: тот берёт кумулятив январь–май из книги
Олега (одна точка). Здесь публикация, где КАЖДЫЙ месяц — своя группа колонок,
поэтому из одного файла получается 12 точек ряда, а не одна.

РАЗМЕТКА ЛИСТА
  Строка 4 — месяцы: «январь_2025 г» в D, «февраль_2025 г» в J, шаг 6 колонок.
             Последняя группа — итог за год («2025 год»), её НЕ берём: сложение
             месяцев и годового итога в один ряд задвоило бы суммы.
  Строка 5 — поток: экспорт (первые 3 колонки группы), импорт (следующие 3).
  Строка 6 — мера: тонн / доп.ед.изм / тыс. долларов США.
  Данные с 7-й: строка с кодом в A — товар, под ней строки с пустым A и
             страной-партнёром в B. Код тянется forward-fill.

ЕДИНИЦЫ: стоимость в тыс. USD (умножаем на 1000), вес в тоннах — как в источнике.

ЗАПУСК (PowerShell):
  python scripts/parse_kazakhstan_series.py [<каталог архива>] [<каталог вывода>]
"""
import zipfile, re, io, os, sys, json
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_ARCHIVE = os.path.join(HERE, "..", "data", "foreign", "archive")
SRC_NAME = "kz_trade_country_2025.xlsx"
SHEET = "6 знаков ТН ВЭД"
CELL = re.compile(r'<c r="([A-Z]+)(\d+)"(?:[^>]*?t="(\w+)")?[^>]*?>(?:<v>([^<]*)</v>)?')
MONTHS = {"январь": "01", "февраль": "02", "март": "03", "апрель": "04",
          "май": "05", "июнь": "06", "июль": "07", "август": "08",
          "сентябрь": "09", "октябрь": "10", "ноябрь": "11", "декабрь": "12"}


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def col_idx(col):
    """A->0, B->1, ... AA->26"""
    n = 0
    for ch in col:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def idx_col(i):
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


def sheet_path(z, name):
    wb = z.read("xl/workbook.xml").decode("utf-8", "replace")
    rels = z.read("xl/_rels/workbook.xml.rels").decode("utf-8", "replace")
    sheets = re.findall(r'<sheet name="([^"]+)"[^>]*r:id="([^"]+)"', wb)
    relmap = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels))
    for nm, rid in sheets:
        if nm.strip().lower() == name.strip().lower():
            t = relmap[rid]
            return t if t.startswith("xl/") else "xl/" + t.replace("../", "")
    raise SystemExit("лист не найден: " + name)


def rows_of(z, path, ss):
    data = z.read(path).decode("utf-8", "replace")
    cur = {}; curr = None
    for m in CELL.finditer(data):
        col, rn, typ, val = m.group(1), int(m.group(2)), m.group(3), m.group(4)
        if rn != curr:
            if curr is not None:
                yield curr, cur
            cur = {}; curr = rn
        cur[col] = "" if val is None else (ss[int(val)] if typ == "s" and val.isdigit() else val)
    if curr is not None:
        yield curr, cur


def main():
    archive = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_ARCHIVE)
    outdir = sys.argv[2] if len(sys.argv) > 2 else archive
    src = os.path.join(archive, "kz", SRC_NAME)
    if not os.path.isfile(src):
        raise SystemExit("нет файла %s — сначала fetch_foreign_archives.py --only kz" % src)

    z = zipfile.ZipFile(src)
    ss = load_ss(z)
    rows = list(rows_of(z, sheet_path(z, SHEET), ss))

    # 1) шапка: находим строку с месяцами и раскладываем группы колонок
    hdr_rn = None
    for rn, c in rows:
        if any(re.match(r"^(январ|феврал|март|апрел|май|июн|июл|август|сентябр|октябр|ноябр|декабр)",
                        str(v).strip().lower()) for v in c.values()):
            hdr_rn = rn
            break
    if hdr_rn is None:
        raise SystemExit("не найдена строка месяцев")
    hdr = dict(rows[[r[0] for r in rows].index(hdr_rn)][1])

    groups = []          # (период, колонка экспорт-USD, колонка импорт-USD, эксп тонн, имп тонн)
    for col, val in hdr.items():
        s = str(val).strip().lower()
        m = re.match(r"^([а-я]+)[_\s]*(\d{4})", s)
        if not m or m.group(1) not in MONTHS:
            continue      # «2025 год» — годовой итог, в ряд не берём (иначе задвоение)
        base = col_idx(col)
        period = "%s-%s" % (m.group(2), MONTHS[m.group(1)])
        groups.append((period,
                       idx_col(base + 2),   # экспорт, тыс. USD
                       idx_col(base + 5),   # импорт,  тыс. USD
                       idx_col(base + 0),   # экспорт, тонн
                       idx_col(base + 3)))  # импорт,  тонн
    groups.sort(key=lambda g: g[0])
    print("месяцев в файле:", len(groups), "->", groups[0][0], "…", groups[-1][0])

    # 2) данные
    out_jsonl = os.path.join(outdir, "kz_trade_series.jsonl")
    jf = io.open(out_jsonl, "w", encoding="utf-8")
    cur_code = None; cur_name = ""
    n = 0; partners = Counter(); by_period = {}
    for rn, c in rows:
        if rn <= hdr_rn + 2:
            continue
        A = str(c.get("A", "")).strip()
        B = str(c.get("B", "")).strip()
        if A:
            if A.lower().startswith("всего"):
                cur_code = None           # общий итог — страны под ним не берём
            else:
                cur_code = A; cur_name = B
            continue
        if not cur_code or not B:
            continue
        for period, ce, ci, cte, cti in groups:
            eu = num(c.get(ce, "")) * 1000
            iu = num(c.get(ci, "")) * 1000
            et = num(c.get(cte, ""))
            it = num(c.get(cti, ""))
            if not (eu or iu or et or it):
                continue                   # месяца без движения не пишем
            jf.write(json.dumps({
                "src": "KZ", "hs6": cur_code, "hs_level": len(cur_code),
                "product": cur_name, "partner": B, "period": period,
                "year": period[:4],
                "export_t": round(et, 3), "export_usd": round(eu),
                "import_t": round(it, 3), "import_usd": round(iu),
            }, ensure_ascii=False) + "\n")
            n += 1
            d = by_period.setdefault(period, {"rec": 0, "exp": 0.0, "imp": 0.0})
            d["rec"] += 1; d["exp"] += eu; d["imp"] += iu
        partners[B] += 1
    jf.close()

    index = [{"period": p, "records": by_period[p]["rec"],
              "export_usd": round(by_period[p]["exp"]), "import_usd": round(by_period[p]["imp"])}
             for p in sorted(by_period)]
    io.open(os.path.join(outdir, "kz_series_index.json"), "w", encoding="utf-8").write(
        json.dumps({"periods": index, "records": n}, ensure_ascii=False, indent=2))

    print("=== Казахстан, помесячный ряд — готово ===")
    for r in index:
        print("  %s: %6d записей | экспорт %12.0f | импорт %12.0f USD"
              % (r["period"], r["records"], r["export_usd"], r["import_usd"]))
    print("всего записей:", n, "| партнёров:", len(partners), "|", partners.most_common(5))
    print("вывод:", out_jsonl)


if __name__ == "__main__":
    main()
