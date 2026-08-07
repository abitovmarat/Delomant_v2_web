# -*- coding: utf-8 -*-
"""
Готовит данные для модуля приложения «Зарубежная таможня» из выводов парсеров.

Вход (каталог с результатами parse_*.py; по умолчанию — рядом с исходниками):
  co_import_aggregate.json, pe_import_aggregate.json   (Колумбия, Перу — импортёр×HS6)
  kz_trade_normalized.jsonl, kg_import_normalized.jsonl (Казахстан, Кыргызстан)

Выход (data/foreign/, отдаётся приложению):
  hs_names_ru.json  — HS6/HS4 → русское название товара (извлечено из статистики КЗ/КГ,
                      где товары уже подписаны по-русски). Так названия для испанских
                      Колумбии/Перу появляются без ручного перевода.
  co_aggregate.json, pe_aggregate.json — компактные агрегаты (массивы) для витрины,
                      контрагентская модель (импортёр×HS6).
  kz_aggregate.json, kg_aggregate.json — агрегаты страновой модели (товар×партнёр).
                      Компаний в источниках КЗ/КГ нет — это публикации статведомств
                      по кодам, поэтому модель и таблица в витрине отдельные.

ЗАПУСК (PowerShell): python scripts/prep_foreign_data.py [<каталог с выводами парсеров>]
"""
import json, io, os, sys, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "foreign")
sys.path.insert(0, HERE)
from foreign_sources import provenance   # реестр источников (провенанс)

BUILT = datetime.date.today().isoformat()


def jl(path):
    if not os.path.isfile(path):
        return
    with io.open(path, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                yield json.loads(line)


def main():
    indir = sys.argv[1] if len(sys.argv) > 1 else "."
    os.makedirs(OUT, exist_ok=True)

    # 1) словарь HS -> рус. название из КЗ (HS6) и КГ (HS4)
    hs6, hs4 = {}, {}
    for r in jl(os.path.join(indir, "kz_trade_normalized.jsonl")):
        c = str(r.get("hs6", "")); nm = (r.get("product") or "").strip()
        if len(c) == 6 and nm and c not in hs6:
            hs6[c] = nm
    for r in jl(os.path.join(indir, "kg_import_normalized.jsonl")):
        c = str(r.get("hs4", "")); nm = (r.get("product") or "").strip()
        if len(c) == 4 and nm and c not in hs4:
            hs4[c] = nm
    io.open(os.path.join(OUT, "hs_names_ru.json"), "w", encoding="utf-8").write(
        json.dumps({"hs6": hs6, "hs4": hs4}, ensure_ascii=False))
    print("hs_names_ru.json: hs6=%d hs4=%d" % (len(hs6), len(hs4)))

    # 2) компактные агрегаты (без дублирования названий — модуль берёт их из словаря)
    def pack(aggfile, idkey, out, code):
        p = os.path.join(indir, aggfile)
        if not os.path.isfile(p):
            print("пропуск (нет файла):", aggfile); return
        agg = json.load(io.open(p, encoding="utf-8"))
        rows = [[r[idkey], r["importer"], r["hs6"], r["items"],
                 round(r["net_kg"], 0), round(r["cif_usd"], 0), round(r["fob_usd"], 0)] for r in agg]
        meta = dict(pairs=len(rows), importers=len({r[0] for r in rows}), hs6=len({r[2] for r in rows}),
                    cif=sum(r[5] for r in rows), fob=sum(r[6] for r in rows), net=sum(r[4] for r in rows),
                    model="firm", built=BUILT, source=provenance(code))
        obj = {"cols": ["id", "importer", "hs6", "items", "net_kg", "cif", "fob"], "meta": meta, "rows": rows}
        io.open(os.path.join(OUT, out), "w", encoding="utf-8").write(
            json.dumps(obj, ensure_ascii=False, separators=(",", ":")))
        print("%s: %d пар" % (out, len(rows)))

    pack("co_import_aggregate.json", "importer_nit", "co_aggregate.json", "CO")
    pack("pe_import_aggregate.json", "importer_ruc", "pe_aggregate.json", "PE")

    # 3) страновая модель (КЗ/КГ): товар×партнёр. Суммы в USD.
    # Натуральный объём у стран разный: КЗ публикует тонны (складываются),
    # КГ — количество в своей единице на каждый товар (тонны/штуки/кв.м/л…),
    # поэтому у КГ суммарный объём не считаем, единицу несём в строке.
    def pack_kz(srcfile, out, code):
        rows = [[str(r.get("hs6", "")), (r.get("product") or "").strip(), r.get("partner") or "",
                 round(r.get("export_t", 0.0), 1), round(r.get("export_usd", 0.0)),
                 round(r.get("import_t", 0.0), 1), round(r.get("import_usd", 0.0))]
                for r in jl(os.path.join(indir, srcfile)) if r.get("hs6")]
        if not rows:
            print("пропуск (нет файла):", srcfile); return
        meta = dict(pairs=len(rows), codes=len({r[0] for r in rows}), partners=len({r[2] for r in rows}),
                    flows="export+import", hs_level=6, model="country", built=BUILT,
                    export_usd=sum(r[4] for r in rows), import_usd=sum(r[6] for r in rows),
                    export_t=round(sum(r[3] for r in rows), 1), import_t=round(sum(r[5] for r in rows), 1),
                    source=provenance(code))
        obj = {"cols": ["code", "product", "partner", "export_t", "export_usd", "import_t", "import_usd"],
               "meta": meta, "rows": rows}
        io.open(os.path.join(OUT, out), "w", encoding="utf-8").write(
            json.dumps(obj, ensure_ascii=False, separators=(",", ":")))
        print("%s: %d пар товар×партнёр" % (out, len(rows)))

    def pack_kg(srcfile, out, code):
        rows = [[str(r.get("hs4", "")), (r.get("product") or "").strip(), r.get("partner") or "",
                 round(r.get("qty", 0.0), 1), (r.get("unit") or "").strip(),
                 round(r.get("import_usd", 0.0))]
                for r in jl(os.path.join(indir, srcfile)) if r.get("hs4")]
        if not rows:
            print("пропуск (нет файла):", srcfile); return
        meta = dict(pairs=len(rows), codes=len({r[0] for r in rows}), partners=len({r[2] for r in rows}),
                    flows="import", hs_level=4, model="country", built=BUILT,
                    import_usd=sum(r[5] for r in rows), source=provenance(code))
        obj = {"cols": ["code", "product", "partner", "qty", "unit", "import_usd"],
               "meta": meta, "rows": rows}
        io.open(os.path.join(OUT, out), "w", encoding="utf-8").write(
            json.dumps(obj, ensure_ascii=False, separators=(",", ":")))
        print("%s: %d пар товар×партнёр" % (out, len(rows)))

    pack_kz("kz_trade_normalized.jsonl", "kz_aggregate.json", "KZ")
    pack_kg("kg_import_normalized.jsonl", "kg_aggregate.json", "KG")
    print("готово ->", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
