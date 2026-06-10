export const ADSENSE_CLIENT = 'ca-pub-6426570202991325'

// Slot IDs come from the AdSense dashboard (Ads > By ad unit > Display ads).
// Empty string = unit not created yet; AdUnit renders nothing for that slot,
// so this file can ship before the units exist in AdSense.
export const adSlots = {
  toolContent: '',
  blogArticle: '',
} as const

export type AdSlotKey = keyof typeof adSlots

export function getAdSlotId(key: AdSlotKey): string {
  return adSlots[key]
}
