-- Compteur de numéros de facture, par année.
--
-- Le numéro était jusqu'ici déduit d'un `COUNT(*)` sur `booking` :
--   SELECT COUNT(*) FROM booking WHERE bills_number LIKE '2026-%'
-- puis `count + 1`. Trois défauts, tous silencieux :
--   1. deux paiements simultanés comptent la même valeur et émettent deux
--      fois le même numéro de facture ;
--   2. supprimer une réservation fait REVENIR un numéro déjà utilisé ;
--   3. le compte est proportionnel au nombre de factures — de plus en plus
--      lent, et il balaie toute la table faute d'index sur le motif.
--
-- Une table dédiée règle les trois : l'upsert incrémente sous verrou de
-- ligne, la lecture se fait dans la même transaction, et une facture
-- supprimée ne libère jamais son numéro.
--
-- Migration additive : aucune donnée existante n'est lue, modifiée ni
-- détruite. Les numéros déjà émis (`FAC-2026-xxxx` du seed) ne suivent pas
-- ce format et ne sont pas concernés.

CREATE TABLE IF NOT EXISTS `invoice_counter` (
  `year` int NOT NULL,
  `last` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
