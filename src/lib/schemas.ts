import { z } from "zod";
import { OCCASIONS } from "./style/types";

export const RestrictionsSchema = z.object({
  one_outfit: z.boolean().optional(),
  only_with: z.array(z.string()).optional(),
  set_with: z.string().optional(),
  occasion: z.array(z.enum(OCCASIONS)).optional(),
  not_with_tailoring: z.boolean().optional(),
  never_with: z.array(z.string()).optional(),
});
