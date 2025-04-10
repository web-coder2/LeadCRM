const { Router } = require('express')
const LeadsModel = require("../models/leads.js")
const dayjs = require('dayjs')

const router = Router()

// СОЗАДТБ НВОЫЙ ЛИД

router.post('/api/leadorub/leads', async function (req, res) {

    const { phone, client_name, comment } = req.body;
    let broker = ""

    let newLead = LeadsModel({
        date: dayjs(new Date).format('YYYY-MM-DD'),
        phone: phone,
        client_name: client_name,
        comment: comment,
        isSend: false,
        broker: broker,
        starter: req.session.name
    })

    console.log('lead created by ', newLead)

    try {
        const result = await newLead.save()
        res.status(200).send('lead created')
    } catch (e) {
        console.log(e)
        res.status(500).send('failed create lead')
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
    const allLeads = await LeadsModel.find()
    res.json(allLeads)
})


module.exports = router