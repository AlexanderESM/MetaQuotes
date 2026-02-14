Общие допущения для набора

API Base URL: https://petstore.swagger.io

API Prefix: /v2

Метод под тестом: POST /v2/pet/{petId} (application/x-www-form-urlencoded)

Предусловие для позитивных кейсов: питомец создан через POST /v2/pet

Постусловие: можно не удалять данные (demo), но ID должен быть уникальный

Валидация:

HTTP status

После update делаем GET /v2/pet/{petId} и проверяем поля

(опционально/как в автотестах) schema validation для GET ответа


Позитивные (High value, stable)

TC-API-POST-PET-001 — Update name only

Priority: High

Type: Functional / Positive / Smoke

Objective: Убедиться, что обновление name не меняет status.

Preconditions

1 Создать питомца POST /v2/pet с name=OldName, status=available.

Steps

1 Отправить POST /v2/pet/{petId} form-data: name=NewName (без status).

2 Выполнить GET /v2/pet/{petId}.

Expected

Step 1: HTTP 200 или 204.

Step 2: HTTP 200, тело:

id == petId

name == "NewName"

status == "available" (не изменился)

Ответ соответствует schema (если включена schema-валидация)

Notes

Стабильный smoke-кейс, максимальная бизнес-ценность.



TC-API-POST-PET-002 — Update status only

Priority: High

Type: Functional / Positive / Smoke

Objective: Убедиться, что обновление status не меняет name.

Preconditions

1 Создать питомца name=Dog, status=available.

Steps

1 POST /v2/pet/{petId} form-data: status=sold.

2 GET /v2/pet/{petId}.

Expected

Update: 200/204

GET: 200

name == "Dog"

status == "sold"



TC-API-POST-PET-003 — Update name and status

Priority: Medium

Type: Functional / Positive / Regression

Objective: Проверить одновременное обновление двух полей.

Preconditions

1 Создать питомца name=Dog, status=pending.

Steps

1 POST /v2/pet/{petId} form-data: name=SuperDog, status=available.

2 GET /v2/pet/{petId}.

Expected

Update: 200/204

GET: 200

name == "SuperDog"

status == "available"



TC-API-POST-PET-004 — Repeat same update is stable

Priority: Medium

Type: Reliability / Regression

Objective: Повторная отправка одинаковых данных не приводит к “дрейфу” состояния.

Preconditions

1 Создать питомца name=Dog, status=available.

Steps

1 POST /v2/pet/{petId} form-data: name=Same, status=sold.

2 Повторить Step 1 (тот же payload).

3 GET /v2/pet/{petId}.

Expected

Оба update: 200/204

GET: 200

name == "Same"

status == "sold"

Notes

Формально это не “идемпотентность по HTTP”, но проверка стабильности результата полезна.



TC-API-POST-PET-005 — Name supports spaces and special characters

Priority: Medium

Type: Functional / Encoding / Regression

Objective: Проверить корректную обработку urlencoded form-data.

Preconditions

1 Создать питомца name=Dog, status=available.

Steps

1 POST /v2/pet/{petId} form-data: name=Mr Dog & Co.

2 GET /v2/pet/{petId}.

Expected

Update: 200/204

GET: 200

name == "Mr Dog & Co" (без потерь/замен)

status == "available"



Негативные (Best practice: чёткий контракт, но у demo он плавает)

В идеале негативные кейсы должны иметь фиксированный код/схему ошибки.
У Swagger Petstore demo поведение нестабильно → поэтому допускаем “множество кодов”, но в Notes фиксируем “как должно быть в проде”.


TC-API-POST-PET-006 — Update non-existent petId

Priority: Medium

Type: Negative / Error handling

Objective: Сервер корректно обрабатывает запрос на несуществующий ресурс.

Steps

1 POST /v2/pet/{missingId} form-data: name=NoOne.

Expected (Best practice)

HTTP 404 Not Found + тело ошибки по контракту.

Expected (Demo tolerated)

HTTP ∈ {400, 404, 405}

Notes

На проде зафиксировать 404 и schema ошибки.



TC-API-POST-PET-007 — Invalid status value

Priority: Low–Medium

Type: Negative / Validation

Objective: Проверить, что status валидируется (если валидируется).

Preconditions

1 Создать питомца status=available.

Steps

1 POST /v2/pet/{petId} form-data: status=UNKNOWN_STATUS.

2 (Опционально) GET /v2/pet/{petId} чтобы понять, принялось ли значение.

Expected (Best practice)

HTTP 400 Bad Request (или 422) и описание ошибки.

Expected (Demo tolerated)

HTTP ∈ {200, 204, 400, 405}

Если 200/204 — demo принимает произвольную строку → фиксируем это как наблюдение.



TC-API-POST-PET-008 — Empty form payload

Priority: Low

Type: Negative / Validation

Objective: Пустой update не должен ломать ресурс.

Preconditions

1 Создать питомца.

Steps

1 POST /v2/pet/{petId} с пустым body (нет name, нет status).

2 GET /v2/pet/{petId}.

Expected (Best practice)

HTTP 400 (минимум одно поле обязательно)
или HTTP 204 как no-op — но это должно быть описано контрактом.

Expected (Demo tolerated)

HTTP ∈ {200, 204, 400, 405}

GET должен вернуть исходные значения (если update был no-op/ошибка).



TC-API-POST-PET-009 — Wrong Content-Type: JSON instead of form

Priority: Medium

Type: Negative / Protocol / Contract

Objective: Endpoint для form-data не должен молча принимать JSON (или должен — но тогда это контракт).

Preconditions

1 Создать питомца.

Steps

1 POST /v2/pet/{petId} с Content-Type: application/json, body { "name": "JsonName" }.

2 (Опционально) GET /v2/pet/{petId}.

Expected (Best practice)

HTTP 415 Unsupported Media Type (идеально)
или 400 Bad Request (если сервер валидирует по-другому)

Expected (Demo tolerated)

HTTP ∈ {200, 204, 400, 405, 415}

Если 200/204, то фиксируем: сервер допускает JSON → лучше уточнить контракт/спеку.