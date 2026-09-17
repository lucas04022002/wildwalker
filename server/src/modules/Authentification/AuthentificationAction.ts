import argon2 from "argon2";
import type { RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import authRepository from "./AuthentificationRepository";
import jwtUtil, { COOKIE_NAME, SESSION_DURATION_MS } from "./Jwt";
import sessionRepository from "./SessionRepository";

/**
 * Pose le cookie de session. Le jeton ne quitte jamais l'en-tête `Set-Cookie` :
 * il n'est pas renvoyé dans le corps de la réponse, donc pas stockable en
 * `localStorage` par le client.
 */
const openSession = (
  res: Response,
  user: { id: number; email: string; role: string; firstname: string },
): void => {
  const token = jwtUtil.signToken({
    id: user.id,
    email: user.email,
    role: user.role,
    firstname: user.firstname,
  });

  res.cookie(COOKIE_NAME, token, jwtUtil.cookieOptions());
};

/**
 * Hash factice, vérifié quand l'adresse est inconnue.
 *
 * Sans lui, un compte inexistant répond bien plus vite qu'un mot de passe
 * faux (argon2 n'est pas appelé), et ce simple écart de temps suffit à
 * énumérer les comptes. Ce n'est pas un secret : c'est le hash d'une chaîne
 * aléatoire que personne ne connaît, et dont la valeur n'a aucune importance.
 */
const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$9rkGhYTbImsSsSjIU05vtA$EjJgdKggaFEAPn+mQOGMtXSEHL4hg4Kll2ooTXv7iCc";

/**
 * Réponse unique de l'inscription.
 *
 * Elle est identique que l'adresse soit libre ou déjà prise : un formulaire
 * public qui répond « ce compte existe déjà » est un outil d'énumération.
 * Le conflit est seulement noté côté serveur.
 */
const REGISTER_ACCEPTED =
  "Si l'adresse e-mail et le numéro de téléphone sont disponibles, le compte est créé.";

/**
 * Doublon détecté par la base plutôt que par la vérification préalable.
 *
 * Le contrôle `findByEmail` / `findByPhone` couvre le cas courant, mais deux
 * inscriptions simultanées sur le même e-mail passent toutes les deux le
 * contrôle avant que l'une n'insère. Sans ce filet, la seconde ressort en 500
 * — et ce 500 rouvre exactement le canal d'énumération que la réponse neutre
 * ferme. On répond donc comme si de rien n'était.
 */
const isDuplicateEntry = (err: unknown): boolean => {
  if (typeof err !== "object" || err === null) return false;

  const { code, errno } = err as { code?: unknown; errno?: unknown };
  return code === "ER_DUP_ENTRY" || errno === 1062;
};

// Inscription : crée toujours un compte avec le role "client"
const register: RequestHandler = async (req, res, next) => {
  try {
    const { firstname, lastname, email, password, phone_number, city, adress } =
      req.body;

    if (!firstname || !lastname || !email || !password || !phone_number) {
      res.status(400).json({ message: "Champs obligatoires manquants." });
      return;
    }

    // Le hachage a lieu dans les deux cas : même travail, même temps de
    // réponse, que l'adresse existe ou non.
    const passwordHash = await argon2.hash(password);

    // Les deux colonnes UNIQUE de la table sont interrogées, et en parallèle :
    // séquentiellement, un e-mail libre coûterait une requête de moins qu'un
    // e-mail pris, et cet écart se mesure.
    const [byEmail, byPhone] = await Promise.all([
      authRepository.findByEmail(email),
      authRepository.findByPhone(phone_number),
    ]);

    if (byEmail || byPhone) {
      // Le journal ne dit pas lequel des deux : il n'a pas à porter une
      // information que la réponse refuse de donner.
      console.info("Inscription refusée : identifiant déjà utilisé.");
      res.status(201).json({ message: REGISTER_ACCEPTED });
      return;
    }

    let user: Awaited<ReturnType<typeof authRepository.create>>;

    try {
      user = await authRepository.create({
        firstname,
        lastname,
        email,
        passwordHash,
        phone_number,
        city,
        adress,
      });
    } catch (err) {
      if (!isDuplicateEntry(err)) throw err;

      console.info("Inscription refusée : doublon détecté à l'insertion.");
      res.status(201).json({ message: REGISTER_ACCEPTED });
      return;
    }

    if (!user) {
      res
        .status(500)
        .json({ message: "Erreur lors de la création du compte." });
      return;
    }

    // Aucune session ouverte ici : le corps de la réponse doit être le même
    // dans les deux cas, en-têtes compris. L'utilisateur se connecte ensuite.
    res.status(201).json({ message: REGISTER_ACCEPTED });
  } catch (err) {
    next(err);
  }
};

/**
 * Connexion, restreinte à un rôle attendu ("client" ou "admin").
 *
 * Mot de passe faux, compte inexistant ou mauvais rôle renvoient tous la
 * même réponse 401 : le login client ne sert donc pas à découvrir quelles
 * adresses sont celles d'administrateurs.
 */
const loginWithRole = async (
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1],
  expectedRole: "client" | "admin",
) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: "Email et mot de passe requis." });
    return;
  }

  const invalidCredentials = () =>
    res.status(401).json({ message: "Email ou mot de passe incorrect." });

  const user = await authRepository.findByEmail(email);
  if (!user) {
    // Vérification contre un hash factice : même coût de calcul que pour un
    // compte réel, donc aucun écart de temps à mesurer.
    await argon2.verify(DUMMY_PASSWORD_HASH, password);
    invalidCredentials();
    return;
  }

  const passwordMatches = await argon2.verify(user.password, password);
  if (!passwordMatches) {
    invalidCredentials();
    return;
  }

  if (user.role !== expectedRole) {
    invalidCredentials();
    return;
  }

  const { password: _password, ...safeUser } = user;

  openSession(res, user);
  res.status(200).json({ user: safeUser });
};

const loginClient: RequestHandler = async (req, res, next) => {
  try {
    await loginWithRole(req, res, "client");
  } catch (err) {
    next(err);
  }
};

const loginAdmin: RequestHandler = async (req, res, next) => {
  try {
    await loginWithRole(req, res, "admin");
  } catch (err) {
    next(err);
  }
};

/**
 * Ferme la session : le jeton est révoqué, puis le cookie effacé.
 *
 * L'ordre compte. Effacer le cookie d'abord et échouer ensuite laisserait un
 * jeton vivant que le navigateur a oublié mais qu'un autre peut rejouer. On
 * révoque donc d'abord, et une révocation impossible est une déconnexion
 * ratée, pas une déconnexion silencieuse.
 *
 * Un jeton illisible, expiré, ou signé avant l'arrivée du `jti` : rien à
 * révoquer, on efface le cookie et c'est tout.
 */
const logout: RequestHandler = async (req, res, next) => {
  const { maxAge: _maxAge, ...options } = jwtUtil.cookieOptions();
  const token = req.cookies?.[COOKIE_NAME];

  if (typeof token === "string" && token !== "") {
    try {
      const payload = jwtUtil.verifyToken(token);

      if (payload.jti != null) {
        // `exp` est en secondes ; sans lui, on retombe sur la durée nominale.
        const expiresAt =
          payload.exp != null
            ? new Date(payload.exp * 1000)
            : new Date(Date.now() + SESSION_DURATION_MS);

        await sessionRepository.revoke(payload.jti, expiresAt);
      }
    } catch (err) {
      // Jeton illisible ou expiré : il n'y a rien à révoquer.
      if (
        !(
          err instanceof jwt.JsonWebTokenError ||
          err instanceof jwt.TokenExpiredError
        )
      ) {
        next(err);
        return;
      }
    }
  }

  res.clearCookie(COOKIE_NAME, options);
  res.sendStatus(204);
};

// Profil de l'utilisateur connecté (req.user injecté par le middleware requireAuth)
const me: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: "Authentification requise." });
      return;
    }

    const user = await authRepository.findById(userId);
    if (!user) {
      res.status(404).json({ message: "Utilisateur introuvable." });
      return;
    }

    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
};

export default { register, loginClient, loginAdmin, logout, me };
export { DUMMY_PASSWORD_HASH, REGISTER_ACCEPTED, isDuplicateEntry };
