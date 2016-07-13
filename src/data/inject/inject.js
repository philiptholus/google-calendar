'use strict';

var css = `
html {
  border: 0;
  margin: 0;
  padding: 0;
  overflow-x: hidden;
}
body {
  background: #fff;
}

div[class="row"],
div[id="blpromo"],
div[class="footrow"],
div[class*="viewlinks"],
iframe[src*="/calendar/gpcal/"] + div {
  display: none !important;
  visibility: hidden !important;
}

div[id="og_head"] {
  display: none !important;
  visibility: hidden !important;
  height: 0 !important;
}

.ci-btn {
 cursor: pointer !important;
}
#signout {
  display: none;
}
#email {
  text-align: left;
  text-indent: 5px;
}
`;

document.addEventListener('DOMContentLoaded', function () {
  if (window.top === window) {
    return;
  }
  let style = document.createElement('style');
  style.setAttribute('media', 'screen');
  style.setAttribute('type', 'text/css');
  style.textContent = css;
  document.body.appendChild(style);
  // preventing panel from prompting alert or confirm
  let script = document.createElement('script');
  script.textContent = 'window.alert = window.confirm = function () {return true;}';
  document.body.appendChild(script);
}, false);

