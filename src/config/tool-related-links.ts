export const relatedToolIdsByToolId: Record<string, readonly string[]> = {
  'gradient-generator': ['color-picker', 'box-shadow-generator', 'animation-generator'],
  'animation-generator': ['color-picker', 'gradient-generator', 'box-shadow-generator'],
}
