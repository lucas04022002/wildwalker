// Ajoute les matchers DOM (toBeInTheDocument, toHaveTextContent...) à `expect`.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Stockage en mémoire conforme à l'interface `Storage`.
 *
 * Node ≥ 22 expose un `localStorage` global inerte (un objet vide, sans
 * méthodes) qui masque celui de jsdom : sans ce remplacement, un test ne peut
 * même pas vérifier que l'application n'écrit rien dedans. L'application, elle,
 * n'a plus rien à y ranger — la session est un cookie httpOnly.
 */
const memoryStorage = (): Storage => {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  } as unknown as Storage;
};

for (const name of ["localStorage", "sessionStorage"] as const) {
  if (typeof globalThis[name]?.setItem !== "function") {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value: memoryStorage(),
    });
  }
}

// Les globales de test ne sont pas exposées (`globals` désactivé) : le nettoyage
// automatique de Testing Library ne peut pas s'enregistrer seul. Sans lui, le
// DOM d'un test reste visible dans le suivant.
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
