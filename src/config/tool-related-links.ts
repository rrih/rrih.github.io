export const relatedToolIdsByToolId: Record<string, readonly string[]> = {
  'markdown-editor': ['json-formatter', 'base64', 'qr-generator'],
  'qr-generator': ['base64', 'markdown-editor', 'image-converter'],
  'gradient-generator': ['color-picker', 'box-shadow-generator', 'animation-generator'],
  'animation-generator': ['color-picker', 'gradient-generator', 'box-shadow-generator'],
}
