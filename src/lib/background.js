'use strict';

var app = app || require('./firefox/firefox');
var config = config || require('./config');
var rrule = rrule || require('./rrule');
var moment = (moment || require('./moment')).moment;

function get (url) {
  return new app.Promise(function (resolve, reject) {
    let req = new app.window.XMLHttpRequest();
    req.open('GET', url, true);
    req.setRequestHeader('Cache-Control', 'no-cache');
    req.onload = () => resolve(req);
    req.onerror = (e) => reject(e);
    req.send();
  });
}

function ics () {
  return get('https://calendar.google.com/calendar/render')
    .then(req => req.responseText)
    .then(content => {
      let tmp = /_DS_put'\,[^\,]+\,[^\,]+\,[^\,]+\,[^\,]+\,[^\,]+\,[^\,]+\,[^\,]+\,[^\,]+\,[^\,]+\,\'([^\,]+)\'\,[^\,]+\,[^\,]+\,[^\,]+\,[^\,]+\,\'([^\,\']+)/.exec(content);
      if (tmp && tmp.length) {
        return {
          id: tmp[1],
          email: tmp[2]
        };
      }
      throw Error('Cannot extract info');
    })
    .then(obj => `https://calendar.google.com/calendar/ical/${obj.email}/private-${obj.id}/basic.ics`);
}

function convert (source) {
  // http://stackoverflow.com/questions/1155678/javascript-string-newline-character
  var NEW_LINE = /\r\n|\n|\r/;
  var currentKey = '',
      currentObj,
      currentValue = '',
      line,
      output = {},
      parents,
      parentObj = {},
      i,
      linesLength,
      lines = source.split(NEW_LINE),
      splitAt;

  currentObj = output;
  parents = [];

  for (i = 0, linesLength = lines.length; i < linesLength; i++) {
    line = lines[i];
    if (line.charAt(0) === ' ') {
      currentObj[currentKey] += line.substr(1);
    }
    else {
      splitAt = line.indexOf(':');

      if (splitAt < 0) {
        continue;
      }

      currentKey = line.substr(0, splitAt);
      currentValue = line.substr(splitAt + 1);

      switch (currentKey) {
        case 'BEGIN':
          parents.push(parentObj);
          parentObj = currentObj;
          if (parentObj[currentValue] == null) {
            parentObj[currentValue] = [];
          }
          currentObj = {};
          parentObj[currentValue].push(currentObj);
          break;
        case 'END':
          currentObj = parentObj;
          parentObj = parents.shift();
          break;
        default:
          if(currentObj[currentKey]) {
            if(!Array.isArray(currentObj[currentKey])) {
              currentObj[currentKey] = [currentObj[currentKey]];
            }
            currentObj[currentKey].push(currentValue);
          } else {
            currentObj[currentKey] = currentValue;
          }
      }
    }
  }
  return output;
}

function toMoment (name, time) {
  if (name && time) {
    let zone = '';
    let tmp = /TZID\=(.+)/.exec(name);
    if (tmp && tmp.length) {
      zone = tmp[1];
    }
    let rtn = moment.tz(time, zone);
    return rtn.isValid() ? rtn : null;
  }
  else {
    return;
  }
}

function getEvents (callback) {
  let now = moment();
  let after = now.clone().add(config.schedule.period, 'hours');

  app.storage.local.get('ics', function (o) {
    (o.ics ? app.Promise.resolve(o.ics) : ics())
    .then(url => {
      app.storage.local.set({
        ics: url
      });
      return get(url);
    })
    .then(r => r.responseText)
    .then(convert)
    .then(o => {
      if (config.debug > 1) {
        console.error(o);
      }
      return o;
    })
    .then(obj => {
      let tmp = [];
      if (obj.VEVENT && obj.VEVENT.length) {
        tmp = tmp.concat(obj.VEVENT);
      }
      if (obj.VCALENDAR) {
        obj.VCALENDAR.map(o => {
          if (o.VEVENT) {
            tmp = tmp.concat(o.VEVENT);
          }
        });
      }
      return tmp;
    })
    .then(arr => [].concat.apply([], arr))
    .then(arr => arr.map(o => {
      let start = Object.keys(o).filter(n => n.startsWith('DTSTART'))[0];
      let end = Object.keys(o).filter(n => n.startsWith('DTEND'))[0];
      start = toMoment(start, o[start]);
      end = toMoment(end, o[end]);
      let rule;
      if (o.RRULE) {
        try {
          rule = rrule.RRule.fromString(o.RRULE + ';DTSTART=' + start.toISOString().split('.')[0].replace(/[\-\:]/g, '') + 'Z');
        }
        catch (e) {
          if (config.debug > 0) {
            console.err(e, o.RRULE);
          }
        }
      }
      if (rule) {
        let tmp = rule.between(now.toDate(), after.toDate());
        if (tmp.length) {
          return {
            start: tmp.map(d => moment(d)),
            object: o
          };
        }
      }
      else if (start && end) {
        if (end.isBetween(now, after)) {
          return {
            start: [start],
            end,
            object: o
          };
        }
      }
      return o;
    }).filter(o => o.start))
    .then(arr => ({
        count: arr.length,
        labels: arr.map(o => o.start.map(m => m.local().format('MM-DD hh:mm')).join(', ') + ' -> ' + o.object.SUMMARY)
      }))
    .then(callback)
    .catch (error => {
      if (config.debug > 0) {
        console.error(error);
      }
      callback({error});
    });


  });


}
var id;
function badge (url) {
  if (config.debug > 1) {
    console.error('updating', new Date(), url);
  }
  app.window.clearTimeout(id);
  getEvents(function (obj) {
    let title = 'Google™ Calendar';
    if (obj.error) {
      app.browserAction.setBadgeText({
        text: '!'
      });
      app.browserAction.setTitle({
        title: title + '\n\n' + obj.error
      });
    }
    else {
      let text = isNaN(obj.count) || obj.count === 0 ? '' : obj.count + '';
      title = title + '\nShowing events for the next ' + config.schedule.period + ' hours';
      if (obj.labels.length) {
        title += '\n\n' + obj.labels.join('\n');
      }
      app.browserAction.setBadgeText({text});
      app.browserAction.setTitle({title});
    }
    id = app.window.setTimeout(badge, config.badge.time * 60 * 1000);
  });
}
//config
app.storage.local.get(['schedule.period', 'badge.time'], function (obj) {
  config.schedule.period = obj['schedule.period'] || config.schedule.period;
  config.badge.time = obj['badge.time'] || config.badge.time;
  badge();
});
app.storage.onChanged.addListener(function (obj) {
  if (obj['schedule.period']) {
    let tmp = obj['schedule.period'].newValue;
    if (isNaN(tmp)) {
      tmp = 24;
    }
    else {
      tmp = +tmp;
    }
    tmp = Math.max(tmp, 1);
    config.schedule.period = tmp;
    app.storage.local.set({
      'schedule.period': tmp
    });
    id = app.window.setTimeout(badge, 2 * 1000, 'reset');
  }
  if (obj['badge.time']) {
    let tmp = obj['badge.time'].newValue;
    if (isNaN(tmp)) {
      tmp = 30;
    }
    else {
      tmp = +tmp;
    }
    tmp = Math.max(tmp, 5);
    config.badge.time = tmp;
    app.storage.local.set({
      'badge.time': tmp
    });
    app.window.clearTimeout(id);
    id = app.window.setTimeout(badge, 2 * 1000, 'reset');
  }
});

app.webRequest.onBeforeRequest.addListener(
  function (details) {
    if (details.url.indexOf('load') !== -1 || details.url.indexOf('primary/events') !== -1) {
      app.window.clearTimeout(id);
      id = app.window.setTimeout(badge, 2 * 1000, details.url);
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
    app.tabs.create({url: 'https://github.com/philiptholus/google-calendar'});
  }
  if (url === 'calendar') {
    app.tabs.create({url: 'https://calendar.google.com/calendar/render'});
  }
});

app.startup(function () {
  let url = 'http://add0n.com/calendar.html';
  let version = app.runtime.getManifest().version;
  app.storage.local.get('version', function (obj) {
    if (obj.version !== version) {
      app.storage.local.set({version: version}, () => app.tabs.create({
        url: url + `?version=${version}&type=${obj.version ? 'update' : 'install'}`
      }));
    }
  });
});
