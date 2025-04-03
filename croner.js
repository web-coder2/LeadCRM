const crone = require('node-cron')
const { json } = require('body-parser')

const RoleModel = require("./models/ranks.js")
const UserModel = require("./models/users.js")
const LeadsModel = require("./models/leads.js")


let crone10Sec = '*/10 * * * * *'
let crone1Hour = '0 * * * *'

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

crone.schedule(crone1Hour, () => {
    resetBrokerStatus()
    resetLeadByBroker()
})