import { createFileRoute } from '@tanstack/react-router'
import SophonGamePage from '@/components/sophonGamePage'

export const Route = createFileRoute('/hyg')({
  component: () => <SophonGamePage gameId="PetitPlanet" />,
})
