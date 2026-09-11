export const orderStatuses = [
  "DRAFT",
  "VALIDATED",
  "RESERVED",
  "RELEASED",
  "IN_EXECUTION",
  "COMPLETED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  DRAFT: ["VALIDATED", "CANCELLED"],
  VALIDATED: ["RESERVED", "CANCELLED"],
  RESERVED: ["RELEASED", "CANCELLED"],
  RELEASED: ["IN_EXECUTION", "CANCELLED"],
  IN_EXECUTION: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return transitions[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new DomainError("INVALID_STATE_TRANSITION", `No se puede cambiar una orden de ${from} a ${to}.`, 409);
  }
}

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

