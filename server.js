const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const croner = require('./croner.js')
const path = require('path')
const mongoose = require('mongoose')
const dotenv = require('dotenv')
const session = require('express-session')
const RoleModel = require('./models/ranks.js')


// ИМПОРТ МОДЕЛЕЙ
const UserModel = require("./models/users.js")

// ИМПОРТ РОУТОВ
const usersRoute = require('./routes/users.js')
const rolesRoute = require('./routes/roles.js')
const leadsRoute = require('./routes/leads.js')
const brokersRoute = require('./routes/brokers.js')

dotenv.config()

const app = express();
const PORT = 3000;


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

app.use(session({
    secret : "qwertyuiop123A",
    resave: false,
    saveUninitialized: false
}))

app.use(cookieParser());


// middleware routes
app.use(usersRoute)
app.use(rolesRoute)
app.use(leadsRoute)
app.use(brokersRoute)


app.get('/login', async (req, res) => {
    await res.sendFile(path.join(__dirname, 'public', 'login.html'))
})

app.get('/admin', async (req, res) => {
    await res.sendFile(path.join(__dirname, 'public', 'admin.html'))
})

app.get('/broker', async (req, res) => {
    await res.sendFile(path.join(__dirname, 'public', 'broker.html'))
})

app.get('/leadorub', async (req, res) => {
    await res.sendFile(path.join(__dirname, 'public', 'leadorub.html'))
})




app.post('/login', async (req, res) => {

    const login = req.body.login
    const password = req.body.password

    try {
        const user = await UserModel.findOne({'login' : login, 'password' : password}).populate('role')

        if (user) {
            req.session.role = user.role
            req.session.name = user.name
            req.session.login = user.login
            req.session.password = user.password
            req.session.status = user.status


            req.session.user = {
                'user' : user.role,
                'name' : user.name,
                'login' : user.login,
                'password' : user.password,
                'status' : user.status
            }
            console.log('***************', req.session.role)

            req.session.save(async (err) => {
                if (err) {
                  throw err
                }
                if (req.session.role.role == "admin") {
                    await res.redirect("/admin")
                } else if (req.session.role.role == "broker") {
                    await res.redirect("/broker")
                } else if (req.session.role.role == "leadorub") {
                    await res.redirect("/leadorub")
                } else {
                    await res.redirect("/login")
                }
              })

        } else {
            console.log('user not found')
            await res.redirect("/login")
        }
    } catch (e) {
        console.log('error !!!!!!!!!! ', e)
    }
})

// Logout route
app.get('/logout', async (req, res) => {
    console.log("DEATH **************", req.session.user)
    await req.session.destroy()
    res.redirect('/login.html');
});



app.get('/', (req, res) => {

    try {
        if (req.session.role.role == "admin") {
            res.redirect("/admin")
        } else if (req.session.role.role == "broker") {
            res.redirect("/broker")
        } else if (req.session.role.role == "leadorub") {
            res.redirect("/leadorub")
        }
    } catch (e) {
        res.redirect("/login")
    }

})

app.get('/api/user', (req, res) => {
    res.json({ user: req.session.user });
});


async function startApp() {
    try {
        const uri = `mongodb://${MONGO_USER}:${MONGO_PASS}@${MONGO_URL}:${MONGO_PORT}/${DATABASE_NAME}?authSource=admin`
        await mongoose.connect(uri)
    } catch (err) {
        console.log(err)
    }
}


app.listen(PORT, () => {
    startApp()
    console.log(`Server listening at http://localhost:${PORT}`);
});