import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Vidya Kalari" }, { name: "description", content: "Continue to your Vidya Kalari learning space." }, { property: "og:title", content: "Dashboard — Vidya Kalari" }, { property: "og:description", content: "Continue to your Vidya Kalari learning space." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  beforeLoad: () => {
    throw redirect({ to: "/learning" });
  },
});
