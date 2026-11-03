import { createFileRoute } from '@tanstack/react-router'
import HoyoPage from '@/pages/hoyo'

export const Route = createFileRoute('/hoyo')({
  component: HoyoPage,
})
