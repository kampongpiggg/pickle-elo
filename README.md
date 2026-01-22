# 🏓 Pickleball Elo Rating

Pickleball Elo is a small-but-serious rating and stats tracker for me and my friends.

It combines:

- A **match logger** (singles & doubles)
- An **Elo-based rating system** tuned for pickleball
- Per-player **Contribution Index (CI)** and **Liability Index (LI)**
- Fun **player archetypes** (Playmaker, Team Carry, Wildcard, etc.)
- A **King / Queen of the Court** crown with reign timelines
- A clean **Next.js frontend**
- A **FastAPI backend** backed by Postgres (Supabase)

---

## Table of Contents

1. [High-Level Overview](#high-level-overview)  
2. [Repository Structure](#repository-structure)  
3. [Core Domain Model](#core-domain-model)  
4. [Rating & Stats Math](#rating--stats-math)  
   - [The Elo System](#the-elo-system)  
   - [King / Queen of the Court](#king--queen-of-the-court)  
   - [Chemistry Regression](#chemistry-regression)  
5. [Backend Implementation](#backend-implementation)  
6. [Frontend Implementation](#frontend-implementation)  
7. [To Be Continued](#to-be-continued)

---

## High-Level Overview

The system works as follows:

- You create **players**
- You log **matches** (singles or doubles) with:
  - Final score (e.g. 11–7)
  - Team A / Team B players
  - Optional per-player **winners** and **errors**
- The backend:
  - Computes Elo updates with **margin-of-victory (MOV)** scaling
  - Stores per-match `rating_before` / `rating_after`
  - Aggregates per-player stats:
    - Wins / losses
    - Winners & errors
    - Contribution Index (CI)
    - Liability Index (LI)
    - Archetypes
- The frontend:
  - Displays leaderboards
  - Enables fast match logging
  - Shows player dashboards and rating history
  - Includes a plain-language methodology page

---

## Repository Structure

```text
pickle-elo/
  backend/
    elo.py                # Elo, MOV, CI/LI math
    main.py               # FastAPI app & endpoints
    models.py             # SQLModel ORM models
    chemistry_service.py  # doubles chemistry regression
    requirements.txt

  frontend/
    app/
      page.tsx            # Home
      live/page.tsx       # Live match entry
      matches/page.tsx    # Match history
      players/            # Leaderboard & player profiles
      methodology/        # Explanation of the system
      chemistry/          # Chemistry visualization
    lib/
      api.ts              # API helpers
      dayjsTz.ts          # Timezone helpers
    public/
      hills-bg.svg
      knight.png
```

---

## Core Domain Model

The system revolves around four entities plus one derived classification.

### Player

Represents a real competitor.

- `id`, `name`
- `rating` (Elo)
- `wins`, `losses`
- `crowns_collected`
- `total_winners`, `total_errors`
- `contribution_index`
- `liability_index`
- `created_at`

Players are never hard-deleted to preserve history.

---

### Match

Represents one completed game.

- Singles or doubles
- Team A / Team B
- Final score
- Margin of victory
- Timestamp

Each match generates rating entries for all players involved.

---

### RatingEntry

The atomic unit of rating history.

- `player_id`, `match_id`
- `rating_before`
- `rating_after`
- `rating_delta`
- Win / loss flag

Used for rating history, CI / LI, and archetypes.

---

### ChemistryEntry

Captures doubles partner interactions.

- Player pair
- Expected outcome
- Actual outcome
- Excess performance

Feeds the chemistry regression model.

---

### PlayerArchetype (Derived)

Not stored directly. Inferred from:

- CI / LI
- Rating deltas
- Chemistry coefficients
- Volatility and trends

Examples include Playmaker, Anchor, Wildcard, Team Carry, and Specialists.

---

## Rating & Stats Math

The system prioritizes **interpretability**, **stability**, and **fun**.

It is tuned for:
- Small player pools
- Frequent rematches
- Doubles volatility
- Incomplete statistics

---

## The Elo System

### Singles Elo

Expected score:

E = 1 / (1 + 10^((R_opponent − R_player) / 400))

Rating update:

ΔR = K × (S − E)

---

### Doubles Elo

- Team rating = average of partners
- Expected outcome at team level
- Individual deltas distributed per player

---

### Margin-of-Victory Scaling

A dampened multiplier:
- Rewards dominance
- Prevents rating explosions
- Applies symmetrically

---

### Winners & Errors Attribution

If not logged:
- Winners inferred from points scored
- Errors inferred from points conceded
- Evenly split between teammates

Signals feed CI / LI only.

---

### Contribution Index (CI)

Measures positive impact beyond wins:

- Positive Elo deltas
- Winners above expectation
- Overperformance vs prediction

---

### Liability Index (LI)

Measures negative impact:

- Negative Elo deltas
- Errors above expectation
- Underperformance and volatility

CI and LI are orthogonal.

---

## King / Queen of the Court

The highest-rated active player holds the crown.

Tracked:
- Reign start
- Duration
- Total crowns
- Historical timelines

---

## Chemistry Regression

Doubles pairs may systematically over- or underperform.

The system:
- Compares expected vs actual outcomes
- Logs excess performance
- Fits a pairwise interaction model

Outputs synergy coefficients and chemistry networks.

---

## Backend Implementation

Built with **FastAPI** and **SQLModel**, backed by **Postgres (Supabase)**.

Principles:
- Server-authoritative computation
- Immutable rating history
- Full recomputation support

Key modules:
- `elo.py`
- `models.py`
- `chemistry_service.py`
- `main.py`

---

## Frontend Implementation

Built with **Next.js (App Router)** and TypeScript.

Responsibilities:
- Match entry
- Leaderboards and profiles
- Rating & chemistry visualization
- Methodology explanation

Design philosophy:
- Backend is the source of truth
- Minimal client state
- Fast, forgiving UX

---

## To Be Continued

Planned additions:

- Archetype clarifications
- Chemistry network explanation
