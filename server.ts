import express, { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

//new code for fatsecret
import OAuth from 'oauth-1.oa';
import crypto from 'crypto'

dotenv.config();

const app = express();
const PORT = process.env.PORT || '3000';

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.'
});

const corsOptions = {
  origin: '*', // Allow all origins
  methods: ['GET'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}

const spoonacular = axios.create({
  baseURL: 'https://api.spoonacular.com',
  params: { apiKey: process.env.SPOONACULAR_API_KEY }
});

//FatSecret URL
const FATSECRET_URL = 'https://platform.fatsecret.com/rest/server.api'

// OAuth 1.0a configuration
const oauth = OAuth({
  consumer: {
    key: process.env.FATSECRET_CONSUMER_KEY!,
    secret: process.env.FATSECRET_CONSUMER_SECRET!,
  },
  signature_method: 'HMAC-SHA1',
  hash_function: (baseString, key) =>
    crypto.createHmac('sha1', key).update(baseString).digest('base64')
})

// Types
interface Ingredient {
  id: number;
  name: string;
  image: string;
}

interface Recipe {
  id: number;
  title: string;
  image: string;
  [key: string]: any;
}

interface NutritionInfo {
  protein: number;
  calories: number;
  carbs: number;
  fat: number;
  amount: number;
  unit: string;
}

//FatSecret API types
interface FatSecretFood {
  food_id: string;
  food_name: string;
  food_image?: string';
  servings: {
    serving: FatSecretServing | FatSecretServing[];
  };
}

interface FatSecretRecipe {
  recipe_id: string;
  recipe_name: string;
  recipe_image?: string;
  recipe_url?: string;
  recipe_description?: string;
  ingredients?: {
    ingredient: FatSecretIngredient | FatSecretIngredient[];
  }
  recipe_nutrition?: {
    protein: string;
    calories: string;
    carbohydrate: string;
    fat: string;
  }
  number_of_servings?: string;
}

interface FatSecretIngredient {
  food_id?: string;
  ingredient_name: string;
  ingredient_description: string;
}

//helper function to sing requests
const signRequest = (
  method: 'POST' | 'GET',
  url: string,
  data: Record<string, string | number>

) => {
  const request = {
    url, 
    method, 
    data: {...data,format: 'json'}
  }


const headers = oauth.toHeader(oauth.authorize(request));
return {
  url: request.url,
  method: request.method,
  data: request.data,
  headers: {
    ...headers,
    'Content-Type': 'application/x-www-form-urlencoded'
    }
  }
}


// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use('/api', limiter);

// Endpoints

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

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
});

app.listen(PORT,  () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
