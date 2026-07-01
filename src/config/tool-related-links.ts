export const relatedToolIdsByToolId: Record<string, readonly string[]> = {
  'markdown-editor': ['json-formatter', 'base64', 'qr-generator'],
  'qr-generator': ['base64', 'markdown-editor', 'image-converter'],
  'electricity-cost-calculator': ['investment-calculator', 'timetable', 'qr-generator'],
  'take-home-pay-calculator': ['investment-calculator', 'electricity-cost-calculator', 'timetable'],
  'overtime-pay-calculator': [
    'take-home-pay-calculator',
    'timetable',
    'electricity-cost-calculator',
  ],
  'gradient-generator': ['color-picker', 'box-shadow-generator', 'animation-generator'],
  'animation-generator': ['color-picker', 'gradient-generator', 'box-shadow-generator'],
}
