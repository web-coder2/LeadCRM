const express = require('express')
const RoleModel = require("../models/ranks.js")
const UserModel = require("../models/users.js")
const router = express.Router()


// СОЗДАТЬ ЮЗЕРА

router.post('/api/admin/users', async function (req, res) {

    try {
        const login = req.body.login 
        const password = req.body.password
        const name = req.body.name 
        const role = req.body.role

        console.log(req.body)

        const refRole = await RoleModel.findOne({
            'role' : role
        })

        let newUser = await UserModel({
            name: name,
            login: login,
            password: password,
            role: refRole._id
        })


        newUser.save()
        res.status(200).send('user created')

    } catch (e) {
        res.status(500).send('error')
    }

})

// ПОЛУЧИТЬ ЮЗЕРОВ (РАСКРЫТЬ ОБХЕКТ ROLE)

router.get('/api/admin/users', async function (req, res) {
    let allUsers = await UserModel.find()
    .populate('role')
    res.json(allUsers)
})


// УДАЛИТЬ ЮЗЕРА

router.delete('/api/admin/users/:login', async function (req, res) {

    const login = req.params.login
    
    const result = await UserModel.deleteOne({'login' : login})

    if (result.deletedCount === 1) {
        res.status(200).send('user deleted ...')
    } else {
        console.log('error')
    }

})

module.exports = router