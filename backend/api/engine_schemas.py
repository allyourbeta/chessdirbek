"""Pydantic schemas for engine games API."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict


class EngineGameCreate(BaseModel):
    """Schema for creating a new engine game."""
    model_config = ConfigDict(from_attributes=True)
    
    position_id: int
    start_fen: str
    moves_san: str = Field(..., min_length=1, description="Space-separated SAN moves")
    user_color: str
    engine_elo: int = Field(..., ge=1320, le=3190)
    result: str
    outcome: Optional[str] = None
    final_fen: str
    move_count: int = Field(..., ge=1)
    
    @field_validator('user_color')
    @classmethod
    def validate_color(cls, v):
        if v not in {'white', 'black'}:
            raise ValueError('user_color must be "white" or "black"')
        return v
    
    @field_validator('result')
    @classmethod
    def validate_result(cls, v):
        if v not in {'1-0', '0-1', '1/2-1/2', '*'}:
            raise ValueError('result must be one of: "1-0", "0-1", "1/2-1/2", "*"')
        return v
    
    @field_validator('outcome')
    @classmethod
    def validate_outcome(cls, v):
        if v is not None:
            allowed = {'checkmate', 'stalemate', 'insufficient', 'threefold', 
                      'fifty-move', 'resigned', 'abandoned', 'manual', 'unfinished'}
            if v not in allowed:
                raise ValueError(f'outcome must be one of: {allowed}')
        return v


class EngineGameOut(BaseModel):
    """Schema for returning a complete engine game."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    position_id: int
    start_fen: str
    moves_san: str
    user_color: str
    engine_elo: int
    result: str
    outcome: Optional[str]
    final_fen: str
    move_count: int
    created_at: datetime


class EngineGameBrief(BaseModel):
    """Schema for listing engine games (omits heavy moves_san field)."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    created_at: datetime
    user_color: str
    engine_elo: int
    result: str
    move_count: int