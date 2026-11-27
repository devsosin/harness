// Spelling test for a status enum stored as a PostgreSQL enum type (CODE_STYLE §2).
// Copy next to the enum (or into tests/) and repeat per enum. Needs DATABASE_URL;
// #[sqlx::test] creates a throwaway database and runs migrations/ on it.
// For a text column with a CHECK constraint instead of an enum type, insert a row
// with each variant and read it back.

use sqlx::PgPool;

#[derive(Debug, Clone, Copy, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "order_status", rename_all = "snake_case")]
pub enum OrderStatus {
    Pending,
    Paid,
    Cancelled,
}

impl OrderStatus {
    // Keep in declaration order; the test below catches a missing variant.
    pub const ALL: [Self; 3] = [Self::Pending, Self::Paid, Self::Cancelled];
}

#[sqlx::test]
async fn order_status_matches_db(pool: PgPool) {
    // Same labels in the same order as the DB type: catches added, removed and misspelled values.
    let db: Vec<String> =
        sqlx::query_scalar("SELECT unnest(enum_range(NULL::order_status))::text")
            .fetch_all(&pool)
            .await
            .unwrap();
    let mut code = Vec::new();
    for status in OrderStatus::ALL {
        let label: String = sqlx::query_scalar("SELECT $1::text")
            .bind(status)
            .fetch_one(&pool)
            .await
            .unwrap_or_else(|e| panic!("{status:?} is not a value of order_status: {e}"));
        code.push(label);
    }
    assert_eq!(code, db, "OrderStatus and DB type order_status differ");

    // Every value decodes back to the same variant.
    for status in OrderStatus::ALL {
        let back: OrderStatus = sqlx::query_scalar("SELECT $1")
            .bind(status)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(back, status);
    }
}
