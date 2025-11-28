from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field

class Player(SQLModel, table=True):
    __table_args__ = {"schema": "pickle_elo"}
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    rating: int = 1000  # starting Elo
    crowns_collected: int = Field(default=0)

class Match(SQLModel, table=True):
    __table_args__ = {"schema": "pickle_elo"}
    id: Optional[int] = Field(default=None, primary_key=True)
    format: str  # "singles" | "doubles"
    scoreA: int
    scoreB: int
    played_at: datetime = Field(default_factory=datetime.utcnow)

class MatchPlayer(SQLModel, table=True):
    __table_args__ = {"schema": "pickle_elo"}
    id: Optional[int] = Field(default=None, primary_key=True)
    match_id: int = Field(foreign_key="pickle_elo.match.id")
    player_id: int = Field(foreign_key="pickle_elo.player.id")
    team_side: str  # "A" or "B"

    winners: int = 0  # points won by this player
    errors: int = 0   # points lost by this player

    rating_before: int
    rating_after: int