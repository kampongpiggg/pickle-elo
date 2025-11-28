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

class PairChemistry(SQLModel, table=True):
    __table_args__ = {"schema": "pickle_elo"}

    # Composite primary key
    player_id_a: int = Field(primary_key=True)
    player_id_b: int = Field(primary_key=True)

    games_together: int

    beta_chemistry: float
    beta_t_stat: Optional[float] = None

    uplift_a_given_b: float
    uplift_b_given_a: float

    avg_point_share: float
    avg_point_share_base: float

    # This matches TIMESTAMPTZ with DEFAULT now()
    # You can supply it yourself or let DB default handle it.
    last_updated: datetime = Field(default_factory=datetime.utcnow)