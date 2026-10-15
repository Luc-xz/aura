-- Migration: Alter model_config table
-- Date: 2026-02-05
-- Description:
--   1. Rename column: provider_type -> provider
--   2. Make columns nullable: base_url, api_key
--   3. Remove NOT NULL constraint: temperature, max_tokens

-- Step 1: Rename provider_type to provider
ALTER TABLE model_config
CHANGE COLUMN provider_type provider VARCHAR(50) NOT NULL;

-- Step 2: Make base_url nullable (remove NOT NULL constraint)
ALTER TABLE model_config
MODIFY COLUMN base_url VARCHAR(255) DEFAULT NULL;

-- Step 3: Make api_key nullable (remove NOT NULL constraint)
ALTER TABLE model_config
MODIFY COLUMN api_key VARCHAR(255) DEFAULT NULL;

-- Step 4: Make temperature nullable (remove NOT NULL, keep DEFAULT)
ALTER TABLE model_config
MODIFY COLUMN temperature DECIMAL(3, 2) DEFAULT 0.7;

-- Step 5: Make max_tokens nullable (remove NOT NULL, keep DEFAULT)
ALTER TABLE model_config MODIFY COLUMN max_tokens INT DEFAULT 2048;

-- Combined version (single ALTER statement for better performance)
-- Uncomment this and comment the above if you prefer one statement:
/*
ALTER TABLE model_config 
CHANGE COLUMN provider_type provider VARCHAR(50) NOT NULL,
MODIFY COLUMN base_url VARCHAR(255) DEFAULT NULL,
MODIFY COLUMN api_key VARCHAR(255) DEFAULT NULL,
MODIFY COLUMN temperature DECIMAL(3, 2) DEFAULT 0.7,
MODIFY COLUMN max_tokens INT DEFAULT 2048;
*/