const express = require('express')
const axios = require('axios')
const router = express.Router()
const dotenv = require('dotenv')
const dayjs = require('dayjs')


const skorozvonCalls = require('../models/skorozvonCalls.js')
const Leads = require('../models/leads');
const UsersStats = require('../models/UsersStats');

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

async function processDates(datesArray) {
    const results = []

    for (const dateStr of datesArray) {
        let callsRecord = await skorozvonCalls.findOne({ date: dateStr })

        if (!callsRecord) {
            console.log(`Записи о звонках за ${dateStr} не найдены. Выполняем getAndSetSkorozvonToDB.`)
            try {
                await getAndSetSkorozvonToDB(dateStr)
                callsRecord = await skorozvonCalls.findOne({ date: dateStr })
                if (!callsRecord) {
                    console.warn(`Записи о звонках за ${dateStr} не найдены даже после попытки получения и сохранения.`)
                    results.push({ date: dateStr, calls: [], error: 'No data' })
                } else {
                    results.push({ date: dateStr, calls: callsRecord.calls })
                }
            } catch (error) {
                console.error('Ошибка при выполнении getAndSetSkorozvonToDB:', error.message)
                results.push({ date: dateStr, calls: [], error: error.message })
            }
        } else {
            results.push({ date: dateStr, calls: callsRecord.calls })
        }
    }

    return results
}


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

router.get('/skorozvon/get/weekCalls/:timeDate', async (req, res) => {
    const startDateStr = req.params.timeDate
    const startDate = dayjs(startDateStr)
    const nowDate = dayjs()

    const startTimestamp = startDate.valueOf()
    const nowTimestamp = nowDate.valueOf()

    const millisecondsInDay = 24 * 60 * 60 * 1000

    const daysDiff = Math.floor((nowTimestamp - startTimestamp) / millisecondsInDay)

    const weekDaysArray = []

    for (let i = 1; i <= daysDiff; i++) {
        const currentDay = startDate.add(i, 'day')
        weekDaysArray.push(currentDay.format('YYYY-MM-DD'))
    }

    const processedData = await processDates(weekDaysArray)

    res.json({ data: processedData })
})

router.get('/skorozvon/get/monthCalls/:timeDate', async (req, res) => {
    const inputDateStr = req.params.timeDate
    const inputDate = dayjs(inputDateStr)
    const startOfMonth = inputDate.startOf('month')
    const endOfMonth = dayjs()

    const startTimestamp = startOfMonth.valueOf()
    const endTimestamp = endOfMonth.valueOf()

    const millisecondsInDay = 24 * 60 * 60 * 1000

    const daysDiff = Math.floor((endTimestamp - startTimestamp) / millisecondsInDay)

    const datesArray = []
    for (let i = 0; i <= daysDiff; i++) {
        const currentDay = startOfMonth.add(i, 'day')
        datesArray.push(currentDay.format('YYYY-MM-DD'))
    }

    const processedData = await processDates(datesArray)

    res.json({ data: processedData })
})

async function createOrUpdateUserStats(dateStr) {
    const callRecord = await skorozvonCalls.findOne({ date: dateStr })

    if (!callRecord || !callRecord.calls) {
      console.log(`Нет вызовов за ${dateStr}`)
      return
    }
  
    const leads = await Leads.find({ date: dateStr })
    const leadsCountMap = {}
    for (const lead of leads) {
      if (lead.starter) {
        leadsCountMap[lead.starter] = (leadsCountMap[lead.starter] || 0) + 1
      }
    }
  
    const callCounts = {}

    for (const call of callRecord.calls) {
      const username = call.username || 'Не определено'
      const callType = call.call_type
      if (callType === 'incoming' || callType === 'outgoing') {
        callCounts[username] = (callCounts[username] || 0) + 1
      }
    }
  
    const usersStatsArray = [];
    const totalStats = {
      username: 'total',
      totalCalls: 0,
      totalLeads: 0,
      salary: 0,
      bonus: 0
    };
  
    for (const username in callCounts) {
      const totalCalls = callCounts[username]
      const leadsCount = leadsCountMap[username] || 0
  
      const incoming = totalCalls
      const outgoing = totalCalls
      const salary = (incoming + outgoing) + leadsCount * 125
      const bonus = (incoming + outgoing) * ((incoming + outgoing) * 0.0001 + leadsCount * 0.01)
  
      const userStat = {
        username,
        totalCalls,
        totalLeads: leadsCount,
        salary,
        bonus
      };
  
      usersStatsArray.push(userStat);
  
      totalStats.totalCalls += totalCalls
      totalStats.totalLeads += leadsCount
      totalStats.salary += salary
      totalStats.bonus += bonus
    }

    usersStatsArray.push(totalStats);
  
    await UsersStats.findOneAndUpdate(
      { date: dateStr },
      { date: dateStr, stats: usersStatsArray },
      { upsert: true }
    );
  
    console.log(`Статистика за ${dateStr} успешно обновлена.`);
}

async function processRange(startDateStr, endDateStr) {
    const startDate = new Date(startDateStr)
    const endDate = new Date(endDateStr)
  
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0]
      await createOrUpdateUserStats(dateStr)
    }
  
    const data = await UsersStats.find({
      date: { $gte: startDateStr, $lte: endDateStr }
    });
  
    const resultMap = {}
    data.forEach(item => {
      const username = item.username || 'Не определено';
  
      if (!resultMap[username]) {
        resultMap[username] = {
          username,
          totalCalls: 0,
          totalLeads: 0,
          salary: 0,
          bonus: 0
        };
      }
  
      resultMap[username].totalCalls += item.totalCalls || 0;
      resultMap[username].totalLeads += item.totalLeads || 0;
      resultMap[username].salary += item.salary || 0;
      resultMap[username].bonus += item.bonus || 0;
    });

    return Object.values(resultMap);
}

router.get('/skorozvon/get/allData/:date', async (req, res) => {
    try {
      const date = req.params.date;
      await createOrUpdateUserStats(date);

      const data = await UsersStats.findOne({ date });
  
      if (!data) {
        return res.status(404).json({ message: 'Данные за указанную дату не найдены' });
      }
  
      res.json({ date: data.date, stats: data.stats });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// --- РОУТ ДЛЯ НЕДЕЛИ ---
router.get('/skorozvon/get/week/:date', async (req, res) => {
    try {
      const { date } = req.params;
      const inputDate = new Date(date);
      const dayOfWeek = inputDate.getDay(); // 0 (воскресенье) - 6 (суббота)
      const diffToMonday = (dayOfWeek + 6) % 7; // чтобы получить понедельник
      const start = new Date(inputDate);
      start.setDate(inputDate.getDate() - diffToMonday);
      start.setHours(0,0,0,0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23,59,59,999);
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];
  
      // Обработка каждого дня недели
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        await createOrUpdateUserStats(dateStr);
      }
  
      // Собираем и суммируем за неделю
      const data = await UsersStats.find({ date: { $gte: startStr, $lte: endStr } });
      const resultMap = {};
  
      data.forEach(item => {
        const username = item.username || 'Не определено';
        if (!resultMap[username]) {
          resultMap[username] = {
            username,
            totalCalls: 0,
            totalLeads: 0,
            salary: 0,
            bonus: 0
          };
        }
        resultMap[username].totalCalls += item.totalCalls || 0;
        resultMap[username].totalLeads += item.totalLeads || 0;
        resultMap[username].salary += item.salary || 0;
        resultMap[username].bonus += item.bonus || 0;
      });
  
      res.json({
        period: 'week',
        startDate: startStr,
        endDate: endStr,
        data: Object.values(resultMap)
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Ошибка сервера' });
    }
  });
  
  // --- РОУТ ДЛЯ МЕСЯЦА ---
  router.get('/skorozvon/get/month/:date', async (req, res) => {
    try {
      const { date } = req.params;
      const inputDate = new Date(date);
      const start = new Date(inputDate.getFullYear(), inputDate.getMonth(), 1);
      const end = new Date(inputDate.getFullYear(), inputDate.getMonth() + 1, 0);
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];
  
      // Обработка каждого дня месяца
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        await createOrUpdateUserStats(dateStr);
      }
  
      // Собираем и суммируем за месяц
      const data = await UsersStats.find({ date: { $gte: startStr, $lte: endStr } });
      const resultMap = {};
  
      data.forEach(item => {
        const username = item.username || 'Не определено';
        if (!resultMap[username]) {
          resultMap[username] = {
            username,
            totalCalls: 0,
            totalLeads: 0,
            salary: 0,
            bonus: 0
          };
        }
        resultMap[username].totalCalls += item.totalCalls || 0;
        resultMap[username].totalLeads += item.totalLeads || 0;
        resultMap[username].salary += item.salary || 0;
        resultMap[username].bonus += item.bonus || 0;
      });
  
      res.json({
        period: 'month',
        startDate: startStr,
        endDate: endStr,
        data: Object.values(resultMap)
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Ошибка сервера' });
    }
  });



module.exports = router