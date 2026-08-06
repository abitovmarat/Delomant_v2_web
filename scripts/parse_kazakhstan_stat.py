# -*- coding: utf-8 -*-
"""
Офлайн-препроцессор статистики взаимной торговли Казахстана со странами ЕАЭС
(Бюро нацстатистики РК, stat.gov.kz). Это НЕ транзакции, а публикация-«простыня»
в разрезе «товар-страна» с многоярусной шапкой и пивотом по месяцам.

СХЕМА ЛИСТА «6 знаков ТН ВЭД» (даёт HS6 для сшивки с Comtrade/FAOSTAT):
  - Шапка: R4 группы месяцев, R5 поток (экспорт/импорт), R6 мера (тонн/доп.ед/тыс USD).
  - Данные с R7. Строка с кодом в A = товар (итог по нему), под ней строки с пустым A и
    страной-партнёром в B = разбивка. Первый блок A="Всего:" — общий итог, пропускаем.
  - Кумулятив «январь-май»: экспорт тонн=AH, экспорт тыс.USD=AJ, импорт тонн=AK, импорт тыс.USD=AM.

ВЫХОД: длинный формат (hs6, товар, страна-партнёр, период, экспорт/импорт тонн и USD).
По кодам, без компаний. USD = «тыс. долларов» × 1000.

ЗАПУСК (PowerShell): python scripts/parse_kazakhstan_stat.py "<путь .xlsx>" [<каталог вывода>]
"""
import zipfile, re, io, os, sys, json
from collections import Counter

DEFAULT_IN = r"C:/Users/inska/OneDrive/Документы/Projects/site/Delomant_v2_web/обучение/олег/Экспорт_и_импорт_РК_со_странами_ЕАЭС_по_4,_6,_10_знакам_ТН_ВЭД_в.xlsx"
SHEET = "6 знаков ТН ВЭД"
PERIOD = "2026-01_05"
# Колонки кумулятива «январь-май» (из разбора шапки)
C_EXP_T, C_EXP_USD, C_IMP_T, C_IMP_USD = "AH", "AJ", "AK", "AM"
CELL = re.compile(r'<c r="([A-Z]+)(\d+)"(?:[^>]*?t="(\w+)")?[^>]*?>(?:<v>([^<]*)</v>)?')


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def sheet_path(z, name):
    wb = z.read("xl/workbook.xml").decode("utf-8", "replace")
    rels = z.read("xl/_rels/workbook.xml.rels").decode("utf-8", "replace")
    sheets = re.findall(r'<sheet name="([^"]+)"[^>]*r:id="([^"]+)"', wb)
    relmap = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels))
    for nm, rid in sheets:
        if nm == name:
            t = relmap[rid]
            return t if t.startswith("xl/") else "xl/" + t.replace("../", "")
    raise SystemExit("Лист не найден: " + name)


def load_ss(z):
    raw = z.read("xl/sharedStrings.xml").decode("utf-8", "replace")
    return ["".join(re.findall(r"<t[^>]*>(.*?)</t>", si, re.S)) for si in re.findall(r"<si>(.*?)</si>", raw, re.S)]


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


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_IN
    outdir = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(src)
    out_jsonl = os.path.join(outdir, "kz_trade_normalized.jsonl")

    z = zipfile.ZipFile(src)
    ss = load_ss(z)
    path = sheet_path(z, SHEET)

    jf = io.open(out_jsonl, "w", encoding="utf-8")
    cur_code = None; cur_name = ""
    n = 0; partners = Counter(); code_len = Counter()
    for rn, c in iter_rows(z, path, ss):
        if rn < 7:
            continue
        A = str(c.get("A", "")).strip()
        B = str(c.get("B", "")).strip()
        if A:
            if A == "Всего:":
                cur_code = None            # общий итог — пропускаем его страны
            else:
                cur_code = A; cur_name = B  # строка товара (итог) — не эмитим
            continue
        if not cur_code or not B:
            continue
        rec = {
            "src": "KZ", "hs6": cur_code, "hs_level": len(cur_code),
            "product": cur_name, "partner": B, "period": PERIOD,
            "export_t": num(c.get(C_EXP_T, "")), "export_usd": num(c.get(C_EXP_USD, "")) * 1000,
            "import_t": num(c.get(C_IMP_T, "")), "import_usd": num(c.get(C_IMP_USD, "")) * 1000,
        }
        jf.write(json.dumps(rec, ensure_ascii=False) + "\n")
        n += 1; partners[B] += 1; code_len[len(cur_code)] += 1
    jf.close()
    print("=== Казахстан (stat.gov.kz) — готово ===")
    print("записей (товар×страна):", n)
    print("длины кодов:", code_len.most_common())
    print("партнёры:", partners.most_common())
    print("вывод:", out_jsonl)


if __name__ == "__main__":
    main()
