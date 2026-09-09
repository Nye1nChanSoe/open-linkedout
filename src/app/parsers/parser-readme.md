This folder turns stored LinkedIn job-detail HTML into sections containing
paragraphs and bullets. Parsing runs offline with deterministic rules; it does
not use an LLM or change the raw HTML.

The description parser works step by step:

1. Read `job_details.description_html` from `data/linkedout.db`, together with
   `jobs.title`, and pass them to `parseJobStructure` in
   [job-detail-structure-parser.ts](./job-detail-structure-parser.ts).
2. Parse the HTML with `parse5` and walk the resulting tree. Collect text,
   headings, list items, and breaks. Walk nested list containers so their
   contents are retained. Skip controls such as buttons and scripts.
3. Turn the collected content into blocks. HTML block elements and consecutive
   `<br>` tags separate paragraphs; a single `<br>` keeps a newline inside one.
   Real `<li>` elements become bullets. Normalize whitespace.
4. Identify possible headings using heading tags, short bold text, a following
   list, or known heading names/prefixes. Bullet-prefixed paragraphs stay body
   text. A broad keyword such as “requirements” alone cannot create a heading.
5. Keep a repeated job title as body text. Separate a recognized heading from
   its body when they share a paragraph separated by a single `<br>`.
6. Group blocks under headings and assign section types using
   [job-section.config.ts](../../config/job-section.config.ts). Exact aliases
   take priority over prefixes and keyword matches. Unknown headings get
   `other`; content before the first heading gets `overview`.
7. Remove LinkedIn’s “About the job” wrapper. Keep standalone and parent
   headings even when their `blocks` array is empty. The result is flat:
   `sections: [{ heading, sectionType, blocks: [{ kind, text }] }]`.

The same file also contains `parseJobHeaderFacts`, which separately reads
workplace type, employment type, and applicant count from header text.

When improving the parser:

1. Compare actual stored HTML with the parsed output. Check missing text and
   incorrect grouping before spending time on unfamiliar section labels.
2. Save a small real excerpt in
   [fixtures/job-descriptions.json](./fixtures/job-descriptions.json), retaining
   its source job ID and meaningful markup. Add a regression test for the
   observed failure in
   [job-detail-structure-parser.test.ts](./job-detail-structure-parser.test.ts).
3. Make the smallest rule or alias change that fixes it. Run these commands
   from the repository root:

   ```sh
   npm run test:parser
   npm run typecheck
   node --import tsx src/commands/tune.parser.ts --dump
   ```

   The tuning command needs the local database. It prints section counts and
   sample summaries; those counts are diagnostics, not an accuracy score.
4. Check representative records for regressions and bump
   `JOB_STRUCTURE_PARSER_VERSION` when parsing behavior changes.

More varied real data gives us better fixtures and can make the parser more
accurate **when we review failures and turn them into tested improvements**.
It does not learn automatically from additional records. Future work should
follow observed needs: new employer layouts, multilingual headings, and better
parent/subsection grouping. Preserve content first; expand rules only when the
examples justify it.
