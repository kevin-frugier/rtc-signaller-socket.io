var reTrailingSlash = /\/$/;

/**
  # rtc-signaller-socket.io

  This is a signaller that can be used as a drop-in replacement for
  [`rtc-signaller`](https://github.com/rtc-io/rtc-signaller), that
  works with a [`socket.io`](http://socket.io) server.

  ## Example Usage

  The following examples show how a client and server can be
  configured to work with socket.io, using
  [`rtc-quickconnect`](https://github.com/rtc-io/rtc-quickconnect) on
  the frontend.

  ### Server

  Run using `node examples/server.js`:

  <<< examples/server.js

  ### Client

  Run using `beefy examples/client.js`:

  <<< examples/client.js

**/
module.exports = function(socket, opts) {
  // create the signaller
  var announceTimer;
  var enterMessageType = (opts || {}).enterMessage;
  var leaveMessageType = (opts || {}).leaveMessage;
  var signaller = require('rtc-signal/signaller')(opts, bufferMessage);
  var queuedMessages = [];
  
  function bufferMessage(content, type) {
    var _type = (type || 'rtc-signal');
    var _content = (content || {});
    var connected = socket && socket.connected;
    if (! connected) {
      return queuedMessages.push({
        content : _content,
        type : _type
      });
    }
    socket.emit(_type, _content);
  }

  function init() {
    function _connected() {
      if (enterMessageType) {
        bufferMessage({}, enterMessageType);
      }
      queuedMessages.splice(0).forEach(function(_message) {
          bufferMessage(_message.content, _message.type);
      });
      signaller('connected');
    }
    
    socket.on('connect', _connected);
    if (socket && socket.connected) {
        _connected();
    }

    socket.on('disconnect', function() {
      signaller('disconnected');
    });

    socket.on('rtc-signal', signaller._process);
    return signaller;
  }

  signaller.announce = function(data) {
    if (socket && socket.connected) {
      // always announce on reconnect
      signaller.removeListener('connected', signaller._announce);
      signaller.on('connected', signaller._announce);
    }

    signaller._update(data);
    clearTimeout(announceTimer);

    // send the attributes over the network
    return announceTimer = setTimeout(signaller._announce, (opts || {}).announceDelay || 10);
  };

  signaller.leave = signaller.close = function() {
    queuedMessages = [];
    if (leaveMessageType) {
      if (socket && socket.connected) {
        socket.emit(leaveMessageType, {});
      }
      return true;
    } else {
      return socket && socket.disconnect();
    }
  };

  return init();
};
