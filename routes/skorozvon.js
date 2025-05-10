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

// Функции для работы с датами (можете использовать moment.js или date-fns)
function getDatesRange(startDate, numDays) {
    const dates = [];
    let currentDate = new Date(startDate);
  
    for (let i = 0; i < numDays; i++) {
      dates.push(formatDate(new Date(currentDate))); // Форматируем дату в строку, подходящую для вашей БД
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
  }
  
  function formatDate(date) {
    // Форматирует дату в строку "YYYY-MM-DD" (или другой формат, используемый в вашей базе данных)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  function calculateEndDate(startDate, numDays) {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + numDays - 1); // Вычитаем 1, потому что включаем начальную дату
    return formatDate(endDate);
  }
  
  
  
  // Функция для суммирования статистики
  function sumUserStats(statsArrays) {
    const summedStatsMap = new Map(); // Для удобства и эффективности
  
    for (const statsArray of statsArrays) {
      if (!statsArray || !Array.isArray(statsArray)) {
        console.warn("Invalid statsArray:", statsArray);
        continue; // Пропускаем этот массив, если он недействителен
      }
  
      for (const userStat of statsArray) {
        const username = userStat.username;
        if (!summedStatsMap.has(username)) {
          // Инициализация записи, если её нет
          summedStatsMap.set(username, {
            username: username,
            totalCalls: 0,
            totalLeads: 0,
            salary: 0,
            bonus: 0,
          });
        }
        const summedStat = summedStatsMap.get(username);
        summedStat.totalCalls += userStat.totalCalls;
        summedStat.totalLeads += userStat.totalLeads;
        summedStat.salary += userStat.salary;
        summedStat.bonus += userStat.bonus;
      }
    }
  
    // Преобразование Map обратно в массив объектов
    return Array.from(summedStatsMap.values());
  }
  
  
  
  // Роут для получения данных за неделю (передаем только начальную дату)
  router.get('/skorozvon/get/weeklyData/:startDate', async (req, res) => {
    try {
      const startDate = req.params.startDate;
      const numDays = 7; // Длительность недели
      const endDate = calculateEndDate(startDate, numDays);
      const dates = getDatesRange(startDate, numDays); // Используем numDays вместо endDate в getDatesRange
  
      // Сначала обновляем статистику за все дни
      for (const date of dates) {
        await createOrUpdateUserStats(date);
      }
  
      // Затем получаем статистику из базы данных
      const usersStatsArrays = await Promise.all(
        dates.map(date => UsersStats.findOne({ date }).then(doc => doc ? doc.stats : null))
      );
  
      // Суммируем статистику
      const summedStats = sumUserStats(usersStatsArrays);
  
      res.json({ startDate, endDate, stats: summedStats });
  
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Ошибка сервера' });
    }
  });
  
  
  // Роут для получения данных за месяц (передаем только начальную дату)
  router.get('/skorozvon/get/monthlyData/:startDate', async (req, res) => {
    try {
      const startDate = req.params.startDate;
      const numDays = 30; // Длительность месяца (можно сделать 31 или использовать более точный расчет)
      const endDate = calculateEndDate(startDate, numDays);
      const dates = getDatesRange(startDate, numDays);
  
      // Сначала обновляем статистику за все дни
      for (const date of dates) {
        await createOrUpdateUserStats(date);
      }
  
      // Затем получаем статистику из базы данных
      const usersStatsArrays = await Promise.all(
        dates.map(date => UsersStats.findOne({ date }).then(doc => doc ? doc.stats : null))
      );
  
      // Суммируем статистику
      const summedStats = sumUserStats(usersStatsArrays);
  
      res.json({ startDate, endDate, stats: summedStats });
  
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Ошибка сервера' });
    }
  });

module.exports = router