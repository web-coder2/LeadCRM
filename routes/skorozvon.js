const express = require('express')
const axios = require('axios')
const router = express.Router()
const dotenv = require('dotenv')
const dayjs = require('dayjs')


const skorozvonCalls = require('../models/skorozvonCalls.js')

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

router.get('/skorozvon/get/calls/:timeDate', async (req, res) => {

    try {
        const timeDateParam = req.params.timeDate;

        if (!dayjs(timeDateParam, 'YYYY-MM-DD', true).isValid()) {
            return res.status(400).json({ message: 'Некорректный формат даты. Используйте YYYY-MM-DD.' });
        }

        const callsRecord = await skorozvonCalls.findOne({ date: timeDateParam });

        if (!callsRecord) {
            return res.status(404).json({ message: `Записи о звонках за ${timeDateParam} не найдены.` });
        }

        res.json(callsRecord);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка сервера');
    }

})

module.exports = router