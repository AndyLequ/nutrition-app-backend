import request from 'supertest'
import app from '../server'
import axios from 'axios'
import { getFatSecretToken } from '../server';

jest.mock('axios', () => ({
    __esModule: true,
    default: {
        create: jest.fn(() => ({
            get: jest.fn(),
            post: jest.fn(),
        })),
        post: jest.fn()
    },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedGetToken = getFatSecretToken as jest.Mock;

//Mock token function
jest.mock('../server', () => ({
    ...jest.requireActual('../server'),
    getFatSecretToken: jest.fn(),
}));

describe('FatSecret /api/fatsecret/search-foods Endpoint', () => {
    const mockedToken = 'mocked-access-token'
    const API_URL = 'https://platform.fatsecret.com/rest/server.api';

    // Mock data
    const successResponse = {
        foods: {
                food: [
                    {food_id: "1", food_name: "Apple", food_type: "Generic"},
                    {food_id: "2", food_name: "Green Apple", food_type: "Generic"}
                ]
            }
        };
    

    beforeEach(() => {
        //reset mocks
        jest.clearAllMocks();
        mockedGetToken.mockResolvedValue(mockedToken);
    });


    
    it('should return food search results', async() => {
        // Mock FatSecret API response
        mockedAxios.post.mockResolvedValueOnce({data: successResponse})



        const res = await request(app)
            .get('/api/fatsecret/search-foods')
            .query({
                query: 'fruit',
                maxResults: 10,
                pageNumber: 0
            })

        // Verify response
        expect(res.status).toBe(200)
        expect(res.body).toEqual(successResponse)

        // Verify token was called
        expect(mockedGetToken).toHaveBeenCalledTimes(1);
        
        // Verify API call
        expect(mockedAxios.post).toHaveBeenCalledWith(
            API_URL,
            expect.any(URLSearchParams),
            {
                headers: {
                    'Authorization': `Bearer ${mockedToken}`,
                    'Accept': 'application/x-www-form-urlencoded'
                }
            }
        )

        // Verify URLSearchParams content
        const params = mockedAxios.post.mock.calls[0][1] as URLSearchParams;
        expect(params.get('method')).toBe('foods.search');
        expect(params.get('search_expression')).toBe('fruit');
        expect(params.get('max_results')).toBe('10');
        expect(params.get('page_number')).toBe('0');
    })

    it('should return 400 when query parameter is missing', async() => {
        const res = await request(app)
            .get('/api/fatsecret/search-foods')
            .query({maxResults: 5, pageNumber: 0});

        expect(res.status).toBe(400);
        expect(res.body).toEqual({error: 'Missing search query'});
        expect(mockedGetToken).not.toHaveBeenCalled();
        expect(mockedAxios.post).not.toHaveBeenCalled();
    })


    it('should handle FatSecret API errors', async() => {
        mockedAxios.post.mockRejectedValueOnce({
            response: {
                data: {error: {code: 5, message: "Invalid paramters"}}
            } 
        })

        const res = await request(app)
            .get('/api/fatsecret/search-foods')
            .query({query: 'error', maxResults: 5});

        expect(res.status).toBe(500);
        expect(res.body).toEqual({
            error: 'Failed to fetch food data from fatsecret'
        })
    })
    
    it('should handle token fetch errors', async() => {
        // Mock token error
        mockedGetToken.mockRejectedValueOnce(new Error('Token service down'));

        const res = await request(app)
            .get('/api/fatsecret/search-foods')
            .query({query: 'apple'})

        expect(res.status).toBe(500);
        expect(res.body).toEqual({
            error: 'Failed to fetch food data from fatsecret'
        })
    })

    it('should handle network errors', async () => {
        // Mock network failure
        mockedAxios.post.mockRejectedValueOnce(new Error('Network error'))

        const res = await request(app)
            .get('/api/fatsecret/search-foods')
            .query({query: 'network'})

        expect(res.status).toBe(500);
        expect(res.body).toEqual({
            error: 'Failed to fetch food data from fatsecret'
        })
    })

    it('should use default parameters when  not provided', async() => {
        mockedAxios.post.mockResolvedValueOnce({data: successResponse})

        const res = await request(app)
            .get('/api/fatsecret/search-foods')
            .query({query: 'default'})

        expect(res.status).toBe(200);

        const params = mockedAxios.post.mock.calls[0][1] as URLSearchParams;
        expect(params.get('max_results')).toBe('null'); 
        expect(params.get('page_number')).toBe('null');
    })

})