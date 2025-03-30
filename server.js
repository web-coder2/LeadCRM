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



const UserModel = require("./models/users.js")
const RoleModel = require("./models/ranks.js")
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

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(cookieParser());

// Helper functions to read/write JSON data
const readData = (filename) => {
    try {
        const data = fs.readFileSync(filename, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error(`Error reading ${filename}:`, err);
        return [];
    }
};

const writeData = (filename, data) => {
    try {
        fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error(`Error writing to ${filename}:`, err);
    }
};

// Load data
let users = readData('users.json');
let leads = readData('data.json');

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

// Get next available broker in round-robin fashion
let brokerIndex = 0;
const getNextAvailableBroker = (onlineOnly = true) => {
  let brokers = users.filter(user => user.role === 'broker');
  if (onlineOnly) {
      brokers = brokers.filter(user => user.status);
  }
  if (brokers.length === 0) {
      return null;
  }

  const broker = brokers[brokerIndex % brokers.length].login;
  brokerIndex = (brokerIndex + 1) % brokers.length;
  return broker;
};


// Login route
app.post('/login', (req, res) => {
    const { login, password } = req.body;
    const user = users.find(u => u.login === login && u.password === password);

    if (user) {
        const token = jwt.sign({ login: user.login, role: user.role, name: user.name }, secretKey);
        res.cookie('token', token, { httpOnly: true });

        switch (user.role) {
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
        // Set an error cookie
        res.cookie('loginError', 'Invalid login credentials', { maxAge: 5000 }); // Expires in 5 seconds

        // Redirect to login page
        res.redirect('/login.html');
    }
});

// Logout route
app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login.html');
});

app.get('/api/user', authenticateJWT, (req, res) => {
    res.json({ user: req.user });
});

app.get('/api/admin/users', authenticateJWT, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).send('Forbidden');
    res.json(users);
});

// app.post('/api/admin/users', authenticateJWT, (req, res) => {
//     if (req.user.role !== 'admin') return res.status(403).send('Forbidden');

//     const { login, password, name, role } = req.body;
//     const newUser = { login, password, name, role, status: true };
//     users.push(newUser);
//     writeData('users.json', users);
//     res.status(201).send('User created successfully');
// });




app.delete('/api/admin/users/:login', authenticateJWT, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).send('Forbidden');
    const { login } = req.params;

    if (login === 'admin') {
        return res.status(400).send('Cannot delete the admin user.');
    }

    users = users.filter(user => user.login !== login);
    writeData('users.json', users);
    res.status(200).send('User deleted successfully');
});

// Leadorub API
app.post('/api/leadorub/leads', authenticateJWT, (req, res) => {
    if (req.user.role !== 'leadorub') return res.status(403).send('Forbidden');

    const { phone, client_name, comment } = req.body;
    let broker = getNextAvailableBroker();

    if (!broker) {
        broker = getNextAvailableBroker(false);
        broker = ""
    }

    const newLead = {
        phone,
        client_name,
        comment,
        isSend: false,
        broker: broker,
        starter: req.user.name,
        date: dayjs(new Date).format('YYYY-MM-DD')
    };

    leads.push(newLead);
    writeData('data.json', leads);
    res.status(201).send('Lead created successfully');
});


app.get('/api/broker/leads', authenticateJWT, (req, res) => {
    if (req.user.role !== 'broker') return res.status(403).send('Forbidden');
    const brokerLeads = leads.filter(lead => lead.broker === req.user.login);
    res.json(brokerLeads);
});


app.get('/api/broker/nonLeads', authenticateJWT, (req, res) => {
    if (req.user.role !== 'broker') return res.status(403).send('Forbidden');
    const nonameLeads = leads.filter(lead => lead.broker === "");
    res.json(nonameLeads);
})

app.put('/api/broker/nonleads/:index', authenticateJWT, async (req, res) => {
    if (req.user.role !== 'broker') {
        return res.status(403).send('Forbidden');
    }

    const leadIDX = parseInt(req.params.index);
    const brokerLogin = req.body.login;

    if (isNaN(leadIDX)) {
        return res.status(400).send('Invalid index provided');
    }

    if (!brokerLogin) {
        return res.status(400).send('Broker login is required in the request body');
    }

    try {
        const noneBrokerLeads = leads.filter(lead => lead.broker === '');

        if (leadIDX >= 0 && leadIDX < noneBrokerLeads.length) {

            const leadToUpdate = noneBrokerLeads[leadIDX];
            const actualLeadIndex = leads.findIndex(lead => lead.phone === leadToUpdate.phone);

            if (actualLeadIndex === -1) {
                return res.status(404).send('Lead not found in main leads array');
            }

            leads[actualLeadIndex].broker = brokerLogin;

            await writeData('data.json', leads);
            res.status(200).send('Lead updated successfully');
        } else {
            res.status(404).send('Lead not found');
        }
    } catch (error) {
        console.error("Error updating lead:", error);
        res.status(500).send('Failed to update lead');
    }
});


app.put('/api/broker/leads/:index', authenticateJWT, (req, res) => {
    if (req.user.role !== 'broker') return res.status(403).send('Forbidden');

    const index = parseInt(req.params.index);
    const { isSend } = req.body;
    const brokerLeads = leads.filter(lead => lead.broker === req.user.login);

    if (index >= 0 && index < brokerLeads.length) {
        const leadIndex = leads.findIndex(lead => lead.phone === brokerLeads[index].phone);
        if (leadIndex !== -1) {
            leads[leadIndex].isSend = isSend;
            writeData('data.json', leads);
            res.status(200).send('Lead updated successfully');
        } else {
            res.status(404).send('Lead not found');
        }
    } else {
        res.status(404).send('Lead not found');
    }
});

app.get('/api/broker/profile', authenticateJWT, (req, res) => {
    const user = users.find(u => u.login === req.user.login);
    res.json(user);
});

app.put('/api/broker/profile', authenticateJWT, (req, res) => {
  if (req.user.role !== 'broker') return res.status(403).send('Forbidden');
  const { status } = req.body;
  const userIndex = users.findIndex(u => u.login === req.user.login);

  if (userIndex === -1) {
    return res.status(404).send('User not found');
  }

  users[userIndex].status = status;
  writeData('users.json', users);
  res.status(200).send('Profile updated successfully');
});

app.get('/api/leads', authenticateJWT, (req, res) => {
  res.json(leads);
});

app.put('/api/leads/:index', authenticateJWT, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).send('Доступ запрещен');
  }

  const index = parseInt(req.params.index);

  const isSend = req.body.isSend 
  const broker = req.body.broker

  const isSend2 = isSend == true ? true : false

  if (index >= 0 && index < leads.length) {
    leads[index].isSend = isSend2;

    if (broker) {
      leads[index].broker = broker;
    }

    writeData('data.json', leads);
    res.status(200).send('Лид успешно обновлен');
  } else {
    res.status(404).send('Лид не найден');
  }
});

app.delete('/api/leads/:index', authenticateJWT, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).send('Доступ запрещен');
  }
  const index = parseInt(req.params.index);

  if (index >= 0 && index < leads.length) {
    leads.splice(index, 1);
    writeData('data.json', leads);

    leads = readData('data.json');

    res.status(200).send('Лид успешно удален');
  } else {
    res.status(404).send('Лид не найден');
  }
});

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
        console.log(err)
        res.sendStatus(500)
    }
})


app.post('/api/admin/users', authenticateJWT, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).send('Не доступно')

    try {
        const login = req.body.login 
        const password = req.body.password
        const name = req.body.name 
        const role = req.body.role

        let newUser = UserModel({
            name: name,
            login: login,
            password: password,
            role: role
        })

        newUser.save()
        res.sendStatus(200)

    } catch (e) {
        console.log(e)
        res.sendStatus(500)
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