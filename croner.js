const fs = require('fs')
const path = require('path')
const crone = require('node-cron')
const { json } = require('body-parser')


let crone10Sec = '*/10 * * * * *'
let crone1Hour = '0 * * * *'

crone.schedule(crone1Hour, () => {
    console.log('change-user-status crone has been started')

    let userFilePath = path.join(__dirname, 'users.json')
    //console.log(userFilePath)
    let usersData = JSON.parse(fs.readFileSync(userFilePath, 'utf-8'))
    //console.log(usersData)

    for (let i = 0; i < usersData.length; i++) {
        if (usersData[i].role == 'broker') {
            usersData[i].status = false
        }
    }
    
    let unparsedUsersData = JSON.stringify(usersData, null, 2)
    fs.writeFileSync(userFilePath, unparsedUsersData)
    console.log('rewrited users-statuses')
});

crone.schedule(crone1Hour, () => {
    console.log('lead-maxination crone has been started')

    let leadsPath = path.join(__dirname, 'data.json')

    let brokerLeads = JSON.parse(fs.readFileSync(leadsPath, 'utf-8'))

    for (let i = 0; i < brokerLeads.length; i++) {
        // если каждый час крон замечает что у лида не обработан
        if (brokerLeads[i].isSend == false) {
            brokerLeads[i].broker = ''  // убирает у лида какому брокеру
        }
    }

    let retakenData = JSON.stringify(brokerLeads, null, 2)
    fs.writeFileSync(leadsPath, retakenData)
})