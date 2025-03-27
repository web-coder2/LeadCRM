const {Schema, model} = require('mongoose')
const dayjs = require('dayjs')

const leadSchema = new Schema({

    "phone": {
        type: String,
        required: true
    },
    "client_name": {
        type: String,
        required: true
    },
    "comment": {
        type: String,
        required: true
    },
    "isSend": {
        type: Boolean
    },
    "broker": {
        type: Schema.Types.ObjectId,
        ref: "UsersSchema",
        required: true
    },
    "starter": {
        type: Schema.Types.ObjectId,
        ref: "UsersSchema",
        required: true
    },
    "date": {
        type: Date,
        required: true
    }

})

module.exports = model('LeadSchema' , leadSchema)