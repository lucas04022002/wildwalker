import express from "express";

import { upload } from "../public/upload/upload";
import authMiddleware from "./Middlewares/authMiddleware";
import cartMiddleware from "./Middlewares/cartMiddleware";
import eventMiddleware from "./Middlewares/eventMiddleware";
import { loginLimiter, registerLimiter } from "./Middlewares/rateLimit";
import authActions from "./modules/Authentification/AuthentificationAction";
import paymentActions from "./modules/Payment/PaymentAction";
import activityActions from "./modules/activity/activityActions";
import bookingActions from "./modules/bookingActions/bookingActions";
import cartActions from "./modules/cart/cartAction";
import createEventFormAction from "./modules/createEventForm/createEventFormAction";
import dasboardAdminActions from "./modules/dashboardAdmin/dashboardAdminActions";
import dashboardClientActions from "./modules/dashboardClient/dashboardClientActions";
import eventActions from "./modules/event/eventActions";
import healthActions from "./modules/health/healthActions";
import spaceActions from "./modules/space/spaceActions";
import timeSlotActions from "./modules/timeSlot/timeSlotActions";

const router = express.Router();

/* ************************************************************************* */
// Santé (publique)
/* ************************************************************************* */

// Première route du routeur : elle doit répondre même si tout le reste est
// en peine. Utilisée par le HEALTHCHECK du conteneur et par la CI.
router.get("/api/health", healthActions.check);

/* ************************************************************************* */
// Auth routes (publiques)
/* ************************************************************************* */
router.post("/api/auth/register", registerLimiter, authActions.register);
router.post("/api/auth/login/client", loginLimiter, authActions.loginClient);
router.post("/api/auth/login/admin", loginLimiter, authActions.loginAdmin);
router.post("/api/auth/logout", authActions.logout);
router.get("/api/auth/me", authMiddleware.requireAuth, authActions.me);

/* ************************************************************************* */
// Time slots (public)
/* ************************************************************************* */
router.get("/api/timeslots", timeSlotActions.browse);

/* ************************************************************************* */
// Spaces (public)
/* ************************************************************************* */
router.get("/api/spaces", spaceActions.browse);
router.get("/api/spaces/:id/availability", spaceActions.readAvailability);

/* ************************************************************************* */
// Events (public)
/* ************************************************************************* */
router.get("/api/events", eventActions.browseUpcomingEvents);
router.get("/api/events/participants", eventActions.browseParticipantsToEvent);
router.get(
  "/api/events/:date",
  eventMiddleware.validateEventsDate,
  eventActions.readEventsOfTheDay,
);

// Events (protégé client)

// book an event : process the price with body.quantity
router.post(
  "/api/events/:id",
  authMiddleware.requireAuth,
  eventActions.processTotalPrice,
);

/* ************************************************************************* */
// Dashboard Client (protégé client)
/* ************************************************************************* */

// Invoice
router.get(
  "/api/invoice/:bookingId",
  authMiddleware.requireAuth,
  dashboardClientActions.readInvoice,
);

// *************************************************************************
// Event requests (client) - Before :userID road
router.get(
  "/api/dashboard/client/event-requests",
  authMiddleware.requireAuth,
  dashboardClientActions.browseEventRequests,
);

router.post(
  "/api/dashboard/client/event-requests",
  authMiddleware.requireAuth,
  // `upload` d'abord : sans lui le corps multipart n'est pas encore lu, et
  // le schéma validerait un objet vide.
  upload.single("image"),
  eventMiddleware.validateEventRequest,
  dashboardClientActions.addEventRequest,
);
// *************************************************************************

// 1.past events the user attended
router.get(
  "/api/dashboard/client/:userId/events/past",
  authMiddleware.requireAuth,
  dashboardClientActions.browsePastEvents,
);

router.get(
  "/api/dashboard/client/:userId/events/upcoming",
  authMiddleware.requireAuth,
  dashboardClientActions.browseUpcomingEvents,
);

router.get(
  "/api/dashboard/client/:userId/bookings/past",
  authMiddleware.requireAuth,
  dashboardClientActions.browseOldBookings,
);

router.get(
  "/api/dashboard/client/:userId/bookings/upcoming",
  authMiddleware.requireAuth,
  dashboardClientActions.browseUpcomingBookings,
);

router.get(
  "/api/dashboard/client/:userId/billing",
  authMiddleware.requireAuth,
  dashboardClientActions.browseBookingHistory,
);

router.get(
  "/api/dashboard/client/:userId/stats",
  authMiddleware.requireAuth,
  dashboardClientActions.browseStats,
);

router.post(
  "/api/dashboard/client/:userId/claims",
  authMiddleware.requireAuth,
  dashboardClientActions.addClaim,
);

/* ************************************************************************* */
// Dashboard Admin (protégé admin)
/* ************************************************************************* */

router.get(
  "/api/dashboard/admin/stats",
  authMiddleware.requireAdmin,
  dasboardAdminActions.browseAdminStats,
);
router.get(
  "/api/dashboard/admin/occupancy-trend",
  authMiddleware.requireAdmin,
  dasboardAdminActions.browseAdminOccupancyTrend,
);

router.get(
  "/api/dashboard/admin/bookings",
  authMiddleware.requireAdmin,
  dasboardAdminActions.browseAdminBookings,
);

router.get(
  "/api/dashboard/admin/claims",
  authMiddleware.requireAdmin,
  dasboardAdminActions.browseClaims,
);

router.get(
  "/api/dashboard/admin/event-requests",
  authMiddleware.requireAdmin,
  dasboardAdminActions.browseAdminEventRequests,
);
// patch = partial update
router.patch(
  "/api/dashboard/admin/event-requests/:activityId",
  authMiddleware.requireAdmin,
  dasboardAdminActions.updateEventRequest,
);

/* ************************************************************************* */
// Panier (protégé client)
/* ************************************************************************* */

// Le panier est celui du jeton : plus de `:userId` dans l'URL.
router.get("/api/cart", authMiddleware.requireAuth, cartActions.browse);

// add an event into cart
router.post(
  "/api/cart",
  authMiddleware.requireAuth,
  cartMiddleware.validateAddEventCart,
  cartActions.addEvent,
);

//update a cart item
router.patch(
  "/api/cart/:id",
  authMiddleware.requireAuth,
  cartMiddleware.validateUpdateCart,
  cartActions.edit,
);

// delete an item into cart
router.delete(
  "/api/cart/:id",
  authMiddleware.requireAuth,
  cartMiddleware.validateDeleteItem,
  cartActions.destroy,
);

/* ************************************************************************* */
// Create Event (protégé admin)
/* ************************************************************************* */

router.get(
  "/api/createEvent",
  authMiddleware.requireAdmin,
  createEventFormAction.browse,
);
router.post(
  "/api/createEvent",
  authMiddleware.requireAdmin,
  upload.single("image"),
  createEventFormAction.create,
);

/* ************************************************************************* */
// Payment (protégé client)
/* ************************************************************************* */

router.post(
  "/api/payment/create-intent",
  authMiddleware.requireAuth,
  paymentActions.createIntent,
);

/* ************************************************************************* */
// Define booking-related routes
/* ************************************************************************* */

// insert activity booked into cart table and activity table
router.post("/api/bookings", authMiddleware.requireAuth, bookingActions.add);

// insert cart content into boooking table
router.post("/api/booking", authMiddleware.requireAuth, bookingActions.create);

/* ************************************************************************* */
// Workshop
/* ************************************************************************* */

router.get("/api/activity", activityActions.browse);

export default router;
