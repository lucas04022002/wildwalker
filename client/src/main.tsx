import type { ReactNode } from "react";
import ReactDOM from "react-dom/client";
import type { RouteObject } from "react-router";
import { RouterProvider, createBrowserRouter } from "react-router";
import App from "./App";
import Confirmation from "./components/Confirmation/Confirmation";
import RequireRole from "./components/RequireRole";
import { SessionProvider } from "./context/SessionProvider";

import DashboardAdminPage from "./pages/DashboardAdminPage/DashboardAdminPage";
import DashboardClientPage from "./pages/DashboardClientPage/DashboardClientPage";
import Events from "./pages/Events/Events";
import Home from "./pages/Home/Home";
import InvoicePage from "./pages/InvoicePage/InvoicePage";
import LogIn from "./pages/Login/Login";
import Payment from "./pages/Payment/Payment";
import Spaces from "./pages/Spaces/Spaces";
import WorkshopPage from "./pages/WorkshopPage/WorkshopPage";
import Cart from "./pages/cart/Cart";
import SignIn from "./pages/signIn/SignIn";

/**
 * Enveloppe une page dans la garde de rôle.
 *
 * Le rôle passe par une variable plutôt que par un attribut littéral : le nom
 * de la prop (`role`) fait sinon croire à Biome qu'il s'agit de l'attribut
 * ARIA du même nom, et la règle `a11y/useValidAriaRole` se déclenche à tort.
 */
const guarded = (role: "client" | "admin", page: ReactNode) => (
  <RequireRole role={role}>{page}</RequireRole>
);

/**
 * Table des routes, exportée pour que les tests puissent vérifier que les
 * pages protégées le sont réellement, sans monter toute l'application.
 */
export const routes: RouteObject[] = [
  {
    path: "/invoice/:bookingId",
    element: guarded("client", <InvoicePage />),
  },
  {
    element: <App />,
    children: [
      {
        path: "/",
        element: <Home />,
      },
      {
        path: "/espaces",
        element: <Spaces />,
      },
      {
        path: "/evenements",
        element: <Events />,
      },
      {
        path: "/dashboard-client",
        element: guarded("client", <DashboardClientPage />),
      },
      {
        path: "/cart",
        element: guarded("client", <Cart />),
      },
      {
        path: "/dashboard-admin",
        element: guarded("admin", <DashboardAdminPage />),
      },
      {
        path: "/workshop-page",
        element: <WorkshopPage />,
      },
      {
        path: "/payment",
        element: guarded("client", <Payment />),
      },
      {
        path: "/confirmation",
        element: guarded("client", <Confirmation />),
      },
      {
        path: "/log-in",
        element: <LogIn />,
      },
      {
        path: "/sign-in",
        element: <SignIn />,
      },
    ],
  },
];

const router = createBrowserRouter(routes);

const rootElement = document.getElementById("root");

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>,
  );
}
