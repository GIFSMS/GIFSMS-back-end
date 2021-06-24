'use strict';

require('dotenv').config();
const PORT = process.env.PORT || 3002;
const http = require('http');
const express = require('express');
const app = express();
const server = http.createServer(app);
const io = require('socket.io')(PORT, {
    cors: {
        origin: "*",
    }
});
const User = require('./models/user.js');



//connection to database
const DATABASE = process.env.MONGO_URL
const mongoose = require('mongoose');
// const { truncate } = require('fs/promises');
mongoose.connect(DATABASE, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
    console.log('connected to the database!');
});


//Holds participants in each room
const gifs = io.of('/gifs');
const gifsRooms = {};
let allWhoEnter = [];

gifs.on('connection', socket => {

    //Function to have users join rooms
    socket.on('join', payload => {
        console.log("Socket:", socket.id);

        //Checks for duplicates in allWhoEnter Array
        let allWhoEnterDuplicate = allWhoEnter.reduce((acc, userObj) => {
            if (userObj.nickname === payload.user.nickname) acc = true;
            return acc;
        }, false)
        //Checks if there are no and pushes user and socket id in array
        if (!allWhoEnterDuplicate) {
            allWhoEnter.push({ ...payload.user, socketId: socket.id, room: payload.room });
        }
        gifs.emit('get all participants', allWhoEnter);

        //Initiates list of participants in specific rooms
        //If the room exists, push the joining user in the room array
        if (payload.room in gifsRooms) {
            //Checks for duplicate names in rooms
            let roomDuplicate = gifsRooms[payload.room].reduce((acc, userObj) => {
                if (userObj.nickname === payload.user.nickname) acc = true;
                return acc;
            }, false)
            if (!roomDuplicate) {
                gifsRooms[payload.room].push({ ...payload.user, socketId: socket.id });
            }
        } else {
            //The room does not exist, create a new room array and add the user
            gifsRooms[payload.room] = [{ ...payload.user, socketId: socket.id }];
        }

        //Joins the user to the room
        socket.join(payload.room);

        //Emits user joined room to clients
        gifs.in(payload.room).emit('user joined', payload);

        //Sends participants to all clients in specific room
        let participants = gifsRooms[payload.room];
        gifs.in(payload.room).emit('get participants', { participants })

        //Get List of rooms and send to all clients
        let rooms = Object.keys(gifsRooms);
        gifs.emit('get rooms', { rooms });
    });

    socket.on('logingif', payload => {
        let user = payload.user
        console.log("IN LOGIN: ", payload)
        User.find({ email: user.email }, function (err, userer) {
            if (err) { return console.error(err) }
            console.log("USERER: ", userer)
            if (!userer[0]) {
                const newUser = new User({
                    email: user.email,
                    nickname: user.nickname,
                    favorites: [],
                    friends: [],
                    created: new Date(),
                })
                console.log("NEWUSER: ", userer, newUser)
                newUser.save(() => console.log("Saver"))
                socket.emit('profile', newUser)
            } else {
                console.log("FOUND USER: ", userer)
                socket.emit('profile', userer[0])
            }
        }
        )
    })

    socket.on('update', payload => {
        console.log("GOT UPDATE CALL:, ", payload);

        // let step = User.findOneAndUpdate({email: payload.email}, {favorites: [...payload.favorites]}, {new: true});
        User.find({ email: payload.email }, function (err, selected) {
            if (err) { return console.error(err) }

            selected[0].favorites = [...payload.favorites]
            console.log("FOUND FOR UPDATE: ", selected[0])
            selected[0].save(() => selected)
            socket.emit('updatecheck', selected[0])
        });

    })

    socket.on('fetch profile', payload => {
        User.find({ email: payload }, function (err, selected) {
            if (err) { return console.error(err) }
            console.log('Fetched Profile:', selected[0]);
            socket.emit('fetch profile', selected[0]);
        })
    })


    //listen to new messages from clients
    socket.on('message', payload => {
        console.log("HELLO THERE MESSAGE:, ", payload)
        //push the message to all other clients
        gifs.in(payload.room).emit('message', payload);
    })

    //Handles users leaving rooms
    socket.on('leave', payload => {

        //Removes leaving user from room array
        gifsRooms[payload.room] = gifsRooms[payload.room].filter(user => user.nickname !== payload.user.nickname);

        //Removes leaving user from all who enter
        allWhoEnter = allWhoEnter.filter(user => user.nickname !== payload.user.nickname);
        //Sends all participants to users
        gifs.emit('get all participants', allWhoEnter);

        //Sends participants to all clients in specific room
        let participants = gifsRooms[payload.room];
        gifs.in(payload.room).emit('get participants', { participants })

        //Emits user left room notification to clients in specific room
        socket.to(payload.room).emit('user disconnected', payload);

        //When a user leaves a room, see if room is empty and delete room
        if (gifsRooms[payload.room].length === 0) {
            if (payload.room !== "Main Room") {
                delete gifsRooms[payload.room];
            }
        }

        //Get List of rooms and send to all clients
        let rooms = Object.keys(gifsRooms);
        gifs.emit('get rooms', { rooms });

        //Handles removal of user from from
        socket.leave(payload.room);
    });

    socket.on('disconnect', payload => {
        console.log('SocketID: ', socket.id);

        let user = allWhoEnter.filter(userObj => userObj.socketId === socket.id)[0]
        if (user) {
            //Removes leaving user from all who enter
            allWhoEnter = allWhoEnter.filter(user => user.socketId !== socket.id);
            //Sends all participants to users
            gifs.emit('get all participants', allWhoEnter);
            console.log('allWhoEnter', allWhoEnter)

            //Sends participants to all clients in specific room
            let participants = gifsRooms[user.room].filter(user => user.socketId !== socket.id);
            gifs.in(user.room).emit('get participants', { participants });

            //Emits user left room notification to clients in specific room
            socket.to(user.room).emit('user disconnected', { user });

            //When a user leaves a room, see if room is empty and delete room
            if (gifsRooms[user.room].length === 0) {
                if (user.room !== "Main Room") {
                    delete gifsRooms[user.room];
                }
            }

            //Get List of rooms and send to all clients
            let rooms = Object.keys(gifsRooms);
            gifs.emit('get rooms', { rooms });
        }

    })
})
// otherApp.listen(PORTER, () => console.log(`listening on ${PORTER}`));
server.listen(3004, () => console.log(`listening on ${3004}`));
