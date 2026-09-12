require('dotenv').config();
const express = require('express');
const userRoutes = require('./routes/userRoutes');
const Properties = require('./routes/Properties')

const DashboardRoutes = require('./routes/Dashboard')
const projectRoutes = require('./routes/projects')
const Plots = require('./routes/Plots')
const sectors = require('./routes/sectors')
const paymentMode = require('./routes/PaymentMode')
const Booking = require('./routes/Booking')
const Reference = require('./routes/Reference')
const ReceiveAmount = require('./routes/ReceiveAmount')
const PreBooking = require('./routes/Prebooking')
const Profile = require('./routes/Profile')
const CreateUser = require('./routes/CreateUser')
const Report = require('./routes/Report');
const path = require('path');
const fs = require('fs');              // 🔹 (1) FS ADD KIYA

const app = express();
app.use(express.json());
var cors = require('cors')
app.use(cors()) 
app.use(express.json());

// 🔥 >>> LOGGING IMPORT
// const { requestLogger, errorLogger } = require("./middlewares/logs");

// 🔥 >>> LOGGING MIDDLEWARE (sabse pehle)
const logMiddleware = require('./middlewares/logs');
app.use(logMiddleware);
// const deleteLogsFolder = require('./middlewares/clean');
// app.use(deleteLogsFolder);

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/users', userRoutes);
app.use('/properties',Properties);
app.use('/dashboard' , DashboardRoutes)
app.use('/project' , projectRoutes)
app.use('/plots' , Plots)
app.use('/sectors' , sectors)
app.use('/payment' , paymentMode)
app.use('/booking' , Booking)
app.use('/reference' , Reference)
app.use('/receiveamount' , ReceiveAmount)
app.use('/prebooking' , PreBooking)
app.use('/profile' , Profile)
app.use('/user' , CreateUser)
app.use('/report', Report)

app.use('/logs', express.static(path.join(__dirname, 'logs')));


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});