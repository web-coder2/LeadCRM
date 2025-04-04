const dayjs = require('dayjs')
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path')
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const croner = require('./croner.js')
const mongoose = require('mongoose')
const dotenv = require('dotenv')


// ИМПОРТ МОДЕЛЕЙ
const RoleModel = require("./models/ranks.js")
const UserModel = require("./models/users.js")
const LeadsModel = require("./models/leads.js")

// ИМПОРТ РОУТОВ
const usersRoute = require('./routes/users.js')
const rolesRoute = require('./routes/roles.js')
const leadsRoute = require('./routes/leads.js')
const brokersRoute = require('./routes/brokers.js')

dotenv.config()

const app = express();
const PORT = 3000;
const secretKey = process.env.SECRET_KEY


const MONGO_URL = process.env.DATABASE_URL
const MONGO_USER = process.env.DATABASE_USERNAME
const MONGO_PASS = process.env.DATABASE_PASSWORD
const MONGO_PORT = process.env.DATABASE_PORT
const DATABASE_NAME = process.env.DATABASE_NAME

const SKOROZVON_API = process.env.SKOROZVON_API



// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(cookieParser());


// middleware routes
app.use(usersRoute)
app.use(rolesRoute)
app.use(leadsRoute)
app.use(brokersRoute)


// Authentication Middleware
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


app.post('/login', async (req, res) => {

    const login = req.body.login
    const password = req.body.password
    const user = await UserModel.findOne({'login' : login, 'password' : password}).populate('role')

    if (user) {
        const token = jwt.sign({ login: user.login, role: user.role.role, name: user.name }, secretKey);
        res.cookie('token', token, { httpOnly: true });

        switch (user.role.role) {
            case 'admin':
                res.redirect('/admin.html');
                break;
            case 'leadorub':
                res.redirect('/leadorub.html');
                break;
            case 'broker':
                res.redirect('/broker.html');
                break;
            default:
                res.send('Unknown role');
        }

    } else {
        res.cookie('loginError', 'Invalid login credentials', { maxAge: 5000 });  
        res.redirect('/login.html');
    }
})

// Logout route
app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login.html');
});

app.get('/api/user', authenticateJWT, (req, res) => {
    res.json({ user: req.user });
});

app.get('/', (req, res) => {
    res.redirect('/login.html');
});

async function startApp() {
    try {
        const uri = `mongodb://${MONGO_USER}:${MONGO_PASS}@${MONGO_URL}:${MONGO_PORT}/${DATABASE_NAME}?authSource=admin`
        console.log(uri)
        await mongoose.connect(uri)
    } catch (err) {
        console.log(err)
    }
}

app.listen(PORT, () => {
    startApp()
    console.log(`Server listening at http://localhost:${PORT}`);
});