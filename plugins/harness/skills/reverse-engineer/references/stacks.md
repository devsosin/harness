# Where to look per source stack

In STEP 1, 2, 5 and 6 read only the sections matching the stack. For stacks not listed, ask the same questions: where are endpoints defined, where do validation and errors happen, what renders screens, where does the schema come from.

## Spring Boot (Java/Kotlin)

- Endpoints: both `@RestController` (JSON) and `@Controller` (`Page` returning a template, `Form submit` redirecting). Class `@RequestMapping` path + method path.
- Input: `@RequestBody` DTOs, form objects (`*Form`), `@ModelAttribute`, `@Valid`/`BindingResult`, `@PathVariable`/`@RequestParam` defaults.
- Errors: `@ControllerAdvice`/`@RestControllerAdvice`, custom exceptions, `ResponseStatusException`.
- Security: `SecurityFilterChain` (`permitAll` paths, where CSRF is disabled, form login, sessions), `@PreAuthorize`, whether methods check ownership.
- Persistence: JPA entities (`@Table`, `@Column`, `@JoinColumn`, `@Enumerated(ORDINAL|STRING)`, `@GeneratedValue`), `ddl-auto`, Flyway/Liquibase, native `@Query`, `@Transactional` boundaries.
- Async: `@Scheduled`, `@Async`, `@EventListener`.
- Config: `application*.yml|properties` — credentials are common (key names only).

## Server templates (Thymeleaf, JSP, Freemarker, Jinja, Blade)

- Layouts and fragments → shared navigation and shared UI.
- `Page` handlers rendering templates and their model attributes → screen paths and displayed data.
- `th:action`/`<form action>`, `th:field`, HTML validation attributes (`required`, `pattern`, `min`, `max`) → inputs and client validation.
- `th:if`/`th:each` (or equivalent) → conditions, empty states, lists.
- Inline and linked JS (`fetch`, AJAX, `location.href`, `confirm()`, `alert()`) → API calls, dialogs, feedback, navigation.
- Role conditions (`sec:authorize` etc.) → per-role UI.

## Vanilla JS SPA (no framework)

- Routing: hash routers or direct `history` use → screen list. Check whether a build script concatenates files or turns them into globals (`window.*`) — module boundaries may differ between source and runtime.
- API calls: `fetch`/`XMLHttpRequest` wrappers and their callers → Callers in ApiSpec.
- Auth handling: tokens in `localStorage`, 401 handling → As-is security defect candidates.
- Screen state: whether DOM-manipulating code handles loading, empty and error.

## Node (Express, NestJS, Koa)

- Endpoints: `app.get/post…`, `router.*`, Nest `@Controller`/`@Get`. Middleware order (auth, body parser, error handler).
- Validation: `joi`/`zod`/`class-validator`, hand-written checks.
- Persistence: ORM (Prisma schema, TypeORM entities, Sequelize models) and the migrations folder.

## Python (Django, Flask, FastAPI)

- Django: `urls.py`, views (function and class), `forms.py`, `models.py` + `migrations/` (schema evidence), templates, middleware and auth in `settings.py`.
- Flask/FastAPI: decorator routes, Pydantic/form validation, SQLAlchemy models, Alembic.

## PHP (Laravel etc.)

- `routes/*.php`, controllers, FormRequest validation, Eloquent models, `database/migrations`, Blade templates, middleware (`auth`, `can`).

## Rust (Axum etc.)

- Router setup (`Router::new().route(...)`); extractors are the input contract; error type → response conversion (`IntoResponse`); auth in middleware (`tower` layers).
- SQLx queries (`query!`, `query_as!`) and `migrations/`, `.sqlx/`.
- Often the server changes little and only the frontend is rebuilt — check the rebuild scope in `scope.md`, and analyze the side that stays only as "evidence of the contract".

## When the only schema evidence is SQL files

- Read migration and DDL files in filename order to reconstruct the final schema, marking superseded or deferred files. Applying them to an empty DB and checking with `pg_dump -s` only when the user asks (it means starting a DB).
