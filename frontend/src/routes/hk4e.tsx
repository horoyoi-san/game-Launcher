import { createFileRoute } from '@tanstack/react-router'
import SophonGamePage from '@/components/sophonGamePage'

export const Route = createFileRoute('/hk4e')({
  component: () => <SophonGamePage gameId="Genshin" />,
})

