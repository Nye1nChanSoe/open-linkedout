--
-- detail-page data for each canonical LinkedIn job.

CREATE TABLE job_details (
    job_id INTEGER PRIMARY KEY,

    /**
     * Complete visible text from the LinkedIn job-detail header.
     */
    header_text TEXT NOT NULL,

    /**
     * Normalized full job-description text from the detail page.
     */
    description_text TEXT NOT NULL,

    /**
     * Exact LinkedIn detail-page URL used for this fetch.
     */
    source_url TEXT NOT NULL,

    /**
     * Outbound application URL when the job is not LinkedIn Easy Apply.
     */
    external_apply_url TEXT,

    /**
     * Raw personalized AI response shown after clicking "Show match details".
     */
    linkedin_show_match_details_ai_text TEXT,

    /**
     * Latest known availability of the job application
     */
    application_status TEXT NOT NULL DEFAULT 'unknown'
        CHECK (
            application_status IN (
                'unknown', 'open',
                'closed', 'unavailable'
            )
        ),

    /**
     * Time this detail page was last fetched successfully
     */
    fetched_at TEXT NOT NULL,

    /**
     * Earliest time the scheduler may refresh this detail record
     */
    next_refresh_at TEXT,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE INDEX idx_job_details_next_refresh_at
    ON job_details(next_refresh_at)
    WHERE next_refresh_at IS NOT NULL;
