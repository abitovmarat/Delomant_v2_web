# -*- coding: utf-8 -*-
"""
Офлайн-препроцессор данных таможни Перу (SUNAT, импорт, уровень DUA/позиция).

Файл небольшой и ПЛОСКИЙ (одна строка = одна товарная позиция, склейка НЕ нужна) —
в отличие от Колумбии. Приводим к той же целевой «контрагентской» модели.

ЧТО ДЕЛАЕТ:
  1. Потоково читает единственный лист, колонки маппит по именам заголовка (row1).
  2. Оставляет только импортёров-ЮРЛИЦ: RUC (LIBR_TRIBU, 11 цифр) начинается с "20"
     (в Перу 20 = juridica/empresa, 10 = persona natural). Снимает риск перс. данных.
  3. HS10 (CNAN) -> HS6 для сшивки с Comtrade/FAOSTAT.
  4. Даты YYYYMMDD -> ISO. Пишет нормализованный JSONL + агрегат импортёр×HS6.

ЗАПУСК (PowerShell): python scripts/parse_peru_sunat.py "<путь .xlsx>" [<каталог вывода>]

TODO: перевод исп.->рус описаний/справочников; часть диакритик в источнике побита
(«AN╙NIMA») — потеря на стороне SUNAT.
"""
import zipfile, re, io, os, sys, json, time
from collections import Counter, defaultdict

DEFAULT_IN = r"C:/Users/inska/OneDrive/Документы/Projects/site/Delomant_v2_web/обучение/олег/Перу_имп__данные.xlsx"

CELL = re.compile(r'<c r="([A-Z]+)\d+"(?:[^>]*?t="(\w+)")?[^>]*?>(?:<v>([^<]*)</v>)?')

# Целевые поля <- имена колонок SUNAT
MAP = dict(hs10="CNAN", tariff_desc="DESCRIP", date="FECHA", customs="ADUA_DESC",
           origin="PAIS_DESC", origin_code="CPAIS", fob="FOB_DOLPOL", freight="FLE_DOLAR",
           insurance="SEG_DOLAR", cif="CIF_DOLAR", net_kg="PESO_NETO", gross_kg="PESO_BRUTO",
           qty="UNID_FIQTY", unit="UNID_FIDES", goods="DESC_COM", port="PUER_DESC",
           arrival="FECH_LLEGA", dua="NUME_CORRE", line="NUME_SERIE", transport="VIAT_DESC",
           condition="SEST_DESC", importer_ruc="LIBR_TRIBU", importer="IMPORTADOR",
           dispatch="DPAIS_PROC")


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def yyyymmdd_iso(v):
    s = str(v).strip()
    if len(s) == 8 and s.isdigit():
        return "%s-%s-%s" % (s[:4], s[4:6], s[6:8])
    return s


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
    out_jsonl = os.path.join(outdir, "pe_import_normalized.jsonl")
    out_agg = os.path.join(outdir, "pe_import_aggregate.json")

    t0 = time.time()
    z = zipfile.ZipFile(src)
    ss = load_shared_strings(z)

    jf = io.open(out_jsonl, "w", encoding="utf-8")
    stats = dict(rows=0, kept=0, persons=0, net=0.0, cif=0.0, fob=0.0)
    ruc_prefix = Counter()
    cif_imp = Counter()
    agg = defaultdict(lambda: {"items": 0, "net_kg": 0.0, "cif_usd": 0.0,
                               "fob_usd": 0.0, "name": "", "hs6": ""})
    col_of = {}   # целевое поле -> буква колонки
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
                c = cells_of(rowxml, ss)
                if not hdr_done:
                    name2col = {v: k for k, v in c.items()}
                    for tgt, srcname in MAP.items():
                        col_of[tgt] = name2col.get(srcname)
                    hdr_done = True
                    continue
                stats["rows"] += 1
                gv = lambda k: c.get(col_of[k], "") if col_of.get(k) else ""
                ruc = str(gv("importer_ruc")).strip()
                ruc_prefix[ruc[:2]] += 1
                if ruc[:2] != "20":          # только юрлица
                    stats["persons"] += 1
                    continue
                hs10 = str(gv("hs10")).strip(); hs6 = hs10[:6]
                rec = {
                    "src": "PE", "date": yyyymmdd_iso(gv("date")),
                    "importer_ruc": ruc, "importer": gv("importer").strip(),
                    "hs10": hs10, "hs6": hs6, "goods": gv("goods").strip(),
                    "tariff_desc": gv("tariff_desc").strip(),
                    "origin": gv("origin").strip(), "origin_code": gv("origin_code"),
                    "dispatch": gv("dispatch"), "qty": num(gv("qty")), "unit": gv("unit").strip(),
                    "net_kg": num(gv("net_kg")), "gross_kg": num(gv("gross_kg")),
                    "fob_usd": num(gv("fob")), "freight_usd": num(gv("freight")),
                    "insurance_usd": num(gv("insurance")), "cif_usd": num(gv("cif")),
                    "customs": gv("customs").strip(), "port": gv("port").strip(),
                    "arrival": yyyymmdd_iso(gv("arrival")), "dua": gv("dua"),
                    "transport": gv("transport").strip(), "condition": gv("condition").strip(),
                }
                jf.write(json.dumps(rec, ensure_ascii=False) + "\n")
                stats["kept"] += 1
                stats["net"] += rec["net_kg"]; stats["cif"] += rec["cif_usd"]; stats["fob"] += rec["fob_usd"]
                cif_imp[ruc] += rec["cif_usd"]
                a = agg[(ruc, hs6)]
                a["items"] += 1; a["net_kg"] += rec["net_kg"]; a["cif_usd"] += rec["cif_usd"]
                a["fob_usd"] += rec["fob_usd"]; a["name"] = rec["importer"]; a["hs6"] = hs6
    jf.close()

    agg_list = [{"importer_ruc": k[0], "importer": v["name"], "hs6": v["hs6"],
                 "items": v["items"], "net_kg": round(v["net_kg"], 1),
                 "cif_usd": round(v["cif_usd"], 1), "fob_usd": round(v["fob_usd"], 1)}
                for k, v in agg.items()]
    agg_list.sort(key=lambda r: r["cif_usd"], reverse=True)
    io.open(out_agg, "w", encoding="utf-8").write(json.dumps(agg_list, ensure_ascii=False))

    print("=== Перу (SUNAT) — готово, t=%.1fs ===" % (time.time() - t0))
    print("строк:", stats["rows"], "| юрлиц оставлено:", stats["kept"],
          "| не-20 отброшено:", stats["persons"])
    print("RUC префиксы:", ruc_prefix.most_common(6))
    print("нетто, т:", round(stats["net"] / 1000, 1),
          "| CIF, USD:", round(stats["cif"]), "| FOB, USD:", round(stats["fob"]))
    print("импортёров:", len(cif_imp), "| пар импортёр×HS6:", len(agg_list))
    print("вывод:", out_jsonl, "|", out_agg)


if __name__ == "__main__":
    main()
