import { createFileRoute } from '@tanstack/react-router'
import SophonGamePage from '@/components/sophonGamePage'

export const Route = createFileRoute('/bh3')({
  component: () => <SophonGamePage gameId="Impact3rd" />,
})


