import { createFileRoute } from '@tanstack/react-router'
import SophonGamePage from '@/components/sophonGamePage'

export const Route = createFileRoute('/abc')({
  component: () => <SophonGamePage gameId="Nexusanima" />,
})
