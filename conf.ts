import { Config } from "protractor";

export let config: Config = {
    directConnect: true,

    // Capabilities to be passed to the webdriver instance.
    capabilities: {
        'browserName': 'chrome'
        // chromeOptions: {
        //     args: ['--headless']
        // }
    },

    // Framework to use. Jasmine is recommended.
    framework: 'jasmine',

    // Spec patterns are relative to the current working directory when
    // protractor is called.

    specs: ['./GetTitles.js']

};
