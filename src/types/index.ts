export interface ThemeSettings {
  name: string
  backgroundColor: string
  backgroundImage?: string
  fontFamily: string
  fontColor: string
  accentColor: string
  slideSize: '16:9' | '4:3' | '16:10'
  logo?: string
  logoSize?: number
}

export interface Slide {
  id: string
  content: string
  index: number
}

export interface EditorState {
  markdown: string
  currentSlideIndex: number
  theme: ThemeSettings
  isStylePanelOpen: boolean
  isExportModalOpen: boolean
  isPresentationMode: boolean
}

export type ExportFormat = 'md' | 'pdf' | 'pptx' | 'google-slides'

export interface TableData {
  rows: number
  cols: number
  header: boolean
}
