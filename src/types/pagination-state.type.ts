/**
 * Recovery States
 */
export type PaginatorRecoveryStateType =
  | "ORIGINAL_PAGE" // URL is still on the original offset. &start=xxx
  | "TARGET_PAGE_READY" // URL is on the expected offset and rendered jobs changed.
  | "TARGET_PAGE_STALE" // URL is on the expected offset but old jobs remain.
  | "UNEXPECTED_PAGE"; // URL is neither the original nor expected offset.

export type PaginatorNavigationSnapshotType = {
  originalStartOffset: number;
  targetStartOffset: number;
  originalHydratedJobFingerprint: string;
};
