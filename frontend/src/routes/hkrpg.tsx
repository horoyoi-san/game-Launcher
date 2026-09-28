import { createFileRoute } from '@tanstack/react-router'
import SophonGamePage from '@/components/sophonGamePage'

export const Route = createFileRoute('/hkrpg')({
  component: () => <SophonGamePage gameId="StarRail" />,
})

