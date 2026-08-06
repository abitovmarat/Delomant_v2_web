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
  co_aggregate.json, pe_aggregate.json — компактные агрегаты (массивы) для витрины.

ЗАПУСК (PowerShell): python scripts/prep_foreign_data.py [<каталог с выводами парсеров>]
"""
import json, io, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "foreign")


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
    def pack(aggfile, idkey, out):
        p = os.path.join(indir, aggfile)
        if not os.path.isfile(p):
            print("пропуск (нет файла):", aggfile); return
        agg = json.load(io.open(p, encoding="utf-8"))
        rows = [[r[idkey], r["importer"], r["hs6"], r["items"],
                 round(r["net_kg"], 0), round(r["cif_usd"], 0), round(r["fob_usd"], 0)] for r in agg]
        meta = dict(pairs=len(rows), importers=len({r[0] for r in rows}), hs6=len({r[2] for r in rows}),
                    cif=sum(r[5] for r in rows), fob=sum(r[6] for r in rows), net=sum(r[4] for r in rows))
        obj = {"cols": ["id", "importer", "hs6", "items", "net_kg", "cif", "fob"], "meta": meta, "rows": rows}
        io.open(os.path.join(OUT, out), "w", encoding="utf-8").write(
            json.dumps(obj, ensure_ascii=False, separators=(",", ":")))
        print("%s: %d пар" % (out, len(rows)))

    pack("co_import_aggregate.json", "importer_nit", "co_aggregate.json")
    pack("pe_import_aggregate.json", "importer_ruc", "pe_aggregate.json")
    print("готово ->", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
