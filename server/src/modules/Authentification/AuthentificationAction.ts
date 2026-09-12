import argon2 from "argon2";
import type { RequestHandler } from "express";
import authRepository from "./AuthentificationRepository";
import jwtUtil from "./Jwt";

const SALT_ROUNDS = 12;

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

    const token = jwtUtil.signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      firstname: user.firstname,
    });

    res.status(201).json({ token, user });
  } catch (err) {
    next(err);
  }
};

// Logique de connexion partagée, restreinte à un rôle attendu ("client" ou "admin")
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
    res.status(403).json({
      message:
        expectedRole === "admin"
          ? "Ce compte n'a pas les droits administrateur."
          : "Veuillez utiliser l'espace Admin pour vous connecter.",
    });
    return;
  }

  const { password: _password, ...safeUser } = user;
  const token = jwtUtil.signToken({
    id: user.id,
    email: user.email,
    role: user.role,
    firstname: user.firstname,
  });

  res.status(200).json({ token, user: safeUser });
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

export default { register, loginClient, loginAdmin, me };
