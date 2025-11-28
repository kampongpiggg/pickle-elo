# 🏓 Pickleball Elo Rating

Pickleball Elo is a small-but-serious rating and stats tracker for me and my friends!

It combines:

- A **match logger** (singles & doubles)
- An **Elo-based rating system** tuned for pickleball
- Per-player **Contribution Index (CI)** and **Liability Index (LI)**
- Fun **player archetypes** (Playmaker, Team Carry, Wildcard, etc.)
- A **King/Queen of the Court** crown with a reign timeline
- A clean **Next.js frontend** and a **FastAPI backend** with a Postgres/Supabase database

---

## Table of Contents

1. [High-Level Overview](#high-level-overview)  
2. [Repository Structure](#repository-structure)  
3. [Core Domain Model](#core-domain-model)  
4. [Rating & Stats Math](#rating--stats-math)  
   - [Singles Elo](#1-singles-elo)  
   - [Doubles Elo](#2-doubles-elo)  
   - [Auto-filling Winners & Errors](#3-auto-filling-winners--errors)  
   - [Contribution Index (CI) & Liability Index (LI)](#4-contribution-index-ci--liability-index-li)  
   - [Archetypes](#5-archetypes)  
   - [King/Queen of the Court](#6-kingqueen-of-the-court)  
   - [Chemistry Regression](#7-chemistry-regression)  
5. [Backend: FastAPI + SQLModel](#backend-fastapi--sqlmodel)  
6. [Frontend: Next.js App Router](#frontend-nextjs-app-router)  
7. [Running Locally](#running-locally)  
8. [Deployment Notes](#deployment-notes)  
9. [Extending the System](#extending-the-system)  
10. [Contributing](#contributing)  
11. [Disclaimer & Liability](#disclaimer--liability)

---

## High-Level Overview

The webapp's logic is:

- You create **players**
- You log **matches** (singles or doubles) with:
  - Final score (e.g., 11–7)
  - Which players were on Team A or Team B
  - (Optionally) per-player **winners** and **errors**, based on points won or points lost.
- The backend:
  - Computes Elo updates using a **margin-of-victory (MOV)** multiplier
  - Tracks **per-match rating_before / rating_after** for each player
  - Aggregates **per-player stats**:
    - Wins/Losses (overall, singles, doubles)
    - Total winners & errors
    - Net winners per match
    - Contribution Index (CI)
    - Liability Index (LI)
    - Archetypes
- The frontend:
  - Shows a **players leaderboard**
  - Lets you **log matches quickly**
  - Shows **per-player dashboards** with rating history and match breakdowns
  - Includes a **methodology page** with a non-technical explanation

---

## Repository Structure

Monorepo layout:

```text
pickle-elo/
  backend/
    elo.py          # Elo & rating math
    main.py         # FastAPI app & endpoints
    models.py       # SQLModel ORM models
    chemistry_service.py # runs regression analysis to quantify pair interactions
    requirements.txt
    pickle_elo.db   # (Postgres/Supabase)

  frontend/
    app/
      page.tsx         # Home
      live/page.tsx    # Live match entry
      matches/page.tsx # Recent matches list
      players/         # Leaderboard + player detail
      methodology/     # Methodology explanation
      chemistry/       # visualize chemistry network
    lib/
      api.ts           # API client utils
      dayjsTz.ts       # Timezone helpers
    public/
      hills-bg.svg
      knight.png
      ...
    package.json
    globals.css, tsconfig, next.config.ts, etc.
---
