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

  function _connected() {
    if (enterMessageType) {
      bufferMessage({}, enterMessageType);
    }
    queuedMessages.splice(0).forEach(function (_message) {
      bufferMessage(_message.content, _message.type);
    });
    signaller('connected');
  }

  function _disconnected() {
    signaller('disconnected');
  }

  function init() {
    socket.on('connect', _connected);
    if (socket && socket.connected) {
      _connected();
    }

    socket.on('disconnect', _disconnected);

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

  signaller.leave = signaller.close = function () {
    queuedMessages = []; //empty queue in case of re-use
    if (leaveMessageType) {
      if (socket) {
        if (socket.connected) {
          //If we still have an operational socket, politely tell we are leaving
          socket.emit(leaveMessageType, {});
        }
        //Remove events as the socket might be used later and we don't want to interfere
        socket.removeListener('connect', _connected);
        socket.removeListener('disconnect', _disconnected);
        socket.removeListener('rtc-signal', signaller._process);
      }
      signaller('disconnected'); //Force the disconnected signal because that's the end for the signaller's life
      return true;
    } else {
      if (!socket) {
        return true; //No socket, nothing to do
      }
      //Remove events
      socket.removeListener('connect', _connected);
      socket.removeListener('disconnect', _disconnected);
      socket.removeListener('rtc-signal', signaller._process);
      if (!socket.connected) {
        //Socket is connected, we signal disconnection manually because we removed events and disconnect the socket
        signaller('disconnected');
        return socket.disconnect();
      } else {
        return true; //Already disconnected nothing to do
      }
    }
  };

  return init();
};
