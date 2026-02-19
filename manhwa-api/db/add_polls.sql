-- Agregar soporte para encuestas en comentarios

-- Tabla para almacenar opciones de encuestas
CREATE TABLE IF NOT EXISTS comment_polls (
    id SERIAL PRIMARY KEY,
    comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(comment_id)
);

-- Tabla para almacenar opciones de cada encuesta
CREATE TABLE IF NOT EXISTS poll_options (
    id SERIAL PRIMARY KEY,
    poll_id INTEGER NOT NULL REFERENCES comment_polls(id) ON DELETE CASCADE,
    option_index INTEGER NOT NULL,
    option_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(poll_id, option_index)
);

-- Tabla para almacenar votos de usuarios en encuestas
CREATE TABLE IF NOT EXISTS poll_votes (
    id SERIAL PRIMARY KEY,
    poll_id INTEGER NOT NULL REFERENCES comment_polls(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    option_index INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(poll_id, user_id)
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON poll_options(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user_id ON poll_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_polls_comment_id ON comment_polls(comment_id);
