export type LayoutTemplateId = 'full-width' | 'with-sidebar' | 'minimal'

export interface LayoutTemplate {
  label: string
  zones: readonly string[]
}

export const LAYOUT_TEMPLATES: Record<LayoutTemplateId, LayoutTemplate> = {
  'full-width': {
    label: 'Full Width',
    zones: ['top', 'main', 'bottom'],
  },
  'with-sidebar': {
    label: 'With Sidebar',
    zones: ['top', 'left', 'center', 'right', 'bottom'],
  },
  'minimal': {
    label: 'Minimal',
    zones: ['main'],
  },
} as const

export const LAYOUT_TEMPLATE_IDS = Object.keys(LAYOUT_TEMPLATES) as LayoutTemplateId[]

export function getTemplateZones(templateId: string): readonly string[] {
  return LAYOUT_TEMPLATES[templateId as LayoutTemplateId]?.zones ?? LAYOUT_TEMPLATES['full-width'].zones
}

export function isValidTemplate(templateId: string): templateId is LayoutTemplateId {
  return templateId in LAYOUT_TEMPLATES
}
