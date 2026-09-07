-- Keyword search over job descriptions. This is plain lexical search and is
-- deliberately separate from the semantic search added later: it is far
-- cheaper and answers a different question ("contains Kubernetes").

/**
 * External-content index: the text stays in job_details and is never
 * duplicated here. job_details.job_id is the table's rowid alias, so it
 * doubles as the FTS rowid.
 */
CREATE VIRTUAL TABLE job_details_fts USING fts5 (
    header_text,
    description_text,
    content = 'job_details',
    content_rowid = 'job_id',
    tokenize = 'unicode61'
);

CREATE TRIGGER job_details_fts_after_insert
AFTER INSERT ON job_details
BEGIN
    INSERT INTO job_details_fts (rowid, header_text, description_text)
    VALUES (new.job_id, new.header_text, new.description_text);
END;

/**
 * An external-content index is corrected by writing the old row back
 * under the 'delete' command before the new one is inserted.
 */
CREATE TRIGGER job_details_fts_after_delete
AFTER DELETE ON job_details
BEGIN
    INSERT INTO job_details_fts (job_details_fts, rowid, header_text, description_text)
    VALUES ('delete', old.job_id, old.header_text, old.description_text);
END;

CREATE TRIGGER job_details_fts_after_update
AFTER UPDATE ON job_details
BEGIN
    INSERT INTO job_details_fts (job_details_fts, rowid, header_text, description_text)
    VALUES ('delete', old.job_id, old.header_text, old.description_text);

    INSERT INTO job_details_fts (rowid, header_text, description_text)
    VALUES (new.job_id, new.header_text, new.description_text);
END;

-- Details scraped before this index existed.
INSERT INTO job_details_fts (job_details_fts) VALUES ('rebuild');
