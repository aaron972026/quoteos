import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest. Icons reference the supplied Ivory set in
// public/. Colors match the brand noir surface + ivory paper.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ivory Fence Co.",
    short_name: "Ivory",
    description: "Your fence price in 90 seconds.",
    start_url: "/",
    display: "standalone",
    background_color: "#FCF9F1",
    theme_color: "#16120D",
    icons: [
      { src: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { src: "/icon-512.png", type: "image/png", sizes: "512x512" },
      {
        src: "/icon-512.png",
        type: "image/png",
        sizes: "512x512",
        purpose: "maskable",
      },
    ],
  };
}
