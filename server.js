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


const RoleModel = require("./models/ranks.js")
const UserModel = require("./models/users.js")
const LeadsModel = require("./models/leads.js")



dotenv.config()
const app = express();
const PORT = 3000;
const secretKey = 'yourSecretKey';


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

// Leadorub API
app.post('/api/leadorub/leads', authenticateJWT, (req, res) => {

    const { phone, client_name, comment } = req.body;
    let broker = ""

    let newLead = LeadsModel({
        date: dayjs(new Date).format('YYYY-MM-DD'),
        phone: phone,
        client_name: client_name,
        comment: comment,
        isSend: false,
        broker: broker,
        starter: req.user.name
    })

    newLead.save()

    res.status(200).send('lead created')
});


app.get('/api/broker/nonLeads', authenticateJWT, async (req, res) => {
    const nonameLeads = await LeadsModel.find({'broker' : ""})
    console.log(nonameLeads)
    res.json(nonameLeads);
})


app.put('/api/broker/nonleads/:index', authenticateJWT, async (req, res) => {

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


app.get('/api/broker/leads', authenticateJWT, async (req, res) => {
    const allLeads = await LeadsModel.find()
    res.json(allLeads)
})

app.put('/api/broker/leads/:index', authenticateJWT, async (req, res) => {

    const index = parseInt(req.params.index);
    const { isSend } = req.body;

    const result = await LeadModel.updateOne({
        _id : index,
        isSend : isSend
    })

    if (result.modifiedCount === 1) {
        res.status(200).send('lead updated')
    } else {
        res.status(500).send('error')
    }
});


app.get('/api/broker/profile', authenticateJWT, async (req, res) => {
    const user = await UserModel.find({'login' : req.user.login})
    res.json(user)
})


app.put('/api/broker/profile', authenticateJWT, async (req, res) => {

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

app.put('/api/leads/:index', authenticateJWT, async (req, res) => {

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

app.delete('/api/leads/:index', authenticateJWT, async (req, res) => {

    const idx = req.params.index

    const result = await LeadsModel.deleteOne({'_id' : idx})

    if (result.deletedCount === 1) {
        res.status(200).send('lead deleted')
    } else {
        res.status(500).send('error')
    }

})

app.get('/api/leads', authenticateJWT, async (req, res) => {
    const allLeads = await LeadsModel.find()
    res.json(allLeads)
})


app.get('/', (req, res) => {
    res.redirect('/login.html');
});


app.get('/api/role/getRoles', async (req, res) => {
    let allRoles = await RoleModel.find()
    res.json({'roles' : allRoles})
})

app.post('/api/role/add', (req, res) => {
    let newRole = req.body.newRole
    try {
        let roleModel = RoleModel({
            role : newRole
        })

        roleModel.save()
        res.sendStatus(200)

    } catch (err) {
        res.sendStatus(500)
    }
})


app.post('/api/admin/users', authenticateJWT, async (req, res) => {

    try {
        const login = req.body.login 
        const password = req.body.password
        const name = req.body.name 
        const role = req.body.role

        const refRole = await RoleModel.findOne({
            'role' : role
        })

        console.log(refRole, '!!!!!!!!!!!!')

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

app.get('/api/admin/users', authenticateJWT, async (req, res) => {
    let allUsers = await UserModel.find()
    .populate('role')
    res.json(allUsers)
})



app.delete('/api/admin/users/:login', authenticateJWT, async (req, res) => {

    const login = req.params.login
    
    const result = await UserModel.deleteOne({'login' : login})

    if (result.deletedCount === 1) {
        res.status(200).send('user deleted ...')
    } else {
        console.log('error')
    }

})

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