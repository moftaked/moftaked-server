-- Migration: Add 'admin' to the roles enum
-- This allows assigning an admin role that bypasses all permission checks

ALTER TABLE roles MODIFY COLUMN `role` enum('teacher','leader','manager','admin') NOT NULL;
