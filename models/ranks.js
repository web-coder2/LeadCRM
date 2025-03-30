const {Schema, model} = require('mongoose')

const ranks = new Schema({
    role: {
        type: String,
        required: true,
        // enum: [
        //     'admin', 'broker', 'leadorub'  // по умолчанию только такие
        // ]
    }
})


module.exports = model('RankSchema', ranks)