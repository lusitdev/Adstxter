![](/lusitdev/Adstxter/raw/master/chrome/store/128.png?raw=true)

# Adstxter

## Overview
A simple chrome extension for fast detection of missing sellers in ads.txt files. Provides a one-click test for the presence of specified sellers. It's inactive and not using system resources when its popup isn't up. The implementation follows the final [IAB Tech Lab ads.txt Specification Version 1.0.2](https://iabtechlab.com/wp-content/uploads/2019/03/IAB-OpenRTB-Ads.txt-Public-Spec-1.0.2.pdf). Install it from the [Chrome Webstore](https://chrome.google.com/webstore/detail/adstxter-%E2%80%93-adstxt-seller/ncdnbcbfjcflaocmpnhjajngpdoipnci).

## Usage
 - Enter sellers you want to check in the input field of the Adstxter window. Entered sellers are saved across browser sessions until replaced or removed.
 - To run the test simply click on the extension icon.
 - The test targets the site loaded in active tab.

## Limitations
 * Checking ads.txt files on subdomains is currently not implemented.
 * Due to JavaScript security limitation, it's not possible to control the number of redirects when fetching ads.txt. As a result, the following ads.txt requirement is not honored:
    > Only a single HTTP redirect to a destination outside the original root domain is allowed to facilitate one-hop delegation of authority to a third party's web server domain. If the third party location returns a redirect, then the advertising system should treat the response as an error.
    > - IAB Tech Lab ads.txt Specification Version 1.0.2
