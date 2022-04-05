"use strict";
let SpecReporter = require('jasmine-spec-reporter').SpecReporter
const HtmlReporter = require('protractor-beautiful-reporter');


Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.config = {
    directConnect: true,
    // Capabilities to be passed to the webdriver instance.
    capabilities: {
        'browserName': 'chrome',
        shardTestFiles: true,
        maxInstances: 2,
        // chromeOptions: {
        //     args: ['--headless']
        // }
    },
    // Framework to use. Jasmine is recommended.
    framework: 'jasmine',
    // Spec patterns are relative to the current working directory when
    // protractor is called.
    specs: ['./DropDown.js'],
    onPrepare: function () {
        jasmine.getEnv().addReporter(
            new SpecReporter({
                suite: {
                    displayNumber: true // display each suite number (hierarchical)
                },
                spec: {
                    displayPending: false, // display each pending spec
                    displayDuration: true // display each spec duration
                },
                summary: {
                    displaySuccesses: true, // display summary of all successes after execution
                    displayFailed: true, // display summary of all failures after execution
                    displayPending: true // display summary of all pending specs after execution
                }
            })
        );
        var AllureReporter = require('jasmine-allure-reporter');
        jasmine.getEnv().addReporter(new AllureReporter({
            resultsDir: 'allure-results'
        }));
        // jasmine.getEnv().addReporter(new AllureReporter());
        // jasmine.getEnv().afterEach(function (done) {
        //     browser.takeScreenshot().then(function (png) {
        //         allure.createAttachment('Screenshot', function () {
        //             return new Buffer(png, 'base64')
        //         }, 'image/png')();
        //         done();
        //     })
        // });
        jasmine.getEnv().addReporter(new HtmlReporter({
            baseDirectory: 'target/screenshots',
            takeScreenShotsOnlyForFailedSpecs: true
        }).getJasmine2Reporter());
    }

};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL2NvbmYudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBRVcsUUFBQSxNQUFNLEdBQVc7SUFDeEIsYUFBYSxFQUFFLElBQUk7SUFFbkIsdURBQXVEO0lBQ3ZELFlBQVksRUFBRTtRQUNWLGFBQWEsRUFBRSxRQUFRO1FBQ3ZCLG1CQUFtQjtRQUNuQiwyQkFBMkI7UUFDM0IsSUFBSTtLQUNQO0lBRUQsNENBQTRDO0lBQzVDLFNBQVMsRUFBRSxTQUFTO0lBRXBCLG1FQUFtRTtJQUNuRSx3QkFBd0I7SUFFeEIsS0FBSyxFQUFFLENBQUMsZ0JBQWdCLENBQUM7Q0FFNUIsQ0FBQyJ9