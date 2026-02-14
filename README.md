# Petstore API tests (Playwright)

API автотесты для Swagger Petstore на Playwright (`APIRequestContext`), на примере метода:

- `POST /pet/{petId}` — update pet with **form data** (`name`, `status`)

Цель проекта — показать “production-style” подход к API тестированию: читаемые сценарии, переиспользование кода, устойчивость к flaky средам, быстрый triage в CI.

---

## Стек

- Playwright Test (`@playwright/test`) — раннер, репорты, `APIRequestContext`
- AJV — проверка JSON schema (контрактная валидация)
- GitHub Actions — CI
- Shared Circuit Breaker (file + lock) — межпроцессный CB для параллельных workers

---

## Быстрый старт

### 1) Установка
```bash
npm i
npx playwright install
