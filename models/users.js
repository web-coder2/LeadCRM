const {Schema, model} = require('mongoose')

const users = new Schema({
    name: {
        type: String,
        required: true
    },
    login: {
        type: String,
        required: true
    }, 
    password: {
        type: String,
        required: true
    },
    role: {
        type: Schema.Types.ObjectId,
        ref: "RankSchema",
        required: true
    },
    status: {
        type: Boolean,
        required: true,
        default: false
    }
})

module.exports = model('UsersSchema', users)