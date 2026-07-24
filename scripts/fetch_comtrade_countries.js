/*
 * Собирает справочник стран для загрузчика UN Comtrade.
 *
 * Коды берём из официального reference-файла Comtrade (M49), русские
 * названия — из таблицы ниже по ISO alpha-2. Для стран, которых в таблице
 * нет, остаётся английское название: лучше показать «Saint Lucia», чем
 * потерять строку.
 *
 * Исторические записи (India (...1974) и подобные) отбрасываем по
 * entryExpiredDate — иначе в выпадающем списке будет две Индии.
 *
 * Запуск: node scripts/fetch_comtrade_countries.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const SOURCE_URL = 'https://comtradeapi.un.org/files/v1/app/reference/partnerAreas.json';

// ISO alpha-2 → русское название
const RU_NAMES = {
  AE: 'ОАЭ', AF: 'Афганистан', AL: 'Албания', AM: 'Армения', AO: 'Ангола',
  AR: 'Аргентина', AT: 'Австрия', AU: 'Австралия', AZ: 'Азербайджан',
  BA: 'Босния и Герцеговина', BD: 'Бангладеш', BE: 'Бельгия', BG: 'Болгария',
  BH: 'Бахрейн', BN: 'Бруней', BO: 'Боливия', BR: 'Бразилия', BY: 'Беларусь',
  CA: 'Канада', CH: 'Швейцария', CL: 'Чили', CN: 'Китай', CO: 'Колумбия',
  CR: 'Коста-Рика', CU: 'Куба', CY: 'Кипр', CZ: 'Чехия', DE: 'Германия',
  DK: 'Дания', DO: 'Доминиканская Республика', DZ: 'Алжир', EC: 'Эквадор',
  EE: 'Эстония', EG: 'Египет', ES: 'Испания', ET: 'Эфиопия', FI: 'Финляндия',
  FR: 'Франция', GB: 'Великобритания', GE: 'Грузия', GH: 'Гана', GR: 'Греция',
  GT: 'Гватемала', HK: 'Гонконг', HN: 'Гондурас', HR: 'Хорватия', HU: 'Венгрия',
  ID: 'Индонезия', IE: 'Ирландия', IL: 'Израиль', IN: 'Индия', IQ: 'Ирак',
  IR: 'Иран', IS: 'Исландия', IT: 'Италия', JO: 'Иордания', JP: 'Япония',
  KE: 'Кения', KG: 'Киргизия', KH: 'Камбоджа', KP: 'КНДР', KR: 'Республика Корея',
  KW: 'Кувейт', KZ: 'Казахстан', LA: 'Лаос', LB: 'Ливан', LK: 'Шри-Ланка',
  LT: 'Литва', LU: 'Люксембург', LV: 'Латвия', LY: 'Ливия', MA: 'Марокко',
  MD: 'Молдова', ME: 'Черногория', MG: 'Мадагаскар', MK: 'Северная Македония',
  MM: 'Мьянма', MN: 'Монголия', MT: 'Мальта', MU: 'Маврикий', MV: 'Мальдивы',
  MX: 'Мексика', MY: 'Малайзия', MZ: 'Мозамбик', NA: 'Намибия', NG: 'Нигерия',
  NI: 'Никарагуа', NL: 'Нидерланды', NO: 'Норвегия', NP: 'Непал',
  NZ: 'Новая Зеландия', OM: 'Оман', PA: 'Панама', PE: 'Перу', PH: 'Филиппины',
  PK: 'Пакистан', PL: 'Польша', PT: 'Португалия', PY: 'Парагвай', QA: 'Катар',
  RO: 'Румыния', RS: 'Сербия', RU: 'Россия', SA: 'Саудовская Аравия',
  SD: 'Судан', SE: 'Швеция', SG: 'Сингапур', SI: 'Словения', SK: 'Словакия',
  SN: 'Сенегал', SO: 'Сомали', SR: 'Суринам', SY: 'Сирия', TH: 'Таиланд',
  TJ: 'Таджикистан', TM: 'Туркмения', TN: 'Тунис', TR: 'Турция', TW: 'Тайвань',
  TZ: 'Танзания', UA: 'Украина', UG: 'Уганда', US: 'США', UY: 'Уругвай',
  UZ: 'Узбекистан', VE: 'Венесуэла', VN: 'Вьетнам', YE: 'Йемен',
  ZA: 'ЮАР', ZM: 'Замбия', ZW: 'Зимбабве',
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log(`Fetching ${SOURCE_URL}...`);
  const json = await fetchJson(SOURCE_URL);
  const rows = json.results || [];
  console.log(`  ${rows.length} entries received`);

  const now = new Date();
  const countries = [];
  let translated = 0;

  for (const row of rows) {
    // Агрегат «World» и групповые записи в выборе страны не нужны
    if (row.isGroup || row.PartnerCode === 0) continue;

    // Записи, закрытые историческими изменениями границ
    if (row.entryExpiredDate && new Date(row.entryExpiredDate) < now) continue;

    const iso = (row.PartnerCodeIsoAlpha2 || '').trim();
    const ru = RU_NAMES[iso];
    if (ru) translated++;

    countries.push({
      code: row.PartnerCode,
      iso: iso,
      name: ru || row.PartnerDesc,
    });
  }

  countries.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  const outPath = path.join(__dirname, '..', 'data', 'comtrade_countries.json');
  fs.writeFileSync(outPath, JSON.stringify(countries));

  console.log(`  ${countries.length} countries kept, ${translated} with Russian names`);
  console.log(`\nSaved to ${outPath}`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
