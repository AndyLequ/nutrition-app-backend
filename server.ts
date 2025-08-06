import express, { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import {
    Recipe,
    Ingredient,
    NutritionInfo,
} from './types'

import app from './app';


dotenv.config();

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



// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use('/api', limiter);


if(process.env.NODE_ENV !== 'test'){
  app.listen(PORT,  () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
  });

}
