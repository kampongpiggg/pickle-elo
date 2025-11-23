from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field

# NEW:
from sqlalchemy import Column
from sqlalchemy.dialects.sqlite import JSON  # works fine for your sqlite DB

class Player(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    rating: int = 1000  # starting Elo

class Match(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    format: str  # "singles" | "doubles"
    scoreA: int
    scoreB: int
    played_at: datetime = Field(default_factory=datetime.utcnow)

    # NEW FIELDS:
    source: str = Field(default="manual")
    analytics: Optional[dict] = Field(
        default=None,
        sa_column=Column(JSON)
    )

class MatchPlayer(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    match_id: int = Field(foreign_key="match.id")
    player_id: int = Field(foreign_key="player.id")
    team_side: str  # "A" or "B"

    winners: int = 0  # points won by this player
    errors: int = 0   # points lost by this player

    rating_before: int
    rating_after: int
