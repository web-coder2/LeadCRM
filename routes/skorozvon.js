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

router.get('/skorozvon/get/calls/:startTime', async (req, res) => {

    const callArray = []

    const startTime = parseInt(req.params.startTime)
    const endTime = startTime + (24 * 60 * 60)
    
    const token = await getAuthSkorozvon()
    const tokenAuth = JSON.parse(token).token

    let trueFields = ['call_type', 'call_type_code', 'user']

    const response = await axios.get('https://api.skorozvon.ru/api/v2/calls', {
        params: {
            'start_time' : startTime,
            'end_time' : endTime,
            'length' : 100,
        },
        headers: { Authorization: `Bearer ${tokenAuth}` },
    })

    const total_pages = response.data.pagination.total_pages

    for (let i = 0; i < total_pages; i++) {
        const response = await axios.get('https://api.skorozvon.ru/api/v2/calls', {
            params: {
                'start_time' : startTime,
                'end_time' : endTime,
                'length' : 100,
                'page' : i
            },
            headers: { Authorization: `Bearer ${tokenAuth}` },
        })
        callArray.push(response.data.data)
    }

    res.send({'callsData' : callArray})

})



module.exports = router