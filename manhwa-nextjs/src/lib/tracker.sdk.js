class BehaviorTrackerSDK {
    constructor(o = {}) {
        this.b = String(o.apiBaseUrl || '/api/track').replace(/\/$/, '');
        this.s = o.seriesId || o.workId || null;
        this.c = o.chapterId || null;
        this.n = o.chapterNumber ?? null;
        this.id = o.sessionId || this.u();
        this.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        this.v = document.visibilityState === 'visible' ? Date.now() : 0;
        this.ms = 0;
        this.d = 0;
        this.k = 0;
        this.lp = 0;
        this.p = document.visibilityState !== 'visible';
        this.done = false;
        this.end = false;
    }

    start() {
        if (this.on) return;
        this.on = true;
        this.e('session-start', {
            session_id: this.id,
            series_id: this.s,
            chapter_id: this.c,
            chapter_number: this.n,
            started_at: this.i(),
            page_url: location.href,
        });

        this.ws = () => {
            const d = this.sd();
            if (d > this.d) this.d = d;
            if (Date.now() - this.lp >= 5000) this.progress();
        };
        this.wv = () => {
            if (document.visibilityState === 'hidden') {
                this.pause();
                this.progress(true);
            } else {
                this.resume();
            }
        };
        this.wh = () => this.finish('pagehide');
        this.wu = () => this.finish('tab_closed');

        window.addEventListener('scroll', this.ws, { passive: true });
        document.addEventListener('visibilitychange', this.wv);
        window.addEventListener('pagehide', this.wh);
        window.addEventListener('beforeunload', this.wu);
    }

    stop() {
        if (!this.on) return;
        this.finish('manual_stop');
        this.on = false;
        window.removeEventListener('scroll', this.ws);
        document.removeEventListener('visibilitychange', this.wv);
        window.removeEventListener('pagehide', this.wh);
        window.removeEventListener('beforeunload', this.wu);
    }

    setChapter(chapterNumber, chapterId = null) {
        if (chapterNumber !== undefined && chapterNumber !== null) this.n = chapterNumber;
        if (chapterId) this.c = chapterId;
    }

    pause() {
        if (!this.p && this.v) {
            this.ms += Date.now() - this.v;
            this.v = 0;
            this.p = true;
        }
    }

    resume() {
        if (this.p) {
            this.v = Date.now();
            this.p = false;
        }
    }

    sec() {
        const x = !this.p && this.v ? Date.now() - this.v : 0;
        return Math.max(0, Math.round((this.ms + x) / 1000));
    }

    sd() {
        const r = document.documentElement;
        const t = Math.max(0, r.scrollHeight - window.innerHeight);
        if (!t) return 0;
        return Math.min(100, Math.round(((window.scrollY || r.scrollTop || 0) / t) * 100));
    }

    progress(force = false) {
        if (!this.s || !this.c) return;
        const seconds = this.sec();
        if (!force && seconds < 1) return;
        this.lp = Date.now();
        this.e('chapter-progress', {
            session_id: this.id,
            series_id: this.s,
            chapter_id: this.c,
            chapter_number: this.n,
            progress_percent: 100,
            scroll_depth_percent: this.d,
            seconds_on_page: seconds,
            page_url: location.href,
        });
    }

    complete(extra = {}) {
        this.done = true;
        this.k += 1;
        this.e('chapter-complete', {
            session_id: this.id,
            series_id: this.s,
            chapter_id: this.c,
            chapter_number: this.n,
            progress_percent: 100,
            scroll_depth_percent: this.d,
            seconds_on_page: this.sec(),
            chapters_read_in_session: this.k,
            ...extra,
        });
    }

    abandon(reason = 'tab_closed') {
        if (this.done || !this.s) return false;
        return this.e('work-abandon', {
            series_id: this.s,
            chapter_id: this.c,
            chapter_number: this.n,
            days_without_activity: 7,
            reason,
        }, true);
    }

    endSession(reason = 'user_left') {
        return this.e('session-end', {
            session_id: this.id,
            series_id: this.s,
            chapter_id: this.c,
            chapter_number: this.n,
            duration_seconds: this.sec(),
            scroll_depth_percent: this.d,
            chapters_read_in_session: this.k,
            exit_reason: reason,
            ended_at: this.i(),
        }, true);
    }

    finish(reason) {
        if (this.end) return;
        this.end = true;
        this.pause();
        if (!this.done) this.abandon(reason);
        this.endSession(reason);
    }

    e(path, body = {}, beacon = false) {
        const url = `${this.b}/${String(path).replace(/^\/+/, '')}`;
        const payload = JSON.stringify({ timezone: this.tz, local_timestamp: this.i(), ...body });

        if (beacon && navigator.sendBeacon) {
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
            keepalive: beacon,
        }).catch(() => false);
    }

    i() {
        return new Date().toISOString();
    }

    u() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
        return `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }
}

if (typeof module !== 'undefined' && module.exports) module.exports = BehaviorTrackerSDK;
if (typeof window !== 'undefined') window.BehaviorTrackerSDK = BehaviorTrackerSDK;
