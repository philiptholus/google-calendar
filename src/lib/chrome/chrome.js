'use strict';

var app = chrome;

app.window = window;

app.startup = function (c) {
  c();
};

app.popup = {
  send: (id, data) => chrome.extension.sendRequest({method: id, data: data}),
  receive: (id, callback) => chrome.extension.onRequest.addListener(function (request, sender) {
    if (request.method === id && !sender.tab) {
      callback(request.data);
    }
  }),
  hide: function () {}
};

/* webRequest */
chrome.webRequest.onBeforeSendHeaders.addListener(
  function (info) {
    var headers = info.requestHeaders;
    if (info.tabId > -1 || info.type !== 'sub_frame') {
      return;
    }
    for (var i = 0; i < headers.length; i++) {
      if (headers[i].name.toLowerCase() === 'user-agent') {
        headers[i].value = 'Mozilla/5.0 (iPhone; CPU iPhone OS 8_0_2 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Version/8.0 Mobile/12A405 Safari/600.1.4';
      }
    }
    return {requestHeaders: headers};
  },
  {
    urls: [
      '*://accounts.google.com/*', '*://*.accounts.google.com/*',
      '*://www.google.com/calendar/*', '*://*.google.com/calendar/*'
    ]
  }, ['blocking', 'requestHeaders']
);

chrome.webRequest.onHeadersReceived.addListener(
  function (details) {
    if (details.type !== 'sub_frame') {
      return;
    }
    details.responseHeaders = details.responseHeaders
      .filter(h => h.name.toLowerCase() !== 'x-frame-options' && h.name.toLowerCase() !== 'frame-options');
    return {
      responseHeaders: details.responseHeaders
    };
  },
  {urls: [
    'https://accounts.google.com/ServiceLogin*',
    'https://calendar.google.com/*',
    'https://www.google.com/calendar/*',
    'https://google.com/calendar/*'
  ]}, ['blocking', 'responseHeaders']
);
