import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FinDash',
    short_name: 'FinDash',
    description: 'Private personal finance dashboard',
    start_url: '/',
    display: 'standalone',
    background_color: '#0d0101',
    theme_color: '#0d0101',
    icons: [
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  }
}
