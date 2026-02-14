# Petstore API tests (Playwright)

API автотесты для Swagger Petstore на Playwright (`APIRequestContext`)  
На примере метода:

- `POST /v2/pet/{petId}` — update pet with **form-data** (`name`, `status`)

---

## Цель проекта

Показать production-style подход к API тестированию:

- Читаемая архитектура (Client + Fixtures + Helpers)
- Контрактная валидация (AJV)
- Retry только для 5xx/timeout (не на уровне теста)
- Shared Circuit Breaker для параллельных workers
- CorrelationId
- Attachments (request/response) для triage в CI
- Чёткое разделение manual test cases и automated tests

---

## Стек

- **Playwright Test (`@playwright/test`)** — раннер, репорты, `APIRequestContext`
- **AJV** — JSON Schema validation
- **GitHub Actions** — CI
- **Shared Circuit Breaker (file + lock)** — межпроцессный CB
- **Custom retry logic** — backoff + jitter + Retry-After support

---

## 📚 Documentation

### Manual Test Cases

Подробные ручные тест-кейсы, соответствующие автоматизированным тестам:

👉 **[POST /v2/pet/{petId} — Update Pet (form-data)](docs/test-cases/api_post_pet_update_form_test_cases.md)**

---

## 🚀 Быстрый старт

### Установка

```bash
npm install
npx playwright install
