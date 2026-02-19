# Sistema de Sincronización de Progreso de Lectura

## 📖 Descripción

Sistema completo de sincronización del progreso de lectura que permite a los usuarios continuar leyendo desde cualquier dispositivo. Combina almacenamiento local (localStorage) con sincronización en backend para máxima confiabilidad.

## ✨ Características

- **Sincronización automática** entre múltiples dispositivos
- **Almacenamiento híbrido**: localStorage + base de datos
- **Offline-first**: Funciona sin conexión, sincroniza cuando vuelve
- **Progreso en tiempo real**: Guarda cada segundo mientras lees
- **Detección de dispositivos**: Rastrea qué dispositivo guardó el progreso
- **API RESTful completa** para integración

## 🏗️ Arquitectura

### Frontend (Next.js)

```
src/
├── hooks/
│   └── useReadingProgress.js      # Hook principal
├── api/
│   └── progress.js                 # Cliente API
├── components/
│   ├── ReadingProgressBar.jsx     # Barra de progreso visual
│   └── ReadingRestoredNotice.jsx  # Notificación de restauración
└── config.js                       # Endpoints
```

### Backend (Node.js + PostgreSQL)

```
src/
├── routes/
│   └── progress.routes.js         # Rutas API
├── controllers/
│   └── progress.controller.js     # Lógica de negocio
└── migrations/
    └── 002_add_reading_progress_fields.sql
```

## 📦 Base de Datos

### Tabla `reading_history`

```sql
ALTER TABLE reading_history ADD COLUMN:
- scroll_position INTEGER          -- Posición de scroll en px
- progress_percentage DECIMAL(5,2) -- Progreso 0-100%
- total_pages INTEGER               -- Total de páginas
- device_id VARCHAR(255)            -- ID del dispositivo
- synced_at TIMESTAMP               -- Última sincronización
```

### Tabla `user_devices` (Opcional)

```sql
CREATE TABLE user_devices (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  device_id VARCHAR(255),
  device_name VARCHAR(255),
  device_type VARCHAR(50),
  last_sync_at TIMESTAMP
);
```

## 🚀 Uso

### Hook `useReadingProgress`

```jsx
import { useReadingProgress } from '@/hooks/useReadingProgress';

function ChapterReader() {
  const { slug, chapterNum } = useParams();
  const { pages } = useChapterPages(slug, chapterNum);

  const {
    progress,            // Progreso actual (0-100)
    scrollPosition,      // Posición de scroll
    hasRestoredPosition, // Si restauró la posición
    isSyncing,          // Si está sincronizando
  } = useReadingProgress(slug, chapterNum, pages.length);

  return (
    <div>
      <ReadingProgressBar progress={progress} />
      <ReadingRestoredNotice
        show={hasRestoredPosition}
        progress={progress}
      />
      {/* Contenido del capítulo */}
    </div>
  );
}
```

### API Endpoints

#### POST `/api/progress` - Guardar progreso

```javascript
await saveProgress({
  slug: 'solo-leveling',
  chapterNum: 5,
  scrollPosition: 1200,
  progress: 45.5,
  totalPages: 50,
  isCompleted: false,
  deviceId: 'device-uuid'
});
```

#### GET `/api/progress/:slug/:chapterNum` - Obtener progreso

```javascript
const progress = await getProgress('solo-leveling', 5);
// Retorna: { scrollPosition, progress, totalPages, isCompleted, syncedAt }
```

#### GET `/api/progress/sync` - Sincronizar todo

```javascript
const allProgress = await syncProgress(100);
// Retorna array con todo el progreso del usuario
```

#### GET `/api/progress/recent` - Últimos leídos

```javascript
const recent = await getRecentProgress(10);
// Retorna últimos 10 capítulos leídos (para "Continuar leyendo")
```

## 🔄 Flujo de Sincronización

### Guardado

1. Usuario hace scroll en el capítulo
2. Hook detecta cambio significativo (>100px o >5%)
3. Debounce de 1 segundo
4. Guarda en localStorage (instantáneo)
5. Si está autenticado, sincroniza con backend (asíncrono)
6. Backend actualiza base de datos y bookmarks

### Carga

1. Usuario abre capítulo
2. Hook verifica si hay usuario autenticado
3. **Con usuario**: Carga desde backend (más reciente)
   - Guarda en localStorage como caché
   - Restaura posición de scroll
4. **Sin usuario**: Carga desde localStorage
5. Muestra notificación si hay progreso guardado

### Estrategia de Conflictos

- **Timestamp gana**: Se usa el progreso más reciente
- **Fallback seguro**: Si backend falla, usa localStorage
- **Optimistic updates**: Guarda local inmediatamente

## 🎨 Componentes Visuales

### `ReadingProgressBar`

Barra de progreso en la parte superior que muestra el avance del capítulo.

**Props:**
- `progress` (number): Progreso 0-100
- `position` (string): 'top' | 'bottom'

**Características:**
- Gradiente animado
- Efecto shimmer
- Mensaje de completado al llegar al 95%

### `ReadingRestoredNotice`

Notificación que aparece cuando se restaura el progreso.

**Props:**
- `show` (boolean): Si debe mostrarse
- `progress` (number): Progreso restaurado

**Características:**
- Auto-desaparece en 4 segundos
- Animación slide-in
- Muestra % de progreso

## 🔐 Seguridad

- ✅ Todas las rutas requieren autenticación
- ✅ Validación de parámetros con express-validator
- ✅ Rate limiting en endpoints
- ✅ CORS configurado
- ✅ SQL injection prevention con prepared statements
- ✅ Device fingerprinting opcional

## 📊 Estadísticas y Analytics

El sistema permite obtener:

- Capítulos más leídos
- Tiempo promedio de lectura
- Dispositivos activos por usuario
- Tasa de completado de capítulos
- Patrones de lectura

## 🐛 Troubleshooting

### El progreso no se sincroniza

1. Verificar que el usuario esté autenticado
2. Revisar console para errores de API
3. Verificar que el backend esté corriendo
4. Comprobar conexión a base de datos

### El progreso se restaura mal

1. Verificar que `hasRestoredPosition` sea true
2. Asegurarse de que el contenido se cargó completamente
3. Revisar que `scroll_position` no sea mayor al contenido

### Conflictos entre dispositivos

El sistema siempre usa el progreso más reciente basado en `synced_at`.

## 🚧 Migraciones

### Aplicar migración a base de datos

```bash
# PostgreSQL
psql -U your_user -d your_database -f migrations/002_add_reading_progress_fields.sql
```

Esto agregará:
- Columnas nuevas a `reading_history`
- Tabla `user_devices`
- Índices optimizados

## 📈 Performance

- **Debounce de 1s**: Evita writes excesivos
- **Detección de cambios**: Solo guarda si hay cambio significativo
- **Índices DB**: Queries optimizadas
- **Cache local**: localStorage como primera capa
- **Lazy loading**: Solo carga progreso cuando es necesario

## 🔮 Futuras Mejoras

- [ ] WebSocket para sync en tiempo real
- [ ] Compresión de datos de progreso
- [ ] Sincronización offline con service workers
- [ ] Analytics dashboard para usuarios
- [ ] Exportar/importar progreso
- [ ] Backup automático en la nube

## 📝 Ejemplos de Uso

### Continuar leyendo (Homepage)

```jsx
import { getRecentProgress } from '@/api/progress';

function ContinueReading() {
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    async function load() {
      const data = await getRecentProgress(5);
      setRecent(data);
    }
    load();
  }, []);

  return (
    <div>
      <h2>Continuar Leyendo</h2>
      {recent.map(item => (
        <Card key={item.chapter.id}>
          <img src={item.series.coverUrl} />
          <h3>{item.series.title}</h3>
          <p>Capítulo {item.chapter.number}</p>
          <ProgressBar value={item.progress} />
        </Card>
      ))}
    </div>
  );
}
```

### Sincronización al login

```jsx
import { syncProgress } from '@/api/progress';

async function handleLogin(credentials) {
  // Login del usuario
  await login(credentials);

  // Sincronizar progreso guardado localmente
  await syncProgress();

  // Redirigir
  router.push('/home');
}
```

## 🤝 Contribuciones

El sistema está diseñado para ser extensible. Áreas de contribución:

- Agregar más providers de almacenamiento (IndexedDB, Cloud Storage)
- Mejorar algoritmo de resolución de conflictos
- Implementar sync incremental
- Agregar tests unitarios e integración

---

**Desarrollado por:** Manhwa Imperial Team
**Versión:** 1.0.0
**Última actualización:** 2026-02-12
