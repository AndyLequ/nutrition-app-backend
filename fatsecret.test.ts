import request from 'supertest'
import app from 'server.ts'
import axios from 'axios'
import {getFatSecretToken} from 'server.ts'

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
jest.mock('service.ts', () => ({
    ...jest.requireActual('service.ts'),
    getFatSecretToken: jest.fn(),
}))

describe('FatSecret API Tests', () => {
    const mockedToken = 'mocked-access-token'

    beforeEach(() => {
        (getFatSecretToken as jest.Mock).mockResolvedValue(mockedToken)
        jest.clearAllMocks()
    });


    // Test 1: Successful search
    it('should return food search results', async() => {
        // Mock FatSecret API response
        const mockResponse = {
            foods: {
                food: [
                    {food_id: "1", food_name: "Apple", food_type: "Generic"},
                    {food_id: "2", food_name: "Green Apple", food_type: "Generic"}
                ]
            }
        };

        mockedAxios.post.mockResolvedValueOnce({data: mockResponse});

        const res = await request(app)
            .get('/api/fatsecret/search-foods')
            .query({
                query: 'apple',
                maxResults: 5,
                pageNumber: 0
            })

        // Verify response
        expect(res.status).toBe(200)
        expect(res.body).toEqual(mockResponse)

        
        // Verify API call
        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://platform.fatsecret.com/rest/server.api',
            expect.any(URLSearchParams),
            {
                headers: {
                    'Authorization': `Bearer ${mockedToken}`,
                    'Accept': 'application/x-www-form-urlencoded'
                }
            }
        )

    })
})