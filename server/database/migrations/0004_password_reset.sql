-- Réinitialisation de mot de passe.
--
-- Deux choses, indissociables.
--
-- 1. `password_reset` porte les demandes en cours. Elle ne stocke JAMAIS le
--    jeton envoyé par e-mail, seulement son empreinte SHA-256 : quelqu'un qui
--    lirait la table ne pourrait pas s'en servir pour prendre un compte. Le
--    jeton n'existe en clair que dans le message, et dans le lien cliqué.
--
-- 2. `users.password_changed_at` date le dernier changement. Sans elle, une
--    réinitialisation ne servirait à rien dans le cas qui compte : celui où
--    quelqu'un d'autre est déjà connecté. Il garderait sa session sept jours
--    malgré le nouveau mot de passe. Les jetons émis avant cette date sont
--    désormais refusés.

CREATE TABLE IF NOT EXISTS `password_reset` (
  -- Empreinte du jeton, jamais le jeton. 64 caractères hexadécimaux.
  `token_hash` char(64) NOT NULL,
  `users_id` int NOT NULL,
  `expires_at` datetime NOT NULL,
  -- Renseignée à l'usage : un lien ne sert qu'une fois.
  `used_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`token_hash`),
  -- Une nouvelle demande annule les précédentes : on les retrouve par ce
  -- chemin. Le nettoyage des lignes périmées balaie par date.
  KEY `password_reset_users_id` (`users_id`),
  KEY `password_reset_expires_at` (`expires_at`),
  CONSTRAINT `password_reset_users_id_fk`
    FOREIGN KEY (`users_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE `users`
  ADD COLUMN `password_changed_at` datetime DEFAULT NULL;
