# Supabase Onboarding Schema

This document describes the database changes required to support the post-signup onboarding wizard (P0-5).

## Overview

Onboarding state is stored in the existing `user_profiles` table. Three new columns track where the user is in the setup process.

## SQL Migration

Run this SQL in your Supabase SQL Editor (or as a migration file):

```sql
-- Add onboarding columns to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_status  TEXT    NOT NULL DEFAULT 'not_started'
    CHECK (onboarding_status IN ('not_started', 'in_progress', 'completed')),
  ADD COLUMN IF NOT EXISTS onboarding_step    INTEGER NOT NULL DEFAULT 1
    CHECK (onboarding_step BETWEEN 1 AND 3),
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Index to quickly find users who haven't finished onboarding (optional, for analytics)
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding_status
  ON user_profiles (onboarding_status);
```

### If `user_profiles` doesn't exist yet

```sql
CREATE TABLE user_profiles (
  user_id                          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name                     TEXT NOT NULL DEFAULT 'FlowIQ User',
  currency                         TEXT NOT NULL DEFAULT 'USD',
  monthly_budget                   NUMERIC,
  monthly_income                   NUMERIC,
  monthly_income_day               INTEGER NOT NULL DEFAULT 1 CHECK (monthly_income_day BETWEEN 1 AND 31),
  monthly_rent                     NUMERIC,
  monthly_rent_day                 INTEGER NOT NULL DEFAULT 1 CHECK (monthly_rent_day BETWEEN 1 AND 31),
  monthly_subscriptions            NUMERIC,
  monthly_subscriptions_day        INTEGER NOT NULL DEFAULT 1 CHECK (monthly_subscriptions_day BETWEEN 1 AND 31),
  monthly_other_fixed_expenses     NUMERIC,
  monthly_other_fixed_expenses_day INTEGER NOT NULL DEFAULT 1 CHECK (monthly_other_fixed_expenses_day BETWEEN 1 AND 31),
  timezone                         TEXT NOT NULL DEFAULT 'UTC',
  onboarding_status                TEXT NOT NULL DEFAULT 'not_started'
    CHECK (onboarding_status IN ('not_started', 'in_progress', 'completed')),
  onboarding_step                  INTEGER NOT NULL DEFAULT 1 CHECK (onboarding_step BETWEEN 1 AND 3),
  onboarding_completed_at          TIMESTAMPTZ,
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Row Level Security (RLS)

Enable RLS and restrict access so each user can only see and modify their own profile:

```sql
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read their own profile
CREATE POLICY "users_read_own_profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own profile
CREATE POLICY "users_insert_own_profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own profile
CREATE POLICY "users_update_own_profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role (backend) bypasses RLS automatically
```

> **Note:** The FlowIQ backend uses the Supabase **service role key** (`SUPABASE_SERVICE_ROLE_KEY`) which bypasses RLS automatically. RLS protects direct client-side queries only.

## Column Reference

| Column | Type | Default | Description |
|---|---|---|---|
| `onboarding_status` | `TEXT` | `'not_started'` | One of `not_started`, `in_progress`, `completed` |
| `onboarding_step` | `INTEGER` | `1` | Current step (1 = Profile, 2 = Import, 3 = Explore) |
| `onboarding_completed_at` | `TIMESTAMPTZ` | `NULL` | Timestamp when the user completed onboarding |

## API Endpoint

The frontend updates onboarding state via:

```
PATCH /api/onboarding
```

Request body (all fields optional):

```json
{
  "onboarding_status": "in_progress",
  "onboarding_step": 2,
  "currency": "EUR"
}
```

Setting `onboarding_status` to `"completed"` automatically sets `onboarding_completed_at` to the current UTC timestamp if not already set.

## Backward Compatibility

Existing users who have a `user_profiles` row **without** the new columns will have `onboarding_status = NULL` (before migration) or the default `'not_started'` (after migration). The frontend treats `NULL` as completed so **existing users are not forced into the onboarding wizard**.
