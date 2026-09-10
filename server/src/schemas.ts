import { z } from "zod";

export const createOrderSchema = z.object({
  plantCode: z.string().min(1).default("PLANTA-QUITO"),
  priority: z.enum(["CRITICAL", "HIGH", "NORMAL", "LOW"]).default("NORMAL"),
  dueAt: z.iso.datetime().optional(),
  createdBy: z.email().default("operador@pulse.local"),
  items: z.array(z.object({
    lineNumber: z.number().int().positive(),
    materialCode: z.string().min(1).max(30),
    quantity: z.number().positive(),
    sourceLocation: z.string().min(1).max(30),
    destinationLocation: z.string().min(1).max(30),
  }).refine((item) => item.sourceLocation !== item.destinationLocation, {
    message: "El origen y el destino deben ser diferentes.",
  })).min(1).max(50),
});

export const actorSchema = z.string().min(3).max(120);

