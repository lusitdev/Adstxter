'use strict';

const tool = {
  copyToClip: function (copy) {
    navigator.clipboard.writeText(copy)
      .catch(err => {
        console.error('Could not copy the missing sellers: ', err);
      });
  },
  empty: function (element, parent) { // Remove element's childrens
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
    if (parent) element.parentNode.removeChild(element); // When parent is passed than the element itself is removed too
  }
};


let messageIndex = 0;
let msg;
let sellers;

const dom = {
  init: function () {
    const vars = ['header', '#result', '#loading', '#result button'];
    const arr = vars.map(ele => document.querySelector(ele));
    [dom.header, dom.result, dom.loading, dom.button] = arr;
    dom.buttonSpan = arr[3].querySelector('span');
    [dom.initHeader, dom.initResult] = arr.slice(0, 2).map(e => e.cloneNode(true)); // Clone the initial state of output elements
  },
  reInit: async function (status, func) {
    if (status === 3) dom.button.removeEventListener('click', func);
    const body = document.querySelector('body');
    await body.replaceChild(dom.initHeader, dom.header);
    await body.replaceChild(dom.initResult, dom.result);
    messageIndex = 0;
    dom.init();
  },
  sellersArea: document.getElementById('sellers'),
  footer: document.querySelector('footer'),
  showVersion: version => {
    const v = document.createTextNode(' ' + version);
    dom.footer.append(v);
  }
};
const refreshTooltip = "Refetch ads.txt from";
const linkTooltip = "Download ads.txt from";

dom.init();
dom.showVersion(chrome.runtime.getManifest().version);

function blurHandler(event) {
  let data = event.target.innerText;

  data = (data === `\n`) ? '' : data;
  if (data !== sellers) {
    sellers = data;
    chrome.runtime.sendMessage({
      action: 'saveSync',
      data: { sellers: data }
    });
    // background.saveSync({
    //   sellers: data
    // });
    if (!data) tool.empty(dom.sellersArea);
  }
}

function formatSellers(entries) {
  if (entries !== '') {
    const format = line => `<div>${line}</div>`;
    const formatted = entries.split(/\r?\n/).map(format);
    dom.sellersArea.innerHTML = formatted.join('');
  }
}

async function enterSync(sync) {
  sync = await sync; // Wait for loading sellers before requesting message
  sellers = sync.sellers;
  formatSellers(sync.sellers);
  chrome.runtime.sendMessage({ action: 'load' });
  // background.load();
}

function addIcon(ico) {
  const icon = document.createElement('i');

  icon.ariaHidden = true;
  icon.textContent = ico;
  return icon;
}

function addRefreshButton() {
  const refresh = document.createElement('button');
  const domain = msg.domain.includes('www.') ? msg.domain.slice(4) : msg.domain;

  refresh.textContent = domain;
  refresh.prepend(addIcon('\u21BB'));
  refresh.title = refreshTooltip + ' ' + domain;
  dom.header.append(refresh);
  refresh.addEventListener('click',
    function () {
      dom.reInit(msg.status, copyMissing).then(
        // background.refetch()
        chrome.runtime.sendMessage({ action: 'refetch' })
      );
    }, {
      once: true
    }
  );
}

function addChevron() {
  const chevron = addIcon('\u276F');
  chevron.classList.add('chevron')
  dom.header.append(chevron);
}

function addHeaderLink() {
  const link = document.createElement('a');
  link.textContent = 'ads.txt';
  link.prepend(addIcon('\u21E9'));
  link.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(msg.content);
  link.download = msg.domain.split(/\./).join('_') + '_ads.txt';
  link.title = linkTooltip + ' ' + msg.domain;
  dom.header.append(link);
}

function copyMissing() {
  tool.copyToClip(msg.check[2]);
}

function showResult([txt, color]) {
  if (msg.status > 2) dom.sellersArea.innerHTML = msg.check[1];
  dom.button.hidden = false;
  dom.button.tabIndex = "1";
  dom.buttonSpan.textContent = txt;
  if (color) dom.buttonSpan.classList.add(color);
  if (msg.status === 3) {
    dom.button.ariaDisabled = false;
    dom.button.addEventListener('click', copyMissing);
  }
  dom.result.ariaBusy = false;
}

function handleMessage(message) {
  messageIndex++;
  msg = message || msg;

  if (msg === 'reset') {
    dom.reInit(msg.status, copyMissing);
    return false;
  }

  let sellerMiss;
  if (msg.check) {
    sellerMiss = msg.check[0] + ' unauthorized seller';
    sellerMiss += (msg.check[0] > 1) ? 's' : '';
  }

  const resTextColor = [
    ['n / a'], // Status 0 - Tab content not a website
    ['ads.txt not found'], // Status 1 - No seller restrictions
    ['No sellers specified'], // Status 2 - No sellers to test 
    [sellerMiss, 'unau'], // Status 3 - Found missing sellers
    ['All sellers authorized!', 'auth'] // Status 4 - All sellers OK
  ];

  if (messageIndex < 2) {
    dom.loading.hidden = true; // Hide loading spinner

    if (msg.status > 0) {
      addRefreshButton();
      if (msg.status == 1 && msg.content.includes('content-type')) {
        resTextColor[1][0] = msg.content.slice(11); // Show message that wrong content-type returned
      } else if (msg.status > 1) {
        addChevron();
        addHeaderLink();
      }
    }
    showResult(resTextColor[msg.status]);
    dom.header.ariaBusy = false;
  } else if (msg.status > 1) {
    dom.reInit(msg.status, copyMissing).then(handleMessage);
    return false;
  }

  return false;
}


//enterSync(background.getSync());
chrome.runtime.sendMessage({action: 'getSync'}, enterSync);

dom.sellersArea.addEventListener('blur', blurHandler);
chrome.runtime.onMessage.addListener(handleMessage);
window.addEventListener('pagehide',
  () => {
    chrome.runtime.onMessage.removeListener(handleMessage);
    // background.unload();
  }, {
    once: true
  },
);