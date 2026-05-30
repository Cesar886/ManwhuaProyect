# Manhwa Imperial — Flutter App Design Spec

**Date**: 2026-05-30  
**Status**: Approved  
**Platform**: Android (API 21+) · iOS (14+)  
**State management**: Riverpod  
**Navigation**: GoRouter  

---

## 1. Context

Manhwa Imperial (`manhwaimperial.site`) is a Spanish-language manhwa reading platform. This spec covers the Flutter mobile app that consumes the existing Express REST API at `https://manhwaimperial.site/api`.

The existing codebase lives at `~/ManwhuasProyect/`:
- `manhwa-api/` — Express backend (source of truth for all endpoints)
- `manhwa-nextjs/` — Next.js frontend (visual/UX reference)
- The Flutter app will be built at `manhwa-flutter/`

---

## 2. Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| API key handling | Embed in app (same as web `NEXT_PUBLIC_INTERNAL_API_KEY`) | Known risk, accepted. Same as web frontend. |
| Authentication | JWT in `flutter_secure_storage` | Cookies (httpOnly) don't work natively in mobile HTTP clients |
| Offline support | Basic — cache last 20 series + all local progress | Balance between complexity and usefulness |
| State management | Riverpod | Modern, low boilerplate, great async support |
| Architecture | Feature-first with light clean architecture | Scales per feature, navigable, no over-engineering |

---

## 3. Project Structure

```
manhwa-flutter/
  lib/
    core/
      api/
        api_client.dart          # Dio instance + base config
        interceptors/
          auth_interceptor.dart  # Attaches Bearer token
          api_key_interceptor.dart # Attaches x-api-key
          error_interceptor.dart   # 401 → logout, retry with refresh
      auth/
        auth_provider.dart       # AsyncNotifier<User?>
        secure_storage.dart      # flutter_secure_storage wrapper
      cache/
        hive_cache.dart          # Hive boxes: seriesCache + progressCache
      router/
        app_router.dart          # GoRouter config + redirect guards
      theme/
        app_theme.dart           # ThemeData (dark, red/gold palette)
    features/
      home/
        home_screen.dart
        home_provider.dart       # featured, latest, popular, trending
      catalog/
        catalog_screen.dart
        filters_sheet.dart       # Bottom sheet: genre, status, type
        catalog_provider.dart    # Paginated series list
      reader/
        reader_screen.dart
        reader_provider.dart     # Pages, navigation, auto-save progress
        page_preloader.dart      # Preloads next 3 pages
      search/
        search_screen.dart
        search_provider.dart     # Debounce 400ms, autocomplete, AI search
      profile/
        profile_screen.dart      # Tabs: history + bookmarks
        profile_provider.dart
      auth/
        login_screen.dart
        register_screen.dart
      manhwa/
        manhwa_detail_screen.dart
        chapter_list_provider.dart
    shared/
      models/
        series.dart
        chapter.dart
        genre.dart
        user.dart
        progress.dart
        bookmark.dart
      widgets/
        manhwa_card.dart
        chapter_tile.dart
        loading_shimmer.dart
        error_view.dart
        bottom_nav_bar.dart
      utils/
        image_url.dart           # Normalize DO Spaces URLs
        format_utils.dart        # formatViews, formatDate
  assets/
    images/
      logo.png
      splash_bg.png
      placeholder_cover.png
  pubspec.yaml
  README.md
  API_ENDPOINTS.md
```

---

## 4. Navigation (GoRouter)

```
/                         → Splash → redirect to /home or /auth/login
/home                     → HomeScreen (BottomNav tab 0)
/catalog                  → CatalogScreen (BottomNav tab 1)
/search                   → SearchScreen (BottomNav tab 2)
/profile                  → ProfileScreen (BottomNav tab 3)
/manhwa/:slug             → ManhwaDetailScreen (no BottomNav)
/manhwa/:slug/read/:chapterNum  → ReaderScreen (no BottomNav)
/auth/login               → LoginScreen
/auth/register            → RegisterScreen
```

**Auth guard**: Routes `/profile` and reader progress-saving require auth. Anonymous users can browse and read; saving progress requires login (prompt shown on first save attempt).

---

## 5. API Layer

### Base config
- **Production URL**: `https://manhwaimperial.site/api`
- **Headers on every request**:
  - `x-api-key: <INTERNAL_API_KEY>` — read value from `manhwa-nextjs/.env` → `NEXT_PUBLIC_INTERNAL_API_KEY`. Store in `core/api/api_constants.dart` as a compile-time constant.
  - `Authorization: Bearer <jwt>` (if authenticated)
  - `x-timezone: <device_timezone>`

### Dio interceptors (order matters)
1. `ApiKeyInterceptor` — adds `x-api-key` header
2. `AuthInterceptor` — adds `Authorization` if token exists in SecureStorage
3. `ErrorInterceptor` — on 401: try refresh token → on fail: clear storage + redirect to login

### Endpoints used by the app

| Feature | Method | Path |
|---|---|---|
| Login | POST | `/auth/login` |
| Register | POST | `/auth/register` |
| Google OAuth | POST | `/auth/google` |
| Refresh token | POST | `/auth/refresh` |
| Logout | POST | `/auth/logout` |
| Current user | GET | `/auth/me` |
| Forgot password | POST | `/auth/forgot-password` |
| Featured series | GET | `/series/featured` |
| Popular series | GET | `/series/popular` |
| Latest series | GET | `/series/latest` |
| Trending series | GET | `/series/trending` |
| All series (catalog) | GET | `/series?page=&limit=&genre=&status=&contentType=` |
| Series detail | GET | `/series/:slug` |
| Series chapters | GET | `/series/:slug/chapters` |
| Related series | GET | `/series/:slug/related` |
| Rate series | POST | `/series/:slug/rate` |
| Bookmark series | POST/DELETE | `/series/:slug/bookmark` |
| Chapter pages | GET | `/chapters/:seriesSlug/:chapterSlug/pages` |
| Reading progress | POST | `/progress` |
| Recent progress | GET | `/progress/recent` |
| Sync progress | GET | `/progress/sync` |
| Reading streak | GET | `/progress/streak` |
| Bookmarks list | GET | `/bookmarks` |
| Search autocomplete | GET | `/search/autocomplete?q=` |
| Search series | GET | `/search/series?q=` |
| AI search | POST | `/search/ai/read` |
| AI search quota | GET | `/search/ai/quota` |
| Genres list | GET | `/genres` |
| User profile | GET | `/users/:username` |
| Reading history | GET | `/users/me/history` |
| Update profile | PUT | `/users/profile` |
| Spaces manhwas (fast) | GET | `/spaces/manhwas` |
| Spaces chapter pages | GET | `/spaces/manhwas/:slug/capitulo/:chapterNum/pages` |

---

## 6. Data Models

```dart
// Series
class Series {
  String id, slug, title, synopsis;
  String? coverUrl;
  String status;         // ongoing | completed | hiatus | dropped | upcoming
  String contentType;    // manhwa | manga | manhua | webtoon
  List<Genre> genres;
  double? rating;
  int viewCount, chapterCount;
  List<Chapter> chapters;  // latest chapters preview
}

// Chapter
class Chapter {
  String id, seriesSlug;
  double number;
  String? title, slug;
  List<String> pages;     // image URLs
  DateTime createdAt;
  bool isRead;            // local state
}

// Genre
class Genre {
  String id, slug, name;
  String? color, icon;
}

// User
class User {
  String id, username;
  String? displayName, avatarUrl, bio;
  int xp, streak;
}

// Progress
class Progress {
  String slug;
  double chapterNum;
  int scrollPosition;
  double progress;        // 0-100
  bool isCompleted;
  DateTime updatedAt;
}

// Bookmark
class Bookmark {
  String seriesId;
  Series series;
  bool notificationsEnabled;
}
```

---

## 7. Riverpod Providers

```dart
// Core
authProvider              AsyncNotifier<User?>           login/logout/me
tokenProvider             StateProvider<String?>         JWT token

// Home
featuredSeriesProvider    FutureProvider<List<Series>>
latestSeriesProvider      FutureProvider<List<Series>>
popularSeriesProvider     FutureProvider<List<Series>>
trendingSeriesProvider    FutureProvider<List<Series>>

// Catalog
catalogProvider           StateNotifierProvider          paginated + filters
genresProvider            FutureProvider<List<Genre>>    cached

// Manhwa detail
manhwaDetailProvider      FutureProvider.family<Series, String>(slug)
chapterListProvider       FutureProvider.family<List<Chapter>, String>(slug)

// Reader
readerProvider            StateNotifierProvider.family   pages + nav state
progressProvider          AsyncNotifier                  save/load/sync

// Search
searchProvider            StateNotifierProvider          query + results + debounce

// Profile
bookmarksProvider         AsyncNotifier<List<Bookmark>>
historyProvider           FutureProvider<List<Progress>>
```

---

## 8. Screen Designs

### HomeScreen
- `AppBar` with logo (top left) + search icon (top right)
- Horizontal `ListView` sections: Destacados (large cards 160×220), Nuevos Capítulos, Populares, Tendencias
- Each section has "Ver todo →" that navigates to CatalogScreen with pre-applied filter
- Pull to refresh

### CatalogScreen
- Grid 2 columns with `ManhwaCard` (cover + title + chapter count + status badge)
- Sticky filter bar: genre chips + "Filtros" button → `FiltersSheet` (bottom sheet)
- `FiltersSheet`: genre multi-select, status radio, content type radio, "Aplicar" CTA
- Infinite scroll pagination (fetch next page when 80% scroll reached)

### ManhwaDetailScreen
- Hero animation from card cover to full-width header image
- Parallax scroll effect on cover
- Expandable synopsis (3 lines collapsed)
- Genre chips row
- Star rating display + user rating widget
- "Continuar leyendo" or "Empezar a leer" CTA button (pinned at bottom)
- Chapter list: number, title, date, read indicator (dot)

### ReaderScreen
- Full-screen vertical scroll (`ListView.builder` with `cached_network_image`)
- Preloads next 3 pages via `PagePreloader`
- Tap center of screen → show/hide overlay (header + footer)
- Header: back button + series title + chapter number
- Footer: prev/next chapter buttons + progress indicator
- Auto-saves progress every 5 seconds (debounced POST to `/progress`)
- Double-tap to zoom (InteractiveViewer)

### SearchScreen
- Search bar always focused on entry
- Debounce 400ms → calls `/search/autocomplete`
- Results grid (same `ManhwaCard`)
- "Búsqueda IA" toggle → calls `/search/ai/read` → shows AI-curated results with explanation text
- Recent searches stored in SharedPreferences (last 10)

### ProfileScreen
- If not authenticated: centered login prompt with "Iniciar sesión" and "Continuar sin cuenta"
- If authenticated: username, avatar, XP bar, streak badge
- Tabs: Historial · Guardados
- Historial: list of recent progress sorted by date
- Guardados: grid of bookmarked series

### LoginScreen / RegisterScreen
- Dark card on dark background
- Email + password fields
- Google Sign-In button (uses `google_sign_in` package → sends token to `/auth/google`)
- Link to register / forgot password

---

## 9. Offline Behavior

- Hive box `seriesCache`: stores last 20 visited `Series` objects (TTL 24h). On no-network, serve from cache with `OfflineBanner` widget shown.
- Hive box `progressCache`: stores all local progress. Syncs to server via `GET /progress/sync` on app foreground + `POST /progress` per chapter. If offline, queues writes and flushes on reconnect (using `connectivity_plus` listener).
- Images: `cached_network_image` handles disk cache automatically.

---

## 10. Theme

```dart
ThemeData(
  brightness: Brightness.dark,
  scaffoldBackgroundColor: Color(0xFF0D0D0D),
  cardColor: Color(0xFF1A1A1A),
  colorScheme: ColorScheme.dark(
    primary: Color(0xFFE53935),      // Red
    secondary: Color(0xFFFFC107),    // Gold
    surface: Color(0xFF1A1A1A),
    background: Color(0xFF0D0D0D),
  ),
  fontFamily: 'Inter',
)
```

Splash screen: logo centered, black background, 300ms fade-in then navigate.

---

## 11. Dependencies (pubspec.yaml)

```yaml
dependencies:
  flutter_riverpod: ^2.x
  go_router: ^13.x
  dio: ^5.x
  flutter_secure_storage: ^9.x
  cached_network_image: ^3.x
  hive_flutter: ^1.x
  google_sign_in: ^6.x
  connectivity_plus: ^6.x
  shared_preferences: ^2.x
  shimmer: ^3.x
  google_fonts: ^6.x
  freezed_annotation: ^2.x
  json_annotation: ^4.x

dev_dependencies:
  build_runner: ^2.x
  freezed: ^2.x
  json_serializable: ^6.x
  riverpod_generator: ^2.x
```

---

## 12. Out of Scope

- Push notifications (no FCM token endpoint found in API)
- Comments / rating submission (read-only for MVP)
- Collections management
- Admin panel
- Upload / content creation
- Discord OAuth (web-only flow, not mobile-friendly)
- In-app purchases / donations
