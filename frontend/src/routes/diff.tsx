import ZipPatchPage from '@/pages/diff/ZipPatchPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/diff')({
  component: ZipPatchPage,
})

