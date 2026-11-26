--
-- PostgreSQL database dump
--

\restrict 1df3yJZW2H8ZW9yP5XbHZyAmdbAPSV8Fjs0jeaVZxk8v7nhSY5PJAMWPcw0uvBU

-- Dumped from database version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activities (
    id bigint NOT NULL,
    user_id uuid,
    action character varying(100) NOT NULL,
    target_type character varying(50),
    target_id text,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_public boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: activities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.activities_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: activities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.activities_id_seq OWNED BY public.activities.id;


--
-- Name: ai_guest_daily_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_guest_daily_usage (
    id bigint NOT NULL,
    usage_date date NOT NULL,
    fingerprint_hash character varying(128) NOT NULL,
    ip_address inet,
    device_id character varying(255),
    user_agent text,
    request_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_guest_daily_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_guest_daily_usage_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_guest_daily_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_guest_daily_usage_id_seq OWNED BY public.ai_guest_daily_usage.id;


--
-- Name: artists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artists (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(300) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: artists_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.artists_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: artists_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.artists_id_seq OWNED BY public.artists.id;


--
-- Name: authors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.authors (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(300) NOT NULL,
    bio text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: authors_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.authors_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: authors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.authors_id_seq OWNED BY public.authors.id;


--
-- Name: bookmarks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookmarks (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    series_id uuid NOT NULL,
    last_read_chapter_id bigint,
    status character varying(30) DEFAULT 'reading'::character varying,
    progress numeric DEFAULT 0,
    is_favorite boolean DEFAULT true NOT NULL,
    notify_new_chapters boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bookmarks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bookmarks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bookmarks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bookmarks_id_seq OWNED BY public.bookmarks.id;


--
-- Name: chapter_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chapter_pages (
    id bigint NOT NULL,
    chapter_id bigint NOT NULL,
    page_number integer NOT NULL,
    image_url text NOT NULL,
    width integer,
    height integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chapter_pages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chapter_pages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chapter_pages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chapter_pages_id_seq OWNED BY public.chapter_pages.id;


--
-- Name: chapter_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chapter_views (
    id bigint NOT NULL,
    chapter_id bigint NOT NULL,
    series_id uuid NOT NULL,
    user_id uuid,
    ip_address inet,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: chapter_views_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chapter_views_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chapter_views_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chapter_views_id_seq OWNED BY public.chapter_views.id;


--
-- Name: chapter_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chapter_votes (
    id integer NOT NULL,
    series_slug character varying(300) NOT NULL,
    chapter_number numeric(8,2) NOT NULL,
    visitor_id character varying(255) NOT NULL,
    rating integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chapter_votes_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: chapter_votes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chapter_votes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chapter_votes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chapter_votes_id_seq OWNED BY public.chapter_votes.id;


--
-- Name: chapters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chapters (
    id bigint NOT NULL,
    series_id uuid NOT NULL,
    number numeric(12,3) NOT NULL,
    title character varying(500),
    slug character varying(500) NOT NULL,
    page_count integer DEFAULT 0 NOT NULL,
    view_count bigint DEFAULT 0 NOT NULL,
    comment_count integer DEFAULT 0 NOT NULL,
    rating numeric(3,2),
    rating_count integer DEFAULT 0 NOT NULL,
    is_premium boolean DEFAULT false NOT NULL,
    coin_cost integer DEFAULT 0 NOT NULL,
    is_published boolean DEFAULT true NOT NULL,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chapters_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chapters_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chapters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chapters_id_seq OWNED BY public.chapters.id;


--
-- Name: genres; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.genres (
    id bigint NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(120) NOT NULL,
    description text,
    icon character varying(100),
    color character varying(20),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: genres_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.genres_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: genres_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.genres_id_seq OWNED BY public.genres.id;


--
-- Name: reading_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reading_history (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    chapter_id bigint NOT NULL,
    series_id uuid NOT NULL,
    last_page integer DEFAULT 0,
    is_completed boolean DEFAULT false,
    scroll_position integer DEFAULT 0,
    progress_percentage numeric(5,2) DEFAULT 0,
    total_pages integer DEFAULT 0,
    device_id character varying(255),
    synced_at timestamp with time zone DEFAULT now(),
    read_at timestamp with time zone DEFAULT now() NOT NULL,
    first_read_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: reading_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reading_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reading_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reading_history_id_seq OWNED BY public.reading_history.id;


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    revoked_at timestamp with time zone
);


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.refresh_tokens_id_seq OWNED BY public.refresh_tokens.id;


--
-- Name: series; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.series (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(500) NOT NULL,
    original_title character varying(500),
    alternative_titles text[] DEFAULT ARRAY[]::text[] NOT NULL,
    slug character varying(300) NOT NULL,
    synopsis text,
    description text,
    content_type character varying(30) DEFAULT 'manhwa'::character varying NOT NULL,
    type character varying(30),
    status character varying(30) DEFAULT 'ongoing'::character varying NOT NULL,
    cover_url text,
    cover_url_web text,
    cover_url_tmo text,
    cover_url_oni text,
    banner_url text,
    author_id bigint,
    artist_id bigint,
    release_year integer,
    country character varying(100),
    original_language character varying(30),
    language character varying(10) DEFAULT 'es'::character varying,
    source character varying(100),
    demography character varying(100),
    is_adult boolean DEFAULT false NOT NULL,
    is_featured boolean DEFAULT false NOT NULL,
    is_hot boolean DEFAULT false NOT NULL,
    is_new boolean DEFAULT false NOT NULL,
    is_trending boolean DEFAULT false NOT NULL,
    view_count bigint DEFAULT 0 NOT NULL,
    daily_views bigint DEFAULT 0 NOT NULL,
    weekly_views bigint DEFAULT 0 NOT NULL,
    monthly_views bigint DEFAULT 0 NOT NULL,
    bookmark_count integer DEFAULT 0 NOT NULL,
    likes_count integer DEFAULT 0 NOT NULL,
    rating_average numeric(4,2),
    rating_count integer DEFAULT 0 NOT NULL,
    chapter_count integer DEFAULT 0 NOT NULL,
    in_spaces boolean DEFAULT false NOT NULL,
    origins text[] DEFAULT ARRAY[]::text[] NOT NULL,
    comment_count integer DEFAULT 0 NOT NULL,
    meta_title text,
    meta_description text,
    last_chapter_at timestamp with time zone,
    average_chapter_length numeric,
    themes text[],
    tone text,
    protagonist_type text,
    has_anime boolean DEFAULT false,
    has_drama boolean DEFAULT false,
    narrative_tropes text[],
    official_hashtags text[],
    age_recommendation text,
    content_warnings text[],
    romance_level text,
    power_system text,
    entry_barrier text,
    serialization_platform text,
    adaptations text[],
    art_style text,
    color_scheme text,
    awards text[],
    world_building_depth text,
    publication_format text,
    has_physical_edition boolean DEFAULT false,
    trigger_warnings text[],
    target_demographic text,
    international_title_variations text[],
    update_reliability text,
    writing_quality text,
    cultural_notes text,
    educational_value text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: series_genres; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.series_genres (
    series_id uuid NOT NULL,
    genre_id bigint NOT NULL
);


--
-- Name: series_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.series_likes (
    user_id uuid NOT NULL,
    series_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: series_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.series_views (
    id bigint NOT NULL,
    series_id uuid NOT NULL,
    user_id uuid,
    visitor_id text,
    ip_address inet,
    viewed_at timestamp with time zone DEFAULT now()
);


--
-- Name: series_views_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.series_views_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: series_views_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.series_views_id_seq OWNED BY public.series_views.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text,
    display_name character varying(100),
    avatar_url text,
    banner_url text,
    banner_position_x integer DEFAULT 50 NOT NULL
        CONSTRAINT users_banner_position_x_range CHECK (banner_position_x BETWEEN 0 AND 100),
    banner_position_y integer DEFAULT 50 NOT NULL
        CONSTRAINT users_banner_position_y_range CHECK (banner_position_y BETWEEN 0 AND 100),
    bio text,
    location character varying(255),
    website text,
    role character varying(30) DEFAULT 'user'::character varying NOT NULL,
    status character varying(30) DEFAULT 'active'::character varying NOT NULL,
    is_premium boolean DEFAULT false NOT NULL,
    premium_until timestamp with time zone,
    email_verified_at timestamp with time zone,
    verification_token text,
    reset_token text,
    reset_token_expires timestamp with time zone,
    oauth_provider character varying(20),
    oauth_id character varying(255),
    experience integer DEFAULT 0 NOT NULL,
    level integer DEFAULT 1 NOT NULL,
    coins integer DEFAULT 0 NOT NULL,
    streak integer DEFAULT 0 NOT NULL,
    followers_count integer DEFAULT 0 NOT NULL,
    following_count integer DEFAULT 0 NOT NULL,
    social_links jsonb DEFAULT '{}'::jsonb NOT NULL,
    collections_count integer DEFAULT 0 NOT NULL,
    theme_primary_color character varying(20),
    theme_accent_color character varying(20),
    theme_mode character varying(20) DEFAULT 'system'::character varying NOT NULL,
    preferences jsonb DEFAULT '{}'::jsonb NOT NULL,
    timezone character varying(100),
    last_login_at timestamp with time zone,
    last_login_ip inet,
    login_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: activities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities ALTER COLUMN id SET DEFAULT nextval('public.activities_id_seq'::regclass);


--
-- Name: ai_guest_daily_usage id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_guest_daily_usage ALTER COLUMN id SET DEFAULT nextval('public.ai_guest_daily_usage_id_seq'::regclass);


--
-- Name: artists id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artists ALTER COLUMN id SET DEFAULT nextval('public.artists_id_seq'::regclass);


--
-- Name: authors id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.authors ALTER COLUMN id SET DEFAULT nextval('public.authors_id_seq'::regclass);


--
-- Name: bookmarks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks ALTER COLUMN id SET DEFAULT nextval('public.bookmarks_id_seq'::regclass);


--
-- Name: chapter_pages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_pages ALTER COLUMN id SET DEFAULT nextval('public.chapter_pages_id_seq'::regclass);


--
-- Name: chapter_views id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_views ALTER COLUMN id SET DEFAULT nextval('public.chapter_views_id_seq'::regclass);


--
-- Name: chapter_votes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_votes ALTER COLUMN id SET DEFAULT nextval('public.chapter_votes_id_seq'::regclass);


--
-- Name: chapters id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapters ALTER COLUMN id SET DEFAULT nextval('public.chapters_id_seq'::regclass);


--
-- Name: genres id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.genres ALTER COLUMN id SET DEFAULT nextval('public.genres_id_seq'::regclass);


--
-- Name: reading_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_history ALTER COLUMN id SET DEFAULT nextval('public.reading_history_id_seq'::regclass);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('public.refresh_tokens_id_seq'::regclass);


--
-- Name: series_views id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_views ALTER COLUMN id SET DEFAULT nextval('public.series_views_id_seq'::regclass);


--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);


--
-- Name: ai_guest_daily_usage ai_guest_daily_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_guest_daily_usage
    ADD CONSTRAINT ai_guest_daily_usage_pkey PRIMARY KEY (id);


--
-- Name: ai_guest_daily_usage ai_guest_daily_usage_usage_date_fingerprint_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_guest_daily_usage
    ADD CONSTRAINT ai_guest_daily_usage_usage_date_fingerprint_hash_key UNIQUE (usage_date, fingerprint_hash);


--
-- Name: artists artists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artists
    ADD CONSTRAINT artists_pkey PRIMARY KEY (id);


--
-- Name: artists artists_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artists
    ADD CONSTRAINT artists_slug_key UNIQUE (slug);


--
-- Name: authors authors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.authors
    ADD CONSTRAINT authors_pkey PRIMARY KEY (id);


--
-- Name: authors authors_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.authors
    ADD CONSTRAINT authors_slug_key UNIQUE (slug);


--
-- Name: bookmarks bookmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_pkey PRIMARY KEY (id);


--
-- Name: bookmarks bookmarks_user_id_series_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_user_id_series_id_key UNIQUE (user_id, series_id);


--
-- Name: chapter_pages chapter_pages_chapter_id_page_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_pages
    ADD CONSTRAINT chapter_pages_chapter_id_page_number_key UNIQUE (chapter_id, page_number);


--
-- Name: chapter_pages chapter_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_pages
    ADD CONSTRAINT chapter_pages_pkey PRIMARY KEY (id);


--
-- Name: chapter_views chapter_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_views
    ADD CONSTRAINT chapter_views_pkey PRIMARY KEY (id);


--
-- Name: chapter_votes chapter_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_votes
    ADD CONSTRAINT chapter_votes_pkey PRIMARY KEY (id);


--
-- Name: chapter_votes chapter_votes_series_slug_chapter_number_visitor_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_votes
    ADD CONSTRAINT chapter_votes_series_slug_chapter_number_visitor_id_key UNIQUE (series_slug, chapter_number, visitor_id);


--
-- Name: chapters chapters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_pkey PRIMARY KEY (id);


--
-- Name: chapters chapters_series_id_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_series_id_number_key UNIQUE (series_id, number);


--
-- Name: chapters chapters_series_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_series_id_slug_key UNIQUE (series_id, slug);


--
-- Name: genres genres_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.genres
    ADD CONSTRAINT genres_name_key UNIQUE (name);


--
-- Name: genres genres_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.genres
    ADD CONSTRAINT genres_pkey PRIMARY KEY (id);


--
-- Name: genres genres_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.genres
    ADD CONSTRAINT genres_slug_key UNIQUE (slug);


--
-- Name: reading_history reading_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_history
    ADD CONSTRAINT reading_history_pkey PRIMARY KEY (id);


--
-- Name: reading_history reading_history_user_id_chapter_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_history
    ADD CONSTRAINT reading_history_user_id_chapter_id_key UNIQUE (user_id, chapter_id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: series_genres series_genres_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_genres
    ADD CONSTRAINT series_genres_pkey PRIMARY KEY (series_id, genre_id);


--
-- Name: series_likes series_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_likes
    ADD CONSTRAINT series_likes_pkey PRIMARY KEY (user_id, series_id);


--
-- Name: series series_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series
    ADD CONSTRAINT series_pkey PRIMARY KEY (id);


--
-- Name: series series_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series
    ADD CONSTRAINT series_slug_key UNIQUE (slug);


--
-- Name: series_views series_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_views
    ADD CONSTRAINT series_views_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_chapter_votes_slug_num; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chapter_votes_slug_num ON public.chapter_votes USING btree (series_slug, chapter_number);


--
-- Name: idx_chapter_votes_visitor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chapter_votes_visitor ON public.chapter_votes USING btree (visitor_id);


--
-- Name: idx_series_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_series_slug ON public.series USING btree (slug);


--
-- Name: idx_series_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_series_updated ON public.series USING btree (updated_at DESC);


--
-- Name: idx_users_oauth; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_users_oauth ON public.users USING btree (oauth_provider, oauth_id) WHERE (oauth_provider IS NOT NULL);


--
-- Name: activities activities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: bookmarks bookmarks_last_read_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_last_read_chapter_id_fkey FOREIGN KEY (last_read_chapter_id) REFERENCES public.chapters(id) ON DELETE SET NULL;


--
-- Name: bookmarks bookmarks_series_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.series(id) ON DELETE CASCADE;


--
-- Name: bookmarks bookmarks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: chapter_pages chapter_pages_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_pages
    ADD CONSTRAINT chapter_pages_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE;


--
-- Name: chapter_views chapter_views_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_views
    ADD CONSTRAINT chapter_views_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE;


--
-- Name: chapter_views chapter_views_series_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_views
    ADD CONSTRAINT chapter_views_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.series(id) ON DELETE CASCADE;


--
-- Name: chapter_views chapter_views_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_views
    ADD CONSTRAINT chapter_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: chapters chapters_series_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.series(id) ON DELETE CASCADE;


--
-- Name: reading_history reading_history_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_history
    ADD CONSTRAINT reading_history_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE;


--
-- Name: reading_history reading_history_series_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_history
    ADD CONSTRAINT reading_history_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.series(id) ON DELETE CASCADE;


--
-- Name: reading_history reading_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_history
    ADD CONSTRAINT reading_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: series series_artist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series
    ADD CONSTRAINT series_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES public.artists(id) ON DELETE SET NULL;


--
-- Name: series series_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series
    ADD CONSTRAINT series_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.authors(id) ON DELETE SET NULL;


--
-- Name: series_genres series_genres_genre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_genres
    ADD CONSTRAINT series_genres_genre_id_fkey FOREIGN KEY (genre_id) REFERENCES public.genres(id) ON DELETE CASCADE;


--
-- Name: series_genres series_genres_series_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_genres
    ADD CONSTRAINT series_genres_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.series(id) ON DELETE CASCADE;


--
-- Name: series_likes series_likes_series_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_likes
    ADD CONSTRAINT series_likes_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.series(id) ON DELETE CASCADE;


--
-- Name: series_likes series_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_likes
    ADD CONSTRAINT series_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: series_views series_views_series_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_views
    ADD CONSTRAINT series_views_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.series(id) ON DELETE CASCADE;


--
-- Name: series_views series_views_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_views
    ADD CONSTRAINT series_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict 1df3yJZW2H8ZW9yP5XbHZyAmdbAPSV8Fjs0jeaVZxk8v7nhSY5PJAMWPcw0uvBU
