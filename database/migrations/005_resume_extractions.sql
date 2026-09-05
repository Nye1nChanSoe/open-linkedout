-- Current structured extraction for one imported resume.

CREATE TABLE resume_extractions (
    resume_id INTEGER PRIMARY KEY,

    /**
    * extracted json version of the actual resume
    */
    resume_json TEXT NOT NULL,

    /**
    * schema_version: the shape of resume_json, taken from the document.
    * extractor_version: the Restruct release that produced it.
    */
    schema_version TEXT NOT NULL,
    extractor_version TEXT NOT NULL,

    source_content_hash TEXT NOT NULL,

    /**
    * Project-relative path to the written resume.json artifact.
    */
    artifact_path TEXT,

    extracted_at TEXT NOT NULL,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE,

    CONSTRAINT resume_extractions_resume_json_check
        CHECK (json_valid(resume_json))
);
