'use strict';

var app = app || require('./firefox/firefox');
var config = config || require('./config');

app.startup(function () {
  let url = 'http://add0n.com/calendar.html';
  let version = app.runtime.getManifest().version;
  app.storage.local.get('version', function (obj) {
    if (obj.version !== version) {
      app.storage.local.set({version: version}, () => app.tabs.create({
        url: url + `?version=${version}&type=${obj.version ? 'update' : 'install'}`,
        active: true
      }));
    }
  });
});

function getEvents (callback) {
  let d = new Date();
  let time = ('0' + d.getHours()).substr(-2) + ('0' + d.getMinutes()).substr(-2) + ('0' + d.getSeconds()).substr(-2);
  let day = d.getFullYear() + ('0' + (d.getMonth() + 1)).substr(-2) + ('0' + d.getDate()).substr(-2);
  let pDay = d.toDateString();
  let url = `https://calendar.google.com/calendar/m?as_sdt=${day}T${time}`;
  var req = new app.window.XMLHttpRequest();
  let count = 0;
  let labels = [];
  req.open('GET', url, true);
  req.onload = function () {
    let parser = new app.window.DOMParser();
    let doc = parser.parseFromString(req.responseText, 'text/html');
    let today = Array.from(doc.querySelectorAll('span')).filter(s => pDay.indexOf(s.textContent) !== -1);
    if (today && today.length) {
      let links = Array.from(today[0].parentNode.querySelectorAll('a')).filter(a => a.getAttribute('href').indexOf('eid') !== -1);
      count = links.length;
      labels = links.map(a => a.parentNode.textContent.trim());
    }
    callback({count, labels});
  };
  req.onerror = () => callback(count);
  req.send();
}
var id;
function badge () {
  console.error('updating');
  app.window.clearTimeout(id);
  getEvents(function (obj) {
    let title = 'Google™ Calendar';
    let text = isNaN(obj.count) || obj.count === 0 ? '' : obj.count + '';
    if (obj.labels.length) {
      title += '\n\n' + obj.labels.join('\n');
    }
    if (obj.count > 9) {
      text = '+9';
    }
    app.browserAction.setBadgeText({text});
    app.browserAction.setTitle({title});
    id = app.window.setTimeout(badge, config.badge.time * 60 * 1000);
  });
}
badge();

app.webRequest.onBeforeRequest.addListener(
  function (details) {
    if (details.url.indexOf('load') !== -1 || details.url.indexOf('primary/events') !== -1) {
      app.window.clearTimeout(id);
      id = app.window.setTimeout(badge, 2 * 1000);
    }
  },
  {urls: [
    '*://calendar.google.com/calendar/load',
    '*://*.google.com/calendar/*',
    '*://clients6.google.com/calendar/v3/calendars/primary/*'
  ]},
  []
);

app.popup.receive('url', function (url) {
  if (url === 'refresh') {
    app.browserAction.setBadgeText({
      text: '-'
    });
    return badge();
  }
  app.popup.hide();
  if (url === 'faqs') {
    app.tabs.create({url: 'http://add0n.com/calendar.html?type=context'});
  }
  if (url === 'bug') {
    app.tabs.create({url: 'http://add0n.com/calendar.html?type=context'});
  }
  if (url === 'calendar') {
    app.tabs.create({url: 'https://calendar.google.com/calendar/render'});
  }
});
