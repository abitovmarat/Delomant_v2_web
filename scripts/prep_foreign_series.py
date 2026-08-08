# -*- coding: utf-8 -*-
"""
Сводит годовые/помесячные ряды КГ и КЗ в компактные снимки для витрины.

Вход  (готовит parse_*_series.py): data/foreign/archive/*_series.jsonl
Выход (отдаётся приложению):       data/foreign/kg_series.json, kz_series.json

ФОРМАТ. Ряд хранится ШИРОКО: одна строка = пара «код × партнёр», значения по
периодам — массивом в порядке meta.periods. Длинный формат (строка на каждый
период) весил бы вчетверо больше при той же информации, а витрине для графика
нужен именно вектор по времени.

  KG: [code, partner, [usd по годам…], [qty по годам…]]
  KZ: [code, partner, [эксп.usd…], [имп.usd…], [эксп.т…], [имп.т…]]

Название товара и единица измерения НЕ лежат в строке: один код встречается в
среднем у 22 партнёров, и дублирование названия раздувало снимок почти на
мегабайт. Они вынесены в meta.names / meta.units — словари «код → значение».

Пропуски — null, а не 0: «данных за год нет» и «ввоза не было» — разные вещи,
и на графике их нельзя рисовать одинаково.

Периоды с неполным охватом помечены в meta.partial — витрина обязана показывать
такую точку иначе, чем полный год (иначе падение на графике примут за обвал
рынка, хотя это просто недобранные месяцы).

ЗАПУСК (PowerShell): python scripts/prep_foreign_series.py
"""
import json, io, os, sys, datetime
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ARCHIVE = os.path.join(HERE, "..", "data", "foreign", "archive")
OUT = os.path.join(HERE, "..", "data", "foreign")
sys.path.insert(0, HERE)
from foreign_sources import provenance

BUILT = datetime.date.today().isoformat()


def jl(path):
    with io.open(path, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                yield json.loads(line)


def write(obj, name):
    p = os.path.join(OUT, name)
    io.open(p, "w", encoding="utf-8").write(
        json.dumps(obj, ensure_ascii=False, separators=(",", ":")))
    return os.path.getsize(p)


def build_kg():
    src = os.path.join(ARCHIVE, "kg_import_series.jsonl")
    if not os.path.isfile(src):
        print("пропуск КГ: нет", src); return
    idx = json.load(io.open(os.path.join(ARCHIVE, "kg_series_index.json"), encoding="utf-8"))
    years = [y["year"] for y in idx["years"]]
    pos = {y: i for i, y in enumerate(years)}

    # ВАЖНО: пара «код × партнёр» встречается в бюллетене НЕСКОЛЬКО раз, когда
    # товар учитывается в разных единицах (напр. 0407 «Яйца» из России — строка
    # в тыс. штук и строка в штуках). Стоимость таких строк СКЛАДЫВАЕМ, иначе
    # снимок теряет часть импорта: присваивание вместо сложения занижало 2026-й
    # на 955 млн USD (1353 пары из 12 743).
    # Количество не складываем — разные единицы не суммируются; когда единиц
    # больше одной, пишем null и помечаем единицу как «разные».
    rows = {}
    names, units = {}, {}
    unit_seen = {}
    for r in jl(src):
        key = (r["hs4"], r["partner"])
        d = rows.setdefault(key, {"usd": [None] * len(years), "qty": [None] * len(years)})
        i = pos.get(r["year"])
        if i is None:
            continue
        d["usd"][i] = round(r["import_usd"]) + (d["usd"][i] or 0)
        u = (r["unit"] or "").strip()
        seen = unit_seen.setdefault(key, set())
        seen.add(u)
        if len(seen) > 1:
            d["qty"][i] = None            # сложить разные единицы нельзя
        else:
            d["qty"][i] = round(r["qty"], 1) + (d["qty"][i] or 0)
        names.setdefault(r["hs4"], (r["product"] or "").strip())
        units.setdefault(r["hs4"], u)

    out = [[c, p, v["usd"], v["qty"]] for (c, p), v in rows.items()]
    # сортируем по обороту за последний полный период — витрина показывает топ
    last_full = max((i for i, y in enumerate(idx["years"]) if not y["partial"]), default=len(years) - 1)
    out.sort(key=lambda r: (r[2][last_full] or 0), reverse=True)

    meta = dict(
        model="country", flows="import", hs_level=4, built=BUILT,
        names=names, units=units,
        periods=years,
        period_labels=[y["period"] for y in idx["years"]],
        partial=[bool(y["partial"]) for y in idx["years"]],
        coverage_pct=[y.get("coverage_pct") for y in idx["years"]],
        official_total=[y.get("official_total") for y in idx["years"]],
        pairs=len(out), codes=len({r[0] for r in out}), partners=len({r[1] for r in out}),
        # см. пояснение в build_kz(): итог считаем по строкам снимка
        import_usd=[sum((r[2][i] or 0) for r in out) for i in range(len(years))],
        source=provenance("KG"))
    size = write({"cols": ["code", "partner", "import_usd", "qty"],
                  "meta": meta, "rows": out}, "kg_series.json")
    print("kg_series.json: %d пар × %d лет — %.1f МБ" % (len(out), len(years), size / 1048576.0))


def build_kz():
    src = os.path.join(ARCHIVE, "kz_trade_series.jsonl")
    if not os.path.isfile(src):
        print("пропуск КЗ: нет", src); return
    idx = json.load(io.open(os.path.join(ARCHIVE, "kz_series_index.json"), encoding="utf-8"))
    periods = [p["period"] for p in idx["periods"]]
    pos = {p: i for i, p in enumerate(periods)}
    n = len(periods)

    rows = {}
    names = {}
    for r in jl(src):
        key = (r["hs6"], r["partner"])
        d = rows.setdefault(key, {"eu": [None] * n, "iu": [None] * n,
                                  "et": [None] * n, "it": [None] * n})
        i = pos.get(r["period"])
        if i is None:
            continue
        d["eu"][i] = round(r["export_usd"]); d["iu"][i] = round(r["import_usd"])
        d["et"][i] = round(r["export_t"], 1); d["it"][i] = round(r["import_t"], 1)
        names.setdefault(r["hs6"], (r["product"] or "").strip())

    out = [[c, p, v["eu"], v["iu"], v["et"], v["it"]] for (c, p), v in rows.items()]
    out.sort(key=lambda r: sum(x for x in r[3] if x), reverse=True)

    meta = dict(
        model="country", flows="export+import", hs_level=6, built=BUILT,
        names=names,
        periods=periods, period_labels=periods,
        partial=[False] * n,          # публикация помесячная и закрытая: все месяцы полные
        pairs=len(out), codes=len({r[0] for r in out}), partners=len({r[1] for r in out}),
        # Итоги считаем ПО СТРОКАМ СНИМКА, а не переносим из индекса ряда: строки
        # округлены до целых USD, и сумма индекса (округление в самом конце)
        # расходилась бы с суммой видимых чисел на десятки долларов.
        export_usd=[sum((r[2][i] or 0) for r in out) for i in range(n)],
        import_usd=[sum((r[3][i] or 0) for r in out) for i in range(n)],
        source=provenance("KZ"))
    size = write({"cols": ["code", "partner",
                           "export_usd", "import_usd", "export_t", "import_t"],
                  "meta": meta, "rows": out}, "kz_series.json")
    print("kz_series.json: %d пар × %d месяцев — %.1f МБ" % (len(out), n, size / 1048576.0))


def main():
    os.makedirs(OUT, exist_ok=True)
    build_kg()
    build_kz()
    print("готово ->", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
