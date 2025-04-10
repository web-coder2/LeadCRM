# Используем базовый образ Node.js
FROM node:20-alpine

# Устанавливаем рабочую директорию внутри контейнера
WORKDIR /app

# Копируем package.json и package-lock.json (или yarn.lock)
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем все файлы приложения в контейнер
COPY . .

# Открываем порт, на котором будет работать приложение
EXPOSE 3000

# Команда для запуска приложения
CMD [ "npm", "start" ]