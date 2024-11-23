const path = require("path");
const http = require("http");
const express = require("express");
const app = express();
const socketio = require("socket.io");
const mongoose = require('mongoose');
const { io: ioClient } = require('socket.io-client');
const formatMessage = require("./utils/messages");
const {
  userJoin,
  getCurrentUser,
  userLeaves,
  getRoomUsers,
} = require("./utils/users");

const server = http.createServer(app);
const io = socketio(server);
const botName = "Senior Bot";
const wsSelected = new Set();

/* Config Server1 */
io.on("connection", (socket) => {
  socket.on("joinRoom", ({ username, room }) => {
    const user = userJoin(socket.id, username, room);
    socket.join(user.room);
    socket.emit("message", formatMessage(botName, "Hola Mundo. Bienvenido a ProgramadorChat! 🖥️"));

  socket.on('select', () => { 
    wsSelected.add(socket); 
    console.log('Socket seleccionado:', socket.id); 
    setupSecondarySocket(socket); });

    socket.broadcast
      .to(user.room)
      .emit(
        "message",
        formatMessage(botName, `${user.username} Se ha unido al chat! 👋`)
      );

    io.to(user.room).emit("roomUsers", {
      room: user.room,
      users: getRoomUsers(user.room),
    });
  });

  socket.on("chatMessage", (msg) => {
    const user = getCurrentUser(socket.id);
    io.to(user.room).emit("message", formatMessage(user.username, msg));
  });

  socket.on("disconnect", () => { 
    const user = userLeaves(socket.id); 
    if (user) { io.to(user.room).emit( 
      "message", formatMessage(botName, 
        `${user.username} ha dejado el chat!`) ); 
        io.to(user.room).emit("roomUsers", 
          { room: user.room, users: getRoomUsers(user.room), }); } });

});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* API REST */
mongoose.connect("mongodb+srv://miguelrecinostab:tC1Ec5mmMEAUU1VQ@cluster0.gke5m.mongodb.net/test");
const tareaSchema = new mongoose.Schema({
    titulo: String,
    completado: Boolean,
});

const Tarea = mongoose.model("Tarea", tareaSchema);

app.post('/tareas', async(req, res) =>{
    const tarea = new Tarea(req.body);
    await tarea.save();
    io.emit("nuevaTarea", tarea);
    res.status(201).send(tarea);
});

app.get('/tareas', async(req, res) =>{
    const tareas = await Tarea.find();
    res.send(tareas);
});

app.put('/tareas/:id', async (req, res) => {
    try {
        const tarea = await Tarea.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!tarea) {
            return res.status(404).send('Tarea no encontrada');
        }
        io.emit('actualizarTarea', tarea);
        res.send(tarea);
    } catch (error) {
        res.status(400).send(error);
    }
});

app.delete('/tareas/:id', async (req, res) => {
    try {
        const tarea = await Tarea.findByIdAndDelete(req.params.id);
        if (!tarea) {
            return res.status(404).send('Tarea no encontrada');
        }
        io.emit('eliminarTarea', req.params.id);
        res.send(tarea);
    } catch (error) {
        res.status(400).send(error);
    }
});


const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Listening port ${port}..`));

