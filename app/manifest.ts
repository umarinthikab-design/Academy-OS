import type { MetadataRoute } from "next";
import { getAcademyBranding } from "@/lib/getAcademyBranding";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { academyName } = await getAcademyBranding();
  return {
    name: academyName,
    short_name: academyName,
    description: `${academyName} - football coaching management, powered by Touchline`,
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7f6",
    theme_color: "#0b3d2e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
