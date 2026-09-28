import { createFileRoute } from '@tanstack/react-router'
import DiffPage from '@/pages/diff/LegacyDiffPage'

export const Route = createFileRoute('/legacy-diff')({
  component: DiffPage,
})
