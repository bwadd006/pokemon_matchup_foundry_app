PRAGMA foreign_keys = ON;

CREATE TABLE dataset_builds (
  id INTEGER PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  built_at TEXT NOT NULL,
  importer_version TEXT NOT NULL,
  source_commit TEXT NOT NULL,
  source_retrieved_at TEXT NOT NULL,
  override_revision TEXT NOT NULL,
  validation_status TEXT NOT NULL CHECK (validation_status IN ('pending', 'passed', 'failed'))
) STRICT;

CREATE TABLE source_references (
  id INTEGER PRIMARY KEY,
  identifier TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  revision TEXT,
  license TEXT,
  rights_notice TEXT
) STRICT;

CREATE TABLE generations (
  id INTEGER PRIMARY KEY CHECK (id BETWEEN 1 AND 99),
  identifier TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE
) STRICT;

CREATE TABLE types (
  id INTEGER PRIMARY KEY,
  identifier TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  introduced_generation_id INTEGER NOT NULL REFERENCES generations(id)
) STRICT;

CREATE TABLE generation_types (
  generation_id INTEGER NOT NULL REFERENCES generations(id),
  type_id INTEGER NOT NULL REFERENCES types(id),
  display_order INTEGER NOT NULL,
  PRIMARY KEY (generation_id, type_id),
  UNIQUE (generation_id, display_order)
) STRICT;

CREATE TABLE pokemon_species (
  id INTEGER PRIMARY KEY,
  national_dex_number INTEGER NOT NULL UNIQUE CHECK (national_dex_number > 0),
  identifier TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  introduced_generation_id INTEGER NOT NULL REFERENCES generations(id)
) STRICT;

CREATE TABLE form_categories (
  id INTEGER PRIMARY KEY,
  identifier TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL UNIQUE
) STRICT;

CREATE TABLE pokemon_forms (
  id INTEGER PRIMARY KEY,
  pokemon_id INTEGER NOT NULL,
  species_id INTEGER NOT NULL REFERENCES pokemon_species(id),
  identifier TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  form_name TEXT,
  category_id INTEGER NOT NULL REFERENCES form_categories(id),
  introduced_generation_id INTEGER NOT NULL REFERENCES generations(id),
  is_default INTEGER NOT NULL CHECK (is_default IN (0, 1)),
  is_battle_only INTEGER NOT NULL CHECK (is_battle_only IN (0, 1)),
  is_mega INTEGER NOT NULL CHECK (is_mega IN (0, 1)),
  form_order INTEGER NOT NULL,
  sort_order INTEGER NOT NULL
) STRICT;

CREATE INDEX pokemon_forms_species_idx
  ON pokemon_forms (species_id, sort_order, form_order, id);

CREATE INDEX pokemon_forms_pokemon_idx
  ON pokemon_forms (pokemon_id);

CREATE TABLE form_generations (
  form_id INTEGER NOT NULL REFERENCES pokemon_forms(id) ON DELETE CASCADE,
  generation_id INTEGER NOT NULL REFERENCES generations(id),
  PRIMARY KEY (form_id, generation_id)
) STRICT;

CREATE TABLE form_types (
  form_id INTEGER NOT NULL REFERENCES pokemon_forms(id) ON DELETE CASCADE,
  generation_id INTEGER NOT NULL REFERENCES generations(id),
  type_id INTEGER NOT NULL REFERENCES types(id),
  slot INTEGER NOT NULL CHECK (slot IN (1, 2)),
  PRIMARY KEY (form_id, generation_id, slot),
  UNIQUE (form_id, generation_id, type_id)
) STRICT;

CREATE TABLE stat_definitions (
  id INTEGER PRIMARY KEY,
  identifier TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  abbreviation TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL UNIQUE
) STRICT;

CREATE TABLE form_stats (
  form_id INTEGER NOT NULL REFERENCES pokemon_forms(id) ON DELETE CASCADE,
  generation_id INTEGER NOT NULL REFERENCES generations(id),
  stat_id INTEGER NOT NULL REFERENCES stat_definitions(id),
  base_value INTEGER NOT NULL CHECK (base_value > 0),
  PRIMARY KEY (form_id, generation_id, stat_id)
) STRICT;

CREATE TABLE abilities (
  id INTEGER PRIMARY KEY,
  identifier TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  introduced_generation_id INTEGER NOT NULL REFERENCES generations(id)
) STRICT;

CREATE TABLE form_abilities (
  form_id INTEGER NOT NULL REFERENCES pokemon_forms(id) ON DELETE CASCADE,
  generation_id INTEGER NOT NULL REFERENCES generations(id),
  ability_id INTEGER NOT NULL REFERENCES abilities(id),
  slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 3),
  is_hidden INTEGER NOT NULL CHECK (is_hidden IN (0, 1)),
  PRIMARY KEY (form_id, generation_id, slot),
  UNIQUE (form_id, generation_id, ability_id)
) STRICT;

CREATE TABLE type_chart_rulesets (
  id INTEGER PRIMARY KEY,
  identifier TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  matrix_hash TEXT NOT NULL UNIQUE
) STRICT;

CREATE TABLE generation_type_chart_rulesets (
  generation_id INTEGER PRIMARY KEY REFERENCES generations(id),
  ruleset_id INTEGER NOT NULL REFERENCES type_chart_rulesets(id)
) STRICT;

CREATE TABLE ruleset_types (
  ruleset_id INTEGER NOT NULL REFERENCES type_chart_rulesets(id),
  type_id INTEGER NOT NULL REFERENCES types(id),
  display_order INTEGER NOT NULL,
  PRIMARY KEY (ruleset_id, type_id),
  UNIQUE (ruleset_id, display_order)
) STRICT;

CREATE TABLE type_effectiveness (
  ruleset_id INTEGER NOT NULL REFERENCES type_chart_rulesets(id),
  attacking_type_id INTEGER NOT NULL REFERENCES types(id),
  defending_type_id INTEGER NOT NULL REFERENCES types(id),
  numerator INTEGER NOT NULL CHECK (numerator IN (0, 1, 2)),
  denominator INTEGER NOT NULL CHECK (denominator IN (1, 2)),
  PRIMARY KEY (ruleset_id, attacking_type_id, defending_type_id)
) STRICT;

CREATE TABLE image_assets (
  form_id INTEGER NOT NULL REFERENCES pokemon_forms(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  source_url TEXT,
  relative_path TEXT,
  source_reference_id INTEGER NOT NULL REFERENCES source_references(id),
  rights_notice TEXT NOT NULL,
  PRIMARY KEY (form_id, kind)
) STRICT;
