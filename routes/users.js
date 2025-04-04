const {Router} = require('express')

const RoleModel = require("./models/ranks.js")
const UserModel = require("./models/users.js")
const LeadsModel = require("./models/leads.js")

const app = Router()