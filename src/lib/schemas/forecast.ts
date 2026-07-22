import { z } from "zod";

export const SCENARIOS = ["optimistic", "realistic", "conservative"] as const;
export type Scenario = (typeof SCENARIOS)[number];

export const forecastSettingsSchema = z.object({
  forecastHorizonMonths: z.union([z.literal(3), z.literal(6), z.literal(12), z.literal(24)]).default(6),
  forecastScenario: z.enum(SCENARIOS).default("realistic"),
  forecastOptimisticPct: z.coerce.number().int().min(0).max(50).default(15),
  forecastConservativePct: z.coerce.number().int().min(0).max(50).default(15),
  forecastVariableWindow: z.union([z.literal(3), z.literal(6), z.literal(12)]).default(6),
  forecastStartBalanceCents: z.coerce.bigint().nullable().default(null),
});

// z.input (não z.infer/z.output): todos os campos têm .default(), então o tipo
// que `defineAction` infere para o handler deve ser o INPUT (campos opcionais).
// Ver skill server-actions e dashboard-layout.ts.
export type ForecastSettingsInput = z.input<typeof forecastSettingsSchema>;
export type ForecastSettings = z.output<typeof forecastSettingsSchema>;
