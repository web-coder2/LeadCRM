const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static('public')); // Для отдачи статических файлов (html, css, js)

// Временные пользователи (в реальном проекте храните в БД)
const users = [
  { username: 'admin', password: 'password', role: 'admin' },
  { username: 'ledorub', password: 'password', role: 'ledorub' },
  { username: 'user1', password: 'password', role: 'ledorub' },
  { username: 'user2', password: 'password', role: 'admin' },
];

let leads = []; // Инициализируем массив leads

// Функция для чтения данных из data.json
const loadLeads = () => {
  try {
    const data = fs.readFileSync('data.json', 'utf8');
    leads = JSON.parse(data);
  } catch (err) {
    console.error('Error reading data.json:', err);
    leads = []; // Если файл не существует или пуст, начинаем с пустого массива
  }
};

// Функция для записи данных в data.json
const saveLeads = () => {
  fs.writeFileSync('data.json', JSON.stringify(leads, null, 2));
};

loadLeads(); // Загружаем данные при старте сервера

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);

  if (user) {
    res.json({ success: true, role: user.role });
  } else {
    res.status(401).json({ success: false, message: 'Неверные учетные данные' });
  }
});

app.get('/leads', (req, res) => {
    res.json(leads);
});

app.post('/leads', (req, res) => {
    const newLead = { ...req.body, status: 'created' };
    leads.push(newLead);
    saveLeads();
    res.json({ message: 'Лид успешно добавлен' });
});

app.put('/leads/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const updatedLead = req.body;

  leads = leads.map((lead, index) => (index === id ? { ...lead, ...updatedLead } : lead));
  saveLeads();
  res.json({ message: 'Лид успешно обновлен' });
});

app.delete('/leads/:id', (req, res) => {
    const id = parseInt(req.params.id);
    leads = leads.filter((_, index) => index !== id);
    saveLeads();
    res.json({ message: 'Лид успешно удален' });
});


//  Отдаем login.html по умолчанию
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.listen(port, () => {
  console.log(`Сервер запущен на http://localhost:${port}`);
});