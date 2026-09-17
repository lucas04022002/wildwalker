-- Révocation des sessions.
--
-- Le jeton de session est un JWT : le serveur ne garde aucune trace des
-- sessions ouvertes, et « se déconnecter » ne faisait qu'effacer le cookie du
-- navigateur. Un jeton capturé restait valable jusqu'à son expiration, sept
-- jours plus tard, et se déconnecter d'un poste partagé ne protégeait de rien.
--
-- Cette table porte les jetons explicitement révoqués. Elle ne grandit qu'aux
-- déconnexions, et chaque ligne devient inutile passé `expires_at` : au-delà,
-- la signature ne vaut plus rien par elle-même. Le nettoyage est fait par
-- l'application, sans tâche planifiée à installer.

CREATE TABLE IF NOT EXISTS `revoked_session` (
  -- L'identifiant unique du jeton (`jti`), tiré au hasard à la signature.
  `jti` varchar(64) NOT NULL,
  -- Fin de validité du jeton révoqué : la ligne peut être effacée après.
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`jti`),
  -- Le nettoyage balaie par date : sans cet index il lirait toute la table.
  KEY `revoked_session_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
