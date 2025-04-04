const { Router } = require('express')
const RoleModel = require("../models/ranks.js")
const jwt = require('jsonwebtoken');
const secretKey = 'yourSecretKey';


router = Router()


// ПОЛУЧИТЬ ВСЕ РОЛИ

router.get('/api/role/getRoles', async function (req, res) {
    let allRoles = await RoleModel.find()
    res.json({'roles' : allRoles})
})

// СОЗДАТЬ НОВУЮ РОЛЬ

router.post('/api/role/add', async function (req, res) {
    let newRole = req.body.newRole
    try {
        let roleModel = RoleModel({
            role : newRole
        })

        const result = await roleModel.save()
        console.log(result)
        res.sendStatus(200)

    } catch (err) {
        res.sendStatus(500)
    }
})


module.exports = router