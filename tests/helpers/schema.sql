-- Test database schema — matches production (extracted via mysqldump --no-data)
-- Tables are ordered to respect foreign key dependencies

SET FOREIGN_KEY_CHECKS=0;
SET NAMES utf8mb4;

CREATE TABLE `schools` (
  `school_id` int NOT NULL AUTO_INCREMENT,
  `school_name` varchar(50) NOT NULL,
  PRIMARY KEY (`school_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `districts` (
  `district_id` int NOT NULL AUTO_INCREMENT,
  `district_name` varchar(50) NOT NULL,
  PRIMARY KEY (`district_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `persons` (
  `person_id` int NOT NULL AUTO_INCREMENT,
  `person_name` varchar(50) NOT NULL,
  `address` varchar(1000) NOT NULL,
  `photo_link` varchar(1000) DEFAULT NULL,
  `google_maps_home_link` varchar(100) DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `district_id` int NOT NULL,
  `normalized_person_name` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`person_id`),
  KEY `district_id` (`district_id`),
  CONSTRAINT `persons_ibfk_1` FOREIGN KEY (`district_id`) REFERENCES `districts` (`district_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `accounts` (
  `account_id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(60) NOT NULL,
  `real_name` varchar(50) NOT NULL,
  `person_id` int DEFAULT NULL,
  PRIMARY KEY (`account_id`),
  UNIQUE KEY `unique_username` (`username`),
  KEY `person_id` (`person_id`),
  CONSTRAINT `accounts_ibfk_1` FOREIGN KEY (`person_id`) REFERENCES `persons` (`person_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `phone_numbers` (
  `phone_number_id` int NOT NULL AUTO_INCREMENT,
  `person_id` int NOT NULL,
  `phone_number` varchar(15) NOT NULL,
  PRIMARY KEY (`phone_number_id`),
  KEY `student_id` (`person_id`),
  CONSTRAINT `phone_numbers_ibfk_1` FOREIGN KEY (`person_id`) REFERENCES `persons` (`person_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `classes` (
  `class_id` int NOT NULL AUTO_INCREMENT,
  `class_name` varchar(50) NOT NULL,
  `school_id` int NOT NULL,
  PRIMARY KEY (`class_id`),
  KEY `school_id` (`school_id`),
  CONSTRAINT `classes_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`school_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `person_class` (
  `person_class_id` int NOT NULL AUTO_INCREMENT,
  `class_id` int NOT NULL,
  `person_id` int NOT NULL,
  `type` enum('student','teacher') NOT NULL,
  PRIMARY KEY (`person_class_id`),
  KEY `class_id` (`class_id`),
  KEY `student_id` (`person_id`),
  CONSTRAINT `person_class_ibfk_1` FOREIGN KEY (`class_id`) REFERENCES `classes` (`class_id`) ON DELETE CASCADE,
  CONSTRAINT `person_class_ibfk_2` FOREIGN KEY (`person_id`) REFERENCES `persons` (`person_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `events` (
  `event_id` int NOT NULL AUTO_INCREMENT,
  `class_id` int NOT NULL,
  `event_name` varchar(50) DEFAULT NULL,
  `type` enum('student','teacher','all') NOT NULL,
  PRIMARY KEY (`event_id`),
  KEY `class_id` (`class_id`),
  CONSTRAINT `events_ibfk_1` FOREIGN KEY (`class_id`) REFERENCES `classes` (`class_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `event_occurence` (
  `event_occurence_id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `occurence_date` date NOT NULL,
  PRIMARY KEY (`event_occurence_id`),
  UNIQUE KEY `event_id` (`event_id`,`occurence_date`),
  CONSTRAINT `event_occurence_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`event_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `attendance` (
  `event_occurence_id` int NOT NULL,
  `person_id` int NOT NULL,
  UNIQUE KEY `event_occurence_id` (`event_occurence_id`,`person_id`),
  KEY `person_id` (`person_id`),
  CONSTRAINT `attendance_ibfk_1` FOREIGN KEY (`event_occurence_id`) REFERENCES `event_occurence` (`event_occurence_id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_ibfk_2` FOREIGN KEY (`person_id`) REFERENCES `persons` (`person_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `roles` (
  `role_id` int NOT NULL AUTO_INCREMENT,
  `account_id` int NOT NULL,
  `class_id` int NOT NULL,
  `role` enum('teacher','leader','manager') NOT NULL,
  `school_id` int NOT NULL,
  PRIMARY KEY (`role_id`),
  KEY `account_id` (`account_id`),
  KEY `class_id` (`class_id`),
  KEY `school_id` (`school_id`),
  CONSTRAINT `roles_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`account_id`) ON DELETE CASCADE,
  CONSTRAINT `roles_ibfk_2` FOREIGN KEY (`class_id`) REFERENCES `classes` (`class_id`) ON DELETE CASCADE,
  CONSTRAINT `roles_ibfk_3` FOREIGN KEY (`school_id`) REFERENCES `schools` (`school_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `data_versions` (
  `resource_key` varchar(120) NOT NULL,
  `last_updated` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`resource_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS=1;