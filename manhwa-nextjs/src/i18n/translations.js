import es from './es.json'
import en from './en.json'

export { es, en }

// Hook para usar traducciones
export function useTranslations(lang = 'es') {
  return lang === 'en' ? en : es
}

// Función helper para obtener traducciones
export function getTranslations(lang = 'es') {
  return lang === 'en' ? en : es
}
