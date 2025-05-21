const crone = require('node-cron')
const { json } = require('body-parser')
const dayjs = require('dayjs')
const dotenv = require('dotenv')
const axios = require('axios')


const UserModel = require("./models/users.js")
const LeadsModel = require("./models/leads.js")
const skorozvonCalls = require('./models/skorozvonCalls.js')

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



let crone10Sec = '*/10 * * * * *'
let crone1Hour = '0 * * * *'
const crone5Minutes = '*/5 * * * *'
let crone10Minutes = '*/10 * * * *'

async function resetBrokerStatus() {
    const result = await UserModel.updateMany(
        {},
        { $set: { status : false } }
    )
}

async function resetLeadByBroker() {

    const result = await LeadsModel.updateMany(
        { isSend : false }, 
        { broker: "" }
    )

}

async function getAndSetSkorozvonToDB() {
    try {
        let date = dayjs().format('YYYY-MM-DD')
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

    } catch (error) {
        console.error('Ошибка при получении и перезаписи данных Skorozvon:', error);
    }
}

crone.schedule(crone1Hour, () => {
    resetBrokerStatus()
    resetLeadByBroker()
})

// crone.schedule(crone1Hour, () => {
//     getAndSetSkorozvonToDB()
// })