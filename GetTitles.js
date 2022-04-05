"use strict";
exports.__esModule = true;
var protractor_1 = require("protractor");
describe('Wait', function () {
    it('Verify', function () {
        protractor_1.browser.ignoreSynchronization = true;
        protractor_1.browser.get('http://demo.automationtesting.in/Frames.html');
        protractor_1.browser.getTitle().then(function (value) {
            console.log(value);
        });
    });
});
