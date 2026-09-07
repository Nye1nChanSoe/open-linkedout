-- A campaign is one scraping intent: keywords x locations, fanned out into
-- discovery_run tasks. scheduler_tasks already is the run/task table, so
-- progress is a GROUP BY over its rows and never a counter column.

CREATE TABLE campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,

    /**
     * JSON arrays. One discovery_run task per keyword x location pair.
     */
    keywords_json TEXT NOT NULL,
    locations_json TEXT NOT NULL,

    max_pages_per_combination INTEGER NOT NULL,

    status TEXT NOT NULL,

    /**
     * Set the moment cancellation is requested. Tasks already claimed keep
     * running until they reach their next cancellation check.
     */
    cancel_requested_at TEXT,

    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    updated_at TEXT NOT NULL,

    CONSTRAINT campaigns_status_check
        CHECK (status IN (
            'pending', 'running', 'completed',
            'cancelled', 'failed'
        )),

    CONSTRAINT campaigns_keywords_json_check
        CHECK (json_valid(keywords_json)),

    CONSTRAINT campaigns_locations_json_check
        CHECK (json_valid(locations_json))
);

/**
 * Nullable: tasks and discoveries created before campaigns existed, and
 * every task created by a debug script, have no campaign.
 */
ALTER TABLE scheduler_tasks
    ADD COLUMN campaign_id INTEGER REFERENCES campaigns(id);

ALTER TABLE job_discoveries
    ADD COLUMN campaign_id INTEGER REFERENCES campaigns(id);

-- Campaign progress reads every task of one campaign grouped by status.
CREATE INDEX idx_scheduler_tasks_campaign
    ON scheduler_tasks (campaign_id, status);
