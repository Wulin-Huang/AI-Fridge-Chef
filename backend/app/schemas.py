from pydantic import BaseModel, Field, model_validator


class IngredientItem(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    category: str | None = Field(default=None, max_length=16)
    quantity: str | None = Field(default=None, max_length=32)


class IngredientIn(BaseModel):
    names: list[str] = []
    category: str | None = None
    items: list[IngredientItem] = []

    @model_validator(mode="after")
    def _require_content(self):
        if not self.names and not self.items:
            raise ValueError("names 和 items 至少要提供一个")
        return self


class IngredientUpdate(BaseModel):
    quantity: str | None = None
    expires_at: str | None = None
    category: str | None = Field(default=None, max_length=16)


class RecognizeRequest(BaseModel):
    image_base64: str
    mime_type: str = "image/jpeg"


class StyleRequest(BaseModel):
    ingredients: list[str] = Field(min_length=1)


class RecipeRequest(BaseModel):
    ingredients: list[str] = Field(min_length=1)
    style: str = ""
    servings: int = Field(default=2, ge=1, le=20)
    preferences: str = ""
    excluded: list[str] = []
    count: int = Field(default=3, ge=1, le=5)


class NutritionRequest(BaseModel):
    recipe_name: str
    ingredients_desc: str
    servings: int = 2


class MealPlanRequest(BaseModel):
    ingredients: list[str] = Field(min_length=1)
    days: int = Field(default=3, ge=1, le=7)
    servings: int = Field(default=2, ge=1, le=20)
    preferences: str = ""
    meals: list[str] = []


class SavedPlanIn(BaseModel):
    title: str = Field(min_length=1, max_length=64)
    payload: dict


class GroceryRequest(BaseModel):
    target_dishes: list[str] = Field(min_length=1)
    current_ingredients: list[str] = []


class FavoriteIn(BaseModel):
    title: str
    emoji: str | None = None
    payload: dict


class CheckIn(BaseModel):
    recipe_name: str = Field(min_length=1, max_length=128)
    emoji: str | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    note: str | None = Field(default=None, max_length=256)


class CritiqueRequest(BaseModel):
    image_base64: str
    mime_type: str = "image/jpeg"
    recipe_name: str = ""
