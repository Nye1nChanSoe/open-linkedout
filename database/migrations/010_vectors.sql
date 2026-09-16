-- Embeddings of chunks, and which profile produced each one.

/**
* sqlite-vec defaults to L2. 
* Cosine is declared so that distance means 1 - cosine similarity.
*
* The dimension is fixed at creation: a model with another dimension needs a
* new table and a full re-embed, never an ALTER.
*/
CREATE VIRTUAL TABLE vec_chunks USING vec0(
    chunk_id INTEGER PRIMARY KEY,

    /**
    * Lets a search stay inside jobs or resumes instead of filtering after
    * the top k, which can come back short.
    */
    owner_kind TEXT PARTITION KEY,

    embedding FLOAT[384] distance_metric=cosine
);

CREATE TABLE chunk_embeddings (
    chunk_id INTEGER PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,

    /**
    * toEmbeddingProfileId() of the embedder that wrote the vector. A vector
    * from another profile is stale, whatever its dimension.
    */
    embedding_profile TEXT NOT NULL,

    dim INTEGER NOT NULL,
    embedded_at TEXT NOT NULL
);

CREATE INDEX idx_chunk_embeddings_profile
    ON chunk_embeddings(embedding_profile);

/**
* A virtual table cannot hold a foreign key, so this keeps a deleted chunk
* from leaving its vector behind.
*/
CREATE TRIGGER chunks_delete_vector
AFTER DELETE ON chunks
BEGIN
    DELETE FROM vec_chunks WHERE chunk_id = old.id;
END;
