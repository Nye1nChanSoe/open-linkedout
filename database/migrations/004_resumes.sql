-- Source resumes imported for local profile matching.

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

    /**
    * Extraction:
    * raw_text: raw text extracted from the uploaded file.
    * normalized_text: used by later inference and matching.
    */
    raw_text TEXT,
    normalized_text TEXT,
    page_count INTEGER,
    extraction_method TEXT,
    extractor_version TEXT,

    -- lifecycle
    processing_status TEXT NOT NULL DEFAULT 'pending',

    error_message TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT resumes_source_format_check
        CHECK (source_format IN ('pdf', 'docx', 'txt')),

    CONSTRAINT resumes_processing_status_check
        CHECK (processing_status IN (
            'pending', 'processing', 'completed',
            'needs_ocr', 'failed'
        )),

    CONSTRAINT resumes_extraction_method_check
        CHECK (
            extraction_method IS NULL
            OR extraction_method IN ('native', 'ocr', 'manual')
        )
);
