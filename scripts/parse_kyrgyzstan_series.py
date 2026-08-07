# -*- coding: utf-8 -*-
"""
Разбор годового ряда импорта Кыргызстана (stat.gov.kg) из архива бюллетеней.

Отличие от parse_kyrgyzstan_stat.py: тот берёт один файл текущего периода, этот
проходит по всем годам, скачанным fetch_foreign_archives.py, и склеивает годовой
ряд для динамики. Разбор одного листа вынесен в parse_sheet() — обе задачи
используют одну логику, расходятся только источником и выводом.

ВАЖНО ПРО ШАПКУ: между годами она плавает дважды. Во-первых, сдвинута по строкам
(2019–2022 — 4-я строка, 2023–2026 — 5-я: добавилась «Вернуться к содержанию»).
Во-вторых, скачет написание: «Код ТН ВЭД» в 2019–2022, «Код ТНВЭД» без пробела
в 2023. Поэтому parse_sheet() не зашивает номер строки и ищет шапку по тексту,
сняв все пробелы, — иначе разбор года молча возвращает ноль записей.

Колонки внутри шапки стабильны во всех годах:
  A=код HS4, B=товар/страна-партнёр, C=единица,
  D=количество (отчётный год), F=стоимость тыс. USD (отчётный год),
  G/I — то же за предыдущий год (не берём: он и так есть отдельным файлом,
  а брать одну цифру из двух источников — путь к расхождениям).

ЗАПУСК (PowerShell):
  python scripts/parse_kyrgyzstan_series.py [<каталог архива>] [<каталог вывода>]
"""
import zipfile, re, io, os, sys, json
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_ARCHIVE = os.path.join(HERE, "..", "data", "foreign", "archive")
SHEET_CANDIDATES = ["таб.3-Импорт (4зн) ", "таб.3-Импорт (4зн)", "таб.3-Импорт(4зн)"]
CELL = re.compile(r'<c r="([A-Z]+)(\d+)"(?:[^>]*?t="(\w+)")?[^>]*?>(?:<v>([^<]*)</v>)?')


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def load_ss(z):
    raw = z.read("xl/sharedStrings.xml").decode("utf-8", "replace")
    return ["".join(re.findall(r"<t[^>]*>(.*?)</t>", si, re.S))
            for si in re.findall(r"<si>(.*?)</si>", raw, re.S)]


def sheet_path(z, names):
    wb = z.read("xl/workbook.xml").decode("utf-8", "replace")
    rels = z.read("xl/_rels/workbook.xml.rels").decode("utf-8", "replace")
    sheets = re.findall(r'<sheet name="([^"]+)"[^>]*r:id="([^"]+)"', wb)
    relmap = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels))
    want = [n.strip().lower() for n in names]
    for nm, rid in sheets:
        if nm.strip().lower() in want:
            t = relmap[rid]
            return t if t.startswith("xl/") else "xl/" + t.replace("../", "")
    return None


def iter_rows(z, path, ss):
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


def parse_sheet(path_xlsx, period, partial):
    """Возвращает (записи, диагностика) по одному файлу-бюллетеню."""
    z = zipfile.ZipFile(path_xlsx)
    ss = load_ss(z)
    sp = sheet_path(z, SHEET_CANDIDATES)
    if not sp:
        return [], {"error": "лист импорта не найден"}

    rows = list(iter_rows(z, sp, ss))
    # Шапку ищем по тексту: номер строки у разных лет разный. Пробелы вычищаем —
    # написание скачет между годами («Код ТН ВЭД» в 2020-22, «Код ТНВЭД» в 2023).
    hdr_rn = None
    for rn, c in rows:
        if "кодтнвэд" in re.sub(r"\s+", "", str(c.get("A", ""))).lower():
            hdr_rn = rn
            break
    if hdr_rn is None:
        return [], {"error": "не найдена строка шапки «Код ТН ВЭД»"}
    # данные начинаются после шапки (3 яруса) и строки «ВСЕГО»
    start = hdr_rn + 3

    out = []
    cur_code = None; cur_name = ""; cur_unit = ""
    partners = Counter()
    for rn, c in rows:
        if rn < start:
            continue
        A = str(c.get("A", "")).strip()
        B = str(c.get("B", "")).strip()
        if A:
            cur_code = A; cur_name = B; cur_unit = str(c.get("C", "")).strip()
            continue
        if not cur_code or not B or B.upper() == "ВСЕГО":
            continue
        out.append({
            "src": "KG", "flow": "import", "hs4": cur_code, "hs_level": len(cur_code),
            "product": cur_name, "partner": B,
            "period": period, "partial": partial,
            "qty": num(c.get("D", "")), "unit": cur_unit,
            "import_usd": num(c.get("F", "")) * 1000,
        })
        partners[B] += 1
    # Контроль полноты: сравниваем нашу сумму со строкой «ВСЕГО» бюллетеня.
    # Совпадения быть НЕ должно — итог страны шире, чем сумма кодов HS4
    # (часть импорта в разбивку «товар-страна» не попадает: 0,1% в 2019–2022,
    # ~1,6–1,9% с 2023). Это свойство публикации, а не потеря при разборе:
    # проверено — сумма по товарным строкам совпадает с суммой по строкам
    # партнёров до единиц. Держим цифру в диагностике, чтобы скачок недобора
    # был виден сразу и не выдавался за наш баг.
    official = None
    for rn, c in rows:
        if rn > hdr_rn and str(c.get("B", "")).strip().upper() == "ВСЕГО":
            official = num(c.get("F", "")) * 1000
            break
    ours = sum(r["import_usd"] for r in out)
    return out, {"header_row": hdr_rn, "partners": len(partners),
                 "top": partners.most_common(3),
                 "official_total": official, "parsed_total": ours,
                 "coverage_pct": (100.0 * ours / official) if official else None}


def main():
    archive = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_ARCHIVE
    outdir = sys.argv[2] if len(sys.argv) > 2 else archive
    archive = os.path.abspath(archive)
    mpath = os.path.join(archive, "manifest.json")
    if not os.path.isfile(mpath):
        raise SystemExit("нет manifest.json — сначала запустите fetch_foreign_archives.py")
    man = json.load(io.open(mpath, encoding="utf-8"))

    out_jsonl = os.path.join(outdir, "kg_import_series.jsonl")
    jf = io.open(out_jsonl, "w", encoding="utf-8")
    total = 0
    years = []
    for year in sorted(man.get("kg", {})):
        info = man["kg"][year]
        p = os.path.join(archive, info["file"])
        if not os.path.isfile(p):
            print("  пропуск (нет файла):", year); continue
        recs, diag = parse_sheet(p, info["period"], info.get("partial", False))
        if diag.get("error"):
            print("  %s: ОШИБКА — %s" % (year, diag["error"])); continue
        usd = sum(r["import_usd"] for r in recs)
        for r in recs:
            r["year"] = year
            jf.write(json.dumps(r, ensure_ascii=False) + "\n")
        total += len(recs)
        years.append({"year": year, "period": info["period"], "partial": info.get("partial", False),
                      "records": len(recs), "import_usd": round(usd),
                      "official_total": round(diag["official_total"]) if diag["official_total"] else None,
                      "coverage_pct": round(diag["coverage_pct"], 2) if diag["coverage_pct"] else None})
        print("  %s: %6d записей | импорт %13.0f USD | охват итога %5.1f%% | партнёров %d%s"
              % (year, len(recs), usd, diag["coverage_pct"] or 0, diag["partners"],
                 "  (неполный период)" if info.get("partial") else ""))
    jf.close()

    io.open(os.path.join(outdir, "kg_series_index.json"), "w", encoding="utf-8").write(
        json.dumps({"years": years, "records": total}, ensure_ascii=False, indent=2))
    print("=== Кыргызстан, годовой ряд — готово ===")
    print("лет:", len(years), "| всего записей:", total)
    print("вывод:", out_jsonl)


if __name__ == "__main__":
    main()
