-- Current structured inference from one processed resume.

CREATE TABLE resume_inferences (
    resume_id INTEGER PRIMARY KEY,

    /**
    * Structured JSON inferred from resumes.normalized_text.
    */
    inference_json TEXT NOT NULL,

    /**
    * SHA-256 hash of normalized_text used for this inference.
    */
    source_text_hash TEXT NOT NULL,

    /**
    * Local model and prompt|schema that produced inference_json.
    */
    model_name TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    schema_version TEXT NOT NULL,

    /**
    * Generation settings used to produce inference_json.
    */
    inference_config_json TEXT NOT NULL,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE,

    CONSTRAINT resume_inferences_inference_json_check
        CHECK (json_valid(inference_json)),
);
