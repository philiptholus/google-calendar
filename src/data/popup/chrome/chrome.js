/* globals chrome */
'use strict';

var background = {
  send: function (id, data) {
    chrome.extension.sendRequest({method: id, data: data});
  },
  receive: function (id, callback) {
    chrome.extension.onRequest.addListener(function (request) {
      if (request.method === id) {
        callback(request.data);
      }
    });
  }
};

background.receive('resize', function (o) {
  document.body.style.width = o.width + 'px';
  document.body.style.height = (o.height - 20) + 'px';
  document.querySelector('html').style.height = (o.height - 20) + 'px';
});
background.send('resize');
