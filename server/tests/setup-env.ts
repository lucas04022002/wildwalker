/**
 * Variables d'environnement des tests unitaires.
 *
 * Aucune valeur réelle ici : la base est mockée, Stripe est mocké, et le
 * secret JWT est une chaîne de test jetable propre au processus jest.
 */

process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "jwt-secret-de-test";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d";
process.env.CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:3000";
process.env.STRIPE_SECRET_KEY =
  process.env.STRIPE_SECRET_KEY ?? "sk_test_valeur_factice";
