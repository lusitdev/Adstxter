'use strict';

chrome.runtime.onInstalled.addListener(
  // Set up storage for sellers on extension install
  function (details) {
    if (details.reason === 'install') {
      chrome.storage.sync.set({
        sellers: ''
      });
    }
  }
);

const config = (function() {
  // Hold our data and track initialization
  const data = {};
  let initPromise = null;
  
  // Initialize once
  function initialize() {
    if (!initPromise) {
      initPromise = new Promise(resolve => {
        chrome.storage.sync.get(null, items => {
          Object.assign(data, items);
          if (typeof data.sellers !== 'string') {
            data.sellers = '';
          }
          resolve(data);
        });
      }).catch(err => {
        console.warn('Config initialization failed:', err);
        data.sellers = '';
        return data;
      });
    }
    return initPromise;
  }
  
  initialize();
  
  return {
    getSync: async function() {
      await initialize();
      return { sellers: data.sellers || '' };
    },
    
    get sellers() {
      return data.sellers || '';
    },
    
    set sellers(value) {
      data.sellers = value;
    }
  };
})();

const Fetcher = function (cache) { // Pass reload to avoid cached result
  const requestInit = {
    cache: cache,
    credentials: 'omit'
  };
  let http = false;
  let www = '';
  let host;
  let filePath;
  let path;
  let suffixes;
  let func;

  async function findSuffix(host, len = host.length - 1) {
    if (len < 1) return host.join('.'); // Just in case suffix is not in the list
    const suffix = host.slice(len * -1).join('.');
    const regSuffix = ['\^', suffix, '\[\\s\\uFEFF\\xA0\]\*\$'].join('');
    const regex = new RegExp(regSuffix, 'im');
    suffixes = suffixes || await data.suffix.list;

    return (regex.test(suffixes)) ?
      getText(
        host[host.length - (len + 1)] + '.' + suffix,
        'ads.txt',
        data.novo) :
      await findSuffix(host, --len);
  }

  function getDomain(newUrl) {
    if (!newUrl.includes('https://') && !newUrl.includes('http://')) {
      return data.novo([null, 0]); // Exit and send message with msg.status = 0
    }
    const url = new URL(newUrl);
    let host = url.hostname;
    if (host.includes('www.')) {
      www = 'www.';
      host = host.slice(4);
    }
    host = host.split('.');

    return (host.length > 2) ?
      findSuffix(host) :
      getText(host.join('.'), 'ads.txt', data.novo);
  }

  function onlyOK(response) {
    if (!response.ok) {
      throw new Error(response.status);
    }
    return response;
  }

  function onlyPlainText(response) {
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/plain')) {
      throw new TypeError("ads.txt content ignored: invalid content-type ");
    }
    return response;
  }

  function errorHandler(err) {
    if (!http && filePath.includes('ads.txt')) {
      http = true;
      path = undefined;
      getText(host); // HTTPS fetch failed. Trying HTTP connection...
    } else {
      func([www + host, 1, `${err}`]);
    }
  }

  function getText(hostNew, filePathValue, fetchResolver) {
    host = hostNew;
    filePath = filePath || filePathValue;
    func = func || fetchResolver;
    if (!popup.up() && !filePath.includes('.dat')) return;
    path = path || (!http ? 'https:' : 'http:') + '//' + www + host + '/' + filePath;
    fetch(path, requestInit)
      .then(onlyOK)
      .then(onlyPlainText) // Reject promise when non-standard content-type served
      .then(res => res.text())

      .then(res => func([www + host, 2, res]))
      .catch(errorHandler);
  }

  return Object.freeze({
    getDomain,
    getText
  });
};

//Popup API
const popup = (function () {
  let up = 0;

  function sellersUpdate() {
    (data.result.status === 0) ?
    popup.message({
        status: 0
      }):
      data.novo([0, data.result.status]);
  }

  function getTab() {
    chrome.tabs.query({
        active: true,
        currentWindow: true,
        windowType: "normal"
      },
      function (tabs) {
        if (!tabs || tabs.length === 0) return;
        const request = Fetcher('default');
        if (up) request.getDomain(tabs[0].url);
      }
    );
  }

  function lateLoadURL(tabId, changeInfo, pTab) { // Capture URL if loaded later than the popup was open
    if (changeInfo.url && pTab.active) {
      popup.message('reset'); // Send message new fetch is upcomming
      const request = Fetcher('default');
      if (up) request.getDomain(changeInfo.url);
    }
  }

  return {
    up: (sendResponse) => {
      if (sendResponse) sendResponse(up);
      return up;
    },
    load: function () {
      up = 1;
      chrome.storage.local.set({popupActive: up});
      chrome.tabs.onUpdated.addListener(lateLoadURL);
      getTab();
    },
    unload: function () {
      up = 0;
      chrome.storage.local.set({popupActive: up});
      chrome.tabs.onUpdated.removeListener(lateLoadURL);
    },
    getSync: async function(sendResponse) {
      const data = await config.getSync();
      if (sendResponse) {
        sendResponse(data);
      }
      return data;
    },
    saveSync: function (data) { // Save specified sellers to sync storage
      chrome.storage.sync.set(data, function () {
        if (data.sellers !== undefined) {
          config.sellers = data.sellers;
          if (up) sellersUpdate();
        }
      });
    },
    message: function (resObj) {
      if (up) {
        try {
          chrome.runtime.sendMessage(resObj, () => {
            if (chrome.runtime.lastError) {
              // Silently handle the error
              console.debug('Message recipient unavailable:', chrome.runtime.lastError);
            }
          });
        } catch (error) {
          console.debug('Error sending message:', error);
        }
      }
    },
    refetch: function () {
      const request = Fetcher('reload');
      request.getText(
        data.result.domain,
        'ads.txt',
        data.novo
      );
    }
  };
})();

const checker = (() => {
  function testAdsTxt(resObj) {
    let matched = ''; // Stores itemDiv sellers result for sellers div
    let match = 0;
    let miss = 0;
    let copy = '';
    const sellerLines = config.sellers.split(/\r?\n/);

    if (sellerLines) {
      for (const item of sellerLines) {
        let res = testMatch(resObj, item);
        let itemDiv = '<div class="';
        let ariaLabel;
        if (res) {
          if (res === 'unau') {
            ++miss;
            copy += `${item}\n`;
            ariaLabel = 'Unauthorized:';
          } else {
            ++match;
            ariaLabel = 'Authorized:';
          }
          itemDiv += 'seller ' + res;
        } else {
          itemDiv += 'ignored';
          ariaLabel = 'Not a seller:';
        }
        itemDiv += `" aria-label="${ariaLabel}">${item}</div>`;

        matched += itemDiv;
      }
      resObj.check = [miss, matched, copy, match];
      resObj.status = (!miss && !match) ? 2 : (!miss) ? 4 : 3;
    } else {
      resObj.status = 2;
      resObj.check = 0;
    }

    popup.message(resObj);
  }

  function testMatch(resObj, line) {
    const thirdField = new RegExp(/(?:\bRESELLER\b|\bDIRECT\b)/, 'i'); // Whole words only, non capturing groups
    const comment = new RegExp(/^[\s\uFEFF\xA0]*#/);
    const hash = new RegExp(/[\s\uFEFF\xA0]*#[\s\uFEFF\xA0]*/);
    const comma = new RegExp(/[\s\uFEFF\xA0]*,[\s\uFEFF\xA0]*/);

    if (!line.includes('#') || (line.includes('#') && !comment.test(line))) {
      if (line.includes('#')) line = line.trim().split(hash)[0];
      const arr = line.trim().split(comma);
      if (arr.length > 2) {
        if (arr[0].length > 4 &&
          arr[1].length > 0 &&
          thirdField.test(arr[2])) {
          let item = arr.join(',');
          item = "".concat(...['\^', item, '\[\\s\\uFEFF\\xA0\]\*\(\$\|#\|,\)']);
          item = item.replace(/,/g, '\[\\s\\uFEFF\\xA0\]\*,\[\\s\\uFEFF\\xA0\]\*');
          const regex = new RegExp(item, 'im');

          return (regex.test(resObj.content)) ? 'auth' : 'unau';
        }
      }
    }
    return 0;
  }

  return {
    start: function (resObj) {
      if (!config.sellers) {
        resObj.status = 2;
        popup.message(resObj);
        return;
      }
      testAdsTxt(resObj);
    }
  }
})();

const data = (() => {
  const week = 604800000; // Period per which suffix list is updated
  const suffixUrl = ['publicsuffix.org', 'list/public_suffix_list.dat'];
  const suffixFail = 'Failed to download domain suffixes from publicsuffix.org';

  function handleSuffix(res) { // res array: domain, status, content
    if (res[1] > 1) {
      chrome.storage.local.set({
        suffix: {
          list: res[2],
          date: Date.now()
        }
      });
      return res[2];
    } else {
      if (data.oldSuffix.list) { // Return old data due to fetch error
        return data.oldSuffix.list;
      } else {
        console.warn(suffixFail); // Warn about failed suffix list download 
      }
    }
  }

  function resolveLocal(storage) {
    if (storage.suffix &&
      storage.suffix.list &&
      (Date.now() - week < storage.suffix.date)) {
      return storage.suffix.list;
    } else {
      if (storage.suffix && storage.suffix.list) data.oldSuffix = storage.suffix;
      const request = Fetcher('default');
      return new Promise(func => request.getText(...suffixUrl, func)).then(handleSuffix).catch(console.error);
    }
  }

  function getSuffixList() {
    return new Promise(resolver => chrome.storage.local.get(null, resolver))
      .then(resolveLocal).catch(console.error);
  }

  function newSite([domain, status, content]) {
    if (domain !== 0) { // Condition to filter out upSellers()
      data.result = {
        domain: domain,
        status: status,
        content: content
      }
    }
    chrome.storage.local.set({resultData: data.result});
    if (status > 1) {
      checker.start(data.result);
    } else {
      popup.message(data.result);
    }
  }

  return {
    suffix: {
      list: getSuffixList()
    },
    novo: newSite
  };
})();

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  const handler = popup[message.action];
  if (message.action === 'ping') {
    sendResponse({status: 'ready'});
    return true;
  }

  if (handler && message.action === 'saveSync') {
    handler(message.data);
    sendResponse({received: 'true'});
    return true;
  }

  if (handler) {
    handler(sendResponse);
    return true; // Required for async response
  }
});