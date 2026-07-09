import { IncidentEventType, IncidentStatus, Severity } from "@prisma/client";
import { z } from "zod";

const isoDateString = z
  .string()
  .min(1)
  .transform((value) => new Date(value))
  .refine((date) => !Number.isNaN(date.getTime()), {
    message: "Data inválida.",
  });

export const listIncidentsQuerySchema = z.object({
  app: z.string().optional(),
  status: z
    .nativeEnum(IncidentStatus)
    .or(z.string().transform((value) => value.toUpperCase() as IncidentStatus))
    .optional(),
  severity: z
    .nativeEnum(Severity)
    .or(z.string().transform((value) => value.toUpperCase() as Severity))
    .optional(),
  from: isoDateString.optional(),
  to: isoDateString.optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().nullish(),
});

const linksSchema = z
  .record(z.string().trim().min(1), z.string().url())
  .optional();

const optionalInt = (min?: number, max?: number) => {
  const base = z
    .union([z.number(), z.string()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === null) {
        return undefined;
      }
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
          return undefined;
        }
        const parsed = Number(trimmed);
        if (!Number.isFinite(parsed)) {
          throw new Error("Número inválido.");
        }
        return parsed;
      }
      return value;
    });

  const integerChecked = base.refine(
    (value) => value === undefined || Number.isInteger(value),
    "Valor deve ser inteiro.",
  );

  const withMin =
    typeof min === "number"
      ? integerChecked.refine(
          (value) => value === undefined || value >= min,
          `Valor deve ser maior ou igual a ${min}.`,
        )
      : integerChecked;

  return typeof max === "number"
    ? withMin.refine(
        (value) => value === undefined || value <= max,
        `Valor deve ser menor ou igual a ${max}.`,
      )
    : withMin;
};

const optionalString = z.string().trim().min(1).optional();

export const createIncidentSchema = z.object({
  title: z.string().trim().min(3),
  description: z.string().trim().min(3),
  severity: z.nativeEnum(Severity),
  status: z.nativeEnum(IncidentStatus).default(IncidentStatus.ATIVO),
  impact: z.string().trim().optional(),
  scope: z.string().trim().optional(),
  owner: z.string().trim().optional(),
  sanv2Code: optionalString,
  country: optionalString,
  dayNumber: optionalInt(1, 31),
  monthNumber: optionalInt(1, 12),
  yearNumber: optionalInt(1900, 2100),
  solutionType: optionalString,
  cause: optionalString,
  resolution: optionalString,
  produtosOkr: optionalString,
  coreSystems: optionalString,
  solver: optionalString,
  ordersAffected: optionalString,
  financialImpact: optionalString,
  rca: optionalString,
  durationHoursReported: optionalInt(0),
  durationMinutesReported: optionalInt(0, 59),
  totalMinutesReported: optionalInt(0),
  applications: z.array(z.string().trim().min(1)).min(1),
  startedAt: z.coerce.date(),
  resolvedAt: z.coerce.date().optional(),
  links: linksSchema,
});

export const updateIncidentSchema = createIncidentSchema.partial();

export const incidentEventSchema = z.object({
  type: z.nativeEnum(IncidentEventType),
  message: z.string().trim().min(2),
  public: z.boolean().optional().default(true),
  createdAt: z.coerce.date().optional(),
});

export const incidentTransitionSchema = z.object({
  status: z.nativeEnum(IncidentStatus),
});

export type ListIncidentsFilters = z.infer<typeof listIncidentsQuerySchema>;
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;
export type IncidentEventInput = z.infer<typeof incidentEventSchema>;
export type IncidentTransitionInput = z.infer<typeof incidentTransitionSchema>;
