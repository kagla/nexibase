import { ComponentType } from 'react'
import RichTextRenderer from './RichTextRenderer'
import ImageBannerRenderer from './ImageBannerRenderer'
import HtmlEmbedRenderer from './HtmlEmbedRenderer'
import ButtonCtaRenderer from './ButtonCtaRenderer'
import SpacerRenderer from './SpacerRenderer'
import VideoEmbedRenderer from './VideoEmbedRenderer'

export const contentRenderers: Record<string, ComponentType<{ settings?: Record<string, unknown> }>> = {
  'rich-text': RichTextRenderer,
  'image-banner': ImageBannerRenderer,
  'html-embed': HtmlEmbedRenderer,
  'button-cta': ButtonCtaRenderer,
  'spacer': SpacerRenderer,
  'video-embed': VideoEmbedRenderer,
}

export const CONTENT_WIDGET_TYPES = [
  { key: 'rich-text', label: 'Rich Text', description: 'Formatted text with images and links' },
  { key: 'image-banner', label: 'Image Banner', description: 'Full-width image with optional link' },
  { key: 'html-embed', label: 'HTML Embed', description: 'Custom HTML or embed code' },
  { key: 'button-cta', label: 'Button / CTA', description: 'Call-to-action button with link' },
  { key: 'spacer', label: 'Spacer', description: 'Empty space between widgets' },
  { key: 'video-embed', label: 'Video', description: 'YouTube or Vimeo embed' },
] as const
