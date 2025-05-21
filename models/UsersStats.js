const { Schema, model } = require('mongoose');

const userStatSchema = new Schema({
  username: { type: String, required: true },
  totalCalls: { type: Number, default: 0 },
  totalLeads: { type: Number, default: 0 },
  salary: { type: Number, default: 0 },
  bonus: { type: Number, default: 0 }
});

const dailyUserStatsSchema = new Schema({
  date: { type: String, required: true, unique: true },
  stats: { type: [userStatSchema], default: [] },
  sumOffer : { type: Number, default: 0 },
  sumSalary : { type: Number, default: 0 },
  countHold : { type: Number, default: 0 },
});

module.exports = model('DailyUserStats', dailyUserStatsSchema);
