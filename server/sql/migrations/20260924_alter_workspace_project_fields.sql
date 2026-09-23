-- Workspace project fields (B1). Select the target database explicitly before running.
-- Apply once to the pre-B1 schema after taking a backup. DDL is not transactionally reversible.
-- chatCount is computed from chat rows, not stored as a redundant workspace column.
ALTER TABLE workspace
  ADD COLUMN goal VARCHAR(255) DEFAULT NULL AFTER title,
  ADD COLUMN description VARCHAR(2000) DEFAULT NULL AFTER goal,
  ADD COLUMN status TINYINT NOT NULL DEFAULT 0 AFTER description;

CREATE INDEX idx_workspace_user_status ON workspace (user_id, status);
CREATE INDEX idx_chat_workspace_created ON chat (workspace_id, created_at);
