import {useState, useEffect} from 'react';
import {CalendarDays,ShoppingBasket,BookOpen,ChartNoAxesCombined,Settings,Plus,Check,Search,Camera} from 'lucide-react';

const API_URL = 'http://127.0.0.1:8000/api';

const getProductEmoji = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('куриц') || n.includes('грудк')) return '🍗';
  if (n.includes('яйц')) return '🥚';
  if (n.includes('сыр')) return '🧀';
  if (n.includes('молок')) return '🥛';
  if (n.includes('макарон') || n.includes('паст')) return '🍝';
  if (n.includes('рыб') || n.includes('минтай') || n.includes('лосос')) return '🐟';
  if (n.includes('овощ') || n.includes('салат') || n.includes('капуст')) return '🥗';
  if (n.includes('хлеб')) return '🍞';
  if (n.includes('мясо') || n.includes('говядин') || n.includes('свинин')) return '🥩';
  if (n.includes('рис') || n.includes('каша') || n.includes('гречк') || n.includes('овсян')) return '🥣';
  if (n.includes('яблок') || n.includes('фрукт') || n.includes('банан')) return '🍎';
  return '📦';
};


export default function App(){
  const [tab,setTab] = useState('Меню');
  const [meals, setMeals] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  
  const [targets, setTargets] = useState({calories:2000, protein:80, fat:60, carbs:200});
  const [diaryDate, setDiaryDate] = useState(new Date().toISOString().split('T')[0]);
  const [diaryEntries, setDiaryEntries] = useState<any[]>([]);

  const [showAddRecipe, setShowAddRecipe] = useState(false);
  const [newRecipe, setNewRecipe] = useState({name:"", description:""});
  const [day, setDay] = useState('Пн');
  
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProd, setNewProd] = useState({name:'', calories:'', protein:'', fat:'', carbs:''});
  const [barcode, setBarcode] = useState('');
  const [barcodeSearching, setBarcodeSearching] = useState(false);
  const [visionLoading, setVisionLoading] = useState(false);
  const [menuLoading, setMenuLoading] = useState(false);
  const [buyAmounts, setBuyAmounts] = useState<{[key:number]:string}>({});
  const [ingForms, setIngForms] = useState<{[key:number]:boolean}>({});
  const [newIng, setNewIng] = useState({product_id: 0, amount: ''});
  
  const [showAddDiary, setShowAddDiary] = useState(false);
  const [diaryForm, setDiaryForm] = useState({product_id: 0, amount: ''});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchDiary = async (d: string) => {
    try {
      const res = await fetch(`${API_URL}/diary?date=${d}`);
      setDiaryEntries(await res.json());
    } catch (e) {}
  };

  const fetchData = async () => {
    try {
      const [mRes, pRes, iRes, rRes, tRes] = await Promise.all([
        fetch(`${API_URL}/menu`),
        fetch(`${API_URL}/products`),
        fetch(`${API_URL}/inventory`),
        fetch(`${API_URL}/recipes`),
        fetch(`${API_URL}/targets`)
      ]);
      setMeals(await mRes.json());
      setProducts(await pRes.json());
      setInventory(await iRes.json());
      setRecipes(await rRes.json());
      setTargets(await tRes.json());
      fetchDiary(diaryDate);
    } catch (e) {
      console.error("API error", e);
    }
  };

  const toggleMeal = async (id: number) => {
    await fetch(`${API_URL}/menu/${id}/toggle`, {method: 'POST'});
    fetchData();
  };

  
  
  
  const handleMenuUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setMenuLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch(`${API_URL}/vision/menu`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (data.error) {
        alert('Ошибка ИИ: ' + data.error);
      } else if (data.success) {
        alert(`Успешно загружено блюд: ${data.count}`);
        fetchData();
      }
    } catch (err) {
      alert('Ошибка при отправке фото на сервер.');
    }
    setMenuLoading(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setVisionLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch(`${API_URL}/vision/label`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (data.error) {
        alert('Ошибка ИИ: ' + data.error);
      } else if (data.success) {
        setNewProd({
          name: data.data.name || newProd.name,
          calories: String(data.data.calories || 0),
          protein: String(data.data.protein || 0),
          fat: String(data.data.fat || 0),
          carbs: String(data.data.carbs || 0)
        });
        alert('Данные успешно распознаны!');
      }
    } catch (err) {
      alert('Ошибка при отправке фото на сервер.');
    }
    setVisionLoading(false);
  };

  const searchBarcode = async () => {
    if (!barcode) return;
    setBarcodeSearching(true);
    try {
      const res = await fetch(`${API_URL}/barcode/${barcode}`);
      const data = await res.json();
      if (data.found) {
        setNewProd({
          name: data.name,
          calories: String(data.calories),
          protein: String(data.protein),
          fat: String(data.fat),
          carbs: String(data.carbs)
        });
      } else {
        alert('Продукт не найден в Open Food Facts.');
      }
    } catch(e) {
      alert('Ошибка при поиске.');
    }
    setBarcodeSearching(false);
  };

  const addProduct = async () => {
    if (!newProd.name) return;
    await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        name: newProd.name,
        calories: Number(newProd.calories)||0,
        protein: Number(newProd.protein)||0,
        fat: Number(newProd.fat)||0,
        carbs: Number(newProd.carbs)||0
      })
    });
    setNewProd({name:'', calories:'', protein:'', fat:'', carbs:''});
    setShowAddProduct(false); setBarcode('');
    fetchData();
  };

  const buyProduct = async (productId: number) => {
    const amount = Number(buyAmounts[productId]);
    if (!amount || amount <= 0) return;
    await fetch(`${API_URL}/inventory/add`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({product_id: productId, amount})
    });
    setBuyAmounts({...buyAmounts, [productId]: ''});
    fetchData();
  };

  const addIngredient = async (recipeId: number) => {
    if (!newIng.product_id || !newIng.amount) return;
    await fetch(`${API_URL}/recipes/${recipeId}/ingredients`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({product_id: Number(newIng.product_id), amount: Number(newIng.amount)})
    });
    setNewIng({product_id: 0, amount: ''});
    setIngForms({...ingForms, [recipeId]: false});
    fetchData();
  };

  const updateTargets = async () => {
    await fetch(`${API_URL}/targets`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(targets)
    });
    alert('Нормы сохранены!');
  };

  const addDiaryEntry = async () => {
    const prod = products.find(p => p.id === Number(diaryForm.product_id));
    const amount = Number(diaryForm.amount);
    if (!prod || !amount) return;
    
    const coef = amount / 100;
    const entry = {
      date: diaryDate,
      name: prod.name,
      amount: amount,
      calories: Math.round(prod.calories * coef),
      protein: Math.round(prod.protein * coef * 10)/10,
      fat: Math.round(prod.fat * coef * 10)/10,
      carbs: Math.round(prod.carbs * coef * 10)/10,
    };
    
    await fetch(`${API_URL}/diary`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(entry)
    });
    setShowAddDiary(false);
    setDiaryForm({product_id:0, amount:''});
    fetchDiary(diaryDate);
  };

  const days = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  const currentMeals = meals.filter(m => m.day === day);
  const nav = [['Меню',CalendarDays],['Покупки',ShoppingBasket],['Рецепты',BookOpen],['Дневник',ChartNoAxesCombined],['Мои нормы',Settings]] as const;

  const getStock = (prodId: number) => {
    const item = inventory.find(i => i.product_id === prodId);
    return item ? item.amount : 0;
  };

  return <div className="app">
    <header>
      <div><div className="brand">Пожрём?</div><div className="sub">by Kiiara</div></div>
      <div className="avatar">N</div>
    </header>
    <main>
      {tab === 'Меню' && <>
        <div className="welcome">
      <div><div className="eyebrow">ТВОЯ НЕДЕЛЯ</div><h1 style={{margin:0}}>План питания</h1></div>
      <label className="upload-btn">
        {menuLoading ? 'Анализ...' : <><Camera size={16}/> Импорт</>}
        <input type="file" accept="image/*" style={{display:'none'}} onChange={handleMenuUpload} disabled={menuLoading} />
      </label>
    </div>
        <div className="days">
          {days.map((d,i) => <button key={d} className={day===d?'day active':'day'} onClick={()=>setDay(d)}><span>{d}</span><b>{i+9}</b></button>)}
        </div>
        <div className="notice">Совет: Назови рецепт точно так же, как блюдо в меню (например, "Паста арабьята с курицей"), чтобы при отметке автоматически списывались нужные ингредиенты со склада.</div>
        {currentMeals.length === 0 ? <p>На этот день меню не заполнено.</p> : null}
        {currentMeals.map(m => (
          <article className="meal" key={m.id}>
            <div className="meal-top">
              <span>{m.time}</span>
              <button className={m.done ? 'check checked' : 'check'} onClick={() => toggleMeal(m.id)}>
                {m.done ? <Check size={16}/> : <span/>}
              </button>
            </div>
            <h3>{m.name}</h3>
            <p>{m.detail}</p>
          </article>
        ))}
      </>}

      {tab === 'Покупки' && <>
        <div className="eyebrow">БАЗА И СКЛАД</div>
        <h1>Продукты</h1>
        
        {products.map(p => (
          <div className="product-card" key={p.id}>
            <div className="product-img">{getProductEmoji(p.name)}</div>
            <div className="product-info">
              <h3>{p.name}</h3>
              <div className="product-stats">
                <span>Ккал: <b>{p.calories}</b></span>
                <span>Б: <b>{p.protein}</b></span>
                <span>Ж: <b>{p.fat}</b></span>
                <span>У: <b>{p.carbs}</b></span>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'8px'}}>
                <span style={{fontSize:'12px', color:'#aaa'}}>Остаток: <b style={{color:'#fff'}}>{getStock(p.id)}</b> г/шт</span>
                <div style={{display:'flex', gap:'5px'}}>
                   <input className="field" type="number" style={{marginTop:0, padding:'4px 8px', width:'70px', fontSize:'12px', minHeight:'auto'}} placeholder="+ кол-во" value={buyAmounts[p.id]||''} onChange={e=>setBuyAmounts({...buyAmounts, [p.id]: e.target.value})}/>
                   <button className="primary" style={{margin:0, padding:'4px 10px', minHeight:'auto'}} onClick={()=>buyProduct(p.id)}><Check size={14}/></button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {!showAddProduct ? (
          <button className="primary" onClick={() => setShowAddProduct(true)}><Plus size={17}/> Создать новый продукт</button>
        ) : (
          <div className="formcard">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
               <h3 style={{margin:0}}>Новый продукт</h3>
               <label style={{margin:0, display:'flex', alignItems:'center', gap:'5px', cursor:'pointer', color:'#fff', fontSize:'12px', fontWeight:700}}>
                 {visionLoading ? 'Читаю...' : <><Camera size={16}/> По фото</>}
                 <input type="file" accept="image/*" style={{display:'none'}} onChange={handlePhotoUpload} disabled={visionLoading} />
               </label>
            </div>
            <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
              <input className="field" style={{marginTop:0}} placeholder="Штрихкод (опционально)" value={barcode} onChange={e=>setBarcode(e.target.value)}/>
              <button className="primary" style={{margin:0}} onClick={searchBarcode} disabled={barcodeSearching}>
                {barcodeSearching ? '...' : <Search size={16}/>}
              </button>
            </div>
            <input className="field" placeholder="Название" value={newProd.name} onChange={e=>setNewProd({...newProd, name: e.target.value})}/>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
              <input className="field" placeholder="Ккал (на 100г)" value={newProd.calories} onChange={e=>setNewProd({...newProd, calories: e.target.value})}/>
              <input className="field" placeholder="Белки" value={newProd.protein} onChange={e=>setNewProd({...newProd, protein: e.target.value})}/>
              <input className="field" placeholder="Жиры" value={newProd.fat} onChange={e=>setNewProd({...newProd, fat: e.target.value})}/>
              <input className="field" placeholder="Углеводы" value={newProd.carbs} onChange={e=>setNewProd({...newProd, carbs: e.target.value})}/>
            </div>
            <div style={{display:'flex', gap:'10px', marginTop:'15px'}}>
              <button className="primary" onClick={addProduct}>Сохранить</button>
              <button className="primary btn-secondary" onClick={()=>setShowAddProduct(false)}>Отмена</button>
            </div>
          </div>
        )}
      </>}
      
      {tab === 'Рецепты' && <>
        <div className="eyebrow">БИБЛИОТЕКА</div>
        <h1>Рецепты</h1>
        
        {recipes.map(r => (
          <article className="meal" key={r.id}>
            <div className="meal-top"><b>{r.name}</b><span>Рецепт</span></div>
            <p style={{fontSize: '13px', color: '#78857e', marginTop: '8px'}}>{r.description}</p>
            
            <div style={{marginTop:'12px', paddingTop:'12px', borderTop:'1px solid #eff1ed'}}>
              <div style={{fontSize:'11px', fontWeight:700, color:'#819087', marginBottom:'8px'}}>ИНГРЕДИЕНТЫ:</div>
              {r.ingredients.map((ing:any) => (
                <div key={ing.id} style={{display:'flex', justifyContent:'space-between', fontSize:'13px', padding:'4px 0'}}>
                   <span>{ing.product_name}</span>
                   <strong>{ing.amount} г/шт</strong>
                </div>
              ))}
              {r.ingredients.length === 0 && <div style={{fontSize:'12px', color:'#a4b2aa'}}>Нет ингредиентов</div>}
              
              {!ingForms[r.id] ? (
                 <button style={{background:'none', border:0, color:'#315d4c', font:'600 12px Manrope', padding:0, marginTop:'10px', display:'flex', alignItems:'center', gap:'4px'}} onClick={()=>setIngForms({...ingForms, [r.id]:true})}><Plus size={14}/> Добавить ингредиент</button>
              ) : (
                 <div style={{background:'#f4f6f1', padding:'10px', borderRadius:'8px', marginTop:'10px'}}>
                    <select className="field" style={{marginTop:0}} value={newIng.product_id} onChange={e=>setNewIng({...newIng, product_id: e.target.value})}>
                       <option value={0}>Выберите продукт...</option>
                       {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <div style={{display:'flex', gap:'5px', marginTop:'5px'}}>
                       <input className="field" type="number" style={{marginTop:0}} placeholder="Кол-во (г)" value={newIng.amount} onChange={e=>setNewIng({...newIng, amount: e.target.value})}/>
                       <button className="primary" style={{margin:0}} onClick={()=>addIngredient(r.id)}>ОК</button>
                    </div>
                 </div>
              )}
            </div>
          </article>
        ))}

        {!showAddRecipe ? (
          <button className="primary" onClick={() => setShowAddRecipe(true)}><Plus size={17}/> Создать рецепт</button>
        ) : (
          <div className="formcard">
            <h3>Новый рецепт</h3>
            <input className="field" placeholder="Название (например: Паста арабьята)" value={newRecipe.name} onChange={e=>setNewRecipe({...newRecipe, name: e.target.value})}/>
            <textarea className="field" placeholder="Описание и состав" style={{minHeight:'80px', marginTop:'10px'}} value={newRecipe.description} onChange={e=>setNewRecipe({...newRecipe, description: e.target.value})}/>
            <div style={{display:'flex', gap:'10px', marginTop:'15px'}}>
              <button className="primary" onClick={async () => {
                if(!newRecipe.name) return;
                await fetch(`${API_URL}/recipes`, {
                  method: 'POST',
                  headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify(newRecipe)
                });
                setNewRecipe({name:'', description:''});
                setShowAddRecipe(false);
                fetchData();
              }}>Сохранить</button>
              <button className="primary btn-secondary" onClick={()=>setShowAddRecipe(false)}>Отмена</button>
            </div>
          </div>
        )}
      </>}
      
      {tab === 'Дневник' && <>
        <div className="eyebrow">ЧТО ТЫ ДЕЙСТВИТЕЛЬНО СЪЕЛА</div>
        <h1>Дневник питания</h1>
        <input type="date" className="field" style={{marginBottom:'15px', background:'white', fontWeight:600}} value={diaryDate} onChange={e=>{setDiaryDate(e.target.value); fetchDiary(e.target.value);}} />
        
        <div className="stat">
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
             <div>
               <span>Калории</span>
               <strong>{diaryEntries.reduce((acc, curr)=>acc+curr.calories, 0)} / {targets.calories}</strong>
               <div className="bar"><i style={{width: `${Math.min(100, (diaryEntries.reduce((acc, curr)=>acc+curr.calories, 0)/targets.calories)*100)}%`}}/></div>
             </div>
             <div>
               <span>Белок</span>
               <strong>{diaryEntries.reduce((acc, curr)=>acc+curr.protein, 0).toFixed(1)} / {targets.protein} г</strong>
               <div className="bar"><i style={{width: `${Math.min(100, (diaryEntries.reduce((acc, curr)=>acc+curr.protein, 0)/targets.protein)*100)}%`}}/></div>
             </div>
             <div>
               <span>Жиры</span>
               <strong>{diaryEntries.reduce((acc, curr)=>acc+curr.fat, 0).toFixed(1)} / {targets.fat} г</strong>
               <div className="bar"><i style={{width: `${Math.min(100, (diaryEntries.reduce((acc, curr)=>acc+curr.fat, 0)/targets.fat)*100)}%`}}/></div>
             </div>
             <div>
               <span>Углеводы</span>
               <strong>{diaryEntries.reduce((acc, curr)=>acc+curr.carbs, 0).toFixed(1)} / {targets.carbs} г</strong>
               <div className="bar"><i style={{width: `${Math.min(100, (diaryEntries.reduce((acc, curr)=>acc+curr.carbs, 0)/targets.carbs)*100)}%`}}/></div>
             </div>
          </div>
        </div>
        
        {diaryEntries.length === 0 && <p style={{textAlign:'center', margin:'30px 0'}}>В этот день записей нет.</p>}
        {diaryEntries.map(e => (
          <article className="meal" key={e.id}>
             <div className="meal-top"><b>{e.name}</b><span>{e.amount} г/шт</span></div>
             <div style={{fontSize:'12px', color:'#78857e', marginTop:'5px'}}>
               {e.calories} ккал · Б: {e.protein} · Ж: {e.fat} · У: {e.carbs}
             </div>
          </article>
        ))}

        {!showAddDiary ? (
          <button className="primary" onClick={()=>setShowAddDiary(true)}><Plus size={17}/> Добавить съеденное</button>
        ) : (
          <div className="formcard">
            <h3>Что ты съела?</h3>
            <select className="field" value={diaryForm.product_id} onChange={e=>setDiaryForm({...diaryForm, product_id: Number(e.target.value)})}>
               <option value={0}>Выбери продукт из базы...</option>
               {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input className="field" placeholder="Количество (граммы / штуки)" type="number" value={diaryForm.amount} onChange={e=>setDiaryForm({...diaryForm, amount: e.target.value})}/>
            
            <div style={{display:'flex', gap:'10px', marginTop:'15px'}}>
              <button className="primary" onClick={addDiaryEntry}>Сохранить</button>
              <button className="primary btn-secondary" onClick={()=>setShowAddDiary(false)}>Отмена</button>
            </div>
          </div>
        )}
      </>}

      {tab === 'Мои нормы' && <>
        <div className="eyebrow">ЛИЧНЫЕ ЦЕЛИ</div>
        <h1>Мои нормы</h1>
        <div className="formcard">
          <label>Калории, ккал в день<input type="number" className="field" value={targets.calories} onChange={e=>setTargets({...targets, calories: Number(e.target.value)})}/></label>
          <label>Белок, г в день<input type="number" className="field" value={targets.protein} onChange={e=>setTargets({...targets, protein: Number(e.target.value)})}/></label>
          <label>Жиры, г в день<input type="number" className="field" value={targets.fat} onChange={e=>setTargets({...targets, fat: Number(e.target.value)})}/></label>
          <label>Углеводы, г в день<input type="number" className="field" value={targets.carbs} onChange={e=>setTargets({...targets, carbs: Number(e.target.value)})}/></label>
          <button className="primary" style={{marginTop:'15px'}} onClick={updateTargets}>Сохранить изменения</button>
        </div>
      </>}

    </main>
    <nav>
      {nav.map(([n,Icon]) => <button className={tab===n?'navitem selected':'navitem'} key={n} onClick={()=>setTab(n)}><Icon size={19}/><span>{n}</span></button>)}
    </nav>
  </div>
}
