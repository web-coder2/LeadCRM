const { Router } = require('express')
const RoleModel = require("../models/ranks.js")
const UserModel = require("../models/users.js")
const LeadsModel = require("../models/leads.js")
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv').config()
const secretKey = process.env.SECRET_KEY
const router = Router()

const authenticateJWT = (req, res, next) => {
    const token = req.cookies.token;
    if (token) {
        jwt.verify(token, secretKey, (err, user) => {
            if (err) {
                return res.redirect('/login.html');
            }

            req.user = user;
            next();
        });
    } else {
        res.redirect('/login.html');
    }
};

router.use(authenticateJWT)

// ПОЛУЧИТЬ ВСЕ ЛИДЫ У КОТОРЫХ НЕТ БРОКЕРА

router.get('/api/broker/nonLeads', async function(req, res) {
    const nonameLeads = await LeadsModel.find({'broker' : ""})
    console.log(nonameLeads)
    res.json(nonameLeads);
})

// ПРИСВОИЬ КАКОМУ ЛИБО ЛИДУ БЛОКЕРА

router.put('/api/broker/nonleads/:index', async function(req, res) {

    const login = req.body.login
    const leadId = req.params.index
    const result = await LeadsModel.updateOne(
        {'_id' : leadId},
        {'broker' : login}
    )

    if (result.modifiedCount === 1) {
        res.status(200).send('lead updated')
    } else {
        res.status(500).send('error')
    }

})

// ПОЛУЧИТЬ ВСЕХ ЛИДОВ (ДЛЯ БРОКЕРА)

router.get('/api/broker/leads', async function(req, res) {
    const allLeads = await LeadsModel.find()
    res.json(allLeads)
})

// ИЗМЕНИТЬ СТАТУС ЛИДА (СО СТОРОНЫ БРОКЕРА)

router.put('/api/broker/leads/:index', async function(req, res) {

    const leadIDX = req.params.index
    const isSend = req.body.isSend

    const result = await LeadsModel.updateOne(
        {_id : leadIDX},
        {isSend : isSend}
    )

    if (result.modifiedCount === 1) {
        res.status(200).send('lead updated')
    } else {
        res.status(500).send('error')
    }
});

// ПОЛУЧИТЬ ОБХЕКТ ЮЗЕРА ПО ЕГО ЛОГИНУ (КОГДА БРКОЕР ЗАЛОГИНИЛСЯ)

router.get('/api/broker/profile', async function(req, res) {
    const user = await UserModel.find({'login' : req.user.login})
    res.json(user)
})

// ИЗМЕНИТЬ СОСТОЯНИЕ БРКРЕРА (ONLINE / OFFLINE)

router.put('/api/broker/profile', async function(req, res) {

    const status = req.body.status
    const login = req.body.login

    const result = await UserModel.updateOne(
        {'login' : login},
        {'status' : status}
    )

    if (result.modifiedCount === 1) {
        res.status(200).send('profile updated')
    }

})


module.exports = router