-- Migration: Create data_versions table for tracking resource update timestamps
-- This table is also auto-created at server startup via dataVersionsService.ensureTable()

CREATE TABLE IF NOT EXISTS data_versions (
  resource_key VARCHAR(120) NOT NULL PRIMARY KEY,
  last_updated TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;