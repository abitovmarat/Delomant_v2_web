/*
 * Дополняет русский перевод справочника World Bank WITS.
 *
 * Большинство записей WITS используют те же числовые коды M49, что и
 * UN Comtrade, поэтому русские подписи берём из уже проверенного справочника
 * Comtrade. Исторические и служебные записи, у которых код отсутствует или
 * имеет другое значение, перечислены явно ниже.
 *
 * Запуск: node scripts/sync_wits_country_names.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const COMTRADE_PATH = path.join(DATA_DIR, 'comtrade_countries.json');
const WITS_PATH = path.join(DATA_DIR, 'wits_countries.json');

const MANUAL_NAMES = {
  BAT: 'Британская антарктическая территория',
  BES: 'Британская антарктическая территория',
  BLX: 'Бельгия — Люксембург',
  CSK: 'Чехословакия',
  DDR: 'ГДР',
  ETF: 'Эфиопия (включая Эритрею)',
  GLP: 'Гваделупа',
  GUF: 'Французская Гвиана',
  MCO: 'Европейский союз, прочие',
  MYT: 'Майотта',
  ANT: 'Нидерландские Антильские острова',
  PCE: 'Тихоокеанские острова',
  REU: 'Реюньон',
  SER: 'Сербия и Черногория',
  SVU: 'СССР',
  UNS: 'Не указано',
  YDR: 'Южный Йемен',
  YUG: 'Югославия (Сербия и Черногория)',
};

const hasCyrillic = (value) => /\p{Script=Cyrillic}/u.test(String(value || ''));
const numericCode = (value) => String(Number.parseInt(String(value), 10));

const comtrade = JSON.parse(fs.readFileSync(COMTRADE_PATH, 'utf8'));
const wits = JSON.parse(fs.readFileSync(WITS_PATH, 'utf8'));
const comtradeByCode = new Map(
  comtrade.map((country) => [numericCode(country.code), country.name]),
);

let translated = 0;
const missing = [];

for (const country of wits) {
  if (hasCyrillic(country.name)) continue;

  const name = MANUAL_NAMES[country.iso3] || comtradeByCode.get(numericCode(country.code));
  if (!name || !hasCyrillic(name)) {
    missing.push(`${country.iso3} (${country.code}): ${country.name}`);
    continue;
  }

  country.name = name;
  translated++;
}

if (missing.length > 0) {
  throw new Error(`Нет русского названия для:\n${missing.join('\n')}`);
}

wits.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
fs.writeFileSync(WITS_PATH, `${JSON.stringify(wits, null, 1)}\n`, 'utf8');
console.log(`Обновлено русских названий WITS: ${translated}; всего записей: ${wits.length}`);
