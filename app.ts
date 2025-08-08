import express, { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import {
    Recipe,
    Ingredient,
    NutritionInfo,
    FatSecretFood,
    FatSecretServing,
    FatSecretRecipe,
    FatSecretIngredient
} from './types'
import axios from 'axios'
import {getFatSecretToken} from './fatsecret';

import dotenv from 'dotenv';
dotenv.config(); 
import cors from 'cors';
import rateLimit from 'express-rate-limit'
const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET'],
  allowedHeaders:['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use('/api', rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.'
}));

//spoonacular URL and params
const spoonacular = axios.create({
  baseURL: 'https://api.spoonacular.com',
  params: { apiKey: process.env.SPOONACULAR_API_KEY }
});


// defining routes here
// first section is fatsecret, then next section is spoonacular

//fatsecret food search
app.get('/api/fatsecret/search-foods', async(req: Request, res: Response) => {
  try {
    const {query, maxResults, pageNumber} = req.query;
    if(!query) return res.status(400).json({error: 'Missing search query'});

    //Get OAuth 2.0 access token
    const token = await getFatSecretToken();

    const params = new URLSearchParams();
    params.append('method', 'foods.search')
    params.append('search_expression', query as string)
    params.append('format', 'json')
    params.append('max_results', String(maxResults ?? 'null'))
    params.append('page_number', String(pageNumber ?? 'null'))


    const response = await axios.post(
      'https://platform.fatsecret.com/rest/server.api',
      params,
      {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/x-www-form-urlencoded'
      }
    })

    res.json(response.data)

  } catch(error: any){
    console.error('API Error:', error.response?.data || error.message)

    res.status(500).json({
      error: 'Failed to fetch food data from fatsecret'
    })

  }
})

// get food by id fatsecret
app.get('/api/fatsecret/food/:id', async(req: Request, res: Response) => {
  const foodId = req.params.id;

  try {
    const token = await getFatSecretToken();

    const response = await axios.get('https://platform.fatsecret.com/rest/food/v4', {
      params:{
        method: 'food.get',
        food_id: foodId,
        format: 'json'
      },
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type':'application/x-www-form-urlencoded'
      }
    })

    const nutritionInfo = mapFoodToNutritionInfo(response.data)
    res.json(nutritionInfo)


  } catch(error: any){
    console.error('api error:', error.response?.data || error.message);
    res.status(500).json({
      error:'Failed to fetch food data',
      details: error.response?.data || error.message  
    })
  }
})

// recipe search fatsecret
app.get('/api/fatsecret/recipes', async(req: Request, res: Response) => {
  const {query, maxResults = 3, pageNumber = 0 } = req.query;
  
  try{
    const token = await getFatSecretToken();
    
    const params = new URLSearchParams({
      search_expressions: query as string,
      format: 'json',
      max_results: maxResults.toString(),
      page_number: pageNumber.toString()
    });
    
    const response = await axios.get('https://platform.fatsecret.com/rest/recipes/search/v3', {
      params,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    })
      
      const recipes = response.data.recipes.recipe;

      const mappedRecipes: FatSecretRecipe[] = recipes.map((recipe: any) => ({
        recipe_id: Number(recipe.recipe_id),
        recipe_name: recipe.recipe_name,
        recipe_nutrition: {
          calories: Number(recipe.recipe_nutrition?.calories),
          protein: Number(recipe.recipe_nutrition?.protein),
          carbs: Number(recipe.recipe_nutrition?.carbohydrate),
          fat: Number(recipe.recipe_nutrition?.fat),
          amount: 1,
          unit: "serving"

        },
        types: recipe.recipe_types?.recipe_type || []
      }))
      
      res.json(mappedRecipes)
      
    } catch (error: any){
      console.error(error.response?.data || error.message);
      res.status(500).json({error: 'Failed to fetch FatSecret recipes'})
    }
  })
  
  
  
  app.get('/api/fatsecret/recipe/:id', async(req: Request, res: Response) => {
    try {
      const recipeId = req.params.id;
      
      const token = await getFatSecretToken();
      
      const response = await axios.get('https://platform.fatsecret.com/rest/recipe/v2', {
      params: {
        method: 'recipe.get',
        recipe_id: recipeId,
        format: 'json'
      }, 
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    })

    console.log('FatSecret recipe response:', JSON.stringify(response.data, null, 2));

    const nutritionInfo = mapRecipeToNutritionInfo(response.data);
    res.json(nutritionInfo);

    } catch (error: any) {
      console.error('api error:', error.response?.data || error.message);
      res.status(500).json({})
    }
  })
  
  app.get('/api/test-fatsecret-token', async(req: Request, res: Response) => {
    try {
      const token = await getFatSecretToken();
      res.json({token})
    } catch(err:any){
      res.status(500).json({error:err.message})
    }
  })


// 
// Spoonacular Endpoints //
// 
//test
app.get("/recipes", (_req, res) => {
  res.json({ message: "Hello from the server!" });
});


app.get('/api/ingredients', async (req: Request, res: Response) => {
  const { query, limit = '3', sort = 'calories', sortDirection = 'desc' } = req.query;

  try {
    const { data } = await spoonacular.get<{ results: Ingredient[] }>('/food/ingredients/search', {
      params: {
        query,
        number: limit,
        sort,
        sortDirection
      }
    });
    res.json(data.results);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching ingredients');
  }
});

app.get('/api/recipes', async (req: Request, res: Response) => {
  const { query, limit = '3', sort = 'calories', sortDirection = 'desc' } = req.query;
  try {
    const { data } = await spoonacular.get<{ results: Recipe[] }>('/recipes/complexSearch', {
      params: { query, number: limit, sort, sortDirection }
    });
    res.json(data.results);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching recipes');
  }
});

app.get('/api/ingredients/:id/nutrition', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { amount, unit } = req.query;
  try {
    const { data } = await spoonacular.get(`/food/ingredients/${id}/information`, {
      params: { amount, unit }
    });

    const nutrients = data.nutrition.nutrients;

    const response: NutritionInfo & { name: string } = {
      name: data.name,
      protein: nutrients.find((n: any) => n.name === 'Protein')?.amount || 0,
      calories: nutrients.find((n: any) => n.name === 'Calories')?.amount || 0,
      carbs: nutrients.find((n: any) => n.name === 'Carbohydrates')?.amount || 0,
      fat: nutrients.find((n: any) => n.name === 'Fat')?.amount || 0,
      amount: Number(amount),
      unit: unit as string
    };

    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching ingredient nutrition');
  }
});

app.get('/api/recipes/:id/information', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { data } = await spoonacular.get(`/recipes/${id}/information`);
    res.json({
      servings: data.servings,
      servingSizeGrams: data.nutrition?.weightPerServing?.amount || 100
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching recipe info');
  }
});


app.get('/api/recipes/:id/nutrition', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { data } = await spoonacular.get(`/recipes/${id}/nutritionWidget.json`);
    res.json({
      protein: parseFloat(data.protein.replace(/[^\d.]/g, "")),
      calories: parseFloat(data.calories.replace(/[^\d.]/g, "")),
      carbs: parseFloat(data.carbs.replace(/[^\d.]/g, "")),
      fat: parseFloat(data.fat.replace(/[^\d.]/g, "")),
      amount: 1,
      unit: "serving"
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching recipe nutrition');
  }
});

// helper function to map API response to NutritionInfo
// used for fatsecret endpoints

// this one here is for food items returned from fatsecret
function mapFoodToNutritionInfo(apiData: any): NutritionInfo {
  const food = apiData?.food || {}
  const servings = food?.servings?.serving || [];

  const servingsArray = Array.isArray(servings) ? servings : [servings];

  if(servingsArray.length === 0){
    throw new Error('No serving information found');
  }

  const preferredServing = servingsArray.find(serving => 
    serving.metric_serving_amount === '100.000'
  ) || servingsArray[0]

  // Extract and convert nutrition values
  return{
    protein: parseFloat(preferredServing.protein) || 0,
    calories: parseFloat(preferredServing.calories) || 0,
    carbs: parseFloat(preferredServing.carbohydrate) || 0,
    fat: parseFloat(preferredServing.fat) || 0,
    amount: parseFloat(preferredServing.metric_serving_amount) || 0,
    unit: preferredServing.metric_serving_amount || 'g'
  }
}

// this one is to map returned recipe data to nutrition info
function mapRecipeToNutritionInfo(apiData: any): NutritionInfo {
  const recipe = apiData?.recipe;

  if(!recipe){
    throw new Error('Missing recipe data')
  }

  const serving = recipe.serving_sizes?.serving;

  if(!serving){
    throw new Error('Missing serving data')
  }

  // Extract and convert nutrition values
  return{
    protein: parseFloat(serving.protein) || 0,
    calories: parseFloat(serving.calories) || 0,
    carbs: parseFloat(serving.carbohydrate) || 0,
    fat: parseFloat(serving.fat) || 0,
    amount: parseFloat(recipe.grams_per_portion) || 0,
    unit: 'g'
  }
}

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
});


export default app;