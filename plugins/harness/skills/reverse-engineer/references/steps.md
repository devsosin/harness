# STEP 1~8

각 절: 입력(없으면 멈출 것) → 할 일 → 출력 구조 → 보고. 공통 규칙(근거·신뢰도·ID·안전·As-is/Required)은 SKILL.md §3. 출력이 이미 있으면 고치고 기존 ID·사용자 작성 내용을 지킨다.

- [STEP 1 소스 지도](#step-1--소스-지도)
- [STEP 2 기능 분석](#step-2--기능-분석)
- [STEP 3 기능 명세](#step-3--기능-명세)
- [STEP 4 데이터 모델](#step-4--데이터-모델)
- [STEP 5 API 명세](#step-5--api-명세)
- [STEP 6 화면 명세](#step-6--화면-명세)
- [STEP 7 기술 스택](#step-7--기술-스택)
- [STEP 8 검토·최종 보고](#step-8--검토최종-보고)

## STEP 1 — 소스 지도

입력: `scope.md` 의 소스 루트. 없으면 빌드 파일(`build.gradle`·`pom.xml`·`package.json`·`Cargo.toml`·`composer.json`·`pyproject.toml`)로 찾고 쓴 경로를 밝힌다.

할 일:
1. 구조·빌드·런타임 버전·주요 의존성, 진입점·모듈·설정 파일.
2. 엔드포인트를 도메인별로: 종류(`JSON API` · `Page` · `Form submit` · `Webhook`), 핸들러, 인증·권한 요구.
3. **호출처**: 템플릿·JS·다른 저장소 코드에서 각 엔드포인트를 부르는 곳(`file:line`), 없으면 `No caller found in this repository`(쓰이지 않는다는 증거는 아니다).
4. 횡단 관심사: 필터·인터셉터·미들웨어·AOP, 전역 예외 처리.
5. 영속성: DB, 스키마 관리 방식(ORM 자동 생성·Flyway·SQL 파일·없음), DDL·마이그레이션 위치.
6. ERD·스키마 자료: `docs/` 와 저장소 전체에서 이미지·`.sql`·`.dbml`·`.drawio` 등. 이미지는 열어 본다. 위치·형식·다루는 엔티티만 적고 대조는 STEP 4.
7. 외부 연동, 스케줄 작업, 이벤트·비동기 처리.
8. 대표 기능 몇 개를 계층 끝까지 따라가 본다. 생성 코드·미사용으로 보이는 코드도 적는다(지워도 된다고 가정하지 않는다).
9. 도메인 코드를 정한다.

출력 `analysis/source-map.md`: 개요 · 이번 실행의 전제(scope 와 다른 점, 옵션) · 모듈 책임 · 도메인 코드 · 엔드포인트 목록(메서드·경로·종류·핸들러·인증·호출처) · 핵심 엔티티 · ERD/DDL 자료 · 보안·연동 개요 · 기능 후보 · 위험·열린 질문.

보고: 엔드포인트·엔티티·기능 후보 수, ERD 자료, 큰 위험.

## STEP 2 — 기능 분석

입력: `source-map.md`(없으면 STEP 1 먼저).

기능 후보마다 진입점에서 데이터 접근까지 따라가 12항목: ① 목적·결과 ② 행위자·진입점 ③ 전제·권한 ④ 입력·검증 ⑤ 처리 순서 ⑥ 업무 규칙·계산 ⑦ 생성·수정·삭제·조회 데이터 ⑧ 상태 전이·트랜잭션 경계 ⑨ 성공 응답·결과 상태 ⑩ 실패 조건·오류 응답·부수효과 ⑪ 관련 기능·API·엔티티 ⑫ 근거·열린 질문.

놓치기 쉬운 것: 소유권 제한, 암묵적 기본값, 페이지네이션, soft delete, 중복 처리, 동시성, 검증 오류와 업무 규칙 실패의 차이. 실패가 어디서 나는지(바인딩 검증·서비스 검사·전역 핸들러·DB 제약)와 그 응답(상태 코드·본문·리다이렉트·다시 그린 페이지). 보안 결함은 관련 SR 과 함께 As-is 로.

출력 `analysis/feature-inventory.md`: 기능 ID 마다 12항목, 사용자 기능/내부·운영 기능 구분. 끝에 합치거나 버린 후보와 이유.

보고: 도메인별 기능 수, 열린 질문 수.

## STEP 3 — 기능 명세

입력: `feature-inventory.md`(없으면 STEP 2 먼저), `source-map.md`, 불확실한 것은 소스.

기존 구현 기술과 무관하게 관찰 가능한 제품 동작으로 쓴다. 엔드포인트 여러 개가 한 목표면 기능 하나. 성공·실패 경로 모두. 새 스택 구현 방식은 쓰지 않는다.

```markdown
# Feature Specification
## 1. Product Overview — purpose, capabilities, actors, domain concepts
## 2. Feature Index — | Feature ID | Name | Description | Actor | Domain/API | Confidence |
## 3. Feature Details — per feature: purpose · actor & preconditions · trigger · input & validation · main flow · business rules · data changes & state transitions · success · failure & errors · authorization (As-is / Required) · related · evidence · open questions
## 4. Cross-Cutting Rules — auth (As-is / Required + SR), validation & errors, shared rules, integrations & async
## 5. Unknowns and Open Questions — unverified, conflicting evidence, missing systems, decisions needed
```

보고: 기능 수(사용자/내부), 열린 질문 수.

## STEP 4 — 데이터 모델

입력: `source-map.md`(ERD 자료 목록 포함), `feature-inventory.md`, 엔티티·enum·리포지토리(커스텀 쿼리)·영속성 설정, `erd=`·`schema=` 옵션.

1. 코드(엔티티·매핑·SQL)에서 데이터 모델: 필드, 관계, enum, 제약, 생명주기.
2. ERD 자료가 있고 `ignore` 가 아니면 엔티티·필드 단위로 대조.
   - `reference`(기본): 코드가 기준, ERD 차이는 §4.
   - `as-is`: ERD 가 기준, 코드 차이는 §4. 기존 스키마를 바꾸게 되는 차이는 `Requires decision`.
   - `ignore`: 있다는 사실만 §1 에.
3. `schema=` 가 있으면 물리 스키마의 기준으로 삼고 코드(와 ERD)와 대조한다. 없으면 물리 이름·타입은 명시적 매핑이나 DDL 로 확인될 때만 `Verified`, 나머지는 `Inferred`.
4. 이미지에서 확실히 읽을 수 없는 것은 `Unknown`.

```markdown
# Data Model
## 1. Sources and Mode — ERD found & mode, schema dump, what is authoritative
## 2. Entity Overview — | Entity | Table | Purpose | Feature IDs | Confidence | + Mermaid erDiagram if useful
## 3. Entity Details — columns (field, column, type → DB type, null, unique, default, length), PK & ID generation, relationships (cardinality, FK/join table, cascade), enums (values + storage), indexes & unique, soft delete/audit/timestamps, state transitions (→ feature IDs), evidence
## 4. Differences: ERD / Code / Schema — | Item | ERD | Code | Schema | Followed | Confidence |
## 5. Existing Database Compatibility — naming, ID generation, enum storage values, date/time & time zone, decimal, boolean/LOB, tables only in the DB, constraints only in code
## 6. Open Questions
```

새 테이블·컬럼을 설계하지 않는다. 업무 규칙은 FeatureSpec 을 가리킨다. DB 에 접속하지 않는다.

보고: 엔티티 수, ERD 모드·차이 수, 결정 필요 항목.

## STEP 5 — API 명세

입력: `FeatureSpec.md`(기능 ID, 없으면 STEP 3 먼저), `source-map.md`, `feature-inventory.md`, `DataModel.md`(있으면), 컨트롤러·DTO·폼·검증·예외 처리·응답 래퍼·호출하는 템플릿·스크립트.

범위: `JSON API`·`Form submit`·`Webhook`. `Page` 는 STEP 6.

엔드포인트마다: ① API ID·메서드·경로·종류 ② 기능 ID·목적 ③ 요청(경로·쿼리·헤더·본문/폼 필드: 이름·타입·필수·검증·기본값, 중첩) ④ 성공 응답(상태, 본문 필드 표 또는 리다이렉트·뷰) ⑤ 오류 응답(상태·조건·본문·발생 위치) ⑥ 부수효과(엔티티, 외부 호출) ⑦ 인증·권한 As-is/Required ⑧ 호출처 ⑨ 근거·신뢰도. JSON 예시는 지어낸 값 대신 타입 자리표시자(`"<string>"`, `0`).

```markdown
# API Specification (As-is)
## 1. Common Conventions — base paths & kinds, wrapper & error format, formats, pagination, auth (As-is / Required)
## 2. API Index — | API ID | Method | Path | Kind | Feature ID | Callers | Confidence |
## 3. APIs by Feature — ### F-XXX-NN → #### A-XXX-NN METHOD path (items ①–⑨)
## 4. Review Notes — no caller found, duplicates, inconsistent styles, form submits needing JSON, security gaps (SR)
## 5. Redesign Candidates — empty; STEP 8 fills it
## 6. Open Questions
```

보고: 기능별 엔드포인트 수, 호출처 없는 엔드포인트.

## STEP 6 — 화면 명세

입력: `FeatureSpec.md`(없으면 STEP 3 먼저), `ApiSpec.md`(없으면 메서드·경로로 가리키고 알린다), 소스.

화면 근거가 있으면(프론트엔드 코드·서버 템플릿·스크린샷) 직접 본다 — 그 화면은 **existing**. 백엔드만 있으면 검증된 흐름·API 에서 **candidate** 화면을 도출하고 확인된 UI 처럼 쓰지 않는다. 화면 근거별로 볼 곳은 stacks.md.

```markdown
# Screen Specification
## 1. Screen Inventory — per screen: ID, name, purpose, actor, route, entry/exit, feature IDs, evidence & confidence (existing / candidate)
## 2. Screen Details — content, actions, inputs & controls, loading/empty/success/error, validation & feedback, navigation, API & feature IDs, evidence, inferences
## 3. Navigation Flow — transitions, entry & return paths, branches, auth routing (As-is / Required), dialogs & multi-step flows
## 4. Screen-Level Unknowns
```

레이아웃·색·문구를 백엔드 코드에서 추측하지 않는다(템플릿에 있는 문구는 기존 UI 로 적어도 된다). 모든 API 에 화면이 있다고 가정하지 않는다.

보고: 화면 수(existing/candidate), 화면 없는 기능.

## STEP 7 — 기술 스택

입력(우선순위): 실행 인자의 목표 스택 문장 → `target-stack.md` → 기존 `docs/product/TechStack.md` 의 사용자 작성 내용. 충돌은 §5 에. `source-map.md` 필수, 나머지 분석 문서는 있으면.

출력 위치: 목표 스택이 있으면 `docs/product/TechStack.md`, 없으면 `analysis/product/TechStack.md`(기존 스택·대응 후보·결함만)라고 알린다.

```markdown
# Tech Stack
## 1. Technology Stack — frontend, backend, API style, DB & data access, auth, file storage, test/build/dev tools, deployment
## 2. Target Architecture — frontend / backend responsibilities, API boundary, data ownership, auth boundary, integration boundary
## 3. Existing-to-Target Mapping — only mappings with evidence (e.g. controller → handlers, service → application service, ORM entities → SQL against the existing schema, server pages & form submits → SPA screens calling JSON APIs, session login → token auth)
## 4. Security Requirements — every SR: requirement, As-is (compliant / gap / n.a.) with evidence, affected F/A IDs
## 5. Decisions and Open Questions — user decisions, dependencies, unspecified choices (TBD / Requires decision), migration risks, proposed extra security measures
```

이전 위험은 근거가 있는 것만: 서버 페이지·폼 → SPA + JSON API, 세션 로그인 → 토큰(로그아웃·비밀번호 변경·만료·역할), 기존 DB 재사용(DataModel §5, ORM 이 관리하던 스키마의 마이그레이션 기준선은 `Requires decision`, 컴파일 시 쿼리 검사는 빌드 때 DB 나 오프라인 메타데이터 필요), 파일 저장 방식 변경, 노출된 자격증명, 이 저장소 밖 클라이언트(호출처 없는 엔드포인트), 기존 데이터 호환.

버전·의존성·배포 도구·아키텍처 결정을 지어내지 않는다. SR 을 빼거나 약하게 하지 않는다.

보고: 반영한 결정, 발견한 결함, TBD 항목.

## STEP 8 — 검토·최종 보고

입력: STEP 3~7 의 다섯 문서(없는 것은 어느 단계를 돌릴지 알리고 있는 것만 검토), `source-map.md`, `feature-inventory.md`, `target-stack.md`, 소스.

점검: ① STEP 1·2 의 중요한 기능이 다 문서화됐나 ② ID 가 안정적이고 일관되게 참조되나 ③ 성공·실패·검증·권한이 빠진 기능 ④ API 계약·상태 전이가 소스와 맞나 ⑤ 화면이 맞는 F·A ID 에 연결됐나 ⑥ 추정 화면·규칙이 표시됐나 ⑦ TechStack 이 사용자 요구를 따르나 ⑧ 기존·제안이 분리됐나 ⑨ 충돌·중복·근거 없는 주장 ⑩ 열린 질문이 조용히 해결되지 않았나 ⑪ DataModel 엔티티 ↔ FeatureSpec 데이터 변경 ↔ ApiSpec 부수효과, ERD 모드 일관성 ⑫ 모든 결함에 Required + SR 이 있고 안전하지 않은 동작이 요구사항으로 쓰이지 않았나 ⑬ 설정의 비밀값이 문서에 없나. 중요한 것은 소스로 다시 확인하고, 근거가 있는 불일치만 고친다. 완성돼 보이려고 지어내지 않는다.

API 필요성 검토 → `ApiSpec.md` §5: `| API ID | Observation | Proposal | Reason & evidence | Decision needed |`, 제안은 keep · merge · replace · form submit → JSON · removal candidate. 이 저장소에서 호출처를 못 찾았다는 이유만으로 제거를 제안하지 않는다(확인 필요한 제거 후보로). As-is 절은 바꾸지 않는다.

출력 `analysis/review-report.md`(채팅에도 같은 요약): 만든·고친 문서, 분석·문서화한 기능, 주요 발견·구조 특징, API 검토 요약(제안별 수), SR 별 결함, 알려진 공백·열린 질문, 사람이 확인할 영역.

완료 조건: 다섯 문서가 제 위치에 있고, 기능 명세가 구현 근거에 기대고, 데이터 모델이 근거·ERD 모드·차이를 밝히고, 범위 안의 API 가 파라미터·반환값과 함께 다 있고, 화면이 확인/추정으로 나뉘고, 목표 스택이 사용자 요구를 따르고, 모든 SR 이 Required 로 적히고 결함이 드러나 있고, 중요한 흐름에 성공·실패가 있고, 불확실한 것이 적혀 있고, 최종 보고가 분석 범위와 남은 공백을 정직하게 말할 때.
