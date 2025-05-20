const express = require('express')
const axios = require('axios')
const router = express.Router()
const dotenv = require('dotenv')
const dayjs = require('dayjs')
const fs = require('fs')
const path = require('path')
const FormData = require('form-data')

const skorozvonCalls = require('../models/skorozvonCalls.js')
const Leads = require('../models/leads')
const UsersStats = require('../models/UsersStats')

dotenv.config()

const skorozvonAPI = process.env.skorozvonAPI
const skorozvonUSER = process.env.skorozvonUSER
const skorozvonID = process.env.skorozvonID
const skorozvonSecret = process.env.skorozvonSecret

const residenceBaseUrl = process.env.residenceBaseUrl
const residenceToken = process.env.residenceToken


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




function clearAndWritePhones(array) {
  let fileData = path.join(__dirname, '..', 'phones.txt')
  const data = array.join('\n')
  fs.writeFileSync(fileData, data, 'utf8')
}

async function getHoldFromLeads(date) {
  const allLeadsPhones = []

  const allLeads = await Leads.find({ 'date': date })

  allLeads.forEach(e => {
    let phone = parseInt(e.phone.replace(/\D+/g, ''))
    allLeadsPhones.push(phone)
  })

  clearAndWritePhones(allLeadsPhones)

  let data = new FormData()
  data.append('file', fs.createReadStream(path.join(__dirname, '..', 'phones.txt')))

  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://residence.hbnetwork.ru/api/statistics/counting-holds?startedAt[]=gte:2025-04-10&startedAt[]=lte:2025-05-16&_limit=0',
    headers: {
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2NjZiNjU5YjBlZWE3YzQwODVmOTAxNTciLCJsb2dpbiI6Iml2YW4iLCJpYXQiOjE3MjI2ODc5MzcsImV4cCI6Mzc3MjI2ODQzMzd9.9_UL1lKPhouKkbN9_ZMsjOEcqB87v5OujNae40aZxIs',
      ...data.getHeaders()
    },
    data: data
  }

  try {
    const response = await axios.request(config)
    const holdResponse = response.data

    return holdResponse
  } catch (e) {
    //console.log(e)
  }
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
    } catch (error) {
        console.error('Ошибка при получении и перезаписи данных Skorozvon:', error);
    }
}

async function processDates(datesArray) {
    const results = []

    for (const dateStr of datesArray) {
        let callsRecord = await skorozvonCalls.findOne({ date: dateStr })

        if (!callsRecord) {
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

function normalizeName(name) {
  if (!name) return ''
  return name.replace(/\s+/g, '').toLowerCase()
}

async function createOrUpdateUserStats(dateStr) {
  
  if ( new Date().getHours() >= 22 && new Date().getHours() <= 23 ) {   
    var dataHoldResponse = await getHoldFromLeads(dateStr)
  } else {
    var dataHoldResponse = {
      data : {
        sumOffer : 0,
        sumSalary : 0,
        count : 0
      }
    }
  }

  if (dataHoldResponse) {
    var sumOffer = dataHoldResponse.data.sumOffer
    var sumSalary = dataHoldResponse.data.sumSalary
    var countHold = dataHoldResponse.data.count
  } else {
    var sumOffer = 0
    var sumSalary = 0
    var countHold = 0
  }

  const callRecord = await skorozvonCalls.findOne({ date: dateStr })

  if (!callRecord || !callRecord.calls || callRecord.calls.length === 0) {
    return
  }

  const leads = await Leads.find({ date: dateStr }).populate('starter')
  const leadsCountMap = {}

  for (const lead of leads) {
    console.log('#####################', lead)
    if (lead.starter) {
      const normalizedStarter = normalizeName(lead.starter.name)
      leadsCountMap[normalizedStarter] = (leadsCountMap[normalizedStarter] || 0) + 1
    }
  }

  const callCounts = {};
  for (const call of callRecord.calls) {
    const usernameRaw = call.username || 'Не определено';
    const normalizedUsername = normalizeName(usernameRaw);
    const callType = call.call_type;
    if (callType === 'incoming' || callType === 'outgoing') {
      callCounts[normalizedUsername] = (callCounts[normalizedUsername] || 0) + 1;
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
    const totalCalls = callCounts[username];
    const leadsCount = leadsCountMap[username] || 0;

    const salary = (totalCalls * 2) + leadsCount * 125;
    const bonusCalls = (totalCalls * 0.0001)
    const bonusLeads = (leadsCount * 0.01 )
    const bonus = totalCalls * (bonusCalls + bonusLeads)
  

    const userStat = {
      username,
      totalCalls,
      totalLeads: leadsCount,
      salary,
      bonus
    };

    usersStatsArray.push(userStat);


    if (userStat.username !== 'неопределено' && userStat.username !== 'симаковвладимирстаниславович') {

      totalStats.totalCalls += totalCalls;
      totalStats.totalLeads += leadsCount;
      totalStats.salary += salary;
      totalStats.bonus += bonus;
    } 
  }

  usersStatsArray.push(totalStats);

  await UsersStats.findOneAndUpdate(
    { date: dateStr },
    { date: dateStr, stats: usersStatsArray, sumOffer: sumOffer, sumSalary: sumSalary, countHold: countHold },
    { upsert: true }
  );
}

router.get('/skorozvon/get/allData/:date', async (req, res) => {
    try {
      const date = req.params.date;
      await createOrUpdateUserStats(date);

      const data = await UsersStats.findOne({ date });
  
      if (!data) {
        return res.status(404).json({ message: 'Данные за указанную дату не найдены' });
      }
  
      res.json({ date: data.date, stats: data.stats, sumOffer: data.sumOffer, sumSalary: data.sumSalary, countHold: data.countHold });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Ошибка сервера' });
    }
});
  
  
router.get('/skorozvon/get/weeklyData/:startDate', async (req, res) => {
  try {
    const startDateStr = req.params.startDate;
    const startDate = dayjs(startDateStr, 'YYYY-MM-DD');
    if (!startDate.isValid()) {
      return res.status(400).json({ message: 'Некорректная дата' });
    }

    const dates = [];
    for (let i = 0; i < 7; i++) {
      dates.push(startDate.clone().add(i, 'day').format('YYYY-MM-DD'));
    }

    for (const date of dates) {
      await createOrUpdateUserStats(date);
    }

    const usersAggregated = {}; // { username: { totalCalls, totalLeads, salary, bonus } }

    const overallTotal = {
      username: 'total',
      totalCalls: 0,
      totalLeads: 0,
      salary: 0,
      bonus: 0
    };

    var totalWeekDataHold = {
      sumOffer: 0,
      sumSalary: 0,
      countHold: 0
    }

    for (const date of dates) {
      const data = await UsersStats.findOne({ date });

      if (data && data.stats) {

        totalWeekDataHold.sumOffer += data.sumOffer
        totalWeekDataHold.sumSalary += data.sumSalary
        totalWeekDataHold.countHold += data.countHold

        console.log(totalWeekDataHold, data.countHold, data.date)

        for (const stat of data.stats) {
          if (stat.username === 'total') continue

          if (!usersAggregated[stat.username]) {
            usersAggregated[stat.username] = {
              username: stat.username,
              totalCalls: 0,
              totalLeads: 0,
              salary: 0,
              bonus: 0
            };
          }

          // прибавляем показатели
          usersAggregated[stat.username].totalCalls += stat.totalCalls;
          usersAggregated[stat.username].totalLeads += stat.totalLeads;
          usersAggregated[stat.username].salary += stat.salary;
          usersAggregated[stat.username].bonus += stat.bonus;
          
          if (stat.username !== 'неопределено' && stat.username !== 'симаковвладимирстаниславович') {

            overallTotal.totalCalls += stat.totalCalls;
            overallTotal.totalLeads += stat.totalLeads;
            overallTotal.salary += stat.salary;
            overallTotal.bonus += stat.bonus;
          
          }

        }
      }
    }

    // Формируем массив пользователей
    const usersArray = Object.values(usersAggregated);
    // добавляем итоговую сумму в массив
    usersArray.push(overallTotal);

    res.json({
      period: `Week ${startDate.format('YYYY-MM-DD')} - ${startDate.clone().add(6, 'day').format('YYYY-MM-DD')}`,
      stats: usersArray,
      totalWeekDataHold: totalWeekDataHold
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
})
  

router.get('/skorozvon/get/monthlyData/:startDate', async (req, res) => {
  try {
    const startDateStr = req.params.startDate;
    const startDate = dayjs(startDateStr, 'YYYY-MM-DD');
    if (!startDate.isValid()) {
      return res.status(400).json({ message: 'Некорректная дата' });
    }

    const daysInMonth = startDate.daysInMonth();
    const dates = [];
    for (let i = 0; i < daysInMonth; i++) {
      dates.push(startDate.add(i, 'day').format('YYYY-MM-DD'));
    }

    for (const date of dates) {
      await createOrUpdateUserStats(date);
    }

    const usersAggregated = {};

    const overallTotal = {
      username: 'total',
      totalCalls: 0,
      totalLeads: 0,
      salary: 0,
      bonus: 0
    };

    const totalMonthHolData = {
      sumOffer: 0,
      sumSalary: 0,
      countHold: 0
    }

    for (const date of dates) {
      const data = await UsersStats.findOne({ date });

      if (data) {
        totalMonthHolData.sumOffer += data.sumOffer
        totalMonthHolData.sumSalary += data.sumSalary
        totalMonthHolData.countHold += data.countHold
      }

      if (data && data.stats) {
        for (const stat of data.stats) {
          if (stat.username === 'total') continue;

          if (!usersAggregated[stat.username]) {
            usersAggregated[stat.username] = {
              username: stat.username,
              totalCalls: 0,
              totalLeads: 0,
              salary: 0,
              bonus: 0
            };
          }

          usersAggregated[stat.username].totalCalls += stat.totalCalls;
          usersAggregated[stat.username].totalLeads += stat.totalLeads;
          usersAggregated[stat.username].salary += stat.salary;
          usersAggregated[stat.username].bonus += stat.bonus;

          if (stat.username !== 'неопределено' && stat.username !== 'симаковвладимирстаниславович') {

            overallTotal.totalCalls += stat.totalCalls;
            overallTotal.totalLeads += stat.totalLeads;
            overallTotal.salary += stat.salary;
            overallTotal.bonus += stat.bonus;

          }

        }
      }
    }

    const usersArray = Object.values(usersAggregated);
    usersArray.push(overallTotal);

    res.json({
      period: `Month ${startDate.format('YYYY-MM-DD')} - ${startDate.add(daysInMonth - 1, 'day').format('YYYY-MM-DD')}`,
      stats: usersArray,
      totalMonthHolData: totalMonthHolData
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router