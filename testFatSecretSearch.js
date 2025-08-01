const axios = require('axios')

async function demoFatSecretSearch() {
    try {
        const response = await axios.get('http://localhost:3000/api/fatsecret/search-foods', {
            params: {
                query: 'banana',
                maxResults: 2,
                pageNumber: 0
            }
        })
        console.log('FatSecret Search response:\n', JSON.stringify(response.data, null, 2));
    
    } catch(error){
        console.error('Error fetching FatSecret data:\n', error,response?.data || error.message)
    }
}

demoFatSecretSearch();