const express = require('express')
const axios = require('axios')
const router = express.Router()
const dotenv = require('dotenv')
const dayjs = require('dayjs')

dotenv.config()

const skorozvonAPI = process.env.skorozvonAPI
const skorozvonUSER = process.env.skorozvonUSER
const skorozvonID = process.env.skorozvonID
const skorozvonSecret = process.env.skorozvonSecret


async function getAuthSkorozvon() {
    const response = await axios.post('https://api.skorozvon.ru/oauth/token', {
        'grant_type' : "password",
        'username' : skorozvonUSER,
        'api_key' : skorozvonAPI,
        'client_id' : skorozvonID,
        'client_secret' : skorozvonSecret
    })
    return JSON.stringify({
        "token" : response.data.access_token
    })
}


router.get('/skorozvon/get/users', async (req, res) => {
    
    const token = await getAuthSkorozvon()
    const tokenAuth = JSON.parse(token).token
    const response = await axios.get('https://api.skorozvon.ru/api/v2/users',{
        headers: { Authorization: `Bearer ${tokenAuth}` },
    })

    res.send({'usersData' : response.data})

})

router.get('/skorozvon/get/calls', async (req, res) => {

    const callArray = []

    // const startOfMonth = dayjs(new Date).startOf('month');
    // const endOfMonth = dayjs(new Date).endOf('month');
    
    const token = await getAuthSkorozvon()
    const tokenAuth = JSON.parse(token).token

    //console.log(tokenAuth)

    // const query = await axios.post('https://api.skorozvon.ru/api/reports/calls_total.json', null, {
    //     params: {
    //         'length': 100,
    //         'page': 1
    //     },
    //     headers: { 'Authorization': `Bearer ${tokenAuth}` },
    // });

    // const total_pages = query.data.total_pages

    // for (let i = 1; i <= total_pages; i++) {
    //     const response = await axios.post('https://api.skorozvon.ru/api/reports/calls_total.json', null, {
    //         params: {
    //             'length' : 100,
    //             'page' : i
    //         },
    //         headers: { Authorization: `Bearer ${tokenAuth}` },
    //     })
    //     callArray.push(response.data)
    // }

    const response = await axios.post('https://api.skorozvon.ru/api/reports/calls_total.json', null, {
        params: {
            'length' : 100,
            'page' : 7
        },
        headers: { Authorization: `Bearer ${tokenAuth}` },
    })
    callArray.push(response.data)

    res.send({'callsData' : callArray})

})



module.exports = router