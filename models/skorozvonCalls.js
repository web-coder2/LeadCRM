const { Schema, model } = require('mongoose');

const callEntrySchema = new Schema({
    username: {
        type: String,
        required: true
    },
    call_type: {
        type: String,
        required: true
    }
}, { _id: false })

const skorozvonCallsSchema = new Schema({
    date: {
        type: String,
        required: true,
        unique: true
    },
    calls: {
        type: [callEntrySchema],
        default: []
    }
});

skorozvonCallsSchema.index({ date: 1 });

module.exports = model('SkorozvonCalls', skorozvonCallsSchema);