class BehaviorTracker {
    constructor(options = {}) {
        this.apiBaseUrl = String(options.apiBaseUrl || '/api/track').replace(/\/$/, '');
        this.seriesId = options.seriesId || options.workId || null;
        this.chapterId = options.chapterId || null;
        this.chapterNumber = options.chapterNumber ?? null;
        this.sessionId = options.sessionId || this.uuid();
        this.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        this.visibleStart = document.visibilityState === 'visible' ? Date.now() : null;
        this.visibleMs = 0;
        this.scrollDepthMax = 0;
        this.chaptersInSession = 0;
        this.lastProgressAt = 0;
        this.paused = document.visibilityState !== 'visible';
        this.completed = false;
        this.activeRecommendation = null;
        this.bound = false;
        this.finalized = false;
    }

    start() {
        if (this.bound) return;
        this.bound = true;

        this.emit('session-start', {
            session_id: this.sessionId,
            series_id: this.seriesId,
            chapter_id: this.chapterId,
            chapter_number: this.chapterNumber,
            started_at: this.now(),
            local_timestamp: this.now(),
            timezone: this.timezone,
            page_url: location.href,
        });

        this.onScroll = () => {
            const depth = this.scrollDepth();
            if (depth > this.scrollDepthMax) this.scrollDepthMax = depth;
            if (Date.now() - this.lastProgressAt >= 5000) this.trackChapterProgress();
        };

        this.onVisibility = () => {
            if (document.visibilityState === 'hidden') {
                this.pauseClock();
                this.trackChapterProgress(true);
            } else {
                this.resumeClock();
            }
        };

        this.onHide = () => this.finalize('pagehide');
        this.onUnload = () => this.finalize('tab_closed');

        window.addEventListener('scroll', this.onScroll, { passive: true });
        document.addEventListener('visibilitychange', this.onVisibility);
        window.addEventListener('pagehide', this.onHide);
        window.addEventListener('beforeunload', this.onUnload);
    }

    stop() {
        if (!this.bound) return;
        this.finalize('manual_stop');
        this.bound = false;
        window.removeEventListener('scroll', this.onScroll);
        document.removeEventListener('visibilitychange', this.onVisibility);
        window.removeEventListener('pagehide', this.onHide);
        window.removeEventListener('beforeunload', this.onUnload);
    }

    setChapter(chapterNumber, chapterId = null) {
        if (chapterNumber !== undefined && chapterNumber !== null) this.chapterNumber = chapterNumber;
        if (chapterId) this.chapterId = chapterId;
        this.trackChapterProgress(true);
    }

    pauseClock() {
        if (!this.paused && this.visibleStart) {
            this.visibleMs += Date.now() - this.visibleStart;
            this.visibleStart = null;
            this.paused = true;
        }
    }

    resumeClock() {
        if (this.paused) {
            this.visibleStart = Date.now();
            this.paused = false;
        }
    }

    elapsedSeconds() {
        const extra = !this.paused && this.visibleStart ? Date.now() - this.visibleStart : 0;
        return Math.max(0, Math.round((this.visibleMs + extra) / 1000));
    }

    scrollDepth() {
        const doc = document.documentElement;
        const total = Math.max(0, doc.scrollHeight - window.innerHeight);
        if (total <= 0) return 0;
        return Math.min(100, Math.round(((window.scrollY || doc.scrollTop || 0) / total) * 100));
    }

    trackChapterProgress(force = false) {
        if (!this.seriesId || !this.chapterId) return;
        const seconds = this.elapsedSeconds();
        if (!force && seconds < 1) return;
        this.lastProgressAt = Date.now();

        this.emit('chapter-progress', {
            session_id: this.sessionId,
            series_id: this.seriesId,
            chapter_id: this.chapterId,
            chapter_number: this.chapterNumber,
            progress_percent: 100,
            scroll_depth_percent: this.scrollDepthMax,
            seconds_on_page: seconds,
            timezone: this.timezone,
            local_timestamp: this.now(),
            page_url: location.href,
        });
    }

    trackChapterComplete(extra = {}) {
        this.completed = true;
        this.chaptersInSession += 1;
        const impressionId = extra.recommendation_impression_id || this.activeRecommendation?.impressionId;
        const algorithm = extra.source_algorithm || extra.algoritmo_origen || this.activeRecommendation?.sourceAlgorithm;

        this.emit('chapter-complete', {
            session_id: this.sessionId,
            series_id: this.seriesId,
            chapter_id: this.chapterId,
            chapter_number: this.chapterNumber,
            progress_percent: 100,
            scroll_depth_percent: this.scrollDepthMax,
            seconds_on_page: this.elapsedSeconds(),
            chapters_read_in_session: this.chaptersInSession,
            timezone: this.timezone,
            local_timestamp: this.now(),
            ...(impressionId ? { recommendation_impression_id: impressionId } : {}),
            ...(algorithm ? { source_algorithm: algorithm } : {}),
            ...extra,
        });
    }

    trackSearchQuery(queryText, resultClickedSeriesId = null) {
        return this.emit('search-query', {
            query_text: queryText,
            result_clicked_series_id: resultClickedSeriesId,
            timezone: this.timezone,
            local_timestamp: this.now(),
        });
    }

    trackRecommendationImpression(data = {}) {
        const impressionId = data.recommendation_impression_id || this.uuid();
        this.activeRecommendation = {
            impressionId,
            recommendedSeriesId: data.recommended_series_id,
            sourceAlgorithm: data.algoritmo_origen,
        };

        this.emit('recommendation-impression', {
            ...data,
            recommendation_impression_id: impressionId,
            mostrado_en: data.mostrado_en || this.now(),
            timezone: data.timezone || this.timezone,
        });

        return impressionId;
    }

    trackRecommendationClick(data = {}) {
        return this.emit('recommendation-click', {
            recommendation_impression_id: data.recommendation_impression_id || this.activeRecommendation?.impressionId || this.uuid(),
            recommended_series_id: data.recommended_series_id || this.activeRecommendation?.recommendedSeriesId,
            algoritmo_origen: data.algoritmo_origen || this.activeRecommendation?.sourceAlgorithm || 'unknown',
            clicked_at: data.clicked_at || this.now(),
            chapters_read_post_conversion: data.chapters_read_post_conversion ?? this.chaptersInSession,
            timezone: data.timezone || this.timezone,
        });
    }

    sendSessionEnd(exitReason = 'user_left') {
        return this.emit('session-end', {
            session_id: this.sessionId,
            series_id: this.seriesId,
            chapter_id: this.chapterId,
            chapter_number: this.chapterNumber,
            duration_seconds: this.elapsedSeconds(),
            scroll_depth_percent: this.scrollDepthMax,
            chapters_read_in_session: this.chaptersInSession,
            exit_reason: exitReason,
            timezone: this.timezone,
            ended_at: this.now(),
        }, true);
    }

    trackWorkAbandon(reason = 'tab_closed') {
        if (this.completed || !this.seriesId) return false;
        return this.emit('work-abandon', {
            series_id: this.seriesId,
            chapter_id: this.chapterId,
            chapter_number: this.chapterNumber,
            days_without_activity: 7,
            timezone: this.timezone,
            local_timestamp: this.now(),
            reason,
        }, true);
    }

    finalize(reason) {
        if (this.finalized) return;
        this.finalized = true;
        this.pauseClock();
        if (!this.completed) this.trackWorkAbandon(reason);
        this.sendSessionEnd(reason);
    }

    emit(path, body = {}, useBeacon = false) {
        const url = `${this.apiBaseUrl}/${String(path).replace(/^\/+/, '')}`;
        const payload = JSON.stringify({
            timezone: this.timezone,
            local_timestamp: this.now(),
            ...body,
        });

        if (useBeacon && navigator.sendBeacon) {
            try {
                return navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
            } catch {
                return false;
            }
        }

        return fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: useBeacon,
        }).catch(() => false);
    }

    now() {
        return new Date().toISOString();
    }

    uuid() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
        return `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }
}

if (typeof module !== 'undefined' && module.exports) module.exports = BehaviorTracker;
if (typeof exports !== 'undefined') exports.BehaviorTracker = BehaviorTracker;
if (typeof window !== 'undefined') window.BehaviorTracker = BehaviorTracker;
