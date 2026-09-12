import argon2 from "argon2";
import type { RequestHandler, Response } from "express";
import authRepository from "./AuthentificationRepository";
import jwtUtil, { COOKIE_NAME } from "./Jwt";

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

// Inscription : crée toujours un compte avec le role "client"
const register: RequestHandler = async (req, res, next) => {
  try {
    const { firstname, lastname, email, password, phone_number, city, adress } =
      req.body;

    if (!firstname || !lastname || !email || !password || !phone_number) {
      res.status(400).json({ message: "Champs obligatoires manquants." });
      return;
    }

    const existing = await authRepository.findByEmail(email);
    if (existing) {
      res
        .status(409)
        .json({ message: "Un compte existe déjà avec cet email." });
      return;
    }

    const passwordHash = await argon2.hash(password);

    const user = await authRepository.create({
      firstname,
      lastname,
      email,
      passwordHash,
      phone_number,
      city,
      adress,
    });

    if (!user) {
      res
        .status(500)
        .json({ message: "Erreur lors de la création du compte." });
      return;
    }

    openSession(res, user);
    res.status(201).json({ user });
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

/** Ferme la session : le cookie est effacé avec les mêmes attributs. */
const logout: RequestHandler = (_req, res) => {
  const { maxAge: _maxAge, ...options } = jwtUtil.cookieOptions();

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
