-- Migration: Add source linkage to note table
-- Date: 2026-09-16
-- Description:
--   1. Add workspace_id: 项目归属（roadmap 任务 2.3 提前落列）
--   2. Add source_chat_id: 来源消息追溯（roadmap 任务 1.2）

ALTER TABLE note
    ADD COLUMN workspace_id INT DEFAULT NULL AFTER user_id,
    ADD COLUMN source_chat_id INT DEFAULT NULL AFTER workspace_id;

-- 手动/AI 保存的笔记都带 workspace_id，「项目下的笔记」列表按它查
CREATE INDEX idx_note_user_workspace ON note (user_id, workspace_id);
