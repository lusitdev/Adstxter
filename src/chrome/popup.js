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

function formatSellers(entries) {
  console.log('formatSellers(entries): ' + entries);
  if (entries && entries !== '') {
    const formatted = entries
      .split(/\r?\n/)
      .map(l => `<div>${l}</div>`);
    dom.sellersArea.innerHTML = formatted.join('');
  }
}

async function enterSync(sync) {
  try {
    sync = await sync; // Wait for loading sellers before requesting message
    if (!sync) {
      console.error('No response received from background script for getSync action');
      return;
    }
    sellers = sync.sellers || ''; // Ensure sellers is at least an empty string
    formatSellers(sync.sellers);
    sendMessageWithRetry({ action: 'load' });
  } catch (error) {
    console.error('Error in enterSync:', error);
  }
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
        sendMessageWithRetry({ action: 'refetch' })
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

function sendMessageWithRetry(message, callback, maxRetries = 3, delay = 100) {
  let attempts = 0;
  
  function attemptSend() {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError || !response) {
        attempts++;
        if (attempts <= maxRetries) {
          setTimeout(attemptSend, delay * attempts); // Exponential backoff
        } else if (callback) {
          callback(null);
        }
      } else if (callback) {
        callback(response);
      }
    });
  }
  
  attemptSend();
}

function waitForServiceWorker() {
  return new Promise((resolve) => {
    function checkServiceWorker() {
      chrome.runtime.sendMessage({action: 'ping'}, response => {
        if (response && response.status === 'ready') {
          resolve();
        } else {
          setTimeout(checkServiceWorker, 50);
        }
      });
    }
    checkServiceWorker();
  });
}

async function initPopup() {
  await waitForServiceWorker();
  // Now safe to send messages
  sendMessageWithRetry({ action: 'getSync' }, enterSync);
}

dom.sellersArea.addEventListener('input', async (e) => {
  const data = e.target.innerText;
  const cleanData = (data === `\n`) ? '' : data;

  if (cleanData !== sellers) {
    sendMessageWithRetry({
      action: 'saveSync',
      data: { sellers: data }
    });
  }
});

dom.sellersArea.addEventListener('blur', async (e) => {
  const data = e.target.innerText;
  const cleanData = (data === `\n`) ? '' : data;

  if (cleanData !== sellers) {
    sendMessageWithRetry({ action: 'noFetchEval', data: { sellers: cleanData }});
  }
});


chrome.runtime.onMessage.addListener(handleMessage);

initPopup();