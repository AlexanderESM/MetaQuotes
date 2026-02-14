# POST /v2/pet/{petId} — Update Pet (form-data)

---

# Общие допущения

- **API Base URL:** https://petstore.swagger.io
- **API Prefix:** /v2
- **Метод под тестом:**  
  `POST /v2/pet/{petId}`  
  `Content-Type: application/x-www-form-urlencoded`
- **Предусловие для позитивных кейсов:**  
  Питомец создан через `POST /v2/pet`
- **Постусловие:**  
  Данные можно не удалять (demo-стенд), но `id` должен быть уникальным.

---

## Общая стратегия валидации

1. Проверка HTTP status.
2. После update выполняется `GET /v2/pet/{petId}`.
3. Проверка обновлённых полей.
4. (Опционально) Проверка соответствия JSON Schema.

---

# Позитивные сценарии (High value, stable)

---

## TC-API-POST-PET-001 — Update name only

- **Priority:** High  
- **Type:** Functional / Positive / Smoke  
- **Objective:** Убедиться, что обновление `name` не изменяет `status`.

### Preconditions

1. Создать питомца:
   - `POST /v2/pet`
   - `name=OldName`
   - `status=available`

### Steps

1. Отправить:
   ```
   POST /v2/pet/{petId}
   form-data: name=NewName
   ```
2. Выполнить:
   ```
   GET /v2/pet/{petId}
   ```

### Expected Results

- Update → HTTP 200 или 204
- GET → HTTP 200
- Проверить:
  - `id == petId`
  - `name == "NewName"`
  - `status == "available"` (не изменился)

### Notes

Стабильный smoke-кейс с высокой бизнес-ценностью.

---

## TC-API-POST-PET-002 — Update status only

- **Priority:** High  
- **Type:** Functional / Positive / Smoke  
- **Objective:** Убедиться, что обновление `status` не изменяет `name`.

### Preconditions

1. Создать питомца:
   - `name=Dog`
   - `status=available`

### Steps

1. Отправить:
   ```
   POST /v2/pet/{petId}
   form-data: status=sold
   ```
2. Выполнить:
   ```
   GET /v2/pet/{petId}
   ```

### Expected Results

- Update → HTTP 200 или 204
- GET → HTTP 200
- Проверить:
  - `name == "Dog"`
  - `status == "sold"`

---

## TC-API-POST-PET-003 — Update name and status

- **Priority:** Medium  
- **Type:** Functional / Regression  
- **Objective:** Проверить одновременное обновление двух полей.

### Preconditions

1. Создать питомца:
   - `name=Dog`
   - `status=pending`

### Steps

1. Отправить:
   ```
   POST /v2/pet/{petId}
   form-data: name=SuperDog, status=available
   ```
2. Выполнить:
   ```
   GET /v2/pet/{petId}
   ```

### Expected Results

- Update → HTTP 200 или 204
- GET → HTTP 200
- Проверить:
  - `name == "SuperDog"`
  - `status == "available"`

---

## TC-API-POST-PET-004 — Repeat same update is stable

- **Priority:** Medium  
- **Type:** Reliability / Regression  
- **Objective:** Повторная отправка одинаковых данных не приводит к изменению состояния.

### Preconditions

1. Создать питомца:
   - `name=Dog`
   - `status=available`

### Steps

1. Отправить:
   ```
   POST /v2/pet/{petId}
   form-data: name=Same, status=sold
   ```
2. Повторить шаг 1 (тот же payload).
3. Выполнить:
   ```
   GET /v2/pet/{petId}
   ```

### Expected Results

- Оба update → HTTP 200 или 204
- GET → HTTP 200
- Проверить:
  - `name == "Same"`
  - `status == "sold"`

### Notes

Это проверка стабильности результата (не строгая HTTP-идемпотентность).

---

## TC-API-POST-PET-005 — Name supports spaces and special characters

- **Priority:** Medium  
- **Type:** Functional / Encoding / Regression  
- **Objective:** Проверить корректную обработку urlencoded form-data.

### Preconditions

1. Создать питомца:
   - `name=Dog`
   - `status=available`

### Steps

1. Отправить:
   ```
   POST /v2/pet/{petId}
   form-data: name=Mr Dog & Co
   ```
2. Выполнить:
   ```
   GET /v2/pet/{petId}
   ```

### Expected Results

- Update → HTTP 200 или 204
- GET → HTTP 200
- Проверить:
  - `name == "Mr Dog & Co"`
  - `status == "available"`

---

# Негативные сценарии

> В идеале негативные кейсы должны иметь фиксированный код и контракт ошибки.  
> Swagger Petstore demo может возвращать разные статусы.

---

## TC-API-POST-PET-006 — Update non-existent petId

- **Priority:** Medium  
- **Type:** Negative / Error Handling  
- **Objective:** Проверить обработку запроса к несуществующему ресурсу.

### Steps

1. Отправить:
   ```
   POST /v2/pet/{missingId}
   form-data: name=NoOne
   ```

### Expected Results

- HTTP ∈ {400, 404, 405}

---

## TC-API-POST-PET-007 — Invalid status value

- **Priority:** Low–Medium  
- **Type:** Negative / Validation  
- **Objective:** Проверить валидацию поля `status`.

### Preconditions

1. Создать питомца со `status=available`.

### Steps

1. Отправить:
   ```
   POST /v2/pet/{petId}
   form-data: status=UNKNOWN_STATUS
   ```
2. (Опционально) выполнить `GET /v2/pet/{petId}`.

### Expected Results

- HTTP ∈ {200, 204, 400, 405}

Если получен 200/204 — зафиксировать, что demo принимает произвольные значения.

---

## TC-API-POST-PET-008 — Empty form payload

- **Priority:** Low  
- **Type:** Negative / Validation  
- **Objective:** Пустой update не должен ломать ресурс.

### Preconditions

1. Создать питомца.

### Steps

1. Отправить:
   ```
   POST /v2/pet/{petId}
   (пустой body)
   ```
2. Выполнить:
   ```
   GET /v2/pet/{petId}
   ```

### Expected Results

- HTTP ∈ {200, 204, 400, 405}
- GET возвращает исходные значения.

---

## TC-API-POST-PET-009 — Wrong Content-Type (JSON instead of form)

- **Priority:** Medium  
- **Type:** Negative / Protocol / Contract  
- **Objective:** Endpoint для form-data не должен принимать JSON без явного контракта.

### Preconditions

1. Создать питомца.

### Steps

1. Отправить:
   ```
   POST /v2/pet/{petId}
   Content-Type: application/json
   ```
   ```json
   { "name": "JsonName" }
   ```
2. (Опционально) выполнить `GET /v2/pet/{petId}`.

### Expected Results

- HTTP ∈ {200, 204, 400, 405, 415}

Если получен 200/204 — необходимо уточнение API-контракта.

---

# Связь с автотестами

Данные тест-кейсы соответствуют автоматизированным тестам Playwright в:

```
tests/api/pet.update-form.spec.ts
```

