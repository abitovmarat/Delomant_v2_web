# -*- coding: utf-8 -*-
"""
Офлайн-препроцессор данных таможни Колумбии (DIAN, реестр деклараций импорта).

ПОЧЕМУ PYTHON И «ОФЛАЙН»: исходный xlsx огромный (один лист ~1.5 ГБ в распаковке),
поэтому разбор потоковый и выполняется на машине разработчика, а не на хостинге.
На сайт (cloud4box) кладётся только компактный результат (JSON), как и для остальных
источников. Остальные лёгкие сборщики проекта — на Node (scripts/fetch_*.js).

ЧТО ДЕЛАЕТ:
  1. Потоково читает xl/worksheets/sheet1.xml (без загрузки всего файла в память).
  2. Склеивает описание товара, разбитое DIAN по 250 символов: одна товарная позиция
     занимает несколько строк, различающихся только LINEA_DESCRIPCION (1,2,3…) и куском
     DESCRIPCION_MERCANCIA. Новая позиция начинается при LINEA_DESCRIPCION == "1".
     (Проверено на файле июнь-2026: 1 декларация = 1 HS10, случаев пере-склейки 0.)
  3. Оставляет только импортёров-ЮРЛИЦ: NIT начинается с 8 или 9 (колумбийские
     юрлица). Импортёры-физлица (~1%) отсекаются — снимает риск персональных данных.
  4. HS10 -> HS6 для сшивки с Comtrade/FAOSTAT (data/commodity_faostat_map.json).
  5. Пишет нормализованный JSONL (по позициям) и компактный агрегат (импортёр×HS6).

ЗАПУСК (из PowerShell, путь с кириллицей передаётся корректно):
  python scripts/parse_colombia_dian.py "<путь к .xlsx>" [<каталог вывода>]

ОГРАНИЧЕНИЯ / TODO:
  - В исходнике часть испанских диакритик побита (í/ó/é -> "¿") — потеря на стороне DIAN,
    восстановить нельзя; чистим лишь очевидное.
  - Перевод описаний исп.->рус. и словарь кодов стран/транспорта — отдельный шаг.
  - Данные DIAN — «неофициальные, без статистической валидации» (требование DIAN):
    помечать так в отчётах.
"""
import zipfile, re, io, os, sys, json, time
from collections import Counter, defaultdict
from datetime import date, timedelta

DEFAULT_IN = r"C:/Users/inska/OneDrive/Документы/Projects/site/Delomant_v2_web/обучение/олег/Колумбия_импорт_июнь_2026.xlsx"

# Буквы колонок листа (из разбора заголовков DIAN, форма 500)
COL = dict(decl="A", nit="B", razon="C", ship_city="AD", pais_exp="AE",
           pais_proc="AJ", pais_orig="AV", pais_compra="AZ", hs10="AO",
           linea="BT", desc="BU", unidad="BF", qty="BG", net="BB", gross="BA",
           fob="BH", flete="BI", seg="BJ", cif="BM", modo="AK",
           factura="AH", fecha_fact="AI", fecha_acept="DB")

CELL = re.compile(r'<c r="([A-Z]+)\d+"(?:[^>]*?t="(\w+)")?[^>]*?>(?:<v>([^<]*)</v>)?')
_EPOCH = date(1899, 12, 30)  # база Excel-serial


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def serial_to_iso(v):
    try:
        n = int(float(v))
        return (_EPOCH + timedelta(days=n)).isoformat()
    except (TypeError, ValueError):
        return ""


def load_shared_strings(z):
    with z.open("xl/sharedStrings.xml") as f:
        raw = f.read().decode("utf-8", "replace")
    out = []
    for si in re.findall(r"<si>(.*?)</si>", raw, re.S):
        s = "".join(re.findall(r"<t[^>]*>(.*?)</t>", si, re.S))
        s = (s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
               .replace("&quot;", '"').replace("&apos;", "'"))
        out.append(s)
    return out


def cells_of(rowxml, ss):
    d = {}
    for m in CELL.finditer(rowxml):
        col, typ, val = m.group(1), m.group(2), m.group(3)
        if val is None:
            d[col] = ""
        elif typ == "s":
            i = int(val)
            d[col] = ss[i] if 0 <= i < len(ss) else ""
        else:
            d[col] = val
    return d


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_IN
    outdir = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(src)
    out_jsonl = os.path.join(outdir, "co_import_normalized.jsonl")
    out_agg = os.path.join(outdir, "co_import_aggregate.json")

    t0 = time.time()
    z = zipfile.ZipFile(src)
    ss = load_shared_strings(z)
    print("shared strings:", len(ss), "t=%.0fs" % (time.time() - t0), flush=True)

    jf = io.open(out_jsonl, "w", encoding="utf-8")
    stats = dict(rows=0, items=0, kept=0, persons=0, net=0.0, cif=0.0, fob=0.0)
    cif_hs6, cif_imp = Counter(), Counter()
    agg = defaultdict(lambda: {"items": 0, "net_kg": 0.0, "cif_usd": 0.0,
                               "fob_usd": 0.0, "name": "", "hs6": ""})
    cur = {"cur": None}

    def flush(item):
        if not item:
            return
        stats["items"] += 1
        nit = str(item["nit"])
        if nit[:1] not in ("8", "9"):   # только юрлица
            stats["persons"] += 1
            return
        stats["kept"] += 1
        hs10 = str(item["hs10"]); hs6 = hs10[:6]
        rec = {
            "src": "CO", "decl": item["decl"], "date": serial_to_iso(item["fecha_acept"]),
            "importer_nit": nit, "importer": item["razon"].strip(),
            "hs10": hs10, "hs6": hs6, "goods": item["desc"].strip(),
            "origin": item["pais_orig"], "dispatch": item["pais_proc"],
            "exporter_country": item["pais_exp"], "ship_city": item["ship_city"].strip(),
            "qty": num(item["qty"]), "unit": item["unidad"].strip(),
            "net_kg": num(item["net"]), "gross_kg": num(item["gross"]),
            "fob_usd": num(item["fob"]), "freight_usd": num(item["flete"]),
            "insurance_usd": num(item["seg"]), "cif_usd": num(item["cif"]),
            "transport_mode": item["modo"], "invoice": item["factura"].strip(),
            "invoice_date": item["fecha_fact"],
        }
        jf.write(json.dumps(rec, ensure_ascii=False) + "\n")
        stats["net"] += rec["net_kg"]; stats["cif"] += rec["cif_usd"]; stats["fob"] += rec["fob_usd"]
        cif_hs6[hs6] += rec["cif_usd"]; cif_imp[nit] += rec["cif_usd"]
        a = agg[(nit, hs6)]
        a["items"] += 1; a["net_kg"] += rec["net_kg"]; a["cif_usd"] += rec["cif_usd"]
        a["fob_usd"] += rec["fob_usd"]; a["name"] = rec["importer"]; a["hs6"] = hs6

    hdr_done = False
    buf = ""
    with z.open("xl/worksheets/sheet1.xml") as f:
        while True:
            chunk = f.read(1 << 20)
            if not chunk:
                break
            buf += chunk.decode("utf-8", "replace")
            while True:
                e = buf.find("</row>")
                if e < 0:
                    break
                s = buf.rfind("<row", 0, e)
                rowxml = buf[s:e + 6]; buf = buf[e + 6:]
                stats["rows"] += 1
                if not hdr_done:
                    hdr_done = True
                    continue
                c = cells_of(rowxml, ss)
                gv = lambda k: c.get(COL[k], "")
                linea = gv("linea")
                if linea == "1" or cur["cur"] is None or gv("decl") != cur["cur"]["decl"]:
                    flush(cur["cur"])
                    cur["cur"] = {k: gv(k) for k in COL}
                else:
                    cur["cur"]["desc"] = cur["cur"].get("desc", "") + gv("desc")
        flush(cur["cur"])
    jf.close()

    agg_list = [{"importer_nit": k[0], "importer": v["name"], "hs6": v["hs6"],
                 "items": v["items"], "net_kg": round(v["net_kg"], 1),
                 "cif_usd": round(v["cif_usd"], 1), "fob_usd": round(v["fob_usd"], 1)}
                for k, v in agg.items()]
    agg_list.sort(key=lambda r: r["cif_usd"], reverse=True)
    io.open(out_agg, "w", encoding="utf-8").write(json.dumps(agg_list, ensure_ascii=False))

    print("=== Колумбия (DIAN) — готово, t=%.0fs ===" % (time.time() - t0))
    print("строк:", stats["rows"], "| позиций:", stats["items"],
          "| юрлиц оставлено:", stats["kept"], "| физлиц отброшено:", stats["persons"])
    print("нетто, т:", round(stats["net"] / 1000, 1),
          "| CIF, USD:", round(stats["cif"]), "| FOB, USD:", round(stats["fob"]))
    print("импортёров:", len(cif_imp), "| пар импортёр×HS6:", len(agg_list))
    print("вывод:", out_jsonl, "|", out_agg)


if __name__ == "__main__":
    main()
