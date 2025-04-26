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

    // const startOfMonth = dayjs(new Date).startOf('month');
    // const endOfMonth = dayjs(new Date).endOf('month');
    
    const token = await getAuthSkorozvon()
    const tokenAuth = JSON.parse(token).token

    //console.log(tokenAuth)

    try {
        const query = await axios.post('https://api.skorozvon.ru/api/reports/calls_total.json', null, {
            params: {
                'length': 100,
                'page': 1,
                'start_time' : startTime,
                'end_time' : endTime
            },
            headers: { 'Authorization': `Bearer ${tokenAuth}` },
        });

        const total_pages = query.data.total_pages

        // console.log(total_pages)

        for (let i = 1; i <= total_pages; i++) {
            const response = await axios.post('https://api.skorozvon.ru/api/reports/calls_total.json', null, {
                params: {
                    'length' : 100,
                    'page' : i,
                    'start_time' : startTime,
                    'end_time' : endTime
                },
                headers: { Authorization: `Bearer ${tokenAuth}` },
            })
            callArray.push(response.data)
        }

        // TODO это нужно будет использовать когда буду делать новый алгоритм и там крч чтобы долго не ждал чтото типа мини данные что не ждать каждый раз по 100500 минут

        // const response = await axios.post('https://api.skorozvon.ru/api/reports/calls_total.json', null, {
        //     params: {
        //         'length' : 100,
        //         'page' : 7
        //     },
        //     headers: { Authorization: `Bearer ${tokenAuth}` },
        // })
        // callArray.push(response.data)

        res.send({'callsData' : callArray})


        // TODO крч проблема в том что блядский ебучий токен слетел нахуй и нуджно с ним ебаться теперь блять

    } catch (e) {
        res.send({'callsData' : 'error'})
        console.log(e)
    }

})



module.exports = router