import { z } from "zod";

export const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export const MEALS = ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner"] as const;
export const DAY_LABEL: Record<(typeof DAYS)[number], string> = {
  monday: "Lunes", tuesday: "Martes", wednesday: "Miércoles", thursday: "Jueves",
  friday: "Viernes", saturday: "Sábado", sunday: "Domingo",
};
export const MEAL_LABEL: Record<(typeof MEALS)[number], string> = {
  breakfast: "Desayuno", morning_snack: "Media mañana", lunch: "Almuerzo",
  afternoon_snack: "Media tarde", dinner: "Cena",
};

// Mantener sincronizado con supabase/functions/generate_nutrition_plan/index.ts
const meal = z.object({ name: z.string().min(1), description: z.string(), calories: z.number().nonnegative() });
const day = z.object(Object.fromEntries(MEALS.map((m) => [m, meal])) as Record<(typeof MEALS)[number], typeof meal>);

export const planSchema = z.object({
  calories_target: z.number().int().positive(),
  protein_g: z.number().int().nonnegative(),
  carbs_g: z.number().int().nonnegative(),
  fat_g: z.number().int().nonnegative(),
  reasoning: z.string(),
  weekly_plan: z.object(Object.fromEntries(DAYS.map((d) => [d, day])) as Record<(typeof DAYS)[number], typeof day>),
  shopping_list: z.array(z.object({ item: z.string(), quantity: z.string() })),
  sport_recommendations: z.string(),
  timing: z.object({ pre_workout: z.string(), during: z.string(), post_workout: z.string() }),
});

export type Plan = z.infer<typeof planSchema>;
