// Polyfill mínimo para URL.canParse en Safari anterior a 17.
if (!URL.canParse) {
  URL.canParse = function canParse(url, base) {
    try {
      new URL(url, base)
      return true
    } catch {
      return false
    }
  }
}
