-- WildWalker — schéma initial (DDL seul, aucune donnée, aucune destruction).
--
-- Ce fichier est joué une seule fois par `npm run db:migrate`, puis noté dans
-- `schema_migrations`. Toutes les tables sont créées en `IF NOT EXISTS` :
-- rejouer le fichier sur une base déjà migrée ne casse rien.
--
-- Corrections apportées au schéma d'origine (schema.sql) :
--   1. colonne `users.fortgot_password` supprimée (jamais lue, jamais remplie) ;
--   2. `claim.claim_date` passe de VARCHAR(100) à DATE ;
--   3. `activity.price_unit` passe de INT à DECIMAL(10,2) ;
--   4. clé étrangère ajoutée : `activity.users_id` -> `users.id` ;
--   5. clé étrangère ajoutée : `booking.id_activity` -> `activity.id`.

CREATE TABLE IF NOT EXISTS `space` (
  `id` int NOT NULL AUTO_INCREMENT,
  `space_name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `capacity` int NOT NULL,
  `url_image` varchar(255) NOT NULL,
  `price_unit` decimal(10,2) NOT NULL,
  `space_type` varchar(45) NOT NULL,
  `space_category` varchar(50) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `time_slot` (
  `id` int NOT NULL AUTO_INCREMENT,
  `slot` varchar(255) NOT NULL,
  `start_hour` time NOT NULL,
  `end_hour` time NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `phone_number` varchar(45) NOT NULL,
  `email` varchar(150) NOT NULL,
  `lastname` varchar(150) NOT NULL,
  `password` varchar(255) NOT NULL,
  `city` varchar(150) DEFAULT NULL,
  `adress` varchar(255) DEFAULT NULL,
  `role` varchar(20) NOT NULL,
  `profile_image` text,
  `firstname` varchar(150) NOT NULL,
  `signing_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email_UNIQUE` (`email`),
  UNIQUE KEY `phone_number_UNIQUE` (`phone_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `activity` (
  `id` int NOT NULL AUTO_INCREMENT,
  `time_slot_id` int NOT NULL,
  `space_id` int NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `description` text,
  `price_unit` decimal(10,2) NOT NULL DEFAULT '0.00',
  `url_image` varchar(255) DEFAULT NULL,
  `name` varchar(155) DEFAULT NULL,
  `users_id` int DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'approved',
  PRIMARY KEY (`id`),
  KEY `fk_time_slot_has_space_space_idx` (`space_id`),
  KEY `fk_time_slot_has_space_time_slot_idx` (`time_slot_id`),
  KEY `fk_activity_users_idx` (`users_id`),
  CONSTRAINT `fk_time_slot_has_space_space` FOREIGN KEY (`space_id`) REFERENCES `space` (`id`),
  CONSTRAINT `fk_time_slot_has_space_time_slot` FOREIGN KEY (`time_slot_id`) REFERENCES `time_slot` (`id`),
  CONSTRAINT `fk_activity_users` FOREIGN KEY (`users_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `booking` (
  `id` int NOT NULL AUTO_INCREMENT,
  `users_id` int NOT NULL,
  `bills_number` varchar(45) NOT NULL,
  `quantity` int NOT NULL,
  `total_price` decimal(10,2) NOT NULL,
  `id_activity` int NOT NULL,
  `payment_status` varchar(20) NOT NULL DEFAULT 'paid',
  PRIMARY KEY (`id`),
  UNIQUE KEY `bills_number_UNIQUE` (`bills_number`),
  KEY `fk_booking_users_idx` (`users_id`),
  KEY `fk_booking_activity_idx` (`id_activity`),
  CONSTRAINT `fk_booking_users` FOREIGN KEY (`users_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_booking_activity` FOREIGN KEY (`id_activity`) REFERENCES `activity` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cart` (
  `id` int NOT NULL AUTO_INCREMENT,
  `quantity` int DEFAULT NULL,
  `total_price` decimal(10,2) DEFAULT NULL,
  `price_unit` decimal(10,2) DEFAULT NULL,
  `users_id` int NOT NULL,
  `id_activity` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_cart_users_idx` (`users_id`),
  CONSTRAINT `fk_cart_users` FOREIGN KEY (`users_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `claim` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(100) NOT NULL,
  `category` varchar(150) NOT NULL,
  `message` text NOT NULL,
  `claim_date` date NOT NULL,
  `users_id` int NOT NULL,
  `activity_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_claim_users_idx` (`users_id`),
  KEY `fk_claim_activity_idx` (`activity_id`),
  CONSTRAINT `fk_claim_activity` FOREIGN KEY (`activity_id`) REFERENCES `activity` (`id`),
  CONSTRAINT `fk_claim_users` FOREIGN KEY (`users_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
