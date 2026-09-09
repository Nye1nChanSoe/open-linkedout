-- Current parsed structure for one job description.

CREATE TABLE job_structures (
    job_id INTEGER PRIMARY KEY,

    /**
    * Sections and their blocks, as JobStructureType
    */
    structure_json TEXT NOT NULL,

    /**
    * schema_version: the shape of structure_json.
    * parser_version: the parser release that produced it.
    */
    schema_version TEXT NOT NULL,
    parser_version TEXT NOT NULL,

    /**
    * Hash of the description_html this was parsed from
    */
    source_content_hash TEXT NOT NULL,

    parsed_at TEXT NOT NULL,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,

    CONSTRAINT job_structures_structure_json_check
        CHECK (json_valid(structure_json))
);

/**
* Answers "which jobs does the sweep need to re-parse" — every row whose
* parser is behind the current one — without scanning the JSON.
*/
CREATE INDEX idx_job_structures_parser_version
    ON job_structures(parser_version);
