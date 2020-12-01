
![Adstxter logo](chrome/store/128.png)

# Adstxter

A simple chrome extension for checking [ads.txt](https://iabtechlab.com/ads-txt-about/) files. Provides a one-click test for the presence of given sellers. Active only when started by a user, otherwise it's suspended and not draining any resources. Handling of ads.txt follows the [IAB Tech Lab ads.txt Specification Version 1.0.2](https://iabtechlab.com/wp-content/uploads/2019/03/IAB-OpenRTB-Ads.txt-Public-Spec-1.0.2.pdf). 

Install it from the [Chrome Webstore](https://chrome.google.com/webstore/detail/ncdnbcbfjcflaocmpnhjajngpdoipnci).

## Usage

 - Test is triggered when the extension is started or new sellers are entered.
 - Targets the currently loaded website.

![Screenshot of Adstxter: test result](chrome/store/screenshot640x400_1.jpg)

![Screenshot of Adstxter: copying the missing sellers to clipboard](chrome/store/screenshot640x400_2.jpg)

## Limitations
 * Checking ads.txt on subdomains is currently not implemented.
 * Due to JavaScript security limitations, it's not possible to control the number of redirects when fetching ads.txt. (AFAIK). As a result, the following ads.txt directive isn't honored:

    > Only a single HTTP redirect to a destination outside the original root domain is allowed to facilitate one-hop delegation of authority to a third party's web server domain. If the third party location returns a redirect, then the advertising system should treat the response as an error.
    > - *IAB Tech Lab ads.txt Specification Version 1.0.2*
