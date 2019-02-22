const express = require('express')
  , app = express()
  , path = require('path')
  , server = require('http').createServer(app)
  , socketIO = require('socket.io')(server)
  , five = require('johnny-five')
  , Raspi = require('raspi-io').RaspiIO
  , ip = require('ip')
  , PORT = 3000
  , board = new five.Board({
      io: new Raspi(),
      repl: false
    })
  
function emitUserCount(socketIO) {
  socketIO.sockets.emit('user:count', socketIO.engine.clientsCount)
  console.log('Total users: ', socketIO.engine.clientsCount)
}

//#region Express 
app.use(express.static(path.join(__dirname + '/public')))

// index route
app.get('/', function (req, res, next) {
  res.sendFile(path.join(__dirname + '/public/index.html'))
})

// variable input controller route
app.get('/controller', function (req, res, next) {
  res.sendFile(path.join(__dirname + '/public/controller.html'))
})
//#endregion 

// board ready event
board.on('ready', function (err) {
  if (err) {
    board.reset()
    return
  }

  function checkForZeroUsers(socketIO) {
    if (socketIO.engine.clientsCount === 0) {
      stop()
    }
  }

  console.log('board connected! Johnny-Five ready to go.')

  // setup motors 
  var motor1 = new five.Motor({
    pins: {
      pwm: 'GPIO13',
      dir: 'GPIO19'
      //brake: 'GPIO26'
    }
  })
  , motor2 = new five.Motor({
    pins: {
      pwm: 'GPIO12',
      dir: 'GPIO18'
      //brake: 'GPIO16'
    }
  })

  var enablePin1 = new five.Pin({
    pin: 'GPIO26',
    type: "digital"
  })
  , enablePin2 = new five.Pin({
    pin: 'GPIO16',
    type: "digital"
  });

  enablePin1.high()
  enablePin2.high()

  //#region Digital controls
  function forward(_speed) {
    var speed = _speed ? _speed : 255
    
    // motor 1 is reversed
    motor1.reverse(speed)
    motor2.forward(speed)
  }

  function reverse(_speed) {
    var speed = _speed ? _speed : 255

    // motor 1 is reversed
    motor1.forward(speed)
    motor2.reverse(speed)
  }

  function spinLeft(_speed) {
    var speed = _speed ? _speed : 255 * .8

    // motor 1 is reversed
    motor1.forward(speed)
    motor2.forward(speed)
  }

  function spinRight(_speed) {
    var speed = _speed ? _speed : 255 * .8

    // motor 1 is reversed
    motor1.reverse(speed)
    motor2.reverse(speed)
  }

  function stop() {
    motor1.stop()
    motor2.stop()
  }
  //#endregion


  // SocketIO 
  socketIO.on('connection', function (socket) {
    // console.log('New connection!')

    emitUserCount(socketIO)

    socket.on('forward', forward)

    socket.on('reverse', reverse)

    socket.on('spinLeft', spinLeft)

    socket.on('spinRight', spinRight)

    //#region Analog controls
    socket.on('leftMotor', function (input) {
      // console.log('leftMotor: ' + input.force)

      // INVERTED DIRECTIONS FOR THIS MOTOR
      if (input.direction === 'forward') {
        motor1.reverse(input.force)
      } else {
        motor1.forward(input.force)
      }
    })

    socket.on('rightMotor', function (input) {
      // console.log('rightMotor: ' + input.force)

      if (input.direction === 'forward') {
        motor2.forward(input.force)
      } else {
        motor2.reverse(input.force)
      }
    })

    socket.on('stop', function (motor) {
      // console.log('STOP!')
      if (!motor) {
        stop()
      } else if (motor === 'leftMotor') {
        motor1.stop()
      } else {
        motor2.stop()
      }
    })
    //#endregion

    socket.on('disconnect', function() {
      checkForZeroUsers(socketIO)
      emitUserCount(socketIO)
    })

    this.on("exit", function() {
      motor1.stop()
      motor2.stop()
    })
  })
})

// set the server to listen on PORT
server.listen(PORT, () => {
  // log the address and port
  console.log('Up and running on ' + ip.address() + ':' + PORT)
})



