import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/game/$subject/$topic")({
  head: ({ params }) => ({ meta: [
    { title: `${params.topic} Games — Vidya Kalari` },
    { name: "description", content: `Play learning games about ${params.topic}.` },
    { property: "og:title", content: `${params.topic} Games — Vidya Kalari` },
    { property: "og:description", content: `Play learning games about ${params.topic}.` },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  beforeLoad: ({ params }) => { throw redirect({ to: "/learn/$subject/$topic", params, search: { tab: "game" } }); },
});
