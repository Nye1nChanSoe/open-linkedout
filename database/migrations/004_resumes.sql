-- Source resumes imported for local profile matching.
-- The extracted content itself lives in resume_extractions

CREATE TABLE resumes (
    id INTEGER PRIMARY KEY,


    /**
    * file_name: internally generated filename
    * original_file_name: uploaded filename
    */
    file_name TEXT NOT NULL,
    original_file_name TEXT NOT NULL,

    -- metadata
    content_hash TEXT NOT NULL UNIQUE,
    source_format TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,

    -- lifecycle
    processing_status TEXT NOT NULL DEFAULT 'pending',

    error_message TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT resumes_source_format_check
        CHECK (source_format IN ('pdf', 'docx')),

    CONSTRAINT resumes_processing_status_check
        CHECK (processing_status IN (
            'pending', 'processing', 'completed',
            'needs_ocr', 'failed'
        ))
);
