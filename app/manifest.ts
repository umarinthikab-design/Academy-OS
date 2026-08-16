import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Touchline",
    short_name: "Touchline",
    description: "Grassroots coaching management",
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
