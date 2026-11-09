from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
import models
import requests
import os
from dotenv import load_dotenv
from openai import AsyncOpenAI
from fastapi import UploadFile, File
import base64
import json

load_dotenv()
PROXYAPI_KEY = os.getenv("PROXYAPI_KEY")

ai_client = None
if PROXYAPI_KEY and PROXYAPI_KEY != "ТВОЙ_КЛЮЧ_ОТ_PROXYAPI":
    ai_client = AsyncOpenAI(
        api_key=PROXYAPI_KEY,
        base_url="https://api.proxyapi.ru/openai/v1"
    )

from database import engine, get_db

models.Base.metadata.create_all(bind=engine)
app = FastAPI(title="Пожрём? by Kiiara API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class ProductCreate(BaseModel):
    name: str
    calories: float = 0
    protein: float = 0
    fat: float = 0
    carbs: float = 0

@app.get("/api/products")
def get_products(db: Session = Depends(get_db)):
    return db.query(models.Product).all()

@app.post("/api/products")
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    db_product = models.Product(**product.dict())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

@app.get("/api/inventory")
def get_inventory(db: Session = Depends(get_db)):
    items = db.query(models.Inventory).all()
    result = []
    for item in items:
        result.append({
            "id": item.id,
            "product_id": item.product_id,
            "amount": item.amount,
            "product_name": item.product.name if item.product else "Неизвестно"
        })
    return result

@app.get("/api/menu")
def get_menu(db: Session = Depends(get_db)):
    meals = db.query(models.MenuMeal).all()
    if not meals:
        default_meals = [
            models.MenuMeal(day="Пн", time="Завтрак", name="Яйца, хлебцы и овощи", detail="2 яйца, 2 хлебца, овощи", done=False),
            models.MenuMeal(day="Пн", time="Обед", name="Паста арабьята с курицей", detail="Макароны, курица, томаты, сыр", done=False),
            models.MenuMeal(day="Пн", time="Ужин", name="Минтай с картофелем", detail="Минтай 150 г, картофель 250 г", done=False)
        ]
        db.bulk_save_objects(default_meals)
        db.commit()
        meals = db.query(models.MenuMeal).all()
    return meals

@app.post("/api/menu/{meal_id}/toggle")
def toggle_meal(meal_id: int, db: Session = Depends(get_db)):
    meal = db.query(models.MenuMeal).filter(models.MenuMeal.id == meal_id).first()
    if meal:
        # Автоматическое списание/возврат со склада
        recipe = db.query(models.Recipe).filter(models.Recipe.name == meal.name).first()
        if recipe:
            ings = db.query(models.RecipeIngredient).filter(models.RecipeIngredient.recipe_id == recipe.id).all()
            for ing in ings:
                inv = db.query(models.Inventory).filter(models.Inventory.product_id == ing.product_id).first()
                if not inv:
                    inv = models.Inventory(product_id=ing.product_id, amount=0)
                    db.add(inv)
                
                if not meal.done:
                    # Отмечаем съеденным -> списываем
                    inv.amount -= ing.amount
                else:
                    # Снимаем отметку -> возвращаем на склад
                    inv.amount += ing.amount
                    
        meal.done = not meal.done
        db.commit()
    return meal

class RecipeCreate(BaseModel):
    name: str
    description: str

@app.get("/api/recipes")
def get_recipes(db: Session = Depends(get_db)):
    recipes = db.query(models.Recipe).all()
    res = []
    for r in recipes:
        ings = db.query(models.RecipeIngredient).filter(models.RecipeIngredient.recipe_id == r.id).all()
        res.append({
            "id": r.id, 
            "name": r.name, 
            "description": r.description,
            "ingredients": [{"id": i.id, "product_id": i.product_id, "amount": i.amount, "product_name": i.product.name} for i in ings]
        })
    return res

@app.post("/api/recipes")
def create_recipe(recipe: RecipeCreate, db: Session = Depends(get_db)):
    db_recipe = models.Recipe(**recipe.dict())
    db.add(db_recipe)
    db.commit()
    db.refresh(db_recipe)
    return db_recipe

class IngredientCreate(BaseModel):
    product_id: int
    amount: float

@app.post("/api/recipes/{recipe_id}/ingredients")
def add_ingredient(recipe_id: int, ing: IngredientCreate, db: Session = Depends(get_db)):
    db_ing = models.RecipeIngredient(recipe_id=recipe_id, product_id=ing.product_id, amount=ing.amount)
    db.add(db_ing)
    db.commit()
    return {"status": "ok"}

class InventoryAdd(BaseModel):
    product_id: int
    amount: float

@app.post("/api/inventory/add")
def add_to_inventory(item: InventoryAdd, db: Session = Depends(get_db)):
    inv = db.query(models.Inventory).filter(models.Inventory.product_id == item.product_id).first()
    if inv:
        inv.amount += item.amount
    else:
        inv = models.Inventory(product_id=item.product_id, amount=item.amount)
        db.add(inv)
    db.commit()
    return {"status": "ok"}

class TargetUpdate(BaseModel):
    calories: int
    protein: int
    fat: int
    carbs: int

@app.get("/api/targets")
def get_targets(db: Session = Depends(get_db)):
    t = db.query(models.UserTarget).first()
    if not t:
        t = models.UserTarget()
        db.add(t)
        db.commit()
        db.refresh(t)
    return t

@app.post("/api/targets")
def update_targets(targets: TargetUpdate, db: Session = Depends(get_db)):
    t = db.query(models.UserTarget).first()
    if not t:
        t = models.UserTarget(**targets.dict())
        db.add(t)
    else:
        t.calories = targets.calories
        t.protein = targets.protein
        t.fat = targets.fat
        t.carbs = targets.carbs
    db.commit()
    return t

class DiaryCreate(BaseModel):
    date: str
    name: str
    amount: float
    calories: float
    protein: float
    fat: float
    carbs: float

@app.get("/api/diary")
def get_diary(date: str, db: Session = Depends(get_db)):
    return db.query(models.DiaryEntry).filter(models.DiaryEntry.date == date).all()

@app.post("/api/diary")
def add_diary(entry: DiaryCreate, db: Session = Depends(get_db)):
    db_entry = models.DiaryEntry(**entry.dict())
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry

@app.get("/api/barcode/{barcode}")
def search_barcode(barcode: str):
    try:
        res = requests.get(f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json", timeout=5)
        if res.status_code == 200:
            data = res.json()
            if data.get("status") == 1:
                p = data["product"]
                nut = p.get("nutriments", {})
                name = p.get("product_name_ru") or p.get("product_name") or "Неизвестный продукт"
                return {
                    "found": True,
                    "name": name,
                    "calories": nut.get("energy-kcal_100g", 0),
                    "protein": nut.get("proteins_100g", 0),
                    "fat": nut.get("fat_100g", 0),
                    "carbs": nut.get("carbohydrates_100g", 0)
                }
    except Exception as e:
        pass
    return {"found": False}

@app.post("/api/vision/label")
async def recognize_label(file: UploadFile = File(...)):
    if not ai_client:
        return {"error": "API ключ ProxyAPI не настроен. Добавь его в файл .env"}
        
    try:
        contents = await file.read()
        base64_image = base64.b64encode(contents).decode('utf-8')
        
        prompt = '''
        Ты диетолог. Проанализируй эту этикетку продукта. 
        Извлеки КБЖУ строго на 100 грамм (или 100 мл).
        Если видно название, извлеки и его.
        Верни ответ СТРОГО в формате валидного JSON без маркдауна и лишнего текста:
        {
          "name": "Название (если есть, иначе пусто)",
          "calories": 123.4,
          "protein": 12.3,
          "fat": 4.5,
          "carbs": 6.7
        }
        '''
        
        response = await ai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=300
        )
        
        text = response.choices[0].message.content
        text = text.replace('```json', '').replace('```', '').strip()
        data = json.loads(text)
        return {"success": True, "data": data}
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/vision/menu")
async def recognize_menu(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not ai_client:
        return {"error": "API ключ ProxyAPI не настроен. Добавь его в файл .env"}
        
    try:
        contents = await file.read()
        base64_image = base64.b64encode(contents).decode('utf-8')
        
        prompt = '''
        Проанализируй этот скриншот или фото меню питания. 
        Извлеки все приемы пищи на каждый день.
        Верни ответ СТРОГО в формате валидного JSON (список объектов), без маркдауна и лишнего текста. 
        Дни недели сокращай строго так: Пн, Вт, Ср, Чт, Пт, Сб, Вс.
        Время (time): Завтрак, Обед, Ужин, Перекус (выбери подходящее).
        Формат:
        [
          {"day": "Пн", "time": "Завтрак", "name": "Название блюда", "detail": "Состав или граммовки"},
          ...
        ]
        '''
        
        response = await ai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=1500
        )
        
        text = response.choices[0].message.content
        text = text.replace('```json', '').replace('```', '').strip()
        meals_data = json.loads(text)
        
        # Очищаем старое меню перед импортом нового
        db.query(models.MenuMeal).delete()
        
        new_meals = []
        for m in meals_data:
            meal = models.MenuMeal(
                day=m.get("day", "Пн"),
                time=m.get("time", "Завтрак"),
                name=m.get("name", "Без названия"),
                detail=m.get("detail", ""),
                done=False
            )
            db.add(meal)
            new_meals.append(meal)
        db.commit()
        
        return {"success": True, "count": len(new_meals)}
    except Exception as e:
        return {"error": str(e)}
