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


async function getAndSetSkorozvonToDB(timeDay) {
    try {
        let date = dayjs(timeDay).format('YYYY-MM-DD')
        let unixDateStart = parseInt(dayjs(date).unix())
        let unixDateEnd = unixDateStart + (24 * 60 * 60)

        let token = await getAuthSkorozvon()
        let tokenAuth = JSON.parse(token).token

        let allCallsForToday = []

        const initialResponse = await axios.get('https://api.skorozvon.ru/api/v2/calls', {
            params: {
                'start_time': unixDateStart,
                'end_time': unixDateEnd,
                'length': 100,
                'page': 0
            },
            headers: { Authorization: `Bearer ${tokenAuth}` },
        });

        const total_pages = initialResponse.data.pagination.total_pages;

        for (let page = 0; page < total_pages; page++) {
            const response = await axios.get('https://api.skorozvon.ru/api/v2/calls', {
                params: {
                    'start_time': unixDateStart,
                    'end_time': unixDateEnd,
                    'length': 100,
                    'page': page
                },
                headers: { Authorization: `Bearer ${tokenAuth}` },
            });

            let callsData = response.data.data;

            for (const call of callsData) {
                 let username = call.user && call.user.name ? call.user.name : "Не определено";
                 let callType = call.call_type;
                 allCallsForToday.push({ username: username, call_type: callType });
            }
        }

        const dayRecord = await skorozvonCalls.findOneAndUpdate(
            { date: date },
            { calls: allCallsForToday },
            {
                upsert: true,
                new: true
            }
        );

        console.log(`Перезаписана запись за ${date} с ${dayRecord.calls.length} звонками.`);

    } catch (error) {
        console.error('Ошибка при получении и перезаписи данных Skorozvon:', error);
    }
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
        const timeDateParam = req.params.timeDate

        if (!dayjs(timeDateParam, 'YYYY-MM-DD', true).isValid()) {
            return res.status(400).json({ message: 'Некорректный формат даты. Используйте YYYY-MM-DD.' })
        }

        let callsRecord = await skorozvonCalls.findOne({ date: timeDateParam })

        if (!callsRecord) {
            console.log(`Записи о звонках за ${timeDateParam} не найдены. Выполняем getAndSetSkorozvonToDB.`)
            try {
                await getAndSetSkorozvonToDB(timeDateParam);

                callsRecord = await skorozvonCalls.findOne({ date: timeDateParam })

                if (!callsRecord) {
                     console.warn(`Записи о звонках за ${timeDateParam} не найдены даже после попытки получения и сохранения.`);
                     return res.json({ date: timeDateParam, calls: [] })
                }

            } catch (dbSaveError) {
                 console.error('Ошибка при выполнении getAndSetSkorozvonToDB:', dbSaveError.message)
                 return res.status(500).json({ message: 'Ошибка при попытке получить и сохранить данные о звонках.', error: dbSaveError.message })
            }
        }

        res.json(callsRecord)

    } catch (err) {
        console.error('Ошибка в роутере /skorozvon/get/calls:', err.message)
        res.status(500).send('Ошибка сервера')
    }
});

module.exports = router