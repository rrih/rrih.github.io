import { createMetadata, homePageMetadata } from '@/config/metadata'
import type { Metadata } from 'next'
import HomeClient from './home-client'

export const metadata: Metadata = createMetadata(homePageMetadata)

export default function Home() {
  return <HomeClient />
}
