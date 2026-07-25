export const relatedToolIdsByToolId: Record<string, readonly string[]> = {
  base64: ['json-formatter', 'markdown-editor', 'image-converter'],
  'markdown-editor': ['json-formatter', 'base64', 'qr-generator'],
  'qr-generator': ['base64', 'markdown-editor', 'image-converter'],
  'gradient-generator': ['color-picker', 'box-shadow-generator', 'animation-generator'],
  'animation-generator': ['color-picker', 'gradient-generator', 'box-shadow-generator'],
  'electricity-cost-calculator': ['investment-calculator', 'timetable', 'qr-generator'],
  'take-home-pay-calculator': ['investment-calculator', 'electricity-cost-calculator', 'timetable'],
}
