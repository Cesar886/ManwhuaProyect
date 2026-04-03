-- Enforce confidence range [0, 1] for behavioral archetype classification

ALTER TABLE user_behavior_reader_archetypes
    DROP CONSTRAINT IF EXISTS user_behavior_reader_archetypes_confidence_range;

ALTER TABLE user_behavior_reader_archetypes
    ADD CONSTRAINT user_behavior_reader_archetypes_confidence_range
    CHECK (confidence >= 0 AND confidence <= 1);

ALTER TABLE user_behavior_summary
    DROP CONSTRAINT IF EXISTS user_behavior_summary_reader_archetype_confidence_range;

ALTER TABLE user_behavior_summary
    ADD CONSTRAINT user_behavior_summary_reader_archetype_confidence_range
    CHECK (reader_archetype_confidence >= 0 AND reader_archetype_confidence <= 1);
