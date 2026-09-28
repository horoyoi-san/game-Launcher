import { createFileRoute } from "@tanstack/react-router";
import SophonGamePage from "@/components/sophonGamePage";

export const Route = createFileRoute("/kl")({
  component: () => <SophonGamePage gameId="TheWeavers" />,
});