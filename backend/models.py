from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    calories = Column(Float, default=0)
    protein = Column(Float, default=0)
    fat = Column(Float, default=0)
    carbs = Column(Float, default=0)

class Inventory(Base):
    __tablename__ = "inventory"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    amount = Column(Float, default=0)
    product = relationship("Product")

class Recipe(Base):
    __tablename__ = "recipes"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String)

class MenuMeal(Base):
    __tablename__ = "menu_meals"
    id = Column(Integer, primary_key=True, index=True)
    day = Column(String)
    time = Column(String)
    name = Column(String)
    detail = Column(String)
    done = Column(Boolean, default=False)

class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"
    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    amount = Column(Float, default=0)
    product = relationship("Product")

class UserTarget(Base):
    __tablename__ = "user_targets"
    id = Column(Integer, primary_key=True, index=True)
    calories = Column(Integer, default=2000)
    protein = Column(Integer, default=80)
    fat = Column(Integer, default=60)
    carbs = Column(Integer, default=200)

class DiaryEntry(Base):
    __tablename__ = "diary_entries"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, index=True)
    name = Column(String)
    amount = Column(Float)
    calories = Column(Float, default=0)
    protein = Column(Float, default=0)
    fat = Column(Float, default=0)
    carbs = Column(Float, default=0)
