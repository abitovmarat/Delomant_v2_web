
---

## 5. Навигация

### Sidebar
- фиксированная
- слева
- ширина ~240px

Пункты:
- Dashboard
- Data
- Processing
- Analysis
- Visualization
- Reports
- Settings

### Header
- фильтр периода
- выбор активного набора данных
- пользователь (без профиля)

---

## 6. Dashboard (главный экран)

### Назначение
Дать аналитику **мгновенное понимание состояния данных**.

### Состав

#### KPI Cards (верх)
- Количество строк
- Период данных
- Темп роста (%)
- Аномалии

#### Основной график
- Line / Area
- динамика ключевого показателя

#### Дополнительно
- последние загруженные файлы
- последние отчёты

---

## 7. Module: Data (Загрузка данных)

### Purpose
Загрузка и валидация данных.

### UI Structure
- Drag & Drop Upload Card
- File Info Card

### File Card
- имя файла
- количество строк
- столбцы
- период
- статус валидации

### States
- empty
- loading
- success
- error

---

## 8. Module: Processing (Обработка)

### Логика
Pipeline-подход.

### UI
- список операций (checkbox)
- preview результата
- одна кнопка: Apply processing

### Пример операций
- удалить дубликаты
- нормализовать даты
- убрать пустые значения

---

## 9. Module: Analysis (Анализ)

### UI
Карточки действий (Action Cards), а не select.

### Карточки анализа
- Темп роста
- Статистика
- Тренды

Каждая карточка:
- название
- краткое описание
- кнопка запуска

### Результаты
- KPI cards
- графики
- таблицы

---

## 10. Module: Visualization

### Layout
- центр — график
- справа — панель настроек

### Настройки
- тип графика
- оси
- агрегация
- период

### Экспорт
- PNG
- SVG
- добавить в отчёт

---

## 11. Module: Reports

### UI
- список отчётов
- статус генерации
- кнопки скачивания

### Форматы
- PDF
- Excel
- CSV

---

## 12. Design System

### Colors (Light)
- Background: #F8FAFC
- Surface: #FFFFFF
- Primary: #2563EB
- Success: #16A34A
- Error: #DC2626
- Text primary: #0F172A
- Text secondary: #64748B

### Typography
- Font: Inter
- Headings: 16–20px
- Body: 14px
- Numbers: monospace

---

## 13. UI Components

### KPI Card
- title
- value
- delta (optional)
- color logic (growth/decline)

### Upload Card
- drag area
- upload state
- error state

### Data Table
- sortable
- filterable
- pagination

### Action Card
- icon
- title
- description
- action button

---

## 14. UI States

Каждый экран обязан поддерживать:
- loading
- empty
- success
- error
- no data

---

## 15. Адаптивность

Поддерживаемые разрешения:
- 1920×1080
- 1440×900
- 1366×768

Мобильная версия не требуется.

---

## 16. Rules for AI-assisted development (Claude)

Claude обязан:
- строго следовать этому документу
- не придумывать новые UI-блоки
- использовать semantic HTML
- не использовать inline styles
- не использовать React / Vue
- не добавлять анимации

---

## 17. Frontend Checklist

- Sidebar реализован
- Dashboard есть
- KPI cards работают
- Все модули соответствуют структуре
- Цвета соответствуют Design System
- Нет лишних UI-элементов

---

## END OF SPECIFICATION
