# -*- coding: utf-8 -*-
"""
Офлайн-препроцессор статистики внешней торговли Кыргызстана (Нацстатком КР,
stat.gov.kg). Публикация-«простыня», русский язык (перевод не нужен).

Лист «таб.3-Импорт (4зн)» — импорт в разрезе «товар-страна» на 4 знаках ТН ВЭД,
охват — все страны-партнёры (не только ЕАЭС). Иерархия как у Казахстана:
  - Данные с R9 (R8 = строка «ВСЕГО», пропускаем).
  - Строка с кодом в A = товар (итог), C=единица измерения; под ней строки с пустым A
    и страной в B = разбивка.
  - Колонки «Отчётный период» (январь-май 2026): D=количество (в единице товара),
    E=тыс. сомов (пропуск), F=тыс. долларов.

ВЫХОД: длинный формат импорта (hs4, товар, страна, единица, количество, стоимость USD).
По кодам, без компаний. USD = «тыс. долларов» × 1000. Экспорт — в листах таб.2/таб.4
(добавить при необходимости). Количество — в собственной единице товара (штук/тонн/…),
между товарами не суммируется; сопоставимая величина — стоимость.

ЗАПУСК (PowerShell): python scripts/parse_kyrgyzstan_stat.py "<путь .xlsx>" [<каталог вывода>]
"""
import zipfile, re, io, os, sys, json
from collections import Counter

DEFAULT_IN = r"C:/Users/inska/OneDrive/Документы/Projects/site/Delomant_v2_web/обучение/олег/Кыргызстан_ВЭД_2026.xlsx"
SHEET = "таб.3-Импорт (4зн) "   # пробел в конце — так в книге
PERIOD = "2026-01_05"
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
    raise SystemExit("Лист не найден: " + repr(name) + " (есть: " + ", ".join(n for n, _ in sheets) + ")")


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
    out_jsonl = os.path.join(outdir, "kg_import_normalized.jsonl")

    z = zipfile.ZipFile(src)
    ss = load_ss(z)
    path = sheet_path(z, SHEET)

    jf = io.open(out_jsonl, "w", encoding="utf-8")
    cur_code = None; cur_name = ""; cur_unit = ""
    n = 0; partners = Counter(); code_len = Counter()
    for rn, c in iter_rows(z, path, ss):
        if rn < 9:
            continue
        A = str(c.get("A", "")).strip()
        B = str(c.get("B", "")).strip()
        if A:                                   # строка товара
            cur_code = A; cur_name = B; cur_unit = str(c.get("C", "")).strip()
            continue
        if not cur_code or not B or B == "ВСЕГО":
            continue
        rec = {
            "src": "KG", "flow": "import", "hs4": cur_code, "hs_level": len(cur_code),
            "product": cur_name, "partner": B, "period": PERIOD,
            "qty": num(c.get("D", "")), "unit": cur_unit,
            "import_usd": num(c.get("F", "")) * 1000,
        }
        jf.write(json.dumps(rec, ensure_ascii=False) + "\n")
        n += 1; partners[B] += 1; code_len[len(cur_code)] += 1
    jf.close()
    print("=== Кыргызстан (stat.gov.kg) — готово ===")
    print("записей импорта (товар×страна):", n)
    print("длины кодов:", code_len.most_common())
    print("партнёров:", len(partners), "| топ:", partners.most_common(8))
    print("вывод:", out_jsonl)


if __name__ == "__main__":
    main()
