'use strict';
require('dotenv').config();

const io = require('socket.io-client');

// const HOST = process.env.HOST || "http://gifsms-env.eba-pn2gaatk.us-east-2.elasticbeanstalk.com";
const HOST = process.env.HOST || "http://localhost:3004";

const socket = io.connect(HOST + "/gifs");

socket.emit('message', { message: "Test Message", user: "John" });

const user = "Ted";
const room = "My Private Room";

socket.emit('join', { user, room });

socket.on('user joined', payload => {
    console.log("User Joined Room: ", payload.user); //Sends notification of user name that join
})

socket.on('message', payload => {
    console.log(payload);
});

socket.on('profile', payload => {
    console.log("profile: ", payload);
}