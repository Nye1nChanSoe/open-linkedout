-- One unit of matchable text, from either a job or a resume.

/**
* One vocabulary for both sides is what makes resume-to-job similarity a
* self-join rather than two parallel stacks.
*/
CREATE TABLE chunks (
    id INTEGER PRIMARY KEY,

    /**
    * The document (job | resume) this text came from.
    */
    owner_kind TEXT NOT NULL CHECK (owner_kind IN ('job', 'resume')),
    owner_id INTEGER NOT NULL,

    /**
    * Where in the document this sits.
    *
    *   job     the 8 JobSectionTypeType values — requirements,
    *           responsibilities, tech_stack, benefits, about_company,
    *           process, overview, other
    *   resume  the 16 restruct v1 keys — experience, education, skills,
    *           projects, certifications, licenses, tools_equipment,
    *           languages, volunteering, awards, publications, references,
    *           interests, summary, header_profile, others
    *
    * Note: 'other' (job) and 'others' (resume) are different values meaning
    */
    section TEXT NOT NULL,

    kind TEXT NOT NULL CHECK (kind IN ('bullet', 'paragraph', 'skill')),

    text TEXT NOT NULL,

    /**
    * Hash of `text`. Identical text can share one embedding,
    * the source rows are never deduplicated.
    */
    text_hash TEXT NOT NULL,

    /**
    * Path back into the source document '$.experience[2].bullets[0]'.
    */
    source_path TEXT NOT NULL,

    chunker_version TEXT NOT NULL,

    created_at TEXT NOT NULL,

    /**
    * One chunk per position per document. Re-chunking replaces
    */
    UNIQUE (owner_kind, owner_id, source_path)
);

CREATE INDEX idx_chunks_owner
    ON chunks(owner_kind, owner_id);

CREATE INDEX idx_chunks_text_hash
    ON chunks(text_hash);
