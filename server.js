const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(cookieParser());

const secretKey = 'yourSecretKey';

const users = [
  { login: 'admin', password: 'admin123', name: 'Holo', role: 'admin' },
  { login: 'leadorub', password: 'pass1', name: 'alevtina', role: 'leadorub' },
  { login: 'leadorub2', password: 'pass2', name: 'Denis lk', role: 'leadorub' }
];

const readLeads = () => {
  try {
    const data = fs.readFileSync('data.json', 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading data.json:', err);
    return [];
  }
};

// Helper function to write leads to data.json
const writeLeads = (leads) => {
  try {
    fs.writeFileSync('data.json', JSON.stringify(leads, null, 2));
  } catch (err) {
    console.error('Error writing to data.json:', err);
  }
};

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


// Login route
app.post('/login', (req, res) => {
  const { login, password } = req.body;

  const user = users.find(u => u.login === login && u.password === password);

  if (user) {
    const token = jwt.sign({ login: user.login, role: user.role }, secretKey);
    res.cookie('token', token, { httpOnly: true });
    if (user.role === 'admin') {
      res.redirect('/admin.html');
    } else if (user.role === 'leadorub') {
      res.redirect('/leadorub.html');
    } else {
       res.send('Неизвестная роль');
    }
  } else {
    res.status(401).send('Неверные учетные данные');
  }
});

// Logout route
app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login.html');
});

// GET leads (for admin)
app.get('/api/leads', authenticateJWT, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).send('Доступ запрещен');
}
const leads = readLeads();
res.json(leads);
});

// POST lead (for leadorub)
app.post('/api/leads', authenticateJWT, (req, res) => {
if (req.user.role !== 'leadorub') {
  return res.status(403).send('Доступ запрещен');
}
const { phone, client_name, comment } = req.body;
const newLead = {
  phone,
  client_name,
  comment,
  status: 'created',
  isSend: false
};

const leads = readLeads();
leads.push(newLead);
writeLeads(leads);

res.status(201).send('Лид успешно создан');
});

// PUT lead (for admin - update)
app.put('/api/leads/:index', authenticateJWT, (req, res) => {
if (req.user.role !== 'admin') {
  return res.status(403).send('Доступ запрещен');
}

const index = parseInt(req.params.index);
const { status, isSend } = req.body;

const leads = readLeads();

if (index >= 0 && index < leads.length) {
  leads[index].status = status;
  leads[index].isSend = isSend;
  writeLeads(leads);
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
const leads = readLeads();

if (index >= 0 && index < leads.length) {
  leads.splice(index, 1);
  writeLeads(leads);
  res.status(200).send('Лид успешно удален');
} else {
  res.status(404).send('Лид не найден');
}
});

// Route to serve the login page initially
app.get('/', (req, res) => {
    res.redirect('/login.html');
});


app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});