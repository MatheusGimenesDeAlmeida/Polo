from pydantic import BaseModel, HttpUrl
from typing import Optional


class FeedCreate(BaseModel):
    name: str
    url: HttpUrl
    category: str = "uncategorized"


class TagCreate(BaseModel):
    name: str


class ReflectionUpdate(BaseModel):
    insight: Optional[str] = None
    nstech: Optional[str] = None
    ideia: Optional[str] = None
    anotacao: Optional[str] = None


class IdeiaCreate(BaseModel):
    content: str = ''
    color: str = '#c9a84c'


class IdeiaUpdate(BaseModel):
    content: Optional[str] = None
    color: Optional[str] = None
