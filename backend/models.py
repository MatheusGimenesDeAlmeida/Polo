from pydantic import BaseModel, HttpUrl
from typing import Optional


class FeedCreate(BaseModel):
    name: str
    url: HttpUrl
    category: str = "uncategorized"


class TagCreate(BaseModel):
    name: str
