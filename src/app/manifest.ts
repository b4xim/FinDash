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
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
