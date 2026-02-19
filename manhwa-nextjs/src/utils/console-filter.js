// Configuración para filtrar logs de desarrollo no deseados
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const originalLog = console.log;
  const originalWarn = console.warn;
  
  // Filtrar logs específicos que no queremos ver
  console.log = (...args) => {
    const message = args.join(' ');
    
    // Filtrar logs específicos
    if (
      message.includes('Fast Refresh') ||
      message.includes('rebuilding') ||
      message.includes('done in') ||
      message.includes('precargado con precarga') ||
      message.includes('preloaded using link preload') ||
      message.includes('Skipping auto-scroll behavior')
    ) {
      return;
    }
    
    originalLog(...args);
  };
  
  // Filtrar warnings específicos
  console.warn = (...args) => {
    const message = args.join(' ');
    
    if (
      message.includes('scroll-behavior: smooth') ||
      message.includes('Detected `scroll-behavior: smooth`') ||
      message.includes('precargado con precarga') ||
      message.includes('preloaded using link preload')
    ) {
      return;
    }
    
    originalWarn(...args);
  };
}

export {};