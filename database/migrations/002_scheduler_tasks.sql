-- Durable task lifecycle for the local scheduler.

CREATE TABLE scheduler_tasks (
    id TEXT PRIMARY KEY,

    /**
     * Task Type: discovery_run
     */
    task_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,

    /**
     * SchedulerTaskStatusType in scheduler-task.type.ts
     */
    status TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_eligible_at TEXT,
    last_error TEXT,

    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    updated_at TEXT NOT NULL,

    CONSTRAINT scheduler_tasks_status_check
        CHECK (status IN (
            'pending', 'running', 'retry_wait',
            'completed', 'failed', 'cancelled'
        ))
);

-- Finds the oldest task that is ready for scheduler execution.
CREATE INDEX idx_scheduler_tasks_eligibility
    ON scheduler_tasks (status, next_eligible_at, created_at);
