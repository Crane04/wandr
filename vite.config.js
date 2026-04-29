import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: "autoUpdate",
            includeAssets: [
                "logo.png",
                "og.png",
                "pwa-192.png",
                "pwa-512.png",
                "maskable-192.png",
                "maskable-512.png",
            ],
            manifest: {
                name: "wandr",
                short_name: "wandr",
                description: "wandr — a collection of bite-sized retro games.",
                start_url: "/",
                scope: "/",
                display: "standalone",
                background_color: "#ffffff",
                theme_color: "#ffffff",
                icons: [
                    {
                        src: "/pwa-192.png",
                        sizes: "192x192",
                        type: "image/png",
                    },
                    {
                        src: "/pwa-512.png",
                        sizes: "512x512",
                        type: "image/png",
                    },
                    {
                        src: "/maskable-192.png",
                        sizes: "192x192",
                        type: "image/png",
                        purpose: "maskable",
                    },
                    {
                        src: "/maskable-512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "maskable",
                    },
                ],
            },
        }),
    ],
});
