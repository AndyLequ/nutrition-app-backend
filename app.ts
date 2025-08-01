import express, { Request, Response, NextFunction, ErrorRequestHandler } from 'express';

import axios from 'axios'

dotenv.config(); 

import dotenv from 'dotenv';

const app = express();

//creating helper function getFatSecretToken()
let fatSecretAccessToken: string | null = null;
let fatSecretTokenExpiresAt = 0;

async function getFatSecretToken(): Promise<string>{
  const now = Date.now();

  // return cached token if still valid
  if(fatSecretAccessToken && now < fatSecretTokenExpiresAt) {
    return fatSecretAccessToken;
  }

  try{
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials')
    params.append('scope', 'basic') 

    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

    const response = await axios.post(TOKEN_URL, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      }
    })

    fatSecretAccessToken = response.data.access_token;
    fatSecretTokenExpiresAt = now + (response.data.expires_in * 1000) - 300_000; //refresh in 5 minutes

    return fatSecretAccessToken!;
  } catch(err: any){
    console.error('Failed to fetch FatSecret access token:', err.response?.data || err.message);
    throw new Error('Unable to authenticate with FatSecret')
  }

}

async function getFatSecretToken(): Promise<string>{
  const now = Date.now();

  // return cached token if still valid
  if(fatSecretAccessToken && now < fatSecretTokenExpiresAt) {
    return fatSecretAccessToken;
  }

  try{
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials')
    params.append('scope', 'basic') 

    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

    const response = await axios.post(TOKEN_URL, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      }
    })

    fatSecretAccessToken = response.data.access_token;
    fatSecretTokenExpiresAt = now + (response.data.expires_in * 1000) - 300_000; //refresh in 5 minutes

    return fatSecretAccessToken!;
  } catch(err: any){
    console.error('Failed to fetch FatSecret access token:', err.response?.data || err.message);
    throw new Error('Unable to authenticate with FatSecret')
  }

}


// define routes here
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
    params.append('max_results', String(maxResults))
    params.append('page_number', String(pageNumber))


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

app.get('/api/test-fatsecret-token', async(req: Request, res: Response) => {
  try {
    const token = await getFatSecretToken();
    res.json({token})
  } catch(err:any){
    res.status(500).json({error:err.message})
  }
})


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

// //fatsecret food search
// app.get('/api/fatsecret/search-foods', async(req: Request, res: Response) => {
//   try {
//     const {query, maxResults, pageNumber} = req.query;
//     if(!query) return res.status(400).json({error: 'Missing search query'});

//     //Get OAuth 2.0 access token
//     const token = await getFatSecretToken();

//     const params = new URLSearchParams();
//     params.append('method', 'foods.search')
//     params.append('search_expression', query as string)
//     params.append('format', 'json')
//     params.append('max_results', String(maxResults))
//     params.append('page_number', String(pageNumber))


//     const response = await axios.post(
//       'https://platform.fatsecret.com/rest/server.api',
//       params,
//       {
//       headers: {
//         'Authorization': `Bearer ${token}`,
//         'Accept': 'application/x-www-form-urlencoded'
//       }
//     })

//     res.json(response.data)

//   } catch(error: any){
//     console.error('API Error:', error.response?.data || error.message)

//     res.status(500).json({
//       error: 'Failed to fetch food data from fatsecret'
//     })

//   }
// })

//testing token retrieval
// app.get('/api/test-fatsecret-token', async(req: Request, res: Response) => {
//   try {
//     const token = await getFatSecretToken();
//     res.json({token})
//   } catch(err:any){
//     res.status(500).json({error:err.message})
//   }
// })


app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
});


export default app;