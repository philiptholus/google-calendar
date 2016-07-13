'use strict';

function restore () {
  chrome.storage.local.get({
    'badge.time': 30,
    'schedule.period': 48,
    'ics': ''
  }, function(items) {
    document.getElementById('badge.time').value = items['badge.time'];
    document.getElementById('schedule.period').value = items['schedule.period'];
    document.getElementById('ics').value = items.ics;
  });
}

function save () {
  chrome.storage.local.set({
    'badge.time':  document.getElementById('badge.time').value,
    'schedule.period':  document.getElementById('schedule.period').value,
    'ics':  document.getElementById('ics').value
  }, function() {
    let status = document.getElementById('status');
    status.textContent = 'Options saved.';
    restore();
    setTimeout(() => status.textContent = '', 750);
  });
}

document.addEventListener('DOMContentLoaded', restore);
document.getElementById('form').addEventListener('submit', function (e) {
  e.preventDefault();
  save();
});
