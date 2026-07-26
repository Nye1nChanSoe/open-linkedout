-- 002_job_discovery.sql
--
-- Adds persistence for:
--
-- 1. Canonical LinkedIn jobs
-- 2. Search-result discovery observations
--
-- One row in jobs represents one real LinkedIn job.
-- One job may have many job_discoveries.

CREATE TABLE jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    linkedin_job_id TEXT NOT NULL,

    /**
     * Latest known job-card fields.
     *
     * These values may be refreshed whenever the same LinkedIn
     * job is discovered again.
     */
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT NOT NULL,
    canonical_url TEXT NOT NULL,

    logo_image_url TEXT,
    posted_date TEXT,
    posted_ago TEXT,
    salary_text TEXT,
    insights_json TEXT,

    is_viewed INTEGER NOT NULL DEFAULT 0,
    is_easy_apply INTEGER NOT NULL DEFAULT 0,
    is_early_applicant INTEGER NOT NULL DEFAULT 0,

    /**
     * first_seen_at never changes after insertion.
     *
     * last_seen_at changes whenever the job is encountered again.
     */
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    CONSTRAINT jobs_linkedin_job_id_unique
        UNIQUE (linkedin_job_id)
);


CREATE TABLE job_discoveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    /**
     * not the LinkedIn job identifier.
     */
    job_id INTEGER NOT NULL,

    /**
     * Search context in which the job was observed.
     */
    keyword TEXT NOT NULL,
    search_location TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    position INTEGER NOT NULL,

    is_promoted INTEGER NOT NULL DEFAULT 0,
    discovered_at TEXT NOT NULL,

    CONSTRAINT job_discoveries_job_fk
        FOREIGN KEY (job_id)
        REFERENCES jobs(id)
        ON DELETE RESTRICT,

    /**
     * Reprocessing the same search page does not create another
     * observation for the same job.
     *
     * Position is deliberately excluded. A ranking change does
     * not create another identity for the observation.
     */
    CONSTRAINT job_discoveries_search_observation_unique
        UNIQUE (
            job_id,
            keyword,
            search_location,
            page_number
        )
);


-- indexing doesnt really matter for now
-- CREATE INDEX idx_jobs_last_seen_at
--     ON jobs(last_seen_at DESC);


-- CREATE INDEX idx_jobs_company
--     ON jobs(company);


-- CREATE INDEX idx_job_discoveries_job_id
--     ON job_discoveries(job_id);


-- CREATE INDEX idx_job_discoveries_search_context
--     ON job_discoveries(
--         keyword,
--         search_location,
--         page_number
--     );


-- CREATE INDEX idx_job_discoveries_discovered_at
--     ON job_discoveries(discovered_at DESC);