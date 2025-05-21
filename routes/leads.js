const { Router } = require('express')
const LeadsModel = require("../models/leads.js")
const UserModel = require('../models/users.js')
const dayjs = require('dayjs')

const router = Router()

// СОЗАДТБ НВОЫЙ ЛИД

router.post('/api/leadorub/leads', async function (req, res) {

    const { phone, client_name, comment, date } = req.body;
    let broker = ""

    const refName = await UserModel.findOne({
        'name' : req.session.name
    })

    if (refName !== null) {

        let newLead = LeadsModel({
            date: dayjs(date).format('YYYY-MM-DD'),
            phone: phone,
            client_name: client_name,
            comment: comment,
            isSend: false,
            broker: broker,
            starter: refName._id
        })

        try {
            const result = await newLead.save()
            res.status(200).send('lead created')
        } catch (e) {
            console.log(e)
            res.status(500).send('failed create lead')
        }


    } else {
        console.log('unLogined created lead')
    }
    
});

// ИЗМЕНИТЬ СТАТУС ЛИДА

router.put('/api/leads/:index', async function(req, res)  {

    const idx = req.params.index
    const isSend = req.body.isSend
    const broker = req.body.broker

    const updateData = {}

    updateData.isSend = isSend

    if (broker !== undefined) {
        updateData.broker = broker
    }
    
    const result = await LeadsModel.updateOne(
        { _id : idx},
        { $set : updateData}
    )

    if (result.modifiedCount === 1) {
        res.status(200).send('lead updated')
    } else {
        res.status(500).send('error')
    }

})

// УДАЛИТЬ ЛИД

router.delete('/api/leads/:index', async function (req, res) {

    const idx = req.params.index

    const result = await LeadsModel.deleteOne({'_id' : idx})

    if (result.deletedCount === 1) {
        res.status(200).send('lead deleted')
    } else {
        res.status(500).send('error')
    }

})

// ПОЛУЧИТЬ ВСЕ ЛИДЫ

router.get('/api/leads', async function (req, res) {
    const allLeads = await LeadsModel.find().populate('starter')
    res.json(allLeads)
})


module.exports = router