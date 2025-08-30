import type { ToolMetadata } from '@/config/metadata'
import { siteConfig } from '@/config/site'
import React from 'react'
import { CategoryIcons, OGPIcons } from './ogp-icons'

interface OGPTemplateProps {
  toolId: string
  title: string
  description: string
  category: string
  url: string
}

export function ToolOGPTemplate({ toolId, title, description, category, url }: OGPTemplateProps) {
  const toolIcon = OGPIcons[toolId as keyof typeof OGPIcons]
  const categoryIcon = CategoryIcons[category as keyof typeof CategoryIcons]

  // Category color mapping
  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'developer':
        return '#3b82f6' // blue
      case 'design':
        return '#8b5cf6' // purple
      case 'utility':
        return '#10b981' // green
      case 'converter':
        return '#f59e0b' // orange
      default:
        return '#0066cc' // default accent
    }
  }

  const categoryColor = getCategoryColor(category)

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        background: `linear-gradient(135deg, ${categoryColor}22 0%, ${categoryColor}44 100%)`,
        position: 'relative',
      }}
    >
      {/* Background Pattern */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.05,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Main Content Container */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 60px',
          textAlign: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.98)',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          backdropFilter: 'blur(16px)',
          maxWidth: '900px',
          margin: '0 40px',
        }}
      >
        {/* Tool Icon Container */}
        <div
          style={{
            width: '120px',
            height: '120px',
            backgroundColor: categoryColor,
            borderRadius: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '32px',
            boxShadow: `0 10px 25px rgba(${Number.parseInt(
              categoryColor.slice(1, 3),
              16
            )}, ${Number.parseInt(
              categoryColor.slice(3, 5),
              16
            )}, ${Number.parseInt(categoryColor.slice(5, 7), 16)}, 0.3)`,
          }}
        >
          {toolIcon || (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <rect width="14" height="20" x="5" y="2" rx="2" ry="2" fill="white" />
              <path d="M9 22v-4h6v4" stroke="white" strokeWidth="2" fill="none" />
              <path d="M8 6h.01" stroke="#0066cc" strokeWidth="2" strokeLinecap="round" />
              <path d="M16 6h.01" stroke="#0066cc" strokeWidth="2" strokeLinecap="round" />
              <path d="M12 6h.01" stroke="#0066cc" strokeWidth="2" strokeLinecap="round" />
              <path d="M12 10h.01" stroke="#0066cc" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </div>

        {/* Tool Title */}
        <h1
          style={{
            fontSize: '64px',
            fontWeight: '800',
            color: '#1a1a1a',
            margin: '0 0 16px 0',
            lineHeight: '1.1',
            letterSpacing: '-0.02em',
            maxWidth: '800px',
          }}
        >
          {title}
        </h1>

        {/* Category Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: `${categoryColor}15`,
            color: categoryColor,
            padding: '8px 16px',
            borderRadius: '9999px',
            fontSize: '18px',
            fontWeight: '500',
            marginBottom: '24px',
            border: `2px solid ${categoryColor}30`,
          }}
        >
          {categoryIcon}
          <span style={{ textTransform: 'capitalize' }}>{category.replace('-', ' ')} Tool</span>
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: '22px',
            color: '#6b7280',
            margin: '0 0 40px 0',
            lineHeight: '1.5',
            maxWidth: '700px',
          }}
        >
          {description}
        </p>

        {/* Features Row */}
        <div
          style={{
            display: 'flex',
            gap: '32px',
            alignItems: 'center',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {/* Privacy Feature */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '16px',
              color: '#374151',
              backgroundColor: '#f9fafb',
              padding: '12px 20px',
              borderRadius: '12px',
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="#10b981" />
              </svg>
            </div>
            Privacy-First
          </div>

          {/* URL Sharing Feature */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '16px',
              color: '#374151',
              backgroundColor: '#f9fafb',
              padding: '12px 20px',
              borderRadius: '12px',
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="18" cy="5" r="3" fill="#3b82f6" />
                <circle cx="6" cy="12" r="3" fill="#3b82f6" />
                <circle cx="18" cy="19" r="3" fill="#3b82f6" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke="#3b82f6" strokeWidth="2" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke="#3b82f6" strokeWidth="2" />
              </svg>
            </div>
            URL Sharing
          </div>

          {/* No Tracking Feature */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '16px',
              color: '#374151',
              backgroundColor: '#f9fafb',
              padding: '12px 20px',
              borderRadius: '12px',
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                  stroke="#8b5cf6"
                  strokeWidth="2"
                  fill="none"
                />
                <circle cx="12" cy="12" r="3" fill="#8b5cf6" />
              </svg>
            </div>
            No Tracking
          </div>
        </div>

        {/* Site Brand */}
        <div
          style={{
            marginTop: '48px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#9ca3af',
            }}
          >
            by
          </div>
          <div
            style={{
              fontSize: '24px',
              fontWeight: '700',
              color: categoryColor,
            }}
          >
            {siteConfig.name}
          </div>
        </div>
      </div>

      {/* URL Badge */}
      <div
        style={{
          position: 'absolute',
          bottom: '40px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '9999px',
          fontSize: '16px',
          fontWeight: '500',
        }}
      >
        {url.replace('https://', '')}
      </div>
    </div>
  )
}
