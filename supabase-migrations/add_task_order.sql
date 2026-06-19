-- Migration: Add task_order column for drag-to-reorder feature
-- This migration adds a column to track the custom order of tasks within a user's task list

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_order INT DEFAULT 0;

-- Create index for efficient sorting by order
CREATE INDEX IF NOT EXISTS idx_tasks_user_order ON tasks(user_id, task_order);

-- Add comment explaining the column
COMMENT ON COLUMN tasks.task_order IS 'Custom order for drag-to-reorder feature. Lower values appear first.';
