/* globals background */
'use strict';

window.addEventListener('load', function () {
  let iframe = document.querySelector('iframe');
  iframe.setAttribute('src', 'https://calendar.google.com/calendar');
}, false);

window.addEventListener('click', function (e) {
  let target = e.target;
  let url = target.dataset.url;
  if (url) {
    background.send('url', url);
  }
  if (url && url !== 'refresh') {
    window.close();
  }
}, false);
