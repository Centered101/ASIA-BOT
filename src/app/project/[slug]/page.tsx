import type { Metadata, Viewport } from "next";
import { createClient } from "@supabase/supabase-js";
import ProjectFormClient from "./ProjectFormClient";

const DEFAULT_COLOR = "#84D4FA";

async function getDbProject(slug: string) {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await sb.from("projects")
      .select("name, primary_color")
      .eq("slug", slug).single();
    return data;
  } catch { return null; }
}

export async function generateViewport(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Viewport> {
  const { slug } = await params;
  const dbProject = await getDbProject(slug);
  return { themeColor: dbProject?.primary_color ?? DEFAULT_COLOR };
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const dbProject = await getDbProject(slug);
  return { title: dbProject?.name ?? "โปรเจค" };
}

export default function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  return <ProjectFormClient params={params} />;
}
