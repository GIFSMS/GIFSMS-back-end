'use strict';

require('dotenv').config();
const PORT = process.env.PORT || 3001;
const PORTER = process.env.PORTER || 8001
const http = require('http');
const express = require('express');
const app = express();
const otherApp = express();
const server = http.createServer(app);
const cors = require('cors');
const io = require('socket.io')(PORT, {
    cors: {
        origin: "*",
    }
});
const User = require('./models/user.js');
otherApp.use(cors());
otherApp.use(express.json());

const getUser = async (req, res) => {
    let user = req.query.email;
    User.find({user}, function (err, use){    //user MODEL
        if (err){return console.error(err)}
        if (!use[0]){
            const newUser = new User({
                email: user, 
                favorites: [],
                friends:[],
                created: new Date(),
            })
            newUser.save(() => console.log("saving ", newUser))
            res.status(201).send(newUser);
        }else{
            res.status(200).send(use[0]);
        }
    })  
}
otherApp.get('/profile', getUser);
// app.post('/profile/:id', editUser)
// app.delete('/profile/:id', deleteEl)




//connection to database
const DATABASE = process.env.MONGO_URL
const mongoose = require('mongoose');
mongoose.connect(DATABASE, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
  console.log('connected to the database!');
});





//Holds participants in each room
const gifs = io.of('/gifs');
const gifsRooms = {};

gifs.on('connection', socket => {



    // console.log('User Joined Chat:' + socket.id);

    //Function to have users join rooms
    socket.on('join', payload => {

        //Initiates list of participants in specific rooms
        //If the room exists, push the joining user in the room array
        if (payload.room in gifsRooms) {
            //Checks for duplicate names in rooms
            if (!gifsRooms[payload.room].includes(payload.user)) {
                gifsRooms[payload.room].push(payload.user);
            }
        } else {
            //The room does not exist, create a new room array and add the user
            gifsRooms[payload.room] = [payload.user];
        }

        console.log('Room: ', payload.room)
        console.log('User Joined: ', payload.user);

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

    socket.io('logingif', payload => {
        let user = payload.user
        console.log("IN LOGIN: ", payload)
        User.find({user}, function (err, userer){
                if (err){return console.error(err)}
                if (!userer[0]){
                    const newUser = new User({
                        email: user, 
                        favorites: [],
                        friends:[],
                        created: new Date(),
                    })
                    newUser.save(() => console.log("saving ", newUser))
                    gifs.to(payload.socketid).emit('profile', newUser)
                }else{
                    gifs.to(payload.socketid).emit('profile', userer[0])
                }
            }
        


    )})


    //listen to new messages from clients
    socket.on('message', payload => {
        //push the message to all other clients
        gifs.in(payload.room).emit('message', payload);
        console.log(payload);
    })

    //Handles users leaving rooms
    socket.on('leave', payload => {

        //Removes leaving user from room array
        gifsRooms[payload.room] = gifsRooms[payload.room].filter(user => user !== payload.user);

        //Sends participants to all clients in specific room
        let participants = gifsRooms[payload.room];
        gifs.in(payload.room).emit('get participants', { participants })

        //Emits user left room notification to clients in specific room
        socket.to(payload.room).emit('user disconnected', payload);

        //When a user leaves a room, see if room is empty and delete room
        if (gifsRooms[payload.room].length === 0) {
            if (gifsRooms[payload.room] !== "Main Room") {
                delete gifsRooms[payload.room];
            }
        }

    //     //Get List of rooms and send to all clients
        let rooms = Object.keys(gifsRooms);
        gifs.emit('get rooms', { rooms });

    //     //Handles removal of user from from
        socket.leave(payload.room);
    });
})
otherApp.listen(PORTER, () => console.log(`listening on ${PORTER}`));
server.listen(3004, () => console.log(`listening on ${3004}`));
