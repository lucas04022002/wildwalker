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
import ForgotPassword from "./pages/PasswordReset/ForgotPassword";
import ResetPassword from "./pages/PasswordReset/ResetPassword";
import Payment from "./pages/Payment/Payment";
import Spaces from "./pages/Spaces/Spaces";
import WorkshopPage from "./pages/WorkshopPage/WorkshopPage";
import Cart from "./pages/cart/Cart";
import SignIn from "./pages/signIn/SignIn";

/**
 * Table des routes, exportée pour que les tests puissent vérifier que les
 * pages protégées le sont réellement, sans monter toute l'application.
 */
export const routes: RouteObject[] = [
  {
    path: "/invoice/:bookingId",
    element: (
      <RequireRole requiredRole="client">
        <InvoicePage />
      </RequireRole>
    ),
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
        element: (
          <RequireRole requiredRole="client">
            <DashboardClientPage />
          </RequireRole>
        ),
      },
      {
        path: "/cart",
        element: (
          <RequireRole requiredRole="client">
            <Cart />
          </RequireRole>
        ),
      },
      {
        path: "/dashboard-admin",
        element: (
          <RequireRole requiredRole="admin">
            <DashboardAdminPage />
          </RequireRole>
        ),
      },
      {
        path: "/workshop-page",
        element: <WorkshopPage />,
      },
      {
        path: "/payment",
        element: (
          <RequireRole requiredRole="client">
            <Payment />
          </RequireRole>
        ),
      },
      {
        path: "/confirmation",
        element: (
          <RequireRole requiredRole="client">
            <Confirmation />
          </RequireRole>
        ),
      },
      {
        path: "/log-in",
        element: <LogIn />,
      },
      {
        path: "/sign-in",
        element: <SignIn />,
      },
      // Publiques par nécessité : quelqu'un qui a perdu son mot de passe ne
      // peut pas s'authentifier pour le changer.
      {
        path: "/mot-de-passe-oublie",
        element: <ForgotPassword />,
      },
      {
        path: "/reinitialiser-mot-de-passe",
        element: <ResetPassword />,
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
