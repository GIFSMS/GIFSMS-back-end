'use strict';

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String },
    nickname: { type: String },
    favorites: [],
    friends: [],
    created: { type: Date },
});

const User = mongoose.model('User', userSchema);


module.exports = User;