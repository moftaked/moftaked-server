-- MySQL dump 10.13  Distrib 8.0.39, for Linux (x86_64)
--
-- Host: localhost    Database: moftaked
-- ------------------------------------------------------
-- Server version	8.0.39-0ubuntu0.22.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `accounts`
--

DROP TABLE IF EXISTS `accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts` (
  `account_id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(60) NOT NULL,
  `real_name` varchar(50) NOT NULL,
  PRIMARY KEY (`account_id`),
  UNIQUE KEY `unique_username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts`
--

LOCK TABLES `accounts` WRITE;
/*!40000 ALTER TABLE `accounts` DISABLE KEYS */;
/*!40000 ALTER TABLE `accounts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance`
--

DROP TABLE IF EXISTS `attendance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance` (
  `event_occurence_id` int NOT NULL,
  `person_id` int NOT NULL,
  UNIQUE KEY `event_occurence_id` (`event_occurence_id`,`person_id`),
  KEY `person_id` (`person_id`),
  CONSTRAINT `attendance_ibfk_1` FOREIGN KEY (`event_occurence_id`) REFERENCES `event_occurence` (`event_occurence_id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_ibfk_2` FOREIGN KEY (`person_id`) REFERENCES `persons` (`person_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance`
--

LOCK TABLES `attendance` WRITE;
/*!40000 ALTER TABLE `attendance` DISABLE KEYS */;
/*!40000 ALTER TABLE `attendance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `classes`
--

DROP TABLE IF EXISTS `classes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `classes` (
  `class_id` int NOT NULL AUTO_INCREMENT,
  `class_name` varchar(50) NOT NULL,
  `school_id` int NOT NULL,
  PRIMARY KEY (`class_id`),
  KEY `school_id` (`school_id`),
  CONSTRAINT `classes_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`school_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `classes`
--

LOCK TABLES `classes` WRITE;
/*!40000 ALTER TABLE `classes` DISABLE KEYS */;
/*!40000 ALTER TABLE `classes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `event_occurence`
--

DROP TABLE IF EXISTS `event_occurence`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `event_occurence` (
  `event_occurence_id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `occurence_date` date NOT NULL,
  PRIMARY KEY (`event_occurence_id`),
  UNIQUE KEY `event_id` (`event_id`,`occurence_date`),
  CONSTRAINT `event_occurence_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`event_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `event_occurence`
--

LOCK TABLES `event_occurence` WRITE;
/*!40000 ALTER TABLE `event_occurence` DISABLE KEYS */;
/*!40000 ALTER TABLE `event_occurence` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `events`
--

DROP TABLE IF EXISTS `events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `events` (
  `event_id` int NOT NULL AUTO_INCREMENT,
  `class_id` int NOT NULL,
  `event_name` enum('الافتقاد','اجتماع الخدمة','الخدمة') DEFAULT NULL,
  `type` enum('student','teacher','all') NOT NULL,
  PRIMARY KEY (`event_id`),
  KEY `class_id` (`class_id`),
  CONSTRAINT `events_ibfk_1` FOREIGN KEY (`class_id`) REFERENCES `classes` (`class_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `events`
--

LOCK TABLES `events` WRITE;
/*!40000 ALTER TABLE `events` DISABLE KEYS */;
/*!40000 ALTER TABLE `events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `person_class`
--

DROP TABLE IF EXISTS `person_class`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `person_class`
--

LOCK TABLES `person_class` WRITE;
/*!40000 ALTER TABLE `person_class` DISABLE KEYS */;
/*!40000 ALTER TABLE `person_class` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `persons`
--

DROP TABLE IF EXISTS `persons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `persons` (
  `person_id` int NOT NULL AUTO_INCREMENT,
  `person_name` varchar(50) NOT NULL,
  `address` varchar(1000) NOT NULL,
  `photo_link` varchar(1000) DEFAULT NULL,
  `google_maps_home_link` varchar(100) DEFAULT NULL,
  `district` varchar(50) NOT NULL,
  `notes` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`person_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `persons`
--

LOCK TABLES `persons` WRITE;
/*!40000 ALTER TABLE `persons` DISABLE KEYS */;
/*!40000 ALTER TABLE `persons` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `phone_numbers`
--

DROP TABLE IF EXISTS `phone_numbers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `phone_numbers` (
  `phone_number_id` int NOT NULL AUTO_INCREMENT,
  `person_id` int NOT NULL,
  `phone_number` varchar(15) NOT NULL,
  PRIMARY KEY (`phone_number_id`),
  KEY `student_id` (`person_id`),
  CONSTRAINT `phone_numbers_ibfk_1` FOREIGN KEY (`person_id`) REFERENCES `persons` (`person_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `phone_numbers`
--

LOCK TABLES `phone_numbers` WRITE;
/*!40000 ALTER TABLE `phone_numbers` DISABLE KEYS */;
/*!40000 ALTER TABLE `phone_numbers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `schools`
--

DROP TABLE IF EXISTS `schools`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schools` (
  `school_id` int NOT NULL AUTO_INCREMENT,
  `school_name` varchar(50) NOT NULL,
  PRIMARY KEY (`school_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schools`
--

LOCK TABLES `schools` WRITE;
/*!40000 ALTER TABLE `schools` DISABLE KEYS */;
/*!40000 ALTER TABLE `schools` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2024-11-06 22:40:28
