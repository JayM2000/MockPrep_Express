import { query } from "../../database/connection"

/**
 * Raw database row shape for app.project_bookmarks.
 */
export interface BookmarkRow {
  id: string
  clerk_user_id: string
  project_id: string
  created_at: Date
}

/**
 * Adds a bookmark for a candidate → project pair.
 * On conflict (already bookmarked) it's a no-op — returns the existing row.
 */
export async function addBookmark(
  clerkUserId: string,
  projectId: string
): Promise<BookmarkRow> {
  const sql = `
    INSERT INTO app.project_bookmarks (clerk_user_id, project_id)
    VALUES ($1, $2)
    ON CONFLICT (clerk_user_id, project_id) DO NOTHING
    RETURNING *;
  `
  const result = await query<BookmarkRow>(sql, [clerkUserId, projectId])

  // If already existed, fetch and return the existing row
  if (!result.rows[0]) {
    const fetchSql = `
      SELECT * FROM app.project_bookmarks
      WHERE clerk_user_id = $1 AND project_id = $2
      LIMIT 1;
    `
    const existing = await query<BookmarkRow>(fetchSql, [clerkUserId, projectId])
    return existing.rows[0]
  }

  return result.rows[0]
}

/**
 * Removes a bookmark. Returns true if a row was deleted, false otherwise.
 */
export async function removeBookmark(
  clerkUserId: string,
  projectId: string
): Promise<boolean> {
  const sql = `
    DELETE FROM app.project_bookmarks
    WHERE clerk_user_id = $1 AND project_id = $2;
  `
  const result = await query(sql, [clerkUserId, projectId])
  return (result.rowCount ?? 0) > 0
}

/**
 * Returns all bookmarks for a given candidate, ordered newest first.
 */
export async function listBookmarksByUser(
  clerkUserId: string
): Promise<BookmarkRow[]> {
  const sql = `
    SELECT * FROM app.project_bookmarks
    WHERE clerk_user_id = $1
    ORDER BY created_at DESC;
  `
  const result = await query<BookmarkRow>(sql, [clerkUserId])
  return result.rows
}

/**
 * Checks if a specific bookmark exists (used in API responses).
 */
export async function bookmarkExists(
  clerkUserId: string,
  projectId: string
): Promise<boolean> {
  const sql = `
    SELECT 1 FROM app.project_bookmarks
    WHERE clerk_user_id = $1 AND project_id = $2
    LIMIT 1;
  `
  const result = await query(sql, [clerkUserId, projectId])
  return (result.rowCount ?? 0) > 0
}
