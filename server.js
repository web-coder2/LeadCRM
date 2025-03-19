const dayjs = require('dayjs')
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const secretKey = 'yourSecretKey';

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

// API Endpoints - Require Authentication
app.get('/api/user', authenticateJWT, (req, res) => {
    res.json({ user: req.user });
});

// Admin API Endpoints
app.get('/api/admin/users', authenticateJWT, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).send('Forbidden');
    res.json(users);
});

app.post('/api/admin/users', authenticateJWT, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).send('Forbidden');

    const { login, password, name, role } = req.body;
    const newUser = { login, password, name, role, status: true };
    users.push(newUser);
    writeData('users.json', users);
    res.status(201).send('User created successfully');
});

app.delete('/api/admin/users/:login', authenticateJWT, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).send('Forbidden');
    const { login } = req.params;

    // Prevent deletion of the admin user
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

    // If no online brokers, assign offline brokers in a round-robin fashion
    if (!broker) {
        broker = getNextAvailableBroker(false); // Pass false to allow offline brokers  (убрать параметр false если нужно чтобы автоматические на оффлайн бркоеров переводились лиды)
        broker = ""
      /*
        // Commented out example of how to assign offline brokers using the same round-robin logic
        let offlineBrokers = users.filter(user => user.role === 'broker');

        if (offlineBrokers.length === 0) {
            return res.status(500).send('No brokers available.');
        }
        broker = offlineBrokers[brokerIndex % offlineBrokers.length].login;
        brokerIndex = (brokerIndex + 1) % offlineBrokers.length;
      */

    }

    const newLead = {
        phone,
        client_name,
        comment,
        isSend: false,
        broker: broker,
        starter: req.user.name,
        date: dayjs(new Date).format('YYYY-MM-DD-HH:mm:ss')
    };

    console.log(newLead)
    console.log(req.user)

    leads.push(newLead);
    writeData('data.json', leads);
    res.status(201).send('Lead created successfully');
});


// Broker API
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

app.put('/api/broker/nonleads/:index', authenticateJWT, (req, res) => {
    if (req.user.role !== 'broker') return res.status(403).send('Forbidden');

    const leadIDX = parseInt(req.params.index)
    const brokerLogin = req.body.login


    const noneBrokerLeads = leads.filter(lead => lead.broker === '');

    if (leadIDX >= 0 && leadIDX < noneBrokerLeads.length) {
        noneBrokerLeads[leadIDX].broker = brokerLogin
        writeData('data.json', noneBrokerLeads);
        res.status(200).send('Lead updated successfully');
    } else {
        res.status(404).send('Lead not found');
    }

})


app.put('/api/broker/leads/:index', authenticateJWT, (req, res) => {
    if (req.user.role !== 'broker') return res.status(403).send('Forbidden');

    const index = parseInt(req.params.index);
    const { isSend } = req.body;
    const brokerLeads = leads.filter(lead => lead.broker === req.user.login);

    if (index >= 0 && index < brokerLeads.length) {
        const leadIndex = leads.findIndex(lead => lead.phone === brokerLeads[index].phone); // Find actual index in the leads array
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
    if (req.user.role !== 'broker') return res.status(403).send('Forbidden');
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

// Lead Management API (Admin)
app.get('/api/leads', authenticateJWT, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).send('Доступ запрещен');
  }
  res.json(leads);
});

// PUT lead (for admin - update)
app.put('/api/leads/:index', authenticateJWT, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).send('Доступ запрещен');
  }

  const index = parseInt(req.params.index);
  const { status, isSend, broker } = req.body;

  if (index >= 0 && index < leads.length) {
    leads[index].status = status;
    leads[index].isSend = isSend;
    // Update broker if provided
    if (broker) {
      leads[index].broker = broker;
    }
    writeData('data.json', leads);
    res.status(200).send('Лид успешно обновлен');
  } else {
    res.status(404).send('Лид не найден');
  }
});

// DELETE lead (for admin)
app.delete('/api/leads/:index', authenticateJWT, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).send('Доступ запрещен');
  }
  const index = parseInt(req.params.index);

  if (index >= 0 && index < leads.length) {
    leads.splice(index, 1);
    writeData('data.json', leads);

    // Update leads array in memory
    leads = readData('data.json'); // Reload data from the file

    res.status(200).send('Лид успешно удален');
  } else {
    res.status(404).send('Лид не найден');
  }
});

// Initial Route
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

app.listen(PORT, () => {
    console.log(`Server listening at http://localhost:${PORT}`);
});
