# 소스 스택별로 볼 곳

STEP 1·2·5·6 에서 스택에 맞는 절만 읽는다. 목록에 없는 스택은 같은 질문(엔드포인트는 어디서 정의되나, 검증·오류는 어디서 나나, 화면은 무엇으로 그리나, 스키마는 어디서 오나)으로 찾는다.

## Spring Boot (Java/Kotlin)

- 엔드포인트: `@RestController`(JSON) 와 `@Controller`(템플릿을 반환하는 `Page`, 리다이렉트하는 `Form submit`) 둘 다. `@RequestMapping` 클래스 경로 + 메서드 경로.
- 입력: `@RequestBody` DTO, 폼 객체(`*Form`), `@ModelAttribute`, `@Valid`/`BindingResult`, `@PathVariable`/`@RequestParam` 기본값.
- 오류: `@ControllerAdvice`/`@RestControllerAdvice`, 커스텀 예외, `ResponseStatusException`.
- 보안: `SecurityFilterChain`(`permitAll` 경로, CSRF 끈 곳, form login, 세션), `@PreAuthorize`, 메서드 안 소유권 검사 유무.
- 영속성: JPA 엔티티(`@Table`·`@Column`·`@JoinColumn`·`@Enumerated(ORDINAL|STRING)`·`@GeneratedValue`), `ddl-auto`, Flyway/Liquibase, `@Query` 네이티브 쿼리, `@Transactional` 경계.
- 비동기: `@Scheduled`, `@Async`, `@EventListener`.
- 설정: `application*.yml|properties` — 자격증명이 흔하다(키 이름만).

## 서버 템플릿 (Thymeleaf, JSP, Freemarker, Jinja, Blade)

- 레이아웃·fragment → 공통 내비·공통 UI.
- 템플릿을 그리는 `Page` 핸들러와 모델 속성 → 화면 경로·표시 데이터.
- `th:action`·`<form action>`, `th:field`, HTML 검증 속성(`required`·`pattern`·`min`·`max`) → 입력·클라이언트 검증.
- `th:if`/`th:each`(또는 같은 역할 구문) → 조건·빈 상태·목록.
- 인라인·연결 JS(`fetch`, AJAX, `location.href`, `confirm()`, `alert()`) → API 호출·대화상자·피드백·이동.
- 역할 조건 구문(`sec:authorize` 등) → 역할별 UI.

## 바닐라 JS SPA (프레임워크 없음)

- 라우팅: 해시 라우터·`history` 직접 사용 → 화면 목록. 빌드 스크립트가 파일을 이어 붙이거나 전역(`window.*`)으로 바꾸는지 확인 — 모듈 경계가 소스와 실행 시 다를 수 있다.
- API 호출: `fetch`/`XMLHttpRequest` 래퍼와 그 호출처 → ApiSpec 의 Callers.
- 인증 처리: 토큰을 `localStorage` 에 두는지, 401 처리 → As-is 보안 결함 후보.
- 화면 상태: DOM 을 직접 바꾸는 코드에서 로딩·빈·오류 처리 유무.

## Node (Express, NestJS, Koa)

- 엔드포인트: `app.get/post…`, `router.*`, Nest `@Controller`/`@Get`. 미들웨어 순서(인증·본문 파서·오류 핸들러).
- 검증: `joi`/`zod`/`class-validator`, 직접 검사.
- 영속성: ORM(Prisma 스키마, TypeORM 엔티티, Sequelize 모델)과 마이그레이션 폴더.

## Python (Django, Flask, FastAPI)

- Django: `urls.py`, 뷰(함수·클래스), `forms.py`, `models.py` + `migrations/`(스키마 근거), 템플릿, `settings.py` 의 미들웨어·인증.
- Flask/FastAPI: 데코레이터 라우트, Pydantic/폼 검증, SQLAlchemy 모델, Alembic.

## PHP (Laravel 등)

- `routes/*.php`, 컨트롤러, FormRequest 검증, Eloquent 모델, `database/migrations`, Blade 템플릿, 미들웨어(`auth`, `can`).

## Rust (Axum 등)

- 라우터 구성(`Router::new().route(...)`), extractor 가 곧 입력 계약, 에러 타입 → 응답 변환(`IntoResponse`), 미들웨어(`tower` 레이어)의 인증.
- SQLx 쿼리(`query!`·`query_as!`)와 `migrations/`, `.sqlx/`.
- 서버는 조금만 고치고 프론트엔드만 다시 만드는 경우가 많다 — `scope.md` 의 재구축 범위를 확인하고, 그대로 두는 쪽은 "계약의 근거"로만 분석한다.

## 스키마 근거가 SQL 파일뿐일 때

- 마이그레이션·DDL 파일을 파일명 순서로 읽어 최종 스키마를 재구성하고, 대체·보류된 파일을 표시한다. 빈 DB 에 적용해 `pg_dump -s` 로 확인하는 것은 사용자가 요청할 때만(DB 를 띄우는 일이다).
