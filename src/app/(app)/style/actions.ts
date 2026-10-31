"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { parsePaletteHtml } from "@/lib/style/palette";
import { parseStyleProfile, type StyleConfig } from "@/lib/style/profile";

/**
 * "Update from file": re-import style-profile.md and/or the colour palette
 * (jo_colour_palette.html) as a new active rules version. Whichever file
 * isn't given is carried over from the current version.
 */
export async function importProfileAction(formData: FormData): Promise<{ ok: boolean; message: string }> {
  const { supabase, user } = await requireUser();
  const file = formData.get("file");
  const paletteFile = formData.get("palette");
  const hasMd = file instanceof File && file.size > 0;
  const hasPalette = paletteFile instanceof File && paletteFile.size > 0;
  if (!hasMd && !hasPalette) return { ok: false, message: "Choose style-profile.md, the palette file, or both." };

  const { data: current } = await supabase
    .from("style_rules")
    .select("version, source_md, config")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  let md: string = current?.source_md ?? "";
  let config: StyleConfig | null = (current?.config as StyleConfig | undefined) ?? null;
  if (hasMd) {
    md = await (file as File).text();
    const parsed = parseStyleProfile(md);
    if (!parsed.palette.core.length || !parsed.priorityGaps.length) {
      return { ok: false, message: `That doesn't look like the style profile: ${parsed.parseWarnings.join(" ")}` };
    }
    config = { ...parsed, swatches: config?.swatches };
  }
  if (!config) return { ok: false, message: "Import style-profile.md first." };
  if (hasPalette) {
    const swatches = parsePaletteHtml(await (paletteFile as File).text());
    if (swatches.length < 5) return { ok: false, message: "Couldn't read swatches from that palette file." };
    config = { ...config, swatches };
  }

  const { data: latest } = await supabase
    .from("style_rules")
    .select("version")
    .eq("user_id", user.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = (latest?.version ?? 0) + 1;
  await supabase.from("style_rules").update({ active: false }).eq("user_id", user.id).eq("active", true);
  const { error } = await supabase.from("style_rules").insert({ user_id: user.id, version, source_md: md, config, active: true });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/", "layout");
  const parts = [hasMd && "profile", hasPalette && `palette (${config.swatches?.length} swatches)`].filter(Boolean).join(" and ");
  return {
    ok: true,
    message: `Imported ${parts} as version ${version}.${config.parseWarnings.length ? ` Warnings: ${config.parseWarnings.join(" ")}` : ""}`,
  };
}
