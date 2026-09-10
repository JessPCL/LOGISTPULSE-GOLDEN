import { Router } from "express";
import { dashboardRouter } from "./dashboard.js";
import { integrationRouter } from "./integration.js";
import { inventoryRouter } from "./inventory.js";
import { materialsRouter } from "./materials.js";
import { movementsRouter } from "./movements.js";
import { ordersRouter } from "./orders.js";

export const apiRouter = Router();

apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/materials", materialsRouter);
apiRouter.use("/inventory", inventoryRouter);
apiRouter.use("/orders", ordersRouter);
apiRouter.use("/movements", movementsRouter);
apiRouter.use("/integration", integrationRouter);

