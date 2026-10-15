-- User settings (B3). The default model becomes nullable/clearable and user_id unique for upsert.
-- Select the target database explicitly before running. Apply once to the pre-B3 schema after a backup.
-- Fresh installs build the same shape from init.sql and must not run this file.
-- The table previously had no writers/endpoints so duplicate user_id rows cannot exist.
ALTER TABLE user_settings
  MODIFY COLUMN default_model_id INT DEFAULT NULL,
  ADD UNIQUE KEY uk_user_settings_user (user_id);
